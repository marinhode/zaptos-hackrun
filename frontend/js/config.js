// Configuração do front-end.
//   modo 'api'  -> usa a API Python (backend). Se ela estiver fora do ar,
//                  o app passa sozinho para o modo de demonstração.
//   modo 'demo' -> usa só os dados simulados deste navegador (js/api.js).
window.ZAPTOS_CONFIG = {
  modo: 'api',
  apiUrl: 'http://localhost:8000/api',
};
