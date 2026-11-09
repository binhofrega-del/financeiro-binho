// Exporta os lançamentos de uma fatura no MESMO formato do "Exportar para planilhas" do
// Organizze (usado no app de conciliação):
//   - UTF-8 com BOM, separador ";", quebra de linha LF
//   - cabeçalho: Data;Descrição;Categoria;Valor;Tags;Observação
//   - subcategoria com espaço no fim ("Cerveja ")
//   - Data AAAA-MM-DD; Valor com ponto e sem milhar (-156.8, -37.0); despesa negativa
//   - Tags/Observação vazias saem como ""; última linha: Total;"";"";<total>;"";""
//   - nome: "Fatura Nubank - Dezembro 2026.csv" (paga: "Paga Fatura Nubank - ...")
import { itensDaFatura, totalDosItens, infoPagamentoFatura, nomeFatura, addMeses } from './financas.js';
import { visualCategoria } from './categorias.js';

// Igual ao Organizze: número "cru" com ponto; inteiro ganha ".0"
export function valorOrganizze(v) {
  const r = Math.round(v * 100) / 100 + 0; // + 0 tira o -0
  return Number.isInteger(r) ? r.toFixed(1) : String(r);
}

// Texto livre: só põe aspas se tiver ; " ou quebra de linha (senão vai cru, como no Organizze)
function campo(t) {
  const s = String(t ?? '');
  if (s === '') return '""';
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// O Organizze exporta subcategoria com um espaço no fim ("Cerveja ", "Gasolina ")
function categoriaOrganizze(l) {
  const nome = String(l.categoria ?? '').trim();
  return visualCategoria(nome, l.tipo).pai ? `${nome} ` : nome;
}

function texto(t) {
  if (Array.isArray(t)) return t.join(', ');
  return t ?? '';
}

// Ordem parecida com a do Organizze: parcelas (da compra mais antiga para a mais nova),
// depois os fixos, depois as compras avulsas por data.
function ordenar(itens) {
  const grupo = (l) => (l.parcelado && l.parcela > 1 ? 0 : l.fixo ? 1 : 2); // 1ª parcela vai junto das avulsas
  const inicio = (l) => (l.parcelado && l.parcela > 1 ? addMeses(l.data, -(l.parcela - 1)) : l.data);
  return itens
    .map((l, i) => ({ l, i }))
    .sort((a, b) => grupo(a.l) - grupo(b.l) || inicio(a.l).localeCompare(inicio(b.l)) || a.i - b.i)
    .map((x) => x.l);
}

export function csvDaFatura(lancamentos, cartao, fat) {
  const itens = ordenar(itensDaFatura(lancamentos, cartao, fat));
  const linhas = ['Data;Descrição;Categoria;Valor;Tags;Observação'];
  for (const l of itens) {
    const valor = (l.tipo === 'receita' ? 1 : -1) * Math.abs(l.valor || 0);
    linhas.push([l.data, campo(l.descricao), campo(categoriaOrganizze(l)), valorOrganizze(valor), campo(texto(l.tags)), campo(texto(l.observacao))].join(';'));
  }
  linhas.push(`Total;"";"";${valorOrganizze(-totalDosItens(itens))};"";""`);
  return '\uFEFF' + linhas.join('\n') + '\n';
}

export function nomeArquivoFatura(cartao, fat) {
  const pago = infoPagamentoFatura(cartao, fat).pago;
  return `${pago ? 'Paga ' : ''}Fatura ${cartao.nome} - ${nomeFatura(fat, cartao)}.csv`;
}
