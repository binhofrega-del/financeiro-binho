// Backup local dos dados (download de um .json) e leitura de um backup para restaurar.
import { hojeISO, pad2 } from './financas';

export function baixarBackup(dados, motivo = 'manual') {
  const agora = new Date();
  const nome = `backup-financeiro-${hojeISO(agora)}-${pad2(agora.getHours())}${pad2(agora.getMinutes())}-${motivo}.json`;
  const blob = new Blob([JSON.stringify({ app: 'financeiro-binho', geradoEm: agora.toISOString(), dados })], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Aceita o formato do backup ({ dados }) ou o arquivo cru do Drive (financeiro-binho.json)
export async function lerBackup(file) {
  let json;
  try { json = JSON.parse(await file.text()); } catch { throw new Error('Arquivo inválido: não é um JSON.'); }
  const d = json?.dados ?? json;
  const ok = d && Array.isArray(d.contas) && Array.isArray(d.cartoes) && Array.isArray(d.lancamentos);
  if (!ok) throw new Error('Este arquivo não parece um backup do Financeiro Binho.');
  return { ...d, categorias: Array.isArray(d.categorias) ? d.categorias : [] };
}

// Salva um arquivo de texto. No iPhone abre o "Compartilhar" (Salvar em Arquivos, AirDrop, e-mail…);
// no computador baixa direto para a pasta Downloads.
export async function baixarTexto(nome, conteudo, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob([conteudo], { type: tipo });
  const ehIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ehIOS && typeof File !== 'undefined') {
    const arquivo = new File([blob], nome, { type: tipo });
    if (navigator.canShare?.({ files: [arquivo] })) {
      try { await navigator.share({ files: [arquivo] }); return; } catch (e) { if (e?.name === 'AbortError') return; }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
