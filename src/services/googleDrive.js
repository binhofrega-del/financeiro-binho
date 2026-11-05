// ─────────────────────────────────────────────────────────────────────────────
// googleDrive.js — acesso ao arquivo de dados no Google Drive.
// Usa a API REST do Drive direto (fetch) com o token do login do Google; o script
// de login só é carregado quando precisa, para o app abrir mesmo sem internet.
// Permissão "drive.file": o app só enxerga os arquivos que ele mesmo criou.
// ─────────────────────────────────────────────────────────────────────────────
const CLIENT_ID = '1044474226374-ldulpr3a7dliiv6olgmnke9995pp1hbu.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const FILE_NAME = 'financeiro-binho.json';
export const BACKUP_PREFIXO = 'financeiro-binho-backup-';
export const BACKUPS_MANTER = 15;
const TOKEN_KEY = 'fin_binho_token';
const FILE_KEY = 'fin_binho_file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export class ErroLogin extends Error {}

// ── Login ────────────────────────────────────────────────────────────────────
let scriptGis = null;
function carregarGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!scriptGis) {
    scriptGis = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { scriptGis = null; reject(new Error('Sem conexão com o Google')); };
      document.head.appendChild(s);
    });
  }
  return scriptGis;
}

function lerToken() {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); } catch { return null; }
}

// Já autorizou o app alguma vez neste aparelho?
export function jaAutorizou() {
  return !!localStorage.getItem(TOKEN_KEY);
}

// Token ainda válido (com 1 min de folga)?
export function tokenValido() {
  const t = lerToken();
  return t?.access_token && t.expiry && Date.now() < t.expiry - 60000 ? t : null;
}

// Abre o login do Google. Precisa ser chamado a partir de um toque/clique do usuário.
export async function entrar() {
  await carregarGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) { reject(new ErroLogin(resp.error)); return; }
        localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...resp, expiry: Date.now() + resp.expires_in * 1000 }));
        resolve();
      },
      error_callback: (err) => reject(new ErroLogin(err?.type || 'login cancelado')),
    });
    client.requestAccessToken({ prompt: jaAutorizou() ? '' : 'consent' });
  });
}

export function sair() {
  const t = lerToken();
  if (t?.access_token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t.access_token, () => {});
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(FILE_KEY);
}

// ── Chamadas à API ───────────────────────────────────────────────────────────
async function api(url, opcoes = {}) {
  const t = tokenValido();
  if (!t) throw new ErroLogin('sessão expirada');
  const r = await fetch(url, { ...opcoes, headers: { Authorization: `Bearer ${t.access_token}`, ...(opcoes.headers || {}) } });
  if (r.status === 401) {
    // token recusado: marca como vencido, mantendo o registro de que já autorizou
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...t, expiry: 0 }));
    throw new ErroLogin('sessão expirada');
  }
  if (!r.ok) throw new Error(`Drive respondeu ${r.status}`);
  return r;
}

const q = (s) => encodeURIComponent(s);

async function acharArquivo() {
  const salvo = localStorage.getItem(FILE_KEY);
  if (salvo) {
    try {
      const r = await api(`${API}/files/${salvo}?fields=id,version,trashed`);
      const f = await r.json();
      if (!f.trashed) return f;
    } catch (e) {
      if (e instanceof ErroLogin) throw e;
    }
    localStorage.removeItem(FILE_KEY);
  }
  const r = await api(`${API}/files?q=${q(`name='${FILE_NAME}' and trashed=false`)}&fields=${q('files(id,version,modifiedTime)')}&orderBy=modifiedTime desc&spaces=drive`);
  const { files } = await r.json();
  if (!files?.length) return null;
  localStorage.setItem(FILE_KEY, files[0].id);
  return files[0];
}

// Versão atual do arquivo no Drive (barato: não baixa o conteúdo). null = ainda não existe.
export async function lerVersao() {
  const f = await acharArquivo();
  return f ? { id: f.id, versao: String(f.version) } : null;
}

export async function baixar(id) {
  const r = await api(`${API}/files/${id}?alt=media`);
  return r.json();
}

function multipart(meta, conteudo) {
  const b = `fin_${Math.random().toString(36).slice(2)}`;
  return {
    headers: { 'Content-Type': `multipart/related; boundary=${b}` },
    body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${conteudo}\r\n--${b}--`,
  };
}

// Grava os dados; devolve a nova versão do arquivo.
export async function enviar(dados, id = null) {
  const conteudo = JSON.stringify(dados);
  let r;
  if (id) {
    r = await api(`${UPLOAD}/files/${id}?uploadType=media&fields=id,version`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: conteudo,
    });
  } else {
    const m = multipart({ name: FILE_NAME, mimeType: 'application/json' }, conteudo);
    r = await api(`${UPLOAD}/files?uploadType=multipart&fields=id,version`, { method: 'POST', ...m });
  }
  const f = await r.json();
  localStorage.setItem(FILE_KEY, f.id);
  return { id: f.id, versao: String(f.version) };
}

// Uma cópia por dia no Drive; mantém as últimas BACKUPS_MANTER (as mais antigas vão para a lixeira).
async function listarBackups() {
  const r = await api(`${API}/files?q=${q(`name contains '${BACKUP_PREFIXO}' and trashed=false`)}&fields=${q('files(id,name)')}&pageSize=200&spaces=drive`);
  const { files = [] } = await r.json();
  return files.filter((f) => f.name.startsWith(BACKUP_PREFIXO)).sort((a, b) => b.name.localeCompare(a.name));
}

export async function backupDiario(dados, hoje) {
  const nome = `${BACKUP_PREFIXO}${hoje}.json`;
  let backups = await listarBackups();
  if (!backups.some((f) => f.name === nome)) {
    const m = multipart({ name: nome, mimeType: 'application/json' }, JSON.stringify(dados));
    await api(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: 'POST', ...m });
    backups = await listarBackups();
  }
  for (const f of backups.slice(BACKUPS_MANTER)) {
    await api(`${API}/files/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
  }
}
