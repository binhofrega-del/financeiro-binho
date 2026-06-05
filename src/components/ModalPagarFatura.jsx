import { useState } from 'react';
import { X, Check, CreditCard } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatarMoeda } from '../utils/formatters';

export default function ModalPagarFatura({ fatura, onFechar }) {
  const { contas, cartoes, pagarFatura, desfazerFatura } = useApp();
  const [contaSelecionada, setContaSelecionada] = useState(contas[0]?.id || null);

  // Se já está paga, pergunta se quer desfazer
  if (fatura.pago) {
    return (
      <div style={overlay} onClick={e => e.target === e.currentTarget && onFechar()}>
        <div style={sheet}>
          <Handle />
          <div style={{ padding: '0 20px 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Check size={28} color="#16a34a" />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Fatura já paga</p>
              <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{fatura.descricao}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#16a34a', marginTop: 6 }}>{formatarMoeda(Math.abs(fatura.valor))}</p>
            </div>

            {/* Mostra qual conta foi usada */}
          {fatura._contaIdPagamento && (() => {
            const contaPago = contas.find(c => c.id === fatura._contaIdPagamento);
            return contaPago ? (
              <div style={{ background: '#f9fafb', borderRadius: 12, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: contaPago.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 11 }}>{contaPago.icone}</div>
                <div>
                  <p style={{ fontSize: 11, color: '#aaa' }}>Pago com</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{contaPago.nome}</p>
                </div>
              </div>
            ) : null;
          })()}

          <button onClick={() => { desfazerFatura(fatura.cartaoId, fatura._mesAno); onFechar(); }}
              style={{ width: '100%', border: '1.5px solid #dc2626', background: '#fee2e2', color: '#dc2626', borderRadius: 14, padding: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 10 }}>
              Desfazer pagamento
            </button>
            <button onClick={onFechar}
              style={{ width: '100%', border: 'none', background: '#f3f4f6', color: '#666', borderRadius: 14, padding: 14, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onFechar()}>
      <div style={sheet}>
        <Handle />
        <div style={{ padding: '0 20px 24px' }}>
          {/* Cabeçalho */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>Pagar Fatura</h3>
            <button onClick={onFechar} style={{ background: '#f3f4f6', border: 'none', borderRadius: 10, padding: 6, cursor: 'pointer' }}>
              <X size={18} color="#666" />
            </button>
          </div>

          {/* Info da fatura */}
          <div style={{ background: '#f9fafb', borderRadius: 14, padding: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={20} color="#7c3aed" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{fatura.descricao}</p>
                <p style={{ fontSize: 12, color: '#aaa' }}>{fatura._cartaoBanco} · {fatura._cartaoNome}</p>
              </div>
            </div>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{formatarMoeda(Math.abs(fatura.valor))}</p>
          </div>

          {/* Selecionar conta */}
          <p style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pagar com qual conta?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {contas.map(conta => (
              <button key={conta.id} onClick={() => setContaSelecionada(conta.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: `2px solid ${contaSelecionada === conta.id ? '#16a34a' : '#e5e7eb'}`, background: contaSelecionada === conta.id ? '#dcfce7' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: conta.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                  {conta.icone}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{conta.nome}</p>
                  <p style={{ fontSize: 12, color: '#888' }}>{formatarMoeda(conta.saldoAtual ?? conta.saldo)} disponível</p>
                </div>
                {contaSelecionada === conta.id && <Check size={18} color="#16a34a" />}
              </button>
            ))}
          </div>

          {/* Botão confirmar */}
          <button
            onClick={() => {
              if (!contaSelecionada) return;
              pagarFatura(fatura.cartaoId, fatura._mesAno, contaSelecionada, Math.abs(fatura.valor), fatura._cartaoNome);
              onFechar();
            }}
            style={{ width: '100%', background: '#16a34a', color: 'white', border: 'none', borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Check size={20} /> Confirmar Pagamento
          </button>
        </div>
      </div>
    </div>
  );
}

function Handle() {
  return <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '12px auto 16px' }} />;
}

const overlay = { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 60 };
const sheet = { background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxHeight: '90%', overflowY: 'auto' };
