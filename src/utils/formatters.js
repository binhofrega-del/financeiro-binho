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

// Calcula em qual mês/ano a compra no cartão vai cair na fatura
// Se data <= diaFechamento → fatura do mês atual
// Se data > diaFechamento → fatura do próximo mês
export function calcularFaturaCartao(dataLancamento, diaFechamento) {
  const d = new Date(dataLancamento + 'T00:00:00');
  const dia = d.getDate();
  if (dia <= diaFechamento) {
    return { faturaMes: d.getMonth(), faturaAno: d.getFullYear() };
  } else {
    const prox = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { faturaMes: prox.getMonth(), faturaAno: prox.getFullYear() };
  }
}

// Retorna o mês/ano em que a fatura de um mês vence
// Se o vencimento cai depois do fechamento → vence no próprio mês da fatura
// Se cai antes ou no dia do fechamento → vence no mês seguinte
export function vencimentoDaFatura(faturaMes, faturaAno, diaFechamento, diaVencimento) {
  if (diaVencimento > diaFechamento) return { mes: faturaMes, ano: faturaAno };
  const prox = new Date(faturaAno, faturaMes + 1, 1);
  return { mes: prox.getMonth(), ano: prox.getFullYear() };
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
