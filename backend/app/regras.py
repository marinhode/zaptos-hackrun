"""Regras puras (sem banco), fáceis de testar."""
import re
import secrets
from decimal import ROUND_HALF_UP, Decimal

# Sem letras e números que se confundem (0/O, 1/I/L).
ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CENTAVO = Decimal("0.01")


def dividir_pagamento(total: Decimal, percentual_shopping: Decimal) -> tuple[Decimal, Decimal]:
    """RN011: separa a parte do lojista e a comissão do shopping.

    A comissão é arredondada para o centavo; o lojista fica com o resto,
    então as duas partes sempre somam exatamente o total.
    """
    if total <= 0:
        raise ValueError("O total precisa ser maior que zero.")
    if not Decimal(0) <= percentual_shopping <= Decimal(100):
        raise ValueError("O percentual precisa estar entre 0 e 100.")
    comissao = (total * percentual_shopping / Decimal(100)).quantize(CENTAVO, rounding=ROUND_HALF_UP)
    return total - comissao, comissao


def gerar_codigo_curto(pedido_id: int) -> str:
    """Código que o cliente mostra no balcão, ex.: CD-4821-7KQ."""
    sufixo = "".join(secrets.choice(ALFABETO_CODIGO) for _ in range(3))
    return f"CD-{pedido_id}-{sufixo}"


def normalizar_codigo(codigo: str) -> str:
    return codigo.strip().upper()


def termos_fulltext(busca: str) -> str:
    """Monta a busca FULLTEXT em modo booleano: todas as palavras, aceitando prefixo.

    Remove os operadores do MySQL (+ - < > ( ) ~ * " @) que o usuário digitar.
    """
    palavras = re.findall(r"\w+", busca, flags=re.UNICODE)
    return " ".join(f"+{p}*" for p in palavras)
