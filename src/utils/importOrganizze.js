// ─────────────────────────────────────────────────────────────────────────────
// importOrganizze.js — converte o export do Organizze (.xls, uma aba por conta)
// para o formato do app. Função pura: recebe as linhas já lidas da planilha.
//
// Regras:
//   • Aba com coluna "Fatura" = cartão de crédito; as demais = contas.
//   • Linhas "Fatura <Mês> <Ano>" sem categoria na aba do cartão são só a
//     soma prevista da fatura → descartadas.
//   • "Pagamento de fatura" de um cartão que está no export vira fatura paga
//     (faturasPagas) com a conta e a data do pagamento. Pagamentos de cartões
//     que não estão no export (C6, Amex...) continuam como despesa normal.
//   • "Transferências" com o mesmo valor saindo de uma conta e entrando em outra
//     no mesmo dia viram uma transferência só.
//   • "n/m" no fim da descrição = parcela (agrupadas por grupoId).
//   • A partir do mês atual, séries mensais iguais (mesma descrição, categoria,
//     valor e dia) com 3+ ocorrências viram UM lançamento fixo.
// ─────────────────────────────────────────────────────────────────────────────
import {
  gerarId, addMeses, difMeses, mesAnoDaData, chaveDaData, chaveMes, somarMeses,
  faturaQueVenceEm, faturaDaCompra, vencimentoDaFatura, mesmoMes, hojeISO, inicioDoMes,
  calcularSaldos, itensDaFatura, totalDosItens, faturaAtual, MESES, arred, pad2,
} from './financas.js';
import { RE_PROJECAO_FATURA } from './migracoes.js';

const MESES_NORM = MESES.map((m) => normalizar(m));

export function normalizar(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// ── Leitura de células ───────────────────────────────────────────────────────
export function lerData(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') { // serial do Excel
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  if (v instanceof Date) return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return `${m[3]}-${pad2(+m[2])}-${pad2(+m[1])}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export function lerValor(v) {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().replace(/[R$\s]/g, '');
  if (!s) return 0;
  // "1.234,56" → 1234.56 ; "-28.15" → -28.15
  const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
  return Number.isFinite(n) ? n : 0;
}

// "Novembro/2026" ou "Novembro 2026" → { ano, mes } (mês do VENCIMENTO)
export function lerMesAno(t) {
  const m = normalizar(t).match(/([a-zç]+)\s*(?:\/|de)?\s*(\d{4})/);
  if (!m) return null;
  const mes = MESES_NORM.indexOf(m[1]);
  return mes < 0 ? null : { ano: Number(m[2]), mes };
}

// Pega o valor de uma coluna tolerando variações de nome/acento
function col(row, ...nomes) {
  for (const n of nomes) {
    const k = Object.keys(row).find((c) => normalizar(c) === normalizar(n));
    if (k !== undefined) return row[k];
  }
  return '';
}

// ── Aparência das contas ─────────────────────────────────────────────────────
const VISUAL = [
  { chave: 'santander', cor: '#e11d48', icone: 'S' },
  { chave: 'nubank', cor: '#7c3aed', icone: 'NU' },
  { chave: 'c6', cor: '#000000', icone: 'C6' },
  { chave: 'caixa', cor: '#f97316', icone: 'CX' },
  { chave: 'mercado pago', cor: '#22c55e', icone: 'MP' },
  { chave: 'dinheiro', cor: '#6b7280', icone: '$' },
  { chave: 'itau', cor: '#ec7000', icone: 'IT' },
  { chave: 'bradesco', cor: '#cc092f', icone: 'BR' },
  { chave: 'inter', cor: '#ff7a00', icone: 'IN' },
];
function visualPara(nome, existentes) {
  const n = normalizar(nome);
  const ex = existentes.find((c) => normalizar(c.nome) === n || n.startsWith(normalizar(c.nome)) || normalizar(c.nome).startsWith(n));
  if (ex) return { cor: ex.cor, icone: ex.icone, tipo: ex.tipo };
  const v = VISUAL.find((x) => n.includes(x.chave));
  return {
    cor: v?.cor || '#16a34a',
    icone: v?.icone || nome.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?',
    tipo: n.includes('dinheiro') || n.includes('carteira') ? 'Carteira' : 'Conta corrente',
  };
}

export const EMOJIS_ORGANIZZE = {
  'moradia': '🏠', 'alimentacao': '🍔', 'mercado': '🛒', 'utilidades': '💡', 'viagem': '✈️',
  'assinaturas e servicos': '📺', 'assinatura': '📺', 'aluguel': '🏘️', 'imovel': '🏗️', 'saude': '💊',
  'transporte': '🚗', 'carro': '🚗', 'gasolina': '⛽', 'lazer': '🎉', 'educacao': '📚', 'salario': '💼',
  'renda': '💼', 'outras receitas': '💰', 'investimentos': '📈', 'emprestimos': '🤝', 'dividas': '🧾',
  'familia e filhos': '👨‍👧', 'compras': '🛍️', 'transferencias': '🔁', 'pagamento de fatura': '💳',
  'aposta': '🎲', 'loteria': '🍀', 'cerveja': '🍺', 'bares e restaurantes': '🍽️', 'presentes e doacoes': '🎁',
  'pets': '🐶', 'despesas pessoais': '🧍', 'impostos e taxas': '🏛️', 'apto praia': '🏖️', 'moto crosser': '🏍️',
  'picpay': '📱', 'outros': '📌',
};
export function emojiDaCategoria(nome) {
  return EMOJIS_ORGANIZZE[normalizar(nome)] || '📌';
}

const RE_PARCELA = /^(.*?)\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*$/;

// ── Conversão ────────────────────────────────────────────────────────────────
export function converterOrganizze(abas, opcoes = {}) {
  const hoje = opcoes.hoje || hojeISO();
  const existentes = opcoes.existentes || { contas: [], cartoes: [] };
  const cfgCartao = { diaFechamento: 30, diaVencimento: 7, ...(opcoes.cartao || {}) };
  const inicioFixos = inicioDoMes(mesAnoDaData(hoje));
  const avisos = [];

  const contas = [];
  const cartoes = [];
  const linhas = []; // itens intermediários
  const esperado = {}; // contaId → soma dos "Pago" no export
  const contasQuePagamCartao = [];

  // 1) Abas → contas/cartões + linhas
  for (const [nomeAba, rows] of Object.entries(abas)) {
    if (!rows || rows.length === 0) continue;
    const ehCartao = Object.keys(rows[0]).some((c) => normalizar(c) === 'fatura');
    const nome = nomeAba.replace(/\s*\(\d+\)\s*$/, '').trim();
    if (ehCartao) {
      const ex = existentes.cartoes.find((c) => normalizar(c.banco) === normalizar(nome) || normalizar(c.nome).includes(normalizar(nome)));
      const cartao = {
        id: gerarId(), nome: ex?.nome || nome, banco: ex?.banco || nome, cor: ex?.cor || visualPara(nome, []).cor,
        limite: ex?.limite || 0, diaFechamento: cfgCartao.diaFechamento, diaVencimento: cfgCartao.diaVencimento,
        faturasPagas: {}, _aba: nomeAba,
      };
      cartoes.push(cartao);
      for (const r of rows) {
        const data = lerData(col(r, 'Data'));
        if (!data) continue;
        const descricao = String(col(r, 'Descrição', 'Descricao')).trim();
        const categoria = String(col(r, 'Categoria')).trim();
        if (!categoria && /^fatura\s/i.test(descricao)) continue; // projeção da fatura
        const venc = lerMesAno(col(r, 'Fatura'));
        // sem "Fatura" (fim do período exportado): calcula pela data, mas deixa a série do fixo decidir
        const fat = venc ? faturaQueVenceEm(venc, cartao) : faturaDaCompra(data, cartao.diaFechamento);
        const fatInferida = !venc;
        linhas.push({
          aba: nomeAba, data, descricao, categoria: categoria || 'Outros', valor: lerValor(col(r, 'Valor')),
          pago: true, cartaoId: cartao.id, fat, fatInferida,
          observacao: String(col(r, 'Informações adicionais', 'Informacoes adicionais')).trim(),
          tags: String(col(r, 'Tags')).trim(),
        });
      }
    } else {
      const vis = visualPara(nome, existentes.contas);
      const conta = { id: gerarId(), nome: nomeAba.trim(), tipo: vis.tipo, cor: vis.cor, icone: vis.icone, saldo: 0 };
      contas.push(conta);
      esperado[conta.id] = 0;
      for (const r of rows) {
        const data = lerData(col(r, 'Data'));
        if (!data) continue;
        const valor = lerValor(col(r, 'Valor'));
        const pago = normalizar(col(r, 'Situação', 'Situacao')) === 'pago';
        const descricao = String(col(r, 'Descrição', 'Descricao')).trim();
        // "Fatura <Mês> <Ano>" sem categoria e não paga: é a previsão de pagamento da fatura que o
        // Organizze gera sozinho na conta que paga o cartão — o app calcula a fatura de verdade
        if (!pago && !String(col(r, 'Categoria')).trim() && RE_PROJECAO_FATURA.test(descricao)) {
          contasQuePagamCartao.push(conta.id);
          continue;
        }
        if (pago) esperado[conta.id] += valor;
        linhas.push({
          aba: nomeAba, data, descricao,
          categoria: String(col(r, 'Categoria')).trim() || 'Outros', valor, pago, contaId: conta.id,
          observacao: String(col(r, 'Informações adicionais', 'Informacoes adicionais')).trim(),
          tags: String(col(r, 'Tags')).trim(),
        });
      }
    }
  }

  // 2) Pagamentos de fatura → faturasPagas
  const totaisFatura = new Map(); // cartaoId → Map(chaveVenc → total)
  for (const c of cartoes) {
    const m = new Map();
    linhas.filter((l) => l.cartaoId === c.id).forEach((l) => {
      const v = vencimentoDaFatura(l.fat, c);
      const k = chaveMes(v.ano, v.mes);
      m.set(k, arred((m.get(k) || 0) - l.valor)); // despesa soma, estorno abate
    });
    totaisFatura.set(c.id, m);
  }
  let pagamentosVinculados = 0;
  const removidas = new Set();
  linhas.forEach((l, i) => {
    if (!l.contaId || normalizar(l.categoria) !== 'pagamento de fatura') return;
    const desc = normalizar(l.descricao);
    // cartão citado na descrição; sem nome → único cartão do export (se houver só um)
    let cartao = cartoes.find((c) => desc.includes(normalizar(c.banco)) || desc.includes(normalizar(c.nome)));
    const semNome = desc === 'pagamento de fatura';
    if (!cartao && semNome && cartoes.length === 1) cartao = cartoes[0];
    if (!cartao) return; // cartão fora do export → fica como despesa
    if (l.valor === 0) { removidas.add(i); return; }
    const totais = totaisFatura.get(cartao.id);
    const valor = Math.abs(l.valor);
    let chave = null;
    const mesDesc = lerMesAno(l.descricao.split('-').slice(2).join('-'));
    if (mesDesc) chave = chaveMes(mesDesc.ano, mesDesc.mes);
    if (!chave) {
      // fatura com o mesmo total, com vencimento mais próximo da data do pagamento
      const alvo = mesAnoDaData(l.data);
      let melhor = null;
      for (const [k, t] of totais) {
        if (Math.abs(t - valor) > 0.005) continue;
        const dist = Math.abs(difMeses(alvo, { ano: +k.slice(0, 4), mes: +k.slice(5, 7) - 1 }));
        if (dist <= 2 && (!melhor || dist < melhor.dist)) melhor = { k, dist };
      }
      chave = melhor?.k || null;
    }
    if (!chave || cartao.faturasPagas[chave]) return; // não deu para vincular → mantém como despesa
    cartao.faturasPagas[chave] = { pago: true, contaId: l.contaId, valor, data: l.data };
    removidas.add(i);
    pagamentosVinculados++;
  });

  // Faturas já vencidas sem pagamento identificado: pagas "por fora" (não mexem no saldo)
  let faturasPagasPorFora = 0;
  for (const c of cartoes) {
    for (const [k, total] of totaisFatura.get(c.id)) {
      if (c.faturasPagas[k]) continue;
      const fat = faturaQueVenceEm({ ano: +k.slice(0, 4), mes: +k.slice(5, 7) - 1 }, c);
      const venc = `${k}-${pad2(Math.min(c.diaVencimento, 28))}`;
      if (venc < hoje && total !== 0 && !mesmoMes(fat, faturaAtual(c, hoje))) {
        c.faturasPagas[k] = { pago: true, externo: true };
        faturasPagasPorFora++;
      }
    }
  }

  // 3) Transferências entre contas do export
  const restantes = linhas.filter((_, i) => !removidas.has(i));
  const transf = restantes.filter((l) => l.contaId && normalizar(l.categoria) === 'transferencias');
  const usadas = new Set();
  const transferencias = [];
  for (const saida of transf) {
    if (saida.valor >= 0 || usadas.has(saida)) continue;
    const entrada = transf.find((e) => !usadas.has(e) && e !== saida && e.contaId !== saida.contaId &&
      e.data === saida.data && Math.abs(e.valor + saida.valor) < 0.005 && e.pago === saida.pago);
    if (!entrada) continue;
    usadas.add(saida); usadas.add(entrada);
    transferencias.push({
      ...saida, tipo: 'transferencia', valor: Math.abs(saida.valor), contaDestinoId: entrada.contaId,
      observacao: [saida.observacao, entrada.observacao].filter(Boolean).join('\n'),
    });
  }
  const simples = restantes.filter((l) => !usadas.has(l));

  // tipo de lançamentos com valor 0: pela "cara" da categoria no próprio export
  const sinalCat = {};
  simples.forEach((l) => { if (l.valor !== 0) sinalCat[l.categoria] = (sinalCat[l.categoria] || 0) + Math.sign(l.valor); });
  const tipoDe = (l) => (l.valor > 0 || (l.valor === 0 && (sinalCat[l.categoria] || 0) > 0) ? 'receita' : 'despesa');

  // 4) Parcelas
  const grupos = new Map();
  simples.forEach((l) => {
    const m = l.descricao.match(RE_PARCELA);
    if (!m) return;
    const parcela = Number(m[2]); const total = Number(m[3]);
    if (!(total >= 2 && parcela >= 1 && parcela <= total)) return;
    const inicio = somarMeses(l.cartaoId ? l.fat : mesAnoDaData(l.data), -(parcela - 1));
    const chave = `${l.aba}|${normalizar(m[1])}|${total}|${inicio.ano}-${inicio.mes}`;
    if (!grupos.has(chave)) grupos.set(chave, gerarId());
    l._parcela = { parcela, totalParcelas: total, grupoId: grupos.get(chave) };
  });

  // 5) Fixos: séries mensais a partir do mês atual
  const candidatos = new Map();
  simples.forEach((l) => {
    if (l._parcela || l.data < inicioFixos) return;
    const k = `${l.aba}|${normalizar(l.descricao)}|${normalizar(l.categoria)}`;
    if (!candidatos.has(k)) candidatos.set(k, []);
    candidatos.get(k).push(l);
  });
  const horizonte = {}; // último mês exportado por aba
  simples.forEach((l) => { const c = chaveDaData(l.data); if (!horizonte[l.aba] || c > horizonte[l.aba]) horizonte[l.aba] = c; });

  const viraramFixo = new Set();
  const fixos = [];
  for (const serie of candidatos.values()) {
    if (serie.length < 3) continue;
    serie.sort((a, b) => a.data.localeCompare(b.data));
    const meses = serie.map((l) => chaveDaData(l.data));
    if (new Set(meses).size !== meses.length) continue; // mais de um por mês → não é fixo
    // quebra em segmentos com mesmo valor, mesmo "dia" e (no cartão) faturas em sequência
    const segmentos = [];
    let seg = null;
    for (const l of serie) {
      if (seg) {
        const base = seg[0];
        const k = difMeses(mesAnoDaData(base.data), mesAnoDaData(l.data));
        const ok = l.valor === base.valor && addMeses(base.data, k) === l.data &&
          (!l.cartaoId || l.fatInferida || mesmoMes(somarMeses(base.fat, k), l.fat)) &&
          difMeses(mesAnoDaData(seg[seg.length - 1].data), mesAnoDaData(l.data)) <= 3;
        if (ok) { seg.push(l); continue; }
        segmentos.push(seg);
      }
      seg = [l];
    }
    if (seg) segmentos.push(seg);

    for (const s of segmentos) {
      if (s.length < 3) continue;
      const base = s[0];
      const presentes = new Set(s.map((l) => chaveDaData(l.data)));
      const ultimo = chaveDaData(s[s.length - 1].data);
      const excecoesMeses = [];
      for (let k = 1; ; k++) {
        const ch = chaveDaData(addMeses(base.data, k));
        if (ch > ultimo) break;
        if (!presentes.has(ch)) excecoesMeses.push(ch);
      }
      const pagoPorMes = {};
      s.slice(1).forEach((l) => { if (l.pago) pagoPorMes[chaveDaData(l.data)] = true; });
      const fim = ultimo < horizonte[base.aba] ? chaveDaData(addMeses(`${ultimo}-01`, 1)) : null;
      fixos.push({ ...base, fixo: true, pagoPorMes, excecoesMeses, ...(fim ? { fixoFimData: fim } : {}) });
      s.forEach((l) => viraramFixo.add(l));
    }
  }

  // 6) Monta os lançamentos finais
  // eslint-disable-next-line no-unused-vars
  const limpar = ({ aba, fat, fatInferida, _parcela, ...l }) => {
    const out = { ...l, id: gerarId(), tipo: l.tipo || tipoDe(l) };
    out.valor = out.tipo === 'despesa' ? -Math.abs(l.valor) : Math.abs(l.valor);
    if (l.cartaoId) { out.faturaMes = fat.mes; out.faturaAno = fat.ano; out.contaId = null; } else { out.cartaoId = null; }
    if (_parcela) Object.assign(out, { parcelado: true, ..._parcela }); else out.parcelado = false;
    if (out.fixo !== true) out.fixo = false;
    if (!out.observacao) delete out.observacao;
    if (!out.tags) delete out.tags;
    return out;
  };
  const lancamentos = [
    ...simples.filter((l) => !viraramFixo.has(l)).map(limpar),
    ...fixos.map(limpar),
    ...transferencias.map(limpar),
  ].sort((a, b) => a.data.localeCompare(b.data));

  // Categorias usadas
  const nomesCat = [...new Set(lancamentos.map((l) => l.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const categorias = nomesCat.map((nome, i) => ({ id: i + 1, nome, emoji: emojiDaCategoria(nome) }));

  cartoes.forEach((c) => delete c._aba);
  if (cartoes.length === 1 && contasQuePagamCartao.length) cartoes[0].contaPagamentoId = contasQuePagamCartao[0];
  const dados = { contas, cartoes, lancamentos, categorias };

  // 7) Conferência
  const { porConta } = calcularSaldos(dados);
  const conferenciaContas = contas.map((c) => {
    const app = porConta.find((p) => p.id === c.id).saldoAtual;
    const exp = arred(esperado[c.id]);
    if (Math.abs(app - exp) > 0.005) avisos.push(`Saldo de ${c.nome} não bateu: export ${exp} × app ${app}`);
    return { nome: c.nome, esperado: exp, app, ok: Math.abs(app - exp) <= 0.005 };
  });
  const conferenciaCartoes = cartoes.map((c) => {
    const atual = faturaAtual(c, hoje);
    const faturas = [];
    for (let i = -1; i <= 1; i++) {
      const fat = somarMeses(atual, i);
      const v = vencimentoDaFatura(fat, c);
      const chave = chaveMes(v.ano, v.mes);
      faturas.push({
        nome: `${MESES[v.mes]} ${v.ano}`,
        app: totalDosItens(itensDaFatura(lancamentos, c, fat)),
        esperado: totaisFatura.get(c.id).get(chave) ?? 0,
        paga: !!c.faturasPagas[chave]?.pago,
      });
    }
    return { nome: c.nome, faturas };
  });
  conferenciaCartoes.forEach((c) => c.faturas.forEach((f) => {
    if (Math.abs(f.app - f.esperado) > 0.005) avisos.push(`Fatura ${f.nome} de ${c.nome} não bateu: export ${f.esperado} × app ${f.app}`);
  }));

  const datas = lancamentos.map((l) => l.data);
  return {
    dados,
    relatorio: {
      linhasLidas: linhas.length,
      lancamentos: lancamentos.length,
      contas: contas.length,
      cartoes: cartoes.length,
      fixos: fixos.length,
      linhasEmFixos: viraramFixo.size,
      gruposParcelas: grupos.size,
      transferencias: transferencias.length,
      pagamentosVinculados,
      faturasPagasPorFora,
      categorias: categorias.length,
      periodo: datas.length ? { de: datas[0], ate: datas[datas.length - 1] } : null,
      conferenciaContas,
      conferenciaCartoes,
      avisos,
    },
  };
}
