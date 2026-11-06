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
