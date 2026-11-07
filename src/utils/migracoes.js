// Reparos aplicados sempre que os dados são carregados (deste aparelho ou do Drive).
// Precisam ser idempotentes: rodar de novo não muda nada.
import { addMeses, chaveDaData, difMeses, mesAnoDaData } from './financas.js';

// Importação v1.2.0: no fim do período exportado o Organizze deixa a última ocorrência de
// algumas assinaturas do cartão sem "Fatura"; ela virou um lançamento solto logo depois do
// fim do fixo (ex.: Netflix e YouTube em nov/2029). Aqui ela volta a fazer parte do fixo —
// assim não pesa no limite do cartão (fixo só conta na fatura atual, igual ao Organizze).
export function absorverOcorrenciasSoltas(lancamentos) {
  const fixos = lancamentos.filter((l) => l.fixo && l.cartaoId && l.fixoFimData);
  if (fixos.length === 0) return lancamentos;
  const remover = new Set();
  const novoFim = new Map();
  for (const f of fixos) {
    let fim = f.fixoFimData;
    for (;;) {
      const solta = lancamentos.find((l) => !remover.has(l) && !l.fixo && !l.parcelado &&
        l.cartaoId === f.cartaoId && l.descricao === f.descricao && l.valor === f.valor &&
        l.categoria === f.categoria && chaveDaData(l.data) === fim &&
        l.data === addMeses(f.data, difMeses(mesAnoDaData(f.data), mesAnoDaData(l.data))));
      if (!solta) break;
      remover.add(solta);
      fim = chaveDaData(addMeses(`${fim}-01`, 1));
    }
    if (fim !== f.fixoFimData) novoFim.set(f.id, fim);
  }
  if (remover.size === 0) return lancamentos;
  return lancamentos
    .filter((l) => !remover.has(l))
    .map((l) => (novoFim.has(l.id) ? { ...l, fixoFimData: novoFim.get(l.id) } : l));
}

// O Organizze cria, na conta que paga o cartão, uma linha "Fatura <Mês> <Ano>" (não paga)
// para cada fatura em aberto, e atualiza o valor sozinho. No export ela veio CONGELADA
// e o importador (até a v1.3.2) trouxe como despesa comum → a fatura de verdade, que o app
// calcula e atualiza, ficava escondida atrás dela. Aqui essas linhas saem, e o cartão
// guarda essa conta como a que costuma pagá-lo.
export const RE_PROJECAO_FATURA = /^Fatura (Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro) \d{4}$/;

export function ehProjecaoDeFatura(l) {
  return !l.cartaoId && !l.pago && !l.fixo && !l.parcelado && (l.valor || 0) <= 0 &&
    (!l.categoria || l.categoria === 'Outros') && RE_PROJECAO_FATURA.test(String(l.descricao || '').trim());
}

export function removerProjecoesDeFatura(dados) {
  const lancamentos = dados.lancamentos || [];
  const projecoes = lancamentos.filter(ehProjecaoDeFatura);
  if (projecoes.length === 0) return dados;
  const cartoes = dados.cartoes || [];
  let novosCartoes = cartoes;
  if (cartoes.length === 1 && cartoes[0].contaPagamentoId == null) {
    const conta = projecoes[0].contaId ?? null;
    if (conta != null) novosCartoes = [{ ...cartoes[0], contaPagamentoId: conta }];
  }
  return { ...dados, cartoes: novosCartoes, lancamentos: lancamentos.filter((l) => !ehProjecaoDeFatura(l)) };
}
