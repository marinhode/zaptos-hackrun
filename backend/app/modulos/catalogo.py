"""Catálogo: categorias, lojas e produtos (RF005, RF009, RF011, RF012). Rotas públicas."""
from fastapi import APIRouter, Query

from ..db import transacao
from ..erros import nao_encontrado
from ..formatos import SQL_PRODUTO, formatar_produto, imagens_por_produto
from ..regras import termos_fulltext

router = APIRouter(tags=["Catálogo"])


@router.get("/categories")
def listar_categorias() -> list[dict]:
    with transacao() as cur:
        cur.execute("SELECT id, nome FROM categoria ORDER BY nome")
        return cur.fetchall()


def _formatar_loja(linha: dict) -> dict:
    return {
        "id": linha["id"],
        "nome": linha["nome"],
        "descricao": linha["descricao"],
        "piso": linha["piso"],
        "localizacao": linha["localizacao"],
        "horario": linha["horario_funcionamento"],
        "telefone": linha["telefone"],
        "categoria": {"id": linha["categoria_id"], "nome": linha["categoria_nome"]},
    }


SQL_LOJA = """
SELECT l.id, l.nome, l.descricao, l.piso, l.localizacao, l.horario_funcionamento, l.telefone,
       c.id AS categoria_id, c.nome AS categoria_nome
  FROM loja l JOIN categoria c ON c.id = l.categoria_id
 WHERE l.ativa
"""


@router.get("/stores")
def listar_lojas(categoria: str | None = None) -> list[dict]:
    sql, params = SQL_LOJA, []
    if categoria:
        sql += " AND c.nome = %s"
        params.append(categoria)
    with transacao() as cur:
        cur.execute(sql + " ORDER BY l.nome", params)
        return [_formatar_loja(l) for l in cur.fetchall()]


@router.get("/stores/{loja_id}")
def obter_loja(loja_id: int) -> dict:
    with transacao() as cur:
        cur.execute(SQL_LOJA + " AND l.id = %s", (loja_id,))
        linha = cur.fetchone()
    if not linha:
        raise nao_encontrado("Loja")
    return _formatar_loja(linha)


@router.get("/products")
def listar_produtos(
    q: str | None = Query(default=None, max_length=100, description="Nome, descrição, loja ou categoria"),
    categoria: str | None = None,
    disponivel: bool = Query(default=False, description="Só produtos com unidade livre agora"),
    preco_max: float | None = Query(default=None, gt=0),
    piso: str | None = Query(default=None, description="Ex.: Piso 1"),
    loja_id: int | None = None,
) -> list[dict]:
    sql, params = SQL_PRODUTO, []
    if q and q.strip():
        termo_like = f"%{q.strip()}%"
        fulltext = termos_fulltext(q)
        condicoes = ["p.nome LIKE %s", "l.nome LIKE %s", "c.nome LIKE %s"]
        params += [termo_like, termo_like, termo_like]
        if fulltext:
            condicoes.append("MATCH(p.nome, p.descricao) AGAINST (%s IN BOOLEAN MODE)")
            params.append(fulltext)
        sql += " AND (" + " OR ".join(condicoes) + ")"
    if categoria:
        sql += " AND c.nome = %s"
        params.append(categoria)
    if disponivel:
        sql += " AND e.quantidade_disponivel > 0"
    if preco_max is not None:
        sql += " AND p.preco <= %s"
        params.append(preco_max)
    if piso:
        sql += " AND l.piso = %s"
        params.append(piso)
    if loja_id is not None:
        sql += " AND p.loja_id = %s"
        params.append(loja_id)

    with transacao() as cur:
        cur.execute(sql + " ORDER BY p.nome", params)
        linhas = cur.fetchall()
        imagens = imagens_por_produto(cur, [l["id"] for l in linhas])
    return [formatar_produto(l, imagens.get(l["id"], [])) for l in linhas]


@router.get("/products/{produto_id}")
def obter_produto(produto_id: int) -> dict:
    with transacao() as cur:
        cur.execute(SQL_PRODUTO + " AND p.id = %s", (produto_id,))
        linha = cur.fetchone()
        if not linha:
            raise nao_encontrado("Produto")
        imagens = imagens_por_produto(cur, [produto_id])
    return formatar_produto(linha, imagens.get(produto_id, []))
