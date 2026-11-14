"""Consultas e formatação compartilhadas entre os módulos.

As respostas usam camelCase para casar com o front-end (frontend/js/api.js).
"""
from datetime import datetime
from decimal import Decimal


def numero(valor: Decimal | None) -> float | None:
    return float(valor) if valor is not None else None


def data_iso(valor: datetime | None) -> str | None:
    return valor.isoformat() if valor else None


# ---------- produtos ----------

# Sem filtro: usado pelo lojista, que também vê os produtos desativados.
SQL_PRODUTO_TODOS = """
SELECT p.id, p.loja_id, p.nome, p.descricao, p.preco, p.ativo,
       p.largura_cm, p.altura_cm, p.profundidade_cm,
       e.quantidade_disponivel AS estoque,
       l.nome AS loja_nome, l.piso, l.localizacao, l.horario_funcionamento,
       c.id AS categoria_id, c.nome AS categoria_nome,
       (SELECT COUNT(*)
          FROM item_pedido i JOIN pedido pe ON pe.id = i.pedido_id
         WHERE i.produto_id = p.id AND pe.status = 'retirado') AS compras_verificadas
  FROM produto p
  JOIN estoque e   ON e.produto_id = p.id
  JOIN loja l      ON l.id = p.loja_id
  JOIN categoria c ON c.id = l.categoria_id
"""

# Catálogo público: só produtos e lojas ativos.
SQL_PRODUTO = SQL_PRODUTO_TODOS + " WHERE p.ativo AND l.ativa\n"


def imagens_por_produto(cur, ids: list[int]) -> dict[int, list[dict]]:
    if not ids:
        return {}
    marcadores = ", ".join(["%s"] * len(ids))
    cur.execute(
        f"SELECT id, produto_id, url, texto_alternativo FROM produto_imagem "
        f"WHERE produto_id IN ({marcadores}) ORDER BY produto_id, ordem",
        ids,
    )
    resultado: dict[int, list[dict]] = {}
    for linha in cur.fetchall():
        resultado.setdefault(linha["produto_id"], []).append(
            {"id": linha["id"], "url": linha["url"], "alt": linha["texto_alternativo"]}
        )
    return resultado


def formatar_produto(linha: dict, imagens: list[dict]) -> dict:
    tem_medidas = linha["largura_cm"] is not None
    return {
        "id": linha["id"],
        "lojaId": linha["loja_id"],
        "nome": linha["nome"],
        "descricao": linha["descricao"],
        "preco": numero(linha["preco"]),
        "ativo": bool(linha["ativo"]),
        "estoque": linha["estoque"],
        "medidas": {
            "largura": numero(linha["largura_cm"]),
            "altura": numero(linha["altura_cm"]),
            "profundidade": numero(linha["profundidade_cm"]),
        } if tem_medidas else None,
        "imagens": imagens,
        # avaliações (RF020) ficam para a segunda versão
        "avaliacao": None,
        "comprasVerificadas": linha["compras_verificadas"],
        "loja": {
            "id": linha["loja_id"],
            "nome": linha["loja_nome"],
            "piso": linha["piso"],
            "localizacao": linha["localizacao"],
            "horario": linha["horario_funcionamento"],
        },
        "categoria": {"id": linha["categoria_id"], "nome": linha["categoria_nome"]},
    }


# ---------- pedidos ----------

SQL_PEDIDO = """
SELECT pe.id, pe.usuario_id, pe.status, pe.valor_total, pe.criado_em, pe.loja_id,
       u.nome AS cliente_nome,
       l.nome AS loja_nome, l.piso, l.localizacao, l.horario_funcionamento,
       pg.status AS pagamento_status, pg.pago_em,
       pt.codigo AS qr_codigo, pt.codigo_curto, pt.usado_em,
       (SELECT UNIX_TIMESTAMP(r.expira_em) FROM reserva r
         WHERE r.pedido_id = pe.id AND r.status = 'ativa' LIMIT 1) AS reserva_expira_em
  FROM pedido pe
  JOIN usuario u ON u.id = pe.usuario_id
  JOIN loja l    ON l.id = pe.loja_id
  LEFT JOIN pagamento pg          ON pg.pedido_id = pe.id
  LEFT JOIN protocolo_retirada pt ON pt.pedido_id = pe.id
"""


def itens_por_pedido(cur, ids: list[int]) -> dict[int, list[dict]]:
    if not ids:
        return {}
    marcadores = ", ".join(["%s"] * len(ids))
    cur.execute(
        f"SELECT i.pedido_id, i.produto_id, p.nome, i.quantidade, i.preco_unitario "
        f"FROM item_pedido i JOIN produto p ON p.id = i.produto_id "
        f"WHERE i.pedido_id IN ({marcadores}) ORDER BY i.id",
        ids,
    )
    resultado: dict[int, list[dict]] = {}
    for linha in cur.fetchall():
        resultado.setdefault(linha["pedido_id"], []).append({
            "produtoId": linha["produto_id"],
            "nome": linha["nome"],
            "quantidade": linha["quantidade"],
            "precoUnitario": numero(linha["preco_unitario"]),
        })
    return resultado


def formatar_pedido(linha: dict, itens: list[dict]) -> dict:
    pago = linha["status"] in ("aprovado", "retirado")
    expira = linha["reserva_expira_em"]
    return {
        "id": linha["id"],
        "status": linha["status"],
        "valor": numero(linha["valor_total"]),
        "criadoEm": data_iso(linha["criado_em"]),
        "pagoEm": data_iso(linha["pago_em"]),
        "retiradoEm": data_iso(linha["usado_em"]),
        # o código só aparece depois do pagamento (RN003)
        "codigo": linha["codigo_curto"] if pago else None,
        "qrCodigo": linha["qr_codigo"] if pago else None,
        "reservaExpiraEm": int(expira * 1000) if expira is not None else None,
        "cliente": {"id": linha["usuario_id"], "nome": linha["cliente_nome"]},
        "loja": {
            "id": linha["loja_id"],
            "nome": linha["loja_nome"],
            "piso": linha["piso"],
            "localizacao": linha["localizacao"],
            "horario": linha["horario_funcionamento"],
        },
        "itens": itens,
        # atalho para as telas atuais, que mostram um produto por pedido
        "produto": itens[0] if itens else None,
    }


def buscar_pedidos(cur, where: str, params: tuple) -> list[dict]:
    cur.execute(f"{SQL_PEDIDO} WHERE {where} ORDER BY pe.criado_em DESC, pe.id DESC", params)
    linhas = cur.fetchall()
    itens = itens_por_pedido(cur, [l["id"] for l in linhas])
    return [formatar_pedido(l, itens.get(l["id"], [])) for l in linhas]
