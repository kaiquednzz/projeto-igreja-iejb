# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static website (pt-BR) for the church IEJB (Araçariguama, SP). Plain HTML/CSS/JS — no build step, package manager, linter or tests. Deployed via GitHub Pages (`CNAME` → iejb.com.br). Run it by opening `index.html` or with VS Code Live Server (port 5501, see `.vscode/settings.json`).

## Structure

- `index.html` — single-page landing site; sections (`#brand`, `#quem-somos`, `#programacao`, `#galeria`, `#ministerios`, `#depoimentos`, `#eventos`, `#cta`, `#localizacao`) are anchored from the nav. Also holds the SEO JSON-LD blocks.
- `pages/` — `galeria.html`, `privacidade.html`, `termos.html`. They use `../` relative paths for CSS/JS/images.
- `estilo/style.css` — one shared stylesheet (~2300 lines) for all pages.
- `script/script.js` — shared script, loaded with `defer` on every page (menu, reveal, header/scroll UI, lightbox, daily verse, events filter, service worker registration). `script/visita.js` (index only) holds the visit-conversion features; it relies on globals declared in `script.js`. `script/versiculos.js` is the verse list.
- `manifest.webmanifest` + `sw.js` — PWA (pages network-first, assets stale-while-revalidate; no cache versioning needed).
- `images/` (`pag-galeria/` holds gallery photos), `sitemap.xml`, `robots.txt`, Google verification HTML.

## Things to know

- **Events are hardcoded HTML.** To add an event, copy an `.eventos-grid` block in `index.html` `#eventos` and set `data-data="YYYY-MM-DD"`. `script.js` hides past events and sorts the rest; `visita.js` adds countdown, calendar (.ics), share and `Event` JSON-LD from the same markup. Time is parsed from the `.horario p` text (e.g. `19h30`).
- **Service times live in one place:** the `.cultos-grid[data-dia][data-hora][data-nome]` cards in `#programacao`. The hero "próximo culto", sticky mobile bar, planeje-sua-visita and calendar buttons all derive from them (`proximaOcorrencia` in `script.js`).
- **Daily verse:** picked by date from `window.VERSICULOS` (stride coprime with list length, so no repeats within a cycle); opened state and streak are in localStorage.
- **Ministry cards** carry `id="ministerio-<nome>"`/`data-ministerio`; the quiz and planner read their text from the DOM.
- Dynamic sections (`#planeje`, `#quiz`) are `hidden` in HTML and revealed by JS. The global `[hidden]{display:none!important}` rule in `style.css` is relied on.
- **Reveal animations:** elements with class `.reveal` get `.visible` from an IntersectionObserver in `script.js`. Stagger delays are applied only to `.reveal` children of the container selectors listed in the second `querySelectorAll` in `script.js` — a new section's container must be added to that list to get staggering.
- **`script.js` is shared across pages**, so every feature in it must guard against missing elements (galeria/termos/privacidade lack most home-page sections).
- **Testimonials typewriter:** `script.js` clears the `<p>` text under `.depoimentos-grid` on load and re-types it from `dataset.textoCompleto` when scrolled into view (`.digitado` class removes the cursor; `@keyframes piscaCursor`).
- **Page transitions** use the CSS View Transitions API (`@view-transition` and `::view-transition-old/new(root)` with `slide-in`/`slide-out` keyframes in `style.css`, plus `<meta name="view-transition">` in page heads). Cross-page navigations depend on this.
- Images were downscaled (max 1600px) to WebP; keep new photos at that size. Header/footer use `images/logo-iejb-pequeno.png`; the full `logo-iejb.png` is for JSON-LD/og.
- Known pre-existing issue: the page scrolls horizontally on narrow mobile widths.
- Commit messages follow conventional-ish prefixes in Portuguese (`feat:`, `fix:`, `style:`).
