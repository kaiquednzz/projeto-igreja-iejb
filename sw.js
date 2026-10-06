// Cache automático: páginas vêm da rede (com cópia offline); imagens, CSS e JS usam o que
// já está guardado e atualizam em segundo plano.
// Não precisa mexer aqui quando o site mudar.
const CACHE = 'iejb-site';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (evento) => {
    const req = evento.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

    if (req.mode === 'navigate') {
        evento.respondWith(
            fetch(req).then((resp) => {
                const copia = resp.clone();
                caches.open(CACHE).then((cache) => cache.put(req, copia));
                return resp;
            }).catch(() => caches.match(req).then((guardado) => guardado || caches.match('./index.html')))
        );
        return;
    }

    evento.respondWith(
        caches.open(CACHE).then(async (cache) => {
            const guardado = await cache.match(req);
            const rede = fetch(req).then((resp) => {
                if (resp.ok) cache.put(req, resp.clone());
                return resp;
            }).catch(() => guardado);
            return guardado || rede;
        })
    );
});
