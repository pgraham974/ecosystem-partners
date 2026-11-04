(function(){
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const M=window.MackPipelineModel,WK='mackPipelineWeights';let D,IDX={},cur='pipeline';const Q={};
const col=s=>s==='Eligible'?'#1f6f4a':s==='Qualify'?'#9a6b00':s==='Excluded'?'#9b2c2c':'#64748b';
function W(){try{return Object.assign({},D.weights,JSON.parse(localStorage.getItem(WK)||'{}'))}catch(x){return Object.assign({},D.weights)}}
function link(v){const t=IDX[v];return t?'<a class="ln" href="#'+t+'/'+encodeURIComponent(v)+'">'+e(v)+'</a>':e(v)}
function cell(k,v){if(v==null||v==='')return '<span class="mu">-</span>';if(Array.isArray(v))return v.length?v.map(link).join(' '):'<span class="mu">-</span>';
 if(k==='status')return '<span class="pill" style="color:'+col(v)+';border-color:'+col(v)+'">'+e(v)+'</span>';
 if(typeof v==='string'&&/^https?:\/\//.test(v))return '<a href="'+e(v)+'" target="_blank" rel="noopener">link</a>';
 if(typeof v==='string'&&v.length>140)return '<div class="cl" title="'+e(v)+'">'+e(v)+'</div>';if(['partner','record'].includes(k))return link(v);return e(v)}
function rerank(sec){const w=W();const by={};sec.rows.forEach(r=>by[r.id]=r);
 const out=M.rank(sec.rows.map(r=>({id:r.id,inputs:{A:r.A,B:r.B,C:r.C,D:r.D,E:r.E},gates:r._gates})),w);
 return out.map(o=>Object.assign({},by[o.id],{rank:o.rank,status:o.s.status,score:o.s.score,coverage:Math.round(o.s.coverage*100)}))}
function weights(){const w=W();return '<div class="wts">Weights '+M.KEYS.map(k=>'<label>'+k+' <input type="number" min="0" max="100" data-w="'+k+'" value="'+e(w[k])+'"></label>').join('')+' <button id="wr">Reset</button></div>'}
function table(t,s){const q=(Q[s.key]||'').toLowerCase();let rows=s.key==='opps'?rerank(s):s.rows;
 const shown=q?rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q)):rows;
 return '<section id="s-'+s.key+'"><div class="sh"><h2>'+e(s.name)+' <span class="mu">'+shown.length+(q?' of '+rows.length:'')+'</span></h2><input class="q" data-s="'+s.key+'" placeholder="Filter" value="'+e(Q[s.key]||'')+'"></div>'+(s.key==='opps'?weights():'')+
 '<div class="sc"><table><thead><tr>'+s.cols.map(c=>'<th>'+e(c[1])+'</th>').join('')+'</tr></thead><tbody>'+
 shown.map(r=>'<tr id="r-'+e(r.id)+'" data-rec="'+e(r._rec)+'"'+(r._also&&r._also.length?' data-also="'+e(r._also.join(';'))+'"':'')+'>'+s.cols.map(c=>'<td'+(c[0]==='id'?' class="idc"':'')+'>'+cell(c[0],r[c[0]])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section>'}
function show(key,rid){const t=D.tabs.find(x=>x.key===key)||D.tabs[0];cur=t.key;
 document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===cur));
 const m=document.getElementById('main');m.innerHTML=t.sections.map(s=>table(t,s)).join('');
 m.querySelectorAll('.q').forEach(i=>i.oninput=()=>{Q[i.dataset.s]=i.value;const p=i.selectionStart;show(cur);const n=document.querySelector('.q[data-s="'+i.dataset.s+'"]');n.focus();n.setSelectionRange(p,p)});
 m.querySelectorAll('[data-w]').forEach(i=>i.onchange=()=>{const w=W();w[i.dataset.w]=+i.value||0;localStorage.setItem(WK,JSON.stringify(w));show(cur)});
 const wr=document.getElementById('wr');if(wr)wr.onclick=()=>{localStorage.removeItem(WK);show(cur)};
 if(rid){const r=document.getElementById('r-'+rid);if(r){r.classList.add('hl');r.scrollIntoView({block:'center'})}}}
window.viewMode=k=>show(k);window.MackPipeline={open:k=>{location.hash=k}};
function route(){const h=decodeURIComponent(location.hash.slice(1));const [k,...r]=h.split('/');show(k||'pipeline',r.join('/'))}
fetch('site-data.json?v='+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(d=>{D=d;
 d.tabs.forEach(t=>t.sections.forEach(s=>s.rows.forEach(r=>{if(!(r.id in IDX))IDX[r.id]=t.key})));
 document.getElementById('tabs').innerHTML=d.tabs.map(t=>'<button data-t="'+t.key+'">'+e(t.name)+'</button>').join('');
 document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{location.hash=b.dataset.t});
 document.getElementById('built').textContent='Data '+d.built.slice(0,10);
 document.getElementById('xl').href=d.workbook+'?v='+d.built.slice(0,10);
 window.addEventListener('hashchange',route);route()}).catch(x=>{document.getElementById('main').textContent='Data failed to load: '+x})})();
