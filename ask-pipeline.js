(function(){
// "Ask the pipeline" chat panel. Talks to the Cloudflare Worker, which holds the AI key and reads this site's live JSON.
const API='https://mack-pipeline-chat.pgraham974.workers.dev/chat';
const KEY='mackAskPasscode',HK='mackAskHistory';
const SUG=['Which contracts should we chase first and why?','What deadlines are before 5 Dec?','Who are the incumbents on MP-01?','Which items are capped at 65 and what would unlock them?','Where is actual spend evidence, not just a framework ceiling?'];
let hist=[];try{hist=JSON.parse(sessionStorage.getItem(HK)||'[]')}catch(e){}
const e=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const st=document.createElement('style');st.textContent=`
#ask-fab{position:fixed;right:20px;bottom:20px;z-index:9999;background:var(--acc,#0b5fff);color:#fff;border:0;border-radius:24px;padding:11px 18px;font:600 14px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.18);cursor:pointer}
#ask-pane{position:fixed;right:20px;bottom:76px;z-index:9999;width:min(430px,calc(100vw - 40px));height:min(620px,calc(100vh - 110px));background:#fff;border:1px solid var(--line,#e3e7ec);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18);display:flex;flex-direction:column;font:14px system-ui,sans-serif}
#ask-pane.hidden{display:none}#ask-hd{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line,#e3e7ec)}#ask-hd b{font-size:15px}#ask-hd button{border:0;background:none;cursor:pointer;color:var(--mut,#5b6472);font-size:13px}
#ask-log{flex:1;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px}.ask-m{padding:9px 11px;border-radius:10px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}.ask-u{align-self:flex-end;background:var(--acc,#0b5fff);color:#fff;max-width:85%}.ask-a{align-self:flex-start;background:#f3f5f8;max-width:95%}.ask-err{background:#fdecea;color:#8a1c12}
.ask-a a.mpid{color:var(--acc,#0b5fff);font-weight:600;text-decoration:none;cursor:pointer}.ask-sug{display:flex;flex-wrap:wrap;gap:6px}.ask-sug button{border:1px solid var(--line,#e3e7ec);background:#fff;border-radius:14px;padding:5px 10px;font-size:12px;cursor:pointer;text-align:left}.ask-sug button:hover{border-color:var(--acc,#0b5fff)}
#ask-f{display:flex;gap:6px;padding:10px;border-top:1px solid var(--line,#e3e7ec)}#ask-f textarea{flex:1;resize:none;height:42px;padding:8px;border:1px solid var(--line,#e3e7ec);border-radius:8px;font:inherit}#ask-f button{background:var(--acc,#0b5fff);color:#fff;border:0;border-radius:8px;padding:0 14px;font-weight:600;cursor:pointer}#ask-f button:disabled{opacity:.5}
.ask-foot{font-size:11px;color:var(--mut,#5b6472);padding:0 14px 8px}tr.ask-hl{outline:2px solid var(--acc,#0b5fff);background:#eef4ff}`;document.head.appendChild(st);
const fab=document.createElement('button');fab.id='ask-fab';fab.textContent='Ask the pipeline';
const pane=document.createElement('div');pane.id='ask-pane';pane.className='hidden';
pane.innerHTML='<div id="ask-hd"><b>Ask the pipeline</b><span><button id="ask-clear">Clear</button> <button id="ask-x">Close</button></span></div><div id="ask-log"></div><form id="ask-f"><textarea id="ask-q" maxlength="1400" placeholder="e.g. Which contracts should we chase this month?"></textarea><button id="ask-go">Ask</button></form>';
document.body.append(fab,pane);const log=pane.querySelector('#ask-log'),q=pane.querySelector('#ask-q'),go=pane.querySelector('#ask-go');
function fmt(t){return e(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\bMP-\d+\b/g,m=>'<a class="mpid" data-mp="'+m+'" title="Open '+m+' in the pipeline">'+m+'</a>')}
function draw(){log.innerHTML='';if(!hist.length){log.innerHTML='<div class="ask-m ask-a">Ask me about Mack Living\'s pipeline: what to chase, deadlines, partners, incumbents and evidence. I cite MP, BiP (BE) and fact (F) IDs.</div><div class="ask-sug">'+SUG.map(s=>'<button type="button">'+e(s)+'</button>').join('')+'</div>';log.querySelectorAll('.ask-sug button').forEach(b=>b.onclick=()=>ask(b.textContent))}
 for(const m of hist){const d=document.createElement('div');d.className='ask-m '+(m.role==='user'?'ask-u':'ask-a'+(m.err?' ask-err':''));d.innerHTML=m.role==='user'?e(m.content):fmt(m.content);log.appendChild(d)}log.scrollTop=log.scrollHeight}
function save(){try{sessionStorage.setItem(HK,JSON.stringify(hist.slice(-20)))}catch(x){}}
function openMP(id){if(window.MackPipeline)window.MackPipeline.open('pipeline');let n=0;const t=setInterval(()=>{const r=document.querySelector('tr[data-rec="PIPE:'+id+'"]');if(r||++n>40){clearInterval(t);if(r){document.querySelectorAll('tr.ask-hl').forEach(x=>x.classList.remove('ask-hl'));r.classList.add('ask-hl');r.scrollIntoView({behavior:'smooth',block:'center'})}}},100)}
log.addEventListener('click',ev=>{const a=ev.target.closest('a.mpid');if(a){ev.preventDefault();openMP(a.dataset.mp)}});
function pass(force){let p=localStorage.getItem(KEY);if(!p||force){p=prompt('Team passcode for the pipeline assistant:')||'';if(p)localStorage.setItem(KEY,p.trim())}return localStorage.getItem(KEY)||''}
async function ask(text,retry){text=(text||'').trim();if(!text)return;if(!retry){hist.push({role:'user',content:text});draw()}
 const p=pass(false);if(!p){hist.push({role:'assistant',content:'A team passcode is needed. Ask Patrick for it.',err:1});draw();return}
 go.disabled=true;const w=document.createElement('div');w.className='ask-m ask-a';w.textContent='Thinking...';log.appendChild(w);log.scrollTop=log.scrollHeight;
 try{const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-Team-Passcode':p},body:JSON.stringify({messages:hist.filter(m=>!m.err).slice(-12).map(m=>({role:m.role,content:m.content}))})});
  const d=await r.json().catch(()=>({}));
  if(r.status===401){localStorage.removeItem(KEY);w.remove();go.disabled=false;if(!retry&&pass(true))return ask(text,1);hist.push({role:'assistant',content:'Passcode not accepted.',err:1})}
  else if(!r.ok)hist.push({role:'assistant',content:d.error||('Error '+r.status),err:1});else hist.push({role:'assistant',content:d.answer})}
 catch(x){hist.push({role:'assistant',content:'Could not reach the assistant: '+x.message,err:1})}
 go.disabled=false;save();draw()}
fab.onclick=()=>{pane.classList.toggle('hidden');if(!pane.classList.contains('hidden')){draw();q.focus()}};
pane.querySelector('#ask-x').onclick=()=>pane.classList.add('hidden');pane.querySelector('#ask-clear').onclick=()=>{hist=[];save();draw()};
pane.querySelector('#ask-f').onsubmit=ev=>{ev.preventDefault();const t=q.value;q.value='';ask(t)};
q.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();pane.querySelector('#ask-f').requestSubmit()}});
window.AskPipeline={open:()=>{pane.classList.remove('hidden');draw()},ask};
})();
