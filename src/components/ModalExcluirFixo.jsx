import { Trash2 } from 'lucide-react';

export default function ModalExcluirFixo({ lanc, onSoEste, onTodosProximos, onCancelar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, textAlign: 'center' }}>

        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Trash2 size={26} color="#dc2626" />
        </div>

        <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 8 }}>
          Excluir despesa fixa
        </h3>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
          <strong>{lanc.descricao}</strong>
        </p>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 24, lineHeight: 1.5 }}>
          O que você deseja excluir?
        </p>

        {/* Só este mês */}
        <button onClick={onSoEste}
          style={{ width: '100%', border: '1.5px solid #e5e7eb', background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', textAlign: 'left' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>🗑 Excluir só este mês</p>
          <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            Remove apenas este mês, os demais continuam
          </p>
        </button>

        {/* Este e todos os próximos */}
        <button onClick={onTodosProximos}
          style={{ width: '100%', border: '1.5px solid #dc2626', background: '#fee2e2', borderRadius: 14, padding: '14px 16px', marginBottom: 16, cursor: 'pointer', textAlign: 'left' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>🗑 Excluir este e todos os próximos</p>
          <p style={{ fontSize: 12, color: '#dc2626', opacity: 0.8, marginTop: 2 }}>
            Remove o lançamento fixo permanentemente
          </p>
        </button>

        <button onClick={onCancelar}
          style={{ width: '100%', border: 'none', background: '#f3f4f6', borderRadius: 12, padding: 12, cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#666' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
