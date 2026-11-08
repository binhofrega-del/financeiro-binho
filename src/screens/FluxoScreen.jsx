import { useState, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, MoreVertical, Printer, Search, SlidersHorizontal, CalendarDays, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatarMoeda, nomeMes } from '../utils/formatters';
import IconeCategoria from '../components/IconeCategoria';
import DetalheModal from '../components/DetalheModal';
import FiltroModal from '../components/FiltroModal';
import ModalPagarFatura from '../components/ModalPagarFatura';
import IconeBanco from '../components/IconeBanco';
import { useAcoesLancamento } from '../hooks/useAcoesLancamento';
import {
  hojeISO, parseISO, addDias, intervaloDoPeriodo, mesAnoDaData, inicioDoMes, somarMeses,
  lancamentosContaNoPeriodo, faturasNoPeriodo, totaisDe, calcularSaldos, saldoPrevisto,
} from '../utils/financas';

const filtroInicial = { tipos: [], situacao: [], contaIds: [], cartaoIds: [], categorias: [], periodo: 'mes', busca: '' };

function primeiroDoMesAtual() { return inicioDoMes(mesAnoDaData(hojeISO())); }
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const escapar = (t) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function tituloPeriodo(modo, dataRef) {
  if (modo === 'dia') {
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return `${dias[parseISO(dataRef).getDay()]}, ${ddmm(dataRef)}`;
  }
  if (modo === 'mes') {
    const { ano, mes } = mesAnoDaData(dataRef);
    return `${nomeMes(mes)} ${ano}`;
  }
  const { inicio, fim } = intervaloDoPeriodo(modo, dataRef);
  return `${ddmm(inicio)} – ${ddmm(fim)}`;
}

function navegar(modo, dataRef, dir) {
  if (modo === 'dia') return addDias(dataRef, dir);
  if (modo === 'semana') return addDias(dataRef, dir * 7);
  if (modo === 'mes') return inicioDoMes(somarMeses(mesAnoDaData(dataRef), dir));
  return dataRef;
}

export default function FluxoScreen({ filtroInicial: filtroVindoDaHome }) {
  const { dados, lancamentos, cartoes, contas } = useApp();
  const hoje = hojeISO();
  const [modo, setModo] = useState('mes');           // dia | semana | mes | personalizado
  const [dataRef, setDataRef] = useState(primeiroDoMesAtual());
  const [periodoDropdown, setPeriodoDropdown] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customIni, setCustomIni] = useState('');
  const [customFim, setCustomFim] = useState('');
  const [detalhe, setDetalhe] = useState(null);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [faturaParaPagar, setFaturaParaPagar] = useState(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [buscando, setBuscando] = useState(!!filtroVindoDaHome?.busca);
  const [rodapeAberto, setRodapeAberto] = useState(() => { try { return localStorage.getItem('fin_rodape_previsto') === '1'; } catch { return false; } });
  function alternarRodape() {
    setRodapeAberto(v => { try { localStorage.setItem('fin_rodape_previsto', v ? '0' : '1'); } catch { /* sem armazenamento */ } return !v; });
  }
  const [filtros, setFiltros] = useState(filtroVindoDaHome ? { ...filtroInicial, ...filtroVindoDaHome } : filtroInicial);
  const acoes = useAcoesLancamento();

  const temFiltroAtivo = filtros.tipos.length > 0 || filtros.situacao.length > 0 ||
    filtros.contaIds.length > 0 || filtros.cartaoIds.length > 0 ||
    filtros.categorias.length > 0 || filtros.busca;

  const { inicio, fim } = useMemo(() => intervaloDoPeriodo(modo, dataRef), [modo, dataRef]);

  // Lançamentos de conta no período (fixos expandidos) — regra em utils/financas.js
  const lancFiltrados = useMemo(() => {
    let lista = lancamentosContaNoPeriodo(lancamentos, inicio, fim);
    if (filtros.busca) { const b = filtros.busca.toLowerCase(); lista = lista.filter(l => (l.descricao || '').toLowerCase().includes(b)); }
    if (filtros.tipos.length > 0) lista = lista.filter(l => {
      if (filtros.tipos.includes('Receitas') && l.tipo === 'receita') return true;
      if (filtros.tipos.includes('Despesas') && l.tipo === 'despesa') return true;
      if (filtros.tipos.includes('Transferências') && l.tipo === 'transferencia') return true;
      if (filtros.tipos.includes('Lançamentos fixos') && l.fixo) return true;
      if (filtros.tipos.includes('Lançamentos parcelados') && l.parcelado) return true;
      return false;
    });
    if (filtros.situacao.length > 0) lista = lista.filter(l => {
      if (filtros.situacao.includes('Resolvido') && l.pago) return true;
      if (filtros.situacao.includes('Pendente') && !l.pago) return true;
      return false;
    });
    // Transferência aparece tanto na conta de origem quanto na de destino
    if (filtros.contaIds.length > 0) lista = lista.filter(l => filtros.contaIds.includes(l.contaId) || filtros.contaIds.includes(l.contaDestinoId));
    if (filtros.cartaoIds.length > 0) lista = lista.filter(l => filtros.cartaoIds.includes(l.cartaoId));
    if (filtros.categorias.length > 0) lista = lista.filter(l => filtros.categorias.includes(l.categoria));
    return lista;
  }, [lancamentos, inicio, fim, filtros]);

  // Faturas que VENCEM no período (respeitam os mesmos filtros)
  const faturasFiltradas = useMemo(() => {
    if (filtros.busca) return [];
    let lista = faturasNoPeriodo(cartoes, lancamentos, inicio, fim);
    if (filtros.tipos.length > 0 && !filtros.tipos.includes('Despesas')) return [];
    if (filtros.situacao.length > 0) lista = lista.filter(f =>
      (filtros.situacao.includes('Resolvido') && f.pago) || (filtros.situacao.includes('Pendente') && !f.pago));
    if (filtros.contaIds.length > 0) lista = lista.filter(f => filtros.contaIds.includes(f._contaIdPagamento));
    if (filtros.cartaoIds.length > 0) lista = lista.filter(f => filtros.cartaoIds.includes(f.cartaoId));
    if (filtros.categorias.length > 0 && !filtros.categorias.includes('Fatura Cartão')) return [];
    return lista;
  }, [cartoes, lancamentos, inicio, fim, filtros]);

  const { entradasPrev, saidasPrev, entradasReais, saidasReais } = totaisDe(lancFiltrados, faturasFiltradas);
  // Saldo realizado (só o que foi pago) e previsto (tudo) ao FINAL do período exibido
  const saldoRealCumulativo = useMemo(() => calcularSaldos(dados, { ate: fim }).saldoGeral, [dados, fim]);
  const saldoPrevCumulativo = useMemo(() => saldoPrevisto(dados, fim), [dados, fim]);

  const porDia = useMemo(() => {
    const grupos = {};
    [...lancFiltrados, ...faturasFiltradas].forEach(l => { if (!grupos[l.data]) grupos[l.data] = []; grupos[l.data].push(l); });
    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
  }, [lancFiltrados, faturasFiltradas]);

  const nomeConta = (id) => contas.find(c => String(c.id) === String(id))?.nome || '';

  function imprimir() {
    const itens = porDia.flatMap(([, items]) => items);
    const linhas = itens.map(l => {
      const [ano, mes, dia] = l.data.split('-');
      const tipo = l.tipo === 'receita' ? 'Receita' : l.tipo === 'transferencia' ? 'Transf.' : 'Despesa';
      const sinal = l.tipo === 'receita' ? '+' : l.tipo === 'transferencia' ? '' : '-';
      const valor = sinal + 'R$ ' + Math.abs(l.valor).toFixed(2).replace('.', ',');
      const situacao = l.tipo === 'transferencia' ? (l.pago ? 'Transferido' : 'Pendente')
        : l.pago ? (l.tipo === 'receita' ? 'Recebido' : 'Pago') : (l.tipo === 'receita' ? 'Não recebido' : 'Não pago');
      const conta = l._cartaoBanco ? `${l._cartaoBanco} (cartão)`
        : l.tipo === 'transferencia' ? `${nomeConta(l.contaId)} → ${nomeConta(l.contaDestinoId)}`
        : nomeConta(l.contaId);
      const cor = l.tipo === 'receita' ? '#16a34a' : l.tipo === 'transferencia' ? '#1d4ed8' : '#dc2626';
      return `<tr>
        <td>${tipo}</td>
        <td>${dia}/${mes}/${ano}</td>
        <td>${escapar(l.descricao)}</td>
        <td>${escapar(conta)}</td>
        <td>${escapar(l.categoria)}</td>
        <td style="text-align:right;color:${cor}">${valor}</td>
        <td>${situacao}</td>
      </tr>`;
    }).join('');

    const total = entradasPrev - saidasPrev;
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
    <title>Movimentações</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:20px}
      h2{text-align:center;font-size:20px;margin-bottom:4px}
      .periodo{text-align:center;color:#888;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      th{background:#16a34a;color:white;padding:8px 6px;text-align:left;font-size:11px}
      td{padding:6px;border-bottom:1px solid #eee;font-size:11px}
      .totais{border-top:2px solid #111;padding-top:10px;text-align:right}
      .totais div{margin-bottom:4px}
      @media print{body{margin:10px}}
    </style></head><body>
    <h2>Movimentações</h2>
    <p class="periodo">Período: ${tituloPeriodo(modo, dataRef)}</p>
    <table>
      <thead><tr>
        <th>Tipo</th><th>Data</th><th>Descrição</th>
        <th>Conta/Cartão</th><th>Categoria</th><th>Valor</th><th>Situação</th>
      </tr></thead>
      <tbody>${linhas}</tbody>
    </table>
    <div class="totais">
      <div>Total receitas: <strong style="color:#16a34a">+R$ ${entradasPrev.toFixed(2).replace('.', ',')}</strong></div>
      <div>Total despesas: <strong style="color:#dc2626">-R$ ${saidasPrev.toFixed(2).replace('.', ',')}</strong></div>
      <div style="font-size:14px;margin-top:6px">Total: <strong style="color:${total >= 0 ? '#1d4ed8' : '#dc2626'}">R$ ${total.toFixed(2).replace('.', ',')}</strong></div>
    </div>
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  }

  // "Hoje" ou "8 de novembro", como no Organizze
  function formatarDiaHeader(dataStr) {
    if (dataStr === hoje) return 'Hoje';
    const [, mes, dia] = dataStr.split('-').map(Number);
    if (!mes || !dia) return dataStr;
    return `${dia} de ${nomeMes(mes - 1).toLowerCase()}`;
  }

  // Rótulos do carrossel de períodos
  const anoAtual = mesAnoDaData(hoje).ano;
  function rotuloCarrossel(ref, vizinho = false) {
    if (modo !== 'mes') return tituloPeriodo(modo, ref);
    const { ano, mes } = mesAnoDaData(ref);
    return ano === anoAtual || vizinho ? nomeMes(mes) : `${nomeMes(mes)} ${ano}`;
  }
  const podeNavegar = modo !== 'personalizado';
  const refAnterior = podeNavegar ? navegar(modo, dataRef, -1) : null;
  const refProxima = podeNavegar ? navegar(modo, dataRef, 1) : null;

  const corSaldoReal = saldoRealCumulativo < 0 ? '#c81e3a' : '#2b5fd9';
  const corSaldoPrev = saldoPrevCumulativo < 0 ? '#c81e3a' : '#2b5fd9';

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', background:FUNDO, overflow:'hidden', position:'relative' }}>
      {/* Topo verde */}
      <div style={{ background:VERDE_TOPO, height:60, flexShrink:0, display:'flex', alignItems:'center', gap:4, padding:'0 6px 0 10px' }}>
        {buscando ? (
          <>
            <button aria-label="Fechar busca" onClick={() => { setBuscando(false); setFiltros(f => ({ ...f, busca: '' })); }} style={iconeTopo}><X size={24} /></button>
            <input autoFocus value={filtros.busca} placeholder="Buscar lançamento"
              onChange={e => setFiltros(f => ({ ...f, busca: e.target.value }))}
              style={{ flex:1, minWidth:0, background:'rgba(255,255,255,0.18)', border:'none', borderRadius:10, padding:'9px 12px', color:'white', fontSize:16, outline:'none' }} />
          </>
        ) : (
          <>
            <button aria-label="Filtrar" onClick={() => setFiltroAberto(true)} style={{ ...iconeTopo, position:'relative' }}>
              <SlidersHorizontal size={23} />
              {temFiltroAtivo && <span style={{ position:'absolute', top:9, right:8, width:9, height:9, background:'#fbbf24', borderRadius:'50%', border:`2px solid ${VERDE_TOPO}` }} />}
            </button>
            <h2 style={{ flex:1, margin:0, color:'white', fontSize:19, fontWeight:600 }}>Fluxo de caixa</h2>
            <button aria-label="Buscar" onClick={() => setBuscando(true)} style={iconeTopo}><Search size={24} /></button>
          </>
        )}
        <div style={{ position:'relative' }}>
          <button aria-label="Mais opções" onClick={() => setMenuAberto(v=>!v)} style={iconeTopo}><MoreVertical size={23} /></button>
          {menuAberto && (
            <>
              <div onClick={() => setMenuAberto(false)} style={{ position:'fixed', inset:0, zIndex:19 }} />
              <div style={{ position:'absolute', top:'100%', right:4, background:'white', borderRadius:14, boxShadow:'0 8px 24px rgba(0,0,0,0.15)', zIndex:20, overflow:'hidden', minWidth:190 }}>
                <ItemMenu onClick={() => { setMenuAberto(false); setFiltroAberto(true); }} icone={<SlidersHorizontal size={16} />} texto="Filtrar" />
                <ItemMenu onClick={() => { setMenuAberto(false); setPeriodoDropdown(true); }} icone={<CalendarDays size={16} />} texto="Escolher período" />
                <ItemMenu onClick={() => { setMenuAberto(false); imprimir(); }} icone={<Printer size={16} />} texto="Imprimir" ultimo />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Carrossel de períodos */}
      <div style={{ position:'relative', flexShrink:0, height:68, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 4px', borderBottom:`1px solid ${LINHA}` }}>
        <button aria-label="Período anterior" disabled={!podeNavegar} onClick={() => setDataRef(refAnterior)} style={{ ...setaCarrossel, opacity: podeNavegar ? 1 : 0.25 }}><ChevronLeft size={22} /></button>
        <button disabled={!podeNavegar} onClick={() => setDataRef(refAnterior)} style={vizinhoCarrossel}>{refAnterior ? rotuloCarrossel(refAnterior, true) : ''}</button>
        <button onClick={() => setPeriodoDropdown(v => !v)}
          style={{ flexShrink:0, minWidth:124, maxWidth:170, height:48, padding:'0 16px', borderRadius:24, background:'#f1f0ea', border:'1px solid #dddcd4', fontSize:16, fontWeight:600, color:TEXTO, cursor:'pointer', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {rotuloCarrossel(dataRef)}
        </button>
        <button disabled={!podeNavegar} onClick={() => setDataRef(refProxima)} style={vizinhoCarrossel}>{refProxima ? rotuloCarrossel(refProxima, true) : ''}</button>
        <button aria-label="Próximo período" disabled={!podeNavegar} onClick={() => setDataRef(refProxima)} style={{ ...setaCarrossel, opacity: podeNavegar ? 1 : 0.25 }}><ChevronRight size={22} /></button>

        {periodoDropdown && (
          <>
            <div onClick={() => setPeriodoDropdown(false)} style={{ position:'fixed', inset:0, zIndex:19 }} />
            <div style={{ position:'absolute', top:'92%', left:'50%', transform:'translateX(-50%)', width:240, background:'white', borderRadius:14, boxShadow:'0 8px 24px rgba(0,0,0,0.15)', zIndex:20, overflow:'hidden' }}>
              {[
                { label:'Hoje', fn: () => { setModo('dia'); setDataRef(hoje); }},
                { label:'Esta semana', fn: () => { setModo('semana'); setDataRef(hoje); }},
                { label:'Este mês', fn: () => { setModo('mes'); setDataRef(primeiroDoMesAtual()); }},
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
        {showCustom && (
          <>
            <div onClick={() => setShowCustom(false)} style={{ position:'fixed', inset:0, zIndex:19 }} />
            <div style={{ position:'absolute', top:'92%', left:16, right:16, background:'white', borderRadius:14, boxShadow:'0 8px 24px rgba(0,0,0,0.15)', zIndex:20, padding:16 }}>
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

      {temFiltroAtivo && (
        <div style={{ background:'#fef3c7', padding:'8px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <span style={{ fontSize:13, color:'#b45309', fontWeight:600 }}>Filtro ativo · {lancFiltrados.length + faturasFiltradas.length} resultado(s)</span>
          <button onClick={() => { setFiltros(filtroInicial); setBuscando(false); }} style={{ background:'none', border:'none', color:'#b45309', fontWeight:700, fontSize:13, cursor:'pointer' }}>Limpar</button>
        </div>
      )}

      {/* Lista */}
      <div style={{ flex:1, overflowY:'auto', paddingBottom:56 }}>
        {porDia.length===0 && (
          <div style={{ textAlign:'center', padding:'60px 24px', color:'#9a9a92' }}>
            <p style={{ fontSize:16, fontWeight:600 }}>Nenhum lançamento</p>
            <p style={{ fontSize:14, marginTop:6 }}>Toque no + para adicionar</p>
          </div>
        )}
        {porDia.map(([data,items]) => (
          <div key={data}>
            <div style={{ padding:'16px 20px 6px', fontSize:15, fontWeight: data===hoje ? 700 : 500, color: data===hoje ? TEXTO : CINZA }}>
              {formatarDiaHeader(data)}
            </div>
            {items.map(l => (
              <LinhaLancamento key={`${l.id}-${l._fixoMesAno || ''}`} lanc={l} hoje={hoje}
                onClick={() => l._isFatura ? setFaturaParaPagar(l) : setDetalhe(l)} />
            ))}
          </div>
        ))}
      </div>

      {/* Rodapé de totais + botão + */}
      <div style={{ position:'relative', flexShrink:0, background:FUNDO, boxShadow:'0 -6px 16px rgba(0,0,0,0.06)', zIndex:2, padding:'2px 0 12px', borderBottom:`1px solid ${LINHA}` }}>
        <button aria-label="Novo lançamento" onClick={acoes.novo} style={fab}><Plus size={32} color="white" strokeWidth={2.4} /></button>
        {temFiltroAtivo ? (
          <div style={{ paddingTop:14 }}>
            <div style={gradeTotais}>
              <TotalCol valor={entradasPrev} rotulo="receitas" cor={VERDE_VALOR} />
              <TotalCol valor={-saidasPrev} rotulo="despesas" cor={VERMELHO} />
              <TotalCol valor={entradasPrev - saidasPrev} rotulo="total do filtro" cor={(entradasPrev - saidasPrev) < 0 ? VERMELHO : '#2b5fd9'} />
            </div>
          </div>
        ) : (
          <>
            <button aria-label={rodapeAberto ? 'Esconder previsto' : 'Mostrar previsto'} aria-expanded={rodapeAberto} onClick={alternarRodape}
              style={{ width:'100%', height:30, border:'none', background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#6b6b65' }}>
              {rodapeAberto ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
            </button>
            <div style={gradeTotais}>
              <TotalCol valor={entradasReais} rotulo="entradas" cor={VERDE_VALOR} />
              <TotalCol valor={-saidasReais} rotulo="saídas" cor={VERMELHO} />
              <TotalCol valor={saldoRealCumulativo} rotulo="saldo" cor={corSaldoReal} />
            </div>
            {rodapeAberto && (
              <div style={{ ...gradeTotais, marginTop:18 }}>
                <TotalCol valor={entradasPrev} rotulo="previsto" cor={VERDE_VALOR} />
                <TotalCol valor={-saidasPrev} rotulo="previsto" cor={VERMELHO} />
                <TotalCol valor={saldoPrevCumulativo} rotulo="previsto" cor={corSaldoPrev} />
              </div>
            )}
          </>
        )}
      </div>

      {detalhe && <DetalheModal
        lanc={detalhe}
        onFechar={() => setDetalhe(null)}
        onEditar={acoes.editar}
        onExcluir={(l) => { setDetalhe(null); acoes.excluir(l); }} />}
      {filtroAberto && <FiltroModal filtros={filtros} onAplicar={setFiltros} onFechar={() => setFiltroAberto(false)} />}
      {faturaParaPagar && <ModalPagarFatura fatura={faturaParaPagar} onFechar={() => setFaturaParaPagar(null)} />}
      {acoes.elementos}
    </div>
  );
}

function ItemMenu({ onClick, icone, texto, ultimo = false }) {
  return (
    <button onClick={onClick}
      style={{ width:'100%', border:'none', background:'none', padding:'14px 18px', textAlign:'left', fontSize:15, fontWeight:600, color:'#111', cursor:'pointer', display:'flex', alignItems:'center', gap:10, borderBottom: ultimo ? 'none' : '1px solid #f3f4f6' }}>
      {icone} {texto}
    </button>
  );
}

function TotalCol({ valor, rotulo, cor }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3, minWidth:0 }}>
      <span style={{ fontSize:16, fontWeight:500, color:cor, whiteSpace:'nowrap' }}>{valor < 0 ? '-' : ''}{formatarMoeda(Math.abs(valor))}</span>
      <span style={{ fontSize:14, color:'#6b6b65' }}>{rotulo}</span>
    </div>
  );
}

// Linha do Fluxo no estilo Organizze
function LinhaLancamento({ lanc, hoje, onClick }) {
  const { contas } = useApp();
  const isReceita = lanc.tipo === 'receita';
  const isTransf = lanc.tipo === 'transferencia';
  const atrasado = !lanc.pago && lanc.data <= hoje;
  const fundo = atrasado ? FUNDO_ATRASADO : 'transparent';
  const contaDe = (id) => contas.find(c => String(c.id) === String(id));

  let icone, subtitulo, valorTxt, corValor, status;
  if (lanc._isFatura) {
    const pagoCom = lanc.pago && lanc._contaIdPagamento ? contaDe(lanc._contaIdPagamento) : null;
    icone = <IconeBanco nome={lanc._cartaoBanco} icone={(lanc._cartaoBanco || '?').slice(0, 2).toUpperCase()} cor={lanc._cartaoCor || '#820ad1'} size={TAM_ICONE} />;
    subtitulo = <><IconeBanco nome={lanc._cartaoBanco} icone={(lanc._cartaoBanco || '?').slice(0, 2).toUpperCase()} cor={lanc._cartaoCor || '#820ad1'} size={18} /><span style={reticencias}>{lanc._cartaoNome || lanc._cartaoBanco}{pagoCom ? ` → ${pagoCom.nome}` : ''}</span></>;
    valorTxt = '-' + formatarNumero(lanc.valor); corValor = TEXTO;
    status = lanc.pago ? 'pago' : 'não pago';
  } else {
    const conta = contaDe(lanc.contaId);
    const destino = isTransf ? contaDe(lanc.contaDestinoId) : null;
    const selo = lanc.fixo ? 'fixo' : lanc.parcelado ? 'parcela' : null;
    icone = <IconeCategoria nome={lanc.categoria} tipo={lanc.tipo} size={TAM_ICONE} selo={selo} corFundoSelo={atrasado ? FUNDO_ATRASADO : FUNDO} />;
    subtitulo = conta
      ? <><IconeBanco nome={conta.nome} icone={conta.icone} cor={conta.cor} size={18} /><span style={reticencias}>{conta.nome}{destino ? ` → ${destino.nome}` : ''}</span></>
      : <span style={reticencias}>{lanc.categoria}</span>;
    valorTxt = (isReceita ? '+' : isTransf ? '' : '-') + formatarNumero(lanc.valor);
    corValor = isReceita ? VERDE_VALOR : isTransf ? '#2b5fd9' : TEXTO;
    status = isTransf ? (lanc.pago ? 'transferido' : 'pendente') : lanc.pago ? (isReceita ? 'recebido' : 'pago') : (isReceita ? 'não recebido' : 'não pago');
  }

  return (
    <div onClick={onClick} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onClick(); }}
      style={{ display:'flex', alignItems:'center', gap:14, padding:'11px 18px 11px 22px', minHeight:74, boxSizing:'border-box', background:fundo, cursor:'pointer', userSelect:'none' }}>
      {icone}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:4 }}>
        <span style={{ fontSize:16, fontWeight:500, color:TEXTO, lineHeight:1.25, ...reticencias }}>{lanc.descricao}</span>
        <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:14, color:CINZA, minWidth:0 }}>{subtitulo}</span>
      </div>
      <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
        <span style={{ fontSize:16, fontWeight:500, color:corValor, whiteSpace:'nowrap' }}>{valorTxt}</span>
        <span style={{ fontSize:14, color:CINZA }}>{status}</span>
      </div>
    </div>
  );
}

const formatarNumero = (v) => Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const VERDE_TOPO = '#1fbf5c';
const VERDE_VALOR = '#15803d';
const VERMELHO = '#c81e3a';
const FUNDO = '#fdfcf8';
const FUNDO_ATRASADO = '#fcefe4';
const LINHA = '#ecebe5';
const TEXTO = '#1c1c1a';
const CINZA = '#7b7b74';
const TAM_ICONE = 54;

const reticencias = { overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' };
const iconeTopo = { width:44, height:44, border:'none', background:'transparent', color:'white', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0, flexShrink:0 };
const setaCarrossel = { width:36, height:44, border:'none', background:'transparent', color:'#2a2a28', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0, flexShrink:0 };
const vizinhoCarrossel = { flex:1, minWidth:0, border:'none', background:'transparent', fontSize:15, color:'#55554f', cursor:'pointer', padding:'0 4px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' };
const gradeTotais = { display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', textAlign:'center', padding:'0 8px' };
const fab = { position:'absolute', top:-82, right:18, width:66, height:66, borderRadius:'50%', background:'#dc2f45', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 6px 18px rgba(0,0,0,0.22)', zIndex:3 };
