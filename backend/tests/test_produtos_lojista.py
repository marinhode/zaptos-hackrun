"""Cadastro de produtos e imagens pelo lojista. Roda contra o MySQL do .env."""
import os
from io import BytesIO

import pytest

os.environ.setdefault("DEMO_AUTH", "1")

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.db import conectar  # noqa: E402
from app.imagens import PASTA_PRODUTOS  # noqa: E402
from app.main import app  # noqa: E402

LOJISTA = {"X-Usuario-Id": "2"}      # Carlos, Casa e Cia (loja 1)
OUTRO_LOJISTA = {"X-Usuario-Id": "4"}  # Marina, Lar & Estilo (loja 2)
CLIENTE = {"X-Usuario-Id": "1"}


def _banco_disponivel() -> bool:
    try:
        conectar().close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _banco_disponivel(), reason="MySQL do .env indisponível")


@pytest.fixture(scope="module")
def api():
    with TestClient(app) as cliente:
        yield cliente


def _imagem(formato="PNG", tamanho=(2400, 1600), cor=(200, 120, 60, 255)) -> bytes:
    modo = "RGBA" if formato == "PNG" else "RGB"
    img = Image.new(modo, tamanho, cor if modo == "RGBA" else cor[:3])
    saida = BytesIO()
    img.save(saida, formato)
    return saida.getvalue()


@pytest.fixture
def produto(api):
    r = api.post("/api/seller/stores/1/products", headers=LOJISTA, json={
        "nome": "  Cadeira   Teste ", "descricao": "Feita para o teste.", "preco": "349.90",
        "largura": 45, "altura": 90, "profundidade": 50, "estoque": 4,
    })
    assert r.status_code == 201, r.text
    return r.json()


def test_criar_produto_aparece_no_catalogo(api, produto):
    assert produto["nome"] == "Cadeira Teste"
    assert produto["preco"] == 349.9 and produto["estoque"] == 4 and produto["ativo"] is True
    assert produto["medidas"] == {"largura": 45.0, "altura": 90.0, "profundidade": 50.0}
    publico = api.get(f"/api/products/{produto['id']}").json()
    assert publico["loja"]["nome"] == "Casa e Cia"


def test_validacoes_do_cadastro(api):
    base = {"nome": "Mesa", "preco": "100"}
    assert api.post("/api/seller/stores/1/products", headers=LOJISTA, json={**base, "preco": "0"}).status_code == 422
    r = api.post("/api/seller/stores/1/products", headers=LOJISTA, json={**base, "largura": 10})
    assert r.status_code == 422 and r.json()["codigo"] == "MEDIDAS_INCOMPLETAS"
    # loja de outro lojista (RN004) e cliente sem acesso
    assert api.post("/api/seller/stores/2/products", headers=LOJISTA, json=base).status_code == 404
    assert api.post("/api/seller/stores/1/products", headers=CLIENTE, json=base).status_code == 403


def test_editar_e_desativar(api, produto):
    pid = produto["id"]
    r = api.patch(f"/api/seller/products/{pid}", headers=LOJISTA, json={"preco": "399.00", "descricao": None})
    assert r.status_code == 200 and r.json()["preco"] == 399.0 and r.json()["descricao"] is None
    r = api.patch(f"/api/seller/products/{pid}", headers=LOJISTA, json={"largura": None, "altura": None, "profundidade": None})
    assert r.json()["medidas"] is None
    assert api.patch(f"/api/seller/products/{pid}", headers=LOJISTA, json={"nome": None}).status_code == 422

    assert api.patch(f"/api/seller/products/{pid}", headers=LOJISTA, json={"ativo": False}).json()["ativo"] is False
    assert api.get(f"/api/products/{pid}").status_code == 404          # some do catálogo
    painel = api.get("/api/seller/stores/1/dashboard", headers=LOJISTA).json()
    assert any(p["id"] == pid and p["ativo"] is False for p in painel["produtos"])  # lojista ainda vê

    assert api.patch(f"/api/seller/products/{pid}", headers=OUTRO_LOJISTA, json={"preco": "1"}).status_code == 404


def test_imagem_e_convertida_e_servida(api, produto):
    pid = produto["id"]
    r = api.post(f"/api/seller/products/{pid}/images", headers=LOJISTA,
                 files={"arquivo": ("foto.png", _imagem("PNG"), "image/png")})
    assert r.status_code == 201, r.text
    imagem = r.json()["imagens"][0]
    assert imagem["url"].startswith("/uploads/produtos/") and imagem["url"].endswith(".webp")

    servida = api.get(imagem["url"])
    assert servida.status_code == 200
    with Image.open(BytesIO(servida.content)) as img:
        assert img.format == "WEBP" and max(img.size) <= 1200   # reduzida
    assert len(servida.content) < 500 * 1024                     # RNF001

    # o catálogo público mostra a imagem
    assert api.get(f"/api/products/{pid}").json()["imagens"][0]["url"] == imagem["url"]

    r = api.delete(f"/api/seller/products/{pid}/images/{imagem['id']}", headers=LOJISTA)
    assert r.status_code == 200 and r.json()["imagens"] == []
    assert not (PASTA_PRODUTOS / imagem["url"].rsplit("/", 1)[1]).exists()


def test_arquivo_que_nao_e_imagem_e_recusado(api, produto):
    falso = b"<script>alert(1)</script>"
    r = api.post(f"/api/seller/products/{produto['id']}/images", headers=LOJISTA,
                 files={"arquivo": ("foto.png", falso, "image/png")})
    assert r.status_code == 415 and r.json()["codigo"] == "IMAGEM_INVALIDA"
    gif = BytesIO()
    Image.new("RGB", (10, 10)).save(gif, "GIF")
    r = api.post(f"/api/seller/products/{produto['id']}/images", headers=LOJISTA,
                 files={"arquivo": ("a.gif", gif.getvalue(), "image/gif")})
    assert r.status_code == 415


def test_limite_de_imagens_e_dono(api, produto):
    pid = produto["id"]
    jpg = _imagem("JPEG", (300, 200))
    for _ in range(6):
        assert api.post(f"/api/seller/products/{pid}/images", headers=LOJISTA,
                        files={"arquivo": ("f.jpg", jpg, "image/jpeg")}).status_code == 201
    r = api.post(f"/api/seller/products/{pid}/images", headers=LOJISTA, files={"arquivo": ("f.jpg", jpg, "image/jpeg")})
    assert r.status_code == 409 and r.json()["codigo"] == "LIMITE_IMAGENS"
    r = api.post(f"/api/seller/products/{pid}/images", headers=OUTRO_LOJISTA, files={"arquivo": ("f.jpg", jpg, "image/jpeg")})
    assert r.status_code == 404
