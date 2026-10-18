// Cache automático: páginas, CSS e JS vêm da rede (com cópia offline); imagens usam o que
// já está guardado e atualizam em segundo plano.
// Não precisa mexer aqui quando o site mudar.
const CACHE = 'iejb-site';

// A primeira visita não passa pelo service worker (ele ainda nem existia),
// então a home é guardada já na instalação: é a página que aparece offline
self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE).then((cache) => cache.add('./')).catch(() => { }));
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

function guardar(evento, chave, resp) {
    // Só guarda respostas boas: um 404 ou 500 não pode virar a "cópia offline".
    // Redirecionadas também não: o navegador recusa usá-las como página depois
    if (resp.ok && !resp.redirected) {
        const copia = resp.clone();
        evento.waitUntil(caches.open(CACHE).then((cache) => cache.put(chave, copia)));
    }
    return resp;
}

// Sem rede: devolve a cópia guardada. Para páginas, ignora a query (?utm_source=...,
// ?fbclid=...) e, se aquela página nunca foi aberta, mostra a home guardada.
async function semRede(req) {
    const navegacao = req.mode === 'navigate';
    const guardado = await caches.match(req, { ignoreSearch: navegacao });
    if (guardado) return guardado;
    if (!navegacao) return Response.error();

    const casa = await caches.match(self.registration.scope);
    // Só redireciona se a home existe no cache e não é ela mesma que falhou (senão entra em loop)
    if (casa && new URL(req.url).pathname !== new URL(self.registration.scope).pathname) {
        return Response.redirect(self.registration.scope, 302);
    }
    return casa || Response.error();
}

self.addEventListener('fetch', (evento) => {
    const req = evento.request;
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== self.location.origin) return;

    // Rede primeiro: assim um HTML novo nunca roda com CSS/JS antigo depois de uma atualização
    if (req.mode === 'navigate' || req.destination === 'style' || req.destination === 'script') {
        // Páginas são guardadas sem a query, para cada link do Instagram não virar uma cópia nova
        const chave = req.mode === 'navigate' ? url.origin + url.pathname : req;
        evento.respondWith(
            fetch(req).then((resp) => guardar(evento, chave, resp)).catch(() => semRede(req))
        );
        return;
    }

    evento.respondWith(
        caches.open(CACHE).then(async (cache) => {
            const guardado = await cache.match(req);
            const rede = fetch(req).then((resp) => guardar(evento, req, resp)).catch(() => guardado || Response.error());
            // Mantém o service worker vivo até a atualização em segundo plano terminar
            evento.waitUntil(rede);
            return guardado || rede;
        })
    );
});
