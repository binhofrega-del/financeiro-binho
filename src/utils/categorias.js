// Aparência das categorias (cor do círculo + ícone), igual ao Organizze.
// Despesa e receita são listas separadas: "Deise" como despesa (dentro de Dívidas)
// é vermelha com prancheta; como receita é laranja com coração.

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// [nome, cor, ícone, subcategorias]
export const CATEGORIAS_DESPESA = [
  ['Alimentação', '#e06aa0', 'talher', ['Cerveja']],
  ['Aposta', '#f2484b', 'trofeu', []],
  ['Apto Praia', '#5a2fc2', 'casa', []],
  ['Assinaturas e serviços', '#c57ae0', 'assinatura', []],
  ['Bares e restaurantes', '#5d5f86', 'taca', []],
  ['Carro', '#f6a23c', 'carro', []],
  ['Compras', '#ee86e8', 'sacola', []],
  ['Despesas pessoais', '#f2605e', 'pessoa', ['Dia Dia']],
  ['Dívidas', '#f2605e', 'prancheta', ['Deise']],
  ['Educação', '#5c6bc0', 'capelo', []],
  ['Família e filhos', '#9fdc7f', 'familia', []],
  ['Impostos e Taxas', '#f6907a', 'porcento', []],
  ['Investimentos', '#f06a95', 'barras', []],
  ['Lazer', '#b6dc4c', 'sorriso', []],
  ['Mercado', '#f4826a', 'carrinho', []],
  ['Moradia', '#6f8ff2', 'casa', []],
  ['Outros', '#a9a9a9', 'lista', []],
  ['Pets', '#f8b84c', 'pata', []],
  ['Presentes e doações', '#6a6df0', 'maoCoracao', []],
  ['Roupas', '#f5865c', 'cabide', []],
  ['Saúde', '#6aaef2', 'cruz', []],
  ['Trabalho', '#3f6de2', 'maleta', []],
  ['Transporte', '#56b4f2', 'onibus', ['Gasolina', 'Moto crosser']],
  ['Viagem', '#f26262', 'aviao', []],
];

export const CATEGORIAS_RECEITA = [
  ['Deise', '#f6a23c', 'coracao', []],
  ['Empréstimos', '#33d69f', 'dinheiro', []],
  ['Investimentos', '#33d69f', 'tendencia', []],
  ['Laura', '#8b6cc8', 'familia', []],
  ['Loteria', '#5ecc6c', 'dinheiro', []],
  ['Outras receitas', '#33d69f', 'pontos', ['IQ Option', 'PicPay']],
  ['Renda', '#33d69f', 'estrela', []],
  ['Salário', '#f6a23c', 'maleta', []],
];

// Categorias que existiam no app antes da importação
const ANTIGAS = {
  utilidades: ['#f8b84c', 'casa'], assinatura: ['#c57ae0', 'assinatura'], aluguel: ['#6f8ff2', 'casa'],
  imovel: ['#6f8ff2', 'casa'],
};

export const COR_CARTAO = '#820ad1';
const ESPECIAIS = {
  'pagamento de fatura': [COR_CARTAO, 'cartao'], 'fatura cartao': [COR_CARTAO, 'cartao'], fatura: [COR_CARTAO, 'cartao'],
  transferencias: ['#8395a7', 'transferencia'], transferencia: ['#8395a7', 'transferencia'],
};
const PADRAO = { cor: '#a9a9a9', icone: 'lista' };

function indexar(lista) {
  const m = new Map();
  for (const [nome, cor, icone, subs] of lista) {
    m.set(normalizar(nome), { nome, cor, icone, pai: null });
    for (const s of subs) m.set(normalizar(s), { nome: s, cor, icone, pai: nome });
  }
  return m;
}
const MAPA_DESPESA = indexar(CATEGORIAS_DESPESA);
const MAPA_RECEITA = indexar(CATEGORIAS_RECEITA);

// { cor, icone, pai } da categoria para o tipo do lançamento
export function visualCategoria(nome, tipo) {
  const n = normalizar(nome);
  if (tipo === 'transferencia') return { ...visualEspecial('transferencias'), pai: null };
  if (ESPECIAIS[n]) return { ...visualEspecial(n), pai: null };
  const principal = tipo === 'receita' ? MAPA_RECEITA : MAPA_DESPESA;
  const outro = tipo === 'receita' ? MAPA_DESPESA : MAPA_RECEITA;
  const v = principal.get(n) || outro.get(n);
  if (v) return { cor: v.cor, icone: v.icone, pai: v.pai };
  if (ANTIGAS[n]) return { cor: ANTIGAS[n][0], icone: ANTIGAS[n][1], pai: null };
  return { ...PADRAO, pai: null };
}
function visualEspecial(n) { return { cor: ESPECIAIS[n][0], icone: ESPECIAIS[n][1] }; }

// A categoria serve para esse tipo? (desconhecidas servem para qualquer um)
export function categoriaDoTipo(nome, tipo) {
  const n = normalizar(nome);
  if (ESPECIAIS[n]) return false;
  const naDespesa = MAPA_DESPESA.has(n);
  const naReceita = MAPA_RECEITA.has(n);
  if (!naDespesa && !naReceita) return true;
  return tipo === 'receita' ? naReceita : naDespesa;
}

// Ordena como o Organizze: categorias em ordem alfabética, cada subcategoria logo abaixo da mãe
export function ordenarCategorias(nomes, tipo) {
  const chave = (nome) => {
    const v = visualCategoria(nome, tipo);
    return v.pai ? `${normalizar(v.pai)}\u0001${normalizar(nome)}` : normalizar(nome);
  };
  return [...nomes].sort((a, b) => chave(a).localeCompare(chave(b), 'pt-BR'));
}
