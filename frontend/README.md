# Front-end do Zaptos

PWA em HTML, CSS e JavaScript puro, sem build e sem dependências. Visual baseado nas telas do protótipo (`docs/telas`).

## Como rodar

O app precisa ser servido por HTTP (o service worker não funciona abrindo o arquivo direto).

- **VS Code:** instale a extensão *Live Server*, clique com o botão direito em `frontend/index.html` → *Open with Live Server*.
- **Python:** dentro da pasta `frontend`, rode `python -m http.server 5173` e abra http://localhost:5173.

Para ver como no celular: no Chrome, F12 → ícone de celular (Toggle device toolbar).

## Estrutura

```
index.html            casca do app: cabeçalho, área de conteúdo e menu inferior
manifest.webmanifest  dados para instalar como app (PWA)
sw.js                 service worker: guarda os arquivos para abrir sem internet
css/styles.css        estilos (cores do protótipo em variáveis no :root)
js/config.js          modo (API ou demonstração) e endereço da API
js/data.js            dados de exemplo (lojas, produtos, pedidos)
js/api.js             camada de dados simulada (modo demonstração)
js/api-remota.js      camada de dados que chama a API Python
js/app.js             telas e navegação (rotas por hash: #/buscar, #/produto/1 …)
js/leitor-qr.js       leitura do QR Code pela câmera (tela do lojista)
js/vendor/jsQR.js     biblioteca jsQR 1.4.0 (Apache-2.0), usada quando o navegador não lê QR sozinho
img/                  ícone do app e imagem padrão de produto
```

## Telas

| Rota | Tela |
| --- | --- |
| `#/` | Início: busca, destaque, categorias, produtos disponíveis e lojas |
| `#/buscar` | Busca com filtros (disponível agora, categoria, preço, piso) |
| `#/loja/:id` | Vitrine da loja |
| `#/produto/:id` | Produto: galeria de imagens, medidas e "Reservar na loja" |
| `#/reservar/:id` | Reserva com contagem de 15 minutos e pagamento (simulado) |
| `#/pedido/:id` | Comprovante com QR Code de retirada |
| `#/pedidos` | Meus pedidos (todos, a retirar, retirados) |
| `#/ajuda` | Perguntas frequentes |
| `#/perfil` | Perfil e acesso à área do lojista |
| `#/lojista` | Painel do lojista: reservas, estoque e retiradas pendentes |
| `#/lojista/validar` | Ler o QR Code com a câmera (ou digitar o código) e confirmar a retirada |
| `#/lojista/produto/novo` | Cadastrar produto (nome, descrição, preço, medidas, estoque) |
| `#/lojista/produto/:id` | Editar produto, tirar do app e gerenciar as fotos |
| `#/avisos` | Avisos de pagamento, retirada e reserva expirada (sino no cabeçalho com o número de não lidos) |
| `#/mapa?loja=:id` | Mapa do shopping com a loja em destaque. O desenho fica em `js/mapa.js` (`window.ZaptosMapa`), carregado só nessa tela; sem ele, mostra "Mapa em breve" com a localização da loja |
| `#/entrar` | Entrar (cliente ou lojista) |
| `#/cadastro` | Criar conta de cliente |

## Login

- Reserva, pedidos e comprovante exigem login de **cliente**; o painel exige login de **lojista**. Sem login, o app leva para "Entrar" e, depois, volta para a tela onde a pessoa estava.
- Com o perfil errado (ex.: cliente abrindo o painel), aparece "Área restrita" com a opção de entrar com outra conta.
- O token fica no `localStorage` (`zaptos-token`) e vai em `Authorization: Bearer`. Quando vence, o app pede para entrar de novo.
- Administrador: depois de entrar, vai para `admin.html`.
- No modo demonstração não há login: tudo fica liberado.

## Mapa com a planta real

O mapa usa a **Planta Mix oficial** do shopping. Ela é um documento interno, por isso as imagens **não ficam no repositório**: cada pessoa gera na própria máquina a partir do PDF.

```bash
pip install pymupdf pillow
python scripts/gerar_mapa.py "C:/caminho/2026_11_CDS_MIX.pdf"
```

O script gera `frontend/img/mapa/piso-1.webp`, `piso-2.webp` e `frontend/data/mapa-planta.json`.

- **Posições:** vêm dos rótulos "LOJA 112", "LOJA 204"… do próprio PDF, sem marcar nada à mão.
- **Lojas do app:** aparecem pelo número da loja no banco (Casa e Cia = 112, Passo Certo = 130, Lar & Estilo = 204). Elas ocupam vagas reais da planta.
- **Sem esses arquivos:** o mapa volta para o desenho esquemático.

## Leitura do QR Code pela câmera

- No painel, "Ler QR Code de retirada" já abre a câmera traseira. Basta apontar para o QR Code do cliente: o app lê, fecha a câmera e mostra o pedido para confirmar a retirada.
- O navegador usa o leitor nativo (`BarcodeDetector`) quando existe, como no Android e no macOS. Nos outros, usa a jsQR, que só é carregada quando a câmera abre.
- O QR Code carrega o código longo (UUID) do pedido, e o código curto continua servindo para digitar. A API aceita os dois e recusa código já usado.
- **A câmera só funciona em HTTPS ou em `localhost`.** Para testar no celular pela rede local (`http://192.168...`), o navegador bloqueia a câmera. Nesse caso use o código digitado ou publique o app com HTTPS.
- Sem permissão ou sem câmera, aparece uma mensagem e o lojista digita o código.

## De onde vêm os dados

`js/config.js` escolhe o modo:

- **`modo: 'api'`** (padrão): usa a API Python em `apiUrl` (`http://localhost:8000/api`). Veja `backend/README.md` para subir a API.
- **`modo: 'demo'`**: usa só os dados simulados deste navegador.

Se o modo for `api` e o servidor estiver fora do ar, o app mostra um aviso e passa sozinho para a demonstração. Isso serve de plano B na apresentação.

`js/api-remota.js` chama a API e converte as respostas para o formato que as telas usam. `js/api.js` é a simulação, com as mesmas funções.

## Dados simulados

No modo demonstração, `js/api.js` guarda tudo no `localStorage` do navegador e já aplica as regras de negócio:

- **Estoque:** só reserva com estoque disponível (RN001).
- **Prazo da reserva:** a unidade fica bloqueada por 15 minutos e volta ao estoque se não for paga (RN010).
- **Código de retirada:** só vale para pedido pago e só pode ser usado uma vez (RN003).
- **Permissão do lojista:** ele só mexe nos produtos e pedidos da própria loja (RN004).

Para recomeçar a demonstração: **Perfil → Restaurar dados de demonstração** (só aparece no modo demonstração).

## Ainda não incluído

- Pagamento real pelo PagBank: hoje o botão "Pagar" aprova direto.
- Cadastro de produtos no modo demonstração: só funciona com a API.
- Recuperar senha.
- 3D/AR: evolução futura, conforme a documentação.
