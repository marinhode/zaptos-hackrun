# Zaptos – Roteiro da apresentação

Duração: de 5 a 7 minutos. O roteiro dá 6min35, com 25 s de folga. Ensaie com o cronômetro.

| Tempo | Parte |
| --- | --- |
| 0:00 – 0:30 | Abertura |
| 0:30 – 4:55 | Demonstração |
| 4:55 – 5:50 | Destaques técnicos |
| 5:50 – 6:20 | O que é simulado e a versão 2 |
| 6:20 – 6:35 | Encerramento |

Antes de começar, faça o **checklist** do fim deste documento.

**Se o tempo apertar no ensaio**, corte nesta ordem: o bloqueio de usuário no admin (2.9), a fala sobre filtros na busca (2.1) e o zoom no mapa (2.6).

---

## 1. Abertura (30 s)

**Fale:**

- "O Capim Dourado tem lojas físicas, mas nenhuma presença digital integrada para reservar e retirar."
- "A Ana, 32 anos, pesquisa no celular. Ela chega à loja e o produto acabou. Ou não sabe se o móvel cabe na sala."
- "O Carlos tem uma loja de decoração. Não tem e-commerce nem sistema. Ele quer vender online sem perder o controle do estoque e receber direto, sem intermediário."
- "O Zaptos resolve isso: a Ana reserva online e retira na loja no mesmo dia. O Carlos recebe direto, com a comissão do shopping já descontada."

---

## 2. Demonstração (4min25)

**Preparação:** tudo aberto pelo **link HTTPS** do túnel (`https://<palavras>.trycloudflare.com`, anotado no checklist) e já logado. No notebook, use perfis separados do navegador (janela normal e anônima), porque o login fica guardado no navegador.

| Onde | Conta | Endereço |
| --- | --- | --- |
| Celular | Ana (cliente) | o link |
| Notebook, janela 2 | Carlos (lojista da Casa e Cia) | o link + `/#/lojista` |
| Notebook, janela 3 | Administrador | o link + `/admin.html` |

As senhas da demonstração estão em `contas-demo.local.txt`. **Nunca abra esse arquivo no projetor.**

**Mostrar o celular:** espelhe a tela do celular no projetor. Se não der, faça a parte da Ana numa janela do notebook, também pelo link, com a visão de celular ligada (F12 → ícone de celular). Nesse caso, no passo 2.7 fotografe o QR com o celular e mostre a foto para a câmera do notebook.

### 2.1 Abrir no celular e buscar (20 s) – celular

**Mostre:** o app aberto no celular pelo link.

**Fale:** "Este é o Zaptos publicado, com HTTPS, aberto no celular. Não precisa instalar nada."

**Toque:** na busca do início, digite `poltrona` e confirme.

**Fale:** "A busca procura no nome e na descrição. Dá para filtrar por categoria, preço, piso e só o que está disponível agora."

### 2.2 Produto com galeria e medidas (25 s)

**Toque:** em **Poltrona Lina**.

**Fale:**

- "Fotos de vários ângulos e as medidas: 78 de largura, 72 de altura e 85 de profundidade. A Ana confere se cabe na sala."
- "O botão de reserva fica sempre à mão, no rodapé, e só funciona se houver estoque."

### 2.3 Reservar: relógio de 15 minutos (25 s)

**Toque:** em **Reservar na loja**.

**Fale:**

- "Agora essa unidade está bloqueada só para a Ana. Ninguém consegue reservar nem comprar no balcão."
- Aponte o relógio: "Ela tem 15 minutos para pagar. Se não pagar, a unidade volta sozinha para o estoque e ela recebe um aviso."

### 2.4 Pagar (15 s)

**Toque:** escolha **Pix** e toque em **Pagar R$ 1.290,00**.

**Fale:** "Aqui o pagamento é **simulado**: o botão aprova na hora. Na versão final, o PagBank processa e divide o valor."

### 2.5 Aviso no sino (15 s)

**Mostre:** o sino no topo, com o número **1**.

**Toque:** no sino. Aparece o aviso **Pagamento aprovado**.

**Fale:** "A Ana recebe o aviso dentro do app. O Carlos também: para ele chega 'Nova reserva paga'."

**Toque:** no aviso. Ele abre o comprovante do pedido.

### 2.6 Comprovante e mapa com a planta real (35 s)

**Fale:** "No comprovante está o QR Code de retirada e um código curto, tipo CD-4821-7KQ. Vale para este pedido só e só pode ser usado uma vez."

**Anote o código curto.** Ele é o plano B do passo 2.7.

**Toque:** em **Ver no mapa do shopping**.

**Fale:** "A Ana não sabe onde fica a Casa e Cia. O mapa usa a planta real do shopping e já abre focado na loja 112, uma vaga real do Piso 1."

**Mostre:** um zoom com dois dedos e arraste a planta. **Fale:** "Ela vê também banheiros, elevador, escadas rolantes e o atendimento."

**Toque:** em **Voltar** e deixe o QR Code na tela.

### 2.7 Lojista lê o QR Code com a câmera (40 s) – notebook, janela 2

**Clique:** atualize o painel do Carlos (F5).

**Fale:** "O Carlos vê as reservas do dia, o estoque e quem está vindo retirar. A Poltrona Lina já aparece aguardando retirada, e o sino dele acendeu."

**Clique:** em **Ler QR Code de retirada**. A câmera abre. Mostre o celular da Ana, com o QR Code, para a câmera do notebook.

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

### 2.9 Administrador (30 s) – notebook, janela 3

**Clique:** aba **Resumo** (atualize com F5).

**Fale:** "O shopping vê o dia: valor vendido, a comissão do shopping e o repasse aos lojistas. A venda da Poltrona Lina já aparece."

**Clique:** aba **Usuários**. Busque `passocerto`, clique em **Bloquear** e confirme. Depois clique em **Desbloquear**.

**Fale:** "O admin bloqueia uma conta e ela perde o acesso na hora."

**Clique:** aba **Registro**. **Fale:** "Tudo que o admin muda fica registrado, com o antes e o depois, sem poder apagar."

---

## 3. Destaques técnicos (55 s)

Uma frase para cada:

- **Estoque sem venda dupla:** "A reserva trava a linha do estoque no MySQL com `SELECT ... FOR UPDATE`. Temos um teste em que dois clientes disputam a última unidade ao mesmo tempo, e só um consegue."
- **Código de uso único:** "Se o Carlos ler o mesmo QR de novo, é recusado: a API confere e o próprio banco tem um gatilho que impede reaproveitar."
- **Divisão do pagamento:** "Cada pagamento grava a parte do lojista e a comissão da categoria, e o banco garante que as duas somam exatamente o total."
- **Link público protegido:** "Publicamos com HTTPS. Senhas com bcrypt, 5 tentativas de login erradas bloqueiam por um tempo, as senhas de teste são trocadas antes de abrir o link e o atalho de teste fica desligado."
- **Testes e Pull Request:** "São mais de 50 testes automáticos. Nada vai direto para a `main`: cada parte foi feita numa branch própria e entra por Pull Request revisado." Mostre a aba de PRs: `https://github.com/marinhode/zaptos-hackrun/pulls`.

---

## 4. O que é simulado e o que vem na versão 2 (30 s)

**Fale com clareza:**

- "**O pagamento é simulado.** O botão Pagar aprova direto. Ainda não chamamos o PagBank nem recebemos o webhook. A divisão do valor já é calculada e gravada."
- "**O link de hoje sai do nosso computador** por um túnel. Depois vem uma hospedagem fixa."
- "**Os avisos são só dentro do app**, e **3D e realidade aumentada** são versão futura."

**Próxima versão:** PagBank em sandbox com split e webhook validado; hospedagem fixa; prazo para retirada e carrinho com várias lojas.

O detalhe de cada requisito está em `docs/STATUS-MVP.md`.

---

## 5. Encerramento (15 s)

**Fale:** "A Ana reserva com garantia, acha a loja no mapa e retira hoje. O Carlos vende online sem sistema e recebe direto. O shopping acompanha tudo e fica com a comissão. Obrigado."

---

## Plano B

**Se a câmera não abrir ou não ler o QR:** digite o código curto anotado no passo 2.6.

**Se o link cair** (túnel fechou ou a internet caiu): continue no notebook pelo endereço `http://localhost:8000`, que é a mesma API servindo o site. A câmera funciona em `localhost`. O celular fica de fora: faça a parte da Ana numa janela do notebook com a visão de celular e, no passo 2.7, use o código digitado.

**Se a API cair durante a apresentação:**

- O app mostra um aviso e passa sozinho para o **modo demonstração**. Continue o roteiro normalmente.
- **Fale:** "O servidor caiu, e o app continua funcionando com dados de demonstração. Isso foi pensado para quem está com internet ruim."
- No modo demonstração não há login: tudo fica liberado.
- **Não funcionam** no modo demonstração: o sino de avisos (passo 2.5), o cadastro de produto (passo 2.8) e o painel do admin (passo 2.9). Pule esses passos e mostre os testes ou os PRs no GitHub.
- Para recomeçar a demonstração: **Perfil → Restaurar dados de demonstração**.

**Se a internet cair:** além do link, o desenho do QR Code depende de uma biblioteca baixada da internet. Sem conexão, o comprovante mostra só o código curto, e o lojista digita o código.

**Garantia extra:** grave um vídeo do ensaio completo e deixe aberto num arquivo.

---

## Checklist antes de apresentar

Faça **30 minutos antes**. O passo a passo da publicação está em `docs/PUBLICAR.md`.

1. [ ] **Docker Desktop** aberto e MySQL rodando (`docker ps`).
2. [ ] **`.env` na raiz** preenchido (`DB_*`, `SECRET_KEY`), com `PAGAMENTO_SIMULADO=1` e **`DEMO_AUTH=0`**.
3. [ ] **Recarregar o banco:** `schema.sql` e depois `seed.sql`. Apaga os pedidos e avisos do ensaio, e o primeiro pedido volta a ser o 4821.
4. [ ] **Trocar as senhas**, sempre **depois** do passo 3 (recarregar o seed volta a senha antiga): na pasta `backend`, rode `scripts\trocar_senhas_demo.py`. As senhas novas ficam em `contas-demo.local.txt`. Não compartilhe nem projete esse arquivo.
5. [ ] **API rodando** com `DEMO_AUTH=0` (comando em `docs/PUBLICAR.md`). Abra `http://localhost:8000/api/health` e confira `"banco": "ok"`.
6. [ ] **Abrir o túnel** (`cloudflared`) e **anotar o link** `https://...trycloudflare.com` num papel ou no celular. O link muda cada vez que o túnel abre.
7. [ ] **Testar o link no celular:** abrir, entrar como Ana e ver a busca. Se possível, deixe o celular no Wi-Fi do local, não só nos dados móveis.
8. [ ] **Notebook:** janela 2 (Carlos) e janela 3 (admin) abertas pelo link e logadas.
9. [ ] **Câmera do notebook:** na janela 2, abra **Ler QR Code de retirada** uma vez e clique em **Permitir**. Feche outros programas que usam a câmera (Teams, Zoom, Meet).
10. [ ] **Espelhamento** do celular no projetor testado (ou decida usar a janela da Ana no notebook).
11. [ ] **Foto pronta** para o cadastro de produto: JPG ou PNG, até 8 MB, numa pasta fácil de achar.
12. [ ] **Aba do GitHub** aberta nos Pull Requests.
13. [ ] Notificações do computador e do celular desligadas; zoom do navegador em 100% ou mais.
14. [ ] **Ensaio completo** com cronômetro, até 7 minutos. Depois do ensaio, repita os passos **3 e 4, nessa ordem**, e confira se o link continua o mesmo.

---

## Perguntas prováveis da banca

**O shopping já tem um aplicativo. Qual a diferença?**
O Zaptos foca na dor da Ana: reservar com estoque garantido e retirar na loja com QR Code no mesmo dia. E o pagamento é dividido direto para o lojista, com a comissão do shopping já descontada.

**Vocês usaram a planta real?**
Sim. O mapa usa a planta mix oficial do shopping, e as lojas de exemplo ocupam vagas reais (lojas 112, 130 e 204).

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

**O link está aberto na internet. E a segurança?**
Só HTTPS. As senhas de teste do repositório são trocadas antes de abrir o link, o atalho de teste fica desligado, 5 tentativas de login erradas bloqueiam aquele e-mail por um tempo, e o site não pode ser aberto dentro de outro site. O link é temporário: depois vem uma hospedagem fixa.

**Como o cliente fica sabendo do pagamento e da retirada?**
Por avisos dentro do app: o sino no topo mostra quantos são novos. O aviso é gravado na mesma transação do pagamento ou da retirada. Cada usuário vê só os próprios avisos (temos teste disso). Push e e-mail ficam para depois.

**E se a câmera do lojista não funcionar?**
Ele digita o código curto que aparece abaixo do QR Code. A validação é a mesma. A câmera usa o leitor do próprio navegador ou, se ele não existir, uma biblioteca que vem junto com o app.

**Como fica a LGPD?**
Guardamos só o necessário: nome, e-mail e telefone. A senha fica com bcrypt, nunca em texto. Cada perfil vê só os próprios dados: o cliente, os próprios pedidos e avisos; o lojista, a própria loja. Os dados do cartão ficam com o PagBank, não conosco. Falta: termo de consentimento e exclusão da conta a pedido.

**Como um webhook falso seria barrado?**
No plano, a API valida o cabeçalho `x-authenticity-token` do PagBank antes de aprovar qualquer pedido. Isso entra junto com a integração do PagBank.

**Isso aguenta muitos usuários?**
O MVP é um monólito modular, simples de manter. Se o volume crescer, separamos em serviços e usamos fila de mensagens e busca dedicada.

**O lojista precisa de sistema próprio?**
Não. O painel funciona no celular: estoque, produtos, fotos, avisos e retirada.
