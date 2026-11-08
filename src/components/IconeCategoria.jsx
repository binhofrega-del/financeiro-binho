import { visualCategoria } from '../utils/categorias';
import { ICONES } from '../utils/iconesCategorias';

// Círculo colorido com o ícone da categoria (estilo Organizze).
// selo: 'fixo' | 'parcela' | null → bolinha preta no canto (↻ ou ÷)
export default function IconeCategoria({ nome, tipo, size = 44, selo = null, corFundoSelo = '#fdfcf8', cor: corForcada }) {
  const v = visualCategoria(nome, tipo);
  const cor = corForcada || v.cor;
  const svg = (ICONES[v.icone] || ICONES.lista).replaceAll('__COR__', cor);
  const tamSelo = Math.round(size * 0.42);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: cor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* svg estático do próprio app (utils/iconesCategorias.js) */}
        <svg viewBox="0 0 24 24" width={Math.round(size * 0.54)} height={Math.round(size * 0.54)} aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      {selo && (
        <div title={selo === 'fixo' ? 'Fixo' : 'Parcelado'}
          style={{ position: 'absolute', right: -Math.round(size * 0.13), bottom: Math.round(size * 0.2), width: tamSelo, height: tamSelo, borderRadius: '50%',
            background: '#1c1c1a', border: `2px solid ${corFundoSelo}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {selo === 'fixo' ? (
            <svg width={tamSelo * 0.6} height={tamSelo * 0.6} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Fixo">
              <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" />
            </svg>
          ) : (
            <svg width={tamSelo * 0.6} height={tamSelo * 0.6} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" role="img" aria-label="Parcelado">
              <path d="M5 12h14" /><circle cx="12" cy="6" r="1.3" fill="#fff" /><circle cx="12" cy="18" r="1.3" fill="#fff" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}
