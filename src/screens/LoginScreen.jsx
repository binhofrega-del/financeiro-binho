import { Cloud } from 'lucide-react';

export default function LoginScreen({ onLogin, status }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100dvh',
      background: 'linear-gradient(160deg, #111 0%, #1a2e1a 100%)',
      padding: 32,
    }}>
      {/* Logo */}
      <img src="/icon.svg" alt="Logo" style={{ width: 100, height: 100, borderRadius: 24, marginBottom: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} />

      <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, marginBottom: 6 }}>
        Financeiro Binho
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 48, textAlign: 'center' }}>
        Controle financeiro pessoal e privado
      </p>

      {/* Botão Google */}
      <button onClick={onLogin} disabled={status === 'sincronizando'}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'white', border: 'none', borderRadius: 14,
          padding: '14px 28px', cursor: 'pointer',
          fontSize: 15, fontWeight: 700, color: '#333',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          opacity: status === 'sincronizando' ? 0.7 : 1,
          width: '100%', maxWidth: 300, justifyContent: 'center',
        }}>
        {/* Logo Google */}
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        {status === 'sincronizando' ? 'Conectando...' : 'Entrar com Google'}
      </button>

      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Cloud size={14} color="rgba(255,255,255,0.3)" />
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          Dados salvos no seu Google Drive
        </p>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 40, textAlign: 'center' }}>
        🔒 Acesso privado — somente sua conta Google
      </p>
    </div>
  );
}
