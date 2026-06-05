import { useState, useEffect } from 'react';
import { X, Check, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';

const hoje = () => new Date().toISOString().slice(0, 10);

// Converte centavos (inteiro) para string formatada "1.234,56"
function centavosParaDisplay(centavos) {
  if (!centavos) return '0,00';
  const str = String(centavos).padStart(3, '0');
  const reais = str.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cents = str.slice(-2);
  return `${reais},${cents}`;
}

// Converte centavos para número float
function centavosParaFloat(centavos) {
  return centavos / 100;
}

const vazio = {
  descricao: '', valor: '', data: hoje(), tipo: 'despesa',
  categoria: 'Outros', contaId: '', cartaoId: '',
  contaOrigemId: '', contaDestinoId: '',
  fixo: false, parcelado: false, parcela: 1, totalParcelas: 2, pago: false,
};

export default function ModalLancamento({ editando, onFechar, cartaoPreSelecionado }) {
  const { contas, cartoes, categorias, adicionarLancamento, adicionarVariosLancamentos, editarLancamento } = useApp();
  // valorCentavos guarda o valor como inteiro de centavos (ex: R$ 12,50 = 1250)
  const [valorCentavos, setValorCentavos] = useState(
    editando ? Math.round(Math.abs(editando.valor) * 100) : 0
  );
  const primeiroCartaoId = cartaoPreSelecionado || cartoes[0]?.id || null;
  const [form, setForm] = useState(editando
    ? { ...editando, valor: String(Math.abs(editando.valor)) }
    : { ...vazio, contaId: contas[0]?.id || null, contaOrigemId: contas[0]?.id || null, contaDestinoId: contas[1]?.id || contas[0]?.id || null, cartaoId: primeiroCartaoId }
  );
  const [abaForma, setAbaForma] = useState(editando?.cartaoId ? 'cartao' : cartaoPreSelecionado ? 'cartao' : 'conta');
  const [erros, setErros] = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function salvar() {
    // Fix 1: Validação com campos em vermelho
    const novosErros = {};
    if (!form.descricao.trim()) novosErros.descricao = true;
    if (Object.keys(novosErros).length > 0) { setErros(novosErros); return; }
    setErros({});

    // Fix 2: Valor por parcela = total / número de parcelas
    const valorTotal = centavosParaFloat(valorCentavos);
    const valorNum = form.parcelado && !editando
      ? valorTotal / (form.totalParcelas || 1)
      : valorTotal;
    const cartaoIdFinal = form.tipo === 'transferencia' ? null : abaForma === 'cartao' ? (form.cartaoId || primeiroCartaoId || null) : null;
    const base = {
      ...form,
      valor: form.tipo === 'despesa' ? -Math.abs(valorNum) : Math.abs(valorNum),
      contaId: form.tipo === 'transferencia' ? form.contaOrigemId : abaForma === 'conta' ? (form.contaId || null) : null,
      cartaoId: cartaoIdFinal,
      // Compra no cartão = sempre confirmada (não tem status pendente por transação)
      pago: cartaoIdFinal ? true : form.pago,
    };

    if (editando && editando.id && !editando._copia) {
      editarLancamento(editando.id, base);
    } else if (form.parcelado && !editando) {
      // Gera todas as parcelas de uma vez com IDs únicos e grupoId compartilhado
      const total = form.totalParcelas || 2;
      const grupoId = Date.now(); // ID único para identificar o grupo de parcelas
      const parcelas = Array.from({ length: total }, (_, i) => {
        const dataBase = new Date(form.data + 'T00:00:00');
        dataBase.setMonth(dataBase.getMonth() + i);
        return {
          ...base,
          data: dataBase.toISOString().slice(0, 10),
          parcela: i + 1,
          totalParcelas: total,
          grupoId,
          pago: i === 0 ? base.pago : false,
        };
      });
      adicionarVariosLancamentos(parcelas);
    } else {
      adicionarLancamento(base);
    }
    onFechar();
  }

  const tipos = [
    { id: 'despesa', label: '⬇ Despesa', bg: '#fee2e2', cor: '#dc2626', border: '#dc2626' },
    { id: 'receita', label: '⬆ Receita', bg: '#dcfce7', cor: '#16a34a', border: '#16a34a' },
    { id: 'transferencia', label: '↔ Transf.', bg: '#dbeafe', cor: '#1d4ed8', border: '#1d4ed8' },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={{ background: 'white', borderRadius: '24px 24px 0 0', padding: '0 0 24px', width: '100%', maxHeight: '92%', overflowY: 'auto' }}>

        {/* Handle + título */}
        <div style={{ padding: '12px 20px 0', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>
              {editando?._copia ? '📋 Duplicar Lançamento' : editando ? 'Editar Lançamento' : 'Novo Lançamento'}
            </h3>
            <button onClick={onFechar} style={{ background: '#f3f4f6', border: 'none', borderRadius: 10, padding: 6, cursor: 'pointer' }}><X size={18} color="#666" /></button>
          </div>
        </div>

        <div style={{ padding: '0 20px' }}>

          {/* Tipo */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {tipos.map(t => (
              <button key={t.id} onClick={() => set('tipo', t.id)}
                style={{ flex: 1, padding: '10px 4px', borderRadius: 10, border: `1.5px solid ${form.tipo === t.id ? t.border : '#e5e7eb'}`, background: form.tipo === t.id ? t.bg : 'white', color: form.tipo === t.id ? t.cor : '#888', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Valor grande com máscara automática */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Valor (R$)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, fontWeight: 700, color: '#aaa' }}>R$</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={centavosParaDisplay(valorCentavos)}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '');
                  const centavos = parseInt(digits || '0', 10);
                  setValorCentavos(Math.min(centavos, 99999999));
                  if (centavos > 0) setErros(er => ({ ...er, valor: false }));
                }}
                style={{
                  ...inp,
                  fontSize: 28, fontWeight: 700, textAlign: 'right',
                  paddingLeft: 48, paddingRight: 16, letterSpacing: 1,
                  color: form.tipo === 'receita' ? '#16a34a' : form.tipo === 'transferencia' ? '#1d4ed8' : '#dc2626',
                  border: erros.valor ? '2px solid #dc2626' : '1.5px solid #e5e7eb',
                }}
              />
              {erros.valor && <p style={{ color: '#dc2626', fontSize: 11, marginTop: 4, fontWeight: 600 }}>⚠ Informe o valor</p>}
            </div>
          </div>

          {/* Descrição */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Descrição</label>
            <input placeholder="Ex: Conta de Luz, Salário..." value={form.descricao}
              onChange={e => { set('descricao', e.target.value); if (e.target.value.trim()) setErros(er => ({ ...er, descricao: false })); }}
              style={{ ...inp, border: erros.descricao ? '2px solid #dc2626' : '1.5px solid #e5e7eb' }} />
            {erros.descricao && <p style={{ color: '#dc2626', fontSize: 11, marginTop: 4, fontWeight: 600 }}>⚠ Informe a descrição</p>}
          </div>

          {/* Data */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Data</label>
            <input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={inp} />
          </div>

          {/* Categoria */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Categoria</label>
            <div style={{ position: 'relative' }}>
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)} style={{ ...inp, appearance: 'none', paddingRight: 36 }}>
                {categorias.map(c => (
                  <option key={c.id} value={c.nome}>{c.emoji} {c.nome}</option>
                ))}
              </select>
              <ChevronDown size={16} color="#888" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Forma de pagamento — Transferência mostra origem + destino */}
          {form.tipo === 'transferencia' ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Conta Origem</label>
                <div style={{ position: 'relative' }}>
                  <select value={form.contaOrigemId}
                    onChange={e => set('contaOrigemId', Number(e.target.value))}
                    style={{ ...inp, appearance: 'none', paddingRight: 36 }}>
                    {contas.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>
                  <ChevronDown size={16} color="#888" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                <span style={{ padding: '0 12px', fontSize: 18, color: '#1d4ed8' }}>↓</span>
                <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Conta Destino</label>
                <div style={{ position: 'relative' }}>
                  <select value={form.contaDestinoId}
                    onChange={e => set('contaDestinoId', Number(e.target.value))}
                    style={{ ...inp, appearance: 'none', paddingRight: 36 }}>
                    {contas.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>
                  <ChevronDown size={16} color="#888" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>
            </>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Pago com</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {['conta', 'cartao'].map(f => (
                  <button key={f} onClick={() => {
                    setAbaForma(f);
                    // Garante que ao mudar para cartão, o primeiro cartão é selecionado
                    if (f === 'cartao' && !form.cartaoId && primeiroCartaoId) {
                      set('cartaoId', primeiroCartaoId);
                    }
                  }}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1.5px solid ${abaForma === f ? '#16a34a' : '#e5e7eb'}`, background: abaForma === f ? '#dcfce7' : 'white', color: abaForma === f ? '#16a34a' : '#888', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    {f === 'conta' ? '🏦 Conta' : '💳 Cartão'}
                  </button>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <select value={abaForma === 'conta' ? form.contaId : form.cartaoId}
                  onChange={e => abaForma === 'conta' ? set('contaId', Number(e.target.value)) : set('cartaoId', Number(e.target.value))}
                  style={{ ...inp, appearance: 'none', paddingRight: 36 }}>
                  {abaForma === 'conta'
                    ? contas.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)
                    : cartoes.map(c => <option key={c.id} value={c.id}>💳 {c.nome}</option>)
                  }
                </select>
                <ChevronDown size={16} color="#888" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>
          )}

          {/* Fixo / Parcelado */}
          <div style={{ background: '#f9fafb', borderRadius: 14, padding: '4px 14px', marginBottom: 16 }}>
            <ToggleRow label="Despesa Fixa (todo mês)" checked={form.fixo} onChange={v => { set('fixo', v); if (v) set('parcelado', false); }} />
            <ToggleRow label="Parcelado" checked={form.parcelado} onChange={v => { set('parcelado', v); if (v) set('fixo', false); }} />
            {form.parcelado && (
              <SeletorParcelas
                total={form.totalParcelas}
                onTotal={v => set('totalParcelas', v)}
                valorTotal={centavosParaFloat(valorCentavos)}
              />
            )}
          </div>

          {/* Status pago — só para conta, cartão é sempre confirmado */}
          {abaForma === 'conta' && form.tipo !== 'transferencia' && (
            <div style={{ background: '#f9fafb', borderRadius: 14, padding: '4px 14px', marginBottom: 20 }}>
              <ToggleRow
                label={form.tipo === 'receita' ? 'Já recebido?' : 'Já pago?'}
                checked={form.pago}
                onChange={v => set('pago', v)}
              />
            </div>
          )}
          {abaForma === 'cartao' && (
            <div style={{ background: '#dbeafe', borderRadius: 14, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>💳</span>
              <p style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>Compra confirmada — lançada na fatura do cartão</p>
            </div>
          )}

          {/* Botão salvar */}
          <button onClick={salvar} style={{ width: '100%', background: '#16a34a', color: 'white', border: 'none', borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Check size={20} /> {editando ? 'Salvar Alterações' : 'Adicionar Lançamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

const PERIODOS_PARC = ['Semanas', 'Quinzenas', 'Meses', 'Bimestres', 'Trimestres', 'Semestres', 'Anos'];

function SeletorParcelas({ total, onTotal, valorTotal }) {
  const [tipoPeriodo, setTipoPeriodo] = useState('Meses');

  return (
    <div style={{ padding: '12px 0 4px' }}>
      <p style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 12 }}>Despesa parcelada</p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        {/* Seletor de quantidade */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#f3f4f6', borderRadius: 12, overflow: 'hidden', border: '1.5px solid #e5e7eb' }}>
          <button onClick={() => onTotal(Math.max(2, total - 1))}
            style={{ width: 40, height: 44, background: 'none', border: 'none', fontSize: 22, color: '#16a34a', cursor: 'pointer', fontWeight: 700 }}>−</button>
          <span style={{ minWidth: 36, textAlign: 'center', fontSize: 20, fontWeight: 800, color: '#111' }}>{total}</span>
          <button onClick={() => onTotal(Math.min(60, total + 1))}
            style={{ width: 40, height: 44, background: 'none', border: 'none', fontSize: 22, color: '#16a34a', cursor: 'pointer', fontWeight: 700 }}>+</button>
        </div>

        {/* Seletor de período */}
        <div style={{ flex: 1, position: 'relative' }}>
          <select value={tipoPeriodo} onChange={e => setTipoPeriodo(e.target.value)}
            style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '11px 32px 11px 14px', fontSize: 15, fontWeight: 600, outline: 'none', background: 'white', appearance: 'none', color: '#111', cursor: 'pointer' }}>
            {PERIODOS_PARC.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <ChevronDown size={16} color="#888" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Atalhos rápidos */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {[2, 3, 6, 10, 12, 18, 24].map(n => (
          <button key={n} onClick={() => { onTotal(n); setTipoPeriodo('Meses'); }}
            style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${total === n && tipoPeriodo === 'Meses' ? '#16a34a' : '#e5e7eb'}`, background: total === n && tipoPeriodo === 'Meses' ? '#dcfce7' : 'white', color: total === n && tipoPeriodo === 'Meses' ? '#16a34a' : '#666', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            {n}x
          </button>
        ))}
      </div>

      {/* Resumo */}
      <div style={{ background: '#dcfce7', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
          📋 {total}x em {tipoPeriodo.toLowerCase()}
          {valorTotal > 0 && ` — R$ ${(valorTotal / total).toFixed(2).replace('.', ',')} por parcela`}
        </p>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>{label}</span>
      <button onClick={() => onChange(!checked)}
        style={{ width: 46, height: 26, borderRadius: 13, background: checked ? '#16a34a' : '#d1d5db', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: checked ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}

const lbl = { fontSize: 12, color: '#888', fontWeight: 600, display: 'block', marginBottom: 4 };
const inp = { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '11px 14px', fontSize: 15, outline: 'none', background: 'white', boxSizing: 'border-box' };
