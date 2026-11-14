"""Limite de tentativas de login e front servido pela API."""
import pytest
from fastapi.testclient import TestClient

from app.db import conectar
from app.main import app
from app.modulos import autenticacao


def _banco_disponivel() -> bool:
    try:
        conectar().close()
        return True
    except Exception:
        return False


@pytest.fixture
def api():
    with TestClient(app) as cliente:
        yield cliente


@pytest.mark.skipif(not _banco_disponivel(), reason="MySQL do .env indisponível")
def test_bloqueia_depois_de_5_erros(api):
    email = "tentativas@zaptos.dev"
    autenticacao._limpar_erros(email)
    for _ in range(autenticacao.MAX_ERROS):
        assert api.post("/api/auth/login", json={"email": email, "senha": "errada"}).status_code == 401
    r = api.post("/api/auth/login", json={"email": email, "senha": "errada"})
    assert r.status_code == 429 and r.json()["codigo"] == "MUITAS_TENTATIVAS"
    # outro e-mail não é afetado
    assert api.post("/api/auth/login", json={"email": "outro@zaptos.dev", "senha": "x"}).status_code == 401
    autenticacao._limpar_erros(email)


def test_front_e_cabecalhos(api):
    r = api.get("/")
    assert r.status_code == 200 and "<title>" in r.text
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert api.get("/admin.html").status_code == 200
    assert api.get("/js/config.js").status_code == 200
    # a documentação da API continua acessível com o front montado em "/"
    assert api.get("/openapi.json").status_code == 200
