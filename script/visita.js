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
        // "Eu vou!" vem primeiro: guarda o plano e mostra o lembrete no topo (fim do arquivo)
        if (criarBotaoEuVou) acoes.prepend(criarBotaoEuVou(card));
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

// Convide alguém, convite recebido e "Eu vou!" (plano de visita lembrado)
// O convite viaja no link (?convite=1&de=Nome&culto=slug) e vira um card de vidro no hero.
// "Eu vou!" guarda o plano só neste navegador e o mesmo card acompanha a visita: antes do dia,
// no dia e depois dela. O plano tem prioridade sobre o convite: nunca aparecem dois cards.
// Usa também DURACAO_CULTO_MS do script.js.

// O Planeje sua visita usa para pôr o "Eu vou!" no resultado (continua null se não há cultos)
let criarBotaoEuVou = null;

(function conviteEPlanoDeVisita() {
    if (!cardsCultos.length) return;

    const CHAVE_PLANO = 'iejb-visita';
    // 'iejb-convite' (sem o "-recebido") já é usado pelo aviso gentil
    const CHAVE_CONVITE = 'iejb-convite-recebido';
    const DIAS_PARA_PERGUNTAR = 10;
    const DIA_MS = 86400000;
    const ROTA = `https://www.google.com/maps/dir/?api=1&destination=${COORDENADAS_IEJB.lat},${COORDENADAS_IEJB.lng}`;
    const ENDERECO = `${ENDERECO_IEJB.streetAddress}, ${ENDERECO_IEJB.addressLocality} - ${ENDERECO_IEJB.addressRegion}, ${ENDERECO_IEJB.postalCode}`;
    const LOGO = new URL('../images/logo-iejb-pequeno.png', document.currentScript?.src || location.href).href;

    // localStorage/sessionStorage podem falhar (modo privado, cookies bloqueados) sem quebrar nada
    const lerGuardado = (tipo, chave) => {
        try { return JSON.parse(window[tipo].getItem(chave)); } catch { return null; }
    };
    const guardar = (tipo, chave, valor) => {
        try { window[tipo].setItem(chave, JSON.stringify(valor)); } catch { /* modo privado */ }
    };
    const esquecer = (tipo, chave) => {
        try { window[tipo].removeItem(chave); } catch { /* modo privado */ }
    };

    const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const horaDo = (card) => formatarHora(card.dataset.hora);
    // Espaço que não quebra: "às" e a hora ficam sempre na mesma linha
    const quandoLongo = (card, inicio) => `${textoDataLonga(inicio)} às\u00a0${horaDo(card)}`;
    const diasEntre = (de, ate) => Math.round((new Date(ate).setHours(0, 0, 0, 0) - new Date(de).setHours(0, 0, 0, 0)) / DIA_MS);

    function quandoCurto(card, inicio, agora = new Date()) {
        const dias = diasEntre(agora, inicio);
        return `${dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : NOMES_DIAS[inicio.getDay()]} às ${horaDo(card)}`;
    }

    // Nome de quem convida (digitado aqui ou vindo do link): só letras (com acento), espaço,
    // apóstrofo, hífen e ponto, com os espaços colapsados e no máximo 30 caracteres
    function limparNome(texto) {
        const nome = String(texto ?? '').normalize('NFC').replace(/[\u2018\u2019]/g, "'")
            .replace(/[^\p{L}\s'.-]/gu, '').replace(/\s+/g, ' ').trim();
        const curto = [...nome].slice(0, 30).join('').trim();
        return /\p{L}/u.test(curto) ? curto : '';
    }

    const cultoPorNome = (nome) => cardsCultos.find(c => c.dataset.nome === nome) || null;
    const cultoPorSlug = (slug) => {
        const procurado = paraSlug(String(slug ?? ''));
        return (procurado && cardsCultos.find(c => paraSlug(c.dataset.nome) === procurado)) || null;
    };
    const proximoCulto = (agora = new Date()) => cardsCultos
        .map(card => ({ card, inicio: proximoInicio(card, agora) }))
        .sort((a, b) => a.inicio - b.inicio)[0].card;

    // "o Culto da Família", "a EBD": o gênero vem da primeira palavra do nome por extenso
    // (o title do <abbr> do card, quando houver: "Escola Bíblica Dominical")
    function artigo(card) {
        const porExtenso = card.querySelector('abbr[title]')?.title || card.dataset.nome;
        const primeira = limparTexto(porExtenso).split(' ')[0].toLowerCase();
        return /(a|ção|dade|gem)$/.test(primeira) ? 'a' : 'o';
    }

    function linkDoConvite(card, nome) {
        const url = new URL('https://iejb.com.br/');
        url.searchParams.set('convite', '1');
        if (nome) url.searchParams.set('de', nome);
        url.searchParams.set('culto', paraSlug(card.dataset.nome));
        return url.href;
    }

    // Plano guardado: { culto: data-nome, inicio: ISO, salvoEm: ISO }. Qualquer coisa estranha
    // (culto que saiu do site, data inválida, horário que não bate mais com o card) é descartada
    function validarPlano(dados) {
        if (!dados || typeof dados !== 'object') return null;
        const card = typeof dados.culto === 'string' ? cultoPorNome(dados.culto) : null;
        const inicio = new Date(typeof dados.inicio === 'string' ? dados.inicio : NaN);
        const salvoEm = new Date(typeof dados.salvoEm === 'string' ? dados.salvoEm : NaN);
        if (!card || Number.isNaN(inicio.getTime()) || Number.isNaN(salvoEm.getTime())) return null;
        const hora = `${doisDigitos(inicio.getHours())}:${doisDigitos(inicio.getMinutes())}`;
        if (inicio.getDay() !== Number(card.dataset.dia) || hora !== card.dataset.hora) return null;
        // O "Eu vou!" marca sempre a próxima vez do culto, no máximo uma semana depois
        const antecedencia = inicio - salvoEm;
        if (antecedencia <= 0 || antecedencia > 8 * DIA_MS) return null;
        return { card, inicio, salvoEm };
    }

    function validarConvite(dados) {
        if (!dados || typeof dados !== 'object') return null;
        return {
            de: limparNome(typeof dados.de === 'string' ? dados.de : ''),
            card: typeof dados.culto === 'string' ? cultoPorNome(dados.culto) : null
        };
    }

    // Convite que chegou pelo link: fica guardado na sessão (recarregar mantém o card) e sai
    // da barra de endereço, para o nome não ir junto se a pessoa compartilhar a página
    function conviteDaURL() {
        const params = new URLSearchParams(location.search);
        if (params.get('convite') !== '1') return null;
        const convite = { de: limparNome(params.get('de')), card: cultoPorSlug(params.get('culto')) };
        // Culto desconhecido fica vazio: o card mostra o próximo culto que começa
        guardar('sessionStorage', CHAVE_CONVITE, { de: convite.de, culto: convite.card ? convite.card.dataset.nome : '' });
        ['convite', 'de', 'culto'].forEach(p => params.delete(p));
        const busca = params.toString();
        history.replaceState(history.state, '', `${location.pathname}${busca ? `?${busca}` : ''}${location.hash}`);
        return convite;
    }

    let plano = validarPlano(lerGuardado('localStorage', CHAVE_PLANO));
    if (!plano) esquecer('localStorage', CHAVE_PLANO);
    let convite = conviteDaURL() || validarConvite(lerGuardado('sessionStorage', CHAVE_CONVITE));

    // Antes do dia, no dia (até o culto acabar) e depois, por até 10 dias (aí o plano some)
    function estadoDoPlano(agora) {
        if (agora.getTime() < plano.inicio.getTime() + DURACAO_CULTO_MS) {
            const dias = diasEntre(agora, plano.inicio);
            return dias > 0 ? { fase: 'antes', dias } : { fase: 'hoje', comecou: agora >= plano.inicio };
        }
        return diasEntre(plano.inicio, agora) <= DIAS_PARA_PERGUNTAR ? { fase: 'depois' } : null;
    }

    function icone(classes) {
        const i = document.createElement('i');
        i.className = classes;
        i.setAttribute('aria-hidden', 'true');
        return i;
    }

    function criarLink(texto, href, classe, classesIcone, novaAba = false) {
        const a = document.createElement('a');
        a.className = classe;
        a.href = href;
        if (novaAba) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        }
        a.append(icone(classesIcone), texto);
        return a;
    }

    // Rótulo com um trecho que some da vista no celular estreito (o leitor de tela continua lendo)
    function rotuloEncurtavel(antes, opcional, depois) {
        const rotulo = document.createElement('span');
        const extra = document.createElement('span');
        extra.className = 'hero-visita-opcional';
        extra.textContent = opcional;
        rotulo.append(antes, extra, depois);
        return rotulo;
    }

    function criarBotao(texto, classe, classesIcone, aoClicar) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = classe;
        b.append(icone(classesIcone), texto);
        b.addEventListener('click', aoClicar);
        return b;
    }

    // "Eu vou!": confirmado quando o plano guardado é a próxima vez desse culto
    function pintarEuVou(botao) {
        const card = cultoPorNome(botao.dataset.culto);
        const confirmado = Boolean(card && plano && plano.card === card
            && plano.inicio.getTime() === proximoInicio(card).getTime());
        // Só mexe no texto quando muda: o botão do Planeje fica dentro de uma região viva
        if (botao.dataset.confirmado === String(confirmado)) return;
        botao.dataset.confirmado = String(confirmado);
        botao.replaceChildren(icone(confirmado ? 'fa-solid fa-check' : 'fa-regular fa-calendar-check'),
            confirmado ? 'Visita marcada' : 'Eu vou!');
    }

    const sincronizarEuVou = () => document.querySelectorAll('.botao-eu-vou').forEach(pintarEuVou);

    criarBotaoEuVou = (card, classe = '') => {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = `botao-eu-vou ${classe}`.trim();
        botao.dataset.culto = card.dataset.nome;
        botao.addEventListener('click', () => {
            if (plano && botao.dataset.confirmado === 'true') {
                mostrarToast(`Sua visita já está marcada para ${quandoCurto(card, plano.inicio)}.`);
            } else {
                marcarVisita(card);
            }
        });
        pintarEuVou(botao);
        return botao;
    };

    function marcarVisita(card) {
        const agora = new Date();
        plano = { card, inicio: proximoInicio(card, agora), salvoEm: agora };
        guardar('localStorage', CHAVE_PLANO, { culto: card.dataset.nome, inicio: plano.inicio.toISOString(), salvoEm: agora.toISOString() });
        // Quem marcou a visita já respondeu ao convite
        convite = null;
        esquecer('sessionStorage', CHAVE_CONVITE);
        // Longe do topo o card muda sem ninguém ver: o aviso é o que conta
        atualizarCartao();
        sincronizarEuVou();
        mostrarToast(`Visita marcada! Te esperamos ${quandoCurto(card, plano.inicio, agora)}.`);
    }

    function esquecerPlano() {
        plano = null;
        esquecer('localStorage', CHAVE_PLANO);
        atualizarCartao();
        sincronizarEuVou();
    }

    // Card no hero (logo depois do chip do próximo culto)

    let cartao = null;

    function montarCartao({ rotulo, chave, selo, titulo, texto, acoes, aoFechar }) {
        const el = document.createElement('div');
        el.className = 'hero-visita';
        el.setAttribute('role', 'region');
        el.setAttribute('aria-label', rotulo);
        el.dataset.chave = chave;
        const t = document.createElement('p');
        t.className = 'hero-visita-titulo';
        t.tabIndex = -1;
        t.textContent = titulo;
        const p = document.createElement('p');
        p.className = 'hero-visita-texto';
        p.textContent = texto;
        // A contagem vai na mesma linha do texto, numa cápsula (o ponto final é só para o leitor de tela)
        if (selo) {
            const pausa = document.createElement('span');
            pausa.className = 'sr-only';
            pausa.textContent = '.';
            const s = document.createElement('span');
            s.className = 'hero-visita-selo';
            s.textContent = selo;
            p.append(pausa, ' ', s);
        }
        const caixa = document.createElement('div');
        caixa.className = 'hero-visita-acoes';
        caixa.append(...acoes());
        el.append(t, p, caixa);
        if (aoFechar) {
            const fechar = criarBotao('', 'hero-visita-fechar', 'fa-solid fa-xmark', aoFechar);
            fechar.setAttribute('aria-label', 'Fechar');
            el.classList.add('com-fechar');
            el.append(fechar);
        }
        return el;
    }

    function conteudoDoConvite(agora) {
        const card = convite.card || proximoCulto(agora);
        const inicio = proximoInicio(card, agora);
        const para = `${artigo(card)} ${card.dataset.nome}`;
        return {
            rotulo: 'Seu convite',
            chave: `convite|${card.dataset.nome}|${inicio.getTime()}|${convite.de}`,
            titulo: convite.de ? `${convite.de} te convidou para ${para}` : `Você foi convidado(a) para ${para}`,
            texto: maiuscula(quandoLongo(card, inicio)),
            acoes: () => [
                criarBotaoEuVou(card, 'botao-principal'),
                criarLink('Como chegar', '#localizacao', 'botao-vidro', 'fa-solid fa-location-dot')
            ],
            aoFechar: () => {
                convite = null;
                esquecer('sessionStorage', CHAVE_CONVITE);
                atualizarCartao();
            }
        };
    }

    function conteudoDoPlano(estado) {
        const { card, inicio } = plano;
        const nome = card.dataset.nome;
        const chave = `plano|${nome}|${inicio.getTime()}|${estado.fase}|${estado.dias ?? ''}|${estado.comecou ?? ''}`;

        if (estado.fase === 'antes') {
            return {
                rotulo: 'Sua visita',
                chave,
                selo: estado.dias === 1 ? 'É amanhã' : `Faltam ${estado.dias} dias`,
                titulo: 'Sua visita está marcada',
                texto: `${nome}, ${quandoLongo(card, inicio)}`,
                acoes: () => [
                    criarBotao('Adicionar ao calendário', 'botao-principal', 'fa-regular fa-calendar-plus', () => baixarICS({
                        titulo: `${nome} - IEJB`,
                        inicio,
                        descricao: `${nome} na IEJB. Venha como você é! https://iejb.com.br`
                    })),
                    criarLink('Como chegar', '#localizacao', 'botao-vidro', 'fa-solid fa-location-dot'),
                    criarBotao('Desmarcar', 'botao-vidro', 'fa-regular fa-calendar-xmark', () => {
                        esquecerPlano();
                        mostrarToast('Visita desmarcada.');
                    })
                ]
            };
        }

        if (estado.fase === 'hoje') {
            return {
                rotulo: 'Sua visita',
                chave,
                titulo: 'Hoje é o dia!',
                texto: estado.comecou
                    ? `${maiuscula(artigo(card))} ${nome} já começou. Te esperamos!`
                    : `Te esperamos às ${horaDo(card)} n${artigo(card)} ${nome}.`,
                acoes: () => [
                    criarLink('Como chegar', ROTA, 'botao-principal', 'fa-solid fa-route', true),
                    criarBotao('Copiar endereço', 'botao-vidro', 'fa-regular fa-copy', () => copiarTexto(ENDERECO, 'Endereço copiado!'))
                ]
            };
        }

        // Depois: o pedido de avaliação vai para todo mundo, sem filtrar quem gostou (regra do Google)
        return {
            rotulo: 'Sua visita',
            chave,
            titulo: 'E aí, como foi a sua visita?',
            texto: 'Se puder, conte como foi no Google: isso ajuda outras pessoas a conhecerem a IEJB.',
            acoes: () => [
                criarLink('Avaliar no Google', 'https://g.page/r/CdfJHd47s_IREAE/review', 'botao-principal', 'fa-solid fa-star', true),
                criarLink(rotuloEncurtavel('', 'Seguir no ', 'Instagram'), 'https://www.instagram.com/iejbrasil/', 'botao-vidro', 'fa-brands fa-instagram', true),
                criarLink(rotuloEncurtavel('Marcar ', 'outra ', 'visita'), '#planeje', 'botao-vidro', 'fa-regular fa-calendar-plus')
            ],
            aoFechar: esquecerPlano
        };
    }

    // Monta, troca ou tira o card. Se o foco estava nele, vai para o card novo (ou para o
    // primeiro botão do hero, quando o card some), em vez de cair no começo da página.
    function atualizarCartao() {
        const ancora = document.querySelector('.hero .textos #proximo-culto');
        if (!ancora) return;
        const agora = new Date();
        let conteudo = null;
        if (plano) {
            const estado = estadoDoPlano(agora);
            if (estado) {
                conteudo = conteudoDoPlano(estado);
            } else {
                // Mais de 10 dias depois da visita: o plano some sem aviso
                plano = null;
                esquecer('localStorage', CHAVE_PLANO);
            }
        }
        if (!conteudo && convite) conteudo = conteudoDoConvite(agora);
        if (conteudo && cartao && cartao.dataset.chave === conteudo.chave) return;

        const tinhaFoco = Boolean(cartao && cartao.contains(document.activeElement));
        const novo = conteudo ? montarCartao(conteudo) : null;
        if (novo && !cartao && !tinhaFoco) novo.classList.add('entrada');
        if (cartao && novo) cartao.replaceWith(novo);
        else if (novo) ancora.after(novo);
        else if (cartao) cartao.remove();
        cartao = novo;

        if (!tinhaFoco) return;
        if (cartao) cartao.querySelector('.hero-visita-titulo').focus({ preventScroll: true });
        else document.querySelector('.hero .buttons a')?.focus({ preventScroll: true });
    }

    atualizarCartao();
    // A página pode ficar aberta de um dia para o outro: o card e os botões acompanham
    setInterval(() => {
        atualizarCartao();
        sincronizarEuVou();
    }, 60000);

    // Imagem para os Stories (1080x1920), no estilo da imagem do versículo

    function quebrarLinhas(ctx, texto, largura) {
        const linhas = [];
        let atual = '';
        texto.split(' ').forEach(palavra => {
            const teste = atual ? `${atual} ${palavra}` : palavra;
            if (ctx.measureText(teste).width > largura && atual) {
                linhas.push(atual);
                atual = palavra;
            } else {
                atual = teste;
            }
        });
        linhas.push(atual);
        return linhas;
    }

    async function gerarImagemConvite(card, inicio, nome) {
        const L = 1080, A = 1920, MEIO = L / 2, LARGURA = L - 200;
        const canvas = document.createElement('canvas');
        canvas.width = L;
        canvas.height = A;
        const ctx = canvas.getContext('2d');
        const SISTEMA = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const PLAYFAIR = '"Playfair Display", Georgia, serif';
        try {
            await Promise.all([document.fonts.load(`700 140px ${PLAYFAIR}`), document.fonts.load(`italic 700 110px ${PLAYFAIR}`)]);
        } catch { /* usa a fonte reserva */ }

        // Degradê vinho da imagem do versículo, com um brilho em cada canto
        const fundo = ctx.createLinearGradient(0, 0, 0, A);
        fundo.addColorStop(0, '#8F0D0B');
        fundo.addColorStop(1, '#3a0504');
        ctx.fillStyle = fundo;
        ctx.fillRect(0, 0, L, A);
        [[0, 0, '191, 38, 43', 0.5], [L, A, '232, 150, 70', 0.16]].forEach(([x, y, rgb, forca]) => {
            const brilho = ctx.createRadialGradient(x, y, 0, x, y, 1100);
            brilho.addColorStop(0, `rgba(${rgb}, ${forca})`);
            brilho.addColorStop(1, `rgba(${rgb}, 0)`);
            ctx.fillStyle = brilho;
            ctx.fillRect(0, 0, L, A);
        });

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Escreve centralizado, diminuindo a fonte até caber na largura
        const escrever = (texto, y, { tamanho, peso = 400, estilo = '', familia = SISTEMA, cor = '#fff' }) => {
            let t = tamanho;
            do {
                ctx.font = `${estilo} ${peso} ${t}px ${familia}`;
                t -= 2;
            } while (ctx.measureText(texto).width > LARGURA && t > 24);
            ctx.fillStyle = cor;
            ctx.fillText(texto, MEIO, y);
        };

        // Nome do culto em até duas linhas, diminuindo a fonte até caber
        let tamanho = 150;
        let linhas;
        do {
            ctx.font = `700 ${tamanho}px ${PLAYFAIR}`;
            linhas = quebrarLinhas(ctx, card.dataset.nome, LARGURA);
            tamanho -= 6;
        } while ((linhas.length > 2 || linhas.some(l => ctx.measureText(l).width > LARGURA)) && tamanho > 60);
        tamanho += 6;
        const alturaNome = tamanho * 1.12;

        // Bloco central entre as áreas que o Instagram cobre (topo e rodapé dos Stories)
        const altura = 40 + 70 + linhas.length * alturaNome + 60 + 64 + 130 + 140 + 104 + (nome ? 150 : 0);
        let y = 300 + Math.max(0, (1160 - altura) / 2);
        const linha = (h) => {
            const meio = y + h / 2;
            y += h;
            return meio;
        };

        ctx.letterSpacing = '6px';
        escrever('VOCÊ ESTÁ CONVIDADO(A)', linha(40), { tamanho: 34, peso: 600, cor: 'rgba(255, 255, 255, 0.72)' });
        ctx.letterSpacing = '0px';
        y += 70;
        ctx.font = `700 ${tamanho}px ${PLAYFAIR}`;
        ctx.fillStyle = '#fff';
        linhas.forEach(l => ctx.fillText(l, MEIO, linha(alturaNome)));
        y += 60;
        escrever(maiuscula(textoDataLonga(inicio)), linha(64), { tamanho: 56, peso: 500, cor: 'rgba(255, 255, 255, 0.92)' });
        escrever(`às ${horaDo(card)}`, linha(130), { tamanho: 112, peso: 700, estilo: 'italic', familia: PLAYFAIR, cor: '#f2b8b5' });
        y += 69;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(MEIO - 60, y, 120, 2);
        y += 71;
        escrever(ENDERECO_IEJB.streetAddress.replace(' - ', ' · '), linha(52), { tamanho: 40, cor: 'rgba(255, 255, 255, 0.78)' });
        escrever(`${ENDERECO_IEJB.addressLocality} - ${ENDERECO_IEJB.addressRegion}`, linha(52), { tamanho: 40, cor: 'rgba(255, 255, 255, 0.78)' });
        if (nome) {
            y += 80;
            escrever(`Convite de ${nome}`, linha(70), { tamanho: 58, estilo: 'italic', familia: PLAYFAIR });
        }

        try {
            const logo = new Image();
            logo.src = LOGO;
            await logo.decode();
            const h = 150;
            const w = (logo.width * h) / logo.height;
            ctx.drawImage(logo, MEIO - w / 2, 1490, w, h);
        } catch { /* sem logo */ }
        escrever('IEJB · iejb.com.br', 1720, { tamanho: 32, cor: 'rgba(255, 255, 255, 0.75)' });

        return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png'));
    }

    function baixarArquivo(blob, nome) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = nome;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    // Convide alguém (seção #convidar, para quem já frequenta)

    (function convideAlguem() {
        const secao = document.getElementById('convidar');
        const campoNome = document.getElementById('convidar-nome');
        const grupo = document.getElementById('convidar-cultos');
        const mensagem = document.getElementById('convidar-mensagem');
        const linkVisivel = document.getElementById('convidar-link');
        const whatsapp = document.getElementById('convidar-whatsapp');
        const compartilhar = document.getElementById('convidar-compartilhar');
        const imagem = document.getElementById('convidar-imagem');
        if (!secao || !campoNome || !grupo || !mensagem || !linkVisivel || !whatsapp || !compartilhar || !imagem) return;

        // Começa no próximo culto: dá para mandar o convite sem escolher nada
        let escolhido = proximoCulto();

        cardsCultos.forEach(card => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'chip';
            chip.setAttribute('aria-pressed', String(card === escolhido));
            chip.textContent = `${maiuscula(NOMES_DIAS[card.dataset.dia].replace('-feira', ''))} · ${card.dataset.nome} · ${horaDo(card)}`;
            chip.addEventListener('click', () => {
                escolhido = card;
                grupo.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
                atualizar();
            });
            grupo.appendChild(chip);
        });

        const montarConvite = () => {
            const nome = limparNome(campoNome.value);
            const inicio = proximoInicio(escolhido);
            const url = linkDoConvite(escolhido, nome);
            const texto = `Oi! Quero te convidar para ${artigo(escolhido)} ${escolhido.dataset.nome} na IEJB, ${quandoLongo(escolhido, inicio)}. Vem comigo?`;
            return { nome, inicio, url, texto };
        };

        function atualizar() {
            const { url, texto } = montarConvite();
            mensagem.textContent = texto;
            linkVisivel.textContent = url;
            whatsapp.href = `https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`;
        }

        campoNome.addEventListener('input', atualizar);
        // A data é a da próxima vez do culto: refaz no clique, caso a página tenha ficado aberta
        whatsapp.addEventListener('click', atualizar);

        if (!navigator.share) compartilhar.replaceChildren(icone('fa-regular fa-copy'), 'Copiar link');
        compartilhar.addEventListener('click', async () => {
            const { url, texto } = montarConvite();
            if (!navigator.share) {
                copiarTexto(url, 'Link do convite copiado!');
                return;
            }
            try {
                await navigator.share({ title: 'Convite para a IEJB', text: texto, url });
            } catch (erro) {
                if (erro.name !== 'AbortError') copiarTexto(url, 'Link do convite copiado!');
            }
        });

        // aria-disabled em vez de disabled: um botão desabilitado perde o foco do teclado
        let gerando = false;
        imagem.addEventListener('click', async () => {
            if (gerando) return;
            gerando = true;
            imagem.setAttribute('aria-disabled', 'true');
            const { nome, inicio, url, texto } = montarConvite();
            try {
                const blob = await gerarImagemConvite(escolhido, inicio, nome);
                const arquivo = new File([blob], 'convite-iejb.png', { type: 'image/png' });
                let compartilhou = false;
                if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
                    try {
                        await navigator.share({ files: [arquivo], text: `${texto} ${url}` });
                        compartilhou = true;
                    } catch (erro) {
                        // Cancelou: tudo bem. Outro erro (ex.: o navegador não deixou): baixa a imagem
                        if (erro.name === 'AbortError') compartilhou = true;
                    }
                }
                if (!compartilhou) {
                    baixarArquivo(blob, arquivo.name);
                    mostrarToast('Imagem salva! Agora é só postar nos Stories.');
                }
            } catch {
                mostrarToast('Não foi possível gerar a imagem.');
            } finally {
                gerando = false;
                imagem.removeAttribute('aria-disabled');
            }
        });

        atualizar();
        secao.hidden = false;
    })();
})();



// @@FEATURE-STORIES@@ ("Veja como é" entra logo abaixo)



// @@FEATURE-LOCAL@@ (agenda semanal e links de eventos entram logo abaixo)
