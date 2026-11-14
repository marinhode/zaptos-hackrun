# Zaptos – Roteiro da apresentação

Duração: de 5 a 7 minutos. Ensaie com o cronômetro.

| Tempo | Parte |
| --- | --- |
| 0:00 – 0:30 | Abertura |
| 0:30 – 4:30 | Demonstração |
| 4:30 – 5:30 | Destaques técnicos |
| 5:30 – 6:15 | O que é simulado e a versão 2 |
| 6:15 – 6:30 | Encerramento |

Antes de começar, faça o **checklist** do fim deste documento.

---

## 1. Abertura (30 s)

**Fale:**

- "O Capim Dourado tem lojas físicas, mas nenhuma presença digital integrada."
- "A Ana, 32 anos, pesquisa no celular. Ela chega à loja e o produto acabou. Ou não sabe se o móvel cabe na sala."
- "O Carlos tem uma loja de decoração. Não tem e-commerce nem sistema. Ele quer vender online sem perder o controle do estoque e receber direto, sem intermediário."
- "O Zaptos resolve isso: a Ana reserva online e retira na loja no mesmo dia. O Carlos recebe direto, com a comissão do shopping já descontada."

---

## 2. Demonstração (4 min)

**Preparação:** três janelas do navegador já abertas e logadas. Use perfis separados (janela normal, anônima e outro perfil do Chrome), porque o login fica guardado no navegador.

| Janela | Conta | Endereço |
| --- | --- | --- |
| 1 | Ana (cliente) | `http://localhost:5173` |
| 2 | Carlos (lojista da Casa e Cia) | `http://localhost:5173/#/lojista` |
| 3 | Administrador | `http://localhost:5173/admin.html` |

As contas de teste estão em `backend/db/README.md`.

Na janela 1, deixe a visão de celular ligada (F12 → ícone de celular).

### 2.1 Cliente busca (20 s) – janela 1

**Clique:** na busca do início, digite `poltrona` e confirme.

**Fale:** "A busca procura no nome e na descrição. Dá para filtrar por categoria, preço, piso e só o que está disponível agora."

### 2.2 Produto com galeria e medidas (30 s)

**Clique:** em **Poltrona Lina**.

**Fale:**

- "Fotos de vários ângulos e as medidas: 78 de largura, 72 de altura e 85 de profundidade. A Ana confere se cabe na sala."
- "O botão de reserva só fica ativo se houver estoque. A Poltrona Ripa está esgotada e o botão aparece desligado."

### 2.3 Reservar: relógio de 15 minutos (30 s)

**Clique:** em **Reservar na loja**.

**Fale:**

- "Agora essa unidade está bloqueada só para a Ana. Ninguém consegue reservar nem comprar no balcão."
- Aponte o relógio: "Ela tem 15 minutos para pagar. Se não pagar, a unidade volta sozinha para o estoque."

### 2.4 Pagar (15 s)

**Clique:** escolha **Pix** e clique em **Pagar R$ 1.290,00**.

**Fale:** "Aqui o pagamento é **simulado**: o botão aprova na hora. Na versão final, o PagBank processa e divide o valor."

### 2.5 QR Code (20 s)

**Fale:**

- "A Ana recebe o QR Code de retirada e um código curto, tipo CD-4821-7KQ."
- "O código vale para um pedido só e só pode ser usado uma vez."

**Anote o código curto** que apareceu. Você vai digitá-lo no próximo passo.

### 2.6 Lojista valida e confirma a retirada (40 s) – janela 2

**Clique:** atualize o painel (F5).

**Fale:** "O Carlos vê as reservas do dia, o estoque e quem está vindo retirar. A Poltrona Lina já aparece aguardando retirada."

**Clique:** em **Ler QR Code de retirada**, digite o código e clique em **Validar código**.

**Fale:** "Hoje o lojista digita o código. A leitura pela câmera vem na próxima versão."

**Clique:** em **Confirmar retirada**.

**Fale:** "Pedido retirado. Ele já aparece no histórico da Ana."

### 2.7 Tentar o mesmo código de novo (15 s)

**Clique:** digite o mesmo código e clique em **Validar código**.

**Fale:** "Recusado: o código já foi usado. Ninguém retira o mesmo produto duas vezes."

### 2.8 Lojista cadastra produto com foto (40 s)

**Clique:** volte ao painel e clique em **Cadastrar produto**. Preencha nome, preço, medidas e estoque. Clique em **Cadastrar e adicionar fotos**. Em **Adicionar fotos**, escolha a foto que você deixou pronta.

**Fale:**

- "O Carlos não precisa de sistema nenhum. Ele cadastra pelo celular."
- "O servidor confere se é uma imagem de verdade, reduz o tamanho e converte para WebP com menos de 500 KB."

**Clique:** em **Ver como o cliente vê**.

### 2.9 Administrador (50 s) – janela 3

**Clique:** aba **Resumo** (atualize com F5).

**Fale:** "O shopping vê o dia: valor vendido, a comissão do shopping e o repasse aos lojistas. A venda da Poltrona Lina já aparece."

**Clique:** aba **Usuários**. Busque `passocerto` e clique em **Bloquear**. Confirme na janela que abre.

**Fale:** "O admin bloqueia uma conta e ela perde o acesso na hora, mesmo que esteja logada."

**Clique:** em **Desbloquear** para desfazer.

**Clique:** aba **Categorias**. Mude a comissão de **Calçados** de 10 para 12 e clique em **Salvar**.

**Clique:** aba **Registro**.

**Fale:** "Tudo que o admin muda fica registrado, com o antes e o depois. Esse registro não pode ser alterado nem apagado."

---

## 3. Destaques técnicos (1 min)

Uma frase para cada:

- **Estoque sem venda dupla:** "A reserva trava a linha do estoque no MySQL com `SELECT ... FOR UPDATE`. Temos um teste em que dois clientes disputam a última unidade ao mesmo tempo, e só um consegue."
- **Código de uso único:** "O código de retirada só vale uma vez: a API recusa e o próprio banco tem um gatilho que impede reaproveitar."
- **Divisão do pagamento:** "Cada pagamento grava a parte do lojista e a comissão da categoria, e o banco garante que as duas somam exatamente o total."
- **Fotos:** "As fotos são validadas pelo conteúdo, não pela extensão, e convertidas para WebP com menos de 500 KB."
- **Login:** "Senha guardada com bcrypt e acesso por token; cada perfil só entra na sua área."
- **Pull Request com revisão:** "Nada vai direto para a `main`: cada parte foi feita numa branch própria e entra por Pull Request revisado." Mostre a aba de PRs: `https://github.com/marinhode/zaptos-hackrun/pulls`.

---

## 4. O que é simulado e o que vem na versão 2 (45 s)

**Fale com clareza:**

- "**O pagamento é simulado.** O botão Pagar aprova direto. Ainda não chamamos o PagBank nem recebemos o webhook. A divisão do valor já é calculada e gravada."
- "**Não há leitura do QR pela câmera.** O lojista digita o código."
- "**Não há notificações.** O cliente vê o status quando abre o app."
- "**Mapa e 3D/realidade aumentada** são versões futuras. No app aparecem como 'em breve'."

**Próxima versão:**

- PagBank em sandbox, com split e webhook validado.
- Notificações de pagamento e retirada.
- Leitura do QR Code pela câmera.
- Prazo para retirada e carrinho com várias lojas.

O detalhe de cada requisito está em `docs/STATUS-MVP.md`.

---

## 5. Encerramento (15 s)

**Fale:** "A Ana reserva com garantia e retira hoje. O Carlos vende online sem sistema e recebe direto. O shopping acompanha tudo e fica com a comissão. Obrigado."

---

## Plano B

**Se a API cair durante a apresentação:**

- O app mostra um aviso e passa sozinho para o **modo demonstração**. Continue o roteiro normalmente.
- **Fale:** "O servidor caiu, e o app continua funcionando com dados de demonstração. Isso foi pensado para quem está com internet ruim."
- No modo demonstração não há login: tudo fica liberado.
- **Não funcionam** no modo demonstração: cadastro de produto (passo 2.8) e painel do admin (passo 2.9). Pule esses passos e mostre os testes ou os PRs no GitHub.
- Para recomeçar a demonstração: **Perfil → Restaurar dados de demonstração**.

**Se a internet cair:** o QR Code é desenhado por uma biblioteca baixada da internet. Sem conexão, a tela mostra só o código curto, e o lojista digita normalmente.

**Garantia extra:** grave um vídeo do ensaio completo e deixe aberto num arquivo.

---

## Checklist antes de apresentar

Faça **30 minutos antes**. Os comandos estão em `backend/db/README.md` e `backend/README.md`.

1. [ ] **Docker Desktop** aberto e container do MySQL rodando (`docker ps`).
2. [ ] **Banco limpo:** rode `schema.sql` e depois `seed.sql`. Isso apaga os testes do ensaio e o primeiro pedido volta a ser o 4821.
3. [ ] **`.env` na raiz** preenchido (`DB_*`, `SECRET_KEY`), com `PAGAMENTO_SIMULADO=1` e **`DEMO_AUTH=0`** (o login de verdade fica ligado).
4. [ ] **API rodando:** na pasta `backend`, `uvicorn app.main:app`. Abra `http://localhost:8000/api/health` e confira `"banco": "ok"`.
5. [ ] **Front servido:** na pasta `frontend`, `python -m http.server 5173`. Abra `http://localhost:5173`.
6. [ ] **Logins testados:** entre com as contas de cliente, lojista e administrador. As contas estão em `backend/db/README.md`.
7. [ ] **Três janelas** abertas e logadas (veja a seção 2).
8. [ ] **Foto pronta** para o cadastro de produto: JPG ou PNG, até 8 MB, numa pasta fácil de achar.
9. [ ] **Internet funcionando** (QR Code e GitHub).
10. [ ] **Aba do GitHub** aberta nos Pull Requests.
11. [ ] Notificações do computador desligadas e zoom do navegador em 100% ou mais.
12. [ ] **Ensaio completo** com cronômetro. Depois do ensaio, repita o passo 2.

---

## Perguntas prováveis da banca

**Por que PWA e não app nativo?**
App nativo exige download, e isso reduz a adesão. O PWA abre direto no navegador e pode ser instalado na tela inicial.

**Por que split de pagamento?**
O lojista recebe direto na conta dele, sem esperar repasse do shopping. O shopping não concentra o dinheiro nem a responsabilidade financeira. A comissão sai automaticamente.

**Como vocês evitam vender o mesmo item duas vezes?**
A reserva trava a linha do estoque no banco (`SELECT ... FOR UPDATE`). Duas reservas da última unidade ao mesmo tempo: uma passa, a outra recebe "sem estoque". Temos teste disso. Além disso, o banco não aceita estoque negativo.

**E se o cliente não pagar?**
A reserva vence em 15 minutos e a unidade volta sozinha para o estoque. O pedido fica como "expirado".

**E se o cliente pagar e não aparecer para retirar?**
Ainda não tratamos. O prazo para retirada e o estorno estão na próxima versão (RN002).

**Por que o pagamento é simulado?**
Priorizamos o fluxo completo de reserva e retirada. A integração com o PagBank em sandbox é o próximo passo. O banco já guarda a divisão do valor e tem os campos da conta do lojista.

**Como fica a LGPD?**
Guardamos só o necessário: nome, e-mail e telefone. A senha fica com bcrypt, nunca em texto. Cada perfil vê só os próprios dados: o cliente, os próprios pedidos; o lojista, a própria loja. Os dados do cartão ficam com o PagBank, não conosco. Falta: termo de consentimento e exclusão da conta a pedido.

**Como um webhook falso seria barrado?**
No plano, a API valida o cabeçalho `x-authenticity-token` do PagBank antes de aprovar qualquer pedido. Isso entra junto com a integração do PagBank.

**Isso aguenta muitos usuários?**
O MVP é um monólito modular, simples de manter. Se o volume crescer, separamos em serviços e usamos fila de mensagens e busca dedicada.

**O lojista precisa de sistema próprio?**
Não. O painel funciona no celular: estoque, produtos, fotos e retirada.
