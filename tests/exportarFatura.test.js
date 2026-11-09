import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvDaFatura, nomeArquivoFatura, valorOrganizze } from '../src/utils/exportarFatura.js';
import { infoPagamentoFatura } from '../src/utils/financas.js';

const cartao = { id: 1, nome: 'Nubank', banco: 'Nubank', diaFechamento: 30, diaVencimento: 7, faturasPagas: {} };
const fatDez = { ano: 2026, mes: 10 }; // fecha 30/11, vence 07/12 → "Dezembro 2026"
const base = { cartaoId: 1, contaId: null, tipo: 'despesa', pago: true, fixo: false, parcelado: false, faturaMes: 10, faturaAno: 2026 };

const lancs = [
  { ...base, id: 1, data: '2026-11-07', descricao: 'Mercado X', categoria: 'Mercado', valor: -68.89 },
  { ...base, id: 2, data: '2026-11-08', descricao: 'Delivery', categoria: 'Cerveja', valor: -49.37 },
  { ...base, id: 3, data: '2026-11-02', descricao: 'Escola 10/10', categoria: 'Educação', valor: -156.8, parcelado: true, parcela: 10, totalParcelas: 10 },
  { ...base, id: 4, data: '2026-11-13', descricao: 'Rematricula 2/6', categoria: 'Educação', valor: -37, parcelado: true, parcela: 2, totalParcelas: 6 },
  { ...base, id: 5, data: '2026-10-27', descricao: 'Streaming', categoria: 'Assinaturas e serviços', valor: -20.9, fixo: true },
  { ...base, id: 6, data: '2026-11-15', descricao: 'Loja; com ponto e vírgula', categoria: 'Compras', valor: -28.95, observacao: 'Capa - Baseus' },
  { ...base, id: 7, data: '2026-11-20', descricao: 'Estorno', categoria: 'Compras', valor: 10, tipo: 'receita' },
  { ...base, id: 8, data: '2026-11-20', descricao: 'Outra fatura', categoria: 'Compras', valor: -99, faturaMes: 11 },
];

test('valor no formato do Organizze', () => {
  assert.equal(valorOrganizze(-156.8), '-156.8');
  assert.equal(valorOrganizze(-37), '-37.0');
  assert.equal(valorOrganizze(-1220.58), '-1220.58');
  assert.equal(valorOrganizze(-0.1 - 0.2), '-0.3');
  assert.equal(valorOrganizze(-0), '0.0');
});

test('CSV igual ao "Exportar para planilhas" do Organizze', () => {
  const csv = csvDaFatura(lancs, cartao, fatDez);
  assert.equal(csv, '﻿' + [
    'Data;Descrição;Categoria;Valor;Tags;Observação',
    '2026-11-02;Escola 10/10;Educação;-156.8;"";""',
    '2026-11-13;Rematricula 2/6;Educação;-37.0;"";""',
    '2026-10-27;Streaming;Assinaturas e serviços;-20.9;"";""',
    '2026-11-07;Mercado X;Mercado;-68.89;"";""',
    '2026-11-08;Delivery;Cerveja ;-49.37;"";""',
    '2026-11-15;"Loja; com ponto e vírgula";Compras;-28.95;"";Capa - Baseus',
    '2026-11-20;Estorno;Compras;10.0;"";""',
    'Total;"";"";-351.91;"";""',
  ].join('\n') + '\n');
});

test('nome do arquivo (em aberto e paga)', () => {
  assert.equal(nomeArquivoFatura(cartao, fatDez), 'Fatura Nubank - Dezembro 2026.csv');
  const chave = infoPagamentoFatura(cartao, fatDez).chave;
  const pago = { ...cartao, faturasPagas: { [chave]: { pago: true, contaId: 2, valor: 351.91, data: '2026-12-05' } } };
  assert.equal(nomeArquivoFatura(pago, fatDez), 'Paga Fatura Nubank - Dezembro 2026.csv');
});
