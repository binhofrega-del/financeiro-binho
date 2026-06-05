export default function ConfirmarExclusao({ mensagem, onConfirmar, onCancelar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 24, width: '100%', maxWidth: 320, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 8 }}>Excluir lançamento?</h3>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>{mensagem || 'Esta ação não pode ser desfeita.'}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancelar}
            style={{ flex: 1, border: '1.5px solid #e5e7eb', background: 'white', borderRadius: 12, padding: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#666' }}>
            Cancelar
          </button>
          <button onClick={onConfirmar}
            style={{ flex: 1, border: 'none', background: '#dc2626', color: 'white', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
