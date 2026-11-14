# Zaptos – Roteiro da apresentação

Duração: de 5 a 7 minutos. O roteiro dá 6min30, com 30 s de folga. Ensaie com o cronômetro.

| Tempo | Parte |
| --- | --- |
| 0:00 – 0:30 | Abertura |
| 0:30 – 4:45 | Demonstração |
| 4:45 – 5:45 | Destaques técnicos |
| 5:45 – 6:15 | O que é simulado e a versão 2 |
| 6:15 – 6:30 | Encerramento |

Antes de começar, faça o **checklist** do fim deste documento.

**Se o tempo apertar no ensaio**, corte nesta ordem: o bloqueio de usuário no admin (2.9), a fala sobre filtros na busca (2.1) e a fala sobre a Poltrona Ripa esgotada (2.2).

---

## 1. Abertura (30 s)

**Fale:**

- "O Capim Dourado tem lojas físicas, mas nenhuma presença digital integrada."
- "A Ana, 32 anos, pesquisa no celular. Ela chega à loja e o produto acabou. Ou não sabe se o móvel cabe na sala."
- "O Carlos tem uma loja de decoração. Não tem e-commerce nem sistema. Ele quer vender online sem perder o controle do estoque e receber direto, sem intermediário."
- "O Zaptos resolve isso: a Ana reserva online e retira na loja no mesmo dia. O Carlos recebe direto, com a comissão do shopping já descontada."

---

## 2. Demonstração (4min15)

**Preparação:** três janelas do navegador já abertas e logadas. Use perfis separados (janela normal, anônima e outro perfil do Chrome), porque o login fica guardado no navegador.

| Janela | Conta | Endereço |
| --- | --- | --- |
| 1 | Ana (cliente) | `http://localhost:5173` |
| 2 | Carlos (lojista da Casa e Cia) | `http://localhost:5173/#/lojista` |
| 3 | Administrador | `http://localhost:5173/admin.html` |

As contas de teste estão em `backend/db/README.md`.

Use sempre `localhost` no endereço, nunca o IP da máquina: a câmera do passo 2.7 só abre em `localhost` ou HTTPS.

Na janela 1, deixe a visão de celular ligada (F12 → ícone de celular). Tenha o **celular** à mão para o passo 2.7.

### 2.1 Cliente busca (15 s) – janela 1

**Clique:** na busca do início, digite `poltrona` e confirme.

**Fale:** "A busca procura no nome e na descrição. Dá para filtrar por categoria, preço, piso e só o que está disponível agora."

### 2.2 Produto com galeria e medidas (25 s)

**Clique:** em **Poltrona Lina**.

**Fale:**

- "Fotos de vários ângulos e as medidas: 78 de largura, 72 de altura e 85 de profundidade. A Ana confere se cabe na sala."
- "O botão de reserva só fica ativo se houver estoque. Um produto esgotado aparece com o botão desligado."

### 2.3 Reservar: relógio de 15 minutos (25 s)

**Clique:** em **Reservar na loja**.

**Fale:**

- "Agora essa unidade está bloqueada só para a Ana. Ninguém consegue reservar nem comprar no balcão."
- Aponte o relógio: "Ela tem 15 minutos para pagar. Se não pagar, a unidade volta sozinha para o estoque e ela recebe um aviso."

### 2.4 Pagar (15 s)

**Clique:** escolha **Pix** e clique em **Pagar R$ 1.290,00**.

**Fale:** "Aqui o pagamento é **simulado**: o botão aprova na hora. Na versão final, o PagBank processa e divide o valor."

### 2.5 Aviso no sino (15 s)

**Mostre:** o sino no topo, com o número **1**.

**Clique:** no sino. Aparece o aviso **Pagamento aprovado**.

**Fale:** "A Ana recebe o aviso dentro do app. O Carlos também: para ele chega 'Nova reserva paga'. O aviso é gravado junto com o pagamento; se um falhar, o outro também é desfeito."

**Clique:** no aviso. Ele abre o comprovante do pedido.

### 2.6 Comprovante e mapa do shopping (30 s)

**Fale:** "No comprovante está o QR Code de retirada e um código curto, tipo CD-4821-7KQ. Vale para este pedido só e só pode ser usado uma vez."

**Anote o código curto.** Ele é o plano B do passo 2.7.

**Clique:** em **Ver no mapa do shopping**.

**Fale:** "A Ana não sabe onde fica a Casa e Cia. O mapa abre no piso certo, com a loja piscando em dourado. Mostra também banheiros, elevador, escada rolante e o atendimento."

**Clique:** em **Voltar** para o comprovante e deixe o QR Code na tela.

### 2.7 Lojista lê o QR Code com a câmera (45 s) – janela 2

**Antes de trocar de janela:** com o celular, tire uma foto do QR Code da janela 1.

**Clique:** na janela 2, atualize o painel (F5).

**Fale:** "O Carlos vê as reservas do dia, o estoque e quem está vindo retirar. A Poltrona Lina já aparece aguardando retirada, e o sino dele acendeu."

**Clique:** em **Ler QR Code de retirada**. A câmera abre. Mostre a foto do celular para a câmera do notebook.

**Fale:** "O lojista só aponta a câmera. O sistema confere o pedido: pago, desta loja e ainda não retirado."

**Plano B:** se a câmera não abrir ou não ler em 5 segundos, clique em **Cancelar e digitar o código**, digite o código curto e clique em **Validar código**. **Fale:** "Sem câmera, o lojista digita o código. Funciona igual."

**Clique:** em **Confirmar retirada**.

**Fale:** "Pedido retirado. A Ana recebe o aviso 'Retirada confirmada', e o pedido vai para o histórico dela."

### 2.8 Lojista cadastra produto com foto (40 s)

**Clique:** volte ao painel e clique em **Cadastrar produto**. Preencha nome, preço, medidas e estoque. Clique em **Cadastrar e adicionar fotos**. Em **Adicionar fotos**, escolha a foto que você deixou pronta.

**Fale:**

- "O Carlos não precisa de sistema nenhum. Ele cadastra pelo celular."
- "O servidor confere se é uma imagem de verdade, reduz o tamanho e converte para WebP com menos de 500 KB."

**Clique:** em **Ver como o cliente vê**.

### 2.9 Administrador (35 s) – janela 3

**Clique:** aba **Resumo** (atualize com F5).

**Fale:** "O shopping vê o dia: valor vendido, a comissão do shopping e o repasse aos lojistas. A venda da Poltrona Lina já aparece."

**Clique:** aba **Usuários**. Busque `passocerto` e clique em **Bloquear**. Confirme na janela que abre. Depois clique em **Desbloquear**.

**Fale:** "O admin bloqueia uma conta e ela perde o acesso na hora, mesmo que esteja logada."

**Clique:** aba **Registro**.

**Fale:** "Tudo que o admin muda fica registrado, com o antes e o depois. Esse registro não pode ser alterado nem apagado."

---

## 3. Destaques técnicos (1 min)

Uma frase para cada:

- **Estoque sem venda dupla:** "A reserva trava a linha do estoque no MySQL com `SELECT ... FOR UPDATE`. Temos um teste em que dois clientes disputam a última unidade ao mesmo tempo, e só um consegue."
- **Código de uso único:** "Se o Carlos ler o mesmo QR de novo, é recusado: a API confere e o próprio banco tem um gatilho que impede reaproveitar."
- **Divisão do pagamento:** "Cada pagamento grava a parte do lojista e a comissão da categoria, e o banco garante que as duas somam exatamente o total."
- **Avisos confiáveis:** "O aviso é gravado na mesma transação do pagamento. Não existe aviso de um pagamento que não aconteceu."
- **Login:** "Senha guardada com bcrypt e acesso por token; cada perfil só entra na sua área."
- **Testes e Pull Request:** "São 55 testes automáticos. Nada vai direto para a `main`: cada parte foi feita numa branch própria e entra por Pull Request revisado." Mostre a aba de PRs: `https://github.com/marinhode/zaptos-hackrun/pulls`.

---

## 4. O que é simulado e o que vem na versão 2 (30 s)

**Fale com clareza:**

- "**O pagamento é simulado.** O botão Pagar aprova direto. Ainda não chamamos o PagBank nem recebemos o webhook. A divisão do valor já é calculada e gravada."
- "**Os avisos são só dentro do app.** Ainda não mandamos push nem e-mail."
- "**3D e realidade aumentada** são versão futura. No app aparecem como 'em breve'."

**Próxima versão:**

- PagBank em sandbox, com split e webhook validado.
- Prazo para retirada e carrinho com várias lojas.

O detalhe de cada requisito está em `docs/STATUS-MVP.md`.

---

## 5. Encerramento (15 s)

**Fale:** "A Ana reserva com garantia, acha a loja no mapa e retira hoje. O Carlos vende online sem sistema e recebe direto. O shopping acompanha tudo e fica com a comissão. Obrigado."

---

## Plano B

**Se a câmera não abrir ou não ler o QR:** digite o código curto anotado no passo 2.6. A câmera só abre em `localhost` ou HTTPS; pelo IP da máquina (`http://192.168...`) a tela já mostra só o campo do código.

**Se a API cair durante a apresentação:**

- O app mostra um aviso e passa sozinho para o **modo demonstração**. Continue o roteiro normalmente.
- **Fale:** "O servidor caiu, e o app continua funcionando com dados de demonstração. Isso foi pensado para quem está com internet ruim."
- No modo demonstração não há login: tudo fica liberado.
- **Não funcionam** no modo demonstração: o sino de avisos (passo 2.5), o cadastro de produto (passo 2.8) e o painel do admin (passo 2.9). Pule esses passos e mostre os testes ou os PRs no GitHub.
- Para recomeçar a demonstração: **Perfil → Restaurar dados de demonstração**.

**Se a internet cair:** o QR Code é desenhado por uma biblioteca baixada da internet. Sem conexão, o comprovante mostra só o código curto, e o lojista digita o código. O leitor da câmera e o mapa são do próprio projeto e funcionam sem internet.

**Garantia extra:** grave um vídeo do ensaio completo e deixe aberto num arquivo.

---

## Checklist antes de apresentar

Faça **30 minutos antes**. Os comandos estão em `backend/db/README.md` e `backend/README.md`.

1. [ ] **Docker Desktop** aberto e container do MySQL rodando (`docker ps`).
2. [ ] **Banco limpo:** rode `schema.sql` e depois `seed.sql`. Isso apaga os pedidos e avisos do ensaio, e o primeiro pedido volta a ser o 4821.
3. [ ] **`.env` na raiz** preenchido (`DB_*`, `SECRET_KEY`), com `PAGAMENTO_SIMULADO=1` e **`DEMO_AUTH=0`** (o login de verdade fica ligado).
4. [ ] **API rodando:** na pasta `backend`, `uvicorn app.main:app`. Abra `http://localhost:8000/api/health` e confira `"banco": "ok"`.
5. [ ] **Front servido:** na pasta `frontend`, `python -m http.server 5173`. Abra **`http://localhost:5173`** (não use o IP da máquina: a câmera exige `localhost` ou HTTPS).
6. [ ] **Logins testados:** entre com as contas de cliente, lojista e administrador. As contas estão em `backend/db/README.md`.
7. [ ] **Três janelas** abertas e logadas (veja a seção 2). O sino da Ana deve estar **sem número** antes de começar.
8. [ ] **Câmera:** na janela 2, abra **Ler QR Code de retirada** uma vez e clique em **Permitir** quando o navegador pedir a câmera. Teste a leitura com um QR qualquer na tela do celular. Feche outros programas que usam a câmera (Teams, Zoom, Meet).
9. [ ] **Celular** carregado e com a câmera funcionando (para fotografar o QR no passo 2.7).
10. [ ] **Foto pronta** para o cadastro de produto: JPG ou PNG, até 8 MB, numa pasta fácil de achar.
11. [ ] **Internet funcionando** (desenho do QR Code e GitHub).
12. [ ] **Aba do GitHub** aberta nos Pull Requests.
13. [ ] Notificações do computador desligadas e zoom do navegador em 100% ou mais.
14. [ ] **Ensaio completo** com cronômetro, até 7 minutos. Depois do ensaio, repita o passo 2 (banco limpo).

---

## Perguntas prováveis da banca

**Por que PWA e não app nativo?**
App nativo exige download, e isso reduz a adesão. O PWA abre direto no navegador e pode ser instalado na tela inicial.

**Por que split de pagamento?**
O lojista recebe direto na conta dele, sem esperar repasse do shopping. O shopping não concentra o dinheiro nem a responsabilidade financeira. A comissão sai automaticamente.

**Como vocês evitam vender o mesmo item duas vezes?**
A reserva trava a linha do estoque no banco (`SELECT ... FOR UPDATE`). Duas reservas da última unidade ao mesmo tempo: uma passa, a outra recebe "sem estoque". Temos teste disso. Além disso, o banco não aceita estoque negativo.

**E se o cliente não pagar?**
A reserva vence em 15 minutos, a unidade volta sozinha para o estoque e o cliente recebe o aviso "Sua reserva expirou". O pedido fica como "expirado".

**E se o cliente pagar e não aparecer para retirar?**
Ainda não tratamos. O prazo para retirada e o estorno estão na próxima versão (RN002).

**Por que o pagamento é simulado?**
Priorizamos o fluxo completo de reserva e retirada. A integração com o PagBank em sandbox é o próximo passo. O banco já guarda a divisão do valor e tem os campos da conta do lojista.

**Como o cliente fica sabendo do pagamento e da retirada?**
Por avisos dentro do app: o sino no topo mostra quantos são novos. O aviso é gravado na mesma transação do pagamento ou da retirada. Cada usuário vê só os próprios avisos (temos teste disso). Push e e-mail ficam para depois.

**E se a câmera do lojista não funcionar?**
Ele digita o código curto que aparece abaixo do QR Code. A validação é a mesma. A câmera usa o leitor do próprio navegador ou, se ele não existir, uma biblioteca que vem junto com o app. O navegador só libera a câmera em HTTPS; em produção o app roda em HTTPS.

**O mapa é a planta real do shopping?**
Ainda não. A planta é desenhada pelo app a partir do piso e do número de cada loja. Com a planta oficial do shopping, trocamos o desenho sem mudar o resto. O mapa também funciona sem ver a imagem: as lojas aparecem numa lista e dá para usar pelo teclado.

**Como fica a LGPD?**
Guardamos só o necessário: nome, e-mail e telefone. A senha fica com bcrypt, nunca em texto. Cada perfil vê só os próprios dados: o cliente, os próprios pedidos e avisos; o lojista, a própria loja. Os dados do cartão ficam com o PagBank, não conosco. Falta: termo de consentimento e exclusão da conta a pedido.

**Como um webhook falso seria barrado?**
No plano, a API valida o cabeçalho `x-authenticity-token` do PagBank antes de aprovar qualquer pedido. Isso entra junto com a integração do PagBank.

**Isso aguenta muitos usuários?**
O MVP é um monólito modular, simples de manter. Se o volume crescer, separamos em serviços e usamos fila de mensagens e busca dedicada.

**O lojista precisa de sistema próprio?**
Não. O painel funciona no celular: estoque, produtos, fotos, avisos e retirada.
