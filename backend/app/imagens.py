"""Imagens dos produtos (RF013, RNF001).

Toda imagem enviada é aberta e regravada pelo servidor:
  - só aceita JPEG, PNG ou WebP de verdade (não confia na extensão);
  - corrige a rotação da foto do celular;
  - reduz para no máximo 1200 px no maior lado;
  - salva em WebP, que fica bem abaixo de 500 KB (RNF001);
  - mantém a transparência de PNG/WebP recortados (produto sem fundo, usado no
    "Ver na sua casa", por cima da câmera); imagens sem transparência saem em RGB.
Assim nenhum arquivo enviado pelo usuário é servido do jeito que chegou.
"""
import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from .config import RAIZ_REPO
from .erros import ErroNegocio

PASTA_UPLOADS = RAIZ_REPO / "backend" / "uploads"
PASTA_PRODUTOS = PASTA_UPLOADS / "produtos"
PREFIXO_URL = "/uploads/produtos/"

TAMANHO_MAXIMO = 8 * 1024 * 1024  # 8 MB por envio
LADO_MAXIMO = 1200
FORMATOS = {"JPEG", "PNG", "WEBP"}
Image.MAX_IMAGE_PIXELS = 40_000_000  # recusa imagens gigantes (proteção contra "bomba" de descompressão)


def _normalizar_cores(img: Image.Image) -> Image.Image:
    """RGBA se a imagem tem pixels transparentes de verdade; senão, RGB.

    Um PNG RGBA todo opaco, ou paletizado sem transparência, continua virando
    RGB como antes; só o PNG/WebP recortado guarda o canal alfa.
    """
    if img.mode in ("RGBA", "LA", "PA", "P") or "transparency" in img.info:
        rgba = img.convert("RGBA")
        menor_alfa, _ = rgba.getchannel("A").getextrema()
        if menor_alfa < 255:
            return rgba
        return rgba.convert("RGB")
    return img.convert("RGB")


def processar(dados: bytes) -> bytes:
    if not dados:
        raise ErroNegocio(422, "IMAGEM_VAZIA", "Escolha uma imagem para enviar.")
    if len(dados) > TAMANHO_MAXIMO:
        raise ErroNegocio(413, "IMAGEM_GRANDE", "A imagem passa de 8 MB. Escolha uma menor.")
    try:
        with Image.open(BytesIO(dados)) as teste:
            formato = teste.format
            if teste.width * teste.height > Image.MAX_IMAGE_PIXELS:
                raise ErroNegocio(413, "IMAGEM_GRANDE", "A imagem tem resolução grande demais.")
            teste.verify()
        if formato not in FORMATOS:
            raise ErroNegocio(415, "FORMATO_INVALIDO", "Envie uma imagem JPG, PNG ou WebP.")
        with Image.open(BytesIO(dados)) as img:
            img = ImageOps.exif_transpose(img)
            img = _normalizar_cores(img)
            img.thumbnail((LADO_MAXIMO, LADO_MAXIMO))
            saida = BytesIO()
            # Em RGBA o WebP guarda o canal alfa sem perdas (alpha_quality=100, o padrão).
            img.save(saida, "WEBP", quality=80, method=4)
            return saida.getvalue()
    except ErroNegocio:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError, ValueError) as erro:
        raise ErroNegocio(415, "IMAGEM_INVALIDA", "Não foi possível ler este arquivo como imagem.") from erro


def salvar(dados_webp: bytes) -> str:
    PASTA_PRODUTOS.mkdir(parents=True, exist_ok=True)
    nome = f"{uuid.uuid4().hex}.webp"
    (PASTA_PRODUTOS / nome).write_bytes(dados_webp)
    return PREFIXO_URL + nome


def apagar(url: str) -> None:
    """Remove o arquivo de uma imagem salva por aqui; ignora URLs de fora."""
    if url and url.startswith(PREFIXO_URL):
        (PASTA_PRODUTOS / Path(url).name).unlink(missing_ok=True)
