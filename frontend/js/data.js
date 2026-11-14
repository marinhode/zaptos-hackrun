// Dados de exemplo usados enquanto a API Python não está pronta.
// Lojas e produtos seguem o protótipo (docs/telas).
window.ZAPTOS_DADOS = {
  cliente: { id: 1, nome: 'Ana', sobrenome: 'Souza', email: 'ana@exemplo.com' },

  categorias: [
    { id: 1, nome: 'Decoração' },
    { id: 2, nome: 'Moda' },
    { id: 3, nome: 'Eletrônicos' },
    { id: 4, nome: 'Calçados' },
  ],

  lojas: [
    { id: 1, nome: 'Casa e Cia', categoriaId: 1, segmento: 'Decoração', piso: 1, numero: '112', horario: 'Seg. a sáb., 10h às 22h', fechaAs: '22h' },
    { id: 2, nome: 'Lar & Estilo', categoriaId: 1, segmento: 'Móveis', piso: 2, numero: '204', horario: 'Seg. a sáb., 10h às 22h', fechaAs: '22h' },
    { id: 3, nome: 'Passo Certo', categoriaId: 4, segmento: 'Calçados', piso: 1, numero: '130', horario: 'Seg. a sáb., 10h às 22h', fechaAs: '22h' },
  ],

  // medidas em centímetros; imagens: URLs reais quando a API existir
  produtos: [
    {
      id: 1, lojaId: 1, nome: 'Poltrona Lina', preco: 1290, icone: 'poltrona', estoque: 3,
      medidas: { largura: 78, altura: 72, profundidade: 85 },
      avaliacao: 4.8, comprasVerificadas: 12, imagens: [],
      descricao: 'Poltrona estofada em linho com pés de madeira maciça. Disponível em verde-musgo e terracota.',
    },
    {
      id: 2, lojaId: 2, nome: 'Poltrona Oslo', preco: 1450, icone: 'poltrona', estoque: 1,
      medidas: { largura: 80, altura: 76, profundidade: 82 },
      avaliacao: 4.6, comprasVerificadas: 7, imagens: [],
      descricao: 'Linhas retas inspiradas no design escandinavo, assento com espuma de alta densidade.',
    },
    {
      id: 3, lojaId: 1, nome: 'Poltrona Ripa', preco: 990, icone: 'poltrona', estoque: 0,
      medidas: { largura: 70, altura: 74, profundidade: 78 },
      avaliacao: 4.5, comprasVerificadas: 9, imagens: [],
      descricao: 'Estrutura em ripas de madeira e almofadas removíveis.',
    },
    {
      id: 4, lojaId: 1, nome: 'Mesa Tora', preco: 2100, icone: 'mesa', estoque: 5,
      medidas: { largura: 160, altura: 76, profundidade: 90 },
      avaliacao: 4.9, comprasVerificadas: 5, imagens: [],
      descricao: 'Mesa de jantar para 6 lugares em madeira de reflorestamento.',
    },
    {
      id: 5, lojaId: 2, nome: 'Luminária Arco', preco: 420, icone: 'luminaria', estoque: 4,
      medidas: { largura: 40, altura: 190, profundidade: 120 },
      avaliacao: 4.7, comprasVerificadas: 15, imagens: [],
      descricao: 'Luminária de piso com haste curva e cúpula em metal.',
    },
    {
      id: 6, lojaId: 3, nome: 'Tênis Run', preco: 380, icone: 'tenis', estoque: 6,
      medidas: null,
      avaliacao: 4.4, comprasVerificadas: 21, imagens: [],
      descricao: 'Tênis de corrida leve, numeração do 34 ao 44.',
    },
  ],

  // histórico inicial da cliente de exemplo
  pedidos: [
    { id: 4790, clienteId: 1, produtoId: 5, lojaId: 2, valor: 420, status: 'retirado', codigo: 'CD-4790-2HM', criadoEm: '2026-11-02T15:20:00', pagoEm: '2026-11-02T15:22:00', retiradoEm: '2026-11-02T18:40:00' },
    { id: 4712, clienteId: 1, produtoId: 6, lojaId: 3, valor: 380, status: 'expirado', codigo: null, criadoEm: '2026-10-20T18:05:00' },
  ],
};
