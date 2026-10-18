"""Gera o subset do Font Awesome com só os ícones que o site usa.

O site não carrega mais o Font Awesome inteiro do CDN (~320 KB): este script lê
os ícones usados no HTML e no JS (classes "fa-solid fa-...", "fa-regular fa-...",
"fa-brands fa-..."), recorta as fontes e escreve estilo/icones.css.

Quando usar um ícone novo, rode de novo:

    npm pack @fortawesome/fontawesome-free@6.7.2      # baixa o pacote (uma vez)
    tar xzf fortawesome-fontawesome-free-6.7.2.tgz
    pip install fonttools brotli
    python3 ferramentas/gerar-icones.py package        # caminho da pasta extraída

Os nomes dos ícones estão em https://fontawesome.com/search?ic=free
"""

import re
import shutil
import sys
from pathlib import Path

from fontTools import subset

RAIZ = Path(__file__).resolve().parent.parent
SAIDA_FONTES = RAIZ / "estilo" / "fontes"
SAIDA_CSS = RAIZ / "estilo" / "icones.css"

# estilo do FA -> (arquivo da fonte, família nova, peso)
ESTILOS = {
    "solid": ("fa-solid-900.ttf", "IEJB Icones", 900),
    "regular": ("fa-regular-400.ttf", "IEJB Icones", 400),
    "brands": ("fa-brands-400.ttf", "IEJB Icones Marcas", 400),
}


def icones_usados():
    usados = {estilo: set() for estilo in ESTILOS}
    arquivos = [*RAIZ.glob("*.html"), *RAIZ.glob("pages/*.html"), *RAIZ.glob("script/*.js")]
    for arquivo in arquivos:
        for estilo, nome in re.findall(r"fa-(solid|regular|brands) fa-([a-z0-9-]+)", arquivo.read_text(encoding="utf-8")):
            usados[estilo].add(nome)
    return usados


def mapa_unicode(css_fa: str):
    mapa = {}
    for seletores, codigo in re.findall(r'([^{}]+)\{--fa:"\\([0-9a-f]+)"\}', css_fa):
        for seletor in seletores.split(","):
            seletor = seletor.strip()
            if seletor.startswith(".fa-"):
                mapa[seletor[4:]] = codigo
    return mapa


def main(pacote: Path):
    css_fa = (pacote / "css" / "all.min.css").read_text(encoding="utf-8")
    mapa = mapa_unicode(css_fa)
    usados = icones_usados()
    SAIDA_FONTES.mkdir(parents=True, exist_ok=True)

    regras = []
    for estilo, (arquivo, familia, peso) in ESTILOS.items():
        nomes = sorted(usados[estilo])
        faltando = [n for n in nomes if n not in mapa]
        if faltando:
            sys.exit(f"Ícone(s) que não existem no Font Awesome Free: {faltando}")
        if not nomes:
            continue
        destino = SAIDA_FONTES / f"iejb-icones-{estilo}.woff2"
        opcoes = subset.Options()
        opcoes.flavor = "woff2"
        opcoes.layout_features = []
        fonte = subset.load_font(pacote / "webfonts" / arquivo, opcoes)
        recorte = subset.Subsetter(opcoes)
        recorte.populate(unicodes=[int(mapa[n], 16) for n in nomes])
        recorte.subset(fonte)
        subset.save_font(fonte, destino, opcoes)
        print(f"{estilo}: {len(nomes)} ícones -> {destino.relative_to(RAIZ)} ({destino.stat().st_size} bytes)")
        regras.append(
            f"@font-face {{\n    font-family: '{familia}';\n    font-style: normal;\n    font-weight: {peso};\n"
            f"    font-display: block;\n    src: url(fontes/{destino.name}) format('woff2');\n}}\n"
        )

    todos = sorted({n for nomes in usados.values() for n in nomes})
    classes = "\n".join(f'.fa-{n} {{ --fa: "\\{mapa[n]}"; }}' for n in todos)
    css = f"""/* Gerado por ferramentas/gerar-icones.py — não edite à mão.
   Ícones: Font Awesome Free 6.7.2 (https://fontawesome.com) — ícones CC BY 4.0,
   fontes SIL OFL 1.1, código MIT. Licença completa em estilo/fontes/LICENSE-fontawesome.txt */

{chr(10).join(regras)}
.fa-solid,
.fa-regular,
.fa-brands {{
    display: inline-block;
    font-style: normal;
    font-variant: normal;
    line-height: 1;
    text-rendering: auto;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}}

.fa-solid,
.fa-regular {{
    font-family: 'IEJB Icones';
}}

.fa-solid {{
    font-weight: 900;
}}

.fa-regular {{
    font-weight: 400;
}}

.fa-brands {{
    font-family: 'IEJB Icones Marcas';
    font-weight: 400;
}}

.fa-solid::before,
.fa-regular::before,
.fa-brands::before {{
    content: var(--fa);
}}

{classes}
"""
    SAIDA_CSS.write_text(css, encoding="utf-8")
    shutil.copy(pacote / "LICENSE.txt", SAIDA_FONTES / "LICENSE-fontawesome.txt")
    print(f"{len(todos)} ícones em {SAIDA_CSS.relative_to(RAIZ)}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
