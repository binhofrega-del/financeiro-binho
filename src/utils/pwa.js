// Registro do service worker (app offline + aviso de nova versão). Só no app publicado.
let registro = null;
const ouvintes = new Set();
let temNovaVersao = false;

function avisar() {
  temNovaVersao = true;
  ouvintes.forEach((f) => f(true));
}

export function aoTerNovaVersao(fn) {
  ouvintes.add(fn);
  if (temNovaVersao) fn(true);
  return () => ouvintes.delete(fn);
}

export function registrarServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  window.addEventListener('load', async () => {
    try {
      registro = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
      if (registro.waiting && navigator.serviceWorker.controller) avisar();
      registro.addEventListener('updatefound', () => {
        const novo = registro.installing;
        novo?.addEventListener('statechange', () => {
          if (novo.state === 'installed' && navigator.serviceWorker.controller) avisar();
        });
      });
      // procura versão nova ao voltar para o app
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registro.update().catch(() => {});
      });
    } catch { /* sem service worker: o app funciona normalmente, só não abre offline */ }
  });
  // recarrega só quando o usuário pediu para atualizar (na 1ª instalação não recarrega)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!pediuAtualizar) return;
    pediuAtualizar = false;
    window.location.reload();
  });
}

let pediuAtualizar = false;
export function atualizarAgora() {
  if (registro?.waiting) {
    pediuAtualizar = true;
    registro.waiting.postMessage('atualizar');
  } else window.location.reload();
}
