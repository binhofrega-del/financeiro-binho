import { useState } from 'react';
import { Trash2, Copy, ThumbsUp, ThumbsDown, Pencil, X, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatarMoeda } from '../utils/formatters';
import { emojisCategoria } from '../utils/formatters';

export default function DetalheModal({ lanc, onFechar, onEditar, onTogglePago, onExcluir }) {
  const { togglePago, removerLancamento, removerParcelasDoGrupo } = useApp();
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const isReceita = lanc.tipo === 'receita';
  const isTransf = lanc.tipo === 'transferencia';
  const isCartao = !!lanc.cartaoId;
  const isFatura = !!lanc._isFatura;
  const cor = isReceita ? '#16a34a' : isTransf ? '#1d4ed8' : '#dc2626';
  const bgIcon = isReceita ? '#dcfce7' : isTransf ? '#dbeafe' : '#fee2e2';
  const emoji = emojisCategoria[lanc.categoria] || '📌';

  function duplicar() {
    const { id, ...resto } = lanc;
    onFechar();
    onEditar({ ...resto, pago: false, _copia: true });
  }

  function excluir() {
    // Se for fixo, usa o popup específico de exclusão de fixo
    if (onExcluir && (lanc.fixo || lanc._fixoMesAno)) {
      onExcluir(lanc);
      return;
    }
    // Se for parcelado com grupoId, mostra opções
    if (lanc.parcelado && lanc.grupoId) {
      setConfirmarExclusao(true);
    } else {
      removerLancamento(lanc.id);
      onFechar();
    }
  }

  function excluirSoEste() {
    removerLancamento(lanc.id);
    onFechar();
  }

  function excluirEsteEFuturos() {
    removerParcelasDoGrupo(lanc.grupoId, lanc.parcela);
    onFechar();
  }

  function marcarPago() {
    if (onTogglePago) onTogglePago();
    else { togglePago(lanc.id); onFechar(); }
  }

  const [ano, mes, dia] = lanc.data.split('-');
  const dataFormatada = `${dia}/${mes}/${ano}`;
  const parcelasRestantes = lanc.totalParcelas - lanc.parcela + 1;

  return (
    <div
      style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}
      onClick={e => e.target === e.currentTarget && onFechar()}
    >
      <div style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', paddingBottom: 32, maxHeight: '85%', overflowY: 'auto' }}>

        {/* Handle */}
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '0 auto 8px' }} />
        </div>

        {/* Botão fechar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px' }}>
          <button onClick={onFechar} style={{ background: '#f3f4f6', border: 'none', borderRadius: 10, padding: 6, cursor: 'pointer' }}>
            <X size={18} color="#666" />
          </button>
        </div>

        {/* Ícone + nome + valor */}
        <div style={{ textAlign: 'center', padding: '8px 24px 20px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: bgIcon, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 14px' }}>
            {emoji}
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 6 }}>{lanc.descricao}</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: cor }}>
            {isReceita ? '+' : '-'}{formatarMoeda(Math.abs(lanc.valor))}
          </p>

          {/* Badges */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            {lanc.fixo && (
              <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>
                🔁 Lançamento fixo
              </span>
            )}
            {lanc.parcelado && (
              <span style={{ background: '#fef3c7', color: '#d97706', fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>
                📋 {lanc.parcela}/{lanc.totalParcelas} parcelas
              </span>
            )}
            {isCartao && (
              <span style={{ background: '#ede9fe', color: '#7c3aed', fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>
                💳 Cartão
              </span>
            )}
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, padding: '0 24px 24px', borderBottom: '1px solid #f3f4f6' }}>
          {isFatura ? (
            // Fatura: só marcar como pago
            <>
              <AcaoBtn
                icon={lanc.pago ? <ThumbsDown size={22} color="#dc2626" /> : <ThumbsUp size={22} color="#16a34a" />}
                label={lanc.pago ? 'Desmarcar' : 'Marcar pago'}
                onClick={marcarPago}
                bgColor={lanc.pago ? '#fee2e2' : '#dcfce7'}
              />
            </>
          ) : (
            // Lançamento normal
            <>
              <AcaoBtn icon={<Trash2 size={22} color="#dc2626" />} label="Excluir" onClick={excluir} bgColor="#fee2e2" />
              <AcaoBtn icon={<Copy size={22} color="#6b7280" />} label="Duplicar" onClick={duplicar} bgColor="#f3f4f6" />
              {!isCartao && (
                <AcaoBtn
                  icon={lanc.pago ? <ThumbsDown size={22} color="#dc2626" /> : <ThumbsUp size={22} color="#16a34a" />}
                  label={lanc.pago ? (isReceita ? 'Não recebido' : 'Não pago') : (isReceita ? 'Recebido' : 'Pago')}
                  onClick={marcarPago}
                  bgColor={lanc.pago ? '#fee2e2' : '#dcfce7'}
                />
              )}
              <AcaoBtn icon={<Pencil size={22} color="#7c3aed" />} label="Editar" onClick={() => { onFechar(); onEditar(lanc); }} bgColor="#ede9fe" />
            </>
          )}
        </div>

        {/* Detalhes */}
        <div style={{ padding: '20px 24px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          <DetalheItem label="Data" valor={dataFormatada} />
          <DetalheItem label="Categoria" valor={`${emoji} ${lanc.categoria}`} />
          {!isCartao && <DetalheItem label="Status" valor={lanc.pago ? (isReceita ? '✅ Recebido' : '✅ Pago') : (isReceita ? '⏳ Não recebido' : '⏳ Não pago')} />}
          <DetalheItem label="Tipo" valor={isReceita ? '⬆ Receita' : isTransf ? '↔ Transferência' : '⬇ Despesa'} />
        </div>
      </div>

      {/* Modal de confirmação de exclusão de parcelas */}
      {confirmarExclusao && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}>

            {/* Ícone de alerta */}
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={28} color="#dc2626" />
            </div>

            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111', textAlign: 'center', marginBottom: 8 }}>
              Excluir lançamento parcelado
            </h3>
            <p style={{ fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
              <strong>{lanc.descricao}</strong> — parcela {lanc.parcela}/{lanc.totalParcelas}
              <br />O que você deseja fazer?
            </p>

            {/* Opção 1: só este */}
            <button onClick={excluirSoEste}
              style={{ width: '100%', border: '1.5px solid #e5e7eb', background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', textAlign: 'left' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>🗑 Excluir só esta parcela</p>
              <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                Remove apenas a parcela {lanc.parcela}/{lanc.totalParcelas}
              </p>
            </button>

            {/* Opção 2: este e futuros */}
            <button onClick={excluirEsteEFuturos}
              style={{ width: '100%', border: '1.5px solid #dc2626', background: '#fee2e2', borderRadius: 14, padding: '14px 16px', marginBottom: 16, cursor: 'pointer', textAlign: 'left' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>🗑 Excluir esta e as {parcelasRestantes - 1} próximas</p>
              <p style={{ fontSize: 12, color: '#dc2626', opacity: 0.8, marginTop: 2 }}>
                Remove da parcela {lanc.parcela} até a {lanc.totalParcelas}/{lanc.totalParcelas}
              </p>
            </button>

            {/* Cancelar */}
            <button onClick={() => setConfirmarExclusao(false)}
              style={{ width: '100%', border: 'none', background: '#f3f4f6', borderRadius: 12, padding: 12, cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#666' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AcaoBtn({ icon, label, onClick, bgColor }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer' }}>
      <div style={{ width: 54, height: 54, borderRadius: '50%', background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <span style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>{label}</span>
    </button>
  );
}

function DetalheItem({ label, valor }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: '#aaa', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{valor}</p>
    </div>
  );
}
