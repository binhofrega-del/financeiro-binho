import { useState } from 'react';
import { X, Search, SlidersHorizontal, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';

const PERIODOS = ['Hoje', 'Mês atual', 'Este ano', 'Últimos 7 dias', 'Últimos 15 dias', 'Últimos 30 dias', 'Período personalizado'];

export default function FiltroModal({ filtros, onAplicar, onFechar }) {
  const { contas, cartoes, categorias } = useApp();
  const [tela, setTela] = useState('opcoes'); // opcoes | filtrar | periodo | pesquisar
  const [local, setLocal] = useState({ ...filtros });

  function toggleArr(campo, valor) {
    setLocal(f => {
      const arr = f[campo] || [];
      return { ...f, [campo]: arr.includes(valor) ? arr.filter(x => x !== valor) : [...arr, valor] };
    });
  }

  function aplicar() {
    onAplicar(local);
    onFechar();
  }

  function limpar() {
    const vazio = { tipos: [], situacao: [], contaIds: [], cartaoIds: [], categorias: [], periodo: 'Mês atual', busca: '' };
    setLocal(vazio);
    onAplicar(vazio);
    onFechar();
  }

  // ── TELA: OPÇÕES DE VISUALIZAÇÃO ──
  if (tela === 'opcoes') return (
    <Overlay onFechar={onFechar}>
      <div style={sheet}>
        <Handle />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 16px' }}>
          <span style={{ fontSize: 16, color: '#aaa' }}>Opções de visualização</span>
          <button onClick={onFechar} style={btnX}><X size={18} color="#666" /></button>
        </div>
        <OpcaoItem icon={<Search size={22} color="#16a34a" />} label="Pesquisar" onClick={() => setTela('pesquisar')} />
        <OpcaoItem icon={<SlidersHorizontal size={22} color="#16a34a" />} label="Filtrar" onClick={() => setTela('filtrar')} />
        <OpcaoItem icon={<Calendar size={22} color="#16a34a" />} label="Alterar período de visualização" onClick={() => setTela('periodo')} />
      </div>
    </Overlay>
  );

  // ── TELA: PESQUISAR ──
  if (tela === 'pesquisar') return (
    <Overlay onFechar={onFechar}>
      <div style={{ ...sheet, padding: '16px 20px 32px' }}>
        <Handle />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Pesquisar</span>
          <button onClick={() => setTela('opcoes')} style={btnX}><X size={18} color="#666" /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f3f4f6', borderRadius: 12, padding: '10px 14px' }}>
          <Search size={18} color="#aaa" />
          <input
            autoFocus
            placeholder="Buscar lançamento..."
            value={local.busca || ''}
            onChange={e => setLocal(f => ({ ...f, busca: e.target.value }))}
            style={{ flex: 1, border: 'none', background: 'none', fontSize: 15, outline: 'none' }}
          />
          {local.busca && <button onClick={() => setLocal(f => ({ ...f, busca: '' }))} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} color="#aaa" /></button>}
        </div>
        <button onClick={aplicar} style={btnSalvar}>Aplicar busca</button>
      </div>
    </Overlay>
  );

  // ── TELA: PERÍODO ──
  if (tela === 'periodo') return (
    <Overlay onFechar={onFechar}>
      <div style={{ background: 'white', borderRadius: 20, margin: '40px 20px', padding: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Alterar período de visualização</span>
          <button onClick={() => setTela('opcoes')} style={btnX}><X size={18} color="#666" /></button>
        </div>

        {PERIODOS.map(p => (
          <div key={p}>
            <button
              onClick={() => {
                setLocal(f => ({ ...f, periodo: p }));
                if (p !== 'Período personalizado') {
                  onAplicar({ ...local, periodo: p });
                  onFechar();
                }
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', background: 'none', border: 'none', padding: '14px 4px', borderBottom: p === 'Período personalizado' && local.periodo === p ? 'none' : '1px solid #f3f4f6', cursor: 'pointer' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${local.periodo === p ? '#16a34a' : '#ccc'}`, background: local.periodo === p ? '#16a34a' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {local.periodo === p && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
              </div>
              <span style={{ fontSize: 15, color: '#111' }}>{p}</span>
            </button>

            {/* Seletor de datas aparece quando Período personalizado está selecionado */}
            {p === 'Período personalizado' && local.periodo === 'Período personalizado' && (
              <div style={{ background: '#f9fafb', borderRadius: 14, padding: 16, marginBottom: 8, borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, color: '#888', fontWeight: 600, display: 'block', marginBottom: 4 }}>Data início</label>
                    <input
                      type="date"
                      value={local.dataInicio || ''}
                      onChange={e => setLocal(f => ({ ...f, dataInicio: e.target.value }))}
                      style={inpData}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, color: '#888', fontWeight: 600, display: 'block', marginBottom: 4 }}>Data fim</label>
                    <input
                      type="date"
                      value={local.dataFim || ''}
                      onChange={e => setLocal(f => ({ ...f, dataFim: e.target.value }))}
                      style={inpData}
                    />
                  </div>
                </div>

                {/* Preview do período */}
                {local.dataInicio && local.dataFim && (
                  <div style={{ background: '#dcfce7', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#16a34a', fontWeight: 600, textAlign: 'center' }}>
                    📅 {formatarDataBR(local.dataInicio)} até {formatarDataBR(local.dataFim)}
                  </div>
                )}

                <button
                  onClick={() => {
                    if (!local.dataInicio || !local.dataFim) return alert('Selecione as duas datas.');
                    if (local.dataInicio > local.dataFim) return alert('A data início deve ser antes da data fim.');
                    onAplicar({ ...local });
                    onFechar();
                  }}
                  style={{ ...btnSalvar, margin: 0 }}
                >
                  Aplicar período
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Overlay>
  );

  // ── TELA: FILTRAR ──
  return (
    <Overlay onFechar={onFechar}>
      <div style={{ ...sheet, maxHeight: '90%', overflowY: 'auto' }}>
        <Handle />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 16px', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Filtro de lançamentos</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={aplicar} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 20, padding: '6px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Filtrar</button>
            <button onClick={() => setTela('opcoes')} style={btnX}><X size={18} color="#666" /></button>
          </div>
        </div>

        <div style={{ padding: '0 20px 24px' }}>
          {/* Tipo */}
          <SecaoLabel label={`Tipo(${(local.tipos||[]).length})`} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {['Receitas','Despesas','Transferências','Lançamentos fixos','Lançamentos parcelados'].map(t => (
              <Chip key={t} label={t} ativo={(local.tipos||[]).includes(t)} onClick={() => toggleArr('tipos', t)} />
            ))}
          </div>

          {/* Situação */}
          <SecaoLabel label="Situação" />
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {['Resolvido','Pendente'].map(s => (
              <Chip key={s} label={s} ativo={(local.situacao||[]).includes(s)} onClick={() => toggleArr('situacao', s)} />
            ))}
          </div>

          {/* Contas */}
          <SecaoLabel label="Contas" />
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
            {contas.map(c => (
              <button key={c.id} onClick={() => toggleArr('contaIds', c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, background: (local.contaIds||[]).includes(c.id) ? '#dcfce7' : 'white', border: `1.5px solid ${(local.contaIds||[]).includes(c.id) ? '#16a34a' : '#e5e7eb'}`, borderRadius: 14, padding: '10px 16px', cursor: 'pointer', flexShrink: 0, minWidth: 130 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: c.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 11 }}>{c.icone}</div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.nome}</span>
              </button>
            ))}
          </div>

          {/* Cartões */}
          {cartoes.length > 0 && <>
            <SecaoLabel label="Cartões de crédito" />
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
              {cartoes.map(c => (
                <button key={c.id} onClick={() => toggleArr('cartaoIds', c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: (local.cartaoIds||[]).includes(c.id) ? '#ede9fe' : 'white', border: `1.5px solid ${(local.cartaoIds||[]).includes(c.id) ? '#7c3aed' : '#e5e7eb'}`, borderRadius: 14, padding: '10px 16px', cursor: 'pointer', flexShrink: 0, minWidth: 130 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: c.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 11 }}>💳</div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{c.nome}</span>
                </button>
              ))}
            </div>
          </>}

          {/* Categoria */}
          <SecaoLabel label="Categoria" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {categorias.map(c => (
              <Chip key={c.id} label={`${c.emoji} ${c.nome}`} ativo={(local.categorias||[]).includes(c.nome)} onClick={() => toggleArr('categorias', c.nome)} />
            ))}
          </div>

          <button onClick={limpar} style={{ width: '100%', background: 'none', border: '1.5px solid #e5e7eb', color: '#888', borderRadius: 12, padding: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            Limpar filtros
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onFechar }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 50 }}
      onClick={e => e.target === e.currentTarget && onFechar()}>
      {children}
    </div>
  );
}

function Handle() {
  return <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '12px auto 16px' }} />;
}

function OpcaoItem({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', background: 'none', border: 'none', padding: '16px 20px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', textAlign: 'left' }}>
      {icon}
      <span style={{ fontSize: 16, color: '#111' }}>{label}</span>
    </button>
  );
}

function SecaoLabel({ label }) {
  return <p style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 10 }}>{label}</p>;
}

function Chip({ label, ativo, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${ativo ? '#16a34a' : '#ccc'}`, background: ativo ? '#dcfce7' : 'white', color: ativo ? '#16a34a' : '#555', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
      {label}
    </button>
  );
}

function formatarDataBR(dataStr) {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

const sheet = { background: 'white', borderRadius: '24px 24px 0 0', paddingTop: 0 };
const btnX = { background: '#f3f4f6', border: 'none', borderRadius: 10, padding: 6, cursor: 'pointer', display: 'flex' };
const btnSalvar = { width: '100%', background: '#16a34a', color: 'white', border: 'none', borderRadius: 14, padding: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 16 };
const inpData = { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', background: 'white', boxSizing: 'border-box' };
