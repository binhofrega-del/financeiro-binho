import { useRef, useState } from 'react';

export default function SwipeableCard({ children, acoes }) {
  const [aberto, setAberto] = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const ACAO_W = 72;
  const totalW = acoes.length * ACAO_W;

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }

  function onTouchEnd(e) {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - startY.current);
    if (dy > Math.abs(dx)) return; // scroll vertical, ignora
    if (dx < -40) setAberto(true);
    else if (dx > 40) setAberto(false);
    startX.current = null;
  }

  return (
    <div style={{ marginBottom: 8, borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
      {/* Row com card + botões lado a lado */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          display: 'flex',
          transform: aberto ? `translateX(-${totalW}px)` : 'translateX(0)',
          transition: 'transform 0.22s ease',
          width: `calc(100% + ${totalW}px)`,
        }}>

        {/* Conteúdo principal */}
        <div style={{ width: '100%', flexShrink: 0, background: 'white', borderRadius: 14 }}
          onClick={() => aberto && setAberto(false)}>
          {children}
        </div>

        {/* Botões de ação */}
        {acoes.map((acao, i) => (
          <button key={i}
            style={{
              width: ACAO_W, flexShrink: 0, border: 'none', cursor: 'pointer',
              background: acao.cor, color: 'white',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              fontSize: 22, touchAction: 'manipulation',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setAberto(false);
              acao.onClick();
            }}>
            <span>{acao.icone}</span>
            <span style={{ fontSize: 10, fontWeight: 700 }}>{acao.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
