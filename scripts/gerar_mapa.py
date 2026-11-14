"""Gera o mapa do app a partir da PLANTA MIX oficial do shopping (PDF vetorial).

O PDF não vai para o git (é documento interno). Este script lê o PDF e gera:
  frontend/img/mapa/piso-1.webp e piso-2.webp  -> recorte de cada piso
  frontend/data/mapa-planta.json               -> posição (em %) de cada loja e serviço

As lojas são encontradas pelos rótulos de texto "LOJA 112", "LOJA 141A"... que
existem dentro do PDF, então ninguém precisa marcar nada à mão. As lojas do app
aparecem no mapa pelo número (loja.localizacao no banco: "Loja 112").

Uso (precisa do pacote pymupdf: pip install pymupdf):
    python scripts/gerar_mapa.py "C:/caminho/2026_11_CDS_MIX.pdf"
"""
import io
import json
import re
import sys
import unicodedata
from pathlib import Path

import pymupdf
from PIL import Image

RAIZ = Path(__file__).resolve().parents[1]
SAIDA_IMG = RAIZ / "frontend" / "img" / "mapa"
SAIDA_JSON = RAIZ / "frontend" / "data" / "mapa-planta.json"

# Página do PDF de cada piso e o recorte (em pontos do PDF) que mostra só o prédio.
PISOS = {
    "1": {"pagina": 1, "recorte": (470, 300, 1790, 1090), "nome": "Piso 1 (térreo)"},
    "2": {"pagina": 2, "recorte": (330, 30, 2290, 1420), "nome": "Piso 2 (praça de alimentação)"},
}
LARGURA_IMAGEM = 2400  # px do lado maior; nítido no zoom e ainda leve em WebP

# Rótulos de serviço no PDF -> tipo usado no app
SERVICOS = [
    (r"^(SANIT\.?|SANIT\. (FEM|MASC)\.?|WC\.? (FEM|MASC)\.?)$", "banheiro"),
    (r"^ESCADA$", "escada"),
    (r"^ELEVADOR", "elevador"),
    (r"^PRACA DE EVENTOS$", "eventos"),
    (r"^ESPACO FAMILIA$", "familia"),
]


def sem_acento(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def linhas_de_texto(pagina):
    """Junta as palavras de cada linha do PDF: [(texto, retângulo)]."""
    grupos = {}
    for x0, y0, x1, y1, palavra, bloco, linha, _ in pagina.get_text("words"):
        grupos.setdefault((bloco, linha), []).append((x0, y0, x1, y1, palavra))
    for palavras in grupos.values():
        texto = " ".join(p[4] for p in palavras)
        caixa = pymupdf.Rect(min(p[0] for p in palavras), min(p[1] for p in palavras),
                             max(p[2] for p in palavras), max(p[3] for p in palavras))
        yield texto, caixa


def numero_da_loja(texto: str) -> str | None:
    m = re.match(r"^LOJA\s+(.+)$", texto.strip(), re.I)
    if not m:
        return None
    numero = re.sub(r"\s+", "", m.group(1)).upper()
    return numero if re.match(r"^[A-Z0-9][A-Z0-9.\-]*$", numero) else None


def gerar(caminho_pdf: str) -> None:
    doc = pymupdf.open(caminho_pdf)
    SAIDA_IMG.mkdir(parents=True, exist_ok=True)
    SAIDA_JSON.parent.mkdir(parents=True, exist_ok=True)
    resultado = {"fonte": "Planta Mix — Operações Capim Dourado Shopping (nov/2026)", "pisos": {}}

    for piso, cfg in PISOS.items():
        pagina = doc[cfg["pagina"]]
        recorte = pymupdf.Rect(*cfg["recorte"])
        escala = LARGURA_IMAGEM / max(recorte.width, recorte.height)

        pix = pagina.get_pixmap(matrix=pymupdf.Matrix(escala, escala), clip=recorte, alpha=False)
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        arquivo = SAIDA_IMG / f"piso-{piso}.webp"
        img.save(arquivo, "WEBP", quality=82, method=6)

        def posicao(caixa):
            cx = (caixa.x0 + caixa.x1) / 2
            cy = (caixa.y0 + caixa.y1) / 2
            return [round((cx - recorte.x0) / recorte.width * 100, 2),
                    round((cy - recorte.y0) / recorte.height * 100, 2)]

        lojas, servicos = {}, []
        for texto, caixa in linhas_de_texto(pagina):
            if not caixa.intersects(recorte):
                continue
            numero = numero_da_loja(texto)
            if numero:
                lojas.setdefault(numero, posicao(caixa))
                continue
            limpo = sem_acento(texto).upper().strip()
            for padrao, tipo in SERVICOS:
                if re.match(padrao, limpo):
                    servicos.append({"tipo": tipo, "pos": posicao(caixa)})
                    break

        resultado["pisos"][piso] = {
            "nome": cfg["nome"],
            "imagem": f"img/mapa/piso-{piso}.webp",
            "largura": img.width,
            "altura": img.height,
            "lojas": dict(sorted(lojas.items())),
            "servicos": servicos,
        }
        print(f"Piso {piso}: {img.width}x{img.height}px, {arquivo.stat().st_size // 1024} KB, "
              f"{len(lojas)} lojas, {len(servicos)} serviços")

    SAIDA_JSON.write_text(json.dumps(resultado, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Gerado: {SAIDA_JSON}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Uso: python scripts/gerar_mapa.py caminho/da/planta.pdf")
    gerar(sys.argv[1])
