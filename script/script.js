const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Reveal

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

document.querySelectorAll('.cultos, .hero, .ministerios-container, .galeria, .galeria-grid, .galeria-item, .depoimentos-container, .eventos, .eventos-grid, .eventos-container, .cta-container')
    .forEach(container => {
        container.querySelectorAll('.reveal').forEach((el, i) => {
            el.style.transitionDelay = `${i * 0.12}s`;
        });
    });

// Aviso rápido (toast)

let toastTimer;
function mostrarToast(mensagem) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
    }
    toast.textContent = mensagem;
    toast.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visivel'), 2200);
}

async function copiarTexto(texto, mensagemOk) {
    try {
        await navigator.clipboard.writeText(texto);
        mostrarToast(mensagemOk);
    } catch {
        mostrarToast('Não foi possível copiar. Copie manualmente.');
    }
}

// Menu Hamburguer

const mobileMenu = document.querySelector('.mobile-menu');
const nav = document.querySelector('nav');

if (mobileMenu && nav) {
    const alternarMenu = (aberto) => {
        const ativo = aberto ?? !nav.classList.contains('ativo');
        nav.classList.toggle('ativo', ativo);
        mobileMenu.setAttribute('aria-expanded', String(ativo));
        mobileMenu.setAttribute('aria-label', ativo ? 'Fechar menu' : 'Abrir menu');
    };

    mobileMenu.addEventListener('click', () => alternarMenu());
    mobileMenu.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            alternarMenu();
        }
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => alternarMenu(false)));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') alternarMenu(false);
    });
}

// Cabeçalho fixo, barra de progresso e botão "voltar ao topo"

const header = document.querySelector('header');

const barraProgresso = document.createElement('div');
barraProgresso.className = 'barra-progresso';
barraProgresso.setAttribute('aria-hidden', 'true');
document.body.prepend(barraProgresso);

const botaoTopo = document.createElement('button');
botaoTopo.type = 'button';
botaoTopo.className = 'botao-topo';
botaoTopo.setAttribute('aria-label', 'Voltar ao topo');
botaoTopo.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
botaoTopo.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduzirMovimento ? 'auto' : 'smooth' }));
document.body.appendChild(botaoTopo);

let rolagemAgendada = false;
function aoRolar() {
    rolagemAgendada = false;
    const rolado = window.scrollY;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    barraProgresso.style.width = total > 0 ? `${(rolado / total) * 100}%` : '0%';
    if (header) header.classList.toggle('rolou', rolado > 40);
    botaoTopo.classList.toggle('visivel', rolado > 600);
}
window.addEventListener('scroll', () => {
    if (!rolagemAgendada) {
        rolagemAgendada = true;
        requestAnimationFrame(aoRolar);
    }
}, { passive: true });
aoRolar();

// Link ativo no menu conforme a seção visível

const linksMenu = [...document.querySelectorAll('header nav a[href*="#"]')];
const secoesMenu = linksMenu
    .map(a => document.getElementById(a.hash.slice(1)))
    .filter(Boolean);

if (secoesMenu.length && document.getElementById(linksMenu[0].hash.slice(1))) {
    const spy = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            linksMenu.forEach(a => a.classList.toggle('link-ativo', a.hash === `#${entry.target.id}`));
        });
    }, { rootMargin: '-40% 0px -55% 0px' });
    secoesMenu.forEach(secao => spy.observe(secao));
}

// Próximo culto (usa os data-attributes dos cards da programação)

function formatarHora(hora) {
    const [h, m] = hora.split(':');
    return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

const DURACAO_CULTO_MS = 2 * 60 * 60 * 1000;

// Próxima data de um card de culto (usa data-dia e data-hora). Se o culto está
// acontecendo agora, devolve o início dele.
function proximaOcorrencia(card, agora = new Date()) {
    const [h, m] = card.dataset.hora.split(':').map(Number);
    const inicio = new Date(agora);
    inicio.setHours(h, m, 0, 0);
    inicio.setDate(inicio.getDate() + ((Number(card.dataset.dia) - agora.getDay() + 7) % 7));
    if (inicio.getTime() + DURACAO_CULTO_MS <= agora.getTime()) inicio.setDate(inicio.getDate() + 7);
    return inicio;
}

function atualizarProximoCulto() {
    const faixa = document.getElementById('proximo-culto');
    const cards = [...document.querySelectorAll('.cultos-grid[data-dia]')];
    if (!faixa || !cards.length) return;

    const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const agora = new Date();

    const proximos = cards.map(card => ({ card, inicio: proximaOcorrencia(card, agora) }))
        .sort((a, b) => a.inicio - b.inicio);

    const { card, inicio } = proximos[0];
    const nome = card.dataset.nome;
    const hora = formatarHora(card.dataset.hora);
    const diasAte = Math.round((new Date(inicio).setHours(0, 0, 0, 0) - new Date(agora).setHours(0, 0, 0, 0)) / 86400000);

    let texto;
    if (inicio <= agora) texto = `Acontecendo agora: ${nome}`;
    else if (diasAte === 0) texto = `Hoje às ${hora} · ${nome}`;
    else if (diasAte === 1) texto = `Amanhã às ${hora} · ${nome}`;
    else texto = `Próximo culto: ${dias[inicio.getDay()]} às ${hora} · ${nome}`;

    faixa.textContent = texto;
    faixa.hidden = false;
    cards.forEach(c => c.classList.toggle('proximo', c === card));
}

atualizarProximoCulto();
setInterval(atualizarProximoCulto, 60000);

// Agenda: esconde eventos que já passaram e ordena por data

(function organizarEventos() {
    const container = document.querySelector('.eventos-container');
    const vazio = document.getElementById('eventos-vazio');
    if (!container) return;

    const agora = new Date();
    const eventos = [...container.querySelectorAll('.eventos-grid[data-data]')].map(el => {
        const [a, m, d] = el.dataset.data.split('-').map(Number);
        return { el, fim: new Date(a, m - 1, d, 23, 59, 59) };
    });

    eventos.sort((x, y) => x.fim - y.fim).forEach(({ el }) => container.appendChild(el));

    let restantes = 0;
    eventos.forEach(({ el, fim }) => {
        const passou = fim < agora;
        el.hidden = passou;
        if (!passou) restantes++;
    });

    if (!restantes) {
        container.hidden = true;
        if (vazio) vazio.hidden = false;
    }
})();

// Versículo do dia (muda automaticamente a cada dia)

(function versiculoDoDia() {
    const botao = document.getElementById('versiculo-botao');
    const lista = window.VERSICULOS;
    if (!botao || !lista || !lista.length) return;

    const conteudo = document.getElementById('versiculo-texto');
    const frase = document.getElementById('versiculo-frase');
    const ref = document.getElementById('versiculo-ref');
    const hoje = new Date();
    const chaveHoje = `${hoje.getFullYear()}-${hoje.getMonth() + 1}-${hoje.getDate()}`;
    const CHAVE = 'iejb-versiculo-aberto';

    const mdc = (a, b) => (b ? mdc(b, a % b) : a);
    let passo = 7;
    while (mdc(passo, lista.length) !== 1) passo++;
    const numeroDoDia = Math.floor(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) / 86400000);
    const versiculo = lista[(numeroDoDia * passo) % lista.length];

    frase.textContent = `“${versiculo.texto}”`;
    ref.textContent = `— ${versiculo.ref}`;
    const textoCompartilhar = `“${versiculo.texto}” — ${versiculo.ref}\n\nIEJB · https://iejb.com.br`;
    document.getElementById('versiculo-whatsapp').href = `https://wa.me/?text=${encodeURIComponent(textoCompartilhar)}`;
    document.getElementById('versiculo-copiar').addEventListener('click', () => copiarTexto(textoCompartilhar, 'Versículo copiado!'));

    const sequencia = document.getElementById('versiculo-sequencia');
    const CHAVE_SEQ = 'iejb-versiculo-sequencia';
    const nomeDia = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

    // Dias seguidos abrindo o versículo (guardado só neste navegador)
    const registrarSequencia = () => {
        let dados = { ultimo: '', total: 0 };
        try { dados = JSON.parse(localStorage.getItem(CHAVE_SEQ)) || dados; } catch { /* modo privado */ }
        if (dados.ultimo !== chaveHoje) {
            const ontem = new Date(hoje);
            ontem.setDate(ontem.getDate() - 1);
            dados = { ultimo: chaveHoje, total: dados.ultimo === nomeDia(ontem) ? dados.total + 1 : 1 };
            try { localStorage.setItem(CHAVE_SEQ, JSON.stringify(dados)); } catch { /* modo privado */ }
        }
        if (sequencia && dados.total > 1) {
            sequencia.innerHTML = `<i class="fa-solid fa-fire"></i>${dados.total} dias seguidos com a Palavra`;
            sequencia.hidden = false;
        }
    };

    const abrir = (animar) => {
        conteudo.hidden = false;
        if (animar) conteudo.classList.add('animar');
        botao.hidden = true;
        botao.setAttribute('aria-expanded', 'true');
        registrarSequencia();
    };

    let jaAberto = false;
    try { jaAberto = localStorage.getItem(CHAVE) === chaveHoje; } catch { /* modo privado */ }
    if (jaAberto) abrir(false);

    botao.addEventListener('click', () => {
        abrir(!reduzirMovimento);
        try { localStorage.setItem(CHAVE, chaveHoje); } catch { /* modo privado */ }
    });

    // Imagem para Stories/WhatsApp
    const botaoImagem = document.getElementById('versiculo-imagem');
    if (botaoImagem) {
        botaoImagem.addEventListener('click', async () => {
            botaoImagem.disabled = true;
            try {
                const blob = await gerarImagemVersiculo(versiculo);
                const arquivo = new File([blob], 'versiculo-do-dia-iejb.png', { type: 'image/png' });
                if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
                    await navigator.share({ files: [arquivo], text: 'Versículo do dia · IEJB' });
                } else {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = arquivo.name;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
                    mostrarToast('Imagem salva!');
                }
            } catch (erro) {
                if (erro.name !== 'AbortError') mostrarToast('Não foi possível gerar a imagem.');
            } finally {
                botaoImagem.disabled = false;
            }
        });
    }
})();

async function gerarImagemVersiculo(versiculo) {
    const L = 1080, A = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = L;
    canvas.height = A;
    const ctx = canvas.getContext('2d');

    try {
        await Promise.all([
            document.fonts.load('italic 400 56px "Playfair Display"'),
            document.fonts.load('600 40px "Montserrat"')
        ]);
    } catch { /* usa fonte padrão */ }

    const fundo = ctx.createLinearGradient(0, 0, 0, A);
    fundo.addColorStop(0, '#8F0D0B');
    fundo.addColorStop(1, '#3a0504');
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, L, A);

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '500 34px "Montserrat", sans-serif';
    ctx.fillText('PALAVRA PARA HOJE', L / 2, 330);

    // Quebra o texto em linhas e reduz a fonte até caber
    const larguraMax = L - 200;
    let tamanho = 68;
    let linhas;
    do {
        ctx.font = `italic 400 ${tamanho}px "Playfair Display", serif`;
        linhas = [];
        let atual = '';
        `“${versiculo.texto}”`.split(' ').forEach(palavra => {
            const teste = atual ? `${atual} ${palavra}` : palavra;
            if (ctx.measureText(teste).width > larguraMax && atual) {
                linhas.push(atual);
                atual = palavra;
            } else {
                atual = teste;
            }
        });
        linhas.push(atual);
        tamanho -= 3;
    } while (linhas.length * (tamanho + 3) * 1.4 > 880 && tamanho > 30);

    const alturaLinha = (tamanho + 3) * 1.4;
    let y = (A - linhas.length * alturaLinha) / 2 + alturaLinha / 2;
    ctx.fillStyle = '#ffffff';
    linhas.forEach(linha => {
        ctx.fillText(linha, L / 2, y);
        y += alturaLinha;
    });

    ctx.fillStyle = '#f2b8b5';
    ctx.font = '600 44px "Montserrat", sans-serif';
    ctx.fillText(`— ${versiculo.ref}`, L / 2, y + 40);

    try {
        const logo = new Image();
        logo.src = (document.querySelector('script[src*="script.js"]')?.src || location.href).replace(/script\/[^/]*$/, 'images/logo-iejb-pequeno.png');
        await logo.decode();
        const h = 150;
        ctx.drawImage(logo, L / 2 - (logo.width * h / logo.height) / 2, 1500, logo.width * h / logo.height, h);
    } catch { /* sem logo */ }

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '400 32px "Montserrat", sans-serif';
    ctx.fillText('IEJB · iejb.com.br', L / 2, 1720);

    return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png'));
}

// Lightbox da galeria

(function lightbox() {
    const imagens = [...document.querySelectorAll('.galeria-item img, .pag-galeria-grid img, .linha-tempo-fotos img')];
    if (!imagens.length) return;

    const overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Visualizador de fotos');
    overlay.innerHTML = `
        <button type="button" class="lightbox-fechar" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
        <button type="button" class="lightbox-nav lightbox-anterior" aria-label="Foto anterior"><i class="fa-solid fa-chevron-left"></i></button>
        <figure>
            <img alt="">
        </figure>
        <button type="button" class="lightbox-nav lightbox-proxima" aria-label="Próxima foto"><i class="fa-solid fa-chevron-right"></i></button>`;
    document.body.appendChild(overlay);

    const foto = overlay.querySelector('figure img');
    const botaoFechar = overlay.querySelector('.lightbox-fechar');
    let atual = 0;
    let abertoPor = null;

    const mostrar = (i) => {
        atual = (i + imagens.length) % imagens.length;
        const img = imagens[atual];
        foto.src = img.currentSrc || img.src;
        foto.alt = img.alt;
        [atual + 1, atual - 1].forEach(n => {
            new Image().src = imagens[(n + imagens.length) % imagens.length].src;
        });
    };

    const abrir = (i, origem) => {
        abertoPor = origem;
        mostrar(i);
        overlay.hidden = false;
        document.body.classList.add('lightbox-aberto');
        botaoFechar.focus();
    };

    const fechar = () => {
        overlay.hidden = true;
        document.body.classList.remove('lightbox-aberto');
        if (abertoPor) abertoPor.focus();
    };

    imagens.forEach((img, i) => {
        img.classList.add('lightbox-alvo');
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        img.addEventListener('click', () => abrir(i, img));
        img.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                abrir(i, img);
            }
        });
    });

    botaoFechar.addEventListener('click', fechar);
    overlay.querySelector('.lightbox-anterior').addEventListener('click', () => mostrar(atual - 1));
    overlay.querySelector('.lightbox-proxima').addEventListener('click', () => mostrar(atual + 1));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.tagName === 'FIGURE') fechar();
    });

    document.addEventListener('keydown', (e) => {
        if (overlay.hidden) return;
        if (e.key === 'Escape') fechar();
        else if (e.key === 'ArrowLeft') mostrar(atual - 1);
        else if (e.key === 'ArrowRight') mostrar(atual + 1);
        else if (e.key === 'Tab') {
            const focaveis = [...overlay.querySelectorAll('button')];
            const primeiro = focaveis[0];
            const ultimo = focaveis[focaveis.length - 1];
            if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
            else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
        }
    });

    let inicioX = 0;
    overlay.addEventListener('touchstart', (e) => { inicioX = e.changedTouches[0].clientX; }, { passive: true });
    overlay.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - inicioX;
        if (Math.abs(dx) > 50) mostrar(atual + (dx < 0 ? 1 : -1));
    }, { passive: true });
})();

// Copiar endereço

const botaoEndereco = document.getElementById('copiar-endereco');
if (botaoEndereco) {
    botaoEndereco.addEventListener('click', () => copiarTexto(botaoEndereco.dataset.endereco, 'Endereço copiado!'));
}

// Depoimentos

document.addEventListener("DOMContentLoaded", () => {
    const paragrafos = document.querySelectorAll('.depoimentos .depoimentos-container .depoimentos-grid p');

    // Sem animação (movimento reduzido): mantém o texto completo
    if (reduzirMovimento) {
        paragrafos.forEach(p => p.classList.add('digitado'));
        return;
    }

    // Guarda o texto original de cada parágrafo e limpa o conteúdo visual
    paragrafos.forEach(p => {
        p.dataset.textoCompleto = p.textContent.trim();
        p.setAttribute('aria-label', p.dataset.textoCompleto);
        p.textContent = '';
    });

    // Função que faz o efeito de digitar
    function digitarTexto(elemento) {
        const texto = elemento.dataset.textoCompleto;
        let i = 0;
        elemento.textContent = ''; // Garante que está limpo

        function tipo() {
            if (i < texto.length) {
                elemento.textContent += texto.charAt(i);
                i++;
                setTimeout(tipo, 40); // Velocidade da digitação (em milissegundos)
            } else {
                elemento.classList.add('digitado'); // Some com o cursor no final
            }
        }
        tipo();
    }

    // Observer para detectar quando a seção aparece na tela
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Quando o card aparece, dispara a digitação
                digitarTexto(entry.target);
                observer.unobserve(entry.target); // Para de observar para não repetir o efeito
            }
        });
    }, { threshold: 0.5 }); // Dispara quando 50% do card estiver visível

    // Ativa o observador em cada parágrafo
    paragrafos.forEach(p => observer.observe(p));
});

// Contador "X anos de história" (calculado pelo ano atual)

(function contadorAnos() {
    const el = document.getElementById('historia-anos');
    if (!el) return;
    const anos = new Date().getFullYear() - Number(el.dataset.desde);
    el.textContent = anos;
    if (reduzirMovimento) return;

    el.textContent = '0';
    const iniciar = new IntersectionObserver((entries, obs) => {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        const inicio = performance.now();
        const passo = (agora) => {
            const progresso = Math.min((agora - inicio) / 1500, 1);
            el.textContent = Math.round(anos * (1 - Math.pow(1 - progresso, 3)));
            if (progresso < 1) requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
    }, { threshold: 0.6 });
    iniciar.observe(el);
})();

// Instalação / uso offline (PWA)

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
        const base = new URL('../', document.currentScript?.src || document.querySelector('script[src*="script.js"]').src);
        navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.pathname }).catch(() => { });
    });
}
