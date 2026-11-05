import { CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import { useApp } from '../context/AppContext';

// Faixa no topo quando a sincronização precisa de atenção.
// O app continua funcionando: as alterações ficam guardadas neste aparelho.
export default function AvisoSync() {
  const { driveStatus, conectarDrive, sincronizarDrive } = useApp();

  let cfg = null;
  if (driveStatus === 'reconectar') {
    cfg = { bg: '#fef3c7', cor: '#92400e', icone: <CloudOff size={16} />, texto: 'Sessão do Google expirou. Toque para reconectar — nada se perde.', acao: conectarDrive };
  } else if (driveStatus === 'offline') {
    cfg = { bg: '#e5e7eb', cor: '#374151', icone: <WifiOff size={16} />, texto: 'Sem internet. As alterações sobem quando a conexão voltar.', acao: null };
  } else if (driveStatus === 'erro') {
    cfg = { bg: '#fee2e2', cor: '#991b1b', icone: <RefreshCw size={16} />, texto: 'Não foi possível sincronizar. Toque para tentar de novo.', acao: sincronizarDrive };
  }
  if (!cfg) return null;

  return (
    <button onClick={cfg.acao || undefined} disabled={!cfg.acao}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: cfg.bg, color: cfg.cor,
        padding: '8px 14px', fontSize: 12, fontWeight: 600, textAlign: 'left', cursor: cfg.acao ? 'pointer' : 'default', flexShrink: 0 }}>
      {cfg.icone}<span>{cfg.texto}</span>
    </button>
  );
}
