// Comprovante de pagamento do pedido (visual de recibo, pronto para imprimir/PDF).
//
// Contrato com o app:
//   ZaptosComprovante.html(ped) -> string
//   ped = { id, valor, pagoEm (ISO), metodo ('pix'|'cartao'|undefined), codigo,
//           loja: { nome, piso, numero }, produto: { nome }, cliente: { nome } | undefined }
//
// O app desenha o QR Code dentro de [data-qr] e liga o botão [data-imprimir].
// Todo texto vindo de ped é escapado.

(() => {
  'use strict';

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const doisDig = (n) => String(n).padStart(2, '0');

  function fmtValor(v) {
    const n = Number(v);
    return Number.isFinite(n) ? moeda.format(n) : '—';
  }

  /** dd/mm/aaaa · hh:mm no horário de Palmas/TO. */
  function fmtData(iso) {
    const d = iso ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) return '—';
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Araguaina', day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(d).map((x) => [x.type, x.value]));
      return `${p.day}/${p.month}/${p.year} · ${p.hour}:${p.minute}`;
    } catch (_) {
      return `${doisDig(d.getDate())}/${doisDig(d.getMonth() + 1)}/${d.getFullYear()} · ${doisDig(d.getHours())}:${doisDig(d.getMinutes())}`;
    }
  }

  const METODOS = { pix: 'Pix', cartao: 'Cartão de crédito' };

  const linha = (rotulo, valor, classe = '') =>
    `<div class="recibo__linha${classe ? ` ${classe}` : ''}"><dt>${rotulo}</dt><dd>${valor}</dd></div>`;

  function html(ped) {
    const p = ped || {};
    const loja = p.loja || {};
    const onde = [loja.piso ? `Piso ${esc(loja.piso)}` : '', loja.numero ? `loja ${esc(loja.numero)}` : '']
      .filter(Boolean).join(', ');
    const valor = esc(fmtValor(p.valor));
    const metodo = METODOS[p.metodo] || '—';

    return `
      <article class="recibo" aria-labelledby="recibo-titulo">
        <header class="recibo__marca">
          <span class="recibo__logo" aria-hidden="true">Z</span>
          <span class="recibo__nome">Zaptos</span>
        </header>
        <p class="recibo__shopping">Capim Dourado Shopping</p>

        <div class="recibo__status">
          <span class="recibo__check" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <h2 id="recibo-titulo">Pagamento aprovado</h2>
          <p class="recibo__valor">${valor}</p>
          <p class="recibo__data">${esc(fmtData(p.pagoEm))}</p>
        </div>

        <dl class="recibo__dados">
          ${linha('Pedido', esc(p.id))}
          ${p.cliente && p.cliente.nome ? linha('Cliente', esc(p.cliente.nome)) : ''}
          ${linha('Loja', `${esc(loja.nome)}${onde ? `<span class="recibo__sub">${onde}</span>` : ''}`)}
          ${linha('Produto', esc(p.produto && p.produto.nome))}
          ${linha('Quantidade', '1 unidade')}
        </dl>

        <dl class="recibo__dados">
          ${linha('Pagamento', esc(metodo))}
          ${linha('Processador', 'PagBank (simulado)')}
          ${linha('ID da transação', `SIM-${esc(p.id)}`)}
          ${linha('Total', valor, 'recibo__linha--total')}
        </dl>

        <section class="recibo__retirada" aria-labelledby="recibo-retirada">
          <h3 id="recibo-retirada">Código de retirada</h3>
          <div class="qr" data-qr></div>
          <p class="codigo">${esc(p.codigo)}</p>
          <p class="recibo__nota">Mostre o QR Code ou o código no balcão${loja.nome ? ` da ${esc(loja.nome)}` : ''} para retirar.</p>
        </section>

        <p class="recibo__aviso">Demonstração acadêmica — pagamento simulado, sem validade financeira.</p>
      </article>

      <button class="btn btn--contorno btn--bloco recibo__imprimir" type="button" data-imprimir>Imprimir / salvar PDF</button>`;
  }

  window.ZaptosComprovante = { html };
})();
