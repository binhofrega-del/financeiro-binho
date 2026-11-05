import { useState } from 'react';
import { X, Upload, Download, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatarMoeda } from '../utils/formatters';
import { converterOrganizze } from '../utils/importOrganizze';
import { baixarBackup, lerBackup } from '../utils/backup';

const fmtData = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export default function ImportarScreen({ onVoltar }) {
  const { dados, cartoes, driveStatus, substituirDados } = useApp();
  const [diaFechamento, setDiaFechamento] = useState(30);
  const [diaVencimento, setDiaVencimento] = useState(7);
  const [arquivo, setArquivo] = useState(null);
  const [estado, setEstado] = useState('inicio'); // inicio | lendo | previa | importado | erro
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);
  const [msgRestaurar, setMsgRestaurar] = useState('');

  const driveOk = ['sincronizado', 'sincronizando', 'pendente', 'iniciando'].includes(driveStatus);

  async function ler(file = arquivo) {
    if (!file) return;
    setArquivo(file);
    setEstado('lendo');
    setErro('');
    try {
      const XLSX = await import('xlsx'); // carregado só nesta tela
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const abas = Object.fromEntries(wb.SheetNames.map((n) => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '' })]));
      const r = converterOrganizze(abas, {
        existentes: { contas: dados.contas || [], cartoes: cartoes || [] },
        cartao: { diaFechamento: Number(diaFechamento) || 30, diaVencimento: Number(diaVencimento) || 7 },
      });
      if (r.dados.lancamentos.length === 0) throw new Error('Nenhum lançamento encontrado. Confira se é o arquivo exportado do Organizze.');
      setResultado(r);
      setEstado('previa');
    } catch (e) {
      setErro(e.message || String(e));
      setEstado('erro');
    }
  }

  function importar() {
    if (!resultado) return;
    if (!window.confirm('Isto APAGA todos os dados atuais do app e coloca os do Organizze no lugar. Um backup será baixado antes. Continuar?')) return;
    baixarBackup(dados, 'antes-importacao');
    substituirDados(resultado.dados);
    setEstado('importado');
  }

  async function restaurar(file) {
    if (!file) return;
    setMsgRestaurar('');
    try {
      const novos = await lerBackup(file);
      const resumo = `${novos.lancamentos.length} lançamentos, ${novos.contas.length} contas e ${novos.cartoes.length} cartão(ões)`;
      if (!window.confirm(`Restaurar este backup (${resumo})? Os dados atuais serão substituídos (um backup deles será baixado antes).`)) return;
      baixarBackup(dados, 'antes-restauracao');
      substituirDados(novos);
      setMsgRestaurar(`✓ Backup restaurado: ${resumo}.`);
    } catch (e) {
      setMsgRestaurar(`⚠ ${e.message || e}`);
    }
  }

  const rel = resultado?.relatorio;

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f3f4f6' }}>
      <div style={header}>
        <button onClick={onVoltar} style={backBtn}><X size={20} /></button>
        <h2 style={headerTitle}>Importar e backup</h2>
        <div style={{ width: 32 }} />
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!driveOk && (
          <Aviso cor="#d97706" bg="#fef3c7">
            O Google Drive não está conectado. A importação ficaria só neste aparelho — conecte o Drive na Home antes.
          </Aviso>
        )}

        {/* ── Importar do Organizze ── */}
        <div style={card}>
          <p style={titulo}>Importar do Organizze</p>
          <p style={texto}>
            Escolha o arquivo <b>.xls</b> exportado do Organizze (todas as contas e cartões). Nada é alterado até você confirmar.
          </p>

          <p style={{ ...texto, fontWeight: 600, marginTop: 12 }}>Cartão de crédito</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <label style={{ flex: 1 }}>
              <span style={lbl}>Fecha dia</span>
              <input type="number" min="1" max="31" value={diaFechamento} onChange={(e) => setDiaFechamento(e.target.value)} style={inp} />
            </label>
            <label style={{ flex: 1 }}>
              <span style={lbl}>Vence dia</span>
              <input type="number" min="1" max="31" value={diaVencimento} onChange={(e) => setDiaVencimento(e.target.value)} style={inp} />
            </label>
          </div>

          <label style={{ ...btnPrim, marginTop: 14, opacity: estado === 'lendo' ? 0.6 : 1 }}>
            <Upload size={18} /> {estado === 'lendo' ? 'Lendo arquivo…' : arquivo ? 'Escolher outro arquivo' : 'Escolher arquivo .xls'}
            <input type="file" accept=".xls,.xlsx" style={{ display: 'none' }}
              onChange={(e) => { ler(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {arquivo && estado === 'previa' && (
            <button onClick={() => ler()} style={btnSec}><RotateCcw size={14} /> Ler de novo com os dias acima</button>
          )}
          {estado === 'erro' && <Aviso cor="#dc2626" bg="#fee2e2">{erro}</Aviso>}
        </div>

        {/* ── Prévia ── */}
        {rel && estado !== 'inicio' && (
          <div style={card}>
            <p style={titulo}>Prévia da importação</p>
            {rel.periodo && <p style={texto}>De {fmtData(rel.periodo.de)} até {fmtData(rel.periodo.ate)}</p>}

            <div style={grade}>
              <Num n={rel.lancamentos} l="lançamentos" />
              <Num n={rel.fixos} l="fixos (todo mês)" />
              <Num n={rel.gruposParcelas} l="compras parceladas" />
              <Num n={rel.transferencias} l="transferências" />
              <Num n={rel.pagamentosVinculados} l="faturas pagas" />
              <Num n={rel.categorias} l="categorias" />
            </div>

            <p style={{ ...texto, fontWeight: 700, marginTop: 14 }}>Saldos das contas (hoje)</p>
            {rel.conferenciaContas.map((c) => (
              <Linha key={c.nome} ok={c.ok} rotulo={c.nome} valor={formatarMoeda(c.app)}
                detalhe={c.ok ? 'igual ao Organizze' : `Organizze: ${formatarMoeda(c.esperado)}`} />
            ))}

            {rel.conferenciaCartoes.map((c) => (
              <div key={c.nome}>
                <p style={{ ...texto, fontWeight: 700, marginTop: 14 }}>Faturas — {c.nome}</p>
                {c.faturas.map((f) => (
                  <Linha key={f.nome} ok={Math.abs(f.app - f.esperado) < 0.01} rotulo={f.nome} valor={formatarMoeda(f.app)}
                    detalhe={f.paga ? 'paga' : 'em aberto'} />
                ))}
              </div>
            ))}

            {rel.avisos.length > 0 && (
              <Aviso cor="#dc2626" bg="#fee2e2">
                {rel.avisos.map((a) => <div key={a}>• {a}</div>)}
              </Aviso>
            )}

            {estado === 'previa' && (
              <>
                <Aviso cor="#92400e" bg="#fef3c7">
                  <b>Antes de importar:</b> feche o app no iPhone (e em outros aparelhos). Depois de importar, abra de novo
                  para ele carregar os dados novos do Drive.
                </Aviso>
                <button onClick={importar} style={{ ...btnPrim, background: '#dc2626', marginTop: 12 }}>
                  <Download size={18} /> Baixar backup e importar
                </button>
              </>
            )}
            {estado === 'importado' && (
              <Aviso cor="#15803d" bg="#dcfce7">
                <b>Importação concluída!</b> O backup dos dados antigos foi baixado.
                {driveOk ? ' Os dados novos estão sendo salvos no Drive.' : ' Conecte o Drive para salvar na nuvem.'}
              </Aviso>
            )}
          </div>
        )}

        {/* ── Backup ── */}
        <div style={card}>
          <p style={titulo}>Backup</p>
          <p style={texto}>Baixe uma cópia de todos os dados ou restaure uma cópia baixada antes.</p>
          <button onClick={() => baixarBackup(dados, 'manual')} style={{ ...btnPrim, background: '#1d4ed8', marginTop: 12 }}>
            <Download size={18} /> Baixar backup agora
          </button>
          <label style={{ ...btnSec, marginTop: 10 }}>
            <RotateCcw size={14} /> Restaurar um backup (.json)
            <input type="file" accept=".json,application/json" style={{ display: 'none' }}
              onChange={(e) => { restaurar(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {msgRestaurar && <p style={{ ...texto, marginTop: 8 }}>{msgRestaurar}</p>}
        </div>
      </div>
    </div>
  );
}

function Num({ n, l }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
      <p style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{n.toLocaleString('pt-BR')}</p>
      <p style={{ fontSize: 11, color: '#888' }}>{l}</p>
    </div>
  );
}

function Linha({ ok, rotulo, valor, detalhe }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
      {ok ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertTriangle size={16} color="#dc2626" />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{rotulo}</p>
        <p style={{ fontSize: 11, color: ok ? '#9ca3af' : '#dc2626' }}>{detalhe}</p>
      </div>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#1d4ed8' }}>{valor}</p>
    </div>
  );
}

function Aviso({ children, cor, bg }) {
  return <div style={{ background: bg, color: cor, borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.45, marginTop: 10 }}>{children}</div>;
}

const header = { background: '#16a34a', padding: '16px 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const headerTitle = { color: 'white', fontSize: 20, fontWeight: 700 };
const backBtn = { background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'white', display: 'flex' };
const card = { background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };
const titulo = { fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 4 };
const texto = { fontSize: 13, color: '#555', lineHeight: 1.45 };
const lbl = { fontSize: 12, color: '#888', fontWeight: 600, display: 'block', marginBottom: 4 };
const inp = { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 15, outline: 'none', background: 'white', boxSizing: 'border-box' };
const grade = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 };
const btnPrim = { width: '100%', background: '#16a34a', color: 'white', border: 'none', borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box' };
const btnSec = { width: '100%', background: 'none', color: '#16a34a', border: '1.5px solid #16a34a', borderRadius: 12, padding: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, boxSizing: 'border-box' };
