import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, CreditCard, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatarMoeda, nomeMes, logoParaBanco } from '../utils/formatters';
import IconeCategoria from '../components/IconeCategoria';
import { visualCategoria } from '../utils/categorias';
import DetalheModal from '../components/DetalheModal';
import { useAcoesLancamento } from '../hooks/useAcoesLancamento';
import { csvDaFatura, nomeArquivoFatura } from '../utils/exportarFatura';
import { baixarTexto } from '../utils/backup';
import {
  hojeISO, somarMeses, mesmoMes, faturaAtual, itensDaFatura, totalDosItens,
  infoPagamentoFatura, limiteUsado, situacaoVencimento, dataFechamento, dataVencimento, nomeFatura,
} from '../utils/financas';

const brData = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export default function CartoesScreen({ setAba }) {
  const { cartoes, lancamentos } = useApp();
  const hoje = hojeISO();
  const [cartaoIdx, setCartaoIdx] = useState(0);
  const [fatEscolhida, setFatEscolhida] = useState(null); // null = fatura aberta hoje
  const [detalhe, setDetalhe] = useState(null);

  const cartao = cartoes[Math.min(cartaoIdx, cartoes.length - 1)] || null;
  const acoes = useAcoesLancamento({ cartaoPreSelecionado: cartao?.id });
  const fatAberta = cartao ? faturaAtual(cartao, hoje) : null;
  const fat = fatEscolhida || fatAberta;
  const chaveFat = fat ? `${fat.ano}-${fat.mes}` : '';
  const mesAtual = fat ? fat.mes : 0;
  const anoAtual = fat ? fat.ano : 0;

  function mudarMes(dir) { setFatEscolhida(somarMeses(fat, dir)); }

  // Mesmo arquivo do "Exportar para planilhas" do Organizze (usado na conciliação)
  function exportarCsv() {
    baixarTexto(nomeArquivoFatura(cartao, fat), csvDaFatura(lancamentos, cartao, fat));
  }

  function mudarCartao(dir) {
    let idx = cartaoIdx + dir;
    if (idx < 0) idx = cartoes.length - 1;
    if (idx >= cartoes.length) idx = 0;
    setCartaoIdx(idx);
    setFatEscolhida(null);
  }

  // Itens desta fatura (compras, parcelas, estornos e fixos) — regra em utils/financas.js
  const lancCartao = useMemo(
    () => {
      if (!cartao || !chaveFat) return [];
      const [ano, mes] = chaveFat.split('-').map(Number);
      return itensDaFatura(lancamentos, cartao, { ano, mes });
    },
    [lancamentos, cartao, chaveFat]
  );

  const totalFatura = totalDosItens(lancCartao);
  const pg = cartao && fat ? infoPagamentoFatura(cartao, fat) : { pago: false, valor: null };
  const totalPago = pg.pago ? (pg.valor ?? totalFatura) : 0;
  const totalPendente = Math.max(totalFatura - totalPago, 0);
  // Limite comprometido considera todas as faturas em aberto (inclui parcelas futuras)
  const usado = cartao ? limiteUsado(cartao, lancamentos, hoje) : 0;
  const disponivel = cartao ? cartao.limite - usado : 0;
  const pctUsado = cartao?.limite > 0 ? Math.min(Math.max((usado / cartao.limite) * 100, 0), 100) : 0;

  // Gastos por categoria (só despesas)
  const porCategoria = useMemo(() => {
    const mapa = {};
    lancCartao.filter(l => l.tipo !== 'receita').forEach(l => {
      mapa[l.categoria] = (mapa[l.categoria] || 0) + Math.abs(l.valor);
    });
    const totalDesp = Object.values(mapa).reduce((a, b) => a + b, 0);
    return Object.entries(mapa)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, val]) => ({ cat, val, pct: totalDesp > 0 ? (val / totalDesp) * 100 : 0 }));
  }, [lancCartao]);

  // Agrupar por dia
  const porDia = useMemo(() => {
    const grupos = {};
    lancCartao.forEach(l => {
      if (!grupos[l.data]) grupos[l.data] = [];
      grupos[l.data].push(l);
    });
    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
  }, [lancCartao]);

  if (!cartao) return <SemCartao setAba={setAba} />;

  // vencimento da FATURA EXIBIDA (não do próximo dia 7 do calendário)
  const venc = situacaoVencimento(cartao, fat, hoje);

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
            <p style={{ fontSize: 15, fontWeight: 700, color: '#111', marginTop: 2 }}>{venc.data.slice(8, 10)}/{venc.data.slice(5, 7)}</p>
            <TextoVencimento venc={venc} temValor={totalFatura > 0} />
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
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Fatura de {nomeFatura({ ano: anoAtual, mes: mesAtual }, cartao)}</span>
            <button onClick={() => mudarMes(1)} style={navBtnDark}><ChevronRight size={18} /></button>
          </div>
          <button onClick={exportarCsv} disabled={lancCartao.length === 0} aria-label="Exportar fatura para planilha (CSV)" title="Exportar para planilhas"
            style={{ background: 'white', border: 'none', borderRadius: 12, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: lancCartao.length ? 'pointer' : 'default', opacity: lancCartao.length ? 1 : 0.4, color: '#111', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', flexShrink: 0 }}>
            <FileSpreadsheet size={20} />
          </button>
          {!mesmoMes(fat, fatAberta) && (
            <button onClick={() => setFatEscolhida(null)}
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
                  <span style={{ fontSize: 13, color: '#444', display: 'flex', alignItems: 'center', gap: 8 }}><IconeCategoria nome={cat} tipo="despesa" size={24} />{cat}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{formatarMoeda(val)}</span>
                </div>
                <div style={{ background: '#f3f4f6', borderRadius: 3, height: 5 }}>
                  <div style={{ background: visualCategoria(cat, 'despesa').cor, height: 5, borderRadius: 3, width: `${pct}%` }} />
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
                  <div key={`${l.id}-${l._fixoMesAno || ''}`} onClick={() => setDetalhe(l)}
                    style={{ background: 'white', borderRadius: 13, padding: '11px 13px', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 11, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: 'pointer' }}>
                    <IconeCategoria nome={l.categoria} tipo={l.tipo} size={42} corFundoSelo="#ffffff" selo={l.fixo ? 'fixo' : l.parcelado ? 'parcela' : null} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.descricao}</p>
                      <p style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{l.categoria}{l.parcelado ? ` · ${l.parcela}/${l.totalParcelas}x` : ''}{l.fixo ? ' · fixo' : ''}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: l.tipo === 'receita' ? '#16a34a' : '#dc2626' }}>{l.tipo === 'receita' ? '+' : '-'}{formatarMoeda(Math.abs(l.valor))}</p>
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
      <button onClick={acoes.novo}
        style={{ position: 'absolute', bottom: 80, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#dc2f45', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.22)', zIndex: 10 }}>
        <Plus size={28} color="white" />
      </button>

      {detalhe && <DetalheModal
        lanc={detalhe}
        onFechar={() => setDetalhe(null)}
        onEditar={acoes.editar}
        onExcluir={(l) => { setDetalhe(null); acoes.excluir(l); }} />}
      {acoes.elementos}
    </div>
  );
}

// "32 dias" / "vence hoje" / "vencida há 3 dias" / "✓ paga" — com cor pela proximidade
function TextoVencimento({ venc, temValor }) {
  let texto, cor;
  if (venc.paga) { texto = '✓ paga'; cor = '#16a34a'; }
  else if (!temValor) { texto = venc.dias < 0 ? 'sem valor' : `em ${venc.dias} dias`; cor = '#9ca3af'; }
  else if (venc.dias < 0) { texto = `vencida há ${-venc.dias} ${-venc.dias === 1 ? 'dia' : 'dias'}`; cor = '#dc2626'; }
  else if (venc.dias === 0) { texto = '⚠ vence hoje'; cor = '#dc2626'; }
  else { texto = `${venc.dias} ${venc.dias === 1 ? 'dia' : 'dias'}`; cor = venc.dias <= 3 ? '#dc2626' : venc.dias <= 7 ? '#d97706' : '#16a34a'; }
  return <p style={{ fontSize: 11, color: cor, fontWeight: 600, marginTop: 2 }}>{texto}</p>;
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
  // A fatura do mês X agrupa as compras do ciclo e FECHA no diaFechamento do próprio mês X;
  // o vencimento cai no mesmo mês ou no seguinte, conforme a configuração do cartão
  const fat = { ano: anoAtual, mes: mesAtual };
  const dataFecha = brData(dataFechamento(fat, cartao));
  const dataVence = brData(dataVencimento(fat, cartao));

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
          <p style={{ fontSize: 10, opacity: 0.7 }}>Fatura {nomeFatura(fat, cartao)}</p>
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
