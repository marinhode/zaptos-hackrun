"""Avisos dentro do app (RF007).

Os avisos são gravados na MESMA transação da mudança que os gerou: se o
pagamento ou a retirada forem desfeitos, o aviso também é.
"""


def criar(cur, usuario_id: int, pedido_id: int | None, tipo: str, titulo: str, mensagem: str) -> None:
    cur.execute(
        "INSERT INTO notificacao (usuario_id, pedido_id, tipo, titulo, mensagem) VALUES (%s, %s, %s, %s, %s)",
        (usuario_id, pedido_id, tipo, titulo[:120], mensagem[:500]),
    )


def _dados_pedido(cur, pedido_id: int) -> dict:
    cur.execute(
        "SELECT pe.id, pe.usuario_id, l.lojista_id, l.nome AS loja, l.horario_funcionamento AS horario,"
        "       (SELECT p.nome FROM item_pedido i JOIN produto p ON p.id = i.produto_id"
        "         WHERE i.pedido_id = pe.id ORDER BY i.id LIMIT 1) AS produto"
        "  FROM pedido pe JOIN loja l ON l.id = pe.loja_id WHERE pe.id = %s",
        (pedido_id,),
    )
    return cur.fetchone()


def pagamento_aprovado(cur, pedido_id: int, codigo: str) -> None:
    """Avisa o cliente (pode retirar) e o lojista (vai ter retirada)."""
    d = _dados_pedido(cur, pedido_id)
    criar(cur, d["usuario_id"], pedido_id, "pagamento_aprovado", "Pagamento aprovado",
          f"Seu pedido {pedido_id} ({d['produto']}) já está separado na {d['loja']}. "
          f"Mostre o código {codigo} no balcão para retirar.")
    criar(cur, d["lojista_id"], pedido_id, "nova_retirada", "Nova reserva paga",
          f"Pedido {pedido_id}: {d['produto']}. Deixe separado para o cliente retirar.")


def retirada_confirmada(cur, pedido_id: int) -> None:
    d = _dados_pedido(cur, pedido_id)
    criar(cur, d["usuario_id"], pedido_id, "retirada_confirmada", "Retirada confirmada",
          f"Você retirou {d['produto']} na {d['loja']}. Obrigado por comprar no Capim Dourado!")
