import { useState, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, Repeat, Layers, MoreVertical, Printer } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatarMoeda, nomeMes, emojiCategoria } from '../utils/formatters';
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
  const entradas = entradasPrev; const saidas = saidasPrev; const saldo = entradasPrev - saidasPrev;
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
          <div style={{ position:'relative' }}>
            <button onClick={() => setMenuAberto(v=>!v)} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:10, padding:'6px 8px', cursor:'pointer', color:'white', display:'flex', alignItems:'center' }}>
              <MoreVertical size={20} />
              {temFiltroAtivo && <span style={{ position:'absolute', top:4, right:4, width:8, height:8, background:'#fbbf24', borderRadius:'50%' }} />}
            </button>
            {menuAberto && (
              <>
                <div onClick={() => setMenuAberto(false)} style={{ position:'fixed', inset:0, zIndex:19 }} />
                <div style={{ position:'absolute', top:'110%', right:0, background:'white', borderRadius:14, boxShadow:'0 8px 24px rgba(0,0,0,0.15)', zIndex:20, overflow:'hidden', minWidth:160 }}>
                  <button onClick={() => { setMenuAberto(false); setFiltroAberto(true); }}
                    style={{ width:'100%', border:'none', background:'none', padding:'14px 18px', textAlign:'left', fontSize:14, fontWeight:600, color:'#111', cursor:'pointer', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid #f3f4f6' }}>
                    <span>⚙</span> Filtrar
                  </button>
                  <button onClick={() => { setMenuAberto(false); imprimir(); }}
                    style={{ width:'100%', border:'none', background:'none', padding:'14px 18px', textAlign:'left', fontSize:14, fontWeight:600, color:'#111', cursor:'pointer', display:'flex', alignItems:'center', gap:10 }}>
                    <Printer size={16} /> Imprimir
                  </button>
                </div>
              </>
            )}
          </div>
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
            {dataRef !== primeiroDoMesAtual() || modo !== 'mes' ? (
              <button onClick={() => { setModo('mes'); setDataRef(primeiroDoMesAtual()); }}
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
              <CardLancamento key={`${l.id}-${l._fixoMesAno || ''}`} lanc={l} onClick={() => l._isFatura ? setFaturaParaPagar(l) : setDetalhe(l)} />
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

      <button onClick={acoes.novo} style={fab}><Plus size={28} color="white" /></button>

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

function ResumoBox({ label, valor, cor, prefixo='' }) {
  return (
    <div style={{ flex:1, background:'white', borderRadius:12, padding:'10px 8px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
      <p style={{ fontSize:10, color:'#888', fontWeight:600, textTransform:'uppercase' }}>{label}</p>
      <p style={{ fontSize:13, fontWeight:700, color:cor, marginTop:3 }}>{prefixo || (valor < 0 ? '-' : '')}{formatarMoeda(Math.abs(valor))}</p>
    </div>
  );
}

function DemoCol({ valor, label, cor, sinal='', pequeno=false }) {
  return (
    <div style={{ flex:1, textAlign:'center' }}>
      <p style={{ fontSize:pequeno?12:14, fontWeight:700, color:cor }}>{sinal || (valor < 0 ? '-' : '')}{formatarMoeda(Math.abs(valor))}</p>
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
  const emoji = emojiCategoria(lanc.categoria);
  const conta = contas.find(c => c.id===lanc.contaId);
  const destino = isTransf ? contas.find(c => c.id===lanc.contaDestinoId) : null;

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
          {conta && <><span style={{ fontSize:10, color:'#ddd' }}>•</span><div style={{ display:'flex', alignItems:'center', gap:4 }}><IconeBanco nome={conta.nome} icone={conta.icone} cor={conta.cor} size={16}/><p style={{ fontSize:11, color:'#aaa' }}>{conta.nome}{destino ? ` → ${destino.nome}` : ''}</p></div></>}
        </div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <p style={{ fontSize:15, fontWeight:700, color:cor }}>{isReceita?'+':isTransf?'':'-'}{formatarMoeda(Math.abs(lanc.valor))}</p>
        <p style={{ fontSize:10, color:lanc.pago?'#16a34a':'#aaa', fontWeight:600, marginTop:2 }}>
          {isTransf?(lanc.pago?'✓ Transferido':'Pendente'):lanc.pago?(isReceita?'✓ Recebido':'✓ Pago'):(isReceita?'Não recebido':'Não pago')}
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
