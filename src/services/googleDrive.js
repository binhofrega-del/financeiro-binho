const CLIENT_ID = '1044474226374-ldulpr3a7dliiv6olgmnke9995pp1hbu.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const FILE_NAME = 'financeiro-binho.json';
const TOKEN_KEY = 'fin_binho_token';

let tokenClient = null;
let fileId = null;
let onStatusChange = null;
let onDadosCarregados = null;

// ── Salvar/restaurar token ─────────────────────────────────────────────────

function salvarToken(token) {
  const expiry = Date.now() + (token.expires_in * 1000);
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...token, expiry }));
}

function tokenSalvo() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const token = JSON.parse(raw);
    // Token válido se não expirou (com 5min de margem)
    if (Date.now() < token.expiry - 300000) return token;
    localStorage.removeItem(TOKEN_KEY);
    return null;
  } catch { return null; }
}

function limparToken() {
  localStorage.removeItem(TOKEN_KEY);
  fileId = null;
}

// ── Inicialização ──────────────────────────────────────────────────────────

export function initGoogleDrive(statusCallback, dadosCallback) {
  onStatusChange = statusCallback;
  onDadosCarregados = dadosCallback;

  return new Promise((resolve) => {
    if (!window.gapi || !window.google) {
      setTimeout(() => initGoogleDrive(statusCallback, dadosCallback).then(resolve), 500);
      return;
    }

    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });

        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: async (response) => {
            if (response.error) { onStatusChange?.('erro'); return; }
            salvarToken(response);
            window.gapi.client.setToken(response);
            onStatusChange?.('sincronizando');
            try {
              const dados = await loadFromDrive();
              if (dados) onDadosCarregados?.(dados);
              onStatusChange?.('conectado');
            } catch { onStatusChange?.('conectado'); }
          },
        });

        // Tenta restaurar sessão anterior sem pedir login
        const token = tokenSalvo();
        if (token) {
          window.gapi.client.setToken(token);
          onStatusChange?.('sincronizando');
          try {
            const dados = await loadFromDrive();
            if (dados) onDadosCarregados?.(dados);
            onStatusChange?.('conectado');
          } catch {
            limparToken();
            onStatusChange?.('desconectado');
          }
        } else {
          onStatusChange?.('desconectado');
        }

        resolve();
      } catch { onStatusChange?.('desconectado'); resolve(); }
    });
  });
}

// ── Login / Logout ─────────────────────────────────────────────────────────

export function signIn() {
  if (!tokenClient) return;
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

export function signOut() {
  const token = window.gapi.client?.getToken();
  if (token) {
    window.google.accounts.oauth2.revoke(token.access_token, () => {});
    window.gapi.client.setToken('');
  }
  limparToken();
  onStatusChange?.('desconectado');
}

export function isSignedIn() {
  const token = window.gapi.client?.getToken();
  return !!(token && token.access_token);
}

// ── Arquivo no Drive ───────────────────────────────────────────────────────

async function encontrarArquivo() {
  try {
    const res = await window.gapi.client.drive.files.list({
      q: `name='${FILE_NAME}' and trashed=false`,
      fields: 'files(id,name,modifiedTime)',
      spaces: 'drive',
      orderBy: 'modifiedTime desc',
    });
    const files = res.result.files;
    if (files && files.length > 0) { fileId = files[0].id; return fileId; }
    return null;
  } catch { return null; }
}

export async function loadFromDrive() {
  if (!isSignedIn()) return null;
  await encontrarArquivo();
  if (!fileId) return null;
  const res = await window.gapi.client.drive.files.get({ fileId, alt: 'media' });
  return JSON.parse(res.body);
}

export async function saveToDrive(dados) {
  if (!isSignedIn()) return;
  onStatusChange?.('salvando');
  const content = JSON.stringify(dados);
  if (!fileId) await encontrarArquivo();
  try {
    if (fileId) {
      await window.gapi.client.request({
        path: `/upload/drive/v3/files/${fileId}`,
        method: 'PATCH',
        params: { uploadType: 'media' },
        headers: { 'Content-Type': 'application/json' },
        body: content,
      });
    } else {
      const boundary = 'fin_boundary_xyz';
      const meta = JSON.stringify({ name: FILE_NAME, mimeType: 'application/json' });
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
      const res = await window.gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      });
      fileId = res.result.id;
    }
    onStatusChange?.('conectado');
  } catch { onStatusChange?.('erro'); }
}
