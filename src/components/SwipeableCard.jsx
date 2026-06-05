import { useRef, useState } from 'react';

const SWIPE_THRESHOLD = 50;

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
    if (dy > Math.abs(dx)) { startX.current = null; return; }
    if (dx < -SWIPE_THRESHOLD) setAberto(true);
    else if (dx > SWIPE_THRESHOLD) setAberto(false);
    startX.current = null;
  }

  function fechar() { setAberto(false); }

  function handleAcao(e, onClick) {
    e.stopPropagation();
    e.preventDefault();
    fechar();
    // pequeno delay para o card fechar antes de executar
    setTimeout(() => onClick(), 50);
  }

  return (
    <div style={{ position: 'relative', marginBottom: 8, borderRadius: 14, overflow: 'hidden' }}>

      {/* Botões revelados ao fundo */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: totalW,
        display: 'flex',
      }}>
        {acoes.map((acao, i) => (
          <button key={i}
            onPointerUp={(e) => handleAcao(e, acao.onClick)}
            style={{
              flex: 1, border: 'none', cursor: 'pointer',
              background: acao.cor, color: 'white',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              fontSize: 24,
            }}>
            <span>{acao.icone}</span>
            <span style={{ fontSize: 10, fontWeight: 700 }}>{acao.label}</span>
          </button>
        ))}
      </div>

      {/* Card deslizável */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          transform: aberto ? `translateX(-${totalW}px)` : 'translateX(0)',
          transition: 'transform 0.22s ease',
          position: 'relative', zIndex: 1,
          borderRadius: 14, background: 'white',
        }}>
        {children}
      </div>

      {/* Overlay para fechar */}
      {aberto && (
        <div
          onPointerUp={fechar}
          style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
      )}
    </div>
  );
}
