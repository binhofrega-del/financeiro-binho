import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { initGoogleDrive, saveToDrive, loadFromDrive, signIn, signOut, isSignedIn } from '../services/googleDrive';
import { gerarId, faturaDaCompra, calcularSaldos, chaveDaData, hojeISO } from '../utils/financas';

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
  const lancamentos = dados.lancamentos.map(l => ({
    ...l,
    cartaoId: l.cartaoId || null,
    contaId: l.contaId || null,
  }));
  return { ...dados, lancamentos: migrarFaturaParcelados(lancamentos, dados.cartoes || []) };
}

function carregarDados() {
  try {
    const salvo = localStorage.getItem('financeiro-app-dados');
    if (salvo) return aplicarMigracoes(JSON.parse(salvo));
  } catch { /* localStorage indisponível ou corrompido → usa dados iniciais */ }
  return dadosIniciais;
}

export function AppProvider({ children }) {
  const [dados, setDados] = useState(carregarDados);
  const [driveStatus, setDriveStatus] = useState('iniciando'); // iniciando = verifica token salvo
  const [autenticado, setAutenticado] = useState(!!localStorage.getItem('fin_binho_token')); // iniciando | desconectado | sincronizando | salvando | conectado | erro
  const saveTimer = useRef(null);
  const salvandoLocal = useRef(false);

  // Salva no localStorage SEMPRE + Drive imediatamente (sem debounce longo)
  useEffect(() => {
    localStorage.setItem('financeiro-app-dados', JSON.stringify(dados));
    if (isSignedIn()) {
      salvandoLocal.current = true;
      clearTimeout(saveTimer.current);
      // Salva rápido: 800ms (garante que exclusões chegam ao Drive antes de abrir outro dispositivo)
      saveTimer.current = setTimeout(async () => {
        await saveToDrive(dados);
        salvandoLocal.current = false;
      }, 800);
    }
  }, [dados]);

  // Inicializa Google Drive — carrega dados só na abertura inicial
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        await initGoogleDrive(
          (status) => {
            setDriveStatus(status);
            // Se falhou ao tentar restaurar sessão → força re-login
            if (status === 'desconectado' || status === 'erro') {
              setAutenticado(false);
            }
          },
          (dadosDrive) => {
            if (!dadosDrive || salvandoLocal.current) return;
            setDados(aplicarMigracoes(dadosDrive));
          }
        );
      } catch {
        setDriveStatus('desconectado');
        setAutenticado(false);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);
  // Removido: sync automático ao focar (causava sumir lançamentos recentes)

  function conectarDrive() {
    setDriveStatus('sincronizando');
    setAutenticado(true);
    signIn();
  }

  function desconectarDrive() {
    signOut();
    setAutenticado(false);
    setDriveStatus('desconectado');
  }

  async function sincronizarDrive() {
    setDriveStatus('sincronizando');
    try {
      const dadosDrive = await loadFromDrive();
      if (dadosDrive) { setDados(aplicarMigracoes(dadosDrive)); setDriveStatus('conectado'); }
    } catch { setDriveStatus('erro'); }
  }

  // CONTAS
  function adicionarConta(conta) {
    setDados(d => ({ ...d, contas: [...d.contas, { ...conta, id: gerarId() }] }));
  }
  function editarConta(id, conta) {
    setDados(d => ({ ...d, contas: d.contas.map(c => c.id === id ? { ...c, ...conta } : c) }));
  }
  function removerConta(id) {
    setDados(d => ({ ...d, contas: d.contas.filter(c => c.id !== id) }));
  }

  // CARTÕES
  function adicionarCartao(cartao) {
    setDados(d => ({ ...d, cartoes: [...d.cartoes, { ...cartao, id: gerarId() }] }));
  }
  function editarCartao(id, cartao) {
    setDados(d => ({ ...d, cartoes: d.cartoes.map(c => c.id === id ? { ...c, ...cartao } : c) }));
  }
  function removerCartao(id) {
    setDados(d => ({ ...d, cartoes: d.cartoes.filter(c => c.id !== id) }));
  }

  // LANÇAMENTOS
  function adicionarLancamento(lanc) {
    const id = lanc._id || gerarId();
    // eslint-disable-next-line no-unused-vars
    const { _id, ...resto } = lanc;
    setDados(d => ({ ...d, lancamentos: [...d.lancamentos, { ...resto, id }] }));
  }
  // Adiciona várias parcelas de uma vez com IDs únicos garantidos
  function adicionarVariosLancamentos(lista) {
    const comIds = lista.map(l => ({ ...l, id: gerarId() }));
    setDados(d => ({ ...d, lancamentos: [...d.lancamentos, ...comIds] }));
  }
  function editarLancamento(id, lanc) {
    setDados(d => ({ ...d, lancamentos: d.lancamentos.map(l => l.id === id ? { ...l, ...lanc } : l) }));
  }
  function removerLancamento(id) {
    setDados(d => ({ ...d, lancamentos: d.lancamentos.filter(l => l.id !== id) }));
  }
  // Remove este lançamento + todos os futuros do mesmo grupo (parcela >= atual)
  function removerParcelasDoGrupo(grupoId, parcelaAtual) {
    setDados(d => ({
      ...d,
      lancamentos: d.lancamentos.filter(l =>
        !(l.grupoId === grupoId && l.parcela >= parcelaAtual)
      ),
    }));
  }
  function togglePago(id) {
    setDados(d => ({
      ...d,
      lancamentos: d.lancamentos.map(l => l.id === id ? { ...l, pago: !l.pago } : l)
    }));
  }
  // Paga fatura: marca como paga e registra qual conta/valor (sem criar lançamento extra)
  function pagarFatura(cartaoId, mesAno, contaId, totalFatura) {
    setDados(d => ({
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
    setDados(d => ({
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
    setDados(d => ({
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
    setDados(d => ({
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
    setDados(d => ({
      ...d,
      lancamentos: d.lancamentos.map(l =>
        l.id === id ? { ...l, fixoFimData: dataParar } : l
      ),
    }));
  }

  // Ao "Alterar todos os próximos": limpa exceções e remove entradas individuais vinculadas
  function limparExcecoesFixo(id) {
    setDados(d => ({
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
    setDados(d => ({
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
    setDados(d => ({
      ...d,
      lancamentos: d.lancamentos.filter(l => l.id !== id && l._excecaoDeId !== id),
    }));
  }

  // Troca TODOS os dados (importação do Organizze / restauração de backup)
  function substituirDados(novos) {
    setDados(aplicarMigracoes({
      contas: novos.contas || [],
      cartoes: novos.cartoes || [],
      lancamentos: novos.lancamentos || [],
      categorias: novos.categorias?.length ? novos.categorias : dadosIniciais.categorias,
    }));
  }

  // CATEGORIAS
  function adicionarCategoria(cat) {
    setDados(d => ({ ...d, categorias: [...d.categorias, { ...cat, id: gerarId() }] }));
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
      driveStatus, autenticado, conectarDrive, desconectarDrive, sincronizarDrive,
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
