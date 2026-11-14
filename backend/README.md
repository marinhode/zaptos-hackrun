# Back-end do Zaptos (API Python)

API REST em **FastAPI** com **MySQL**. Monólito modular: catálogo, reservas e pagamento, pedidos e lojista.

```
backend/
  app/
    main.py          cria a API, CORS, tratamento de erros e /api/health
    config.py        lê o .env da raiz do repositório
    db.py            conexão MySQL e transações
    auth.py          identificação do usuário (provisória, ver abaixo)
    regras.py        regras puras: divisão do pagamento, código de retirada, busca
    formatos.py      consultas e formato das respostas (camelCase, igual ao front)
    modulos/
      catalogo.py    categorias, lojas e produtos
      reservas.py    reserva com bloqueio de 15 min e pagamento
      pedidos.py     pedidos do cliente
      lojista.py     painel, estoque e retirada
  db/                schema.sql e seed.sql (ver db/README.md)
  tests/             testes de regras e de ponta a ponta
```

## Como rodar

1. Suba o banco e carregue `db/schema.sql` e `db/seed.sql` (instruções em `db/README.md`).
2. Copie `.env.example` (na raiz) para `.env` e preencha `DB_*`. Para testar sem login, use `DEMO_AUTH=1`.
3. Na pasta `backend`:

```bash
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

A documentação interativa fica em http://localhost:8000/docs. Lá dá para testar cada rota.

## Rotas

Todas começam com `/api`.

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/health` | todos | API e banco estão no ar? |
| GET | `/categories` | todos | categorias |
| GET | `/stores` · `/stores/{id}` | todos | lojas (vitrine) |
| GET | `/products` · `/products/{id}` | todos | produtos; filtros `q`, `categoria`, `disponivel`, `preco_max`, `piso`, `loja_id` |
| POST | `/orders/checkout-reserve` | cliente | reserva 1 unidade por 15 min (`{"produtoId": 1}`) |
| DELETE | `/reservations/{id}` | cliente | desiste da reserva; a unidade volta ao estoque |
| POST | `/reservations/{id}/pay` | cliente | paga (`{"metodo": "pix"}` ou `"cartao"`); **simulado** |
| GET | `/orders` · `/orders/{id}` | cliente | meus pedidos, com o código de retirada |
| GET | `/seller/stores` | lojista | minhas lojas |
| GET | `/seller/stores/{id}/dashboard` | lojista | reservas de hoje, estoque e retiradas pendentes |
| PATCH | `/seller/products/{id}/stock` | lojista | soma ou subtrai do estoque (`{"delta": 1}`) |
| GET | `/seller/stores/{id}/pickups/{codigo}` | lojista | valida o código do cliente |
| POST | `/seller/stores/{id}/pickups/{codigo}/confirm` | lojista | confirma a retirada |

Erros de regra voltam como `{"codigo": "SEM_ESTOQUE", "mensagem": "..."}`, com o status HTTP adequado (404, 409, 403…).

## Regras garantidas

- **RN001:** só reserva com estoque livre. A linha do estoque é travada com `SELECT ... FOR UPDATE`, então dois clientes não pegam a mesma última unidade. Há teste disso.
- **RN003:** a retirada só vale para pedido pago, e cada código só pode ser usado uma vez.
- **RN004:** o lojista só vê e altera o que é das próprias lojas.
- **RN005:** o cliente só vê os próprios pedidos.
- **RN010:** a reserva vence em 15 minutos. A API chama `sp_liberar_reservas_expiradas` a cada minuto e antes de reservar ou listar pedidos.
- **RN011:** no pagamento, a parte do lojista mais a comissão da categoria somam exatamente o total.

## Provisório

- **Login (RF015):** ainda não existe. Com `DEMO_AUTH=1`, o usuário é informado pelo cabeçalho `X-Usuario-Id` (no seed: 1 = cliente Ana, 2 = lojista da Casa e Cia). **Não é seguro.** Use só em desenvolvimento; sem `DEMO_AUTH=1`, as rotas protegidas respondem 501.
- **Pagamento:** com `PAGAMENTO_SIMULADO=1`, o pagamento é aprovado na hora. A integração com o PagBank (pedido com `charges.splits` e webhook com `x-authenticity-token`) é a próxima etapa.

## Testes

```bash
pytest
```

- `tests/test_regras.py`: regras puras, sem banco.
- `tests/test_fluxo.py`: fluxo completo contra o MySQL do `.env`. É pulado se o banco não responder. **Altera dados**, então use só em desenvolvimento.
