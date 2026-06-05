import { useRef, useState } from 'react';

const SWIPE_THRESHOLD = 60;  // px para ativar
const ACTION_WIDTH = 220;    // largura total dos botões revelados

export default function SwipeableCard({ children, acoes, disabled }) {
  const [offset, setOffset] = useState(0);
  const [aberto, setAberto] = useState(false);
  const startX = useRef(null);
  const startOffset = useRef(0);
  const cardRef = useRef(null);

  if (disabled) return <div>{children}</div>;

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX;
    startOffset.current = offset;
  }

  function onTouchMove(e) {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const novoOffset = Math.max(-ACTION_WIDTH, Math.min(0, startOffset.current + dx));
    setOffset(novoOffset);
  }

  function onTouchEnd() {
    if (Math.abs(offset) > SWIPE_THRESHOLD) {
      setOffset(-ACTION_WIDTH);
      setAberto(true);
    } else {
      setOffset(0);
      setAberto(false);
    }
    startX.current = null;
  }

  function fechar() {
    setOffset(0);
    setAberto(false);
  }

  return (
    <div ref={cardRef} style={{ position: 'relative', overflow: 'hidden', borderRadius: 14, marginBottom: 8 }}>
      {/* Botões de ação revelados */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        display: 'flex', alignItems: 'stretch',
        width: ACTION_WIDTH,
      }}>
        {acoes.map((acao, i) => (
          <button key={i} onClick={() => { fechar(); acao.onClick(); }}
            style={{
              flex: 1, border: 'none', cursor: 'pointer',
              background: acao.cor, color: 'white',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              fontSize: 22,
            }}>
            <span>{acao.icone}</span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{acao.label}</span>
          </button>
        ))}
      </div>

      {/* Card deslizável */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={aberto ? fechar : undefined}
        style={{
          transform: `translateX(${offset}px)`,
          transition: startX.current ? 'none' : 'transform 0.25s ease',
          position: 'relative', zIndex: 1,
          background: 'white',
          borderRadius: 14,
        }}>
        {children}
      </div>

      {/* Overlay para fechar ao clicar fora */}
      {aberto && (
        <div onClick={fechar}
          style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
      )}
    </div>
  );
}
