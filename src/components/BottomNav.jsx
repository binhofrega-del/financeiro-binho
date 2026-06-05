import { Home, ArrowLeftRight, CreditCard, Settings } from 'lucide-react';

const abas = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'fluxo', label: 'Fluxo', Icon: ArrowLeftRight },
  { id: 'cartoes', label: 'Cartões', Icon: CreditCard },
  { id: 'config', label: 'Config', Icon: Settings },
];

export default function BottomNav({ aba, setAba }) {
  return (
    <nav style={{
      display: 'flex',
      background: 'white',
      borderTop: '1px solid #e5e7eb',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {abas.map(({ id, label, Icon }) => {
        const ativo = aba === id;
        return (
          <button
            key={id}
            onClick={() => setAba(id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '10px 4px 12px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: ativo ? '#16a34a' : '#9ca3af',
            }}
          >
            <Icon size={22} strokeWidth={ativo ? 2.5 : 1.8} />
            <span style={{ fontSize: 10, fontWeight: ativo ? 700 : 500 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
