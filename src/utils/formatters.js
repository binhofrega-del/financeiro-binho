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

// Retorna o logo do banco se existir, ou null
// Usa BASE_URL para funcionar tanto local quanto no GitHub Pages
export function logoParaBanco(nome) {
  if (!nome) return null;
  const lower = nome.toLowerCase();
  const base = import.meta.env.BASE_URL;
  if (lower.includes('nubank')) return `${base}logo-nubank.svg`;
  if (lower.includes('santander')) return `${base}logo-santander.svg`;
  return null;
}

export const emojisCategoria = {
  'Moradia': '🏠', 'Alimentação': '🍔', 'Utilidades': '💡', 'Viagem': '✈️',
  'Assinatura': '📺', 'Aluguel': '🏘️', 'Imóvel': '🏗️', 'Saúde': '💊',
  'Transporte': '🚗', 'Lazer': '🎉', 'Educação': '📚', 'Salário': '💼',
  'Outros': '📌',
};
