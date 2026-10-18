// Cache automático: páginas, CSS e JS vêm da rede (com cópia offline); imagens usam o que
// já está guardado e atualizam em segundo plano.
// Não precisa mexer aqui quando o site mudar.
const CACHE = 'iejb-site';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

function guardar(req, resp) {
    // Só guarda respostas boas: um 404 ou 500 não pode virar a "cópia offline"
    if (resp.ok) {
        const copia = resp.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copia));
    }
    return resp;
}

self.addEventListener('fetch', (evento) => {
    const req = evento.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

    // Rede primeiro: assim um HTML novo nunca roda com CSS/JS antigo depois de uma atualização
    if (req.mode === 'navigate' || req.destination === 'style' || req.destination === 'script') {
        evento.respondWith(
            fetch(req).then((resp) => guardar(req, resp))
                .catch(() => caches.match(req).then((guardado) =>
                    guardado || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
        );
        return;
    }

    evento.respondWith(
        caches.open(CACHE).then(async (cache) => {
            const guardado = await cache.match(req);
            const rede = fetch(req).then((resp) => guardar(req, resp)).catch(() => guardado);
            return guardado || rede;
        })
    );
});
