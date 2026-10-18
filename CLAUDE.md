# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static website (pt-BR) for the church IEJB (Araçariguama, SP). Plain HTML/CSS/JS — no build step, package manager, linter or tests. Deployed via GitHub Pages (`CNAME` → iejb.com.br). Run it by opening `index.html` or with VS Code Live Server (port 5501, see `.vscode/settings.json`).

## Structure

- `index.html` — single-page landing site; sections (`#brand`, `#quem-somos`, `#programacao`, `#galeria`, `#ministerios`, `#depoimentos`, `#eventos`, `#cta`, `#localizacao`) are anchored from the nav. Also holds the SEO JSON-LD blocks.
- `pages/` — `galeria.html`, `privacidade.html`, `termos.html`. They use `../` relative paths for CSS/JS/images.
- `estilo/style.css` — one shared stylesheet (~3200 lines) for all pages, ordered: design tokens (`:root`) → base → utilities → buttons → header → home sections (each with its own media queries next to it) → floating UI → gallery page → legal pages → motion.
- `script/script.js` — shared script, loaded with `defer` on every page (menu, reveal, header/scroll UI, lightbox, daily verse, events filter, service worker registration). `script/visita.js` (index only) holds the visit-conversion features; it relies on globals declared in `script.js`. `script/versiculos.js` is the verse list.
- `manifest.webmanifest` + `sw.js` — PWA (pages, CSS and JS network-first; images stale-while-revalidate; only `ok` responses are cached; no cache versioning needed). The `?v=2` on local CSS/JS links was a one-time bust of the old service worker's cache — don't bump it on every change.
- `images/` (`pag-galeria/` holds gallery photos), `sitemap.xml`, `robots.txt`, Google verification HTML.

## Things to know

- **Events are hardcoded HTML.** To add an event, copy an `.eventos-grid` block in `index.html` `#eventos` and set `data-data="YYYY-MM-DD"`. `script.js` hides past events and sorts the rest; `visita.js` adds countdown, calendar (.ics), share and `Event` JSON-LD from the same markup. Time is parsed from the `.horario p` text (e.g. `19h30`).
- **Service times live in one place:** the `.cultos-grid[data-dia][data-hora][data-nome]` cards in `#programacao`. The hero "próximo culto", sticky mobile bar, planeje-sua-visita and calendar buttons all derive from them (`proximaOcorrencia` in `script.js`).
- **Daily verse:** picked by date from `window.VERSICULOS` (stride coprime with list length, so no repeats within a cycle); opened state and streak are in localStorage.
- **Ministry cards** carry `id="ministerio-<nome>"`/`data-ministerio`; the quiz and planner read their text from the DOM.
- Dynamic sections (`#planeje`, `#quiz`) are `hidden` in HTML and revealed by JS. The global `[hidden]{display:none!important}` rule in `style.css` is relied on.
- **Reveal animations:** elements with class `.reveal` get `.visible` from an IntersectionObserver in `script.js`, which plays the `revelar` CSS *animation* (not a transition). It animates the individual `translate`/`scale` properties, so hover effects must keep using `transform` (and `transition`) to avoid conflicts; adding another `animation` to a `.reveal` element replaces `revelar`. Stagger delays (`--atraso` custom property) are applied only to `.reveal` children of the container selectors listed in the second `querySelectorAll` in `script.js` — a new section's container must be added to that list to get staggering. `@media (scripting: none)` shows them when JS is off.
- **`script.js` is shared across pages**, so every feature in it must guard against missing elements (galeria/termos/privacidade lack most home-page sections).
- **Testimonials typewriter:** `script.js` replaces each `<p>` under `.depoimentos-grid` with two stacked spans (the `<p>` is a one-cell grid): `.texto-molde` holds the full text in transparent color (reserves the height and is what screen readers read) and `.digitando` (`aria-hidden`) gets re-typed from `dataset.textoCompleto` when scrolled into view. The cursor is `.digitando::after`; `.digitado` on the `<p>` removes it.
- **Page transitions** use the CSS View Transitions API (`@view-transition` and `::view-transition-old/new(root)` with `slide-in`/`slide-out` keyframes in `style.css`, plus `<meta name="view-transition">` in page heads). Cross-page navigations depend on this.
- Images were downscaled (max 1600px) to WebP; keep new photos at that size. Header/footer use `images/logo-iejb-pequeno.png`; the full `logo-iejb.png` is for JSON-LD/og.
- Font Awesome comes from cdnjs with an SRI `integrity` hash; when changing its version, update the hash too (cdnjs lists it) or the browser blocks the file and every icon disappears.
- One `<h1>` per page: the hero's is `.sr-only`, and the header/footer logo text is a `<span class="logo-texto">`.
- Commit messages follow conventional-ish prefixes in Portuguese (`feat:`, `fix:`, `style:`).

## Visual system (iOS/Apple style)

- **Tokens first:** colors, fonts, glass, shadows, radii and easing curves are custom properties in `:root`. `--mola` is a spring curve (`linear()` with a `cubic-bezier` fallback) used for anything that should feel physical. No dark mode (owner's decision).
- **Fonts:** Playfair Display for headings, the system font stack (`--fonte-texto`: SF Pro on Apple devices) for everything else, Oswald only for the logo text. Montserrat is no longer loaded; the daily-verse image (canvas) uses the system font too.
- **Header** is a fixed floating glass capsule (`position: fixed`), so the first section of every page needs ~120px top padding. The glass lives on `header::before`, never on `header` itself: an ancestor with `backdrop-filter` would stop the mobile menu panel (a child) from blurring the page. `script.js` toggles `header.sobre-escuro` (dark glass, white text) by checking what is behind the header with `elementsFromPoint` against `SECOES_ESCURAS` — **add any new dark section to that list**. Pages that open on a dark hero (`index`, `galeria`) start with `class="sobre-escuro"` in the HTML to avoid a flash. The logo PNG is white; on the light header it is tinted brand red with `filter: var(--logo-vermelho)`.
- **Nav pill:** `script.js` creates `.nav-indicador` inside `nav` and moves it (`--x/--y/--w/--h`) to the active link. Active = the last menu section whose top has passed 40% of the viewport (sections not in the menu keep the previous link lit). On subpages it sits on `a[aria-current="page"]`. Below 900px the nav becomes a glass dropdown (`nav.ativo`) that closes on Escape, link click or tap outside.
- **Buttons** are all in the "Botões" section of `style.css`: a shared base in `:where(...)` (zero specificity, so component rules can resize freely) plus exactly one color group — principal (filled red), secundário (red tint) or vidro (glass over photos/dark). A new button selector must be added to the base list and to one group. Press feedback is `:active { transform: scale(.95); transition-duration: .12s }` — it springs back with `--mola` on release.
- **Glass cards:** the "Material de vidro" selector list gives light cards translucency + bright border + top highlight + shadow *without* `backdrop-filter` (nothing moves behind them, so blur would only cost GPU). Real `backdrop-filter` is reserved for things with content passing behind: header, menu, floating buttons, toast, mobile bar, lightbox, hero chip/buttons and the ministry captions over photos.
