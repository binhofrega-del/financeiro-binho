// Testes do importador do Organizze (dados fictícios). Rodar com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { converterOrganizze, lerData, lerValor, lerMesAno } from '../src/utils/importOrganizze.js';
import { calcularSaldos, itensDaFatura, totalDosItens } from '../src/utils/financas.js';

const L = (Data, Descrição, Categoria, Valor, Situação = 'Pago', extra = '') =>
  ({ Data, Descrição, Categoria, Valor, Situação, Tags: '', 'Informações adicionais': extra });
const C = (Data, Descrição, Categoria, Valor, Fatura) =>
  ({ Data, Descrição, Categoria, Valor, Fatura, Tags: '', 'Informações adicionais': '' });

function exemplo() {
  return {
    Banco: [
      L('01.09.2026', 'Saldo inicial', 'Outras receitas', 1000),
      L('03.10.2026', 'Pagamento de fatura', 'Pagamento de fatura', -100),
      L('05.10.2026', 'Pagamento de fatura - OutroCartao - Outubro de 2026', 'Pagamento de fatura', -30),
      L('10.10.2026', 'Transferencia', 'Transferências', -200),
      L('05.11.2026', 'Aluguel 1/3', 'Moradia', -500),
      L('05.12.2026', 'Aluguel 2/3', 'Moradia', -500, 'Não pago'),
      L('05.01.2027', 'Aluguel 3/3', 'Moradia', -500, 'Não pago'),
      // série mensal → fixo
      L('10.11.2026', 'Internet', 'Assinaturas e serviços', -100, 'Pago', 'obs internet'),
      L('10.12.2026', 'Internet', 'Assinaturas e serviços', -100, 'Não pago'),
      L('10.01.2027', 'Internet', 'Assinaturas e serviços', -100, 'Não pago'),
      L('10.02.2027', 'Internet', 'Assinaturas e serviços', -100, 'Não pago'),
      // lembrete de valor zero (categoria de despesa)
      L('15.11.2026', 'IPTU', 'Moradia', 0, 'Não pago'),
      L('15.12.2026', 'IPTU', 'Moradia', 0, 'Não pago'),
      L('15.01.2027', 'IPTU', 'Moradia', 0, 'Não pago'),
      L('01.06.2027', 'Seguro', 'Outros', -10, 'Não pago'), // export vai até jun/27
    ],
    Carteira: [
      L('10.10.2026', 'Transferencia', 'Transferências', 200),
    ],
    'Cartao (2)': [
      C('20.09.2026', 'Mercado', 'Mercado', -100, 'Outubro/2026'),
      C('01.10.2026', 'Loja', 'Compras', -60, 'Novembro/2026'),
      C('02.10.2026', 'Estorno loja', 'Outras receitas', 10, 'Novembro/2026'),
      C('15.11.2026', 'Streaming', 'Assinaturas e serviços', -20, 'Dezembro/2026'),
      C('15.12.2026', 'Streaming', 'Assinaturas e serviços', -20, 'Janeiro/2027'),
      C('15.01.2027', 'Streaming', 'Assinaturas e serviços', -20, 'Fevereiro/2027'),
      C('07.12.2026', 'Fatura Dezembro 2026', '', -20, 'Dezembro/2026'), // projeção → ignora
    ],
  };
}

test('leitura de células do Organizze', () => {
  assert.equal(lerData('05.11.2026'), '2026-11-05');
  assert.equal(lerData('2026-11-05'), '2026-11-05');
  assert.equal(lerValor('-1.234,56'), -1234.56);
  assert.equal(lerValor(-28.15), -28.15);
  assert.deepEqual(lerMesAno('Março/2026'), { ano: 2026, mes: 2 });
  assert.deepEqual(lerMesAno(' Dezembro de 2021'), { ano: 2021, mes: 11 });
});

test('saldos batem com a soma dos pagos do export', () => {
  const { dados, relatorio } = converterOrganizze(exemplo(), { hoje: '2026-11-04' });
  assert.deepEqual(relatorio.avisos, []);
  const banco = relatorio.conferenciaContas.find((c) => c.nome === 'Banco');
  assert.equal(banco.esperado, 1000 - 100 - 30 - 200 - 500 - 100); // 70
  assert.equal(banco.app, banco.esperado);
  assert.equal(calcularSaldos(dados).saldoGeral, 70 + 200);
});

test('pagamento de fatura do cartão do export vira fatura paga; de outro cartão vira despesa', () => {
  const { dados, relatorio } = converterOrganizze(exemplo(), { hoje: '2026-11-04' });
  const cartao = dados.cartoes[0];
  assert.equal(cartao.nome, 'Cartao');
  assert.deepEqual(cartao.faturasPagas['2026-10'], { pago: true, contaId: dados.contas[0].id, valor: 100, data: '2026-10-03' });
  assert.equal(relatorio.pagamentosVinculados, 1);
  assert.ok(dados.lancamentos.some((l) => l.descricao.includes('OutroCartao') && l.valor === -30));
  assert.ok(!dados.lancamentos.some((l) => l.descricao === 'Pagamento de fatura'));
});

test('transferência entre contas do export vira uma só', () => {
  const { dados, relatorio } = converterOrganizze(exemplo(), { hoje: '2026-11-04' });
  assert.equal(relatorio.transferencias, 1);
  const t = dados.lancamentos.find((l) => l.tipo === 'transferencia');
  assert.equal(t.valor, 200);
  assert.equal(t.contaId, dados.contas[0].id);
  assert.equal(t.contaDestinoId, dados.contas[1].id);
});

test('parcelas agrupadas, séries viram fixo e lembretes de valor zero ficam como despesa', () => {
  const { dados } = converterOrganizze(exemplo(), { hoje: '2026-11-04' });
  const parc = dados.lancamentos.filter((l) => l.parcelado);
  assert.equal(parc.length, 3);
  assert.equal(new Set(parc.map((l) => l.grupoId)).size, 1);
  const internet = dados.lancamentos.filter((l) => l.descricao === 'Internet');
  assert.equal(internet.length, 1);
  assert.equal(internet[0].fixo, true);
  assert.equal(internet[0].pago, true);
  assert.equal(internet[0].observacao, 'obs internet');
  assert.equal(internet[0].fixoFimData, '2027-03'); // última ocorrência fev/27, antes do fim do export
  const iptu = dados.lancamentos.find((l) => l.descricao === 'IPTU');
  assert.equal(iptu.fixo, true);
  assert.equal(iptu.tipo, 'despesa');
});

test('cartão: fatura nomeada pelo vencimento, estorno abate, projeção ignorada, assinatura vira fixo', () => {
  const { dados } = converterOrganizze(exemplo(), { hoje: '2026-11-04' });
  const cartao = dados.cartoes[0]; // fecha 30, vence 7 → fatura que vence em nov = ciclo de out
  assert.equal(cartao.diaFechamento, 30);
  assert.equal(cartao.diaVencimento, 7);
  assert.equal(totalDosItens(itensDaFatura(dados.lancamentos, cartao, { ano: 2026, mes: 9 })), 50);
  const streaming = dados.lancamentos.filter((l) => l.descricao === 'Streaming');
  assert.equal(streaming.length, 1);
  assert.equal(streaming[0].fixo, true);
  assert.equal(totalDosItens(itensDaFatura(dados.lancamentos, cartao, { ano: 2026, mes: 12 })), 20); // jan/27
  assert.ok(!dados.lancamentos.some((l) => l.descricao.startsWith('Fatura ')));
});
