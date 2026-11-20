/* Contas Wesley - service worker (v4)
 * - Guarda a "casca" do app no aparelho para abrir rápido e sem internet.
 * - Os dados ficam numa cópia criptografada feita pelo próprio app (não aqui).
 * - Recebe o que você compartilha de outros apps (comprovante, print, texto) e entrega para o app.
 * Ao mudar qualquer arquivo do app, aumente o número da VERSAO para o celular baixar a nova versão.
 */
const VERSAO = 'wrkz-v4';
const COMPARTILHADO = 'wrkz-compartilhado';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO && n !== COMPARTILHADO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Compartilhar para o app (botão Compartilhar do Android).
  if (req.method === 'POST' && url.origin === self.location.origin && url.pathname.endsWith('/compartilhar')) {
    e.respondWith(receberCompartilhado(req));
    return;
  }

  if (req.method !== 'GET') return;                 // a API usa POST: passa direto
  if (url.origin !== self.location.origin) return;  // fontes, leitor de comprovante e Google: passa direto

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

async function receberCompartilhado(req) {
  const escopo = self.registration.scope;
  try {
    const form = await req.formData();
    const c = await caches.open(COMPARTILHADO);
    const chArq = new URL('compartilhado-arquivo', escopo).href, chTxt = new URL('compartilhado-texto', escopo).href;
    await c.delete(chArq); await c.delete(chTxt);
    const arq = form.get('arquivo');
    if (arq && arq.size) await c.put(chArq, new Response(arq, { headers: { 'Content-Type': arq.type || 'application/octet-stream' } }));
    const texto = [form.get('title'), form.get('text'), form.get('url')].filter(Boolean).join('\n');
    if (texto) await c.put(chTxt, new Response(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
  } catch (err) { /* se falhar, o app só avisa que não recebeu nada */ }
  return Response.redirect(new URL('./?acao=compartilhado', escopo).href, 303);
}
