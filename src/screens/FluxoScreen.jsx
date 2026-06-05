import { useState, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, Check, Repeat, Layers, MoreVertical } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatarMoeda, nomeMes, emojisCategoria } from '../utils/formatters';
import IconeBanco from '../components/IconeBanco';
import SwipeableCard from '../components/SwipeableCard';
import ModalLancamento from '../components/ModalLancamento';
import DetalheModal from '../components/DetalheModal';
import FiltroModal from '../components/FiltroModal';
import ModalPagarFatura from '../components/ModalPagarFatura';

const filtroInicial = { tipos: [], situacao: [], contaIds: [], cartaoIds: [], categorias: [], periodo: 'Mês atual', busca: '' };

function calcularIntervalo(filtros, mesAtual, anoAtual) {
  const { periodo, dataInicio, dataFim } = filtros;
  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);
  let inicio, fim;

  switch (periodo) {
    case 'Hoje':
      inicio = new Date(); inicio.setHours(0, 0, 0, 0);
      fim = hoje;
      break;
    case 'Este ano':
      inicio = new Date(hoje.getFullYear(), 0, 1);
      fim = new Date(hoje.getFullYear(), 11, 31, 23, 59, 59);
      break;
    case 'Últimos 7 dias':
      inicio = new Date(hoje); inicio.setDate(hoje.getDate() - 6); inicio.setHours(0,0,0,0);
      fim = hoje;
      break;
    case 'Últimos 15 dias':
      inicio = new Date(hoje); inicio.setDate(hoje.getDate() - 14); inicio.setHours(0,0,0,0);
      fim = hoje;
      break;
    case 'Últimos 30 dias':
      inicio = new Date(hoje); inicio.setDate(hoje.getDate() - 29); inicio.setHours(0,0,0,0);
      fim = hoje;
      break;
    case 'Período personalizado':
      if (dataInicio && dataFim) {
        inicio = new Date(dataInicio + 'T00:00:00');
        fim = new Date(dataFim + 'T23:59:59');
      } else {
        inicio = new Date(anoAtual, mesAtual, 1);
        fim = new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59);
      }
      break;
    default: // 'Mês atual'
      inicio = new Date(anoAtual, mesAtual, 1);
      fim = new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59);
  }
  return { inicio, fim };
}

export default function FluxoScreen({ filtroInicial: filtroVindoDaHome }) {
  const { lancamentos, cartoes, saldoGeral, saldoInicialTotal, togglePago, togglePagoFixo, toggleFaturaPaga, removerLancamento } = useApp();
  const [mesAtual, setMesAtual] = useState(new Date().getMonth());
  const [anoAtual, setAnoAtual] = useState(new Date().getFullYear());
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [faturaParaPagar, setFaturaParaPagar] = useState(null);
  const [filtros, setFiltros] = useState(
    filtroVindoDaHome ? { ...filtroInicial, ...filtroVindoDaHome } : filtroInicial
  );

  const temFiltroAtivo = filtros.tipos.length > 0 || filtros.situacao.length > 0 ||
    filtros.contaIds.length > 0 || filtros.cartaoIds.length > 0 ||
    filtros.categorias.length > 0 || filtros.busca || filtros.periodo !== 'Mês atual';

  // Título do período para exibir no header
  const tituloPeriodo = filtros.periodo === 'Período personalizado' && filtros.dataInicio && filtros.dataFim
    ? `${filtros.dataInicio.slice(8,10)}/${filtros.dataInicio.slice(5,7)} – ${filtros.dataFim.slice(8,10)}/${filtros.dataFim.slice(5,7)}`
    : filtros.periodo !== 'Mês atual'
      ? filtros.periodo
      : `${nomeMes(mesAtual)} ${anoAtual}`;

  function mudarMes(dir) {
    let m = mesAtual + dir;
    let a = anoAtual;
    if (m > 11) { m = 0; a++; }
    if (m < 0) { m = 11; a--; }
    setMesAtual(m);
    setAnoAtual(a);
  }

  function abrirEditar(lanc) {
    setDetalhe(null);
    setEditando(lanc);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditando(null);
  }

  // Filtrar lançamentos por período + filtros aplicados
  const lancFiltrados = useMemo(() => {
    const { inicio, fim } = calcularIntervalo(filtros, mesAtual, anoAtual);
    const mesAno = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`;

    let lista = lancamentos
      // Excluir lançamentos de CARTÃO do fluxo de caixa (aparecem só na fatura do cartão)
      .filter(l => !l.cartaoId && l.cartaoId !== 0)
      .map(l => {
        const d = new Date(l.data + 'T00:00:00');
        const noMes = d >= inicio && d <= fim;

        if (noMes) return l; // lançamento normal do mês

        // Fix 3: Despesa/receita FIXA de mês anterior → mostra com pago independente
        if (l.fixo && d <= fim) {
          const pagoMes = (l.pagoPorMes || {})[mesAno] ?? false;
          // Ajusta a data para o dia correto dentro do mês atual
          const diaOriginal = l.data.slice(8, 10);
          const dataNoMes = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${diaOriginal}`;
          return { ...l, data: dataNoMes, pago: pagoMes, _fixoMesAno: mesAno };
        }

        return null;
      })
      .filter(Boolean);

    if (filtros.busca) {
      const b = filtros.busca.toLowerCase();
      lista = lista.filter(l => l.descricao.toLowerCase().includes(b));
    }
    if (filtros.tipos.length > 0) {
      lista = lista.filter(l => {
        if (filtros.tipos.includes('Receitas') && l.tipo === 'receita') return true;
        if (filtros.tipos.includes('Despesas') && l.tipo === 'despesa') return true;
        if (filtros.tipos.includes('Transferências') && l.tipo === 'transferencia') return true;
        if (filtros.tipos.includes('Lançamentos fixos') && l.fixo) return true;
        if (filtros.tipos.includes('Lançamentos parcelados') && l.parcelado) return true;
        return false;
      });
    }
    if (filtros.situacao.length > 0) {
      lista = lista.filter(l => {
        if (filtros.situacao.includes('Resolvido') && l.pago) return true;
        if (filtros.situacao.includes('Pendente') && !l.pago) return true;
        return false;
      });
    }
    if (filtros.contaIds.length > 0) {
      lista = lista.filter(l => filtros.contaIds.includes(l.contaId));
    }
    if (filtros.cartaoIds.length > 0) {
      lista = lista.filter(l => filtros.cartaoIds.includes(l.cartaoId));
    }
    if (filtros.categorias.length > 0) {
      lista = lista.filter(l => filtros.categorias.includes(l.categoria));
    }

    return lista.sort((a, b) => a.data.localeCompare(b.data));
  }, [lancamentos, mesAtual, anoAtual, filtros]);

  // Gera lançamentos virtuais de FATURA para cada cartão com gastos no mês
  const faturasMes = useMemo(() => {
    const mesAno = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`;
    const inicioMes = new Date(anoAtual, mesAtual, 1);
    const fimMes = new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59);

    return cartoes
      .map(cartao => {
        // Soma todos os gastos do cartão no mês (incluindo fixos)
        const totalFatura = lancamentos
          .filter(l => {
            if (l.cartaoId !== cartao.id || l.tipo !== 'despesa') return false;
            const d = new Date(l.data + 'T00:00:00');
            if (d >= inicioMes && d <= fimMes) return true;
            if (l.fixo && d <= fimMes) return true;
            return false;
          })
          .reduce((acc, l) => acc + Math.abs(l.valor), 0);

        if (totalFatura === 0) return null;

        // Data da fatura = dia do vencimento no mês atual
        const diaVenc = String(cartao.diaVencimento).padStart(2, '0');
        const dataFatura = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${diaVenc}`;
        // Normaliza o status de pago (suporta boolean ou objeto {pago, contaId, valor})
        const fp = (cartao.faturasPagas || {})[mesAno];
        const estaPago = typeof fp === 'object' ? fp?.pago : !!fp;
        const contaIdPagamento = typeof fp === 'object' ? fp?.contaId : null;

        return {
          id: `fatura-${cartao.id}-${mesAno}`,
          descricao: `Fatura ${nomeMes(mesAtual)} ${anoAtual}`,
          valor: -totalFatura,
          data: dataFatura,
          tipo: 'despesa',
          categoria: 'Fatura Cartão',
          cartaoId: cartao.id,
          contaId: null,
          pago: estaPago,
          _isFatura: true,
          _cartaoNome: cartao.nome,
          _cartaoBanco: cartao.banco,
          _cartaoCor: cartao.cor,
          _mesAno: mesAno,
          _contaIdPagamento: contaIdPagamento,
        };
      })
      .filter(Boolean);
  }, [cartoes, lancamentos, mesAtual, anoAtual]);

  // Valores REAIS do mês: apenas lançamentos pagos/recebidos no mês atual
  const entradasReais = lancFiltrados.filter(l => l.tipo === 'receita' && l.pago).reduce((a, l) => a + l.valor, 0);
  const saidasContaReais = lancFiltrados.filter(l => l.tipo === 'despesa' && l.pago).reduce((a, l) => a + Math.abs(l.valor), 0);
  const saidasFaturaReais = faturasMes.filter(f => f.pago).reduce((a, f) => a + Math.abs(f.valor), 0);
  const saidasReais = saidasContaReais + saidasFaturaReais;

  // SALDO REAL CUMULATIVO = saldoGeral - faturas pagas (pagar fatura = dinheiro saindo da conta)
  const saldoRealCumulativo = useMemo(() => {
    let saldo = saldoGeral;
    cartoes.forEach(cartao => {
      const fatPagas = cartao.faturasPagas || {};
      Object.entries(fatPagas).forEach(([mesAno, pago]) => {
        if (!pago) return;
        const [a, m] = mesAno.split('-').map(Number);
        const iniM = new Date(a, m - 1, 1);
        const fimM = new Date(a, m, 0, 23, 59, 59);
        // Calcula o total da fatura daquele mês
        const totalFatura = lancamentos
          .filter(l => {
            if (l.cartaoId !== cartao.id || l.tipo !== 'despesa') return false;
            const d = new Date(l.data + 'T00:00:00');
            if (d >= iniM && d <= fimM) return true;
            if (l.fixo && d <= fimM) return true;
            return false;
          })
          .reduce((acc, l) => acc + Math.abs(l.valor), 0);
        saldo -= totalFatura;
      });
    });
    return saldo;
  }, [saldoGeral, cartoes, lancamentos]);

  // Valores PREVISTOS do mês (entradas/saídas são mensais)
  const entradasPrev = lancFiltrados.filter(l => l.tipo === 'receita').reduce((a, l) => a + l.valor, 0);
  const saidasContaPrev = lancFiltrados.filter(l => l.tipo === 'despesa').reduce((a, l) => a + Math.abs(l.valor), 0);
  // Faturas do mês entram nas saídas previstas
  const saidasFaturaPrev = faturasMes.reduce((a, f) => a + Math.abs(f.valor), 0);
  const saidasPrev = saidasContaPrev + saidasFaturaPrev;

  // SALDO PREVISTO CUMULATIVO: parte do saldo inicial das contas + TODOS os lançamentos até o mês atual
  const saldoPrevCumulativo = useMemo(() => {
    const fim = new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59);
    const transacoes = lancamentos.reduce((acc, l) => {
      const d = new Date(l.data + 'T00:00:00');
      if (d > fim) return acc;
      const valorLiq = l.tipo === 'receita' ? Math.abs(l.valor) : -Math.abs(l.valor);
      if (l.fixo) {
        const mesesPassados =
          (anoAtual - d.getFullYear()) * 12 + (mesAtual - d.getMonth()) + 1;
        return acc + valorLiq * Math.max(mesesPassados, 1);
      }
      return acc + valorLiq;
    }, 0);
    // Parte do saldo inicial + todas as transações previstas
    return saldoInicialTotal + transacoes;
  }, [lancamentos, mesAtual, anoAtual, saldoInicialTotal]);

  // Para o resumo topo
  const entradas = entradasPrev;
  const saidas = saidasPrev;
  const saldo = entradasPrev - saidasPrev;

  // Agrupar por dia (lançamentos normais + faturas virtuais)
  const porDia = useMemo(() => {
    const grupos = {};
    [...lancFiltrados, ...faturasMes].forEach(l => {
      if (!grupos[l.data]) grupos[l.data] = [];
      grupos[l.data].push(l);
    });
    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
  }, [lancFiltrados, faturasMes]);

  function formatarDiaHeader(dataStr) {
    const [ano, mes, dia] = dataStr.split('-');
    const d = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    const dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    return `${parseInt(dia)} de ${nomeMes(parseInt(mes) - 1)} · ${dias[d.getDay()]}`;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f3f4f6', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: '#16a34a', padding: '16px 20px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>Fluxo de Caixa</h2>
          <button onClick={() => setFiltroAberto(true)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <MoreVertical size={20} />
            {temFiltroAtivo && <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, background: '#fbbf24', borderRadius: '50%' }} />}
          </button>
        </div>

        {/* Seletor de mês / período */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '6px 10px' }}>
            {filtros.periodo === 'Mês atual' || filtros.periodo === 'Período personalizado'
              ? <button onClick={() => mudarMes(-1)} style={navBtn}><ChevronLeft size={20} /></button>
              : <div style={{ width: 28 }} />
            }
            <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{tituloPeriodo}</span>
            {filtros.periodo === 'Mês atual' || filtros.periodo === 'Período personalizado'
              ? <button onClick={() => mudarMes(1)} style={navBtn}><ChevronRight size={20} /></button>
              : <div style={{ width: 28 }} />
            }
          </div>
          {/* Botão voltar ao mês atual */}
          {(mesAtual !== new Date().getMonth() || anoAtual !== new Date().getFullYear() || filtros.periodo !== 'Mês atual') && (
            <button
              onClick={() => {
                setMesAtual(new Date().getMonth());
                setAnoAtual(new Date().getFullYear());
                setFiltros(f => ({ ...f, periodo: 'Mês atual' }));
              }}
              style={{ background: 'white', color: '#16a34a', border: 'none', borderRadius: 10, padding: '6px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Hoje
            </button>
          )}
        </div>
      </div>

      {/* Filtro ativo banner */}
      {temFiltroAtivo && (
        <div style={{ background: '#fef3c7', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>🔍 Filtro ativo — {lancFiltrados.length} resultado(s)</span>
          <button onClick={() => setFiltros(filtroInicial)} style={{ background: 'none', border: 'none', color: '#d97706', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Limpar</button>
        </div>
      )}

      {/* Resumo */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 14px 8px', background: '#f3f4f6' }}>
        <ResumoBox label="Entradas" valor={entradas} cor="#16a34a" />
        <ResumoBox label="Saídas" valor={saidas} cor="#dc2626" prefixo="-" />
        <ResumoBox label="Saldo" valor={saldo} cor={saldo >= 0 ? '#1d4ed8' : '#dc2626'} />
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 80px' }}>
        {porDia.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
            <p style={{ fontSize: 40 }}>📭</p>
            <p style={{ fontSize: 16, fontWeight: 600, marginTop: 12 }}>Nenhum lançamento</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Toque no + para adicionar</p>
          </div>
        )}
        {porDia.map(([data, items]) => (
          <div key={data}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#888', padding: '14px 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {formatarDiaHeader(data)}
            </div>
            {items.map(l => {
              const acoesFatura = [
                { icone: l.pago ? '👎' : '👍', label: l.pago ? 'Desfazer' : 'Pago', cor: l.pago ? '#6b7280' : '#16a34a', onClick: () => setFaturaParaPagar(l) },
              ];
              const acoesLanc = [
                { icone: '👍', label: l.pago ? 'Desfazer' : 'Pago', cor: l.pago ? '#6b7280' : '#16a34a', onClick: () => { if (l._fixoMesAno) togglePagoFixo(l.id, l._fixoMesAno); else togglePago(l.id); } },
                { icone: '✏️', label: 'Editar', cor: '#374151', onClick: () => abrirEditar(l) },
                { icone: '🗑️', label: 'Excluir', cor: '#dc2626', onClick: () => { if (window.confirm('Excluir lançamento?')) { if (l.parcelado && l.grupoId) setDetalhe(l); else removerLancamento(l.id); } } },
              ];
              return (
                <SwipeableCard key={l.id} acoes={l._isFatura ? acoesFatura : acoesLanc}>
                  <CardLancamento lanc={l} onClick={() => l._isFatura ? setFaturaParaPagar(l) : setDetalhe(l)} />
                </SwipeableCard>
              );
            })}
          </div>
        ))}
      </div>

      {/* Demonstrativo fixo no rodapé */}
      <div style={{ background: 'white', borderTop: '1px solid #e5e7eb', padding: '10px 14px 6px' }}>
        {/* Linha real */}
        <div style={{ display: 'flex', marginBottom: 6 }}>
          <DemoCol valor={entradasReais} label="entradas" cor="#16a34a" sinal="+" />
          <DemoCol valor={saidasReais} label="saídas" cor="#dc2626" sinal="-" />
          <DemoCol valor={saldoRealCumulativo} label="saldo" cor={saldoRealCumulativo >= 0 ? '#1d4ed8' : '#dc2626'} />
        </div>
        {/* Divisor */}
        <div style={{ height: 1, background: '#f3f4f6', marginBottom: 6 }} />
        {/* Linha previsto */}
        <div style={{ display: 'flex' }}>
          <DemoCol valor={entradasPrev} label="previsto" cor="#16a34a" pequeno />
          <DemoCol valor={saidasPrev} label="previsto" cor="#dc2626" sinal="-" pequeno />
          <DemoCol valor={saldoPrevCumulativo} label="previsto acum." cor={saldoPrevCumulativo >= 0 ? '#1d4ed8' : '#dc2626'} sinal={saldoPrevCumulativo < 0 ? '-' : ''} pequeno />
        </div>
      </div>

      {/* FAB */}
      <button onClick={() => setModalAberto(true)} style={fab}>
        <Plus size={28} color="white" />
      </button>

      {/* Modais */}
      {modalAberto && <ModalLancamento editando={editando} onFechar={fecharModal} />}
      {detalhe && <DetalheModal lanc={detalhe} onFechar={() => setDetalhe(null)} onEditar={abrirEditar} onTogglePago={() => {
        if (detalhe._isFatura) toggleFaturaPaga(detalhe.cartaoId, detalhe._mesAno);
        else if (detalhe._fixoMesAno) togglePagoFixo(detalhe.id, detalhe._fixoMesAno);
        else togglePago(detalhe.id);
        setDetalhe(null);
      }} />}
      {filtroAberto && <FiltroModal filtros={filtros} onAplicar={setFiltros} onFechar={() => setFiltroAberto(false)} />}
      {faturaParaPagar && <ModalPagarFatura fatura={faturaParaPagar} onFechar={() => setFaturaParaPagar(null)} />}
    </div>
  );
}

function ResumoBox({ label, valor, cor, prefixo = '' }) {
  return (
    <div style={{ flex: 1, background: 'white', borderRadius: 12, padding: '10px 8px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <p style={{ fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 700, color: cor, marginTop: 3 }}>
        {prefixo}{formatarMoeda(Math.abs(valor))}
      </p>
    </div>
  );
}

function DemoCol({ valor, label, cor, sinal = '', pequeno = false }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <p style={{ fontSize: pequeno ? 12 : 14, fontWeight: 700, color: cor }}>
        {sinal}{formatarMoeda(Math.abs(valor))}
      </p>
      <p style={{ fontSize: 10, color: '#aaa', fontWeight: 500 }}>{label}</p>
    </div>
  );
}

function CardLancamento({ lanc, onClick }) {
  const { contas } = useApp();
  const isReceita = lanc.tipo === 'receita';
  const isTransf = lanc.tipo === 'transferencia';
  const cor = isReceita ? '#16a34a' : isTransf ? '#1d4ed8' : '#dc2626';
  const bgIcon = isReceita ? '#dcfce7' : isTransf ? '#dbeafe' : '#fee2e2';
  const emoji = emojisCategoria[lanc.categoria] || '📌';
  const conta = contas.find(c => c.id === lanc.contaId);

  // Card especial para FATURA do cartão
  if (lanc._isFatura) {
    const contaPagamento = lanc.pago && lanc._contaIdPagamento
      ? contas.find(c => c.id === lanc._contaIdPagamento)
      : null;

    return (
      <div onClick={onClick} style={{ background: 'white', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: lanc.pago ? 0.6 : 1, cursor: 'pointer', userSelect: 'none', borderLeft: `4px solid ${lanc._cartaoCor || '#7c3aed'}` }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          💳
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{lanc.descricao}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <p style={{ fontSize: 11, color: '#aaa' }}>{lanc._cartaoBanco} · {lanc._cartaoNome}</p>
            {contaPagamento && (
              <>
                <span style={{ fontSize: 10, color: '#ddd' }}>→</span>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: contaPagamento.cor, flexShrink: 0 }} />
                <p style={{ fontSize: 11, color: '#aaa' }}>{contaPagamento.nome}</p>
              </>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#dc2626' }}>
            -{formatarMoeda(Math.abs(lanc.valor))}
          </p>
          <p style={{ fontSize: 10, color: lanc.pago ? '#16a34a' : '#aaa', fontWeight: 600, marginTop: 2 }}>
            {lanc.pago ? '✓ Pago' : 'não pago'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClick} style={{ background: 'white', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: lanc.pago ? 0.6 : 1, cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ width: 42, height: 42, borderRadius: '50%', background: bgIcon, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{lanc.descricao}</p>
          {lanc.fixo && <Badge label="Fixo" bg="#dbeafe" color="#1d4ed8" icon={<Repeat size={9} />} />}
          {lanc.parcelado && <Badge label={`${lanc.parcela}/${lanc.totalParcelas}`} bg="#fef3c7" color="#d97706" icon={<Layers size={9} />} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <p style={{ fontSize: 11, color: '#aaa' }}>{lanc.categoria}</p>
          {conta && <>
            <span style={{ fontSize: 10, color: '#ddd' }}>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconeBanco nome={conta.nome} icone={conta.icone} cor={conta.cor} size={16} />
              <p style={{ fontSize: 11, color: '#aaa' }}>{conta.nome}</p>
            </div>
          </>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: cor }}>
          {isReceita ? '+' : '-'}{formatarMoeda(Math.abs(lanc.valor))}
        </p>
        <p style={{ fontSize: 10, color: lanc.pago ? '#16a34a' : '#aaa', fontWeight: 600, marginTop: 2 }}>
          {lanc.pago ? (isReceita ? '✓ Recebido' : '✓ Pago') : (isReceita ? 'Não recebido' : 'Não pago')}
        </p>
      </div>
    </div>
  );
}

function Badge({ label, bg, color, icon }) {
  return (
    <span style={{ background: bg, color, fontSize: 9, padding: '2px 6px', borderRadius: 20, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {icon}{label}
    </span>
  );
}

const navBtn = { background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 };
const fab = { position: 'absolute', bottom: 160, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#16a34a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(22,163,74,0.45)', zIndex: 10 };
