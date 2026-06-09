import { useState, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, Check, Repeat, Layers, MoreVertical } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatarMoeda, nomeMes, emojisCategoria } from '../utils/formatters';
import ModalLancamento from '../components/ModalLancamento';
import DetalheModal from '../components/DetalheModal';
import FiltroModal from '../components/FiltroModal';
import ModalPagarFatura from '../components/ModalPagarFatura';
import IconeBanco from '../components/IconeBanco';
import ModalEditarFixo from '../components/ModalEditarFixo';

const filtroInicial = { tipos: [], situacao: [], contaIds: [], cartaoIds: [], categorias: [], periodo: 'mes', busca: '' };

function toStr(d) { return d.toISOString().slice(0,10); }
function addDias(d, n) { const r=new Date(d); r.setDate(r.getDate()+n); return r; }

// Calcula início/fim baseado no modo de período e data de referência
function calcularIntervalo(modo, dataRef) {
  const d = new Date(dataRef+'T00:00:00');
  let inicio, fim;
  if (modo === 'dia') {
    inicio = new Date(d); inicio.setHours(0,0,0,0);
    fim = new Date(d); fim.setHours(23,59,59,999);
  } else if (modo === 'semana') {
    // Semana: segunda a domingo
    const diaSemana = d.getDay(); // 0=dom,1=seg,...
    const diffSeg = diaSemana === 0 ? -6 : 1 - diaSemana;
    inicio = addDias(d, diffSeg); inicio.setHours(0,0,0,0);
    fim = addDias(inicio, 6); fim.setHours(23,59,59,999);
  } else if (modo === 'mes') {
    inicio = new Date(d.getFullYear(), d.getMonth(), 1);
    fim = new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59);
  } else if (modo === 'personalizado') {
    // dataRef = 'inicio|fim'
    const [ini, f] = dataRef.split('|');
    inicio = new Date(ini+'T00:00:00');
    fim = new Date(f+'T23:59:59');
  }
  return { inicio, fim };
}

function tituloPeriodo(modo, dataRef) {
  if (modo === 'dia') {
    const d = new Date(dataRef+'T00:00:00');
    const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    return `${dias[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  if (modo === 'semana') {
    const { inicio, fim } = calcularIntervalo('semana', dataRef);
    return `${String(inicio.getDate()).padStart(2,'0')}/${String(inicio.getMonth()+1).padStart(2,'0')} – ${String(fim.getDate()).padStart(2,'0')}/${String(fim.getMonth()+1).padStart(2,'0')}`;
  }
  if (modo === 'mes') {
    const d = new Date(dataRef+'T00:00:00');
    return `${nomeMes(d.getMonth())} ${d.getFullYear()}`;
  }
  if (modo === 'personalizado') {
    const [ini, f] = dataRef.split('|');
    return `${ini.slice(8,10)}/${ini.slice(5,7)} – ${f.slice(8,10)}/${f.slice(5,7)}`;
  }
  return '';
}

function navegar(modo, dataRef, dir) {
  const d = new Date(dataRef+'T00:00:00');
  if (modo === 'dia') return toStr(addDias(d, dir));
  if (modo === 'semana') return toStr(addDias(d, dir*7));
  if (modo === 'mes') {
    d.setMonth(d.getMonth() + dir);
    return toStr(new Date(d.getFullYear(), d.getMonth(), 1));
  }
  return dataRef;
}

export default function FluxoScreen({ filtroInicial: filtroVindoDaHome }) {
  const { lancamentos, cartoes, saldoGeral, saldoInicialTotal, togglePago, togglePagoFixo, toggleFaturaPaga, removerLancamento } = useApp();
  const hoje = toStr(new Date());
  const [modo, setModo] = useState('mes');           // dia | semana | mes | personalizado
  const [dataRef, setDataRef] = useState(toStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [periodoDropdown, setPeriodoDropdown] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customIni, setCustomIni] = useState('');
  const [customFim, setCustomFim] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [faturaParaPagar, setFaturaParaPagar] = useState(null);
  const [confirmarEditarFixo, setConfirmarEditarFixo] = useState(null);
  const [filtros, setFiltros] = useState(filtroVindoDaHome ? { ...filtroInicial, ...filtroVindoDaHome } : filtroInicial);

  const temFiltroAtivo = filtros.tipos.length > 0 || filtros.situacao.length > 0 ||
    filtros.contaIds.length > 0 || filtros.cartaoIds.length > 0 ||
    filtros.categorias.length > 0 || filtros.busca;

  // Para modo personalizado, dataRef é 'ini|fim' — usa só a data inicial
  const dataRefBase = modo === 'personalizado' ? dataRef.split('|')[0] : dataRef;
  const mesAtual = new Date(dataRefBase+'T00:00:00').getMonth();
  const anoAtual = new Date(dataRefBase+'T00:00:00').getFullYear();

  const { adicionarLancamento, adicionarExcecaoFixo } = useApp();

  function abrirEditar(lanc) {
    setDetalhe(null);
    // Se for fixo, pergunta antes de editar
    if (lanc.fixo && !lanc._copia) {
      setConfirmarEditarFixo(lanc);
    } else {
      setEditando(lanc);
      setModalAberto(true);
    }
  }
  function fecharModal() { setModalAberto(false); setEditando(null); }

  const lancFiltrados = useMemo(() => {
    const { inicio, fim } = calcularIntervalo(modo, dataRef);
    const mesAno = `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}`;
    let lista = lancamentos
      .filter(l => !l.cartaoId && l.cartaoId !== 0)
      .map(l => {
        const d = new Date(l.data+'T00:00:00');
        // Lançamento normal no período
        if (d >= inicio && d <= fim) return l;

        // Fixo: só aparece fora do período em modo MÊS ou SEMANA
        // Em modo DIA: só aparece se o dia do mês coincidir com o dia visualizado
        if (l.fixo && d <= fim) {
          // Pula meses de exceção (alterados individualmente)
          if ((l.excecoesMeses||[]).includes(mesAno)) return null;
          const diaOriginal = parseInt(l.data.slice(8,10));
          if (modo === 'dia') {
            const diaRef = inicio.getDate();
            // Só mostra se o dia do fixo bate com o dia visualizado E o mês/ano é posterior à criação
            if (diaOriginal !== diaRef) return null;
            const dataNoMes = `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}-${String(diaOriginal).padStart(2,'0')}`;
            const pagoMes = (l.pagoPorMes||{})[mesAno] ?? false;
            return { ...l, data: dataNoMes, pago: pagoMes, _fixoMesAno: mesAno };
          }
          if (modo === 'semana') {
            // Mostra se o dia do fixo cai dentro da semana visualizada
            const dataNoMes = new Date(anoAtual, mesAtual, diaOriginal);
            if (dataNoMes < inicio || dataNoMes > fim) return null;
            const pagoMes = (l.pagoPorMes||{})[mesAno] ?? false;
            return { ...l, data: `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}-${String(diaOriginal).padStart(2,'0')}`, pago: pagoMes, _fixoMesAno: mesAno };
          }
          if (modo === 'personalizado') {
            // Personalizado: só mostra se o dia do fixo cai dentro do range escolhido
            const dataNoRange = new Date(anoAtual, mesAtual, diaOriginal);
            if (dataNoRange < inicio || dataNoRange > fim) return null;
            const pagoMes = (l.pagoPorMes||{})[mesAno] ?? false;
            return { ...l, data: `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}-${String(diaOriginal).padStart(2,'0')}`, pago: pagoMes, _fixoMesAno: mesAno };
          }
          // Modo mês: comportamento original (aparece no mês inteiro)
          const pagoMes = (l.pagoPorMes||{})[mesAno] ?? false;
          const dataNoMes = `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}-${String(diaOriginal).padStart(2,'0')}`;
          return { ...l, data: dataNoMes, pago: pagoMes, _fixoMesAno: mesAno };
        }
        return null;
      }).filter(Boolean);

    if (filtros.busca) { const b = filtros.busca.toLowerCase(); lista = lista.filter(l => l.descricao.toLowerCase().includes(b)); }
    if (filtros.tipos.length > 0) lista = lista.filter(l => {
      if (filtros.tipos.includes('Receitas') && l.tipo==='receita') return true;
      if (filtros.tipos.includes('Despesas') && l.tipo==='despesa') return true;
      if (filtros.tipos.includes('Transferências') && l.tipo==='transferencia') return true;
      if (filtros.tipos.includes('Lançamentos fixos') && l.fixo) return true;
      if (filtros.tipos.includes('Lançamentos parcelados') && l.parcelado) return true;
      return false;
    });
    if (filtros.situacao.length > 0) lista = lista.filter(l => {
      if (filtros.situacao.includes('Resolvido') && l.pago) return true;
      if (filtros.situacao.includes('Pendente') && !l.pago) return true;
      return false;
    });
    if (filtros.contaIds.length > 0) lista = lista.filter(l => filtros.contaIds.includes(l.contaId));
    if (filtros.cartaoIds.length > 0) lista = lista.filter(l => filtros.cartaoIds.includes(l.cartaoId));
    if (filtros.categorias.length > 0) lista = lista.filter(l => filtros.categorias.includes(l.categoria));
    return lista.sort((a,b) => a.data.localeCompare(b.data));
  }, [lancamentos, modo, dataRef, filtros]);

  const faturasMes = useMemo(() => {
    // A fatura que VENCE neste mês é a do mês ANTERIOR (fechou no mês passado, vence agora)
    const mesFatura = mesAtual === 0 ? 11 : mesAtual - 1;
    const anoFatura = mesAtual === 0 ? anoAtual - 1 : anoAtual;
    const mesAnoFatura = `${anoFatura}-${String(mesFatura+1).padStart(2,'0')}`;
    // Chave de pagamento usa o mês do VENCIMENTO (mês atual)
    const mesAnoVenc = `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}`;
    const inicioFatura = new Date(anoFatura,mesFatura,1);
    const fimFatura = new Date(anoFatura,mesFatura+1,0,23,59,59);

    return cartoes.map(cartao => {
      const totalFatura = lancamentos.filter(l => {
        if (l.cartaoId !== cartao.id || l.tipo !== 'despesa') return false;
        // Novo: usa faturaMes/faturaAno
        if (l.faturaMes != null) return l.faturaMes === mesFatura && l.faturaAno === anoFatura;
        // Legado: usa data do lançamento
        const d = new Date(l.data+'T00:00:00');
        return (d >= inicioFatura && d <= fimFatura) || (l.fixo && d <= fimFatura);
      }).reduce((acc,l) => acc + Math.abs(l.valor), 0);

      if (totalFatura === 0) return null;

      // Data da fatura = dia do vencimento no mês ATUAL (quando o dinheiro sai)
      const diaVenc = String(cartao.diaVencimento).padStart(2,'0');
      const dataFatura = `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}-${diaVenc}`;
      const fp = (cartao.faturasPagas||{})[mesAnoVenc];
      const estaPago = typeof fp==='object' ? fp?.pago : !!fp;
      const contaIdPagamento = typeof fp==='object' ? fp?.contaId : null;

      return {
        id: `fatura-${cartao.id}-${mesAnoVenc}`,
        descricao: `Fatura ${nomeMes(mesFatura)} ${anoFatura}`,
        valor: -totalFatura, data: dataFatura,
        tipo: 'despesa', categoria: 'Fatura Cartão',
        cartaoId: cartao.id, contaId: null,
        pago: estaPago, _isFatura: true,
        _cartaoNome: cartao.nome, _cartaoBanco: cartao.banco, _cartaoCor: cartao.cor,
        _mesAno: mesAnoVenc, _contaIdPagamento: contaIdPagamento,
      };
    }).filter(Boolean);
  }, [cartoes, lancamentos, mesAtual, anoAtual]);

  // Faturas só entram nos totais quando NÃO há busca por texto
  const incluirFaturas = !filtros.busca;
  const entradasReais = lancFiltrados.filter(l => l.tipo==='receita' && l.pago).reduce((a,l) => a+l.valor, 0);
  const saidasContaReais = lancFiltrados.filter(l => l.tipo==='despesa' && l.pago).reduce((a,l) => a+Math.abs(l.valor), 0);
  const saidasFaturaReais = incluirFaturas ? faturasMes.filter(f => f.pago).reduce((a,f) => a+Math.abs(f.valor), 0) : 0;
  const saidasReais = saidasContaReais + saidasFaturaReais;
  const entradasPrev = lancFiltrados.filter(l => l.tipo==='receita').reduce((a,l) => a+l.valor, 0);
  const saidasContaPrev = lancFiltrados.filter(l => l.tipo==='despesa').reduce((a,l) => a+Math.abs(l.valor), 0);
  const saidasFaturaPrev = incluirFaturas ? faturasMes.reduce((a,f) => a+Math.abs(f.valor), 0) : 0;
  const saidasPrev = saidasContaPrev + saidasFaturaPrev;
  const entradas = entradasPrev; const saidas = saidasPrev; const saldo = entradasPrev - saidasPrev;
  const saldoRealCumulativo = useMemo(() => {
    let s = saldoGeral;
    cartoes.forEach(cartao => { const fp = cartao.faturasPagas||{}; Object.entries(fp).forEach(([mesAno,f]) => { const pago = typeof f==='object'?f?.pago:!!f; if (!pago) return; const [a,m] = mesAno.split('-').map(Number); const iniM=new Date(a,m-1,1); const fimM=new Date(a,m,0,23,59,59); const total = lancamentos.filter(l => { if(l.cartaoId!==cartao.id||l.tipo!=='despesa') return false; const d=new Date(l.data+'T00:00:00'); return (d>=iniM&&d<=fimM)||(l.fixo&&d<=fimM); }).reduce((acc,l) => acc+Math.abs(l.valor),0); s-=total; }); });
    return s;
  }, [saldoGeral, cartoes, lancamentos]);
  const saldoPrevCumulativo = useMemo(() => {
    // Sempre usa o mês atual real para o acumulado (independente do modo de visualização)
    const hoje = new Date();
    const anoBase = hoje.getFullYear();
    const mesBase = hoje.getMonth();
    const fim = new Date(anoBase, mesBase+1, 0, 23, 59, 59);
    const transacoes = lancamentos.reduce((acc,l) => {
      try {
        const d = new Date(l.data+'T00:00:00');
        if (!d || isNaN(d.getTime()) || d > fim) return acc;
        const v = l.tipo==='receita' ? Math.abs(l.valor||0) : -Math.abs(l.valor||0);
        if (l.fixo) {
          const mp = (anoBase - d.getFullYear())*12 + (mesBase - d.getMonth()) + 1;
          return acc + v * Math.max(mp, 1);
        }
        return acc + v;
      } catch { return acc; }
    }, 0);
    return (saldoInicialTotal||0) + transacoes;
  }, [lancamentos, mesAtual, anoAtual, saldoInicialTotal]);

  const porDia = useMemo(() => {
    // Faturas só aparecem quando NÃO há busca por texto ativa
    const faturas = filtros.busca ? [] : faturasMes;
    const grupos = {};
    [...lancFiltrados, ...faturas].forEach(l => { if(!grupos[l.data]) grupos[l.data]=[]; grupos[l.data].push(l); });
    return Object.entries(grupos).sort(([a],[b]) => a.localeCompare(b));
  }, [lancFiltrados, faturasMes, filtros.busca]);

  function formatarDiaHeader(dataStr) {
    try {
      const [ano,mes,dia] = dataStr.split('-');
      const anoN = parseInt(ano), mesN = parseInt(mes), diaN = parseInt(dia);
      if (!anoN || !mesN || !diaN) return dataStr;
      const d = new Date(anoN, mesN-1, diaN);
      if (isNaN(d.getTime())) return dataStr;
      const dias=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
      return `${diaN} de ${nomeMes(mesN-1)} · ${dias[d.getDay()]}`;
    } catch { return dataStr; }
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#f3f4f6', overflow:'hidden' }}>
      <div style={{ background:'#16a34a', padding:'16px 20px 12px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h2 style={{ color:'white', fontSize:20, fontWeight:700 }}>Fluxo de Caixa</h2>
          <button onClick={() => setFiltroAberto(true)} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:10, padding:'6px 8px', cursor:'pointer', color:'white', display:'flex', alignItems:'center', position:'relative' }}>
            <MoreVertical size={20} />
            {temFiltroAtivo && <span style={{ position:'absolute', top:4, right:4, width:8, height:8, background:'#fbbf24', borderRadius:'50%' }} />}
          </button>
        </div>
        {/* Seletor de período */}
        <div style={{ position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.15)', borderRadius:12, padding:'6px 10px' }}>
              <button onClick={() => setDataRef(navegar(modo, dataRef, -1))} style={navBtn}><ChevronLeft size={20}/></button>
              <button onClick={() => setPeriodoDropdown(v=>!v)}
                style={{ background:'none', border:'none', color:'white', fontWeight:700, fontSize:15, cursor:'pointer', padding:'2px 8px' }}>
                {tituloPeriodo(modo, dataRef)} ▾
              </button>
              <button onClick={() => setDataRef(navegar(modo, dataRef, 1))} style={navBtn}><ChevronRight size={20}/></button>
            </div>
            {dataRef !== toStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) || modo !== 'mes' ? (
              <button onClick={() => { setModo('mes'); setDataRef(toStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1))); }}
                style={{ background:'white', color:'#16a34a', border:'none', borderRadius:10, padding:'6px 10px', fontWeight:700, fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}>Hoje</button>
            ) : null}
          </div>

          {/* Dropdown */}
          {periodoDropdown && (
            <>
              <div onClick={() => setPeriodoDropdown(false)} style={{ position:'fixed', inset:0, zIndex:19 }} />
              <div style={{ position:'absolute', top:'110%', left:0, right:0, background:'white', borderRadius:14, boxShadow:'0 8px 24px rgba(0,0,0,0.15)', zIndex:20, overflow:'hidden' }}>
                {[
                  { label:'Hoje', fn: () => { setModo('dia'); setDataRef(hoje); }},
                  { label:'Esta semana', fn: () => { setModo('semana'); setDataRef(hoje); }},
                  { label:'Este mês', fn: () => { setModo('mes'); setDataRef(toStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1))); }},
                  { label:'Escolher período', fn: () => setShowCustom(true) },
                ].map((op, i, arr) => (
                  <button key={op.label} onClick={() => { op.fn(); setPeriodoDropdown(false); }}
                    style={{ width:'100%', border:'none', background:'none', padding:'14px 18px', textAlign:'center', fontSize:15, fontWeight:600, color:'#111', cursor:'pointer', borderBottom: i<arr.length-1?'1px solid #f3f4f6':'none' }}>
                    {op.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Seletor de período personalizado */}
          {showCustom && (
            <>
              <div onClick={() => setShowCustom(false)} style={{ position:'fixed', inset:0, zIndex:19 }} />
              <div style={{ position:'absolute', top:'110%', left:0, right:0, background:'white', borderRadius:14, boxShadow:'0 8px 24px rgba(0,0,0,0.15)', zIndex:20, padding:16 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
                  <input type="date" value={customIni} onChange={e=>setCustomIni(e.target.value)}
                    style={{ border:'1.5px solid #e5e7eb', borderRadius:10, padding:'10px 12px', fontSize:15, outline:'none' }} />
                  <input type="date" value={customFim} onChange={e=>setCustomFim(e.target.value)}
                    style={{ border:'1.5px solid #e5e7eb', borderRadius:10, padding:'10px 12px', fontSize:15, outline:'none' }} />
                </div>
                <button onClick={() => { if(customIni&&customFim){ setModo('personalizado'); setDataRef(`${customIni}|${customFim}`); setShowCustom(false); } }}
                  style={{ width:'100%', background:'#16a34a', color:'white', border:'none', borderRadius:10, padding:12, fontWeight:700, fontSize:15, cursor:'pointer', marginBottom:8 }}>Ok</button>
                <button onClick={() => setShowCustom(false)}
                  style={{ width:'100%', background:'none', border:'none', color:'#16a34a', fontWeight:600, fontSize:14, cursor:'pointer' }}>voltar</button>
              </div>
            </>
          )}
        </div>
      </div>

      {temFiltroAtivo && (
        <div style={{ background:'#fef3c7', padding:'8px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:12, color:'#d97706', fontWeight:600 }}>🔍 Filtro ativo — {lancFiltrados.length} resultado(s)</span>
          <button onClick={() => setFiltros(filtroInicial)} style={{ background:'none', border:'none', color:'#d97706', fontWeight:700, fontSize:12, cursor:'pointer' }}>Limpar</button>
        </div>
      )}

      <div style={{ display:'flex', gap:8, padding:'12px 14px 8px' }}>
        <ResumoBox label="Entradas" valor={entradas} cor="#16a34a" />
        <ResumoBox label="Saídas" valor={saidas} cor="#dc2626" prefixo="-" />
        <ResumoBox label="Saldo" valor={saldo} cor={saldo>=0?'#1d4ed8':'#dc2626'} />
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'0 14px 80px' }}>
        {porDia.length===0 && (
          <div style={{ textAlign:'center', padding:60, color:'#aaa' }}>
            <p style={{ fontSize:40 }}>📭</p>
            <p style={{ fontSize:16, fontWeight:600, marginTop:12 }}>Nenhum lançamento</p>
            <p style={{ fontSize:13, marginTop:4 }}>Toque no + para adicionar</p>
          </div>
        )}
        {porDia.map(([data,items]) => (
          <div key={data}>
            <div style={{ fontSize:12, fontWeight:700, color:'#888', padding:'14px 0 6px', textTransform:'uppercase', letterSpacing:0.5 }}>
              {formatarDiaHeader(data)}
            </div>
            {items.map(l => (
              <CardLancamento key={l.id} lanc={l} onClick={() => l._isFatura ? setFaturaParaPagar(l) : setDetalhe(l)} />
            ))}
          </div>
        ))}
      </div>

      {/* Demonstrativo: quando filtro ativo mostra totais do filtro, senão mostra real/previsto */}
      {temFiltroAtivo ? (
        <div style={{ background:'white', borderTop:'1px solid #e5e7eb', padding:'12px 16px 10px' }}>
          <p style={{ fontSize:12, fontWeight:700, color:'#888', textAlign:'center', marginBottom:10, textTransform:'uppercase', letterSpacing:0.5 }}>
            Filtro total
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, color:'#666' }}>Total receitas</span>
              <span style={{ fontSize:14, fontWeight:700, color:'#16a34a' }}>+{formatarMoeda(entradasPrev)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, color:'#666' }}>Total despesas</span>
              <span style={{ fontSize:14, fontWeight:700, color:'#dc2626' }}>-{formatarMoeda(saidasPrev)}</span>
            </div>
            <div style={{ height:1, background:'#f3f4f6', margin:'2px 0' }} />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#111' }}>Total</span>
              <span style={{ fontSize:15, fontWeight:800, color: (entradasPrev-saidasPrev)>=0?'#1d4ed8':'#dc2626' }}>
                {formatarMoeda(entradasPrev - saidasPrev)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background:'white', borderTop:'1px solid #e5e7eb', padding:'10px 14px 6px' }}>
          <div style={{ display:'flex', marginBottom:6 }}>
            <DemoCol valor={entradasReais} label="entradas" cor="#16a34a" sinal="+" />
            <DemoCol valor={saidasReais} label="saídas" cor="#dc2626" sinal="-" />
            <DemoCol valor={saldoRealCumulativo} label="saldo" cor={saldoRealCumulativo>=0?'#1d4ed8':'#dc2626'} />
          </div>
          <div style={{ height:1, background:'#f3f4f6', marginBottom:6 }} />
          <div style={{ display:'flex' }}>
            <DemoCol valor={entradasPrev} label="previsto" cor="#16a34a" pequeno />
            <DemoCol valor={saidasPrev} label="previsto" cor="#dc2626" sinal="-" pequeno />
            <DemoCol valor={saldoPrevCumulativo} label="previsto acum." cor={saldoPrevCumulativo>=0?'#1d4ed8':'#dc2626'} sinal={saldoPrevCumulativo<0?'-':''} pequeno />
          </div>
        </div>
      )}

      <button onClick={() => setModalAberto(true)} style={fab}><Plus size={28} color="white" /></button>

      {modalAberto && <ModalLancamento editando={editando} onFechar={fecharModal} />}
      {detalhe && <DetalheModal lanc={detalhe} onFechar={() => setDetalhe(null)} onEditar={abrirEditar} onTogglePago={() => {
        if (detalhe._fixoMesAno) togglePagoFixo(detalhe.id, detalhe._fixoMesAno);
        else togglePago(detalhe.id);
        setDetalhe(null);
      }} />}
      {filtroAberto && <FiltroModal filtros={filtros} onAplicar={setFiltros} onFechar={() => setFiltroAberto(false)} />}
      {faturaParaPagar && <ModalPagarFatura fatura={faturaParaPagar} onFechar={() => setFaturaParaPagar(null)} />}

      {confirmarEditarFixo && (
        <ModalEditarFixo
          lanc={confirmarEditarFixo}
          onCancelar={() => setConfirmarEditarFixo(null)}
          onSoEste={() => {
            // Marca este mês como exceção no original (não mostrar mais este mês via fixo)
            const mesAno = confirmarEditarFixo._fixoMesAno ||
              `${anoAtual}-${String(mesAtual+1).padStart(2,'0')}`;
            adicionarExcecaoFixo(confirmarEditarFixo.id, mesAno);
            // Abre modal para editar — vai criar entrada única (sem id = nova, sem fixo)
            const { id, fixo, pagoPorMes, excecoesMeses, _fixoMesAno, ...resto } = confirmarEditarFixo;
            setConfirmarEditarFixo(null);
            setEditando({ ...resto, fixo: false, _copia: true, data: confirmarEditarFixo.data });
            setModalAberto(true);
          }}
          onTodosProximos={() => {
            // Edita o lançamento original (fixo)
            setConfirmarEditarFixo(null);
            setEditando(confirmarEditarFixo);
            setModalAberto(true);
          }}
        />
      )}
    </div>
  );
}

function ResumoBox({ label, valor, cor, prefixo='' }) {
  return (
    <div style={{ flex:1, background:'white', borderRadius:12, padding:'10px 8px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
      <p style={{ fontSize:10, color:'#888', fontWeight:600, textTransform:'uppercase' }}>{label}</p>
      <p style={{ fontSize:13, fontWeight:700, color:cor, marginTop:3 }}>{prefixo}{formatarMoeda(Math.abs(valor))}</p>
    </div>
  );
}

function DemoCol({ valor, label, cor, sinal='', pequeno=false }) {
  return (
    <div style={{ flex:1, textAlign:'center' }}>
      <p style={{ fontSize:pequeno?12:14, fontWeight:700, color:cor }}>{sinal}{formatarMoeda(Math.abs(valor))}</p>
      <p style={{ fontSize:10, color:'#aaa', fontWeight:500 }}>{label}</p>
    </div>
  );
}

function CardLancamento({ lanc, onClick }) {
  const { contas } = useApp();
  const isReceita = lanc.tipo==='receita';
  const isTransf = lanc.tipo==='transferencia';
  const cor = isReceita?'#16a34a':isTransf?'#1d4ed8':'#dc2626';
  const bgIcon = isReceita?'#dcfce7':isTransf?'#dbeafe':'#fee2e2';
  const emoji = emojisCategoria[lanc.categoria]||'📌';
  const conta = contas.find(c => c.id===lanc.contaId);

  if (lanc._isFatura) {
    const contaPagamento = lanc.pago && lanc._contaIdPagamento ? contas.find(c => c.id===lanc._contaIdPagamento) : null;
    return (
      <div onClick={onClick} style={{ background:'white', borderRadius:14, padding:'12px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:12, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', opacity:lanc.pago?0.6:1, cursor:'pointer', userSelect:'none', borderLeft:`4px solid ${lanc._cartaoCor||'#7c3aed'}` }}>
        <div style={{ width:42, height:42, borderRadius:'50%', background:'#ede9fe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>💳</div>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:14, fontWeight:700, color:'#111' }}>{lanc.descricao}</p>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
            <p style={{ fontSize:11, color:'#aaa' }}>{lanc._cartaoBanco} · {lanc._cartaoNome}</p>
            {contaPagamento && <><span style={{ fontSize:10, color:'#ddd' }}>→</span><div style={{ width:8, height:8, borderRadius:'50%', background:contaPagamento.cor }}/><p style={{ fontSize:11, color:'#aaa' }}>{contaPagamento.nome}</p></>}
          </div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <p style={{ fontSize:15, fontWeight:700, color:'#dc2626' }}>-{formatarMoeda(Math.abs(lanc.valor))}</p>
          <p style={{ fontSize:10, color:lanc.pago?'#16a34a':'#aaa', fontWeight:600, marginTop:2 }}>{lanc.pago?'✓ Pago':'não pago'}</p>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClick} style={{ background:'white', borderRadius:14, padding:'12px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:12, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', opacity:lanc.pago?0.6:1, cursor:'pointer', userSelect:'none' }}>
      <div style={{ width:42, height:42, borderRadius:'50%', background:bgIcon, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{emoji}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
          <p style={{ fontSize:14, fontWeight:600, color:'#111', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:160 }}>{lanc.descricao}</p>
          {lanc.fixo && <Badge label="Fixo" bg="#dbeafe" color="#1d4ed8" icon={<Repeat size={9}/>} />}
          {lanc.parcelado && <Badge label={`${lanc.parcela}/${lanc.totalParcelas}`} bg="#fef3c7" color="#d97706" icon={<Layers size={9}/>} />}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
          <p style={{ fontSize:11, color:'#aaa' }}>{lanc.categoria}</p>
          {conta && <><span style={{ fontSize:10, color:'#ddd' }}>•</span><div style={{ display:'flex', alignItems:'center', gap:4 }}><IconeBanco nome={conta.nome} icone={conta.icone} cor={conta.cor} size={16}/><p style={{ fontSize:11, color:'#aaa' }}>{conta.nome}</p></div></>}
        </div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <p style={{ fontSize:15, fontWeight:700, color:cor }}>{isReceita?'+':'-'}{formatarMoeda(Math.abs(lanc.valor))}</p>
        <p style={{ fontSize:10, color:lanc.pago?'#16a34a':'#aaa', fontWeight:600, marginTop:2 }}>
          {lanc.pago?(isReceita?'✓ Recebido':'✓ Pago'):(isReceita?'Não recebido':'Não pago')}
        </p>
      </div>
    </div>
  );
}

function Badge({ label, bg, color, icon }) {
  return <span style={{ background:bg, color, fontSize:9, padding:'2px 6px', borderRadius:20, fontWeight:700, display:'inline-flex', alignItems:'center', gap:2 }}>{icon}{label}</span>;
}

const navBtn = { background:'none', border:'none', color:'white', cursor:'pointer', display:'flex', alignItems:'center', padding:4 };
const fab = { position:'absolute', bottom:160, right:20, width:56, height:56, borderRadius:'50%', background:'#16a34a', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(22,163,74,0.45)', zIndex:10 };
