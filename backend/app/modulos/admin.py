"""Painel do administrador do shopping (RF016).

O admin gerencia usuários, lojas e a comissão de cada categoria, e vê um
resumo do dia. Toda alteração grava uma linha em registro_admin na MESMA
transação, então a alteração e o registro entram juntos ou nenhum dos dois.
"""
import json
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, StrictBool

from ..auth import exigir_perfil
from ..db import liberar_reservas_expiradas, transacao
from ..erros import ErroNegocio, nao_encontrado
from ..formatos import data_iso, numero

router = APIRouter(prefix="/admin", tags=["Administrador"])
admin = exigir_perfil("admin")

PERFIS = ("cliente", "lojista", "atendente", "admin")
STATUS_PEDIDO = ("pendente", "aprovado", "retirado", "cancelado", "expirado")


# ---------------------------------------------------------------------
# Registro das operações
# ---------------------------------------------------------------------
def _registrar(cur, admin_id: int, acao: str, alvo_tipo: str, alvo_id: int, detalhes: dict) -> None:
    """Grava a operação no registro, dentro da transação da alteração."""
    cur.execute(
        "INSERT INTO registro_admin (admin_id, acao, alvo_tipo, alvo_id, detalhes) VALUES (%s, %s, %s, %s, %s)",
        (admin_id, acao, alvo_tipo, alvo_id, json.dumps(detalhes, ensure_ascii=False, default=str)),
    )


def _diferencas(antes: dict, depois: dict) -> tuple[dict, dict]:
    """Só os campos que mudaram, no formato {"antes": ..., "depois": ...}."""
    campos = [c for c in depois if antes.get(c) != depois[c]]
    return {c: antes.get(c) for c in campos}, {c: depois[c] for c in campos}


# ---------------------------------------------------------------------
# Usuários
# ---------------------------------------------------------------------
SQL_USUARIO = "SELECT id, nome, email, telefone, perfil, ativo, criado_em FROM usuario"


def _formatar_usuario(linha: dict) -> dict:
    return {
        "id": linha["id"],
        "nome": linha["nome"],
        "email": linha["email"],
        "telefone": linha["telefone"],
        "perfil": linha["perfil"],
        "ativo": bool(linha["ativo"]),
        "criadoEm": data_iso(linha["criado_em"]),
    }


class AlteracaoUsuario(BaseModel):
    ativo: StrictBool


@router.get("/usuarios")
def listar_usuarios(
    perfil: Literal["cliente", "lojista", "atendente", "admin"] | None = None,
    busca: str | None = Query(default=None, max_length=100),
    _: dict = Depends(admin),
) -> list[dict]:
    filtros, params = [], []
    if perfil:
        filtros.append("perfil = %s")
        params.append(perfil)
    if busca and busca.strip():
        termo = "%" + busca.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        filtros.append("(nome LIKE %s OR email LIKE %s)")
        params += [termo, termo]
    where = (" WHERE " + " AND ".join(filtros)) if filtros else ""
    with transacao() as cur:
        cur.execute(SQL_USUARIO + where + " ORDER BY nome", params)
        return [_formatar_usuario(l) for l in cur.fetchall()]


@router.patch("/usuarios/{usuario_id}")
def alterar_usuario(usuario_id: int, dados: AlteracaoUsuario, usuario: dict = Depends(admin)) -> dict:
    """Bloqueia ou desbloqueia um usuário. O admin não pode bloquear a si mesmo."""
    if usuario_id == usuario["id"] and not dados.ativo:
        raise ErroNegocio(409, "BLOQUEIO_PROPRIO", "Você não pode bloquear o seu próprio usuário.")
    with transacao() as cur:
        cur.execute(SQL_USUARIO + " WHERE id = %s FOR UPDATE", (usuario_id,))
        alvo = cur.fetchone()
        if not alvo:
            raise nao_encontrado("Usuário")
        if bool(alvo["ativo"]) != dados.ativo:
            cur.execute("UPDATE usuario SET ativo = %s WHERE id = %s", (dados.ativo, usuario_id))
            _registrar(
                cur, usuario["id"],
                "usuario.desbloquear" if dados.ativo else "usuario.bloquear",
                "usuario", usuario_id,
                {"antes": {"ativo": not dados.ativo}, "depois": {"ativo": dados.ativo}, "email": alvo["email"]},
            )
            alvo["ativo"] = dados.ativo
        return _formatar_usuario(alvo)


# ---------------------------------------------------------------------
# Lojas
# ---------------------------------------------------------------------
SQL_LOJA = (
    "SELECT l.id, l.nome, l.descricao, l.piso, l.localizacao, l.horario_funcionamento, l.telefone, l.email,"
    "       l.ativa, l.categoria_id, c.nome AS categoria_nome, c.comissao_percentual,"
    "       u.id AS lojista_id, u.nome AS lojista_nome, u.email AS lojista_email, u.ativo AS lojista_ativo,"
    "       (l.pagbank_account_id IS NOT NULL AND l.pagbank_access_token IS NOT NULL) AS pagbank_conectado,"
    "       l.pagbank_conectado_em"
    "  FROM loja l JOIN categoria c ON c.id = l.categoria_id JOIN usuario u ON u.id = l.lojista_id"
)

# campo da API -> coluna da tabela loja
CAMPOS_LOJA = {
    "nome": "nome",
    "piso": "piso",
    "localizacao": "localizacao",
    "horario": "horario_funcionamento",
    "telefone": "telefone",
    "categoriaId": "categoria_id",
    "ativa": "ativa",
}


def _formatar_loja(l: dict) -> dict:
    """Nunca devolve os tokens do PagBank: só se a loja está conectada."""
    return {
        "id": l["id"],
        "nome": l["nome"],
        "descricao": l["descricao"],
        "piso": l["piso"],
        "localizacao": l["localizacao"],
        "horario": l["horario_funcionamento"],
        "telefone": l["telefone"],
        "email": l["email"],
        "ativa": bool(l["ativa"]),
        "categoria": {"id": l["categoria_id"], "nome": l["categoria_nome"], "comissaoPercentual": numero(l["comissao_percentual"])},
        "lojista": {"id": l["lojista_id"], "nome": l["lojista_nome"], "email": l["lojista_email"], "ativo": bool(l["lojista_ativo"])},
        "pagbankConectado": bool(l["pagbank_conectado"]),
        "pagbankConectadoEm": data_iso(l["pagbank_conectado_em"]),
    }


def _valores_loja(l: dict) -> dict:
    """Valores atuais da loja com os nomes de campo da API, para comparar."""
    return {campo: (bool(l[col]) if campo == "ativa" else l[col]) for campo, col in CAMPOS_LOJA.items()}


class AlteracaoLoja(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=120)
    piso: str | None = Field(default=None, min_length=1, max_length=20)
    localizacao: str | None = Field(default=None, max_length=120)
    horario: str | None = Field(default=None, max_length=120)
    telefone: str | None = Field(default=None, max_length=20)
    categoriaId: int | None = Field(default=None, ge=1)
    ativa: StrictBool | None = None


def _buscar_loja(cur, loja_id: int, travar: bool = False) -> dict:
    cur.execute(SQL_LOJA + " WHERE l.id = %s" + (" FOR UPDATE OF l" if travar else ""), (loja_id,))
    loja = cur.fetchone()
    if not loja:
        raise nao_encontrado("Loja")
    return loja


@router.get("/lojas")
def listar_lojas(_: dict = Depends(admin)) -> list[dict]:
    with transacao() as cur:
        cur.execute(SQL_LOJA + " ORDER BY l.nome")
        return [_formatar_loja(l) for l in cur.fetchall()]


@router.patch("/lojas/{loja_id}")
def alterar_loja(loja_id: int, dados: AlteracaoLoja, usuario: dict = Depends(admin)) -> dict:
    """Edita os dados da loja ou ativa/desativa. Todos os campos são opcionais."""
    enviados = dados.model_dump(exclude_unset=True)
    if not enviados:
        raise ErroNegocio(422, "SEM_ALTERACOES", "Informe pelo menos um campo para alterar.")

    novos: dict = {}
    for campo, valor in enviados.items():
        if isinstance(valor, str):
            valor = valor.strip() or None
        if valor is None and campo in ("nome", "piso", "categoriaId", "ativa"):
            raise ErroNegocio(422, "CAMPO_OBRIGATORIO", f"O campo {campo} não pode ficar vazio.")
        novos[campo] = valor

    with transacao() as cur:
        loja = _buscar_loja(cur, loja_id, travar=True)
        antes, depois = _diferencas(_valores_loja(loja), novos)
        if not depois:
            return _formatar_loja(loja)

        if "nome" in depois:
            cur.execute("SELECT id FROM loja WHERE nome = %s AND id <> %s", (depois["nome"], loja_id))
            if cur.fetchone():
                raise ErroNegocio(409, "NOME_EM_USO", "Já existe outra loja com esse nome.")
        if "categoriaId" in depois:
            cur.execute("SELECT id FROM categoria WHERE id = %s", (depois["categoriaId"],))
            if not cur.fetchone():
                raise nao_encontrado("Categoria")

        sets = ", ".join(f"{CAMPOS_LOJA[c]} = %s" for c in depois)
        cur.execute(f"UPDATE loja SET {sets} WHERE id = %s", (*depois.values(), loja_id))

        if set(depois) == {"ativa"}:
            acao = "loja.ativar" if depois["ativa"] else "loja.desativar"
        else:
            acao = "loja.editar"
        _registrar(cur, usuario["id"], acao, "loja", loja_id, {"antes": antes, "depois": depois, "nome": loja["nome"]})
        return _formatar_loja(_buscar_loja(cur, loja_id))


# ---------------------------------------------------------------------
# Categorias (comissão do shopping)
# ---------------------------------------------------------------------
SQL_CATEGORIA = (
    "SELECT c.id, c.nome, c.comissao_percentual,"
    "       (SELECT COUNT(*) FROM loja l WHERE l.categoria_id = c.id) AS lojas"
    "  FROM categoria c"
)


def _formatar_categoria(c: dict) -> dict:
    return {"id": c["id"], "nome": c["nome"], "comissaoPercentual": numero(c["comissao_percentual"]), "lojas": c["lojas"]}


class AlteracaoCategoria(BaseModel):
    comissaoPercentual: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)


@router.get("/categorias")
def listar_categorias(_: dict = Depends(admin)) -> list[dict]:
    with transacao() as cur:
        cur.execute(SQL_CATEGORIA + " ORDER BY c.nome")
        return [_formatar_categoria(c) for c in cur.fetchall()]


@router.patch("/categorias/{categoria_id}")
def alterar_categoria(categoria_id: int, dados: AlteracaoCategoria, usuario: dict = Depends(admin)) -> dict:
    """Altera a comissão do shopping. Vale para os próximos pagamentos; os já
    feitos guardam o percentual da época (pagamento.comissao_percentual)."""
    with transacao() as cur:
        cur.execute(SQL_CATEGORIA + " WHERE c.id = %s FOR UPDATE OF c", (categoria_id,))
        categoria = cur.fetchone()
        if not categoria:
            raise nao_encontrado("Categoria")
        nova = dados.comissaoPercentual
        if categoria["comissao_percentual"] != nova:
            cur.execute("UPDATE categoria SET comissao_percentual = %s WHERE id = %s", (nova, categoria_id))
            _registrar(
                cur, usuario["id"], "categoria.comissao", "categoria", categoria_id,
                {
                    "antes": {"comissaoPercentual": numero(categoria["comissao_percentual"])},
                    "depois": {"comissaoPercentual": numero(nova)},
                    "nome": categoria["nome"],
                },
            )
            categoria["comissao_percentual"] = nova
        return _formatar_categoria(categoria)


# ---------------------------------------------------------------------
# Resumo do dia
# ---------------------------------------------------------------------
@router.get("/resumo")
def resumo(_: dict = Depends(admin)) -> dict:
    liberar_reservas_expiradas()  # para os pedidos vencidos já aparecerem como expirados
    with transacao() as cur:
        cur.execute("SELECT perfil, COUNT(*) AS total, SUM(ativo) AS ativos FROM usuario GROUP BY perfil")
        por_perfil = {p: {"total": 0, "ativos": 0} for p in PERFIS}
        for l in cur.fetchall():
            por_perfil[l["perfil"]] = {"total": l["total"], "ativos": int(l["ativos"] or 0)}

        cur.execute("SELECT COUNT(*) AS total, COALESCE(SUM(ativa), 0) AS ativas FROM loja")
        lojas = cur.fetchone()

        cur.execute("SELECT status, COUNT(*) AS n FROM pedido WHERE DATE(criado_em) = CURDATE() GROUP BY status")
        pedidos = {s: 0 for s in STATUS_PEDIDO}
        for l in cur.fetchall():
            pedidos[l["status"]] = l["n"]

        # vendido hoje = pagamentos aprovados hoje (estornados e recusados não contam)
        cur.execute(
            "SELECT COUNT(*) AS n, COALESCE(SUM(valor_total), 0) AS total,"
            "       COALESCE(SUM(comissao_shopping), 0) AS comissao, COALESCE(SUM(valor_lojista), 0) AS lojistas"
            "  FROM pagamento WHERE status = 'aprovado' AND DATE(pago_em) = CURDATE()"
        )
        vendas = cur.fetchone()

    return {
        "usuariosPorPerfil": por_perfil,
        "lojasAtivas": int(lojas["ativas"]),
        "lojasTotal": lojas["total"],
        "pedidosHoje": pedidos,
        "pagamentosHoje": vendas["n"],
        "valorVendidoHoje": numero(vendas["total"]),
        "comissaoShoppingHoje": numero(vendas["comissao"]),
        "valorLojistasHoje": numero(vendas["lojistas"]),
    }


# ---------------------------------------------------------------------
# Registro
# ---------------------------------------------------------------------
@router.get("/registro")
def registro(limite: int = Query(default=50, ge=1, le=500), _: dict = Depends(admin)) -> list[dict]:
    with transacao() as cur:
        cur.execute(
            "SELECT r.id, r.acao, r.alvo_tipo, r.alvo_id, r.detalhes, r.criado_em, u.id AS admin_id, u.nome AS admin_nome"
            "  FROM registro_admin r JOIN usuario u ON u.id = r.admin_id"
            " ORDER BY r.id DESC LIMIT %s",
            (limite,),
        )
        linhas = cur.fetchall()
    return [
        {
            "id": r["id"],
            "acao": r["acao"],
            "alvoTipo": r["alvo_tipo"],
            "alvoId": r["alvo_id"],
            "detalhes": json.loads(r["detalhes"]) if r["detalhes"] else None,
            "criadoEm": data_iso(r["criado_em"]),
            "admin": {"id": r["admin_id"], "nome": r["admin_nome"]},
        }
        for r in linhas
    ]
