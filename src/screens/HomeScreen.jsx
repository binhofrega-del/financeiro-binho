import { useState } from 'react';
import { Eye, EyeOff, ChevronRight, TrendingUp, TrendingDown, Plus, CloudOff, Cloud, RefreshCw, Loader } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatarMoeda, nomeMes } from '../utils/formatters';
import ModalLancamento from '../components/ModalLancamento';
import IconeBanco from '../components/IconeBanco';

export default function HomeScreen({ setAba, irParaFluxo }) {
  const { contas, cartoes, lancamentos, saldoGeral, driveStatus, conectarDrive, desconectarDrive, sincronizarDrive } = useApp();
  const [ocultarSaldo, setOcultarSaldo] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();
  const hora = agora.getHours();
  const saudacao = hora >= 5 && hora < 12 ? 'Bom dia' : hora >= 12 && hora < 18 ? 'Boa tarde' : 'Boa noite';

  // Fatura do cartão no mês atual (inclui fixos recorrentes)
  function faturaCartao(cartaoId) {
    const inicioMes = new Date(anoAtual, mesAtual, 1);
    const fimMes = new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59);
    return lancamentos
      .filter(l => {
        if (l.cartaoId !== cartaoId || l.tipo !== 'despesa') return false;
        const d = new Date(l.data + 'T00:00:00');
        // Normal: no mês exato
        if (d >= inicioMes && d <= fimMes) return true;
        // Fixo: a partir do mês de criação
        if (l.fixo && d <= fimMes) return true;
        return false;
      })
      .reduce((a, l) => a + Math.abs(l.valor), 0);
  }

  // Resumo do mês
  const lancMes = lancamentos.filter(l => {
    const d = new Date(l.data + 'T00:00:00');
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });
  // Entradas: só conta (sem cartão)
  const entradas = lancMes.filter(l => !l.cartaoId && l.tipo === 'receita').reduce((a, l) => a + l.valor, 0);
  // Saídas: conta + gastos confirmados no cartão do mês (incluindo fixos do cartão)
  const inicioMes = new Date(anoAtual, mesAtual, 1);
  const fimMes = new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59);
  const saidasConta = lancMes.filter(l => !l.cartaoId && l.tipo === 'despesa').reduce((a, l) => a + Math.abs(l.valor), 0);
  const saidasCartao = lancamentos.filter(l => {
    if (!l.cartaoId || l.tipo !== 'despesa') return false;
    const d = new Date(l.data + 'T00:00:00');
    if (d >= inicioMes && d <= fimMes) return true;
    if (l.fixo && d <= fimMes) return true;
    return false;
  }).reduce((a, l) => a + Math.abs(l.valor), 0);
  const saidas = saidasConta + saidasCartao;

  const val = (v) => ocultarSaldo ? '••••' : formatarMoeda(v);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f3f4f6' }}>

      {/* Header */}
      <div style={{ background: '#16a34a', padding: '16px 20px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/icon.svg" alt="Logo" style={{ width: 44, height: 44, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} />
            <div>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{saudacao},</p>
              <h2 style={{ color: 'white', fontSize: 22, fontWeight: 700 }}>Binho</h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Botão Google Drive */}
            <button
              onClick={() => driveStatus === 'desconectado' || driveStatus === 'erro' ? conectarDrive() : driveStatus === 'conectado' ? sincronizarDrive() : null}
              title={driveStatus === 'conectado' ? 'Sincronizado com Google Drive' : driveStatus === 'desconectado' ? 'Conectar Google Drive' : driveStatus}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 20, padding: '6px 10px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: 4 }}>
              {driveStatus === 'iniciando' && <Loader size={16} style={{ opacity: 0.6 }} />}
              {driveStatus === 'desconectado' && <CloudOff size={16} />}
              {driveStatus === 'conectado' && <Cloud size={16} color="#86efac" />}
              {(driveStatus === 'sincronizando' || driveStatus === 'salvando') && <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {driveStatus === 'erro' && <CloudOff size={16} color="#fca5a5" />}
            </button>
            <button onClick={() => setOcultarSaldo(!ocultarSaldo)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 20, padding: '6px 10px', cursor: 'pointer', color: 'white' }}>
              {ocultarSaldo ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Saldo Geral */}
        <div style={{ marginTop: 20, background: 'white', borderRadius: 16, padding: '16px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Saldo Geral</p>
          <p style={{ fontSize: 34, fontWeight: 800, color: saldoGeral >= 0 ? '#16a34a' : '#dc2626', marginTop: 4 }}>
            {val(saldoGeral)}
          </p>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={14} color="#16a34a" />
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{val(entradas)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingDown size={14} color="#dc2626" />
              <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>{val(saidas)}</span>
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>{nomeMes(mesAtual)} de {anoAtual}</p>
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Minhas Contas */}
        <div style={card}>
          <div style={secTitle}>
            <span>Minhas Contas</span>
            <button onClick={() => setAba('config')} style={linkBtn}>Ver todas <ChevronRight size={14} /></button>
          </div>
          {contas.map(conta => (
            <div key={conta.id}
              onClick={() => irParaFluxo && irParaFluxo({ contaIds: [conta.id] })}
              style={{ ...rowStyle, cursor: 'pointer', borderRadius: 10, margin: '0 -8px', padding: '10px 8px', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <IconeBanco nome={conta.nome} icone={conta.icone} cor={conta.cor} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{conta.nome}</p>
                <p style={{ fontSize: 11, color: '#aaa' }}>{conta.tipo}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1d4ed8' }}>{val(conta.saldoAtual ?? conta.saldo)}</span>
                <ChevronRight size={14} color="#ccc" />
              </div>
            </div>
          ))}
        </div>

        {/* Cartões de Crédito — Fix 2: clicável para ir à aba Cartões */}
        {cartoes.length > 0 && (
          <div style={card}>
            <div style={secTitle}>
              <span>Cartões de Crédito</span>
              <button onClick={() => setAba('cartoes')} style={linkBtn}>Ver todos <ChevronRight size={14} /></button>
            </div>
            {cartoes.map(cartao => {
              const fatura = faturaCartao(cartao.id);
              const disponivel = Math.max(cartao.limite - fatura, 0);
              const pct = Math.min((fatura / cartao.limite) * 100, 100);
              const hoje = agora.getDate();
              const diasVenc = cartao.diaVencimento >= hoje
                ? cartao.diaVencimento - hoje
                : (30 - hoje + cartao.diaVencimento);

              return (
                // Fix 2: clicar no cartão vai para a aba Cartões
                <div key={cartao.id} onClick={() => setAba('cartoes')} style={{ cursor: 'pointer' }}>
                  <div style={{
                    background: `linear-gradient(135deg, ${cartao.cor}, #7c3aed)`,
                    borderRadius: 14, padding: 16, color: 'white', marginBottom: 8,
                    transition: 'opacity 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    <p style={{ fontSize: 11, opacity: 0.7 }}>{cartao.banco}</p>
                    <p style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{cartao.nome}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                      <div>
                        <p style={{ fontSize: 10, opacity: 0.7 }}>Fatura Atual</p>
                        <p style={{ fontSize: 16, fontWeight: 700 }}>{val(fatura)}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 10, opacity: 0.7 }}>Disponível</p>
                        <p style={{ fontSize: 16, fontWeight: 700 }}>{val(disponivel)}</p>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.2)', height: 4, borderRadius: 2, marginTop: 10 }}>
                      <div style={{ background: 'white', height: 4, borderRadius: 2, width: `${pct}%` }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', fontSize: 12, color: '#888' }}>
                    <span>Vencimento: dia {cartao.diaVencimento}</span>
                    <span style={{ color: diasVenc <= 5 ? '#dc2626' : '#d97706', fontWeight: 600 }}>
                      ⚠ {diasVenc} dias
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Resumo */}
        <div style={card}>
          <div style={secTitle}><span>Resumo de {nomeMes(mesAtual)}</span></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={resumoBox}>
              <p style={{ fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>Entradas</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>{val(entradas)}</p>
            </div>
            <div style={resumoBox}>
              <p style={{ fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>Saídas</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#dc2626', marginTop: 4 }}>{val(saidas)}</p>
            </div>
            <div style={resumoBox}>
              <p style={{ fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>Saldo</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1d4ed8', marginTop: 4 }}>{val(entradas - saidas)}</p>
            </div>
          </div>
        </div>

      </div>

      {/* Fix 1: FAB para novo lançamento */}
      <button onClick={() => setModalAberto(true)}
        style={{ position: 'fixed', bottom: 80, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#16a34a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(22,163,74,0.45)', zIndex: 10 }}>
        <Plus size={28} color="white" />
      </button>

      {modalAberto && <ModalLancamento onFechar={() => setModalAberto(false)} />}
    </div>
  );
}

const card = { background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };
const secTitle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 15, fontWeight: 700, color: '#111' };
const linkBtn = { display: 'flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', color: '#16a34a', fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' };
const icone = { width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0 };
const resumoBox = { flex: 1, background: '#f9fafb', borderRadius: 12, padding: 12, textAlign: 'center' };
