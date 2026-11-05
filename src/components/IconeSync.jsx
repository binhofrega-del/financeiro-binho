import { Cloud, CloudOff, RefreshCw, Loader, CloudUpload, WifiOff } from 'lucide-react';

// Ícone do estado da sincronização (Home e Configurações)
export default function IconeSync({ status, size = 16 }) {
  if (status === 'iniciando') return <Loader size={size} style={{ opacity: 0.6 }} />;
  if (status === 'sincronizando') return <RefreshCw size={size} style={{ animation: 'spin 1s linear infinite' }} />;
  if (status === 'sincronizado') return <Cloud size={size} color="#86efac" />;
  if (status === 'pendente') return <CloudUpload size={size} color="#fde68a" />;
  if (status === 'offline') return <WifiOff size={size} color="#e5e7eb" />;
  if (status === 'reconectar') return <CloudOff size={size} color="#fde68a" />;
  if (status === 'erro') return <CloudOff size={size} color="#fca5a5" />;
  return <CloudOff size={size} />;
}
