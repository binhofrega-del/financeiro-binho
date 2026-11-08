import { Home, ArrowLeftRight, CreditCard, Settings } from 'lucide-react';

// Barra de abas no estilo do Organizze: só ícones, a aba ativa em verde.
const abas = [
  { id: 'home', label: 'Início', Icon: Home },
  { id: 'fluxo', label: 'Fluxo de caixa', Icon: ArrowLeftRight },
  { id: 'cartoes', label: 'Cartões', Icon: CreditCard },
  { id: 'config', label: 'Configurações', Icon: Settings },
];

export default function BottomNav({ aba, setAba }) {
  return (
    <nav aria-label="Navegação principal" style={{
      display: 'flex',
      justifyContent: 'space-around',
      background: '#fdfcf8',
      borderTop: '1px solid #ecebe5',
      paddingBottom: 'env(safe-area-inset-bottom)',
      flexShrink: 0,
    }}>
      {abas.map(({ id, label, Icon }) => {
        const ativo = aba === id;
        return (
          <button
            key={id}
            onClick={() => setAba(id)}
            aria-label={label}
            title={label}
            aria-current={ativo ? 'page' : undefined}
            style={{
              flex: 1,
              height: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: ativo ? '#1fae55' : '#1c1c1a',
            }}
          >
            <Icon size={28} strokeWidth={ativo ? 2.2 : 1.7} />
          </button>
        );
      })}
    </nav>
  );
}
