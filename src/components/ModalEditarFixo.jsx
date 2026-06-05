import { Pencil } from 'lucide-react';

export default function ModalEditarFixo({ lanc, onSoEste, onTodosProximos, onCancelar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, textAlign: 'center' }}>

        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Pencil size={26} color="#7c3aed" />
        </div>

        <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 8 }}>
          Editar despesa fixa
        </h3>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
          <strong>{lanc.descricao}</strong>
        </p>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 24, lineHeight: 1.5 }}>
          O que você deseja alterar?
        </p>

        {/* Opção 1: só este mês */}
        <button onClick={onSoEste}
          style={{ width: '100%', border: '1.5px solid #e5e7eb', background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', textAlign: 'left' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>✏️ Alterar só este lançamento</p>
          <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            Cria uma versão única para este mês, sem afetar os demais
          </p>
        </button>

        {/* Opção 2: todos os próximos */}
        <button onClick={onTodosProximos}
          style={{ width: '100%', border: '1.5px solid #7c3aed', background: '#ede9fe', borderRadius: 14, padding: '14px 16px', marginBottom: 16, cursor: 'pointer', textAlign: 'left' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#7c3aed' }}>🔁 Alterar este e todos os próximos</p>
          <p style={{ fontSize: 12, color: '#7c3aed', opacity: 0.8, marginTop: 2 }}>
            Atualiza o lançamento fixo original
          </p>
        </button>

        {/* Cancelar */}
        <button onClick={onCancelar}
          style={{ width: '100%', border: 'none', background: '#f3f4f6', borderRadius: 12, padding: 12, cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#666' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
