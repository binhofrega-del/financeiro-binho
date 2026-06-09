import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, CreditCard } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatarMoeda, nomeMes, emojisCategoria, logoParaBanco } from '../utils/formatters';
import ModalLancamento from '../components/ModalLancamento';
import DetalheModal from '../components/DetalheModal';

export default function CartoesScreen({ setAba }) {
  const { cartoes, lancamentos, removerLancamento } = useApp();
  const [cartaoIdx, setCartaoIdx] = useState(0);
  const [mesAtual, setMesAtual] = useState(new Date().getMonth());
  const [anoAtual, setAnoAtual] = useState(new Date().getFullYear());
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [detalhe, setDetalhe] = useState(null);

  function mudarMes(dir) {
    let m = mesAtual + dir;
    let a = anoAtual;
    if (m > 11) { m = 0; a++; }
    if (m < 0) { m = 11; a--; }
    setMesAtual(m);
    setAnoAtual(a);
  }

  function mudarCartao(dir) {
    let idx = cartaoIdx + dir;
    if (idx < 0) idx = cartoes.length - 1;
    if (idx >= cartoes.length) idx = 0;
    setCartaoIdx(idx);
  }

  function abrirEditar(lanc) {
    setDetalhe(null);
    setEditando(lanc);
    setModalAberto(true);
  }

  if (cartoes.length === 0) return <SemCartao setAba={setAba} />;

  const cartao = cartoes[cartaoIdx];

  // Lançamentos deste cartão neste mês
  // Lançamentos FIXOS no cartão aparecem em todos os meses a partir da data de criação
  const lancCartao = useMemo(() => {
    const inicioMes = new Date(anoAtual, mesAtual, 1);
    const fimMes = new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59);

    return lancamentos
      .filter(l => l.cartaoId === cartao.id)
      .map(l => {
        // Novo: lançamento tem faturaMes/faturaAno definido
        if (l.faturaMes != null && l.faturaAno != null) {
          if (l.faturaMes === mesAtual && l.faturaAno === anoAtual) return l;
          // Fixo: repete todo mês a partir da criação
          if (l.fixo) {
            const dCriacao = new Date(l.data + 'T00:00:00');
            const fimMesRef = new Date(anoAtual, mesAtual + 1, 0);
            if (dCriacao <= fimMesRef) {
              const dataNoMes = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${l.data.slice(8, 10)}`;
              return { ...l, data: dataNoMes };
            }
          }
          return null;
        }

        // Legado: sem faturaMes, usa a data do lançamento
        const d = new Date(l.data + 'T00:00:00');
        if (d >= inicioMes && d <= fimMes) return l;
        if (l.fixo && d <= fimMes) {
          const dataNoMes = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${l.data.slice(8, 10)}`;
          return { ...l, data: dataNoMes };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [lancamentos, cartao.id, mesAtual, anoAtual]);

  const totalFatura = lancCartao.reduce((acc, l) => acc + Math.abs(l.valor), 0);
  const totalPago = lancCartao.filter(l => l.pago).reduce((acc, l) => acc + Math.abs(l.valor), 0);
  const totalPendente = totalFatura - totalPago;
  const disponivel = cartao.limite - totalFatura;
  const pctUsado = Math.min((totalFatura / cartao.limite) * 100, 100);

  // Gastos por categoria
  const porCategoria = useMemo(() => {
    const mapa = {};
    lancCartao.forEach(l => {
      if (!mapa[l.categoria]) mapa[l.categoria] = 0;
      mapa[l.categoria] += Math.abs(l.valor);
    });
    return Object.entries(mapa)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, val]) => ({ cat, val, pct: totalFatura > 0 ? (val / totalFatura) * 100 : 0 }));
  }, [lancCartao, totalFatura]);

  // Agrupar por dia
  const porDia = useMemo(() => {
    const grupos = {};
    lancCartao.forEach(l => {
      if (!grupos[l.data]) grupos[l.data] = [];
      grupos[l.data].push(l);
    });
    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
  }, [lancCartao]);

  // Dias para vencimento
  const hoje = new Date();
  const diaHoje = hoje.getDate();
  const diasVenc = cartao.diaVencimento >= diaHoje
    ? cartao.diaVencimento - diaHoje
    : 30 - diaHoje + cartao.diaVencimento;

  function formatarDiaHeader(dataStr) {
    const [ano, mes, dia] = dataStr.split('-');
    const d = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return `${parseInt(dia)} de ${nomeMes(parseInt(mes) - 1)} · ${dias[d.getDay()]}`;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f3f4f6', overflow: 'hidden' }}>

      {/* Header verde */}
      <div style={{ background: '#16a34a', padding: '16px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>Cartões de Crédito</h2>
          <button onClick={() => setAba('config')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
            <Plus size={14} /> Novo
          </button>
        </div>

        {/* Seletor de cartão */}
        {cartoes.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button onClick={() => mudarCartao(-1)} style={navBtn}><ChevronLeft size={18} /></button>
            <div style={{ display: 'flex', gap: 6 }}>
              {cartoes.map((_, i) => (
                <div key={i} style={{ width: i === cartaoIdx ? 18 : 6, height: 6, borderRadius: 3, background: i === cartaoIdx ? 'white' : 'rgba(255,255,255,0.4)', transition: 'all 0.2s' }} />
              ))}
            </div>
            <button onClick={() => mudarCartao(1)} style={navBtn}><ChevronRight size={18} /></button>
          </div>
        )}

        {/* Card visual */}
        <CardVisual cartao={cartao} mesAtual={mesAtual} anoAtual={anoAtual} totalFatura={totalFatura} disponivel={disponivel} pctUsado={pctUsado} />
      </div>

      {/* Conteúdo scrollável */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 80px' }}>

        {/* Info vencimento + mês */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: 'white', borderRadius: 12, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase' }}>Vencimento</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#111', marginTop: 2 }}>Dia {cartao.diaVencimento}</p>
            <p style={{ fontSize: 11, color: diasVenc <= 3 ? '#dc2626' : diasVenc <= 7 ? '#d97706' : '#16a34a', fontWeight: 600, marginTop: 2 }}>
              {diasVenc === 0 ? '⚠ Vence hoje!' : `${diasVenc} dias`}
            </p>
          </div>
          <div style={{ flex: 1, background: 'white', borderRadius: 12, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase' }}>Pago</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#16a34a', marginTop: 2 }}>{formatarMoeda(totalPago)}</p>
            <p style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>de {formatarMoeda(totalFatura)}</p>
          </div>
          <div style={{ flex: 1, background: 'white', borderRadius: 12, padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 10, color: '#aaa', fontWeight: 600, textTransform: 'uppercase' }}>Pendente</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: totalPendente > 0 ? '#dc2626' : '#16a34a', marginTop: 2 }}>{formatarMoeda(totalPendente)}</p>
            <p style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>a pagar</p>
          </div>
        </div>

        {/* Fix 3: Seletor de mês da fatura com botão Hoje */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1, background: 'white', borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <button onClick={() => mudarMes(-1)} style={navBtnDark}><ChevronLeft size={18} /></button>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Fatura de {nomeMes(mesAtual)} {anoAtual}</span>
            <button onClick={() => mudarMes(1)} style={navBtnDark}><ChevronRight size={18} /></button>
          </div>
          {(mesAtual !== new Date().getMonth() || anoAtual !== new Date().getFullYear()) && (
            <button onClick={() => { setMesAtual(new Date().getMonth()); setAnoAtual(new Date().getFullYear()); }}
              style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Hoje
            </button>
          )}
        </div>

        {/* Gastos por categoria */}
        {porCategoria.length > 0 && (
          <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 12 }}>Gastos por categoria</p>
            {porCategoria.map(({ cat, val, pct }) => (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#444' }}>{emojisCategoria[cat] || '📌'} {cat}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{formatarMoeda(val)}</span>
                </div>
                <div style={{ background: '#f3f4f6', borderRadius: 3, height: 5 }}>
                  <div style={{ background: '#16a34a', height: 5, borderRadius: 3, width: `${pct}%` }} />
                </div>
                <p style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{pct.toFixed(0)}% da fatura</p>
              </div>
            ))}
          </div>
        )}

        {/* Lista de lançamentos */}
        {porDia.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#aaa' }}>
            <p style={{ fontSize: 36 }}>💳</p>
            <p style={{ fontSize: 15, fontWeight: 600, marginTop: 10 }}>Nenhum gasto neste mês</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Toque no + para lançar uma compra</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Lançamentos</p>
            {porDia.map(([data, items]) => (
              <div key={data}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#aaa', padding: '8px 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {formatarDiaHeader(data)}
                </p>
                {items.map(l => (
                  <div key={l.id} onClick={() => setDetalhe(l)}
                    style={{ background: 'white', borderRadius: 13, padding: '11px 13px', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 11, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: 'pointer' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {emojisCategoria[l.categoria] || '📌'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.descricao}</p>
                      <p style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{l.categoria}{l.parcelado ? ` · ${l.parcela}/${l.totalParcelas}x` : ''}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>-{formatarMoeda(Math.abs(l.valor))}</p>
                      <p style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, marginTop: 1 }}>✓ Confirmado</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      {/* FAB */}
      <button onClick={() => { setEditando(null); setModalAberto(true); }}
        style={{ position: 'absolute', bottom: 80, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#16a34a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(22,163,74,0.45)', zIndex: 10 }}>
        <Plus size={28} color="white" />
      </button>

      {modalAberto && <ModalLancamento editando={editando} onFechar={() => { setModalAberto(false); setEditando(null); }} cartaoPreSelecionado={cartao.id} />}
      {detalhe && <DetalheModal lanc={detalhe} onFechar={() => setDetalhe(null)} onEditar={abrirEditar} />}
    </div>
  );
}

function SemCartao({ setAba }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', padding: 32, gap: 12 }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CreditCard size={40} color="#0891b2" />
      </div>
      <p style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>Nenhum cartão cadastrado</p>
      <p style={{ fontSize: 14, color: '#888', textAlign: 'center' }}>Adicione um cartão de crédito para acompanhar sua fatura</p>
      <button onClick={() => setAba('config')} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 14, padding: '12px 28px', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 8 }}>
        + Adicionar Cartão
      </button>
    </div>
  );
}

function CardVisual({ cartao, mesAtual, anoAtual, totalFatura, disponivel, pctUsado }) {
  // A fatura do mês X fecha no mês X-1 e vence no mês X
  const mesFech = mesAtual === 0 ? 11 : mesAtual - 1;
  const anoFech = mesAtual === 0 ? anoAtual - 1 : anoAtual;
  const dataFecha = `${String(cartao.diaFechamento).padStart(2,'0')}/${String(mesFech + 1).padStart(2,'0')}/${anoFech}`;
  const dataVence = `${String(cartao.diaVencimento).padStart(2,'0')}/${String(mesAtual + 1).padStart(2,'0')}/${anoAtual}`;

  return (
    <div style={{ background: `linear-gradient(135deg, ${cartao.cor}, #1d4ed8)`, borderRadius: 18, padding: '18px 20px', color: 'white', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 11, opacity: 0.75 }}>{cartao.banco}</p>
          <p style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{cartao.nome}</p>
        </div>
        {logoParaBanco(cartao.banco) ? (
          <img src={logoParaBanco(cartao.banco)} alt={cartao.banco}
            style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} />
        ) : (
          <CreditCard size={28} style={{ opacity: 0.6 }} />
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
        <div>
          <p style={{ fontSize: 10, opacity: 0.7 }}>Fatura {nomeMes(mesAtual)}</p>
          <p style={{ fontSize: 22, fontWeight: 800 }}>{formatarMoeda(totalFatura)}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 10, opacity: 0.7 }}>Limite disponível</p>
          <p style={{ fontSize: 16, fontWeight: 700 }}>{formatarMoeda(Math.max(disponivel, 0))}</p>
        </div>
      </div>

      {/* Fechamento e Vencimento */}
      <div style={{ display: 'flex', gap: 24, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
        <div>
          <p style={{ fontSize: 10, opacity: 0.65 }}>Fecha em</p>
          <p style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{dataFecha}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, opacity: 0.65 }}>Vence em</p>
          <p style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{dataVence}</p>
        </div>
      </div>

      {/* Barra de uso */}
      <div style={{ background: 'rgba(255,255,255,0.2)', height: 5, borderRadius: 3, marginTop: 12 }}>
        <div style={{ background: pctUsado > 80 ? '#fbbf24' : 'white', height: 5, borderRadius: 3, width: `${pctUsado}%`, transition: 'width 0.4s' }} />
      </div>
      <p style={{ fontSize: 10, opacity: 0.65, marginTop: 4 }}>{pctUsado.toFixed(0)}% do limite de {formatarMoeda(cartao.limite)} utilizado</p>
    </div>
  );
}

const navBtn = { background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'white', display: 'flex' };
const navBtnDark = { background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex', padding: 4 };
