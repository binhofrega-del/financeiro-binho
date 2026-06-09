import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { initGoogleDrive, saveToDrive, loadFromDrive, signIn, signOut, isSignedIn } from '../services/googleDrive';

const AppContext = createContext();

const dadosIniciais = {
  contas: [
    { id: 1, nome: 'Santander', tipo: 'Conta corrente', cor: '#e11d48', icone: 'S', saldo: 607.68 },
    { id: 2, nome: 'C6 Bank', tipo: 'Conta corrente', cor: '#000000', icone: 'C6', saldo: 3.81 },
    { id: 3, nome: 'Caixa Econômica', tipo: 'Conta corrente', cor: '#f97316', icone: 'CX', saldo: 0.26 },
    { id: 4, nome: 'Mercado Pago', tipo: 'Conta digital', cor: '#22c55e', icone: 'MP', saldo: 0.53 },
    { id: 5, nome: 'Dinheiro', tipo: 'Carteira', cor: '#6b7280', icone: '$', saldo: 0.00 },
  ],
  cartoes: [
    {
      id: 1,
      nome: 'Nubank Roxinho',
      banco: 'Nubank',
      cor: '#7c3aed',
      limite: 5000,
      diaVencimento: 15,
      diaFechamento: 8,
    },
  ],
  lancamentos: [
    { id: 1, descricao: 'BLADE - TV', valor: -35.00, data: '2026-06-07', tipo: 'despesa', categoria: 'Assinatura', contaId: 1, fixo: true, parcelado: false, pago: false },
    { id: 2, descricao: 'Laura - Viagem Brasília - Mãe', valor: -100.00, data: '2026-06-08', tipo: 'despesa', categoria: 'Viagem', contaId: 1, fixo: false, parcelado: true, parcela: 1, totalParcelas: 6, pago: false },
    { id: 3, descricao: 'Nubank p/ Santander - Vivaz AP', valor: 789.26, data: '2026-06-08', tipo: 'receita', categoria: 'Aluguel', contaId: 1, fixo: true, parcelado: false, pago: false },
    { id: 4, descricao: 'Deise - Apto Freguesia - Vivaz', valor: 600.00, data: '2026-06-08', tipo: 'receita', categoria: 'Aluguel', contaId: 1, fixo: true, parcelado: false, pago: false },
    { id: 5, descricao: 'Apto Freguesia - Construtora Vivaz', valor: -1389.26, data: '2026-06-08', tipo: 'despesa', categoria: 'Imóvel', contaId: 1, fixo: false, parcelado: true, parcela: 3, totalParcelas: 36, pago: false },
    { id: 6, descricao: 'Conta de Luz - Enel', valor: -205.20, data: '2026-06-08', tipo: 'despesa', categoria: 'Utilidades', contaId: 1, fixo: true, parcelado: false, pago: false },
  ],
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

function carregarDados() {
  try {
    const salvo = localStorage.getItem('financeiro-app-dados');
    if (salvo) {
      const dados = JSON.parse(salvo);
      // Migração: limpa cartaoId vazio ('') para null
      dados.lancamentos = dados.lancamentos.map(l => ({
        ...l,
        cartaoId: l.cartaoId || null,
        contaId: l.contaId || null,
      }));
      return dados;
    }
  } catch {}
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
          (status) => setDriveStatus(status),
          (dadosDrive) => {
            // Drive é sempre a fonte da verdade ao carregar
            // Só ignora se estiver salvando alterações locais neste momento
            if (!dadosDrive || salvandoLocal.current) return;
            setDados(dadosDrive);
          }
        );
      } catch {
        setDriveStatus('desconectado');
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
      if (dadosDrive) { setDados(dadosDrive); setDriveStatus('conectado'); }
    } catch { setDriveStatus('erro'); }
  }

  // CONTAS
  function adicionarConta(conta) {
    setDados(d => ({ ...d, contas: [...d.contas, { ...conta, id: Date.now() }] }));
  }
  function editarConta(id, conta) {
    setDados(d => ({ ...d, contas: d.contas.map(c => c.id === id ? { ...c, ...conta } : c) }));
  }
  function removerConta(id) {
    setDados(d => ({ ...d, contas: d.contas.filter(c => c.id !== id) }));
  }

  // CARTÕES
  function adicionarCartao(cartao) {
    setDados(d => ({ ...d, cartoes: [...d.cartoes, { ...cartao, id: Date.now() }] }));
  }
  function editarCartao(id, cartao) {
    setDados(d => ({ ...d, cartoes: d.cartoes.map(c => c.id === id ? { ...c, ...cartao } : c) }));
  }
  function removerCartao(id) {
    setDados(d => ({ ...d, cartoes: d.cartoes.filter(c => c.id !== id) }));
  }

  // LANÇAMENTOS
  function adicionarLancamento(lanc) {
    const id = lanc._id || Date.now();
    const { _id, ...resto } = lanc;
    setDados(d => ({ ...d, lancamentos: [...d.lancamentos, { ...resto, id }] }));
  }
  // Adiciona várias parcelas de uma vez com IDs únicos garantidos
  function adicionarVariosLancamentos(lista) {
    const base = Date.now();
    setDados(d => ({
      ...d,
      lancamentos: [
        ...d.lancamentos,
        ...lista.map((l, i) => ({ ...l, id: base + i })),
      ],
    }));
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
        return { ...c, faturasPagas: { ...faturasPagas, [mesAno]: { pago: true, contaId, valor: totalFatura } } };
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

  // Para despesas FIXAS: pago é independente por mês (ex: "2026-06")
  function togglePagoFixo(id, mesAno) {
    setDados(d => ({
      ...d,
      lancamentos: d.lancamentos.map(l => {
        if (l.id !== id) return l;
        const pagoPorMes = l.pagoPorMes || {};
        const atual = pagoPorMes[mesAno] ?? false;
        return { ...l, pagoPorMes: { ...pagoPorMes, [mesAno]: !atual } };
      })
    }));
  }

  // CATEGORIAS
  function adicionarCategoria(cat) {
    setDados(d => ({ ...d, categorias: [...d.categorias, { ...cat, id: Date.now() }] }));
  }

  // Calcula saldo atual de cada conta = saldo inicial + lançamentos pagos da conta
  // Lançamentos de cartão NÃO afetam o saldo da conta (só quando paga a fatura)
  const contasComSaldo = dados.contas.map(conta => {
    // Soma transações pagas da conta
    const movimentos = dados.lancamentos
      .filter(l => l.contaId === conta.id && l.pago && !l.cartaoId)
      .reduce((acc, l) => acc + l.valor, 0);
    // Subtrai faturas de cartão pagas com esta conta
    const faturasPagas = dados.cartoes.reduce((acc, cartao) => {
      const fp = cartao.faturasPagas || {};
      return acc + Object.values(fp).reduce((s, f) => {
        const info = typeof f === 'object' ? f : { pago: f };
        if (info.pago && info.contaId === conta.id) return s + (info.valor || 0);
        return s;
      }, 0);
    }, 0);
    return { ...conta, saldoAtual: (conta.saldo || 0) + movimentos - faturasPagas };
  });

  const saldoGeral = contasComSaldo.reduce((acc, c) => acc + c.saldoAtual, 0);
  // Soma dos saldos iniciais (sem transações) — base para o previsto
  const saldoInicialTotal = dados.contas.reduce((acc, c) => acc + (c.saldo || 0), 0);

  return (
    <AppContext.Provider value={{
      ...dados,
      contas: contasComSaldo,
      saldoGeral,
      adicionarConta, editarConta, removerConta,
      adicionarCartao, editarCartao, removerCartao,
      saldoInicialTotal,
      driveStatus, autenticado, conectarDrive, desconectarDrive, sincronizarDrive,
      adicionarExcecaoFixo, limparExcecoesFixo, pararFixoNoMes,
      adicionarLancamento, adicionarVariosLancamentos, editarLancamento, removerLancamento, removerParcelasDoGrupo, togglePago, togglePagoFixo, toggleFaturaPaga, pagarFatura, desfazerFatura,
      adicionarCategoria,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
