export function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

export function formatarData(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

export const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

export function nomeMes(mes) {
  return MESES[mes];
}

export function corDoTipo(tipo) {
  if (tipo === 'receita') return '#16a34a';
  if (tipo === 'despesa') return '#dc2626';
  return '#1d4ed8';
}

// Mapa de logos por nome de banco/conta (match parcial, case-insensitive)
export const logosBanco = {
  'nubank': '/logo-nubank.svg',
  'santander': '/logo-santander.svg',
};

// Retorna o logo do banco se existir, ou null
export function logoParaBanco(nome) {
  if (!nome) return null;
  const lower = nome.toLowerCase();
  for (const [banco, logo] of Object.entries(logosBanco)) {
    if (lower.includes(banco)) return logo;
  }
  return null;
}

export const emojisCategoria = {
  'Moradia': '🏠', 'Alimentação': '🍔', 'Utilidades': '💡', 'Viagem': '✈️',
  'Assinatura': '📺', 'Aluguel': '🏘️', 'Imóvel': '🏗️', 'Saúde': '💊',
  'Transporte': '🚗', 'Lazer': '🎉', 'Educação': '📚', 'Salário': '💼',
  'Outros': '📌',
};
