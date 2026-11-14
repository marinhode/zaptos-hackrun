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
| `#/lojista/validar` | Validar o código do cliente e confirmar a retirada |
| `#/entrar` | Entrar (cliente ou lojista) |
| `#/cadastro` | Criar conta de cliente |

## Login

- Reserva, pedidos e comprovante exigem login de **cliente**; o painel exige login de **lojista**. Sem login, o app leva para "Entrar" e, depois, volta para a tela onde a pessoa estava.
- Com o perfil errado (ex.: cliente abrindo o painel), aparece "Área restrita" com a opção de entrar com outra conta.
- O token fica no `localStorage` (`zaptos-token`) e vai em `Authorization: Bearer`. Quando vence, o app pede para entrar de novo.
- Administrador: depois de entrar, vai para `admin.html`.
- No modo demonstração não há login: tudo fica liberado.

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
- Leitura do QR Code pela câmera: hoje o lojista digita o código.
- Cadastro de produtos e mapa do shopping: aparecem como "em breve".
- Recuperar senha.
- 3D/AR: evolução futura, conforme a documentação.
