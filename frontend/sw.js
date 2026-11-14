// Service worker do Zaptos.
// Estratégia "rede primeiro": sempre tenta buscar a versão mais nova e
// usa o cache só quando o aparelho estiver sem internet.

const CACHE = 'zaptos-v12';
const ARQUIVOS = [
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/data.js',
  './js/api.js',
  './js/api-remota.js',
  './js/leitor-qr.js',
  './js/ver-em-casa.js',
  './js/vendor/jsQR.js',
  './js/app.js',
  './manifest.webmanifest',
  './img/icon.svg',
  './img/produto-padrao.svg',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Não guarda chamadas da API nem arquivos de outros domínios.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  evento.respondWith(
    fetch(req)
      .then((resposta) => {
        const copia = resposta.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copia));
        return resposta;
      })
      // sem internet: ignora o "?v=..." para achar o arquivo guardado na instalação
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
