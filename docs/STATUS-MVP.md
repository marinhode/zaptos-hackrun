# Zaptos – Status do MVP

Situação em 13/11/2026. Compara o planejamento do MVP (seção 10.1 da documentação) e as regras de negócio (RN001–RN012) com o código entregue.

## Legenda

| Status | Significa |
| --- | --- |
| **Feito** | Funciona de ponta a ponta e tem teste ou foi testado no navegador. |
| **Parcial** | A parte principal funciona; falta um pedaço, descrito na linha. |
| **Simulado** | A tela e o fluxo existem, mas o serviço externo é imitado. |
| **Próxima versão** | Ainda não existe no código. |

## Onde está o código

O código está em branches que estão sendo integradas:

- `feature/produtos`: front-end (PWA), API, login e cadastro de produtos pelo lojista.
- `feature/admin`: painel do administrador (`frontend/admin.html`, `backend/app/modulos/admin.py`).
- `feature/banco-modelo`: banco (`backend/db/schema.sql` e `seed.sql`).

Os caminhos abaixo são relativos à raiz do repositório. As rotas começam com `/api`. Os testes ficam em `backend/tests/`.

## Requisitos do MVP (seção 10.1)

| Código | Requisito | Status | Onde está no código | Como foi testado |
| --- | --- | --- | --- | --- |
| RF002 | Cadastro | **Parcial** | `POST /auth/cadastro` (`modulos/autenticacao.py`, `cadastrar`); tela `#/cadastro`. Só o cliente se cadastra sozinho. Contas de lojista vêm do seed. **Falta:** cadastro do lojista e vínculo da conta PagBank (Connect). | `test_autenticacao.py`: `test_cadastro_cria_cliente_e_ja_entra`, `test_cadastro_valida_dados` |
| RF015 | Autenticação e perfis | **Parcial** | `POST /auth/login` (`autenticacao.py`, `entrar`); senha com bcrypt e token em `seguranca.py`; permissão por perfil em `auth.py` (`exigir_perfil`); "Sair da conta" na tela `#/perfil`. **Falta:** tela para o usuário atualizar os próprios dados e telas do perfil atendente. | `test_autenticacao.py`: `test_login_com_conta_do_seed`, `test_perfis_separados`, `test_token_adulterado_e_recusado`, `test_conta_bloqueada` |
| RF005 | Categorias de lojistas | **Feito** | `GET /categories` (`catalogo.py`, `listar_categorias`); filtro por categoria em `/stores` e `/products`; comissão por categoria em `categoria.comissao_percentual`. | `test_admin.py`: `test_alterar_comissao_da_categoria`; testado no navegador |
| RF011 | Área de lojas | **Feito** | `GET /stores` e `/stores/{id}` (`catalogo.py`, `listar_lojas`, `obter_loja`); tela `#/loja/:id` com piso, loja, horário e telefone. | Testado no navegador |
| RF001 | Controle de estoque | **Feito** | `POST /orders/checkout-reserve` (`reservas.py`, `reservar`) trava a linha do estoque com `SELECT ... FOR UPDATE`; ajuste pelo lojista em `PATCH /seller/products/{id}/stock` (`lojista.py`, `ajustar_estoque`). | `test_fluxo.py`: `test_concorrencia_ultima_unidade`, `test_sem_estoque_nao_reserva`, `test_fluxo_reserva_pagamento_retirada` |
| RF009 | Busca online e finalização na loja | **Feito** | `GET /products?q=` com índice FULLTEXT (`catalogo.py`, `listar_produtos`; `regras.py`, `termos_fulltext`); botão "Reservar na loja" na tela `#/produto/:id`. | `test_fluxo.py`: `test_catalogo_e_busca`; `test_regras.py`: `test_fulltext_remove_operadores_do_mysql` |
| RF004 | Pagamento em sandbox com split | **Simulado** | `POST /reservations/{id}/pay` (`reservas.py`, `pagar`). Com `PAGAMENTO_SIMULADO=1`, o botão "Pagar" aprova na hora. A divisão lojista/shopping é calculada (`regras.py`, `dividir_pagamento`) e gravada na tabela `pagamento`. **Não há** chamada ao PagBank nem ao sandbox. | `test_regras.py`: `test_divisao_soma_exatamente_o_total`, `test_divisao_arredonda_centavo_sem_perder_valor`; `test_fluxo.py`: `test_fluxo_reserva_pagamento_retirada` |
| RF006 | Retiradas (BOPIS) | **Feito** | Painel `GET /seller/stores/{id}/dashboard` (`lojista.py`, `painel`); confirmação `POST /seller/stores/{id}/pickups/{codigo}/confirm` (`confirmar_retirada`); telas `#/lojista` e `#/lojista/validar`. | `test_fluxo.py`: `test_fluxo_reserva_pagamento_retirada`; testado no navegador |
| RF007 | Notificações | **Próxima versão** | Não existe. O cliente vê o status do pedido quando abre o app. Não há aviso por e-mail, push ou webhook. | — |
| RF008 | Protocolo de retirada (QR Code) | **Parcial** | Código gerado no pagamento (`reservas.py`, `_gerar_protocolo`; `regras.py`, `gerar_codigo_curto`): UUID no QR Code e código curto `CD-<pedido>-XXX`. QR exibido na tela `#/pedido/:id`. Uso único em `lojista.py` (`_protocolo`) e no gatilho `tg_protocolo_bu_uso_unico`. **Falta:** leitura pela câmera; hoje o lojista digita o código. | `test_fluxo.py`: `test_fluxo_reserva_pagamento_retirada` (2º uso recusado com `JA_RETIRADO`); `test_regras.py`: `test_codigo_curto_tem_formato_do_prototipo`, `test_normalizar_codigo_aceita_minusculas_e_espacos` |
| RF016 | Painel administrativo | **Parcial** | `backend/app/modulos/admin.py` (rotas `/admin/*`) e `frontend/admin.html`: resumo do dia, bloquear e desbloquear usuários, editar e desativar lojas, alterar comissão e registro das operações (tabela `registro_admin`). **Falta:** cadastrar usuários e lojas pelo painel. | `test_admin.py` (17 testes), ex.: `test_so_admin_acessa`, `test_bloquear_e_desbloquear_usuario`, `test_registro_e_somente_insercao`; testado no navegador |
| — | Painel do lojista: produtos | **Feito** | Cadastro, edição e fotos em `modulos/produtos_lojista.py` (`criar_produto`, `editar_produto`, `enviar_imagem`); telas `#/lojista/produto/novo` e `#/lojista/produto/:id`. | `test_produtos_lojista.py`: `test_criar_produto_aparece_no_catalogo`, `test_validacoes_do_cadastro`, `test_editar_e_desativar` |

## Regras de negócio

| Código | Regra | Status | Onde está no código | Como foi testado |
| --- | --- | --- | --- | --- |
| RN001 | Só reserva com estoque | **Feito** | `reservas.py`, `reservar` (`FOR UPDATE` + conferência do estoque); `CHECK ck_estoque_disponivel` no banco impede estoque negativo. | `test_fluxo.py`: `test_sem_estoque_nao_reserva`, `test_concorrencia_ultima_unidade` |
| RN002 | Prazo de validade para retirada | **Próxima versão** | Não existe prazo depois do pagamento. Só há os 15 minutos para pagar (RN010). | — |
| RN003 | Retirada só com pagamento e código válido | **Feito** | `lojista.py`, `_protocolo` (recusa pedido não pago, de outra loja ou já retirado) e `confirmar_retirada`; gatilho `tg_protocolo_bu_uso_unico`. | `test_fluxo.py`: `test_fluxo_reserva_pagamento_retirada` |
| RN004 | Lojista só mexe na própria loja | **Feito** | `lojista.py`, `_loja_do_lojista`; `produtos_lojista.py`, `_produto`. | `test_fluxo.py`: `test_lojista_so_mexe_na_propria_loja`; `test_produtos_lojista.py`: `test_limite_de_imagens_e_dono` |
| RN005 | Cliente só vê os próprios dados | **Feito** | `pedidos.py`, `meus_pedidos` e `meu_pedido` filtram pelo usuário logado; `/me` não devolve a senha. Não há teste específico de um cliente abrindo o pedido de outro. | `test_autenticacao.py`: `test_perfis_separados`; `test_fluxo.py`: `test_me_devolve_usuario_sem_dados_sensiveis` |
| RN006 | Pagamento só com retorno autenticado | **Simulado** | Não há webhook nem validação do `x-authenticity-token`. O pagamento simulado aprova direto. | — |
| RN007 | Regras de cupons e promoções | **Próxima versão** | Cupons não existem. | — |
| RN008 | Permissões do administrador | **Feito** | `admin.py`: todas as rotas usam `exigir_perfil("admin")`. | `test_admin.py`: `test_so_admin_acessa`, `test_cliente_e_lojista_nao_alteram` |
| RN009 | Protocolo de atendimento entre canais | **Próxima versão** | Atendimento com protocolo não existe. | — |
| RN010 | Reserva bloqueada por no máximo 15 min | **Feito** | `reserva.expira_em` com padrão de 15 min e `CHECK ck_reserva_prazo`; rotina `sp_liberar_reservas_expiradas` chamada pela API a cada minuto (`main.py`, `_rotina_liberacao`) e antes de reservar ou listar pedidos; relógio na tela `#/reservar/:id`. | `test_fluxo.py`: `test_reserva_vencida_volta_ao_estoque`, `test_cancelar_devolve_ao_estoque` |
| RN011 | Comissão retida pelo split | **Parcial** | A divisão é calculada e gravada (`regras.py`, `dividir_pagamento`; colunas `valor_lojista` e `comissao_shopping`; `CHECK ck_pagamento_valores` garante que somam o total). O repasse real pelo split do PagBank é simulado. | `test_regras.py`: `test_divisao_*`; `test_admin.py`: `test_resumo_conta_venda_de_hoje` |
| RN012 | Um pagamento por lojista | **Parcial** | Cada pedido pertence a uma única loja (chaves estrangeiras compostas em `item_pedido`). Ainda não há carrinho com várias lojas: a reserva é de um produto por vez. | Garantido pelo banco (`schema.sql`) |

## Entregue além do MVP

Itens previstos para a 2ª versão que já funcionam:

| Código | Requisito | Status | Onde está | Como foi testado |
| --- | --- | --- | --- | --- |
| RF013 | Galeria de imagens e medidas | **Feito** | Tela `#/produto/:id`; fotos validadas e convertidas para WebP com menos de 500 KB (`backend/app/imagens.py`, `processar`); imagem padrão quando a foto não carrega (RNF004). | `test_produtos_lojista.py`: `test_imagem_e_convertida_e_servida`, `test_arquivo_que_nao_e_imagem_e_recusado` |
| RF010 | Histórico de compras | **Feito** | `GET /orders` (`pedidos.py`); tela `#/pedidos`. | `test_fluxo.py`: `test_fluxo_reserva_pagamento_retirada` |
| RF012 | Filtros | **Feito** | `GET /products` com `categoria`, `disponivel`, `preco_max`, `piso` e `loja_id`; tela `#/buscar`. | `test_fluxo.py`: `test_catalogo_e_busca` |
| RF003 | Suporte/FAQ | **Parcial** | Tela `#/ajuda` com perguntas frequentes e local do atendimento presencial. Sem canal de contato online. | Testado no navegador |
| RF018 | Mapa do shopping | **Próxima versão** | Aparece como "em breve". | — |
| — | 3D e realidade aumentada | **Próxima versão** | Aparece como "em breve" na página do produto. Depende de modelos 3D (3ª versão). | — |

## Próximos passos

1. **PagBank em sandbox:** pedido com `charges.splits`, webhook com validação do `x-authenticity-token` e PagBank Connect para o lojista (RF004, RN006, RN011, RF002).
2. **Notificações** de pagamento e retirada para cliente e lojista (RF007).
3. **Leitura do QR Code pela câmera** no painel do lojista (RF008).
4. **Prazo para retirada** depois do pagamento, com estorno se o cliente não aparecer (RN002).
5. **Carrinho com várias lojas**, gerando um pagamento por lojista (RN012).
6. **Admin:** cadastrar usuários e lojas pelo painel (RF016).
7. **LGPD:** termo de consentimento no cadastro e exclusão da conta a pedido do usuário.
