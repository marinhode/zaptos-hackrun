"""Erros de regra de negócio, devolvidos ao front como {"codigo", "mensagem"}."""


class ErroNegocio(Exception):
    def __init__(self, status: int, codigo: str, mensagem: str):
        super().__init__(mensagem)
        self.status = status
        self.codigo = codigo
        self.mensagem = mensagem


def nao_encontrado(o_que: str) -> ErroNegocio:
    return ErroNegocio(404, "NAO_ENCONTRADO", f"{o_que} não encontrado.")
