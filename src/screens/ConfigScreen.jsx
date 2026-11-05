import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, CreditCard, Wallet, ChevronRight, Upload } from 'lucide-react';
import ImportarScreen from './ImportarScreen';
import IconeSync from '../components/IconeSync';
import { ROTULO_SYNC } from '../utils/rotulosSync';
import { useApp } from '../context/AppContext';
import { VERSAO, BUILD_DATA, BUILD_COMMIT } from '../utils/versao';
import { formatarMoeda } from '../utils/formatters';

const CORES = ['#e11d48','#16a34a','#1d4ed8','#7c3aed','#f97316','#000000','#0891b2','#ca8a04','#6b7280','#22c55e'];

const contaVazia = { nome: '', tipo: 'Conta corrente', cor: '#16a34a', icone: '', saldo: '' };
const cartaoVazio = { nome: '', banco: '', cor: '#7c3aed', limite: '', diaVencimento: '', diaFechamento: '' };

export default function ConfigScreen() {
  const { contas, cartoes, adicionarConta, editarConta, removerConta, adicionarCartao, editarCartao, removerCartao,
    driveStatus, ultimaSync, conectarDrive, sincronizarDrive, desconectarDrive } = useApp();
  const [secao, setSecao] = useState('principal'); // principal | contas | cartoes | novaConta | novoCartao | editConta | editCartao
  const [form, setForm] = useState({});
  const [editId, setEditId] = useState(null);

  function abrirNovaConta() { setForm({ ...contaVazia }); setSecao('novaConta'); }
  function abrirEditConta(c) { setForm({ ...c }); setEditId(c.id); setSecao('editConta'); }
  function salvarConta() {
    if (!form.nome) return;
    const dados = { ...form, saldo: parseFloat(form.saldo) || 0 };
    if (secao === 'novaConta') adicionarConta(dados);
    else editarConta(editId, dados);
    setSecao('contas');
  }

  function abrirNovoCartao() { setForm({ ...cartaoVazio }); setSecao('novoCartao'); }
  function abrirEditCartao(c) { setForm({ ...c }); setEditId(c.id); setSecao('editCartao'); }
  function salvarCartao() {
    if (!form.nome) return;
    const dados = { ...form, limite: parseFloat(form.limite) || 0, diaVencimento: parseInt(form.diaVencimento) || 1, diaFechamento: parseInt(form.diaFechamento) || 1 };
    if (secao === 'novoCartao') adicionarCartao(dados);
    else editarCartao(editId, dados);
    setSecao('cartoes');
  }

  if (secao === 'importar') return <ImportarScreen onVoltar={() => setSecao('principal')} />;

  // TELA PRINCIPAL
  if (secao === 'principal') return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f3f4f6' }}>
      <div style={header}><h2 style={headerTitle}>Configurações</h2></div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

        <MenuItem icon={<Wallet size={20} color="#16a34a" />} label="Minhas Contas" sub={`${contas.length} conta(s)`} onClick={() => setSecao('contas')} />
        <MenuItem icon={<CreditCard size={20} color="#7c3aed" />} label="Cartões de Crédito" sub={`${cartoes.length} cartão(ões)`} onClick={() => setSecao('cartoes')} />
        <MenuItem icon={<Upload size={20} color="#1d4ed8" />} label="Importar e backup" sub="Importar do Organizze · baixar/restaurar backup" onClick={() => setSecao('importar')} />

        {/* Sincronização com o Google Drive */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconeSync status={driveStatus} size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{ROTULO_SYNC[driveStatus] || driveStatus}</p>
              <p style={{ fontSize: 11, color: '#9ca3af' }}>
                {ultimaSync ? `Última sincronização: ${new Date(ultimaSync).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'Ainda não sincronizado neste aparelho'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {driveStatus === 'reconectar' || driveStatus === 'desconectado' ? (
              <button onClick={conectarDrive} style={{ ...btnSync, background: '#16a34a', color: 'white', border: 'none' }}>Conectar Google</button>
            ) : (
              <button onClick={sincronizarDrive} style={btnSync}>Sincronizar agora</button>
            )}
            {driveStatus !== 'desconectado' && (
              <button onClick={() => { if (confirm('Desconectar do Google Drive? Os dados continuam neste aparelho.')) desconectarDrive(); }} style={{ ...btnSync, color: '#dc2626', borderColor: '#fecaca' }}>Desconectar</button>
            )}
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 10, lineHeight: 1.4 }}>
            Backup automático: uma cópia por dia no seu Google Drive (últimas 15).
          </p>
        </div>

        <div style={{ ...card, marginTop: 8 }}>
          <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center' }}>Controle Financeiro Pessoal</p>
          <p style={{ fontSize: 13, color: '#16a34a', fontWeight: 700, textAlign: 'center', marginTop: 4 }}>v{VERSAO}</p>
          <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 2 }}>
            Atualizado em {BUILD_DATA}{BUILD_COMMIT ? ` · ${BUILD_COMMIT}` : ''}
          </p>
        </div>
      </div>
    </div>
  );

  // LISTA CONTAS
  if (secao === 'contas') return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f3f4f6' }}>
      <div style={header}>
        <button onClick={() => setSecao('principal')} style={backBtn}><X size={20} /></button>
        <h2 style={headerTitle}>Minhas Contas</h2>
        <button onClick={abrirNovaConta} style={addBtn}><Plus size={20} /></button>
      </div>
      <div style={{ padding: 16 }}>
        <div style={card}>
          {contas.map((c, i) => (
            <div key={c.id} style={{ ...rowStyle, borderBottom: i < contas.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ ...iconeStyle, background: c.cor }}>{c.icone}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600 }}>{c.nome}</p>
                <p style={{ fontSize: 11, color: '#aaa' }}>{c.tipo}</p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1d4ed8', marginRight: 12 }}>{formatarMoeda(c.saldo)}</p>
              <button onClick={() => abrirEditConta(c)} style={iconBtn}><Pencil size={15} color="#888" /></button>
              <button onClick={() => { if (confirm('Remover conta?')) removerConta(c.id); }} style={iconBtn}><Trash2 size={15} color="#dc2626" /></button>
            </div>
          ))}
        </div>
        <button onClick={abrirNovaConta} style={btnAdd}>+ Adicionar Conta</button>
      </div>
    </div>
  );

  // LISTA CARTÕES
  if (secao === 'cartoes') return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f3f4f6' }}>
      <div style={header}>
        <button onClick={() => setSecao('principal')} style={backBtn}><X size={20} /></button>
        <h2 style={headerTitle}>Cartões de Crédito</h2>
        <button onClick={abrirNovoCartao} style={addBtn}><Plus size={20} /></button>
      </div>
      <div style={{ padding: 16 }}>
        {cartoes.map(c => (
          <div key={c.id} style={{ ...card, marginBottom: 12 }}>
            <div style={{ background: `linear-gradient(135deg, ${c.cor}, #7c3aed)`, borderRadius: 12, padding: 16, color: 'white', marginBottom: 10 }}>
              <p style={{ fontSize: 11, opacity: 0.7 }}>{c.banco}</p>
              <p style={{ fontSize: 17, fontWeight: 700 }}>{c.nome}</p>
              <p style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>Limite: {formatarMoeda(c.limite)}</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 12, color: '#888' }}>Vence dia {c.diaVencimento} · Fecha dia {c.diaFechamento}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => abrirEditCartao(c)} style={iconBtn}><Pencil size={15} color="#888" /></button>
                <button onClick={() => { if (confirm('Remover cartão?')) removerCartao(c.id); }} style={iconBtn}><Trash2 size={15} color="#dc2626" /></button>
              </div>
            </div>
          </div>
        ))}
        <button onClick={abrirNovoCartao} style={btnAdd}>+ Adicionar Cartão</button>
      </div>
    </div>
  );

  // FORM CONTA
  if (secao === 'novaConta' || secao === 'editConta') return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f3f4f6' }}>
      <div style={header}>
        <button onClick={() => setSecao('contas')} style={backBtn}><X size={20} /></button>
        <h2 style={headerTitle}>{secao === 'novaConta' ? 'Nova Conta' : 'Editar Conta'}</h2>
        <button onClick={salvarConta} style={addBtn}><Check size={20} /></button>
      </div>
      <div style={{ padding: 16 }}>
        <div style={card}>
          <FormField label="Nome da Conta" value={form.nome} onChange={v => setForm(f => ({ ...f, nome: v }))} placeholder="Ex: Nubank, Itaú..." />
          <FormField label="Ícone (2 letras)" value={form.icone} onChange={v => setForm(f => ({ ...f, icone: v.slice(0,2).toUpperCase() }))} placeholder="Ex: NU, BB" />
          <FormField label="Tipo" value={form.tipo} onChange={v => setForm(f => ({ ...f, tipo: v }))} tipo="select" opcoes={['Conta corrente','Conta poupança','Conta digital','Carteira','Outro']} />
          <FormField label="Saldo Inicial (R$)" value={form.saldo} onChange={v => setForm(f => ({ ...f, saldo: v }))} placeholder="0,00" tipo="number" />
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Cor</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {CORES.map(cor => (
                <div key={cor} onClick={() => setForm(f => ({ ...f, cor }))}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: cor, cursor: 'pointer', border: form.cor === cor ? '3px solid #111' : '2px solid transparent' }} />
              ))}
            </div>
          </div>
        </div>
        <button onClick={salvarConta} style={btnSalvar}>Salvar Conta</button>
      </div>
    </div>
  );

  // FORM CARTÃO
  if (secao === 'novoCartao' || secao === 'editCartao') return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f3f4f6' }}>
      <div style={header}>
        <button onClick={() => setSecao('cartoes')} style={backBtn}><X size={20} /></button>
        <h2 style={headerTitle}>{secao === 'novoCartao' ? 'Novo Cartão' : 'Editar Cartão'}</h2>
        <button onClick={salvarCartao} style={addBtn}><Check size={20} /></button>
      </div>
      <div style={{ padding: 16 }}>
        {/* Preview cartão */}
        <div style={{ background: `linear-gradient(135deg, ${form.cor || '#7c3aed'}, #1d4ed8)`, borderRadius: 16, padding: 20, color: 'white', marginBottom: 16 }}>
          <p style={{ fontSize: 12, opacity: 0.7 }}>{form.banco || 'Banco'}</p>
          <p style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{form.nome || 'Nome do Cartão'}</p>
          <p style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>Limite: {formatarMoeda(parseFloat(form.limite) || 0)}</p>
        </div>
        <div style={card}>
          <FormField label="Nome do Cartão" value={form.nome} onChange={v => setForm(f => ({ ...f, nome: v }))} placeholder="Ex: Nubank Roxinho" />
          <FormField label="Banco / Emissor" value={form.banco} onChange={v => setForm(f => ({ ...f, banco: v }))} placeholder="Ex: Nubank, Itaú" />
          <FormField label="Limite (R$)" value={form.limite} onChange={v => setForm(f => ({ ...f, limite: v }))} placeholder="5000" tipo="number" />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <FormField label="Dia Vencimento" value={form.diaVencimento} onChange={v => setForm(f => ({ ...f, diaVencimento: v }))} placeholder="15" tipo="number" />
            </div>
            <div style={{ flex: 1 }}>
              <FormField label="Dia Fechamento" value={form.diaFechamento} onChange={v => setForm(f => ({ ...f, diaFechamento: v }))} placeholder="8" tipo="number" />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Cor do Cartão</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {CORES.map(cor => (
                <div key={cor} onClick={() => setForm(f => ({ ...f, cor }))}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: cor, cursor: 'pointer', border: form.cor === cor ? '3px solid #111' : '2px solid transparent' }} />
              ))}
            </div>
          </div>
        </div>
        <button onClick={salvarCartao} style={btnSalvar}>Salvar Cartão</button>
      </div>
    </div>
  );

  return null;
}

function MenuItem({ icon, label, sub, onClick }) {
  return (
    <button onClick={onClick} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{label}</p>
        <p style={{ fontSize: 12, color: '#aaa' }}>{sub}</p>
      </div>
      <ChevronRight size={18} color="#ccc" />
    </button>
  );
}

function FormField({ label, value, onChange, placeholder, tipo = 'text', opcoes }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {tipo === 'select' ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
          {opcoes.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={tipo} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} style={inputStyle} />
      )}
    </div>
  );
}

const header = { background: '#16a34a', padding: '16px 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const headerTitle = { color: 'white', fontSize: 20, fontWeight: 700 };
const backBtn = { background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'white', display: 'flex' };
const addBtn = { background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'white', display: 'flex' };
const card = { background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };
const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' };
const iconeStyle = { width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0 };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' };
const btnSync = { flex: 1, background: 'white', color: '#16a34a', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '9px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const btnAdd = { width: '100%', border: '1.5px dashed #16a34a', background: 'none', color: '#16a34a', borderRadius: 12, padding: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginTop: 12 };
const btnSalvar = { width: '100%', background: '#16a34a', color: 'white', border: 'none', borderRadius: 14, padding: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 12 };
const labelStyle = { fontSize: 12, color: '#888', fontWeight: 600, display: 'block', marginBottom: 4 };
const inputStyle = { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 15, outline: 'none', background: 'white', boxSizing: 'border-box' };
