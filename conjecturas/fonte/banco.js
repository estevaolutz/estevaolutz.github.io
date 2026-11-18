// ---------- banco de configurações (comum a todas as conjecturas) ----------
// Lê e aplica todos os controles do painel (#panel) com id. Salva configurações com nome, carrega pelas teclas 1–9,
// exporta/importa em .json e lembra os últimos ajustes ao reabrir. Para aplicar, muda o valor do controle e dispara
// os eventos input/change, então cada obra reage como se a pessoa tivesse mexido no painel.
(() => {
  const panel = document.getElementById('panel');
  if (!panel || window.__banco) return;
  window.__banco = true;
  const obra = (location.pathname.split('/').filter(Boolean).filter(s => s !== 'index.html').pop() || 'obra');
  const KB = 'conjecturas-banco-' + obra, KA = 'conjecturas-atual-' + obra, KL = 'conjecturas-lembrar-' + obra;
  const ls = {
    get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const ctrls = () => [...panel.querySelectorAll('input[id],select[id],textarea[id]')]
    .filter(el => !el.id.startsWith('bk') && el.type !== 'file' && el.type !== 'button' && el.type !== 'submit');
  const val = el => el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value;
  const estado = () => { const s = {}; for (const el of ctrls()) s[el.id] = val(el); return s; };
  const igual = (el, v) => el.type === 'checkbox' || el.type === 'radio' ? el.checked === !!v : String(el.value) === String(v);
  const fire = el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  let aplicando = false;
  function aplicar(s){
    if (!s) return;
    aplicando = true;
    try {
      // duas passadas: se um controle muda outros (ex.: um modo que reposiciona sliders), a segunda corrige
      for (let pass = 0; pass < 2; pass++){
        for (const el of ctrls()){
          if (!(el.id in s) || igual(el, s[el.id])) continue;
          if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!s[el.id];
          else if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === String(s[el.id]))) continue;
          else el.value = s[el.id];
          try { fire(el); } catch (e) { console.warn('banco:', el.id, e); }
        }
      }
    } finally { aplicando = false; }
    guardarAtual();
  }
  const PADRAO = estado();

  // ---------- interface ----------
  const css = document.createElement('style');
  css.textContent = `
    #bkBox{border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:12px;margin-bottom:6px}
    #bkBox .row label{flex:0 0 52px}
    #bkBox .btns{margin-top:6px}
    #bkMsg{min-height:1em;opacity:.55;font-size:10.5px;margin-top:6px;transition:opacity .4s}
    #bkBox .lembrar{display:flex;align-items:center;gap:6px;opacity:.7;margin-top:8px;font-size:11px}
    #bkBox .lembrar input{accent-color:#9fb8d0;margin:0}`;
  document.head.appendChild(css);
  const box = document.createElement('div');
  box.id = 'bkBox';
  box.innerHTML = `
    <h2>Configurações</h2>
    <div class="row"><label for="bkSel">salvas</label><select id="bkSel"></select></div>
    <div class="row"><label for="bkNome">nome</label><input id="bkNome" type="text" placeholder="nome da configuração" autocomplete="off" spellcheck="false"></div>
    <div class="btns"><button id="bkSalvar" type="button">Salvar</button><button id="bkApagar" type="button">Apagar</button></div>
    <div class="btns"><button id="bkExp" type="button">Exportar</button><button id="bkImp" type="button">Importar</button><input id="bkArq" type="file" accept=".json,application/json" style="display:none"></div>
    <label class="lembrar"><input id="bkLembrar" type="checkbox"> lembrar os ajustes ao reabrir</label>
    <div id="bkMsg"></div>
    <div class="hint" style="margin-top:4px">Teclas 1–9 carregam as configurações salvas, na ordem da lista; 0 volta ao padrão. Exporte o .json para levar para outro aparelho.</div>`;
  panel.insertBefore(box, panel.firstChild);
  const $b = id => document.getElementById(id);
  const sel = $b('bkSel'), nome = $b('bkNome'), bSalvar = $b('bkSalvar'), msgEl = $b('bkMsg'), lembrar = $b('bkLembrar');
  let msgT;
  const msg = t => { msgEl.textContent = t; msgEl.style.opacity = .7; clearTimeout(msgT); msgT = setTimeout(() => { msgEl.style.opacity = 0; }, 2600); };

  let banco = ls.get(KB, []);
  if (!Array.isArray(banco)) banco = [];
  const gravarBanco = () => ls.set(KB, banco);
  function lista(escolhido){
    sel.innerHTML = '<option value="">— atual —</option><option value="__padrao">Padrão</option>' +
      banco.map((c, i) => `<option value="${i}">${i < 9 ? (i + 1) + ' · ' : ''}${c.nome.replace(/[<&]/g, ch => ch === '<' ? '&lt;' : '&amp;')}</option>`).join('');
    sel.value = escolhido == null ? '' : String(escolhido);
    rotulo();
  }
  function rotulo(){ bSalvar.textContent = banco.some(c => c.nome === nome.value.trim()) ? 'Regravar' : 'Salvar'; }
  function carregar(i){
    if (i === '__padrao'){ aplicar(PADRAO); lista('__padrao'); nome.value = ''; rotulo(); msg('Padrão restaurado'); return; }
    const c = banco[i]; if (!c) return;
    aplicar(c.valores); lista(i); nome.value = c.nome; rotulo(); msg('Carregada: ' + c.nome);
  }
  sel.addEventListener('change', () => { if (sel.value !== '') carregar(sel.value === '__padrao' ? '__padrao' : +sel.value); });
  nome.addEventListener('input', rotulo);
  nome.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') bSalvar.click(); });
  bSalvar.addEventListener('click', () => {
    let n = nome.value.trim();
    if (!n){ let k = banco.length + 1; while (banco.some(c => c.nome === 'Configuração ' + k)) k++; n = 'Configuração ' + k; }
    const c = { nome: n, valores: estado(), data: new Date().toISOString() };
    const j = banco.findIndex(x => x.nome === n);
    if (j >= 0) banco[j] = c; else banco.push(c);
    gravarBanco(); nome.value = n; lista(j >= 0 ? j : banco.length - 1);
    msg((j >= 0 ? 'Regravada: ' : 'Salva: ') + n + ((j >= 0 ? j : banco.length - 1) < 9 ? ' (tecla ' + ((j >= 0 ? j : banco.length - 1) + 1) + ')' : ''));
  });
  $b('bkApagar').addEventListener('click', () => {
    const i = sel.value === '' || sel.value === '__padrao' ? banco.findIndex(c => c.nome === nome.value.trim()) : +sel.value;
    if (i < 0 || !banco[i]){ msg('Escolha na lista a configuração para apagar'); return; }
    if ($b('bkApagar').dataset.ok !== String(i)){ // segundo toque confirma (sem janela de confirmação)
      $b('bkApagar').dataset.ok = String(i); $b('bkApagar').textContent = 'Apagar mesmo?';
      setTimeout(() => { delete $b('bkApagar').dataset.ok; $b('bkApagar').textContent = 'Apagar'; }, 3000); return;
    }
    const n = banco[i].nome; banco.splice(i, 1); gravarBanco(); nome.value = '';
    delete $b('bkApagar').dataset.ok; $b('bkApagar').textContent = 'Apagar';
    lista(); msg('Apagada: ' + n);
  });
  $b('bkExp').addEventListener('click', async () => {
    const dados = { obra, versao: 1, exportado: new Date().toISOString(), atual: estado(), configuracoes: banco };
    const txt = JSON.stringify(dados, null, 2), arq = obra + '-configuracoes.json';
    const blob = new Blob([txt], { type: 'application/json' });
    try {
      const f = new File([blob], arq, { type: 'application/json' });
      if (/iPad|iPhone|iPod|Android/i.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [f] })){ await navigator.share({ files: [f], title: arq }); msg('Exportado'); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = arq;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    msg('Exportado: ' + arq);
  });
  $b('bkImp').addEventListener('click', () => $b('bkArq').click());
  $b('bkArq').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      const vem = Array.isArray(d) ? d : Array.isArray(d.configuracoes) ? d.configuracoes : [];
      if (d && d.obra && d.obra !== obra && !vem.length) throw new Error('outra obra');
      let novas = 0, troc = 0;
      for (const c of vem){
        if (!c || typeof c.nome !== 'string' || !c.valores) continue;
        const j = banco.findIndex(x => x.nome === c.nome);
        if (j >= 0){ banco[j] = c; troc++; } else { banco.push(c); novas++; }
      }
      gravarBanco(); lista();
      msg(novas + troc ? `Importadas: ${novas} novas${troc ? ', ' + troc + ' substituídas' : ''}${d.obra && d.obra !== obra ? ' (arquivo de ' + d.obra + ')' : ''}` : 'Nenhuma configuração no arquivo');
    } catch (err) { msg('Não consegui ler esse arquivo'); }
  });

  // ---------- lembrar ao reabrir ----------
  lembrar.checked = ls.get(KL, true) !== false;
  lembrar.addEventListener('change', () => { ls.set(KL, lembrar.checked); if (lembrar.checked) guardarAtual(); });
  let tA;
  function guardarAtual(){ if (!lembrar.checked) return; clearTimeout(tA); tA = setTimeout(() => ls.set(KA, estado()), 300); }
  panel.addEventListener('input', e => { if (!aplicando && e.target.id && !e.target.id.startsWith('bk')){ guardarAtual(); if (sel.value !== '') sel.value = ''; } }, true);
  panel.addEventListener('change', e => { if (!aplicando && e.target.id && !e.target.id.startsWith('bk')) guardarAtual(); }, true);
  addEventListener('pagehide', () => { if (lembrar.checked) ls.set(KA, estado()); });

  // ---------- teclas 1–9 e 0 ----------
  addEventListener('keydown', e => {
    const t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox'))) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key)){ const i = +e.key - 1; if (banco[i]){ e.preventDefault(); carregar(i); } }
    else if (e.key === '0'){ e.preventDefault(); carregar('__padrao'); }
  });

  lista();
  if (lembrar.checked){ const a = ls.get(KA, null); if (a) aplicar(a); }
})();
