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

const mobileMenu = document.querySelector('.mobile-menu');
const nav = document.querySelector('nav');

mobileMenu.addEventListener('click', () => {
    nav.classList.toggle('ativo');
});