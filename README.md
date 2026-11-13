# Zaptos – HACKRUN 2026

Aplicação para integração da jornada de compra digital e física do Capim Dourado Shopping (Desafio 04 – Integração da jornada de compra digital e física).

Centro Universitário Católica do Tocantins – Bacharelado em Engenharia de Software e Tecnólogo em IA.

## Equipe

- Filippe Barbosa Souza Costa
- Késia Vitória Silva Guilherme
- João Victor Marinho de Morais
- Stefani Vitória Teixeira

## Documentação

- [Documentação completa (Word)](docs/Documentacao_Zaptos_Unificada.docx)
- [Documentação completa (PDF)](docs/Documentacao_Zaptos_Unificada.pdf)

## Telas do protótipo

![Telas 1 a 4](docs/telas/telas-01-a-04.png)
![Telas 5 a 8](docs/telas/telas-05-a-08.png)
![Telas 9 e 10](docs/telas/telas-09-e-10.png)

## Stack

- Front-end: HTML, CSS e JavaScript (PWA, com `<model-viewer>` para 3D/AR)
- Back-end: Python (API REST)
- Banco de dados: MySQL
- Pagamentos: PagBank (API de pedidos com divisão de pagamento entre lojista e shopping, sandbox)

## Estrutura do repositório

```
frontend/   PWA (telas do cliente, lojista e admin)
backend/    API Python (catalogo, estoque, pedidos, pagamentos, lojistas, usuarios)
docs/       Documentação e telas do protótipo
```

## Configuração

1. Copie `.env.example` para `.env` e preencha as variáveis (MySQL e PagBank sandbox).
2. Nunca faça commit do `.env` nem de tokens: ele já está no `.gitignore`.

## Prática sorteada: Pull Request com revisão

A branch `main` é protegida. Cada história de usuário é desenvolvida em uma branch própria (ex.: `feature/US2.1.1-reserva`) e entra por Pull Request com pelo menos uma aprovação de outro integrante.
