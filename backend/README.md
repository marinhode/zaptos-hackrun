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
2. Copie `.env.example` (na raiz) para `.env` e preencha `DB_*` e `SECRET_KEY` (o comando para gerar a chave está no próprio arquivo).
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
| POST | `/auth/login` | todos | entra (`{"email", "senha"}`) e recebe o token |
| POST | `/auth/cadastro` | todos | cria conta de **cliente** (`{"nome", "email", "senha"}`) e já entra |
| GET | `/me` | logado | dados do usuário logado |
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
| POST | `/seller/stores/{id}/products` | lojista | cadastra produto (`nome`, `descricao`, `preco`, `largura`/`altura`/`profundidade` em cm, `estoque`) |
| GET · PATCH | `/seller/products/{id}` | lojista | vê ou edita o produto; `{"ativo": false}` tira do app |
| POST | `/seller/products/{id}/images` | lojista | envia foto (formulário com o campo `arquivo`); até 6 por produto |
| DELETE | `/seller/products/{id}/images/{imagemId}` | lojista | remove a foto |
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

## Login (RF002, RF015)

- Senhas guardadas com **bcrypt**, nunca em texto.
- O login devolve um **token JWT** assinado com `SECRET_KEY`, válido por `TOKEN_HORAS` (padrão 8 h). O front o envia em `Authorization: Bearer <token>`.
- A cada requisição a API confere no banco se a conta continua ativa: um usuário bloqueado perde o acesso na hora, mesmo com token válido.
- E-mail inexistente e senha errada recebem a mesma mensagem, para não revelar quais e-mails têm conta.
- Só **clientes** se cadastram sozinhos. Contas de lojista, atendente e administrador são criadas pelo shopping.
- As contas de teste do seed estão em `db/README.md`.
- `DEMO_AUTH=1` aceita o cabeçalho `X-Usuario-Id` no lugar do token. É usado pelos testes; **nunca ligue fora do desenvolvimento**.

## Imagens dos produtos (RF013, RNF001)

- O servidor abre cada foto enviada e só aceita JPEG, PNG ou WebP de verdade. Não confia na extensão do arquivo.
- Ele corrige a rotação da foto do celular, reduz para no máximo 1200 px e regrava em WebP, ficando abaixo de 500 KB.
- Os arquivos ficam em `backend/uploads/produtos/` (fora do git) e são servidos em `/uploads/...`.

## Provisório

- **Pagamento:** com `PAGAMENTO_SIMULADO=1`, o pagamento é aprovado na hora. A integração com o PagBank (pedido com `charges.splits` e webhook com `x-authenticity-token`) é a próxima etapa.

## Testes

```bash
pytest
```

- `tests/test_regras.py`: regras puras, sem banco.
- `tests/test_fluxo.py`: fluxo completo contra o MySQL do `.env`. É pulado se o banco não responder. **Altera dados**, então use só em desenvolvimento.
