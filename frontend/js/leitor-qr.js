// Leitor de QR Code pela câmera (tela "Validar retirada" do lojista).
//
// Usa o leitor nativo do navegador (BarcodeDetector) quando existe — Android e
// macOS — e, nos outros, a biblioteca jsQR (js/vendor/jsQR.js), carregada só
// quando a câmera é aberta. A câmera só funciona em HTTPS ou em localhost.
(function () {
  'use strict';

  const INTERVALO_MS = 150; // de quanto em quanto tempo tenta ler um quadro
  const LARGURA_ANALISE = 640; // reduz o quadro antes de analisar (mais rápido)

  let carregandoJsQR = null;
  function carregarJsQR() {
    if (window.jsQR) return Promise.resolve();
    if (!carregandoJsQR) {
      carregandoJsQR = new Promise((ok, falha) => {
        const s = document.createElement('script');
        s.src = 'js/vendor/jsQR.js';
        s.onload = () => ok();
        s.onerror = () => { carregandoJsQR = null; falha(new Error('Não foi possível carregar o leitor de QR Code.')); };
        document.head.appendChild(s);
      });
    }
    return carregandoJsQR;
  }

  async function criarDetectorNativo() {
    try {
      if (!('BarcodeDetector' in window)) return null;
      const formatos = await window.BarcodeDetector.getSupportedFormats();
      return formatos.includes('qr_code') ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
    } catch (e) {
      return null;
    }
  }

  // Lê o QR Code de um ImageData (usado pelo leitor e pelos testes).
  function decodificar(imagem) {
    if (!window.jsQR) return null;
    const r = window.jsQR(imagem.data, imagem.width, imagem.height, { inversionAttempts: 'attemptBoth' });
    return r && r.data ? r.data : null;
  }

  function mensagemDeErro(err) {
    const nome = err && err.name;
    if (nome === 'NotAllowedError' || nome === 'SecurityError') return 'Sem permissão para usar a câmera. Libere o acesso nas configurações do navegador ou digite o código.';
    if (nome === 'NotFoundError' || nome === 'OverconstrainedError') return 'Nenhuma câmera encontrada neste aparelho. Digite o código.';
    if (nome === 'NotReadableError') return 'A câmera está sendo usada por outro aplicativo. Feche-o e tente de novo.';
    return (err && err.message) || 'Não foi possível abrir a câmera. Digite o código.';
  }

  function disponivel() {
    return !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  // Abre a câmera em tela cheia. Chama aoLer(texto) quando encontra um QR Code,
  // ou aoErro(mensagem) se não conseguir. Devolve uma função que fecha o leitor.
  function abrir({ aoLer, aoErro }) {
    const anterior = document.activeElement;
    const tela = document.createElement('div');
    tela.className = 'leitor';
    tela.setAttribute('role', 'dialog');
    tela.setAttribute('aria-modal', 'true');
    tela.setAttribute('aria-label', 'Ler QR Code do cliente');
    tela.innerHTML = `
      <video class="leitor__video" playsinline muted autoplay></video>
      <div class="leitor__moldura" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></div>
      <div class="leitor__rodape">
        <p class="leitor__dica">Aponte para o QR Code do cliente</p>
        <p class="leitor__status" aria-live="polite">Abrindo a câmera…</p>
        <button type="button" class="btn btn--contorno leitor__fechar">Cancelar e digitar o código</button>
      </div>`;
    document.body.appendChild(tela);
    document.body.classList.add('leitor-aberto');

    const video = tela.querySelector('video');
    const status = tela.querySelector('.leitor__status');
    const botaoFechar = tela.querySelector('.leitor__fechar');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let fluxo = null;
    let timer = null;
    let fechado = false;

    function fechar() {
      if (fechado) return;
      fechado = true;
      clearTimeout(timer);
      if (fluxo) fluxo.getTracks().forEach((t) => t.stop()); // desliga a câmera
      document.removeEventListener('keydown', aoTeclar);
      tela.remove();
      document.body.classList.remove('leitor-aberto');
      if (anterior && anterior.focus) anterior.focus();
    }

    function aoTeclar(e) {
      if (e.key === 'Escape') fechar();
      if (e.key === 'Tab') { e.preventDefault(); botaoFechar.focus(); } // mantém o foco no diálogo
    }

    function falhar(err) {
      const msg = mensagemDeErro(err);
      fechar();
      if (aoErro) aoErro(msg);
    }

    botaoFechar.addEventListener('click', fechar);
    document.addEventListener('keydown', aoTeclar);
    botaoFechar.focus();

    (async () => {
      try {
        if (!disponivel()) throw new Error('A câmera só funciona em conexão segura (HTTPS). Digite o código.');
        const [detector] = await Promise.all([
          criarDetectorNativo(),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
            .then((f) => { fluxo = f; }),
        ]);
        if (fechado) { fluxo.getTracks().forEach((t) => t.stop()); return; }
        if (!detector) await carregarJsQR();
        video.srcObject = fluxo;
        await video.play().catch(() => { /* alguns navegadores tocam sozinhos */ });
        status.textContent = 'Procurando o código…';

        const ler = async () => {
          if (fechado) return;
          try {
            if (video.readyState >= 2 && video.videoWidth) {
              let texto = null;
              if (detector) {
                const achados = await detector.detect(video);
                texto = achados.length ? achados[0].rawValue : null;
              } else {
                const escala = Math.min(1, LARGURA_ANALISE / video.videoWidth);
                canvas.width = Math.round(video.videoWidth * escala);
                canvas.height = Math.round(video.videoHeight * escala);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                texto = decodificar(ctx.getImageData(0, 0, canvas.width, canvas.height));
              }
              if (texto && !fechado) {
                if (navigator.vibrate) navigator.vibrate(80);
                fechar();
                aoLer(texto.trim());
                return;
              }
            }
          } catch (e) { /* quadro ruim: tenta o próximo */ }
          timer = setTimeout(ler, INTERVALO_MS);
        };
        ler();
      } catch (err) {
        falhar(err);
      }
    })();

    return fechar;
  }

  window.LeitorQR = { disponivel, abrir, decodificar, carregarJsQR };
})();
