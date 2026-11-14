"""Cadastro de produtos e imagens pelo lojista (painel do lojista, RF013).

RN004: o lojista só cria e altera produtos das próprias lojas.
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, Field, field_validator

from .. import imagens
from ..auth import exigir_perfil
from ..db import transacao
from ..erros import ErroNegocio, nao_encontrado
from ..formatos import SQL_PRODUTO_TODOS, formatar_produto, imagens_por_produto

router = APIRouter(prefix="/seller", tags=["Lojista: produtos"])
lojista = exigir_perfil("lojista")

MAX_IMAGENS = 6


def Medida():  # noqa: N802 - um Field novo para cada campo
    return Field(default=None, gt=0, le=10000, max_digits=7, decimal_places=2)


def _texto(valor: str | None) -> str | None:
    if valor is None:
        return None
    valor = " ".join(valor.split()) if "\n" not in valor else valor.strip()
    return valor or None


class ProdutoNovo(BaseModel):
    nome: str = Field(min_length=2, max_length=150)
    descricao: str | None = Field(default=None, max_length=2000)
    preco: Decimal = Field(gt=0, le=Decimal("99999999.99"), max_digits=10, decimal_places=2)
    largura: Decimal | None = Medida()
    altura: Decimal | None = Medida()
    profundidade: Decimal | None = Medida()
    estoque: int = Field(default=0, ge=0, le=100000)

    _limpar = field_validator("nome", "descricao")(_texto)


class ProdutoEdicao(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=150)
    descricao: str | None = Field(default=None, max_length=2000)
    preco: Decimal | None = Field(default=None, gt=0, le=Decimal("99999999.99"), max_digits=10, decimal_places=2)
    largura: Decimal | None = Medida()
    altura: Decimal | None = Medida()
    profundidade: Decimal | None = Medida()
    ativo: bool | None = None

    _limpar = field_validator("nome", "descricao")(_texto)


def _conferir_medidas(largura, altura, profundidade) -> None:
    """As três medidas vêm juntas (ou nenhuma), para a tela do produto fazer sentido."""
    preenchidas = [m is not None for m in (largura, altura, profundidade)]
    if any(preenchidas) and not all(preenchidas):
        raise ErroNegocio(422, "MEDIDAS_INCOMPLETAS", "Informe largura, altura e profundidade, ou deixe as três em branco.")


def _produto(cur, produto_id: int, usuario_id: int, travar: bool = False) -> dict:
    cur.execute(
        SQL_PRODUTO_TODOS + " WHERE p.id = %s AND l.lojista_id = %s" + (" FOR UPDATE" if travar else ""),
        (produto_id, usuario_id),
    )
    linha = cur.fetchone()
    if not linha:
        # mesma resposta para "não existe" e "não é seu"
        raise nao_encontrado("Produto")
    return linha


def _resposta(cur, produto_id: int, usuario_id: int) -> dict:
    linha = _produto(cur, produto_id, usuario_id)
    return formatar_produto(linha, imagens_por_produto(cur, [produto_id]).get(produto_id, []))


@router.post("/stores/{loja_id}/products", status_code=201)
def criar_produto(loja_id: int, dados: ProdutoNovo, usuario: dict = Depends(lojista)) -> dict:
    _conferir_medidas(dados.largura, dados.altura, dados.profundidade)
    with transacao() as cur:
        cur.execute("SELECT id FROM loja WHERE id = %s AND lojista_id = %s", (loja_id, usuario["id"]))
        if not cur.fetchone():
            raise nao_encontrado("Loja")
        cur.execute(
            "INSERT INTO produto (loja_id, nome, descricao, preco, largura_cm, altura_cm, profundidade_cm)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (loja_id, dados.nome, dados.descricao, dados.preco, dados.largura, dados.altura, dados.profundidade),
        )
        produto_id = cur.lastrowid
        cur.execute(
            "INSERT INTO estoque (produto_id, quantidade_disponivel) VALUES (%s, %s)",
            (produto_id, dados.estoque),
        )
        return _resposta(cur, produto_id, usuario["id"])


@router.get("/products/{produto_id}")
def obter_produto(produto_id: int, usuario: dict = Depends(lojista)) -> dict:
    with transacao() as cur:
        return _resposta(cur, produto_id, usuario["id"])


@router.patch("/products/{produto_id}")
def editar_produto(produto_id: int, dados: ProdutoEdicao, usuario: dict = Depends(lojista)) -> dict:
    enviados = dados.model_fields_set
    with transacao() as cur:
        atual = _produto(cur, produto_id, usuario["id"], travar=True)

        # medidas: vale o que foi enviado; o que não foi continua como está
        medidas = {
            campo: getattr(dados, campo) if campo in enviados else atual[f"{campo}_cm"]
            for campo in ("largura", "altura", "profundidade")
        }
        _conferir_medidas(*medidas.values())

        colunas = {"nome": "nome", "descricao": "descricao", "preco": "preco", "ativo": "ativo",
                   "largura": "largura_cm", "altura": "altura_cm", "profundidade": "profundidade_cm"}
        mudancas = {}
        for campo, coluna in colunas.items():
            if campo not in enviados:
                continue
            valor = getattr(dados, campo)
            if valor is None and campo in ("nome", "preco", "ativo"):
                raise ErroNegocio(422, "CAMPO_OBRIGATORIO", f"O campo {campo} não pode ficar vazio.")
            mudancas[coluna] = valor
        if mudancas:
            sets = ", ".join(f"{coluna} = %s" for coluna in mudancas)
            cur.execute(f"UPDATE produto SET {sets} WHERE id = %s", (*mudancas.values(), produto_id))
        return _resposta(cur, produto_id, usuario["id"])


@router.post("/products/{produto_id}/images", status_code=201)
def enviar_imagem(produto_id: int, arquivo: UploadFile = File(...), usuario: dict = Depends(lojista)) -> dict:
    dados = arquivo.file.read(imagens.TAMANHO_MAXIMO + 1)
    webp = imagens.processar(dados)  # valida antes de tocar no banco
    url = None
    try:
        with transacao() as cur:
            produto = _produto(cur, produto_id, usuario["id"], travar=True)
            cur.execute("SELECT COUNT(*) AS n, COALESCE(MAX(ordem), 0) AS ultima FROM produto_imagem WHERE produto_id = %s", (produto_id,))
            info = cur.fetchone()
            if info["n"] >= MAX_IMAGENS:
                raise ErroNegocio(409, "LIMITE_IMAGENS", f"Cada produto pode ter até {MAX_IMAGENS} imagens.")
            url = imagens.salvar(webp)
            cur.execute(
                "INSERT INTO produto_imagem (produto_id, url, texto_alternativo, ordem) VALUES (%s, %s, %s, %s)",
                (produto_id, url, produto["nome"], info["ultima"] + 1),
            )
            return _resposta(cur, produto_id, usuario["id"])
    except Exception:
        if url:  # o banco desfez a gravação: apaga o arquivo que ficou sem dono
            imagens.apagar(url)
        raise


@router.delete("/products/{produto_id}/images/{imagem_id}")
def apagar_imagem(produto_id: int, imagem_id: int, usuario: dict = Depends(lojista)) -> dict:
    with transacao() as cur:
        _produto(cur, produto_id, usuario["id"], travar=True)
        cur.execute("SELECT url FROM produto_imagem WHERE id = %s AND produto_id = %s", (imagem_id, produto_id))
        imagem = cur.fetchone()
        if not imagem:
            raise nao_encontrado("Imagem")
        cur.execute("DELETE FROM produto_imagem WHERE id = %s", (imagem_id,))
        resposta = _resposta(cur, produto_id, usuario["id"])
    imagens.apagar(imagem["url"])  # só depois de o banco confirmar
    return resposta
