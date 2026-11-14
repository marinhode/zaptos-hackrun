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
js/data.js            dados de exemplo (lojas, produtos, pedidos)
js/api.js             camada de dados: hoje simulada, depois chama a API Python
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

## Dados simulados

Enquanto a API não existe, `js/api.js` guarda tudo no `localStorage` do navegador e já aplica as regras de negócio:

- **Estoque:** só reserva com estoque disponível (RN001).
- **Prazo da reserva:** a unidade fica bloqueada por 15 minutos e volta ao estoque se não for paga (RN010).
- **Código de retirada:** só vale para pedido pago e só pode ser usado uma vez (RN003).
- **Permissão do lojista:** ele só mexe nos produtos e pedidos da própria loja (RN004).

Cada função do `api.js` indica a rota equivalente da API (ex.: `POST /orders/checkout-reserve`). Para ligar no back-end, troque o corpo das funções por `fetch()` mantendo o mesmo formato de retorno; as telas não precisam mudar.

Para recomeçar a demonstração: **Perfil → Restaurar dados de demonstração**.

## Ainda não incluído

- Pagamento real pelo PagBank: hoje o botão "Pagar" aprova direto.
- Leitura do QR Code pela câmera: hoje o lojista digita o código.
- Login, cadastro de produtos e mapa do shopping: aparecem como "em breve".
- 3D/AR: evolução futura, conforme a documentação.
