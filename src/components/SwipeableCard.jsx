// Ações rápidas sempre visíveis à direita do card — funciona em qualquer dispositivo
export default function SwipeableCard({ children, acoes }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', marginBottom: 8, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {/* Conteúdo principal */}
      <div style={{ flex: 1, background: 'white', minWidth: 0 }}>
        {children}
      </div>
      {/* Botões de ação */}
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {acoes.map((acao, i) => (
          <button key={i} onClick={(e) => { e.stopPropagation(); acao.onClick(); }}
            style={{
              flex: 1, width: 52, border: 'none', cursor: 'pointer',
              background: acao.cor, color: 'white',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
              fontSize: 18, touchAction: 'manipulation',
              borderLeft: '1px solid rgba(255,255,255,0.15)',
            }}>
            <span>{acao.icone}</span>
            <span style={{ fontSize: 9, fontWeight: 700 }}>{acao.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
