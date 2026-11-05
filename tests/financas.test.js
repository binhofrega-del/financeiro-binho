// Testes da camada de cálculo. Rodar com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMeses, hojeISO, intervaloDoPeriodo, ocorrenciasFixo, lancamentosContaNoPeriodo,
  itensDaFatura, totalDosItens, faturasNoPeriodo, calcularSaldos, saldoPrevisto,
  resumoPeriodo, dividirEmParcelas, dataDaParcela, limiteUsado, diasAteVencimento,
  faturaDaCompra, gerarId,
} from '../src/utils/financas.js';

const nubank = { id: 1, nome: 'Roxinho', banco: 'Nubank', limite: 5000, diaFechamento: 8, diaVencimento: 15 };
const contas = [
  { id: 1, nome: 'Santander', saldo: 1000 },
  { id: 2, nome: 'C6', saldo: 0 },
];

// ── Datas ───────────────────────────────────────────────────────────────────
test('hoje usa horário LOCAL, não UTC (bug das 21h)', () => {
  // 04/11 às 22:30 em São Paulo = 05/11 01:30 UTC
  const d = new Date(2026, 10, 4, 22, 30);
  assert.equal(hojeISO(d), '2026-11-04');
});

test('somar meses não escorrega no dia 31', () => {
  assert.equal(addMeses('2026-01-31', 1, { ultimoDia: false }), '2026-02-28');
  assert.equal(addMeses('2026-01-31', 2, { ultimoDia: false }), '2026-03-31');
  assert.equal(addMeses('2026-01-30', 1, { ultimoDia: false }), '2026-02-28');
  // fixo criado no último dia do mês continua no último dia
  assert.equal(addMeses('2026-02-28', 1), '2026-03-31');
  assert.equal(addMeses('2026-12-15', 1), '2027-01-15');
});

test('intervalo de semana vai de segunda a domingo', () => {
  assert.deepEqual(intervaloDoPeriodo('semana', '2026-11-04'), { inicio: '2026-11-02', fim: '2026-11-08' });
  assert.deepEqual(intervaloDoPeriodo('mes', '2026-02-10'), { inicio: '2026-02-01', fim: '2026-02-28' });
});

// ── Parcelas ────────────────────────────────────────────────────────────────
test('parcelas fecham no centavo', () => {
  const p = dividirEmParcelas(10000, 3);
  assert.deepEqual(p, [33.34, 33.33, 33.33]);
  assert.equal(Math.round(p.reduce((a, b) => a + b, 0) * 100), 10000);
});

test('periodicidade das parcelas é respeitada', () => {
  assert.equal(dataDaParcela('2026-11-04', 2, 'Semanas'), '2026-11-18');
  assert.equal(dataDaParcela('2026-11-04', 1, 'Quinzenas'), '2026-11-19');
  assert.equal(dataDaParcela('2026-11-04', 1, 'Trimestres'), '2027-02-04');
  assert.equal(dataDaParcela('2026-01-31', 1, 'Meses'), '2026-02-28');
});

test('gerarId nunca repete', () => {
  const ids = new Set(Array.from({ length: 1000 }, gerarId));
  assert.equal(ids.size, 1000);
});

// ── Fixos ───────────────────────────────────────────────────────────────────
test('fixo respeita exceção, data de término e pago por mês', () => {
  const luz = {
    id: 10, descricao: 'Luz', valor: -200, data: '2026-06-08', tipo: 'despesa', contaId: 1, fixo: true,
    pago: true, excecoesMeses: ['2026-08'], fixoFimData: '2026-11', pagoPorMes: { '2026-07': true },
  };
  const oc = ocorrenciasFixo(luz, '2026-01-01', '2027-12-31');
  assert.deepEqual(oc.map((o) => o.data), ['2026-06-08', '2026-07-08', '2026-09-08', '2026-10-08']);
  assert.deepEqual(oc.map((o) => o.pago), [true, true, false, false]);
});

test('fixo pago em mês posterior ENTRA no saldo da conta (bug 2)', () => {
  const dados = {
    contas, cartoes: [],
    lancamentos: [{ id: 1, valor: -100, data: '2026-06-10', tipo: 'despesa', contaId: 1, fixo: true, pago: true, pagoPorMes: { '2026-07': true, '2026-08': true } }],
  };
  const { porConta } = calcularSaldos(dados);
  assert.equal(porConta[0].saldoAtual, 700); // 1000 − 3 × 100
});

// ── Transferências ──────────────────────────────────────────────────────────
test('transferência sai da origem e entra no destino (bug 1)', () => {
  const dados = {
    contas, cartoes: [],
    lancamentos: [{ id: 1, valor: 300, data: '2026-11-01', tipo: 'transferencia', contaId: 1, contaDestinoId: 2, pago: true }],
  };
  const { porConta, saldoGeral } = calcularSaldos(dados);
  assert.equal(porConta[0].saldoAtual, 700);
  assert.equal(porConta[1].saldoAtual, 300);
  assert.equal(saldoGeral, 1000);
  // e não conta como entrada nem saída no resumo
  const r = resumoPeriodo(dados, '2026-11-01', '2026-11-30');
  assert.equal(r.entradasPrev, 0);
  assert.equal(r.saidasPrev, 0);
  // nem muda o previsto total
  assert.equal(saldoPrevisto(dados, '2026-11-30'), 1000);
});

// ── Cartão ──────────────────────────────────────────────────────────────────
test('compra até o fechamento cai na fatura do mês, depois cai na próxima', () => {
  assert.deepEqual(faturaDaCompra('2026-11-08', 8), { ano: 2026, mes: 10 });
  assert.deepEqual(faturaDaCompra('2026-11-09', 8), { ano: 2026, mes: 11 });
  assert.deepEqual(faturaDaCompra('2026-12-20', 8), { ano: 2027, mes: 0 });
});

test('fixo no cartão se repete em todas as faturas (bug 3)', () => {
  const lanc = [{ id: 1, descricao: 'Netflix', valor: -40, data: '2026-06-05', tipo: 'despesa', cartaoId: 1, fixo: true, faturaMes: 5, faturaAno: 2026, excecoesMeses: ['2026-09'] }];
  const tot = (ano, mes) => totalDosItens(itensDaFatura(lanc, nubank, { ano, mes }));
  assert.equal(tot(2026, 4), 0);   // antes de criar
  assert.equal(tot(2026, 5), 40);
  assert.equal(tot(2026, 7), 40);
  assert.equal(tot(2026, 8), 0);   // exceção de setembro
  assert.equal(tot(2026, 10), 40);
});

test('estorno no cartão abate a fatura', () => {
  const lanc = [
    { id: 1, valor: -100, data: '2026-11-02', tipo: 'despesa', cartaoId: 1, faturaMes: 10, faturaAno: 2026 },
    { id: 2, valor: 30, data: '2026-11-03', tipo: 'receita', cartaoId: 1, faturaMes: 10, faturaAno: 2026 },
  ];
  assert.equal(totalDosItens(itensDaFatura(lanc, nubank, { ano: 2026, mes: 10 })), 70);
});

test('fatura aparece no dia do vencimento e paga desconta da conta escolhida', () => {
  const cartao = { ...nubank, faturasPagas: { '2026-11': { pago: true, contaId: 1, valor: 250 } } };
  const lanc = [{ id: 1, valor: -250, data: '2026-10-20', tipo: 'despesa', cartaoId: 1, faturaMes: 10, faturaAno: 2026 }];
  const f = faturasNoPeriodo([cartao], lanc, '2026-11-01', '2026-11-30');
  assert.equal(f.length, 1);
  assert.equal(f[0].data, '2026-11-15');
  assert.equal(f[0].pago, true);
  const { porConta } = calcularSaldos({ contas, cartoes: [cartao], lancamentos: lanc });
  assert.equal(porConta[0].saldoAtual, 750);
});

test('limite considera parcelas futuras e libera faturas pagas', () => {
  const cartao = { ...nubank, faturasPagas: { '2026-10': { pago: true, contaId: 1, valor: 100 } } };
  const lanc = [
    { id: 1, valor: -100, data: '2026-09-20', tipo: 'despesa', cartaoId: 1, faturaMes: 9, faturaAno: 2026 }, // out (paga)
    { id: 2, valor: -100, data: '2026-11-01', tipo: 'despesa', cartaoId: 1, faturaMes: 10, faturaAno: 2026, parcelado: true },
    { id: 3, valor: -100, data: '2026-12-01', tipo: 'despesa', cartaoId: 1, faturaMes: 11, faturaAno: 2026, parcelado: true },
  ];
  assert.equal(limiteUsado(cartao, lanc, '2026-11-04'), 200);
});

test('dias até o vencimento usa calendário real', () => {
  assert.equal(diasAteVencimento(nubank, '2026-11-04'), 11);
  assert.equal(diasAteVencimento(nubank, '2026-11-20'), 25); // 15/12
  assert.equal(diasAteVencimento({ ...nubank, diaVencimento: 31 }, '2026-02-10'), 18); // 28/02
});

// ── Previsto / resumo ───────────────────────────────────────────────────────
test('previsto respeita exceções e término dos fixos e usa faturas, não compras (bug 4)', () => {
  const dados = {
    contas, cartoes: [nubank],
    lancamentos: [
      { id: 1, valor: -100, data: '2026-09-10', tipo: 'despesa', contaId: 1, fixo: true, excecoesMeses: ['2026-10'], fixoFimData: '2026-12' },
      { id: 2, valor: 500, data: '2026-11-30', tipo: 'receita', contaId: 1 },
      // compra de 05/11 → fatura de nov, vence 15/11
      { id: 3, valor: -80, data: '2026-11-05', tipo: 'despesa', cartaoId: 1, faturaMes: 10, faturaAno: 2026 },
      // compra de 20/11 → fatura de dez, vence 15/12 (fora de novembro)
      { id: 4, valor: -60, data: '2026-11-20', tipo: 'despesa', cartaoId: 1, faturaMes: 11, faturaAno: 2026 },
    ],
  };
  // 1000 − 100 (set) − 0 (out, exceção) − 100 (nov) + 500 − 80 (fatura nov)
  assert.equal(saldoPrevisto(dados, '2026-11-30'), 1220);
  // dezembro: fixo terminou; fatura de dez (60) entra
  assert.equal(saldoPrevisto(dados, '2026-12-31'), 1160);
});

test('Home e Fluxo usam o mesmo resumo do mês (bug 5)', () => {
  const dados = {
    contas, cartoes: [nubank],
    lancamentos: [
      { id: 1, valor: 5000, data: '2026-06-30', tipo: 'receita', contaId: 1, fixo: true },
      { id: 2, valor: -40, data: '2026-06-05', tipo: 'despesa', cartaoId: 1, fixo: true, faturaMes: 5, faturaAno: 2026 },
    ],
  };
  const r = resumoPeriodo(dados, '2026-11-01', '2026-11-30');
  assert.equal(r.entradasPrev, 5000); // salário fixo se repete em novembro (último dia)
  assert.equal(r.itens[0].data, '2026-11-30');
  assert.equal(r.saidasPrev, 40);     // Netflix via fatura de novembro
  assert.equal(r.faturas.length, 1);
});

test('lista de conta não traz itens de cartão', () => {
  const lanc = [
    { id: 1, valor: -10, data: '2026-11-02', tipo: 'despesa', contaId: 1 },
    { id: 2, valor: -10, data: '2026-11-02', tipo: 'despesa', cartaoId: 1 },
  ];
  assert.equal(lancamentosContaNoPeriodo(lanc, '2026-11-01', '2026-11-30').length, 1);
});
