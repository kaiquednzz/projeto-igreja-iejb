// Recursos da página inicial para levar o visitante à igreja.
// Depende de script.js (mostrarToast, copiarTexto, proximaOcorrencia, proximoInicio, formatarHora,
// reduzirMovimento, temObserver).

const LOCAL_IEJB = 'IEJB - Rua Ceará, 128, Jardim Brasil, Araçariguama - SP';
const COORDENADAS_IEJB = { lat: -23.42888942, lng: -47.07071296 };
const NOMES_DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const ENDERECO_IEJB = {
    '@type': 'PostalAddress',
    streetAddress: 'Rua Ceará, 128 - Jardim Brasil',
    addressLocality: 'Araçariguama',
    addressRegion: 'SP',
    postalCode: '18147-000',
    addressCountry: 'BR'
};

const doisDigitos = (n) => String(n).padStart(2, '0');
// Texto do HTML sem as quebras e espaços de indentação
const limparTexto = (t) => (t || '').replace(/\s+/g, ' ').trim();
const paraSlug = (t) => limparTexto(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Calendário (.ics)

function formatoICS(d, diaInteiro = false) {
    const data = `${d.getFullYear()}${doisDigitos(d.getMonth() + 1)}${doisDigitos(d.getDate())}`;
    return diaInteiro ? data : `${data}T${doisDigitos(d.getHours())}${doisDigitos(d.getMinutes())}00`;
}

function escaparICS(texto) {
    return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Os horários do site são de Brasília. Com o TZID, quem estiver em outro fuso recebe o horário certo.
const FUSO_ICS = ['BEGIN:VTIMEZONE', 'TZID:America/Sao_Paulo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0300', 'TZOFFSETTO:-0300', 'TZNAME:-03', 'END:STANDARD', 'END:VTIMEZONE'];

function baixarICS({ titulo, inicio, duracaoMin = 120, diaInteiro = false, descricao = '', local = LOCAL_IEJB }) {
    const fim = new Date(inicio.getTime() + duracaoMin * 60000);
    const fimDia = new Date(inicio);
    fimDia.setDate(fimDia.getDate() + 1);
    const agoraUTC = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

    const linhas = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//IEJB//Site//PT',
        'CALSCALE:GREGORIAN',
        ...FUSO_ICS,
        'BEGIN:VEVENT',
        // UID estável: baixar o mesmo lembrete duas vezes atualiza o evento em vez de duplicar
        `UID:${formatoICS(inicio, true)}-${paraSlug(titulo)}@iejb.com.br`,
        `DTSTAMP:${agoraUTC}`,
        diaInteiro ? `DTSTART;VALUE=DATE:${formatoICS(inicio, true)}` : `DTSTART;TZID=America/Sao_Paulo:${formatoICS(inicio)}`,
        diaInteiro ? `DTEND;VALUE=DATE:${formatoICS(fimDia, true)}` : `DTEND;TZID=America/Sao_Paulo:${formatoICS(fim)}`,
        `SUMMARY:${escaparICS(titulo)}`,
        `LOCATION:${escaparICS(local)}`,
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
        inicio: proximoInicio(card),
        descricao: `${card.dataset.nome} na IEJB. Venha como você é! https://iejb.com.br`
    });
}

// Agenda: contagem regressiva, calendário e compartilhamento

const dadosEventos = [];

(function melhorarEventos() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    document.querySelectorAll('.eventos-grid[data-data]:not([hidden])').forEach(el => {
        const [a, m, d] = el.dataset.data.split('-').map(Number);
        const dia = new Date(a, m - 1, d);
        const textos = el.querySelector('.textos');
        const nomeEvento = limparTexto(textos.querySelector('h4')?.textContent);
        const titulo = [limparTexto(textos.querySelector('.evento-categoria')?.textContent), nomeEvento].filter(Boolean).join(' - ');
        const descricao = limparTexto(textos.querySelector('p:not(.evento-categoria)')?.textContent);
        const horarioTxt = limparTexto(el.querySelector('.horario p')?.textContent);
        // Evento fora da igreja: data-local-nome e data-local-cidade no card
        const externo = Boolean(el.dataset.localNome);
        const local = externo ? `${el.dataset.localNome} - ${el.dataset.localCidade}` : LOCAL_IEJB;
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
        acoes.innerHTML = '<button type="button" data-acao="calendario"><i class="fa-regular fa-calendar-plus" aria-hidden="true"></i>Lembrar</button>' +
            '<button type="button" data-acao="compartilhar"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i>Compartilhar</button>';
        // Quatro botões "Lembrar" iguais confundem o leitor de tela: o nome inclui o evento
        acoes.querySelector('[data-acao="calendario"]').setAttribute('aria-label', `Lembrar: ${nomeEvento}`);
        acoes.querySelector('[data-acao="compartilhar"]').setAttribute('aria-label', `Compartilhar: ${nomeEvento}`);
        el.querySelector('.horario-localizacao')?.appendChild(acoes);

        const textoData = `${textoDataLonga(dia)}${hora ? ` às ${formatarHora(`${hora[1]}:${hora[2] || '00'}`)}` : ''}`;
        acoes.querySelector('[data-acao="calendario"]').addEventListener('click', () => {
            baixarICS({ titulo: titulo, inicio, diaInteiro: !hora, duracaoMin: 120, descricao, local });
        });
        acoes.querySelector('[data-acao="compartilhar"]').addEventListener('click', async () => {
            const texto = `${titulo}\n${textoData}\n${local}\n\nIEJB · https://iejb.com.br/#eventos`;
            if (navigator.share) {
                try { await navigator.share({ title: titulo, text: texto }); } catch { /* cancelado */ }
            } else {
                copiarTexto(texto, 'Convite copiado!');
            }
        });

        dadosEventos.push({
            titulo, descricao, inicio, comHora: Boolean(hora), externo,
            localNome: el.dataset.localNome, localCidade: el.dataset.localCidade,
            imagem: el.dataset.imagem ? new URL(el.dataset.imagem, location.href).href : null
        });
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
            location: e.externo
                ? { '@type': 'Place', name: e.localNome, address: { '@type': 'PostalAddress', addressLocality: e.localCidade, addressRegion: 'SP', addressCountry: 'BR' } }
                : { '@type': 'Place', name: 'IEJB - Igreja Evangélica do Jardim Brasil', address: ENDERECO_IEJB },
            ...(e.imagem ? { image: [e.imagem] } : {}),
            organizer: { '@type': 'Organization', '@id': 'https://iejb.com.br/#igreja', name: 'IEJB - Igreja Evangélica do Jardim Brasil', url: 'https://iejb.com.br/' }
        })));
    }

    const perguntas = [...document.querySelectorAll('.duvidas details')].map(d => ({
        '@type': 'Question',
        name: limparTexto(d.querySelector('summary').textContent),
        acceptedAnswer: { '@type': 'Answer', text: limparTexto(d.querySelector('p').textContent) }
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
        const inicio = proximoInicio(card);
        const hora = formatarHora(card.dataset.hora);
        const ministerio = ministerioDe[estado.quem];

        const titulo = document.createElement('h4');
        titulo.textContent = 'Seu plano de visita';
        const sugestao = document.createElement('p');
        sugestao.className = 'planeje-sugestao';
        const nomeCulto = document.createElement('strong');
        nomeCulto.textContent = card.dataset.nome;
        sugestao.append(nomeCulto, `, ${textoDataLonga(inicio)} às ${hora}.`);
        const dica = document.createElement('p');
        dica.textContent = dicas[estado.quem];
        const local = document.createElement('p');
        local.className = 'planeje-local';
        local.innerHTML = '<i class="fa-solid fa-location-dot" aria-hidden="true"></i>Rua Ceará, 128 - Jardim Brasil, Araçariguama';

        const acoes = document.createElement('div');
        acoes.className = 'planeje-acoes';
        const cal = document.createElement('button');
        cal.type = 'button';
        cal.innerHTML = '<i class="fa-regular fa-calendar-plus" aria-hidden="true"></i>Adicionar ao calendário';
        cal.addEventListener('click', () => baixarICSDoCulto(card));
        const rota = document.createElement('a');
        rota.href = `https://www.google.com/maps/dir/?api=1&destination=${COORDENADAS_IEJB.lat},${COORDENADAS_IEJB.lng}`;
        rota.target = '_blank';
        rota.rel = 'noopener noreferrer';
        rota.innerHTML = '<i class="fa-solid fa-route" aria-hidden="true"></i>Como chegar';
        acoes.append(cal, rota);
        if (ministerio) {
            const link = document.createElement('a');
            link.href = `#ministerio-${ministerio}`;
            link.innerHTML = '<i class="fa-solid fa-arrow-down" aria-hidden="true"></i>Ver o ministério';
            acoes.append(link);
        }

        const preencher = () => {
            resultado.replaceChildren(titulo, sugestao, dica, local, acoes);
            if (!resultado.dataset.visto) {
                resultado.dataset.visto = '1';
                resultado.scrollIntoView({ behavior: reduzirMovimento ? 'auto' : 'smooth', block: 'nearest' });
            }
        };
        // A região viva (aria-live) precisa estar visível antes do texto mudar para ser anunciada
        if (resultado.hidden) {
            resultado.hidden = false;
            requestAnimationFrame(preencher);
        } else {
            preencher();
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
    let historico = []; // pontos de cada resposta, na ordem, para desempatar

    const reiniciar = () => { passo = 0; pontos = {}; historico = []; desenhar(true); };

    // Em empate, vence o ministério que pesou mais na resposta mais recente
    function escolherVencedor(ordem) {
        const maximo = Math.max(...ordem.map(m => pontos[m] || 0));
        let empatados = ordem.filter(m => (pontos[m] || 0) === maximo);
        for (let i = historico.length - 1; i >= 0 && empatados.length > 1; i--) {
            const maior = Math.max(...empatados.map(m => historico[i][m] || 0));
            if (maior > 0) empatados = empatados.filter(m => (historico[i][m] || 0) === maior);
        }
        return empatados[0];
    }

    // focar: depois de uma resposta, o foco vai para o novo título (o botão clicado sumiu)
    function desenhar(focar = false) {
        caixa.innerHTML = '';
        if (passo < perguntas.length) {
            const { texto, respostas } = perguntas[passo];
            const progresso = document.createElement('div');
            progresso.className = 'quiz-progresso';
            // --de: largura da pergunta anterior, para a barra crescer a partir dela (CSS)
            const antes = (Math.max(passo - 1, 0) / perguntas.length) * 100;
            progresso.innerHTML = `<span>Pergunta ${passo + 1} de ${perguntas.length}</span><div><i style="--de:${antes}%; width:${(passo / perguntas.length) * 100}%"></i></div>`;
            const pergunta = document.createElement('h4');
            pergunta.textContent = texto;
            pergunta.tabIndex = -1;
            pergunta.setAttribute('aria-label', `Pergunta ${passo + 1} de ${perguntas.length}: ${texto}`);
            const lista = document.createElement('div');
            lista.className = 'quiz-respostas';
            respostas.forEach(([rotulo, valores]) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = rotulo;
                b.addEventListener('click', () => {
                    Object.entries(valores).forEach(([k, v]) => { pontos[k] = (pontos[k] || 0) + v; });
                    historico.push(valores);
                    passo++;
                    desenhar(true);
                });
                lista.appendChild(b);
            });
            caixa.append(progresso, pergunta, lista);
            if (focar) pergunta.focus({ preventScroll: true });
            return;
        }

        const ordem = [...document.querySelectorAll('[data-ministerio]')].map(c => c.dataset.ministerio);
        const vencedor = escolherVencedor(ordem);
        const card = document.getElementById(`ministerio-${vencedor}`);

        const rotulo = document.createElement('p');
        rotulo.className = 'quiz-rotulo';
        rotulo.textContent = 'Combina com você';
        const nome = document.createElement('h4');
        nome.className = 'quiz-resultado-nome';
        nome.textContent = card.querySelector('.textos h4').textContent;
        nome.tabIndex = -1;
        const descricao = document.createElement('p');
        descricao.textContent = card.querySelector('.textos p').textContent;

        const acoes = document.createElement('div');
        acoes.className = 'quiz-acoes';
        const ver = document.createElement('a');
        ver.href = `#ministerio-${vencedor}`;
        ver.innerHTML = '<i class="fa-solid fa-arrow-up" aria-hidden="true"></i>Ver o ministério';
        ver.addEventListener('click', () => {
            card.classList.add('destaque');
            setTimeout(() => card.classList.remove('destaque'), 2500);
        });
        const falar = document.createElement('a');
        falar.href = 'https://www.instagram.com/iejbrasil/';
        falar.target = '_blank';
        falar.rel = 'noopener noreferrer';
        falar.innerHTML = '<i class="fa-brands fa-instagram" aria-hidden="true"></i>Quero participar';
        const refazer = document.createElement('button');
        refazer.type = 'button';
        refazer.className = 'quiz-refazer';
        refazer.innerHTML = '<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>Refazer';
        refazer.addEventListener('click', reiniciar);
        acoes.append(ver, falar, refazer);

        caixa.append(rotulo, nome, descricao, acoes);
        if (focar) nome.focus({ preventScroll: true });
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

    let buscando = false;
    const terminar = () => {
        buscando = false;
        botao.removeAttribute('aria-disabled');
    };

    botao.addEventListener('click', () => {
        if (buscando) return;
        // aria-disabled em vez de disabled: um botão desabilitado perde o foco do teclado
        buscando = true;
        botao.setAttribute('aria-disabled', 'true');
        saida.textContent = 'Buscando a sua localização...';
        navigator.geolocation.getCurrentPosition((pos) => {
            const origem = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            const km = haversine(origem, COORDENADAS_IEJB);
            const distancia = km < 1 ? 'menos de 1 km' : `cerca de ${km.toFixed(1).replace('.', ',')} km`;
            saida.innerHTML = '';
            saida.append(`Você está a ${distancia} da IEJB, em linha reta. `);
            const rota = document.createElement('a');
            // Sem "origin": o Google Maps usa a localização atual sozinho, e as coordenadas
            // da pessoa não precisam ir no link
            rota.href = `https://www.google.com/maps/dir/?api=1&destination=${COORDENADAS_IEJB.lat},${COORDENADAS_IEJB.lng}`;
            rota.target = '_blank';
            rota.rel = 'noopener noreferrer';
            rota.innerHTML = 'Traçar rota <span aria-hidden="true">→</span>';
            saida.appendChild(rota);
            terminar();
        }, () => {
            saida.textContent = 'Não foi possível pegar a sua localização. Use os botões do Google Maps ou do Waze acima.';
            terminar();
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

    const telaDeCelular = window.matchMedia('(max-width: 700px)');
    const celular = () => telaDeCelular.matches;
    let alturaHero = hero.offsetHeight;
    let naLocalizacao = false;
    const proximoPronto = (el) => el && !el.classList.contains('aguardando');

    if (localizacao && temObserver) {
        new IntersectionObserver((entries) => {
            naLocalizacao = entries[0].isIntersecting;
            atualizarBarra();
        }).observe(localizacao);
    }

    function atualizarBarra() {
        const proximo = document.getElementById('proximo-culto');
        const passouDoHero = window.scrollY > alturaHero - 100;
        const mostrar = Boolean(celular() && passouDoHero && !naLocalizacao && proximoPronto(proximo));
        if (mostrar) textoBarra.textContent = proximo.textContent;
        barra.classList.toggle('visivel', mostrar);
        // Fora da tela, a barra não pode receber o foco do Tab nem ser lida
        barra.inert = !mostrar;
        document.body.classList.toggle('barra-ativa', mostrar);
    }

    let agendada = false;
    window.addEventListener('scroll', () => {
        if (agendada) return;
        agendada = true;
        requestAnimationFrame(() => { agendada = false; atualizarBarra(); });
    }, { passive: true });
    window.addEventListener('resize', () => {
        alturaHero = hero.offsetHeight;
        atualizarBarra();
    });
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
        if (celular() || naLocalizacao || !proximoPronto(proximo)) return;
        if (Date.now() - inicio < 20000 || profundidade < 0.6) return;

        clearInterval(verificar);
        try { sessionStorage.setItem('iejb-convite', '1'); } catch { /* modo privado */ }

        const aviso = document.createElement('aside');
        aviso.className = 'convite';
        aviso.setAttribute('aria-label', 'Convite para visitar a IEJB');
        aviso.innerHTML = '<button type="button" class="convite-fechar" aria-label="Fechar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
            '<p class="convite-titulo">Quer nos visitar?</p><p class="convite-texto"></p>' +
            '<div class="convite-acoes"><a href="#planeje">Planejar visita</a><a href="#localizacao">Como chegar</a></div>';
        aviso.querySelector('.convite-texto').textContent = proximo.textContent;
        aviso.querySelector('.convite-fechar').addEventListener('click', () => aviso.remove());
        aviso.querySelectorAll('.convite-acoes a').forEach(a => a.addEventListener('click', () => aviso.remove()));
        document.body.appendChild(aviso);
        requestAnimationFrame(() => aviso.classList.add('visivel'));
    }, 2000);
})();



// @@FEATURE-CONVITE@@ (convite e plano de visita entram logo abaixo)



// @@FEATURE-STORIES@@ ("Veja como é" entra logo abaixo)

// "Veja como é um culto": os passos da seção #domingo em tela cheia, no formato dos
// Stories. Título e texto vêm de cada <li> (h4 e p) e a foto do data-foto; o último
// cartão convida para o próximo culto. O <dialog> aberto com showModal() já prende o
// foco, fecha no Esc e deixa o resto da página inerte. O tempo de cada passo é a própria
// animação da barra de progresso (CSS, --stories-duracao): quando ela termina, o passo
// avança, e pausar é só congelar a animação (classe .pausado).

(function vejaComoEUmCulto() {
    const secao = document.getElementById('domingo');
    const botao = document.getElementById('abrir-stories');
    if (!secao || !botao) return;
    // Navegador sem <dialog>: o botão continua escondido e a seção segue como lista
    if (typeof HTMLDialogElement !== 'function' || typeof HTMLDialogElement.prototype.showModal !== 'function') return;

    const passos = [...secao.querySelectorAll('.domingo-passos > li')].map(li => ({
        titulo: limparTexto(li.querySelector('h4')?.textContent),
        texto: limparTexto(li.querySelector('p')?.textContent),
        foto: li.dataset.foto || '',
        fotoGrande: li.dataset.fotoGrande || '',
        alt: limparTexto(li.dataset.fotoAlt),
        icone: li.querySelector('.domingo-icone i')
    })).filter(p => p.titulo);
    if (!passos.length) return;

    const TITULO_CONVITE = 'Te esperamos!';
    const total = passos.length + 1; // os passos e o convite no fim

    let dialogo, palco, slides, barras, aviso, botaoPausa, toqueProximo;
    let atual = 0;
    let aberto = false;
    let fechando = false;
    let devolverFoco = true;
    // O passo fica parado se a pessoa pausou, está segurando o dedo na tela,
    // a foto ainda está carregando ou a aba está escondida
    let pausadoPeloUsuario = false;
    let segurando = false;
    let carregando = false;
    let gesto = null;     // toque em andamento: posição inicial e se virou "segurar" ou "arrastar"
    let fimDoGesto = 0;   // quando acabou o último segurar/arrastar (o clique que vem junto é ignorado)
    let timerSegurar = 0;
    let timerFechar = 0;
    let timerAviso = 0;

    const criarIcone = (classes) => {
        const i = document.createElement('i');
        i.className = classes;
        i.setAttribute('aria-hidden', 'true');
        return i;
    };

    const criarBotao = (classe, rotulo, icone) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = classe;
        b.setAttribute('aria-label', rotulo);
        b.appendChild(criarIcone(icone));
        return b;
    };

    // A foto ocupa a tela toda: em telas de alta densidade (celulares) vai a versão maior
    const prepararFoto = (img, passo) => {
        if (passo.fotoGrande) img.srcset = `${passo.foto} 1x, ${passo.fotoGrande} 2x`;
        img.src = passo.foto;
        return img;
    };

    const criarLink = (href, classe, icone, texto) => {
        const a = document.createElement('a');
        a.href = href;
        a.className = classe;
        a.append(criarIcone(icone), texto);
        // Fecha na hora (sem animação) para a página destravar antes de rolar até a seção
        a.addEventListener('click', () => fechar({ animar: false, focarBotao: false }));
        return a;
    };

    // Mesmo texto do hero; se ele ainda não estiver pronto, calcula pelos cards dos cultos
    function textoProximoCulto() {
        const faixa = document.getElementById('proximo-culto');
        if (faixa && !faixa.classList.contains('aguardando')) return limparTexto(faixa.textContent);
        if (!cardsCultos.length) return '';
        const { card, inicio } = cardsCultos
            .map(c => ({ card: c, inicio: proximoInicio(c) }))
            .sort((a, b) => a.inicio - b.inicio)[0];
        return `Próximo culto: ${textoDataLonga(inicio)} às ${formatarHora(card.dataset.hora)} · ${card.dataset.nome}`;
    }

    function criarPasso(passo) {
        const slide = document.createElement('div');
        slide.className = 'stories-slide';
        const foto = document.createElement('div');
        foto.className = 'stories-foto';
        if (passo.foto) {
            const img = prepararFoto(document.createElement('img'), passo);
            img.alt = passo.alt;
            img.decoding = 'async';
            img.draggable = false;
            foto.appendChild(img);
        }

        const legenda = document.createElement('div');
        legenda.className = 'stories-legenda stories-passo';
        if (passo.icone) {
            const icone = document.createElement('span');
            icone.className = 'stories-icone';
            icone.appendChild(passo.icone.cloneNode(true));
            legenda.appendChild(icone);
        }
        const titulo = document.createElement('h2');
        titulo.textContent = passo.titulo;
        const texto = document.createElement('p');
        texto.textContent = passo.texto;
        legenda.append(titulo, texto);

        slide.append(foto, legenda);
        return slide;
    }

    function criarConvite() {
        const slide = document.createElement('div');
        slide.className = 'stories-slide';
        const fundo = document.createElement('div');
        fundo.className = 'stories-foto stories-fundo-convite';
        const legenda = document.createElement('div');
        legenda.className = 'stories-legenda stories-convite';

        const logoHeader = document.querySelector('header .logo img');
        if (logoHeader) {
            const logo = document.createElement('img');
            logo.className = 'stories-logo';
            logo.src = logoHeader.src;
            logo.alt = '';
            logo.width = logoHeader.width;
            logo.height = logoHeader.height;
            legenda.appendChild(logo);
        }
        const titulo = document.createElement('h2');
        titulo.textContent = TITULO_CONVITE;
        legenda.appendChild(titulo);

        const quando = textoProximoCulto();
        if (quando) {
            const chip = document.createElement('p');
            chip.className = 'stories-quando';
            chip.append(criarIcone('fa-regular fa-clock'), quando);
            legenda.appendChild(chip);
        }

        const acoes = document.createElement('div');
        acoes.className = 'stories-acoes';
        const planeje = document.getElementById('planeje');
        if (planeje && !planeje.hidden) {
            acoes.appendChild(criarLink('#planeje', 'botao-principal', 'fa-regular fa-calendar-check', 'Planejar minha visita'));
        }
        if (document.getElementById('localizacao')) {
            acoes.appendChild(criarLink('#localizacao', 'botao-vidro', 'fa-solid fa-location-dot', 'Como chegar'));
        }
        if (acoes.children.length) legenda.appendChild(acoes);

        slide.append(fundo, legenda);
        return slide;
    }

    function atualizarPausa() {
        dialogo.classList.toggle('pausado', pausadoPeloUsuario || segurando || carregando || document.hidden);
        botaoPausa.setAttribute('aria-label', pausadoPeloUsuario ? 'Continuar' : 'Pausar');
        botaoPausa.firstElementChild.className = pausadoPeloUsuario ? 'fa-solid fa-play' : 'fa-solid fa-pause';
    }

    const alternarPausa = () => {
        pausadoPeloUsuario = !pausadoPeloUsuario;
        atualizarPausa();
    };

    function mostrar(i) {
        const indice = Math.min(Math.max(i, 0), total - 1);
        const mudou = indice !== atual;
        atual = indice;
        const ultimo = atual === total - 1;
        // Se o foco está num link do cartão que vai sair, ele não pode se perder
        const focoNoCartao = slides.contains(document.activeElement);

        // Sobras de trocas rápidas saem já; o cartão atual fica por baixo até o novo aparecer
        slides.querySelectorAll('.stories-slide:not(:last-child)').forEach(s => s.remove());
        const velho = slides.lastElementChild;
        velho?.querySelector('.stories-legenda')?.remove();
        const novo = ultimo ? criarConvite() : criarPasso(passos[atual]);
        slides.appendChild(novo);
        const foto = novo.querySelector('.stories-foto');
        foto.addEventListener('animationend', function surgiu(e) {
            if (e.target !== foto) return;
            foto.removeEventListener('animationend', surgiu);
            velho?.remove();
        });
        if (focoNoCartao) palco.focus({ preventScroll: true });

        // A barra de progresso só começa a andar quando a foto chega
        const img = foto.querySelector('img');
        carregando = Boolean(img && !img.complete);
        if (img) {
            const pronta = () => {
                if (slides.lastElementChild !== novo) return;
                carregando = false;
                atualizarPausa();
            };
            img.addEventListener('load', pronta, { once: true });
            img.addEventListener('error', () => { img.remove(); pronta(); }, { once: true });
        }
        const seguinte = passos[atual + 1];
        if (seguinte?.foto) prepararFoto(new Image(), seguinte);

        [...barras.children].forEach((barra, j) => {
            barra.classList.toggle('vista', j < atual);
            barra.classList.remove('atual');
        });
        atualizarPausa();
        void barras.offsetWidth; // recomeça a animação mesmo quando volta para o mesmo passo
        barras.children[atual].classList.add('atual');

        toqueProximo.setAttribute('aria-label', ultimo ? 'Fechar' : 'Próximo passo');
        dialogo.classList.toggle('no-inicio', atual === 0);
        dialogo.classList.toggle('no-fim', ultimo);

        if (mudou) {
            const texto = `Passo ${atual + 1} de ${total}: ${ultimo ? TITULO_CONVITE : passos[atual].titulo}`;
            clearTimeout(timerAviso);
            // Um instante depois: ao abrir, a região viva precisa já estar na tela para ser lida
            timerAviso = setTimeout(() => { aviso.textContent = texto; }, 120);
        }
    }

    // No último cartão, "próximo" fecha, como nos Stories
    const proximo = () => (atual < total - 1 ? mostrar(atual + 1) : fechar());
    // No primeiro, "anterior" recomeça o passo
    const anterior = () => mostrar(atual - 1);

    // Clique que encerra um "segurar" ou "arrastar" não troca de passo
    // (detail 0 = Enter/Espaço no botão, que sempre vale)
    const foiGesto = (e) => e.detail !== 0 && performance.now() - fimDoGesto < 600;

    function montar() {
        dialogo = document.createElement('dialog');
        dialogo.className = 'stories';
        dialogo.setAttribute('aria-label', limparTexto(botao.textContent));

        palco = document.createElement('div');
        palco.className = 'stories-palco';
        palco.tabIndex = -1;

        barras = document.createElement('div');
        barras.className = 'stories-barras';
        barras.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < total; i++) {
            const barra = document.createElement('span');
            barra.className = 'stories-barra';
            barra.appendChild(document.createElement('span'));
            barras.appendChild(barra);
        }

        // Topo: "perfil" da igreja (como nos Stories), pausar e fechar
        const topo = document.createElement('div');
        topo.className = 'stories-topo';
        const autor = document.createElement('div');
        autor.className = 'stories-autor';
        autor.setAttribute('aria-hidden', 'true'); // o nome do diálogo já diz isso
        const icone = document.querySelector('link[rel="apple-touch-icon"]');
        if (icone) {
            const avatar = document.createElement('img');
            avatar.src = icone.href;
            avatar.alt = '';
            avatar.width = 32;
            avatar.height = 32;
            autor.appendChild(avatar);
        }
        const nomes = document.createElement('span');
        const nome = document.createElement('span');
        nome.className = 'stories-autor-nome';
        nome.textContent = 'IEJB';
        const tema = document.createElement('span');
        tema.className = 'stories-autor-tema';
        tema.textContent = limparTexto(secao.querySelector('h2')?.textContent);
        nomes.append(nome, tema);
        autor.appendChild(nomes);

        botaoPausa = criarBotao('stories-botao', 'Pausar', 'fa-solid fa-pause');
        botaoPausa.autofocus = true; // o showModal() leva o foco para cá
        const botaoFechar = criarBotao('stories-botao', 'Fechar', 'fa-solid fa-xmark');
        topo.append(autor, botaoPausa, botaoFechar);

        slides = document.createElement('div');
        slides.className = 'stories-slides';

        // Metade esquerda volta, metade direita avança (no computador, as setas ficam ao lado do cartão)
        const toqueAnterior = criarBotao('stories-toque stories-anterior', 'Passo anterior', 'fa-solid fa-chevron-left');
        toqueProximo = criarBotao('stories-toque stories-proximo', 'Próximo passo', 'fa-solid fa-chevron-right');

        aviso = document.createElement('p');
        aviso.className = 'sr-only';
        aviso.setAttribute('aria-live', 'polite');
        aviso.setAttribute('aria-atomic', 'true');

        palco.append(barras, topo, slides, toqueAnterior, toqueProximo, aviso);
        dialogo.appendChild(palco);
        document.body.appendChild(dialogo);

        botaoPausa.addEventListener('click', alternarPausa);
        botaoFechar.addEventListener('click', () => fechar());
        toqueAnterior.addEventListener('click', (e) => { if (!foiGesto(e)) anterior(); });
        toqueProximo.addEventListener('click', (e) => { if (!foiGesto(e)) proximo(); });

        // A barra do passo atual chegou ao fim: hora de avançar (o convite final fica parado)
        barras.addEventListener('animationend', (e) => {
            if (e.animationName === 'storiesProgresso' && e.target.parentElement === barras.children[atual] && atual < total - 1) {
                mostrar(atual + 1);
            }
        });

        // Esc: fecha com a animação de saída
        dialogo.addEventListener('cancel', (e) => {
            e.preventDefault();
            fechar();
        });
        dialogo.addEventListener('close', () => { if (!dialogo.open) limpar(); });

        dialogo.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                proximo();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                anterior();
            } else if (e.key === ' ' && !e.target.closest('button, a')) {
                // Num botão ou link, o Espaço continua apertando o que tem foco
                e.preventDefault();
                if (!e.repeat) alternarPausa();
            }
        });

        // Clique fora do cartão (computador) fecha, se o clique também começou fora
        let comecouFora = false;
        dialogo.addEventListener('pointerdown', (e) => { comecouFora = e.target === dialogo; });
        dialogo.addEventListener('click', (e) => {
            if (e.target === dialogo && comecouFora) fechar();
        });

        // Gestos: segurar pausa, arrastar para o lado troca de passo, puxar para baixo fecha
        palco.addEventListener('pointerdown', (e) => {
            if (!e.isPrimary || e.button !== 0 || e.target.closest('.stories-topo button, .stories-acoes')) return;
            gesto = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, segurou: false, arrastou: false };
            clearTimeout(timerSegurar);
            timerSegurar = setTimeout(() => {
                if (!gesto || gesto.arrastou) return;
                gesto.segurou = true;
                segurando = true;
                dialogo.classList.add('segurando'); // esconde barras e textos para ver a foto
                atualizarPausa();
            }, 220);
        });

        dialogo.addEventListener('pointermove', (e) => {
            if (!gesto || e.pointerId !== gesto.id) return;
            gesto.dx = e.clientX - gesto.x;
            gesto.dy = e.clientY - gesto.y;
            if (!gesto.arrastou && Math.hypot(gesto.dx, gesto.dy) > 12) {
                gesto.arrastou = true;
                clearTimeout(timerSegurar);
                segurando = true;
                atualizarPausa();
            }
            // Puxando para baixo, o cartão acompanha o dedo
            if (gesto.arrastou && gesto.dy > 0 && gesto.dy > Math.abs(gesto.dx)) {
                dialogo.classList.add('arrastando');
                palco.style.setProperty('--arrasto', `${gesto.dy}px`);
            }
        });

        const terminarGesto = (e) => {
            if (!gesto || e.pointerId !== gesto.id) return;
            clearTimeout(timerSegurar);
            const { dx, dy, segurou, arrastou } = gesto;
            gesto = null;
            segurando = false;
            dialogo.classList.remove('segurando', 'arrastando');
            if (segurou || arrastou) fimDoGesto = performance.now();
            if (arrastou && e.type === 'pointerup') {
                if (dy > 110 && dy > Math.abs(dx)) {
                    fechar({ arrastado: true });
                    return;
                }
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
                    if (dx < 0) proximo();
                    else anterior();
                }
            }
            palco.style.setProperty('--arrasto', '0px'); // volta com a mola (CSS)
            atualizarPausa();
        };
        dialogo.addEventListener('pointerup', terminarGesto);
        dialogo.addEventListener('pointercancel', terminarGesto);
        // Segurar o dedo na foto abriria o menu de salvar imagem do celular
        palco.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    function abrir() {
        if (!dialogo) montar();
        if (aberto) return;
        aberto = true;
        fechando = false;
        devolverFoco = true;
        // Movimento reduzido: começa parado e a pessoa avança no próprio ritmo
        pausadoPeloUsuario = reduzirMovimento;
        segurando = false;
        gesto = null;
        document.documentElement.classList.add('stories-aberto');
        document.addEventListener('visibilitychange', atualizarPausa);
        dialogo.showModal();
        atual = -1;
        mostrar(0);
    }

    function fechar({ animar = true, arrastado = false, focarBotao = true } = {}) {
        if (!aberto || fechando) return;
        devolverFoco = focarBotao;
        if (!animar || reduzirMovimento) {
            concluirFechamento();
            return;
        }
        fechando = true;
        dialogo.classList.toggle('arrastado', arrastado);
        dialogo.classList.add('fechando');
        timerFechar = setTimeout(concluirFechamento, 240);
    }

    function concluirFechamento() {
        if (dialogo.open) dialogo.close();
        limpar();
    }

    // Roda uma vez a cada fechamento, venha de onde vier (botão, Esc, gesto ou link)
    function limpar() {
        if (!aberto) return;
        aberto = false;
        fechando = false;
        [timerFechar, timerSegurar, timerAviso].forEach(clearTimeout);
        document.removeEventListener('visibilitychange', atualizarPausa);
        document.documentElement.classList.remove('stories-aberto');
        dialogo.classList.remove('fechando', 'arrastado', 'arrastando', 'segurando', 'pausado');
        palco.style.setProperty('--arrasto', '0px');
        slides.replaceChildren(); // para as animações e solta as fotos
        aviso.textContent = '';
        gesto = null;
        segurando = false;
        carregando = false;
        if (devolverFoco) botao.focus({ preventScroll: true });
        // O header escolhe o vidro claro ou escuro pelo que está atrás dele, e isso só é
        // refeito ao rolar: um "scroll" avisa o script.js para conferir de novo
        window.dispatchEvent(new Event('scroll'));
    }

    botao.addEventListener('click', abrir);
    // Começa a baixar a primeira foto quando a pessoa mira no botão
    const preCarregar = () => { if (passos[0].foto) prepararFoto(new Image(), passos[0]); };
    botao.addEventListener('pointerenter', preCarregar, { once: true });
    botao.addEventListener('focus', preCarregar, { once: true });
    botao.hidden = false;
})();



// @@FEATURE-LOCAL@@ (agenda semanal e links de eventos entram logo abaixo)
