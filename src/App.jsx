import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import BottomNav from './components/BottomNav';
import HomeScreen from './screens/HomeScreen';
import FluxoScreen from './screens/FluxoScreen';
import CartoesScreen from './screens/CartoesScreen';
import ConfigScreen from './screens/ConfigScreen';
import LoginScreen from './screens/LoginScreen';

function AppInner() {
  const [aba, setAba] = useState('home');
  const [filtroFluxo, setFiltroFluxo] = useState(null);
  const { driveStatus, autenticado, conectarDrive } = useApp();

  // Mostra login APENAS se nunca autenticou — sync/salvamento não interrompe o app
  const mostrarLogin = !autenticado;

  if (mostrarLogin) {
    return (
      <div style={{ height: '100dvh', maxWidth: 480, margin: '0 auto' }}>
        <LoginScreen onLogin={conectarDrive} status={driveStatus} />
      </div>
    );
  }

  function irParaFluxo(filtro = null) {
    setFiltroFluxo(filtro);
    setAba('fluxo');
  }

  function mudarAba(novaAba) {
    if (novaAba !== 'fluxo') setFiltroFluxo(null);
    setAba(novaAba);
  }

  const telas = {
    home: <HomeScreen setAba={setAba} irParaFluxo={irParaFluxo} />,
    fluxo: <FluxoScreen filtroInicial={filtroFluxo} />,
    cartoes: <CartoesScreen setAba={setAba} />,
    config: <ConfigScreen />,
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', maxWidth: 480,
      margin: '0 auto', background: 'white',
      boxShadow: '0 0 40px rgba(0,0,0,0.15)',
      position: 'relative',
    }}>
      {telas[aba]}
      <BottomNav aba={aba} setAba={mudarAba} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
