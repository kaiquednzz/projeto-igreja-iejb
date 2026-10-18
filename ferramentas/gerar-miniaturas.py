"""Gera as versões menores das fotos (-400.webp e -800.webp) usadas no srcset.

Rode na raiz do projeto sempre que adicionar uma foto nova:

    python3 ferramentas/gerar-miniaturas.py

Precisa do Pillow (pip install pillow). Fotos que já têm miniatura são puladas,
então pode rodar quantas vezes quiser. Depois, no HTML, use o srcset com as três
larguras (veja um <img> da galeria como exemplo).
"""

from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
LARGURAS = (400, 800)

# Pastas e arquivos que aparecem pequenos na tela (miniaturas, cards)
ALVOS = [
    *sorted((RAIZ / "images" / "pag-galeria").rglob("*.webp")),
    *(RAIZ / "images" / nome for nome in (
        "louvor.webp", "evangelismo.webp", "infantil.webp", "jovens.webp",
        "danca.webp", "iejb-sobre.webp", "fachada-iejb.webp",
    )),
]


def eh_miniatura(caminho: Path) -> bool:
    return any(caminho.stem.endswith(f"-{largura}") for largura in LARGURAS)


def gerar(original: Path) -> list[str]:
    criadas = []
    with Image.open(original) as foto:
        for largura in LARGURAS:
            destino = original.with_name(f"{original.stem}-{largura}.webp")
            if destino.exists() or foto.width <= largura:
                continue
            altura = round(foto.height * largura / foto.width)
            foto.resize((largura, altura), Image.LANCZOS).save(destino, "WEBP", quality=78, method=6)
            criadas.append(destino.name)
    return criadas


if __name__ == "__main__":
    total = 0
    for foto in ALVOS:
        if not foto.exists() or eh_miniatura(foto):
            continue
        criadas = gerar(foto)
        total += len(criadas)
        for nome in criadas:
            print("criada:", foto.parent.relative_to(RAIZ) / nome)
    print(f"{total} miniatura(s) nova(s)")
