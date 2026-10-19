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

// O padrão do .ics pede linhas de até 75 bytes: as maiores são "dobradas" (quebra + espaço).
// Conta bytes e não letras, porque "á" e "ç" ocupam 2 bytes em UTF-8
const codificadorUTF8 = new TextEncoder();
function dobrarLinhaICS(linha) {
    const partes = [];
    let atual = '';
    let bytes = 0;
    for (const letra of linha) {
        const tamanho = codificadorUTF8.encode(letra).length;
        // As partes seguintes começam com o espaço, então cabem 74 bytes
        if (bytes + tamanho > (partes.length ? 74 : 75)) {
            partes.push(atual);
            atual = '';
            bytes = 0;
        }
        atual += letra;
        bytes += tamanho;
    }
    partes.push(atual);
    return partes.join('\r\n ');
}

// Linhas de um VEVENT. "repetir" vira a RRULE (ex.: 'FREQ=WEEKLY')
function eventoICS({ uid, titulo, inicio, duracaoMin = 120, diaInteiro = false, descricao = '', local = LOCAL_IEJB, repetir = '' }) {
    const fim = new Date(inicio.getTime() + duracaoMin * 60000);
    const fimDia = new Date(inicio);
    fimDia.setDate(fimDia.getDate() + 1);
    const agoraUTC = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

    return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${agoraUTC}`,
        diaInteiro ? `DTSTART;VALUE=DATE:${formatoICS(inicio, true)}` : `DTSTART;TZID=America/Sao_Paulo:${formatoICS(inicio)}`,
        diaInteiro ? `DTEND;VALUE=DATE:${formatoICS(fimDia, true)}` : `DTEND;TZID=America/Sao_Paulo:${formatoICS(fim)}`,
        ...(repetir ? [`RRULE:${repetir}`] : []),
        `SUMMARY:${escaparICS(titulo)}`,
        `LOCATION:${escaparICS(local)}`,
        `DESCRIPTION:${escaparICS(descricao || 'IEJB - Igreja Evangélica do Jardim Brasil. https://iejb.com.br')}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escaparICS(titulo)}`,
        diaInteiro ? 'TRIGGER:-PT15H' : 'TRIGGER:-PT2H',
        'END:VALARM',
        'END:VEVENT'
    ];
}

// Junta os VEVENTs (listas de linhas do eventoICS) num arquivo .ics, baixa e avisa
function salvarICS(eventos, nomeArquivo, mensagem) {
    const linhas = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//IEJB//Site//PT',
        'CALSCALE:GREGORIAN',
        ...FUSO_ICS,
        ...eventos.flat(),
        'END:VCALENDAR'
    ];

    const blob = new Blob([linhas.map(dobrarLinhaICS).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    mostrarToast(mensagem);
}

function baixarICS({ titulo, inicio, duracaoMin = 120, diaInteiro = false, descricao = '', local = LOCAL_IEJB }) {
    // UID estável: baixar o mesmo lembrete duas vezes atualiza o evento em vez de duplicar
    const uid = `${formatoICS(inicio, true)}-${paraSlug(titulo)}@iejb.com.br`;
    salvarICS([eventoICS({ uid, titulo, inicio, duracaoMin, diaInteiro, descricao, local })],
        'iejb-lembrete.ics', 'Lembrete baixado! Abra o arquivo para salvar no calendário.');
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

    // Link próprio de cada card (#evento-AAAA-MM-DD-nome). Os que já passaram também
    // ganham id: assim quem abre um link antigo fica sabendo que o evento aconteceu
    const idsUsados = new Set();
    document.querySelectorAll('.eventos-grid[data-data]').forEach(el => {
        if (!el.id) {
            const textos = el.querySelector('.textos');
            const nome = paraSlug(textos?.querySelector('h4')?.textContent || textos?.querySelector('.evento-categoria')?.textContent);
            const base = ['evento', el.dataset.data, nome].filter(Boolean).join('-');
            let id = base;
            // Dois eventos com a mesma data e o mesmo nome: o segundo vira ...-2
            for (let n = 2; idsUsados.has(id) || document.getElementById(id); n++) id = `${base}-${n}`;
            el.id = id;
        }
        idsUsados.add(el.id);
    });

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
        // Endereço público do card: abre a home já rolada até ele (abrirEventoDoLink)
        const link = `https://iejb.com.br/#${el.id}`;
        acoes.querySelector('[data-acao="calendario"]').addEventListener('click', () => {
            baixarICS({ titulo: titulo, inicio, diaInteiro: !hora, duracaoMin: 120, descricao, local });
        });
        acoes.querySelector('[data-acao="compartilhar"]').addEventListener('click', async () => {
            const convite = `${titulo}\n${textoData}\n${local}\n\nIEJB`;
            if (navigator.share) {
                // O link vai só no campo url: o Chrome do Android junta texto e url numa
                // mensagem só, e no WhatsApp ele apareceria duas vezes
                try { await navigator.share({ title: titulo, text: convite, url: link }); } catch { /* cancelado */ }
            } else {
                copiarTexto(`${convite} · ${link}`, 'Convite copiado!');
            }
        });

        dadosEventos.push({
            titulo, descricao, inicio, comHora: Boolean(hora), externo, url: link,
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
            url: e.url,
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



// @@FEATURE-LOCAL@@ (agenda semanal e links de eventos entram logo abaixo)

// Agenda semanal: um .ics só, com um evento que se repete toda semana para cada culto

(function agendaSemanal() {
    const bloco = document.getElementById('agenda-semanal');
    const botao = document.getElementById('agenda-semanal-botao');
    if (!bloco || !botao || !cardsCultos.length) return;

    botao.addEventListener('click', () => {
        const usados = new Set();
        const eventos = cardsCultos.map(card => {
            const nome = card.dataset.nome;
            // UID estável por culto: baixar de novo atualiza a agenda em vez de duplicar.
            // Sem o "culto" repetido (culto-da-familia, e não culto-culto-da-familia)
            let uid = `culto-${paraSlug(nome).replace(/^culto-/, '')}`;
            // Dois cultos com o mesmo nome em dias ou horários diferentes não podem dividir o UID
            if (usados.has(uid)) uid += `-${paraSlug(NOMES_DIAS[card.dataset.dia])}-${card.dataset.hora.replace(':', '')}`;
            usados.add(uid);
            return eventoICS({
                uid: `${uid}@iejb.com.br`,
                titulo: `${nome} - IEJB`,
                inicio: proximoInicio(card),
                // Mesma descrição do lembrete de um culto só (baixarICSDoCulto)
                descricao: `${nome} na IEJB. Venha como você é! https://iejb.com.br`,
                repetir: 'FREQ=WEEKLY'
            });
        });
        salvarICS(eventos, 'iejb-cultos.ics', 'Agenda baixada! Abra o arquivo para salvar os cultos no calendário.');
    });

    bloco.hidden = false;
})();

// Link direto para um evento (#evento-...): os ids nascem no melhorarEventos, então o
// navegador não rola sozinho ao abrir a página. Quando tudo carrega, rola até o card e
// destaca por alguns segundos. Evento que já passou (ou não existe): avisa e mostra a agenda.

(function abrirEventoDoLink() {
    const secao = document.getElementById('eventos');
    if (!secao) return;
    const comportamento = reduzirMovimento ? 'auto' : 'smooth';
    let timerDestaque;

    function irParaEvento() {
        let id;
        try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
        if (!id.startsWith('evento-')) return;

        const card = document.getElementById(id);
        if (!card || !card.matches('.eventos-grid') || card.closest('[hidden]')) {
            mostrarToast('Esse evento já aconteceu. Veja os próximos na agenda.');
            secao.scrollIntoView({ behavior: comportamento, block: 'start' });
            return;
        }

        // Leitor de tela: o foco vai para o nome do evento, como num link âncora comum.
        // Antes de rolar: em navegador sem preventScroll, o foco pularia por cima da rolagem suave
        const nome = card.querySelector('.textos h4');
        if (nome) {
            nome.tabIndex = -1;
            nome.focus({ preventScroll: true });
        }
        // Centralizado quando cabe; card mais alto que a tela (celular pequeno) para logo abaixo do header
        const cabe = card.offsetHeight < window.innerHeight - 140;
        card.scrollIntoView({ behavior: comportamento, block: cabe ? 'center' : 'start' });

        document.querySelectorAll('.evento-destaque').forEach(c => c.classList.remove('evento-destaque'));
        clearTimeout(timerDestaque);
        card.classList.add('evento-destaque');
        timerDestaque = setTimeout(() => card.classList.remove('evento-destaque'), 4000);
    }

    window.addEventListener('hashchange', irParaEvento);
    if (!location.hash.startsWith('#evento-')) return;

    // Espera as imagens e as fontes (a altura da página para de mudar), no máximo 3s
    const carregou = new Promise(pronto => {
        if (document.readyState === 'complete') pronto();
        else window.addEventListener('load', pronto, { once: true });
    });
    Promise.race([
        carregou.then(() => document.fonts?.ready),
        new Promise(pronto => setTimeout(pronto, 3000))
    ]).then(() => requestAnimationFrame(irParaEvento));
})();
