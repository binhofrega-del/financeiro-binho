import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { entrar, sair, jaAutorizou, tokenValido, lerVersao, baixar, enviar, backupDiario, ErroLogin } from '../services/googleDrive';
import { gerarId, faturaDaCompra, calcularSaldos, chaveDaData, hojeISO } from '../utils/financas';
import { carimbar, mesclar, mesmoConteudo, novaGeracao } from '../utils/sync';

const AppContext = createContext();

// App começa vazio: os dados reais vêm do Google Drive ou da importação do Organizze
const dadosIniciais = {
  contas: [],
  cartoes: [],
  lancamentos: [],
  categorias: [
    { id: 1, nome: 'Moradia', emoji: '🏠' },
    { id: 2, nome: 'Alimentação', emoji: '🍔' },
    { id: 3, nome: 'Utilidades', emoji: '💡' },
    { id: 4, nome: 'Viagem', emoji: '✈️' },
    { id: 5, nome: 'Assinatura', emoji: '📺' },
    { id: 6, nome: 'Aluguel', emoji: '🏘️' },
    { id: 7, nome: 'Imóvel', emoji: '🏗️' },
    { id: 8, nome: 'Saúde', emoji: '💊' },
    { id: 9, nome: 'Transporte', emoji: '🚗' },
    { id: 10, nome: 'Lazer', emoji: '🎉' },
    { id: 11, nome: 'Educação', emoji: '📚' },
    { id: 12, nome: 'Salário', emoji: '💼' },
    { id: 13, nome: 'Outros', emoji: '📌' },
  ],
};

// Calcula mês/ano da fatura baseado na data e dia de fechamento do cartão
function calcFaturaData(data, diaFechamento) {
  const f = faturaDaCompra(data, diaFechamento);
  return { faturaMes: f.mes, faturaAno: f.ano };
}

// Migração: corrige parcelados onde todas as parcelas têm o mesmo faturaMes (bug antigo)
function migrarFaturaParcelados(lancamentos, cartoes) {
  const grupos = {};
  lancamentos.forEach(l => {
    if (l.grupoId && l.cartaoId && l.faturaMes != null) {
      if (!grupos[l.grupoId]) grupos[l.grupoId] = [];
      grupos[l.grupoId].push(l);
    }
  });

  const fixar = {};
  Object.values(grupos).forEach(grupo => {
    if (grupo.length < 2) return;
    const unique = new Set(grupo.map(l => `${l.faturaMes}-${l.faturaAno}`));
    if (unique.size > 1) return; // já variado — sem migração necessária
    const cartao = cartoes.find(c => c.id === grupo[0].cartaoId);
    if (!cartao) return;
    grupo.forEach(l => {
      const fat = calcFaturaData(l.data, cartao.diaFechamento);
      fixar[l.id] = fat;
    });
  });

  if (Object.keys(fixar).length === 0) return lancamentos;
  return lancamentos.map(l => fixar[l.id] ? { ...l, ...fixar[l.id] } : l);
}

function aplicarMigracoes(dados) {
  const lancamentos = (dados.lancamentos || []).map(l => ({
    ...l,
    cartaoId: l.cartaoId || null,
    contaId: l.contaId || null,
  }));
  return {
    ...dados,
    contas: dados.contas || [],
    cartoes: dados.cartoes || [],
    categorias: dados.categorias || [],
    lancamentos: migrarFaturaParcelados(lancamentos, dados.cartoes || []),
    removidos: dados.removidos || {},
    meta: dados.meta || {},
  };
}

const CHAVE_DADOS_INICIAL = 'financeiro-app-dados';
function carregarDados() {
  try {
    const salvo = localStorage.getItem(CHAVE_DADOS_INICIAL);
    if (salvo) return aplicarMigracoes(JSON.parse(salvo));
  } catch { /* localStorage indisponível ou corrompido → usa dados iniciais */ }
  return aplicarMigracoes(dadosIniciais);
}

const CHAVE_DADOS = 'financeiro-app-dados';
const CHAVE_VERSAO = 'fin_drive_versao';   // versão do arquivo do Drive que este aparelho já tem
const CHAVE_PENDENTE = 'fin_pendente';     // há alterações deste aparelho ainda não enviadas
const CHAVE_BACKUP = 'fin_ultimo_backup';  // dia do último backup diário feito por este aparelho
const CHAVE_ULTIMA = 'fin_ultima_sync';

const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* cheio ou bloqueado */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

// Status da sincronização mostrado no ícone da nuvem:
//   iniciando | sincronizando | sincronizado | pendente | offline | reconectar | desconectado | erro
export function AppProvider({ children }) {
  const [dados, setDados] = useState(carregarDados);
  const [driveStatus, setDriveStatus] = useState(() => (tokenValido() ? 'iniciando' : jaAutorizou() ? 'reconectar' : 'desconectado'));
  const [ultimaSync, setUltimaSync] = useState(() => Number(ls.get(CHAVE_ULTIMA)) || null);
  const dadosRef = useRef(dados);
  const rodando = useRef(false);
  const deNovo = useRef(false);
  const timer = useRef(null);
  const mutacoes = useRef(0);

  // Guarda sempre neste aparelho
  useEffect(() => {
    dadosRef.current = dados;
    ls.set(CHAVE_DADOS, JSON.stringify(dados));
  }, [dados]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- usa só refs e setters estáveis
  const sincronizar = useCallback(async ({ baixarSempre = false } = {}) => {
    if (rodando.current) { deNovo.current = true; return; }
    const pendente = ls.get(CHAVE_PENDENTE) === '1';
    if (!tokenValido()) { setDriveStatus(jaAutorizou() ? 'reconectar' : 'desconectado'); return; }
    if (navigator.onLine === false) { setDriveStatus('offline'); return; }

    rodando.current = true;
    const mutacoesNoInicio = mutacoes.current;
    setDriveStatus('sincronizando');
    try {
      const arq = await lerVersao();                 // só a versão, sem baixar o arquivo
      let atual = dadosRef.current;
      let remoto = null;
      if (arq && (baixarSempre || arq.versao !== ls.get(CHAVE_VERSAO))) {
        remoto = aplicarMigracoes(await baixar(arq.id));
        const antes = atual;
        const junto = mesclar(antes, remoto);
        if (!mesmoConteudo(junto, antes)) {
          // aplica o que veio do Drive sem perder o que foi feito aqui enquanto baixava
          setDados(d => (d === antes ? junto : mesclar(d, junto)));
          atual = junto;
        }
      }
      let versao = arq?.versao ?? null;
      const precisaEnviar = !arq || pendente || (remoto && !mesmoConteudo(atual, remoto));
      if (precisaEnviar) {
        const r = await enviar(atual, arq?.id);
        versao = r.versao;
      }
      ls.set(CHAVE_VERSAO, versao);
      if (mutacoes.current === mutacoesNoInicio) ls.del(CHAVE_PENDENTE);
      else deNovo.current = true;
      const agora = Date.now();
      ls.set(CHAVE_ULTIMA, String(agora));
      setUltimaSync(agora);
      setDriveStatus(ls.get(CHAVE_PENDENTE) === '1' ? 'pendente' : 'sincronizado');

      // backup diário (uma vez por dia por aparelho; falha aqui não atrapalha a sincronização)
      const hoje = hojeISO();
      if (ls.get(CHAVE_BACKUP) !== hoje) {
        backupDiario(atual, hoje).then(() => ls.set(CHAVE_BACKUP, hoje)).catch(() => {});
      }
    } catch (e) {
      if (e instanceof ErroLogin) setDriveStatus('reconectar');
      else if (navigator.onLine === false) setDriveStatus('offline');
      else setDriveStatus('erro');
    } finally {
      rodando.current = false;
      if (deNovo.current) {
        deNovo.current = false;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => sincronizar(), 400);
      }
    }
  }, []);

  function agendarEnvio() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => sincronizar(), 1500);
  }

  // Toda alteração feita no app passa por aqui: carimba data/hora e agenda o envio ao Drive
  function atualizar(fn) {
    mutacoes.current++;
    ls.set(CHAVE_PENDENTE, '1');
    setDados(d => carimbar(d, fn(d)));
    setDriveStatus(s => (s === 'sincronizando' ? s : tokenValido() ? 'pendente' : jaAutorizou() ? 'reconectar' : 'desconectado'));
    agendarEnvio();
  }

  // Ao abrir: busca a versão mais nova do Drive. Ao voltar para o app / reconectar / a cada 2 min: confere de novo.
  useEffect(() => {
    if (tokenValido()) sincronizar({ baixarSempre: true });
    const aoVoltar = () => { if (document.visibilityState === 'visible') sincronizar(); };
    const aoConectar = () => sincronizar();
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    window.addEventListener('online', aoConectar);
    const intervalo = setInterval(() => { if (document.visibilityState === 'visible') sincronizar(); }, 120000);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
      window.removeEventListener('online', aoConectar);
      clearInterval(intervalo);
    };
  }, [sincronizar]);

  // Login / reconexão (precisa vir de um toque do usuário)
  async function conectarDrive() {
    setDriveStatus('sincronizando');
    try {
      await entrar();
      await sincronizar({ baixarSempre: true });
    } catch {
      setDriveStatus(jaAutorizou() ? 'reconectar' : 'desconectado');
    }
  }

  function desconectarDrive() {
    sair();
    ls.del(CHAVE_VERSAO);
    setDriveStatus('desconectado');
  }

  function sincronizarDrive() {
    return sincronizar({ baixarSempre: true });
  }

  // Primeira vez neste aparelho, sem dados e sem login → tela de login
  const precisaLogin = !jaAutorizou() && dados.lancamentos.length === 0 && dados.contas.length === 0;

  // CONTAS
  function adicionarConta(conta) {
    atualizar(d => ({ ...d, contas: [...d.contas, { ...conta, id: gerarId() }] }));
  }
  function editarConta(id, conta) {
    atualizar(d => ({ ...d, contas: d.contas.map(c => c.id === id ? { ...c, ...conta } : c) }));
  }
  function removerConta(id) {
    atualizar(d => ({ ...d, contas: d.contas.filter(c => c.id !== id) }));
  }

  // CARTÕES
  function adicionarCartao(cartao) {
    atualizar(d => ({ ...d, cartoes: [...d.cartoes, { ...cartao, id: gerarId() }] }));
  }
  function editarCartao(id, cartao) {
    atualizar(d => ({ ...d, cartoes: d.cartoes.map(c => c.id === id ? { ...c, ...cartao } : c) }));
  }
  function removerCartao(id) {
    atualizar(d => ({ ...d, cartoes: d.cartoes.filter(c => c.id !== id) }));
  }

  // LANÇAMENTOS
  function adicionarLancamento(lanc) {
    const id = lanc._id || gerarId();
    // eslint-disable-next-line no-unused-vars
    const { _id, ...resto } = lanc;
    atualizar(d => ({ ...d, lancamentos: [...d.lancamentos, { ...resto, id }] }));
  }
  // Adiciona várias parcelas de uma vez com IDs únicos garantidos
  function adicionarVariosLancamentos(lista) {
    const comIds = lista.map(l => ({ ...l, id: gerarId() }));
    atualizar(d => ({ ...d, lancamentos: [...d.lancamentos, ...comIds] }));
  }
  function editarLancamento(id, lanc) {
    atualizar(d => ({ ...d, lancamentos: d.lancamentos.map(l => l.id === id ? { ...l, ...lanc } : l) }));
  }
  function removerLancamento(id) {
    atualizar(d => ({ ...d, lancamentos: d.lancamentos.filter(l => l.id !== id) }));
  }
  // Remove este lançamento + todos os futuros do mesmo grupo (parcela >= atual)
  function removerParcelasDoGrupo(grupoId, parcelaAtual) {
    atualizar(d => ({
      ...d,
      lancamentos: d.lancamentos.filter(l =>
        !(l.grupoId === grupoId && l.parcela >= parcelaAtual)
      ),
    }));
  }
  function togglePago(id) {
    atualizar(d => ({
      ...d,
      lancamentos: d.lancamentos.map(l => l.id === id ? { ...l, pago: !l.pago } : l)
    }));
  }
  // Paga fatura: marca como paga e registra qual conta/valor (sem criar lançamento extra)
  function pagarFatura(cartaoId, mesAno, contaId, totalFatura) {
    atualizar(d => ({
      ...d,
      cartoes: d.cartoes.map(c => {
        if (c.id !== cartaoId) return c;
        const faturasPagas = c.faturasPagas || {};
        return { ...c, faturasPagas: { ...faturasPagas, [mesAno]: { pago: true, contaId, valor: totalFatura, data: hojeISO() } } };
      }),
    }));
  }

  // Desfaz pagamento de fatura
  function desfazerFatura(cartaoId, mesAno) {
    atualizar(d => ({
      ...d,
      cartoes: d.cartoes.map(c => {
        if (c.id !== cartaoId) return c;
        const faturasPagas = c.faturasPagas || {};
        return { ...c, faturasPagas: { ...faturasPagas, [mesAno]: { pago: false } } };
      }),
    }));
  }

  // Mantido para compatibilidade
  function toggleFaturaPaga(cartaoId, mesAno) {
    atualizar(d => ({
      ...d,
      cartoes: d.cartoes.map(c => {
        if (c.id !== cartaoId) return c;
        const faturasPagas = c.faturasPagas || {};
        const atual = faturasPagas[mesAno];
        const estaPago = typeof atual === 'object' ? atual?.pago : !!atual;
        return { ...c, faturasPagas: { ...faturasPagas, [mesAno]: { pago: !estaPago } } };
      }),
    }));
  }

  // Adiciona um mês como "exceção" no fixo (não mostrar naquele mês)
  function adicionarExcecaoFixo(id, mesAno) {
    atualizar(d => ({
      ...d,
      lancamentos: d.lancamentos.map(l => {
        if (l.id !== id) return l;
        const excecoes = l.excecoesMeses || [];
        return { ...l, excecoesMeses: [...excecoes, mesAno] };
      }),
    }));
  }

  // Para o fixo num mês específico (não mostrar a partir desse mês)
  function pararFixoNoMes(id, dataParar) {
    atualizar(d => ({
      ...d,
      lancamentos: d.lancamentos.map(l =>
        l.id === id ? { ...l, fixoFimData: dataParar } : l
      ),
    }));
  }

  // Ao "Alterar todos os próximos": limpa exceções e remove entradas individuais vinculadas
  function limparExcecoesFixo(id) {
    atualizar(d => ({
      ...d,
      lancamentos: d.lancamentos
        .filter(l => l._excecaoDeId !== id)      // remove entradas individuais de exceção
        .map(l => l.id === id
          ? { ...l, excecoesMeses: [] }           // limpa lista de exceções do fixo
          : l
        ),
    }));
  }

  // Para lançamentos FIXOS: pago é independente por mês (ex: "2026-06").
  // No mês de criação o status fica no próprio `pago` do lançamento;
  // nos demais meses, em `pagoPorMes`.
  function setPagoFixo(id, mesAno, valor) {
    atualizar(d => ({
      ...d,
      lancamentos: d.lancamentos.map(l => {
        if (l.id !== id) return l;
        const pagoPorMes = { ...(l.pagoPorMes || {}) };
        if (mesAno === chaveDaData(l.data)) {
          delete pagoPorMes[mesAno];
          return { ...l, pago: valor, pagoPorMes };
        }
        return { ...l, pagoPorMes: { ...pagoPorMes, [mesAno]: valor } };
      })
    }));
  }

  // Exclui um fixo inteiro (todas as ocorrências) e as edições avulsas ligadas a ele
  function removerFixo(id) {
    atualizar(d => ({
      ...d,
      lancamentos: d.lancamentos.filter(l => l.id !== id && l._excecaoDeId !== id),
    }));
  }

  // Troca TODOS os dados (importação do Organizze / restauração de backup)
  // Vale como "nova geração": nos outros aparelhos substitui tudo em vez de juntar.
  function substituirDados(novos) {
    mutacoes.current++;
    ls.set(CHAVE_PENDENTE, '1');
    setDados(novaGeracao(aplicarMigracoes({
      contas: novos.contas || [],
      cartoes: novos.cartoes || [],
      lancamentos: novos.lancamentos || [],
      categorias: novos.categorias?.length ? novos.categorias : dadosIniciais.categorias,
    })));
    agendarEnvio();
  }

  // CATEGORIAS
  function adicionarCategoria(cat) {
    atualizar(d => ({ ...d, categorias: [...d.categorias, { ...cat, id: gerarId() }] }));
  }

  // Saldo realizado de cada conta — regra única em utils/financas.js
  // (fixos pagos mês a mês, transferências origem→destino, faturas pagas)
  const { porConta: contasComSaldo, saldoGeral } = calcularSaldos(dados);
  // Soma dos saldos iniciais (sem transações)
  const saldoInicialTotal = dados.contas.reduce((acc, c) => acc + (c.saldo || 0), 0);

  return (
    <AppContext.Provider value={{
      ...dados,
      dados,
      contas: contasComSaldo,
      saldoGeral,
      adicionarConta, editarConta, removerConta,
      adicionarCartao, editarCartao, removerCartao,
      saldoInicialTotal,
      driveStatus, ultimaSync, precisaLogin, conectarDrive, desconectarDrive, sincronizarDrive,
      adicionarExcecaoFixo, limparExcecoesFixo, pararFixoNoMes, removerFixo, setPagoFixo,
      adicionarLancamento, adicionarVariosLancamentos, editarLancamento, removerLancamento, removerParcelasDoGrupo, togglePago, toggleFaturaPaga, pagarFatura, desfazerFatura,
      adicionarCategoria, substituirDados,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  return useContext(AppContext);
}
