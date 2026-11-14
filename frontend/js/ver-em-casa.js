// "Ver na sua casa" (RF013, versão com imagem plana): abre a câmera traseira e
// coloca a imagem do produto por cima. O cliente arrasta, aumenta/diminui (pinça
// ou barra) e tira uma foto da sala com o produto. Sem câmera, pode escolher uma
// foto da sala na galeria. O tamanho é ajustado pela pessoa, usando as medidas
// reais como referência (sem 3D o celular não sabe a distância até o chão).
(function () {
  'use strict';

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cameraDisponivel = () => !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  // produto: { nome, imagem (URL ou null), svg (desenho, quando não há foto), medidas }
  function abrir(produto) {
    const anterior = document.activeElement;
    const m = produto.medidas;
    const tela = document.createElement('div');
    tela.className = 'casa';
    tela.setAttribute('role', 'dialog');
    tela.setAttribute('aria-modal', 'true');
    tela.setAttribute('aria-label', `Ver ${produto.nome} na sua casa`);
    tela.innerHTML = `
      <div class="casa__palco" data-palco>
        <video class="casa__fundo" playsinline muted autoplay hidden></video>
        <img class="casa__fundo" data-foto-sala alt="" hidden>
        <div class="casa__vazio" data-vazio>
          <p>Aponte a câmera para o lugar onde o produto vai ficar</p>
        </div>
        <div class="casa__produto" data-produto tabindex="0"
             aria-label="${esc(produto.nome)}. Arraste para posicionar; use a barra para o tamanho.">
          ${produto.imagem ? `<img src="${esc(produto.imagem)}" alt="" draggable="false">` : produto.svg}
        </div>
      </div>
      <div class="casa__topo">
        <button type="button" class="casa__botao" data-fechar aria-label="Fechar">✕</button>
        <div class="casa__titulo">
          <strong>${esc(produto.nome)}</strong>
          ${m ? `<span>${m.largura} × ${m.altura} × ${m.profundidade} cm (L × A × P)</span>` : ''}
        </div>
      </div>
      <div class="casa__rodape">
        <p class="casa__dica" data-dica aria-live="polite">Arraste o produto e ajuste o tamanho</p>
        <label class="casa__tamanho">
          <span class="sr-only">Tamanho do produto</span>
          <span aria-hidden="true">−</span>
          <input type="range" min="15" max="95" value="45" data-tamanho>
          <span aria-hidden="true">+</span>
        </label>
        <div class="casa__acoes">
          <label class="btn btn--contorno casa__galeria">
            Foto da sala
            <input type="file" accept="image/*" data-galeria>
          </label>
          <button type="button" class="btn btn--destaque" data-foto>Tirar foto</button>
        </div>
        <a class="casa__salvar" data-salvar hidden>Baixar a foto</a>
      </div>`;
    document.body.appendChild(tela);
    document.body.classList.add('leitor-aberto');

    const palco = tela.querySelector('[data-palco]');
    const video = tela.querySelector('video');
    const fotoSala = tela.querySelector('[data-foto-sala]');
    const vazio = tela.querySelector('[data-vazio]');
    const item = tela.querySelector('[data-produto]');
    const tamanho = tela.querySelector('[data-tamanho]');
    const dica = tela.querySelector('[data-dica]');
    const salvar = tela.querySelector('[data-salvar]');
    let fluxo = null;

    // posição do produto: centro em % do palco; largura em % da largura do palco
    const estado = { x: 50, y: 62, largura: 45 };
    function aplicar() {
      item.style.left = `${estado.x}%`;
      item.style.top = `${estado.y}%`;
      item.style.width = `${estado.largura}%`;
      tamanho.value = String(Math.round(estado.largura));
    }
    aplicar();

    function fechar() {
      if (fluxo) fluxo.getTracks().forEach((t) => t.stop()); // desliga a câmera
      document.removeEventListener('keydown', teclas);
      tela.remove();
      document.body.classList.remove('leitor-aberto');
      if (anterior && anterior.focus) anterior.focus();
    }
    function teclas(e) {
      if (e.key === 'Escape') fechar();
      if (document.activeElement === item) {
        const passo = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[e.key];
        if (passo) { e.preventDefault(); estado.x += passo[0]; estado.y += passo[1]; aplicar(); }
      }
    }
    document.addEventListener('keydown', teclas);
    tela.querySelector('[data-fechar]').addEventListener('click', fechar);

    // --- arrastar e pinça ---
    const ponteiros = new Map();
    let pinca = null;
    item.addEventListener('pointerdown', (e) => {
      item.setPointerCapture(e.pointerId);
      ponteiros.set(e.pointerId, [e.clientX, e.clientY]);
      if (ponteiros.size === 2) {
        const [a, b] = [...ponteiros.values()];
        pinca = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), largura: estado.largura };
      }
    });
    item.addEventListener('pointermove', (e) => {
      if (!ponteiros.has(e.pointerId)) return;
      const antes = ponteiros.get(e.pointerId);
      ponteiros.set(e.pointerId, [e.clientX, e.clientY]);
      const caixa = palco.getBoundingClientRect();
      if (ponteiros.size === 1) {
        estado.x = Math.min(100, Math.max(0, estado.x + ((e.clientX - antes[0]) / caixa.width) * 100));
        estado.y = Math.min(100, Math.max(0, estado.y + ((e.clientY - antes[1]) / caixa.height) * 100));
      } else if (pinca) {
        const [a, b] = [...ponteiros.values()];
        estado.largura = Math.min(95, Math.max(15, pinca.largura * (Math.hypot(a[0] - b[0], a[1] - b[1]) / pinca.dist)));
      }
      aplicar();
    });
    const soltar = (e) => { ponteiros.delete(e.pointerId); if (ponteiros.size < 2) pinca = null; };
    item.addEventListener('pointerup', soltar);
    item.addEventListener('pointercancel', soltar);
    tamanho.addEventListener('input', () => { estado.largura = Number(tamanho.value); aplicar(); });

    // --- fundo: câmera ou foto da sala ---
    function usarFoto(arquivo) {
      if (fluxo) { fluxo.getTracks().forEach((t) => t.stop()); fluxo = null; }
      video.hidden = true;
      fotoSala.src = URL.createObjectURL(arquivo);
      fotoSala.hidden = false;
      vazio.hidden = true;
      dica.textContent = 'Arraste o produto para o lugar dele na foto';
    }
    tela.querySelector('[data-galeria]').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) usarFoto(e.target.files[0]);
    });

    if (cameraDisponivel()) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        .then((f) => {
          if (!tela.isConnected) { f.getTracks().forEach((t) => t.stop()); return; }
          fluxo = f;
          video.srcObject = f;
          video.hidden = false;
          vazio.hidden = true;
          return video.play().catch(() => {});
        })
        .catch(() => { dica.textContent = 'Câmera indisponível: toque em "Foto da sala" para usar uma foto.'; });
    } else {
      dica.textContent = 'Câmera indisponível aqui: toque em "Foto da sala" para usar uma foto.';
    }

    // --- tirar foto: junta o fundo e o produto numa imagem ---
    function carregarImagem(src) {
      return new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = src; });
    }
    tela.querySelector('[data-foto]').addEventListener('click', async () => {
      const caixa = palco.getBoundingClientRect();
      const escala = Math.min(2, 1600 / caixa.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(caixa.width * escala);
      canvas.height = Math.round(caixa.height * escala);
      const g = canvas.getContext('2d');
      g.fillStyle = '#e9e1d4';
      g.fillRect(0, 0, canvas.width, canvas.height);
      // fundo em "cover", como aparece na tela
      const fundo = !video.hidden ? video : !fotoSala.hidden ? fotoSala : null;
      if (fundo) {
        const fw = fundo.videoWidth || fundo.naturalWidth;
        const fh = fundo.videoHeight || fundo.naturalHeight;
        if (fw && fh) {
          const k = Math.max(canvas.width / fw, canvas.height / fh);
          g.drawImage(fundo, (canvas.width - fw * k) / 2, (canvas.height - fh * k) / 2, fw * k, fh * k);
        }
      }
      try {
        const r = item.getBoundingClientRect();
        const fonte = produto.imagem || `data:image/svg+xml;charset=utf-8,${encodeURIComponent(produto.svg)}`;
        const img = await carregarImagem(fonte);
        g.drawImage(img, (r.left - caixa.left) * escala, (r.top - caixa.top) * escala, r.width * escala, r.height * escala);
      } catch (e) { /* sem a imagem do produto, salva só o fundo */ }
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const arquivo = new File([blob], `zaptos-${produto.nome.replace(/\W+/g, '-').toLowerCase()}.jpg`, { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
          try { await navigator.share({ files: [arquivo], title: produto.nome }); return; } catch (e) { /* cancelou: oferece baixar */ }
        }
        salvar.href = URL.createObjectURL(blob);
        salvar.download = arquivo.name;
        salvar.hidden = false;
        dica.textContent = 'Foto pronta!';
        salvar.focus();
      }, 'image/jpeg', 0.9);
    });

    item.focus();
    return fechar;
  }

  window.VerEmCasa = { abrir, cameraDisponivel };
})();
