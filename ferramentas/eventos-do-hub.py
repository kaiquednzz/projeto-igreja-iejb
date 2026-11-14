#!/usr/bin/env python3
"""Reescreve os eventos do index.html a partir do IEJB Hub (D34 do Hub).

Quem roda: o GitHub Action .github/workflows/eventos-do-hub.yml, a cada 15 min.
Também dá para rodar na mão (só Python 3, sem instalar nada):

    SUPABASE_URL=https://....supabase.co SUPABASE_CHAVE=sb_publishable_... \
        python3 ferramentas/eventos-do-hub.py

O que faz:
  1. Pergunta ao Supabase (função pública eventos_do_site, só leitura) quais
     eventos estão publicados e ainda não passaram.
  2. Gera o HTML de cada um no mesmo formato que era escrito à mão.
  3. Troca o que estiver entre os marcadores <!-- eventos-do-hub:inicio -->
     e <!-- eventos-do-hub:fim --> no index.html. Nada fora deles muda.

Se o Hub não responder ou responder algo estranho, sai com erro SEM mexer no
arquivo: o site continua com os últimos eventos publicados.

Segurança: todo texto vindo do Hub passa por html.escape (um título como
<script> vira texto), link só https e imagem só de lugares conhecidos. O banco
já recusa isso; aqui é a segunda barreira.
"""
import html
import json
import os
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
INDEX = RAIZ / "index.html"
INICIO = "<!-- eventos-do-hub:inicio"
FIM = "<!-- eventos-do-hub:fim -->"
RECUO = " " * 20  # mesmo recuo dos cartões dentro de .eventos-container

MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
         "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
SEMANA = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira",
          "Sexta-feira", "Sábado", "Domingo"]  # date.weekday(): segunda = 0
LOCAL_IEJB = "IEJB - Araçariguama"

RE_LINK = re.compile(r'^https://[^\s<>"\'`]+$')
RE_IMAGEM_BUCKET = re.compile(r"^[0-9a-f-]{36}\.(webp|jpg)$")
RE_IMAGEM_SITE = re.compile(r"^images/[A-Za-z0-9/_-]+\.webp$")
RE_HORARIO = re.compile(r"^(\d{2}):(\d{2})")


def buscar_eventos(url, chave):
    pedido = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/rpc/eventos_do_site",
        data=b"{}",
        method="POST",
        headers={"apikey": chave, "Authorization": f"Bearer {chave}",
                 "Content-Type": "application/json", "Accept": "application/json"},
    )
    with urllib.request.urlopen(pedido, timeout=30) as resposta:
        dados = json.load(resposta)
    if not isinstance(dados, list):
        raise ValueError(f"resposta inesperada do Hub: {str(dados)[:200]}")
    return dados


def texto(valor):
    return html.escape(str(valor or "").strip(), quote=True)


def horario_do_site(valor):
    """'19:30:00' -> '19h30'; '18:00:00' -> '18h' (é daqui que o site lê a hora)."""
    m = RE_HORARIO.match(valor or "")
    if not m:
        raise ValueError(f"horário inválido: {valor!r}")
    hora, minuto = int(m.group(1)), m.group(2)
    return f"{hora}h" if minuto == "00" else f"{hora}h{minuto}"


def titulo_com_destaque(titulo, destaque):
    """Põe em <strong> a última ocorrência do destaque, como nos cartões feitos à mão."""
    titulo = (titulo or "").strip()
    destaque = (destaque or "").strip()
    pos = titulo.rfind(destaque) if destaque else -1
    if pos < 0:
        return texto(titulo)
    antes, depois = titulo[:pos], titulo[pos + len(destaque):]
    # Sem strip aqui: o espaço antes do negrito faz parte do título
    escapar = lambda t: html.escape(t, quote=True)
    return f"{escapar(antes)}<strong>{escapar(destaque)}</strong>{escapar(depois)}"


def url_da_imagem(imagem, url_supabase):
    if not imagem:
        return None
    if RE_IMAGEM_SITE.match(imagem):
        return imagem  # imagem que já mora no site
    if RE_IMAGEM_BUCKET.match(imagem):
        return f"{url_supabase.rstrip('/')}/storage/v1/object/public/eventos/{imagem}"
    raise ValueError(f"imagem inválida: {imagem!r}")


def cartao(evento, url_supabase):
    dia = date.fromisoformat(evento["data"])
    atributos = [f'data-data="{dia.isoformat()}"']
    if evento.get("data_fim"):
        atributos.append(f'data-data-fim="{date.fromisoformat(evento["data_fim"]).isoformat()}"')
    imagem = url_da_imagem(evento.get("imagem"), url_supabase)
    if imagem:
        atributos.append(f'data-imagem="{texto(imagem)}"')
    if evento.get("local_nome") and evento.get("local_cidade"):
        atributos.append(f'data-local-nome="{texto(evento["local_nome"])}"')
        atributos.append(f'data-local-cidade="{texto(evento["local_cidade"])}"')
        local = f'{texto(evento["local_nome"])} - {texto(evento["local_cidade"])}'
    else:
        local = texto(LOCAL_IEJB)

    linhas = [
        f'<div class="eventos-grid reveal" {" ".join(atributos)}>',
        '    <div class="data">',
        f'        <p class="data-dia">{dia.day:02d}</p>',
        '        <div class="dia">',
        f'            <p class="data-mes">{MESES[dia.month - 1]}</p>',
        f'            <p class="data-semana">{SEMANA[dia.weekday()]}</p>',
        '        </div>',
        '    </div>',
        '    <div class="textos">',
        f'        <p class="evento-categoria">{texto(evento["categoria"])}</p>',
        f'        <h4>{titulo_com_destaque(evento["titulo"], evento.get("destaque"))}</h4>',
        f'        <p>{texto(evento["descricao"])}</p>',
        '    </div>',
        '    <div class="horario-localizacao">',
        '        <div class="horario">',
        f'            <p><i class="fa-solid fa-clock" aria-hidden="true"></i>{horario_do_site(evento["horario"])}</p>',
        f'            <p><i class="fa-solid fa-location-dot" aria-hidden="true"></i>{local}</p>',
        '        </div>',
    ]
    link = (evento.get("link_inscricao") or "").strip()
    if link:
        if not RE_LINK.match(link):
            raise ValueError(f"link inválido: {link!r}")
        linhas += [
            '        <div class="botao">',
            f'            <a href="{texto(link)}" target="_blank" rel="noopener noreferrer">Inscreva-se</a>',
            '        </div>',
        ]
    linhas += ['    </div>', '</div>']
    return "\n".join(RECUO + l for l in linhas)


def main():
    url = os.environ.get("SUPABASE_URL", "").strip()
    chave = os.environ.get("SUPABASE_CHAVE", "").strip()
    if not url or not chave:
        sys.exit("Faltam SUPABASE_URL e SUPABASE_CHAVE.")

    eventos = buscar_eventos(url, chave)

    cartoes = []
    for evento in eventos:
        try:
            cartoes.append(cartao(evento, url))
        except (KeyError, ValueError, TypeError) as erro:
            # Um evento estranho não derruba os outros
            print(f"::warning::evento ignorado ({evento.get('titulo')!r}): {erro}")

    original = INDEX.read_text(encoding="utf-8")
    inicio = original.find(INICIO)
    fim = original.find(FIM)
    if inicio < 0 or fim < inicio:
        sys.exit("Marcadores eventos-do-hub não encontrados no index.html.")
    fim_do_marcador_inicio = original.index("-->", inicio) + 3

    miolo = "\n" + ("\n".join(cartoes) + "\n" if cartoes else "") + RECUO
    novo = original[:fim_do_marcador_inicio] + miolo + original[fim:]

    if novo == original:
        print(f"Nada mudou ({len(cartoes)} evento(s)).")
        return
    INDEX.write_text(novo, encoding="utf-8")
    print(f"index.html atualizado com {len(cartoes)} evento(s).")


if __name__ == "__main__":
    main()
