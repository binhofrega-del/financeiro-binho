import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { aoTerNovaVersao, atualizarAgora } from '../utils/pwa';

// Faixa "Nova versão disponível" quando um deploy novo foi baixado em segundo plano
export default function AvisoAtualizacao() {
  const [nova, setNova] = useState(false);
  useEffect(() => aoTerNovaVersao(setNova), []);
  if (!nova) return null;
  return (
    <button onClick={atualizarAgora}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: '#1d4ed8', color: 'white',
        padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
      <Sparkles size={16} /> Nova versão disponível — toque para atualizar
    </button>
  );
}
