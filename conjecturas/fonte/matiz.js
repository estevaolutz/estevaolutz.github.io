// Saturação e matiz da imagem para as obras feitas antes do núcleo v2 (Granizo, Corredor Solitário, Formiga de Langton,
// Recamán e Kolakoski). As obras do núcleo v2 e o Cometa de Goldbach já têm esses controles na seção Vídeo.
// Cria uma seção "Cor da imagem" no painel; os ids vSat e vHue são os mesmos do núcleo v2, então o banco guarda os dois.
(() => {
  const $ = id => document.getElementById(id), panel = $('panel'), cv = $('cv');
  if (!panel || !cv || $('vSat')) return;
  const box = document.createElement('div'); box.id = 'matizBox';
  box.innerHTML = `<h2>Cor da imagem</h2>
    <div class="row"><label>Saturação</label><input type="range" id="vSat" min="0" max="3" step="0.01" value="1"></div>
    <div class="row"><label>Matiz</label><input type="range" id="vHue" min="0" max="360" step="1" value="0"></div>`;
  const antes = [...panel.querySelectorAll('h2')].find(h => /imagem/i.test(h.textContent)) || panel.querySelector('.hint');
  if (antes && antes.parentNode) antes.parentNode.insertBefore(box, antes); else panel.appendChild(box);
  const ler = () => { const sat = +$('vSat').value, hue = +$('vHue').value;
    cv.style.filter = sat === 1 && hue === 0 ? '' : `saturate(${sat}) hue-rotate(${hue}deg)`; };
  box.addEventListener('input', ler); box.addEventListener('change', ler);
  ler();
})();
