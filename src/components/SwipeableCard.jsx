import { useRef, useState } from 'react';

const SWIPE_THRESHOLD = 50;

export default function SwipeableCard({ children, acoes }) {
  const [aberto, setAberto] = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const moving = useRef(false);

  const ACAO_W = 70; // largura de cada botão
  const totalW = acoes.length * ACAO_W;

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    moving.current = false;
  }

  function onTouchEnd(e) {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - startY.current);

    // Ignora se foi scroll vertical
    if (dy > 20 && Math.abs(dx) < dy) { startX.current = null; return; }

    if (dx < -SWIPE_THRESHOLD) setAberto(true);   // swipe esquerda → abre
    if (dx > SWIPE_THRESHOLD) setAberto(false);   // swipe direita → fecha
    startX.current = null;
  }

  function fechar() { setAberto(false); }

  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>

      {/* Botões de ação — aparecem só quando aberto */}
      {aberto && (
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          display: 'flex', borderRadius: '0 14px 14px 0',
          overflow: 'hidden', zIndex: 0,
        }}>
          {acoes.map((acao, i) => (
            <button key={i}
              onTouchEnd={(e) => { e.stopPropagation(); fechar(); acao.onClick(); }}
              onClick={(e) => { e.stopPropagation(); fechar(); acao.onClick(); }}
              style={{
                width: ACAO_W, border: 'none', cursor: 'pointer',
                background: acao.cor, color: 'white',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                fontSize: 22, flexShrink: 0,
              }}>
              <span>{acao.icone}</span>
              <span style={{ fontSize: 10, fontWeight: 700 }}>{acao.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Card deslizável */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          transform: aberto ? `translateX(-${totalW}px)` : 'translateX(0)',
          transition: 'transform 0.22s ease',
          position: 'relative', zIndex: 1,
          borderRadius: 14,
          background: 'white',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
        {children}
      </div>

      {/* Toque fora para fechar */}
      {aberto && (
        <div
          onTouchEnd={fechar}
          onClick={fechar}
          style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
      )}
    </div>
  );
}
