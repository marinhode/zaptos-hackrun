# Publicar o Zaptos com HTTPS (link para o celular e para a banca)

O link é criado por um **túnel da Cloudflare** a partir do computador onde o sistema está rodando. Não precisa de conta. A câmera do celular (leitura do QR Code e, depois, "Ver na sua casa") só funciona em HTTPS, por isso o túnel é necessário.

Limites: o computador precisa ficar **ligado** e com o sistema rodando. O **link muda** cada vez que o túnel é aberto.

## Antes de abrir o link (sempre)

1. **Banco limpo para a demonstração** (apaga pedidos de teste):
   recarregar `backend/db/schema.sql` e `backend/db/seed.sql`, como explicado em `backend/db/README.md`.
2. **Trocar as senhas das contas de teste.** A senha do seed está neste repositório público. Com o link aberto, qualquer pessoa poderia entrar como administrador. Na pasta `backend`:

   ```bash
   .\.venv\Scripts\python.exe scripts\trocar_senhas_demo.py
   ```

   As senhas novas ficam em `contas-demo.local.txt`, na raiz do projeto. O arquivo fica fora do git; **não compartilhe**.

   Recarregar o seed volta a senha antiga. Depois de recarregar, **rode o script de novo**.

## Abrir o link

1. Suba a API **com o atalho de teste desligado** (`DEMO_AUTH=0`). Ela também entrega o site:

   ```bash
   cd backend
   $env:DEMO_AUTH="0"; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

2. Em outro terminal, abra o túnel. O `cloudflared.exe` é o programa oficial da Cloudflare, baixado de https://github.com/cloudflare/cloudflared/releases e guardado em `tools/` (fora do git):

   ```bash
   .\tools\cloudflared.exe tunnel --no-autoupdate --url http://localhost:8000
   ```

3. O terminal mostra um endereço `https://<palavras>.trycloudflare.com`. Esse é o link. Abra no celular.

Para fechar: `Ctrl+C` nos dois terminais.

## O que protege o link público

- **Atalho de teste desligado:** com `DEMO_AUTH=0`, o cabeçalho `X-Usuario-Id` é ignorado.
- **Senhas de teste trocadas** antes de abrir.
- **Limite de login:** 5 senhas erradas em 10 minutos bloqueiam aquele e-mail por um tempo.
- **Cabeçalhos de segurança:**
  - o site não abre dentro de outro site;
  - o navegador não "adivinha" o tipo dos arquivos;
  - câmera liberada só para o próprio Zaptos.
- **Fotos enviadas:** são revalidadas e regravadas pelo servidor.

## Depois da apresentação

Feche o túnel. Para uso contínuo, o próximo passo é uma hospedagem fixa (link que não muda e funciona com o computador desligado).
