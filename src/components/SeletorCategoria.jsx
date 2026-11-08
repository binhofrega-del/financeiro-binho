import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import IconeCategoria from './IconeCategoria';
import { categoriaDoTipo, ordenarCategorias, visualCategoria } from '../utils/categorias';

// Escolha de categoria com os ícones do Organizze.
// Mostra só as categorias do tipo (despesa ou receita); subcategorias logo abaixo da mãe.
export default function SeletorCategoria({ categorias, valor, tipo, onChange, estiloCampo }) {
  const [aberto, setAberto] = useState(false);
  const tipoIcone = tipo === 'transferencia' ? 'despesa' : tipo;
  const nomes = categorias.map(c => c.nome)
    .filter(n => tipo === 'transferencia' || n === valor || categoriaDoTipo(n, tipo));
  const ordenadas = ordenarCategorias([...new Set(nomes)], tipoIcone);

  return (
    <div>
      <button type="button" onClick={() => setAberto(v => !v)} aria-expanded={aberto}
        style={{ ...estiloCampo, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', padding: '8px 12px' }}>
        <IconeCategoria nome={valor} tipo={tipoIcone} size={30} />
        <span style={{ flex: 1, fontSize: 15, color: '#111' }}>{valor || 'Escolher categoria'}</span>
        {aberto ? <ChevronUp size={16} color="#888" /> : <ChevronDown size={16} color="#888" />}
      </button>
      {aberto && (
        <div role="listbox" aria-label="Categorias"
          style={{ marginTop: 8, border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 8, maxHeight: 300, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2 }}>
          {ordenadas.map(nome => {
            const sub = !!visualCategoria(nome, tipoIcone).pai;
            const ativo = nome === valor;
            return (
              <button key={nome} type="button" role="option" aria-selected={ativo}
                onClick={() => { onChange(nome); setAberto(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: sub ? '6px 8px 6px 22px' : '7px 8px', borderRadius: 10, border: 'none',
                  background: ativo ? '#dcfce7' : 'transparent', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}>
                <IconeCategoria nome={nome} tipo={tipoIcone} size={sub ? 24 : 32} />
                <span style={{ fontSize: sub ? 13 : 14, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
