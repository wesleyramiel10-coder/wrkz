/* Contas Wesley - service worker (Etapa 1)
 * Guarda a "casca" do app no aparelho para abrir rápido.
 * Os dados NÃO ficam aqui: eles vêm sempre da API (o modo off-line é a Etapa 2).
 * Ao mudar qualquer arquivo do app, aumente o número da VERSAO para o celular baixar a nova versão.
 */
const VERSAO = 'wrkz-v2';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                              // a API usa POST: passa direto
  if (new URL(req.url).origin !== self.location.origin) return;  // fontes e Google: passa direto

  // A página: tenta a internet primeiro (pega atualizações); sem internet, usa a cópia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put('./index.html', copia)); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Ícones e manifesto: usa a cópia guardada; se não tiver, busca na internet.
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
