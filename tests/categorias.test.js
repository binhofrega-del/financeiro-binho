import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visualCategoria, categoriaDoTipo, ordenarCategorias } from '../src/utils/categorias.js';
import { ICONES } from '../src/utils/iconesCategorias.js';

test('mesma categoria tem visual diferente em despesa e receita', () => {
  assert.deepEqual(visualCategoria('Deise', 'despesa'), { cor: '#f2605e', icone: 'prancheta', pai: 'Dívidas' });
  assert.deepEqual(visualCategoria('Deise', 'receita'), { cor: '#f6a23c', icone: 'coracao', pai: null });
  assert.equal(visualCategoria('Investimentos', 'despesa').icone, 'barras');
  assert.equal(visualCategoria('Investimentos', 'receita').icone, 'tendencia');
});

test('sem diferenciar acento/maiúscula, subcategoria herda a mãe, especiais e desconhecidas', () => {
  assert.equal(visualCategoria('alimentacao', 'despesa').icone, 'talher');
  assert.deepEqual(visualCategoria('Cerveja', 'despesa'), { cor: '#e06aa0', icone: 'talher', pai: 'Alimentação' });
  assert.equal(visualCategoria('Dívidas', 'receita').icone, 'prancheta'); // só existe como despesa
  assert.equal(visualCategoria('Pagamento de fatura', 'despesa').icone, 'cartao');
  assert.equal(visualCategoria('Qualquer', 'transferencia').icone, 'transferencia');
  assert.equal(visualCategoria('Inventada', 'despesa').icone, 'lista');
});

test('todos os ícones usados existem', () => {
  for (const [nome, tipo] of [['Moradia', 'despesa'], ['Laura', 'receita'], ['Utilidades', 'despesa'], ['Transferências', 'receita']]) {
    assert.ok(ICONES[visualCategoria(nome, tipo).icone], nome);
  }
});

test('categorias por tipo e ordem do Organizze', () => {
  assert.equal(categoriaDoTipo('Mercado', 'receita'), false);
  assert.equal(categoriaDoTipo('Deise', 'receita'), true);
  assert.equal(categoriaDoTipo('Nova', 'receita'), true);
  assert.equal(categoriaDoTipo('Pagamento de fatura', 'despesa'), false);
  assert.deepEqual(ordenarCategorias(['Cerveja', 'Aposta', 'Alimentação', 'Gasolina', 'Viagem', 'Transporte'], 'despesa'),
    ['Alimentação', 'Cerveja', 'Aposta', 'Transporte', 'Gasolina', 'Viagem']);
});
