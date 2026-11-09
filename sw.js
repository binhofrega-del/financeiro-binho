// Service worker do Financeiro Binho (gerado no build com a versão abaixo).
// - Página: tenta a internet primeiro (sempre a versão mais nova); sem internet, usa a cópia guardada.
// - Arquivos do app (js/css/ícones): usa a cópia guardada e busca na internet só se faltar.
// - Nunca mexe nas chamadas ao Google (login e Drive).
const VERSAO = '1.4.1-f87be92-1794249069816';
const CACHE = `fin-binho-${VERSAO}`;
const BASE = new URL('./', self.location).pathname;
const ESSENCIAIS = ['', 'index.html', 'manifest.json', 'icon.svg', 'icon-192.png', 'apple-touch-icon.png'].map((p) => BASE + p);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESSENCIAIS)).catch(() => {}));
  // não ativa sozinho: espera o usuário tocar em "Atualizar" (ou fechar o app)
});

self.addEventListener('message', (e) => {
  if (e.data === 'atualizar') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('fin-binho-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function guardar(req, resp) {
  if (resp && resp.ok && resp.type === 'basic') {
    const copia = resp.clone();
    caches.open(CACHE).then((c) => c.put(req, copia));
  }
  return resp;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  // só a página do app (raiz ou index.html) é tratada como app; outros arquivos abertos direto passam reto
  const ehPaginaDoApp = url.pathname === BASE || url.pathname === BASE + 'index.html';
  if (req.mode === 'navigate' && !ehPaginaDoApp) return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const daRede = fetch(req).then((r) => ((r.headers.get('content-type') || '').includes('text/html') ? guardar(BASE + 'index.html', r) : r));
      // rede lenta: depois de 4s mostra a cópia guardada (se houver)
      const espera = new Promise((res) => setTimeout(() => res(null), 4000)).then(() => caches.match(BASE + 'index.html'));
      try {
        return (await Promise.race([daRede, espera])) || (await daRede);
      } catch {
        return (await caches.match(BASE + 'index.html')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith(caches.match(req).then((achou) => achou || fetch(req).then((r) => guardar(req, r))));
});
