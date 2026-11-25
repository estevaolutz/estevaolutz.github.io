/* Coleções — sincronização entre aparelhos (Vinis e Livros).
   A coleção fica num gist secreto da conta do GitHub do dono. Cada aparelho guarda um código de acesso
   (token com permissão "gist"), que vale para os dois apps porque eles estão no mesmo site.
   Arquivos no gist: <app>.json (dados, sem fotos), <app>-fotos-0..f.json (fotos tiradas, divididas em 16),
   colecoes-leia-me.md (marca o gist). Os .epub/.pdf dos Livros não vão para o gist. */
(function(){
const CFG='colecoes-sync-v1',API='https://api.github.com',NB=16,MARCA='colecoes-leia-me.md';
const ler=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
const gravar=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const cfg=()=>ler(CFG,{});
const balde=id=>{let h=0;for(const ch of String(id))h=(h*31+ch.charCodeAt(0))>>>0;return(h%NB).toString(16)};
const marca=x=>x._m||x.criado||0;
async function resumo(t){const b=await crypto.subtle.digest('SHA-1',new TextEncoder().encode(t));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}

async function gh(caminho,op={}){const c=cfg();
  const r=await fetch(API+caminho,{...op,cache:'no-store',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+c.token,...(op.body?{'Content-Type':'application/json'}:{})}});
  if(!r.ok){const d=await r.json().catch(()=>({}));
    const e=new Error(r.status===401?'o código de acesso do GitHub não vale mais — cole um novo em Ajustes'
      :(r.status===403||r.status===404)&&/gist/i.test(caminho)&&!/rate/i.test(d.message||'')?'o código não tem permissão de “gist” — crie outro com a caixa gist marcada'
      :/rate limit/i.test(d.message||'')?'o GitHub pediu uma pausa — tento de novo em seguida'
      :(d.message||'erro '+r.status));e.status=r.status;throw e}
  return r.status===204?null:r.json()}
async function conteudo(f){if(!f)return null;let t=f.content;
  if(f.truncated||t==null){const r=await fetch(f.raw_url,{cache:'no-store'});t=await r.text()}
  try{return JSON.parse(t)}catch(e){return null}}
async function acharOuCriarGist(){
  for(let p=1;p<=10;p++){const l=await gh(`/gists?per_page=100&page=${p}`);const g=l.find(x=>x.files&&x.files[MARCA]);if(g)return g.id;if(l.length<100)break}
  const g=await gh('/gists',{method:'POST',body:JSON.stringify({description:'Coleções — sincronização entre aparelhos (não apagar)',public:false,
    files:{[MARCA]:{content:'Arquivo usado pelos apps Coleções (Vinis e Livros) em https://estevaolutz.github.io/ para sincronizar a coleção entre aparelhos. Não apague.'}}})});
  return g.id}

/* o = {app:'vinis'|'livros', DB, itens:'discos'|'livros', listas:'listas', aoMudar:async fn, aviso:fn} */
function criar(o){
  const K_AP='colecoes-sync-apagados-'+o.app,K_H='colecoes-sync-resumos-'+o.app,K_V='colecoes-sync-versao-'+o.app;
  const S={rodando:false,pend:false,t:null,msg:'',ultimo:0};
  const put0=o.DB.put.bind(o.DB),del0=o.DB.del.bind(o.DB),NOSSOS=[o.itens,o.listas];
  /* Toda gravação feita pelo app ganha a hora da mudança (_m) e dispara a sincronização. */
  o.DB.put=(s,v)=>{if(!NOSSOS.includes(s)||!v)return put0(s,v);v._m=Date.now();const p=put0(s,v);p.then(()=>S.agendar());return p};
  o.DB.del=(s,k)=>{if(!NOSSOS.includes(s))return del0(s,k);const a=ler(K_AP,{});a[s+':'+k]=Date.now();gravar(K_AP,a);const p=del0(s,k);p.then(()=>S.agendar());return p};

  S.ligado=()=>{const c=cfg();return!!(c.token&&c.gist)};
  S.status=t=>{S.msg=t;const e=document.getElementById('syncSt');if(e)e.textContent=t||(S.ultimo?'Sincronizado às '+new Date(S.ultimo).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'.':'')};
  S.agendar=(ms=3000)=>{if(!S.ligado())return;clearTimeout(S.t);S.t=setTimeout(()=>S.sincronizar(),ms)};

  S.sincronizar=async(forcar=false)=>{if(!S.ligado())return;if(S.rodando){S.pend=true;return}S.rodando=true;S.status('Sincronizando…');
    try{const c=cfg();
      const ver=(await gh(`/gists/${c.gist}/commits?per_page=1`))[0]?.version||'';
      let it=await o.DB.all(o.itens),li=await o.DB.all(o.listas),mudou=false;
      if(forcar||ver!==ler(K_V,'')){
        const g=await gh(`/gists/${c.gist}`),F=g.files||{};
        const base=(await conteudo(F[o.app+'.json']))||{};
        const fotos={};for(const n of Object.keys(F).filter(n=>n.startsWith(o.app+'-fotos-')))Object.assign(fotos,(await conteudo(F[n]))||{});
        const ap=ler(K_AP,{});for(const[k,v]of Object.entries(base.apagados||{}))ap[k]=Math.max(v,ap[k]||0);gravar(K_AP,ap);
        for(const[s,remotos]of[[o.itens,base.itens||[]],[o.listas,base.listas||[]]]){
          const L=new Map((s===o.itens?it:li).map(x=>[x.id,x]));
          for(const r of remotos){if(!r||!r.id)continue;if(r.foto===1)r.foto=fotos[r.id]||'';
            const t=ap[s+':'+r.id];if(t&&t>=marca(r))continue;
            const l=L.get(r.id);if(!l||marca(r)>marca(l)){await put0(s,r);L.set(r.id,r);mudou=true}}
          for(const[id,l]of[...L]){const t=ap[s+':'+id];if(t&&t>=marca(l)){await del0(s,id);L.delete(id);mudou=true}}
          if(s===o.itens)it=[...L.values()];else li=[...L.values()]}
        gravar(K_V,ver)}
      /* monta o que vai para o GitHub e só manda os arquivos que mudaram */
      const foto=x=>typeof x.foto==='string'&&x.foto.startsWith('data:');
      const files={[o.app+'.json']:JSON.stringify({app:o.app,versao:1,itens:it.map(x=>foto(x)?{...x,foto:1}:x),listas:li,apagados:ler(K_AP,{})})};
      const B={};for(const x of it)if(foto(x))(B[balde(x.id)]??={})[x.id]=x.foto;
      for(let i=0;i<NB;i++){const k=i.toString(16);files[`${o.app}-fotos-${k}.json`]=JSON.stringify(B[k]||{})}
      const antes=ler(K_H,{}),agora={},env={};
      for(const[n,t]of Object.entries(files)){agora[n]=await resumo(t);if(antes[n]!==agora[n])env[n]={content:t}}
      if(Object.keys(env).length){const g=await gh(`/gists/${c.gist}`,{method:'PATCH',body:JSON.stringify({files:env})});gravar(K_H,agora);gravar(K_V,g.history?.[0]?.version||'')}
      if(mudou)await o.aoMudar();
      S.ultimo=Date.now();S.status('')}
    catch(e){S.status('Não sincronizou: '+e.message+'.');if(e.status===401&&o.aviso)o.aviso('Sincronização: '+e.message,5000)}
    finally{S.rodando=false;if(S.pend){S.pend=false;S.agendar(500)}}};

  S.conectar=async token=>{token=String(token||'').trim();if(!token)throw new Error('cole o código primeiro');
    gravar(CFG,{token});try{const gist=await acharOuCriarGist();gravar(CFG,{token,gist})}catch(e){gravar(CFG,null);throw e}
    for(const app of['vinis','livros']){gravar('colecoes-sync-versao-'+app,null);gravar('colecoes-sync-resumos-'+app,null)}
    await S.sincronizar(true)};
  S.desligar=()=>{gravar(CFG,null);for(const app of['vinis','livros']){gravar('colecoes-sync-versao-'+app,null);gravar('colecoes-sync-resumos-'+app,null)}};

  S.painel=el=>{if(!el)return;const nome=o.app==='vinis'?'discos':'livros';
    el.innerHTML=S.ligado()
      ?`<h3>Sincronizar entre aparelhos</h3><p>✓ Ligado neste aparelho. O que você muda aqui aparece nos outros aparelhos conectados em até 1 minuto, e o que muda lá aparece aqui. Vale para os Vinis e os Livros.</p>
        <p class="note" id="syncSt"></p><div class="row"><button class="btn" id="syncAgora">Sincronizar agora</button><button class="btn lk" id="syncSair">Desligar neste aparelho</button></div>
        ${o.app==='livros'?'<p class="note">Os arquivos .epub e .pdf não vão para a sincronização (são pesados demais): eles ficam no aparelho onde foram guardados.</p>':''}`
      :`<h3>Sincronizar entre aparelhos</h3><p>Para os mesmos ${nome} aparecerem no celular e no computador. Faça uma vez em cada aparelho — vale para os Vinis e os Livros ao mesmo tempo.</p>
        <ol class="note" style="padding-left:20px;display:grid;gap:4px"><li>Abra <a href="https://github.com/settings/tokens/new?scopes=gist&description=Cole%C3%A7%C3%B5es" target="_blank" rel="noopener">https://github.com/settings/tokens/new?scopes=gist&amp;description=Coleções</a> e entre na sua conta do GitHub.</li>
        <li>Em <b>Expiration</b>, escolha <b>No expiration</b>. A caixa <b>gist</b> já vem marcada — não precisa marcar mais nada.</li>
        <li>Toque em <b>Generate token</b>, no fim da página, e copie o código (começa com <code>ghp_</code>).</li>
        <li>Cole aqui embaixo e toque em <b>Conectar</b>. Nos outros aparelhos, cole o mesmo código (mande para você mesmo pelo WhatsApp, por exemplo).</li></ol>
        <div class="row"><input class="in grow" id="syncTok" placeholder="ghp_…" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn pri" id="syncCon">Conectar</button></div>
        <p class="note">A coleção fica num gist secreto da sua conta do GitHub, que só você vê na sua lista.</p><p class="note" id="syncSt"></p>`;
    S.status(S.msg);
    const q=s=>el.querySelector(s);
    if(q('#syncCon'))q('#syncCon').onclick=async e=>{e.target.disabled=true;S.status('Conectando ao GitHub…');
      try{await S.conectar(q('#syncTok').value);o.aviso&&o.aviso('Sincronização ligada');S.painel(el)}catch(err){S.status('Não conectou: '+err.message+'.');e.target.disabled=false}};
    if(q('#syncAgora'))q('#syncAgora').onclick=()=>S.sincronizar(true);
    if(q('#syncSair'))q('#syncSair').onclick=e=>{if(!e.target.dataset.ok){e.target.dataset.ok=1;e.target.textContent='Toque de novo para desligar (Vinis e Livros)';return}S.desligar();S.msg='';S.painel(el)}};

  /* sincroniza ao abrir, ao voltar para o app e a cada 45 s com o app aberto */
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')S.sincronizar()});
  setInterval(()=>{if(document.visibilityState==='visible')S.sincronizar()},45000);
  S.sincronizar();
  return S}
window.ColecoesSync={criar};
})();
