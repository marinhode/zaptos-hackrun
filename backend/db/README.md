# Banco de dados (MySQL)

- `schema.sql`: cria o banco `zaptos` com as tabelas, as chaves, os índices, os gatilhos, a rotina que libera reservas vencidas e o registro das operações administrativas. **Ele apaga e recria o banco**, então use só em desenvolvimento.
- `seed.sql`: insere os dados de exemplo, alinhados com o protótipo e com `frontend/js/data.js` (veja abaixo).

Requisito: MySQL 8.0.16 ou mais recente (por causa das restrições `CHECK`).

## Como rodar

Na raiz do repositório:

```bash
mysql -u root -p < backend/db/schema.sql
mysql -u root -p zaptos < backend/db/seed.sql
```

Sem MySQL instalado, dá para usar Docker:

```bash
docker run -d --name zaptos-mysql -e MYSQL_ROOT_PASSWORD=<sua-senha-local> -p 3306:3306 mysql:8.4
docker exec -i zaptos-mysql mysql -uroot -p<sua-senha-local> < backend/db/schema.sql
docker exec -i zaptos-mysql mysql -uroot -p<sua-senha-local> zaptos < backend/db/seed.sql
```

Depois, preencha `DB_HOST`, `DB_USER`, `DB_PASSWORD` etc. no `.env`. Não coloque senhas nos scripts nem faça commit do `.env`.

## Dados de exemplo

| id | Usuário | E-mail | Perfil |
|----|---------|--------|--------|
| 1 | Ana Souza | `cliente@zaptos.dev` | cliente |
| 2 | Carlos Lojista | `lojista@zaptos.dev` | lojista (Casa e Cia) |
| 3 | Admin Capim Dourado | `admin@zaptos.dev` | admin |
| 4 | Marina Lojista | `larestilo@zaptos.dev` | lojista (Lar & Estilo) |
| 5 | Rafael Lojista | `passocerto@zaptos.dev` | lojista (Passo Certo) |

Todos usam a senha de desenvolvimento `zaptos-dev-123`, guardada como hash bcrypt. Ela vale só para testes locais.

- **Categorias** (comissão do shopping): 1 Decoração (10%), 2 Moda (12%), 3 Eletrônicos (8%), 4 Calçados (10%).
- **Lojas** (seg a sáb 10h-22h): 1 Casa e Cia (Decoração, Piso 1, Loja 112), 2 Lar & Estilo (Decoração, Piso 2, Loja 204), 3 Passo Certo (Calçados, Piso 1, Loja 130).
- **Produtos** (L×A×P em cm, estoque):

| id | Loja | Produto | Preço | Medidas | Estoque |
|----|------|---------|-------|---------|---------|
| 1 | Casa e Cia | Poltrona Lina | 1.290,00 | 78×72×85 | 3 |
| 2 | Lar & Estilo | Poltrona Oslo | 1.450,00 | 80×76×82 | 1 |
| 3 | Casa e Cia | Poltrona Ripa | 990,00 | 70×74×78 | 0 (esgotado) |
| 4 | Casa e Cia | Mesa Tora | 2.100,00 | 160×76×90 | 5 |
| 5 | Lar & Estilo | Luminária Arco | 420,00 | 40×190×120 | 4 |
| 6 | Passo Certo | Tênis Run | 380,00 | sem medidas | 6 |

  Ainda não há linhas em `produto_imagem`: as imagens ainda não existem.
- **Histórico da Ana**:
  - Pedido 4790: Luminária Arco (Lar & Estilo), pago e retirado em 2026-11-02. Tem pagamento aprovado (split de 10%) e protocolo `CD-4790-2HM` já usado.
  - Pedido 4712: Tênis Run (Passo Certo), expirado em 2026-10-20 (a reserva venceu sem pagamento).
- O `AUTO_INCREMENT` de `pedido` termina em 4821, então o próximo pedido criado pela API será o 4821.

## Status do pedido

`pendente`, `aprovado`, `retirado`, `cancelado` e `expirado`.

- `expirado`: a reserva de 15 minutos venceu sem pagamento. É o que a rotina `sp_liberar_reservas_expiradas` grava.
- `cancelado`: o cliente desistiu do pedido.

## Protocolo de retirada

Cada pedido pago tem um protocolo com dois códigos:

- `codigo`: UUID gravado no QR Code.
- `codigo_curto`: código que o cliente mostra e o lojista digita, no formato `CD-<id do pedido>-<3 caracteres>` (ex.: `CD-4821-7KQ`). Os caracteres saem de `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (sem I, L, O, 0 e 1, que se confundem). É único (`uq_protocolo_codigo_curto`) e gerado pela API. O banco recusa um código fora do formato ou com o id de outro pedido (`ck_protocolo_codigo_curto`).

## Registro das operações administrativas (RF016)

A tabela `registro_admin` guarda cada alteração feita no painel do administrador (`frontend/admin.html`, rotas `/api/admin/*`):

| Coluna | Conteúdo |
|--------|----------|
| `admin_id` | administrador que fez a alteração (FK para `usuario`) |
| `acao` | `usuario.bloquear`, `usuario.desbloquear`, `loja.editar`, `loja.ativar`, `loja.desativar` ou `categoria.comissao` |
| `alvo_tipo`, `alvo_id` | o que foi alterado (`usuario`, `loja` ou `categoria`) e o id |
| `detalhes` | JSON `{"antes": {...}, "depois": {...}}` só com os campos que mudaram, mais o nome ou e-mail do alvo |
| `criado_em` | quando |

- A API grava a linha **na mesma transação** da alteração: ou as duas entram, ou nenhuma.
- Pedido que não muda nada (ex.: bloquear quem já está bloqueado) não gera linha.
- Gatilhos garantem que o autor tem perfil `admin` e que o registro é **somente de inserção**: `UPDATE` e `DELETE` em `registro_admin` são recusados.
- O seed não insere linhas nesta tabela.

## Liberação de reservas (15 minutos)

A API deve chamar `CALL sp_liberar_reservas_expiradas();` periodicamente. A rotina devolve as unidades ao estoque, marca as reservas como `expirada` e os pedidos ainda pendentes como `expirado`. Se preferir que o próprio MySQL faça isso, ative o agendador de eventos e o evento `ev_liberar_reservas_expiradas` passa a rodar a cada minuto:

```sql
SET GLOBAL event_scheduler = ON;
```
