// ─────────────────────────────────────────────────────────────────────────────
// financas.js — FONTE ÚNICA das regras financeiras do app.
//
// Todas as telas (Home, Fluxo, Cartões) e o contexto usam estas funções, para
// que um mesmo número nunca seja calculado de dois jeitos diferentes.
// Não depende de React: pode ser testado com `npm test` (node --test).
//
// Convenções:
//   • Datas são strings locais 'YYYY-MM-DD' (nunca toISOString, que usa UTC).
//   • Mês/ano de fatura: { ano, mes } com mes 0-based (igual faturaMes/faturaAno salvos).
//   • Chave de mês: 'YYYY-MM' (1-based), usada em pagoPorMes, excecoesMeses,
//     fixoFimData e faturasPagas.
//   • Valores: despesa negativa, receita positiva, transferência positiva.
// ─────────────────────────────────────────────────────────────────────────────

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const arred = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
export const pad2 = (n) => String(n).padStart(2, '0');

// ── IDs ──────────────────────────────────────────────────────────────────────
// Date.now() puro pode repetir quando dois lançamentos são criados no mesmo ms.
let ultimoId = 0;
export function gerarId() {
  ultimoId = Math.max(Date.now(), ultimoId + 1);
  return ultimoId;
}

// ── Datas ────────────────────────────────────────────────────────────────────
export function isoLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function hojeISO(agora = new Date()) {
  return isoLocal(agora);
}
export function parseISO(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}
export function chaveMes(ano, mes) {
  return `${ano}-${pad2(mes + 1)}`;
}
export function chaveDaData(iso) {
  return iso.slice(0, 7);
}
export function mesAnoDaData(iso) {
  const [a, m] = iso.split('-').map(Number);
  return { ano: a, mes: m - 1 };
}
export function mesAnoDaChave(chave) {
  const [a, m] = chave.split('-').map(Number);
  return { ano: a, mes: m - 1 };
}
export function ultimoDiaMes(ano, mes) {
  return new Date(ano, mes + 1, 0).getDate();
}
export function somarMeses({ ano, mes }, n) {
  const t = ano * 12 + mes + n;
  return { ano: Math.floor(t / 12), mes: ((t % 12) + 12) % 12 };
}
export function difMeses(a, b) {
  return (b.ano - a.ano) * 12 + (b.mes - a.mes);
}
export function mesmoMes(a, b) {
  return a.ano === b.ano && a.mes === b.mes;
}
export function inicioDoMes({ ano, mes }) {
  return `${ano}-${pad2(mes + 1)}-01`;
}
export function fimDoMes({ ano, mes }) {
  return `${ano}-${pad2(mes + 1)}-${pad2(ultimoDiaMes(ano, mes))}`;
}

// Soma meses sem "estourar" o mês (31/jan + 1 mês = 28/fev, não 03/mar).
// ultimoDia=true: se a data original é o último dia do mês, mantém último dia
// no mês alvo (regra usada pelos lançamentos fixos).
export function addMeses(iso, n, { ultimoDia = true } = {}) {
  const [a, m, d] = iso.split('-').map(Number);
  const eraUltimo = d === ultimoDiaMes(a, m - 1);
  const alvo = somarMeses({ ano: a, mes: m - 1 }, n);
  const ult = ultimoDiaMes(alvo.ano, alvo.mes);
  const dia = ultimoDia && eraUltimo ? ult : Math.min(d, ult);
  return `${alvo.ano}-${pad2(alvo.mes + 1)}-${pad2(dia)}`;
}
export function addDias(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}
export function diasEntre(isoA, isoB) {
  return Math.round((parseISO(isoB) - parseISO(isoA)) / 86400000);
}
export function diaNoMes({ ano, mes }, dia) {
  return `${ano}-${pad2(mes + 1)}-${pad2(Math.min(dia, ultimoDiaMes(ano, mes)))}`;
}

// Intervalo [inicio, fim] (ISO) para os modos do Fluxo.
// modo 'personalizado' usa dataRef = 'inicio|fim'.
export function intervaloDoPeriodo(modo, dataRef) {
  if (modo === 'personalizado') {
    const [ini, fim] = dataRef.split('|');
    return { inicio: ini, fim };
  }
  if (modo === 'dia') return { inicio: dataRef, fim: dataRef };
  if (modo === 'semana') {
    const dow = parseISO(dataRef).getDay(); // 0 = domingo
    const inicio = addDias(dataRef, dow === 0 ? -6 : 1 - dow);
    return { inicio, fim: addDias(inicio, 6) };
  }
  const ma = mesAnoDaData(dataRef);
  return { inicio: inicioDoMes(ma), fim: fimDoMes(ma) };
}

// ── Lançamentos fixos ────────────────────────────────────────────────────────
// Ocorrência k (0 = mês de criação) de um lançamento fixo, ou null se o mês foi
// excluído ("só este") ou o fixo já terminou ("todos os próximos").
export function ocorrenciaFixo(l, k) {
  const data = addMeses(l.data, k);
  const chave = chaveDaData(data);
  if ((l.excecoesMeses || []).includes(chave)) return null;
  if (l.fixoFimData && chave >= l.fixoFimData) return null;
  const ppm = l.pagoPorMes || {};
  const pago = k === 0 ? (ppm[chave] ?? !!l.pago) : (ppm[chave] ?? false);
  return { ...l, data, pago, _fixoMesAno: chave, _k: k };
}

// Todas as ocorrências de um fixo com data dentro de [inicio, fim].
export function ocorrenciasFixo(l, inicio, fim) {
  const res = [];
  if (!l.data || l.data > fim) return res;
  let k = Math.max(0, difMeses(mesAnoDaData(l.data), mesAnoDaData(inicio)) - 1);
  for (; ; k++) {
    const data = addMeses(l.data, k);
    if (data > fim) break;
    if (l.fixoFimData && chaveDaData(data) >= l.fixoFimData) break;
    if (data < inicio) continue;
    const oc = ocorrenciaFixo(l, k);
    if (oc) res.push(oc);
  }
  return res;
}

// Lançamentos de CONTA (sem cartão) que caem no período, com fixos expandidos.
export function lancamentosContaNoPeriodo(lancamentos, inicio, fim) {
  const out = [];
  for (const l of lancamentos) {
    if (l.cartaoId) continue;
    if (l.fixo) out.push(...ocorrenciasFixo(l, inicio, fim));
    else if (l.data >= inicio && l.data <= fim) out.push(l);
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

// ── Cartão de crédito ────────────────────────────────────────────────────────
// Em qual fatura cai uma compra feita em `iso`.
export function faturaDaCompra(iso, diaFechamento) {
  const [a, m, d] = iso.split('-').map(Number);
  const base = { ano: a, mes: m - 1 };
  return d <= diaFechamento ? base : somarMeses(base, 1);
}

// Fatura base de um lançamento: a escolhida/salva (faturaMes/faturaAno) ou a calculada.
export function faturaDoLancamento(l, cartao) {
  if (l.faturaMes != null && l.faturaAno != null) return { ano: l.faturaAno, mes: l.faturaMes };
  return faturaDaCompra(l.data, cartao?.diaFechamento ?? 31);
}

// Mês em que a fatura vence: vencimento depois do fechamento → mesmo mês; senão, mês seguinte.
export function vencimentoDaFatura(fat, cartao) {
  return cartao.diaVencimento > cartao.diaFechamento ? { ...fat } : somarMeses(fat, 1);
}
export function dataVencimento(fat, cartao) {
  return diaNoMes(vencimentoDaFatura(fat, cartao), cartao.diaVencimento);
}
export function dataFechamento(fat, cartao) {
  return diaNoMes(fat, cartao.diaFechamento);
}
// Inverso: qual fatura vence no mês `ma`.
export function faturaQueVenceEm(ma, cartao) {
  return cartao.diaVencimento > cartao.diaFechamento ? { ...ma } : somarMeses(ma, -1);
}

// Status de pagamento (faturasPagas é indexado pelo mês do VENCIMENTO).
export function infoPagamentoFatura(cartao, fat) {
  const v = vencimentoDaFatura(fat, cartao);
  const chave = chaveMes(v.ano, v.mes);
  const raw = (cartao.faturasPagas || {})[chave];
  const info = raw && typeof raw === 'object' ? raw : { pago: !!raw };
  return { chave, pago: !!info.pago, contaId: info.contaId ?? null, valor: info.valor ?? null };
}

// Itens (compras, estornos e fixos) que compõem uma fatura.
export function itensDaFatura(lancamentos, cartao, fat) {
  const out = [];
  for (const l of lancamentos) {
    if (l.cartaoId !== cartao.id || l.tipo === 'transferencia') continue;
    const base = faturaDoLancamento(l, cartao);
    if (l.fixo) {
      const k = difMeses(base, fat);
      if (k < 0) continue;
      const oc = ocorrenciaFixo(l, k);
      if (oc) out.push({ ...oc, faturaMes: fat.mes, faturaAno: fat.ano });
    } else if (mesmoMes(base, fat)) {
      out.push(l);
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

// Total a pagar: despesas somam, receitas (estornos) abatem.
export function totalDosItens(itens) {
  return arred(itens.reduce((s, l) => s + (l.tipo === 'receita' ? -1 : 1) * Math.abs(l.valor || 0), 0));
}

// Fatura no formato de "lançamento virtual" usado pelo Fluxo.
export function montarFatura(cartao, lancamentos, fat) {
  const itens = itensDaFatura(lancamentos, cartao, fat);
  const total = totalDosItens(itens);
  const pg = infoPagamentoFatura(cartao, fat);
  if (itens.length === 0 && !pg.pago) return null;
  const valor = pg.pago && pg.valor != null ? pg.valor : total;
  return {
    id: `fatura-${cartao.id}-${pg.chave}`,
    descricao: `Fatura ${MESES[fat.mes]} ${fat.ano}`,
    valor: -valor,
    data: dataVencimento(fat, cartao),
    tipo: 'despesa',
    categoria: 'Fatura Cartão',
    cartaoId: cartao.id,
    contaId: null,
    pago: pg.pago,
    _isFatura: true,
    _cartaoNome: cartao.nome,
    _cartaoBanco: cartao.banco,
    _cartaoCor: cartao.cor,
    _mesAno: pg.chave,
    _contaIdPagamento: pg.contaId,
    _fatura: fat,
    _totalItens: total,
  };
}

// Faturas cujo VENCIMENTO cai em [inicio, fim].
export function faturasNoPeriodo(cartoes, lancamentos, inicio, fim) {
  const out = [];
  const mFim = mesAnoDaData(fim);
  for (const cartao of cartoes) {
    for (let m = mesAnoDaData(inicio); difMeses(m, mFim) >= 0; m = somarMeses(m, 1)) {
      const fat = faturaQueVenceEm(m, cartao);
      const data = dataVencimento(fat, cartao);
      if (data < inicio || data > fim) continue;
      const f = montarFatura(cartao, lancamentos, fat);
      if (f) out.push(f);
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

// Fatura do ciclo aberto hoje.
export function faturaAtual(cartao, hoje = hojeISO()) {
  return faturaDaCompra(hoje, cartao.diaFechamento);
}

// Limite comprometido: tudo que está em faturas ainda não pagas (inclui parcelas
// futuras) + fixos da fatura atual. Estornos liberam limite.
export function limiteUsado(cartao, lancamentos, hoje = hojeISO()) {
  const atual = faturaAtual(cartao, hoje);
  const pagaAtual = infoPagamentoFatura(cartao, atual).pago;
  let usado = 0;
  for (const l of lancamentos) {
    if (l.cartaoId !== cartao.id || l.tipo === 'transferencia') continue;
    const v = (l.tipo === 'receita' ? -1 : 1) * Math.abs(l.valor || 0);
    const base = faturaDoLancamento(l, cartao);
    if (l.fixo) {
      const k = difMeses(base, atual);
      if (k >= 0 && !pagaAtual && ocorrenciaFixo(l, k)) usado += v;
    } else if (!infoPagamentoFatura(cartao, base).pago) {
      usado += v;
    }
  }
  return arred(usado);
}

export function diasAteVencimento(cartao, hoje = hojeISO()) {
  const ma = mesAnoDaData(hoje);
  let venc = diaNoMes(ma, cartao.diaVencimento);
  if (venc < hoje) venc = diaNoMes(somarMeses(ma, 1), cartao.diaVencimento);
  return diasEntre(hoje, venc);
}

// ── Saldos ───────────────────────────────────────────────────────────────────
// Como um lançamento mexe nas contas. Transferência: sai da origem, entra no destino.
function aplicarEfeito(l, add) {
  const v = Math.abs(l.valor || 0);
  if (l.tipo === 'receita') add(l.contaId, v);
  else if (l.tipo === 'despesa') add(l.contaId, -v);
  else if (l.tipo === 'transferencia') {
    add(l.contaId, -v);
    add(l.contaDestinoId, v);
  }
}

// Data mais antiga relevante (para começar varreduras de previsto).
function dataMaisAntiga(dados) {
  let min = null;
  const ver = (iso) => { if (iso && (!min || iso < min)) min = iso; };
  (dados.lancamentos || []).forEach((l) => {
    ver(l.data);
    if (l.cartaoId && l.faturaMes != null) ver(inicioDoMes({ ano: l.faturaAno, mes: l.faturaMes }));
  });
  (dados.cartoes || []).forEach((c) => Object.keys(c.faturasPagas || {}).forEach((k) => ver(`${k}-01`)));
  return min;
}

// Saldo REALIZADO por conta: saldo inicial + tudo que está marcado como pago.
// `ate` (opcional) limita aos movimentos com data até esse dia.
export function calcularSaldos(dados, { ate = null } = {}) {
  const contas = dados.contas || [];
  const cartoes = dados.cartoes || [];
  const lancamentos = dados.lancamentos || [];
  const mov = new Map();
  const add = (id, d) => {
    if (id == null || id === '') return;
    const k = String(id);
    mov.set(k, (mov.get(k) || 0) + d);
  };

  for (const l of lancamentos) {
    if (l.cartaoId) continue;
    if (l.fixo) {
      let horizonte = ate;
      if (!horizonte) {
        horizonte = l.data;
        Object.keys(l.pagoPorMes || {}).forEach((k) => {
          const f = fimDoMes(mesAnoDaChave(k));
          if (f > horizonte) horizonte = f;
        });
      }
      ocorrenciasFixo(l, l.data, horizonte).filter((o) => o.pago).forEach((o) => aplicarEfeito(o, add));
    } else if (l.pago && (!ate || l.data <= ate)) {
      aplicarEfeito(l, add);
    }
  }

  let semConta = 0; // faturas antigas marcadas como pagas sem informar a conta
  for (const cartao of cartoes) {
    for (const [chave, raw] of Object.entries(cartao.faturasPagas || {})) {
      const info = raw && typeof raw === 'object' ? raw : { pago: !!raw };
      if (!info.pago) continue;
      const fat = faturaQueVenceEm(mesAnoDaChave(chave), cartao);
      if (ate && dataVencimento(fat, cartao) > ate) continue;
      const valor = info.valor != null ? info.valor : totalDosItens(itensDaFatura(lancamentos, cartao, fat));
      if (info.contaId != null && contas.some((c) => String(c.id) === String(info.contaId))) add(info.contaId, -valor);
      else semConta -= valor;
    }
  }

  const porConta = contas.map((c) => ({
    ...c,
    saldoAtual: arred((c.saldo || 0) + (mov.get(String(c.id)) || 0)),
  }));
  const saldoGeral = arred(porConta.reduce((s, c) => s + c.saldoAtual, 0) + semConta);
  return { porConta, saldoGeral };
}

// Saldo PREVISTO ao final de `fim`: saldo inicial + todos os lançamentos de conta
// até `fim` (pagos ou não) − todas as faturas que vencem até `fim`.
export function saldoPrevisto(dados, fim) {
  const contas = dados.contas || [];
  const cartoes = dados.cartoes || [];
  const lancamentos = dados.lancamentos || [];
  const idsContas = new Set(contas.map((c) => String(c.id)));
  let total = contas.reduce((s, c) => s + (c.saldo || 0), 0);
  const add = (id, d) => { if (id != null && idsContas.has(String(id))) total += d; };

  const inicio = dataMaisAntiga(dados);
  if (!inicio || inicio > fim) return arred(total);

  lancamentosContaNoPeriodo(lancamentos, inicio, fim).forEach((l) => aplicarEfeito(l, add));
  faturasNoPeriodo(cartoes, lancamentos, inicio, fim).forEach((f) => { total -= Math.abs(f.valor); });
  return arred(total);
}

// Totais de uma lista (já filtrada) de lançamentos + faturas.
// Transferências não são entrada nem saída.
export function totaisDe(itens, faturas = []) {
  const soma = (arr) => arred(arr.reduce((s, l) => s + Math.abs(l.valor || 0), 0));
  const rec = itens.filter((l) => l.tipo === 'receita');
  const desp = [...itens.filter((l) => l.tipo === 'despesa'), ...faturas];
  return {
    entradasPrev: soma(rec),
    saidasPrev: soma(desp),
    entradasReais: soma(rec.filter((l) => l.pago)),
    saidasReais: soma(desp.filter((l) => l.pago)),
  };
}

// Resumo do período usado pela Home e pelo Fluxo (sem filtros).
export function resumoPeriodo(dados, inicio, fim) {
  const itens = lancamentosContaNoPeriodo(dados.lancamentos || [], inicio, fim);
  const faturas = faturasNoPeriodo(dados.cartoes || [], dados.lancamentos || [], inicio, fim);
  return { itens, faturas, ...totaisDe(itens, faturas) };
}

// ── Parcelamento ─────────────────────────────────────────────────────────────
export const PERIODOS_PARCELA = {
  Semanas: { dias: 7 },
  Quinzenas: { dias: 15 },
  Meses: { meses: 1 },
  Bimestres: { meses: 2 },
  Trimestres: { meses: 3 },
  Semestres: { meses: 6 },
  Anos: { meses: 12 },
};

export function dataDaParcela(iso, i, periodo = 'Meses') {
  const p = PERIODOS_PARCELA[periodo] || PERIODOS_PARCELA.Meses;
  return p.dias ? addDias(iso, p.dias * i) : addMeses(iso, p.meses * i, { ultimoDia: false });
}

// Divide em centavos exatos: a diferença de arredondamento vai para a 1ª parcela.
// dividirEmParcelas(10000, 3) → [33.34, 33.33, 33.33]
export function dividirEmParcelas(totalCentavos, n) {
  const qtd = Math.max(1, n | 0);
  const base = Math.floor(totalCentavos / qtd);
  const resto = totalCentavos - base * qtd;
  return Array.from({ length: qtd }, (_, i) => (base + (i === 0 ? resto : 0)) / 100);
}
