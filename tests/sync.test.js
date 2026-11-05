// Testes da junção entre aparelhos. Rodar com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carimbar, mesclar, novaGeracao } from '../src/utils/sync.js';

const base = () => ({
  contas: [{ id: 1, nome: 'Santander', saldo: 0 }],
  cartoes: [{ id: 9, nome: 'Nubank', faturasPagas: {} }],
  lancamentos: [
    { id: 100, descricao: 'Luz', valor: -200, pago: false },
    { id: 101, descricao: 'Água', valor: -80, pago: false },
  ],
  categorias: [{ id: 1, nome: 'Outros' }],
});

// simula uma mutação do app: devolve novo estado já carimbado
const mut = (d, fn, t) => carimbar(d, fn(d), t);
const marcarPago = (id) => (d) => ({ ...d, lancamentos: d.lancamentos.map((l) => (l.id === id ? { ...l, pago: true } : l)) });
const adicionar = (l) => (d) => ({ ...d, lancamentos: [...d.lancamentos, l] });
const remover = (id) => (d) => ({ ...d, lancamentos: d.lancamentos.filter((l) => l.id !== id) });

test('carimbar marca só o que mudou e registra exclusões', () => {
  const d0 = base();
  const d1 = mut(d0, marcarPago(100), 1000);
  assert.equal(d1.lancamentos[0].atualizadoEm, 1000);
  assert.equal(d1.lancamentos[1], d0.lancamentos[1]); // intocado
  const d2 = mut(d1, remover(101), 2000);
  assert.equal(d2.removidos['l:101'], 2000);
  assert.equal(d2.meta.atualizadoEm, 2000);
});

test('iPhone e PC editando lançamentos diferentes: os dois ficam', () => {
  const drive = base();
  const iphone = mut(drive, marcarPago(100), 1000);              // paga a luz
  const pc = mut(drive, adicionar({ id: 200, descricao: 'Mercado', valor: -50 }), 1100);
  const junto = mesclar(pc, iphone, 5000);
  assert.equal(junto.lancamentos.find((l) => l.id === 100).pago, true);
  assert.ok(junto.lancamentos.find((l) => l.id === 200));
  assert.equal(junto.lancamentos.length, 3);
  // e a ordem da junção não importa
  assert.deepEqual(
    mesclar(iphone, pc, 5000).lancamentos.map((l) => l.id).sort(),
    junto.lancamentos.map((l) => l.id).sort(),
  );
});

test('mesmo lançamento editado nos dois: vale a edição mais recente', () => {
  const drive = base();
  const a = mut(drive, (d) => ({ ...d, lancamentos: d.lancamentos.map((l) => (l.id === 100 ? { ...l, valor: -210 } : l)) }), 1000);
  const b = mut(drive, (d) => ({ ...d, lancamentos: d.lancamentos.map((l) => (l.id === 100 ? { ...l, valor: -220 } : l)) }), 2000);
  assert.equal(mesclar(a, b, 5000).lancamentos.find((l) => l.id === 100).valor, -220);
  assert.equal(mesclar(b, a, 5000).lancamentos.find((l) => l.id === 100).valor, -220);
});

test('exclusão em um aparelho não volta por causa do outro', () => {
  const drive = base();
  const iphone = mut(drive, remover(101), 1000);
  const pc = mut(drive, marcarPago(100), 1500); // PC ainda tem a Água antiga
  const junto = mesclar(pc, iphone, 5000);
  assert.ok(!junto.lancamentos.some((l) => l.id === 101));
  assert.equal(junto.lancamentos.find((l) => l.id === 100).pago, true);
});

test('edição depois da exclusão (em outro aparelho) mantém o item', () => {
  const drive = base();
  const iphone = mut(drive, remover(101), 1000);
  const pc = mut(drive, marcarPago(101), 2000);
  assert.ok(mesclar(iphone, pc, 5000).lancamentos.some((l) => l.id === 101));
});

test('faturas pagas juntam por mês', () => {
  const drive = base();
  const pagar = (chave) => (d) => ({ ...d, cartoes: d.cartoes.map((c) => ({ ...c, faturasPagas: { ...c.faturasPagas, [chave]: { pago: true, contaId: 1, valor: 10 } } })) });
  const a = mut(drive, pagar('2026-11'), 1000);
  const b = mut(drive, pagar('2026-12'), 2000);
  const fp = mesclar(a, b, 5000).cartoes[0].faturasPagas;
  assert.ok(fp['2026-11'].pago && fp['2026-12'].pago);
});

test('importação/restauração substitui tudo: não mistura com dados velhos', () => {
  const drive = base();
  const pcImportou = novaGeracao({ ...base(), lancamentos: [{ id: 999, descricao: 'Importado' }] }, 3000);
  const iphoneVelho = mut(drive, adicionar({ id: 300, descricao: 'feito no iPhone antes' }), 2000);
  const junto = mesclar(iphoneVelho, pcImportou, 5000);
  assert.deepEqual(junto.lancamentos.map((l) => l.id), [999]);
  // depois disso, os dois aparelhos ficam na mesma geração e voltam a juntar normalmente
  const iphone2 = mut(junto, adicionar({ id: 301, descricao: 'novo' }), 4000);
  assert.deepEqual(mesclar(iphone2, pcImportou, 5000).lancamentos.map((l) => l.id).sort(), [301, 999]);
});

test('dados antigos sem carimbo juntam sem perder nada', () => {
  const a = base();
  const b = base();
  const junto = mesclar(a, b);
  assert.equal(junto.lancamentos.length, 2);
  assert.deepEqual(junto.removidos, {});
});
