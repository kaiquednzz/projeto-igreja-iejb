// Recursos da página inicial para levar o visitante à igreja.
// Depende de script.js (mostrarToast, copiarTexto, proximaOcorrencia, formatarHora, reduzirMovimento).

const LOCAL_IEJB = 'IEJB - Rua Ceará, 128, Jardim Brasil, Araçariguama - SP';
const COORDENADAS_IEJB = { lat: -23.42888942, lng: -47.07071296 };
const NOMES_DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const doisDigitos = (n) => String(n).padStart(2, '0');

// Calendário (.ics)

function formatoICS(d, diaInteiro = false) {
    const data = `${d.getFullYear()}${doisDigitos(d.getMonth() + 1)}${doisDigitos(d.getDate())}`;
    return diaInteiro ? data : `${data}T${doisDigitos(d.getHours())}${doisDigitos(d.getMinutes())}00`;
}

function escaparICS(texto) {
    return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function baixarICS({ titulo, inicio, duracaoMin = 120, diaInteiro = false, descricao = '' }) {
    const fim = new Date(inicio.getTime() + duracaoMin * 60000);
    const fimDia = new Date(inicio);
    fimDia.setDate(fimDia.getDate() + 1);
    const agoraUTC = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

    const linhas = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//IEJB//Site//PT',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:${Date.now()}-${Math.floor(Math.random() * 1e6)}@iejb.com.br`,
        `DTSTAMP:${agoraUTC}`,
        diaInteiro ? `DTSTART;VALUE=DATE:${formatoICS(inicio, true)}` : `DTSTART:${formatoICS(inicio)}`,
        diaInteiro ? `DTEND;VALUE=DATE:${formatoICS(fimDia, true)}` : `DTEND:${formatoICS(fim)}`,
        `SUMMARY:${escaparICS(titulo)}`,
        `LOCATION:${escaparICS(LOCAL_IEJB)}`,
        `DESCRIPTION:${escaparICS(descricao || 'IEJB - Igreja Evangélica do Jardim Brasil. https://iejb.com.br')}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escaparICS(titulo)}`,
        diaInteiro ? 'TRIGGER:-PT15H' : 'TRIGGER:-PT2H',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
    ];

    const blob = new Blob([linhas.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'iejb-lembrete.ics';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    mostrarToast('Lembrete baixado! Abra o arquivo para salvar no calendário.');
}

function textoDataLonga(d) {
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

const cardsCultos = [...document.querySelectorAll('.cultos-grid[data-dia]')];

function baixarICSDoCulto(card) {
    baixarICS({
        titulo: `${card.dataset.nome} - IEJB`,
        inicio: proximaOcorrencia(card),
        descricao: `${card.dataset.nome} na IEJB. Venha como você é! https://iejb.com.br`
    });
}

// Botão "Adicionar ao calendário" do hero (próximo culto)

(function calendarioDoHero() {
    const botao = document.getElementById('proximo-culto-cal');
    if (!botao || !cardsCultos.length) return;
    botao.hidden = false;
    botao.addEventListener('click', () => {
        const card = document.querySelector('.cultos-grid.proximo') || cardsCultos[0];
        baixarICSDoCulto(card);
    });
})();

// Agenda: contagem regressiva, calendário e compartilhamento

const dadosEventos = [];

(function melhorarEventos() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    document.querySelectorAll('.eventos-grid[data-data]:not([hidden])').forEach(el => {
        const [a, m, d] = el.dataset.data.split('-').map(Number);
        const dia = new Date(a, m - 1, d);
        const textos = el.querySelector('.textos');
        const titulo = [textos.querySelector('h4'), textos.querySelector('h3')]
            .map(n => n && n.textContent.trim()).filter(Boolean).join(' - ');
        const descricao = textos.querySelector('p')?.textContent.trim() || '';
        const horarioTxt = el.querySelector('.horario p')?.textContent.trim() || '';
        const local = el.querySelector('.horario address, .horario p:nth-of-type(2)')?.textContent.trim() || LOCAL_IEJB;
        const hora = horarioTxt.match(/(\d{1,2})h(\d{2})?/);
        const inicio = new Date(a, m - 1, d, hora ? Number(hora[1]) : 0, hora ? Number(hora[2] || 0) : 0);

        // Contagem regressiva
        const dias = Math.round((dia - hoje) / 86400000);
        const contagem = document.createElement('span');
        contagem.className = 'contagem';
        contagem.textContent = dias === 0 ? 'É hoje!' : dias === 1 ? 'É amanhã!' : `Faltam ${dias} dias`;
        if (dias <= 1) contagem.classList.add('urgente');
        el.querySelector('.data')?.appendChild(contagem);

        // Ações
        const acoes = document.createElement('div');
        acoes.className = 'evento-acoes';
        acoes.innerHTML = '<button type="button" data-acao="calendario"><i class="fa-regular fa-calendar-plus"></i>Lembrar</button>' +
            '<button type="button" data-acao="compartilhar"><i class="fa-solid fa-share-nodes"></i>Compartilhar</button>';
        el.querySelector('.horario-localizacao')?.appendChild(acoes);

        const textoData = `${textoDataLonga(dia)}${hora ? ` às ${formatarHora(`${hora[1]}:${hora[2] || '00'}`)}` : ''}`;
        acoes.querySelector('[data-acao="calendario"]').addEventListener('click', () => {
            baixarICS({ titulo: titulo, inicio, diaInteiro: !hora, duracaoMin: 120, descricao });
        });
        acoes.querySelector('[data-acao="compartilhar"]').addEventListener('click', async () => {
            const texto = `${titulo}\n${textoData}\n${local}\n\nIEJB · https://iejb.com.br/#eventos`;
            if (navigator.share) {
                try { await navigator.share({ title: titulo, text: texto }); } catch { /* cancelado */ }
            } else {
                copiarTexto(texto, 'Convite copiado!');
            }
        });

        dadosEventos.push({ titulo, descricao, inicio, comHora: Boolean(hora), local });
    });
})();

// Dados estruturados para o Google (gerados a partir do que está na página)

(function dadosEstruturados() {
    const inserir = (objeto) => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(objeto);
        document.head.appendChild(script);
    };

    const iso = (d, comHora) => comHora
        ? `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}T${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}:00-03:00`
        : `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;

    if (dadosEventos.length) {
        inserir(dadosEventos.map(e => ({
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: e.titulo,
            description: e.descricao,
            startDate: iso(e.inicio, e.comHora),
            eventStatus: 'https://schema.org/EventScheduled',
            eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
            location: {
                '@type': 'Place',
                name: e.local,
                address: { '@type': 'PostalAddress', addressLocality: 'Araçariguama', addressRegion: 'SP', addressCountry: 'BR' }
            },
            organizer: { '@type': 'Organization', name: 'IEJB', url: 'https://iejb.com.br' }
        })));
    }

    const perguntas = [...document.querySelectorAll('.duvidas details')].map(d => ({
        '@type': 'Question',
        name: d.querySelector('summary').textContent.trim(),
        acceptedAnswer: { '@type': 'Answer', text: d.querySelector('p').textContent.trim() }
    }));
    if (perguntas.length) {
        inserir({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: perguntas });
    }
})();

// Planeje sua visita

(function planejeSuaVisita() {
    const secao = document.getElementById('planeje');
    const quando = document.getElementById('planeje-quando');
    const resultado = document.getElementById('planeje-resultado');
    if (!secao || !quando || !cardsCultos.length) return;

    const estado = { quem: null, quando: null };

    cardsCultos.forEach((card, i) => {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'chip';
        botao.setAttribute('aria-pressed', 'false');
        botao.dataset.valor = String(i);
        const nomeDia = NOMES_DIAS[card.dataset.dia].replace('-feira', '');
        const dia = nomeDia.charAt(0).toUpperCase() + nomeDia.slice(1);
        botao.textContent = `${dia} · ${card.dataset.nome} · ${formatarHora(card.dataset.hora)}`;
        quando.appendChild(botao);
    });

    const dicas = {
        sozinho: 'Você vai ser muito bem recebido(a). Avise na entrada que é sua primeira vez e a gente te apresenta a igreja.',
        familia: 'O Culto da Família foi pensado para vocês adorarem a Deus juntos, do jeito que são.',
        criancas: 'Conheça o Ministério Infantil, que ensina as crianças sobre o amor de Deus de forma divertida e criativa.',
        jovem: 'Os jovens têm um ministério com atividades especiais, comunhão e crescimento espiritual. Veja também a agenda de eventos.'
    };
    const ministerioDe = { criancas: 'infantil', jovem: 'jovens' };

    const atualizar = () => {
        if (estado.quem === null || estado.quando === null) return;
        const card = cardsCultos[estado.quando];
        const inicio = proximaOcorrencia(card);
        const hora = formatarHora(card.dataset.hora);
        const ministerio = ministerioDe[estado.quem];

        resultado.innerHTML = '';
        const titulo = document.createElement('h4');
        titulo.textContent = 'Seu plano de visita';
        const sugestao = document.createElement('p');
        sugestao.className = 'planeje-sugestao';
        sugestao.innerHTML = `<strong>${card.dataset.nome}</strong>, ${textoDataLonga(inicio)} às ${hora}.`;
        const dica = document.createElement('p');
        dica.textContent = dicas[estado.quem];
        const local = document.createElement('p');
        local.className = 'planeje-local';
        local.innerHTML = '<i class="fa-solid fa-location-dot"></i>Rua Ceará, 128 — Jardim Brasil, Araçariguama';

        const acoes = document.createElement('div');
        acoes.className = 'planeje-acoes';
        const cal = document.createElement('button');
        cal.type = 'button';
        cal.innerHTML = '<i class="fa-regular fa-calendar-plus"></i>Adicionar ao calendário';
        cal.addEventListener('click', () => baixarICSDoCulto(card));
        const rota = document.createElement('a');
        rota.href = `https://www.google.com/maps/dir/?api=1&destination=${COORDENADAS_IEJB.lat},${COORDENADAS_IEJB.lng}`;
        rota.target = '_blank';
        rota.rel = 'noopener noreferrer';
        rota.innerHTML = '<i class="fa-solid fa-route"></i>Como chegar';
        acoes.append(cal, rota);
        if (ministerio) {
            const link = document.createElement('a');
            link.href = `#ministerio-${ministerio}`;
            link.innerHTML = '<i class="fa-solid fa-arrow-down"></i>Ver o ministério';
            acoes.append(link);
        }

        resultado.append(titulo, sugestao, dica, local, acoes);
        resultado.hidden = false;
        if (!resultado.dataset.visto) {
            resultado.dataset.visto = '1';
            resultado.scrollIntoView({ behavior: reduzirMovimento ? 'auto' : 'smooth', block: 'nearest' });
        }
    };

    secao.querySelectorAll('.chips').forEach(grupo => {
        grupo.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (!chip) return;
            grupo.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
            estado[grupo.dataset.grupo] = grupo.dataset.grupo === 'quando' ? Number(chip.dataset.valor) : chip.dataset.valor;
            atualizar();
        });
    });

    secao.hidden = false;
})();

// Quiz: qual ministério combina com você?

(function quizMinisterios() {
    const secao = document.getElementById('quiz');
    const caixa = document.getElementById('quiz-card');
    if (!secao || !caixa) return;

    const perguntas = [
        {
            texto: 'O que você mais gosta de fazer?',
            respostas: [
                ['Cantar ou tocar um instrumento', { louvor: 2 }],
                ['Conversar e ajudar pessoas', { evangelismo: 2 }],
                ['Cuidar e brincar com crianças', { infantil: 2 }],
                ['Me expressar com o corpo e a arte', { danca: 2, louvor: 1 }],
                ['Estar com a galera da minha idade', { jovens: 2 }]
            ]
        },
        {
            texto: 'Onde você se sente mais à vontade?',
            respostas: [
                ['Na equipe de música, perto do palco', { louvor: 2, danca: 1 }],
                ['Na rua, conhecendo gente nova', { evangelismo: 2 }],
                ['Em uma sala cheia de crianças', { infantil: 2 }],
                ['Em um grupo de amigos', { jovens: 2 }]
            ]
        },
        {
            texto: 'Qual frase mais combina com você?',
            respostas: [
                ['Adoro expressar a minha fé com arte', { danca: 2, louvor: 1 }],
                ['Quero levar esperança a quem precisa', { evangelismo: 2 }],
                ['Amo ensinar e ver as crianças aprendendo', { infantil: 2 }],
                ['Quero crescer na fé ao lado de amigos', { jovens: 2 }],
                ['A música me aproxima de Deus', { louvor: 2 }]
            ]
        }
    ];

    let passo = 0;
    let pontos = {};

    const reiniciar = () => { passo = 0; pontos = {}; desenhar(); };

    function desenhar() {
        caixa.innerHTML = '';
        if (passo < perguntas.length) {
            const { texto, respostas } = perguntas[passo];
            const progresso = document.createElement('div');
            progresso.className = 'quiz-progresso';
            progresso.innerHTML = `<span>Pergunta ${passo + 1} de ${perguntas.length}</span><div><i style="width:${(passo / perguntas.length) * 100}%"></i></div>`;
            const pergunta = document.createElement('h4');
            pergunta.textContent = texto;
            const lista = document.createElement('div');
            lista.className = 'quiz-respostas';
            respostas.forEach(([rotulo, valores]) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = rotulo;
                b.addEventListener('click', () => {
                    Object.entries(valores).forEach(([k, v]) => { pontos[k] = (pontos[k] || 0) + v; });
                    passo++;
                    desenhar();
                });
                lista.appendChild(b);
            });
            caixa.append(progresso, pergunta, lista);
            return;
        }

        const ordem = [...document.querySelectorAll('[data-ministerio]')].map(c => c.dataset.ministerio);
        const vencedor = ordem.reduce((melhor, atual) => ((pontos[atual] || 0) > (pontos[melhor] || 0) ? atual : melhor), ordem[0]);
        const card = document.getElementById(`ministerio-${vencedor}`);

        const rotulo = document.createElement('p');
        rotulo.className = 'quiz-rotulo';
        rotulo.textContent = 'Combina com você';
        const nome = document.createElement('h4');
        nome.className = 'quiz-resultado-nome';
        nome.textContent = card.querySelector('.textos h4').textContent;
        const descricao = document.createElement('p');
        descricao.textContent = card.querySelector('.textos p').textContent;

        const acoes = document.createElement('div');
        acoes.className = 'quiz-acoes';
        const ver = document.createElement('a');
        ver.href = `#ministerio-${vencedor}`;
        ver.innerHTML = '<i class="fa-solid fa-arrow-up"></i>Ver o ministério';
        ver.addEventListener('click', () => {
            card.classList.add('destaque');
            setTimeout(() => card.classList.remove('destaque'), 2500);
        });
        const falar = document.createElement('a');
        falar.href = 'https://www.instagram.com/iejbrasil/';
        falar.target = '_blank';
        falar.rel = 'noopener noreferrer';
        falar.innerHTML = '<i class="fa-brands fa-instagram"></i>Quero participar';
        const refazer = document.createElement('button');
        refazer.type = 'button';
        refazer.className = 'quiz-refazer';
        refazer.innerHTML = '<i class="fa-solid fa-rotate-left"></i>Refazer';
        refazer.addEventListener('click', reiniciar);
        acoes.append(ver, falar, refazer);

        caixa.append(rotulo, nome, descricao, acoes);
    }

    desenhar();
    secao.hidden = false;
})();

// Quanto falta até a igreja? (localização só com permissão do visitante)

(function distanciaAteAIgreja() {
    const botao = document.getElementById('btn-distancia');
    const saida = document.getElementById('distancia-resultado');
    if (!botao || !saida) return;
    if (!('geolocation' in navigator)) { botao.hidden = true; return; }

    const haversine = (a, b) => {
        const rad = (g) => (g * Math.PI) / 180;
        const dLat = rad(b.lat - a.lat);
        const dLng = rad(b.lng - a.lng);
        const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };

    botao.addEventListener('click', () => {
        botao.disabled = true;
        saida.hidden = false;
        saida.textContent = 'Buscando a sua localização...';
        navigator.geolocation.getCurrentPosition((pos) => {
            const origem = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            const km = haversine(origem, COORDENADAS_IEJB);
            const distancia = km < 1 ? 'menos de 1 km' : `cerca de ${km.toFixed(1).replace('.', ',')} km`;
            saida.innerHTML = '';
            saida.append(`Você está a ${distancia} da IEJB, em linha reta. `);
            const rota = document.createElement('a');
            rota.href = `https://www.google.com/maps/dir/?api=1&origin=${origem.lat},${origem.lng}&destination=${COORDENADAS_IEJB.lat},${COORDENADAS_IEJB.lng}`;
            rota.target = '_blank';
            rota.rel = 'noopener noreferrer';
            rota.textContent = 'Traçar rota →';
            saida.appendChild(rota);
            botao.disabled = false;
        }, () => {
            saida.textContent = 'Não foi possível pegar a sua localização. Use os botões do Google Maps ou do Waze acima.';
            botao.disabled = false;
        }, { timeout: 10000, maximumAge: 300000 });
    });
})();

// Barra fixa no celular e aviso gentil no computador

(function convitesDiscretos() {
    const barra = document.getElementById('barra-visita');
    const textoBarra = document.getElementById('barra-visita-texto');
    const hero = document.querySelector('.hero');
    const localizacao = document.getElementById('localizacao');
    if (!barra || !hero) return;

    const celular = () => window.matchMedia('(max-width: 700px)').matches;
    let naLocalizacao = false;

    if (localizacao) {
        new IntersectionObserver((entries) => {
            naLocalizacao = entries[0].isIntersecting;
            atualizarBarra();
        }).observe(localizacao);
    }

    function atualizarBarra() {
        const proximo = document.getElementById('proximo-culto');
        const passouDoHero = window.scrollY > hero.offsetHeight - 100;
        const mostrar = celular() && passouDoHero && !naLocalizacao && proximo && !proximo.hidden;
        if (mostrar) textoBarra.textContent = proximo.textContent;
        barra.classList.toggle('visivel', Boolean(mostrar));
        document.body.classList.toggle('barra-ativa', Boolean(mostrar));
    }

    window.addEventListener('scroll', atualizarBarra, { passive: true });
    window.addEventListener('resize', atualizarBarra);
    atualizarBarra();

    // Aviso gentil (uma vez por sessão): só no computador, depois de ler boa parte da página
    let jaViu = false;
    try { jaViu = sessionStorage.getItem('iejb-convite') === '1'; } catch { /* modo privado */ }
    if (jaViu) return;

    const inicio = Date.now();
    const verificar = setInterval(() => {
        const total = document.documentElement.scrollHeight - window.innerHeight;
        const profundidade = total > 0 ? window.scrollY / total : 0;
        const proximo = document.getElementById('proximo-culto');
        if (celular() || naLocalizacao || !proximo || proximo.hidden) return;
        if (Date.now() - inicio < 20000 || profundidade < 0.6) return;

        clearInterval(verificar);
        try { sessionStorage.setItem('iejb-convite', '1'); } catch { /* modo privado */ }

        const aviso = document.createElement('aside');
        aviso.className = 'convite';
        aviso.setAttribute('aria-label', 'Convite para visitar a IEJB');
        aviso.innerHTML = '<button type="button" class="convite-fechar" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>' +
            '<p class="convite-titulo">Quer nos visitar?</p><p class="convite-texto"></p>' +
            '<div class="convite-acoes"><a href="#planeje">Planejar visita</a><a href="#localizacao">Como chegar</a></div>';
        aviso.querySelector('.convite-texto').textContent = proximo.textContent;
        aviso.querySelector('.convite-fechar').addEventListener('click', () => aviso.remove());
        aviso.querySelectorAll('.convite-acoes a').forEach(a => a.addEventListener('click', () => aviso.remove()));
        document.body.appendChild(aviso);
        requestAnimationFrame(() => aviso.classList.add('visivel'));
    }, 2000);
})();
