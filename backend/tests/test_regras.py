from decimal import Decimal

import pytest

from app.regras import ALFABETO_CODIGO, dividir_pagamento, gerar_codigo_curto, normalizar_codigo, termos_fulltext


def test_divisao_soma_exatamente_o_total():
    lojista, comissao = dividir_pagamento(Decimal("1290.00"), Decimal("10.00"))
    assert comissao == Decimal("129.00")
    assert lojista == Decimal("1161.00")
    assert lojista + comissao == Decimal("1290.00")


def test_divisao_arredonda_centavo_sem_perder_valor():
    lojista, comissao = dividir_pagamento(Decimal("99.99"), Decimal("12.50"))
    assert comissao == Decimal("12.50")  # 12,49875 arredonda para 12,50
    assert lojista + comissao == Decimal("99.99")


@pytest.mark.parametrize("percentual", [Decimal("-1"), Decimal("100.01")])
def test_divisao_recusa_percentual_invalido(percentual):
    with pytest.raises(ValueError):
        dividir_pagamento(Decimal("10"), percentual)


def test_divisao_recusa_total_zero():
    with pytest.raises(ValueError):
        dividir_pagamento(Decimal("0"), Decimal("10"))


def test_codigo_curto_tem_formato_do_prototipo():
    codigo = gerar_codigo_curto(4821)
    prefixo, pedido, sufixo = codigo.split("-")
    assert (prefixo, pedido) == ("CD", "4821")
    assert len(sufixo) == 3 and all(c in ALFABETO_CODIGO for c in sufixo)


def test_normalizar_codigo_aceita_minusculas_e_espacos():
    assert normalizar_codigo("  cd-4821-7kq ") == "CD-4821-7KQ"


def test_fulltext_remove_operadores_do_mysql():
    assert termos_fulltext('poltrona -lina "+x" (verde)') == "+poltrona* +lina* +x* +verde*"
    assert termos_fulltext("***") == ""
