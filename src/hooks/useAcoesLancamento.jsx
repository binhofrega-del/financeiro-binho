import { useState } from 'react';
import { useApp } from '../context/AppContext';
import ModalLancamento from '../components/ModalLancamento';
import ModalEditarFixo from '../components/ModalEditarFixo';
import ModalExcluirFixo from '../components/ModalExcluirFixo';

// Remove os campos que só existem nas ocorrências "virtuais" de fixos
function semCamposVirtuais(l) {
  // eslint-disable-next-line no-unused-vars
  const { _fixoMesAno, _k, _copia, _criarNovoFixo, ...resto } = l;
  return resto;
}

// Fluxo único de novo / editar / excluir lançamentos, usado pelo Fluxo e pelos Cartões.
// Para fixos, pergunta "só este mês" ou "todos os próximos" — e só altera o fixo
// original quando o usuário SALVA (cancelar o modal não quebra mais o fixo).
export function useAcoesLancamento({ cartaoPreSelecionado } = {}) {
  const { lancamentos, adicionarExcecaoFixo, pararFixoNoMes, removerFixo } = useApp();
  const [modal, setModal] = useState(null);           // { editando, aoSalvar }
  const [editarFixo, setEditarFixo] = useState(null);  // ocorrência do fixo
  const [excluirFixo, setExcluirFixo] = useState(null);

  const original = (l) => lancamentos.find(x => x.id === l.id) || l;

  function novo() { setModal({ editando: null }); }

  function editar(lanc) {
    if (lanc.fixo && !lanc._copia) setEditarFixo(lanc);
    else setModal({ editando: lanc });
  }

  function excluir(lanc) { setExcluirFixo(lanc); }

  // ── Editar fixo ──
  function editarSoEste(oc) {
    // eslint-disable-next-line no-unused-vars
    const { id: origId, fixo, pagoPorMes, excecoesMeses, fixoFimData, ...resto } = semCamposVirtuais(oc);
    setEditarFixo(null);
    setModal({
      editando: { ...resto, fixo: false, _copia: true, _excecaoDeId: origId },
      aoSalvar: () => adicionarExcecaoFixo(origId, oc._fixoMesAno),
    });
  }

  function editarTodos(oc) {
    const orig = original(oc);
    setEditarFixo(null);
    if (oc._k > 0) {
      // A partir de um mês posterior: encerra o fixo original e cria um novo a partir daqui,
      // levando junto o que já foi marcado/excluído nos meses seguintes.
      const chave = oc._fixoMesAno;
      // eslint-disable-next-line no-unused-vars
      const { id, excecoesMeses, fixoFimData, pagoPorMes, ...resto } = semCamposVirtuais(orig);
      const pagoFuturo = Object.fromEntries(Object.entries(pagoPorMes || {}).filter(([k]) => k > chave));
      const excecoesFuturas = (excecoesMeses || []).filter(k => k > chave);
      setModal({
        editando: {
          ...resto,
          data: oc.data,
          pago: oc.pago,
          pagoPorMes: pagoFuturo,
          excecoesMeses: excecoesFuturas,
          ...(fixoFimData ? { fixoFimData } : {}),
          ...(oc.faturaMes != null ? { faturaMes: oc.faturaMes, faturaAno: oc.faturaAno } : {}),
          _criarNovoFixo: true,
        },
        aoSalvar: () => pararFixoNoMes(orig.id, chave),
      });
    } else {
      // Mês de criação: edita o próprio fixo
      setModal({ editando: { ...semCamposVirtuais(orig), pago: oc.pago } });
    }
  }

  // ── Excluir fixo ──
  function excluirSoEste(oc) {
    adicionarExcecaoFixo(oc.id, oc._fixoMesAno);
    setExcluirFixo(null);
  }
  function excluirTodos(oc) {
    if (oc._k > 0) pararFixoNoMes(oc.id, oc._fixoMesAno);
    else removerFixo(oc.id);
    setExcluirFixo(null);
  }

  const elementos = (
    <>
      {modal && (
        <ModalLancamento
          editando={modal.editando}
          aoSalvar={modal.aoSalvar}
          cartaoPreSelecionado={cartaoPreSelecionado}
          onFechar={() => setModal(null)}
        />
      )}
      {editarFixo && (
        <ModalEditarFixo
          lanc={editarFixo}
          onCancelar={() => setEditarFixo(null)}
          onSoEste={() => editarSoEste(editarFixo)}
          onTodosProximos={() => editarTodos(editarFixo)}
        />
      )}
      {excluirFixo && (
        <ModalExcluirFixo
          lanc={excluirFixo}
          onCancelar={() => setExcluirFixo(null)}
          onSoEste={() => excluirSoEste(excluirFixo)}
          onTodosProximos={() => excluirTodos(excluirFixo)}
        />
      )}
    </>
  );

  return { novo, editar, excluir, elementos };
}
