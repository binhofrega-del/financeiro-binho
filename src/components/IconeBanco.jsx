import { logoParaBanco } from '../utils/formatters';

// Mostra o logo do banco se disponível, senão mostra as iniciais com fundo colorido
export default function IconeBanco({ nome, icone, cor, size = 38 }) {
  const logo = logoParaBanco(nome);

  if (logo) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        overflow: 'hidden', flexShrink: 0,
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        background: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img src={logo} alt={nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: cor || '#888',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 700,
      fontSize: size < 36 ? 10 : 12,
      flexShrink: 0,
    }}>
      {icone}
    </div>
  );
}
