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

// Menu Hamburguer

const mobileMenu = document.querySelector('.mobile-menu');
const nav = document.querySelector('nav');

mobileMenu.addEventListener('click', () => {
    nav.classList.toggle('ativo');
});

// Depoimentos

document.addEventListener("DOMContentLoaded", () => {
    const paragrafos = document.querySelectorAll('.depoimentos .depoimentos-container .depoimentos-grid p');

    // Guarda o texto original de cada parágrafo e limpa o conteúdo visual
    paragrafos.forEach(p => {
        p.dataset.textoCompleto = p.textContent.trim();
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