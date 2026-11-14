// Configuração do front-end.
//   modo 'api'  -> usa a API Python (backend). Se ela estiver fora do ar,
//                  o app passa sozinho para o modo de demonstração.
//   modo 'demo' -> usa só os dados simulados deste navegador (js/api.js).
//
// Endereço da API:
//   - front servido pela própria API (link publicado, ou http://localhost:8000):
//     usa o mesmo endereço da página + /api;
//   - front servido à parte na porta 5173 (Live Server, nginx do docker-compose):
//     usa a API em http://localhost:8000/api.
(function () {
  const separado = location.port === '5173' || location.protocol === 'file:';
  // Vercel (e outras hospedagens só de site) não têm a API Python: usa a demonstração.
  const soSite = /vercel\.app$|netlify\.app$|github\.io$/.test(location.hostname);
  window.ZAPTOS_CONFIG = {
    modo: soSite ? 'demo' : 'api',
    apiUrl: separado ? 'http://localhost:8000/api' : `${location.origin}/api`,
  };
})();
