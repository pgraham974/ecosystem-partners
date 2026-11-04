// Mack Living pipeline chat proxy. Holds the OpenAI key (secret OPENAI_API_KEY) and optional TEAM_PASSCODE.
const SITE='https://pgraham974.github.io/ecosystem-partners/';
const ORIGIN='https://pgraham974.github.io';
const MODEL='gpt-4.1-mini';
const MAX_MSG=1500, MAX_HIST=12, RL_N=20, RL_WIN=600000, CACHE_MS=300000;
/*__MODEL__*/
const MPM=(function(){const root={};(function(){MODEL_SRC}).call(root);return root.MackPipelineModel})();
let cache={t:0,ctx:null,idx:null,dl:null,titles:null};const hits=new Map();
function cors(o){return{'Access-Control-Allow-Origin':o===ORIGIN?ORIGIN:'null','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Team-Passcode','Access-Control-Max-Age':'86400','Vary':'Origin'}}
function j(b,s,o){return new Response(JSON.stringify(b),{status:s,headers:{'Content-Type':'application/json',...cors(o)}})}
async function getJ(p){const r=await fetch(SITE+p+'?t='+Math.floor(Date.now()/CACHE_MS),{cf:{cacheTtl:300}});if(!r.ok)throw new Error(p+' '+r.status);return r.json()}
async function context(){
 if(cache.ctx&&Date.now()-cache.t<CACHE_MS)return cache;
 const [P,V]=await Promise.all([getJ('mack-pipeline.json'),getJ('v4-enrich.json').catch(()=>({}))]);
 const ranked=MPM.rank(P.items,P.weights);
 const items=ranked.map(o=>({id:o.id,rank:o.rank,status:o.s.status,score:o.s.score,coverage:o.s.coverage,uncappedScore:o.s.raw,unknownGates:o.s.unknownGates,name:o.name,partner:o.buyer,partnerType:o.buyerType,region:o.region,service:o.service,route:o.route,kind:o.kind,framework:o.framework,mackPosition:o.mackPos,value:o.value,valueBasis:o.basis,deadline:o.deadline,start:o.start,end:o.end,gates:o.gates,inputs:o.inputs,why:o.why,next:o.next,incumbents:o.incumbents,bip:o.bip,facts:o.facts,url:o.url}));
 const comps=(P.competitors||[]).map(c=>({id:c.id,name:c.name,entity:c.entity,region:c.region,type:c.type,competesOn:c.competesOn,bip:c.bip,facts:c.facts}));
 const facts={};for(const [k,f] of Object.entries(V.facts||{}))facts[k]={field:f.field,finding:f.finding,status:f.status,checked:f.checked};
 const ctx={built:P.built,checkDate:P.checkDate,weights:P.weights,components:P.components,gateRules:P.gateRules,mack:P.mack,mackIdentity:P.mlIdentity,items,partners:P.buyers,spend:P.spend,competitors:comps,bipExtra:P.bipExtra,bipRecords:V.bip,facts};
 const titles={};for(const it of P.items)titles[it.id]=it.name;
 const idx=P.items.map(it=>it.id+' '+it.name).join('\n');
 const dl=deadlines(P.items);
 const dlTxt=dl.length?dl.map(x=>x.date+' | '+x.id+' '+x.title+' | '+x.type+' | '+(x.date<new Date().toISOString().slice(0,10)?'past':'upcoming')).join('\n'):'(none)';
 cache={t:Date.now(),ctx:JSON.stringify(ctx),idx,dl:dlTxt,titles};return cache}
const MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function deadlines(items){const out=[];
 for(const it of items){const why=(it.why||'')+' '+(it.next||'');const seen=new Set();
  const re=/(enquiries|clarifications?|questions|requests to participate|expressions of interest|market engagement|tenders?|bids?|responses?|submissions?)[^.;,]{0,20}?(by|due|close[sd]?|deadline)\s+(\d{1,2})\s+([A-Za-z]{3})[a-z]*(?:\s+(\d{4}))?(?:\s+(\d{1,2}:\d{2}))?/gi;let m;
  while((m=re.exec(why))){const mo=MON[m[4].toLowerCase()];if(!mo)continue;const y=m[5]||(it.deadline?it.deadline.slice(0,4):String(new Date().getFullYear()));
   const d=y+'-'+String(mo).padStart(2,'0')+'-'+m[3].padStart(2,'0');const t=m[1].toLowerCase();
   const type=(/^tender|^bid|^submission|^response/.test(t)?'Tenders due':t[0].toUpperCase()+t.slice(1)+(/^close/i.test(m[2])?' '+m[2].toLowerCase():' due'))+(m[6]?' '+m[6]:'');
   if(!seen.has(d+type)){seen.add(d+type);out.push({id:it.id,title:it.name,type,date:d})}}
  if(it.deadline&&!out.some(x=>x.id===it.id&&x.date===it.deadline))out.push({id:it.id,title:it.name,type:'Deadline (site field)',date:it.deadline})}
 return out.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))}
function words(t){return (t||'').toLowerCase().match(/[a-z]{4,}/g)||[]}
const STOP=new Set(['accommodation','framework','supported','temporary','support','services','service','contract','contracts','housing','council','with','from','under','lots','safety','scheme','schemes','programme','provider','homes','leasing']);
function check(ans,titles){const errs=[];const ids=Object.keys(titles);
 const uniq={};const cnt={};for(const id of ids)for(const w of new Set(words(titles[id])))cnt[w]=(cnt[w]||0)+1;
 for(const id of ids)uniq[id]=[...new Set(words(titles[id]))].filter(w=>cnt[w]===1&&!STOP.has(w));
 const re=/MP-(\d{1,3})/g;let m;
 while((m=re.exec(ans))){const id='MP-'+m[1].padStart(2,'0');
  if(!titles[id]){errs.push(m[0]+' does not exist');continue}
  const raw=ans.slice(m.index+m[0].length,m.index+m[0].length+90).split(/\n|MP-\d|[,;(]/)[0];if(!/^[\s:*|]*[A-Z]/.test(raw))continue;const seg=raw.toLowerCase();
  const sw=new Set(words(seg));const own=[...new Set(words(titles[id]))];const core=own.filter(w=>!STOP.has(w));if((core.length?core:own).some(w=>sw.has(w)))continue;
  for(const o of ids){if(o===id)continue;const hit=uniq[o].find(w=>sw.has(w));if(hit){errs.push(id+' was paired with text matching '+o+' ('+titles[o]+'); '+id+' is "'+titles[id]+'"');break}}}
 return [...new Set(errs)]}
function sys(C){const ctx=C.ctx;const today=new Date().toISOString().slice(0,10);return `You are Mack Living's bid assistant on the Mack Living contract pipeline site. Today is ${today}.
Rules:
- Answer ONLY from the DATA below. If the data does not say, say it is unknown or not in the data. Never invent contracts, values, dates, people or IDs.
- Whenever you mention an opportunity write it as 'MP-xx Title' copied exactly from the ID INDEX. Never pair an ID with another item's title, never merge two items into one line, and keep each item's dates with that item only.
- For any deadline or date question use the DEADLINES table (already sorted, one row per deadline), list every matching row, and report its ID, title, type and date exactly. Items with no row have no known deadline. Dates are YYYY-MM-DD, so a row is before a cutoff when its date string is earlier; include every such row and do not add notes contradicting the table. Mark past rows as past. Do not add any closing remark after a deadline list.
- Cite and cite BiP record IDs (BE-xx) and fact IDs (F-xxx) where they support a claim.
- Always distinguish a framework CEILING (maximum possible value) from actual spend or an awarded contract value, and a framework appointment from a call-off award. Use valueBasis to say which.
- Ranking: items are already ranked by the site's model (status Eligible first, then Qualify capped at 65 because a gate is UNKNOWN; Research needed and Excluded are unranked). Explain priorities using status, score, gates, deadline and the "why"/"next" fields.
- Councils and authorities that buy services are called Partners (tab Partners). Providers such as Mears, Serco, Nacro are Competitors.
- Unknown inputs (null) are unknown, never zero and never a pass.
- For date questions compare deadline/start dates with today's date; say when a deadline is null (unknown).
- Keep answers under about 350 words; for priority questions give at most 5 items with 2 to 3 short bullets each, in the site's rank order (Eligible before Qualify), and flag any near deadline.
- UK English, concise, plain text with short bullet points. Format money as £ with m/k. Never use em dashes or en dashes; use commas, colons or the word "to".
ID INDEX:
${C.idx}
DEADLINES (date | MP-xx Title | type | past or upcoming as of today):
${C.dl}
DATA (JSON):
${ctx}`}
export default{async fetch(req,env){
 const o=req.headers.get('Origin')||'';const u=new URL(req.url);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(o)});
 if(u.pathname==='/health')return j({ok:true},200,o);
 if(u.pathname!=='/chat'||req.method!=='POST')return j({error:'Not found'},404,o);
 if(o!==ORIGIN)return j({error:'Origin not allowed'},403,o);
 if(env.TEAM_PASSCODE&&(req.headers.get('X-Team-Passcode')||'')!==env.TEAM_PASSCODE)return j({error:'passcode'},401,o);
 const ip=req.headers.get('CF-Connecting-IP')||'x';const now=Date.now();const h=(hits.get(ip)||[]).filter(t=>now-t<RL_WIN);if(h.length>=RL_N)return j({error:'Too many questions, try again in a few minutes.'},429,o);h.push(now);hits.set(ip,h);
 let body;try{body=await req.json()}catch{return j({error:'Bad JSON'},400,o)}
 let msgs=Array.isArray(body.messages)?body.messages:[];
 msgs=msgs.filter(m=>m&&(m.role==='user'||m.role==='assistant')&&typeof m.content==='string').slice(-MAX_HIST).map(m=>({role:m.role,content:m.content.slice(0,m.role==='user'?MAX_MSG:4000)}));
 if(!msgs.length||msgs[msgs.length-1].role!=='user')return j({error:'No question'},400,o);
 if(msgs[msgs.length-1].content.length>=MAX_MSG)return j({error:'Question too long (max '+MAX_MSG+' characters).'},400,o);
 let ctx;try{ctx=await context()}catch(e){return j({error:'Could not load pipeline data: '+e.message},502,o)}
 const call=async(extra)=>{const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,temperature:0,max_tokens:1100,messages:[{role:'system',content:sys(ctx)},...msgs,...extra]})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error&&d.error.message||r.status);return d};
 let d,a,errs,retried=false;
 try{d=await call([]);a=(d.choices&&d.choices[0]&&d.choices[0].message.content)||'';errs=check(a,ctx.titles);
  if(errs.length){retried=true;const d2=await call([{role:'assistant',content:a},{role:'user',content:'Correction: your answer mislabelled items: '+errs.join('; ')+'. Rewrite the full answer, using exact "MP-xx Title" pairs from the ID INDEX and the DEADLINES table. Do not mention this correction.'}]);const a2=(d2.choices&&d2.choices[0]&&d2.choices[0].message.content)||'';const e2=check(a2,ctx.titles);if(e2.length<=errs.length){a=a2;errs=e2}d.usage={first:d.usage,retry:d2.usage}}}
 catch(e){return j({error:'AI error: '+e.message},502,o)}
 a=a.replace(/\s*[\u2013\u2014]\s*/g,', ');
 return j({answer:a,model:MODEL,usage:d.usage,retried,checkIssues:errs,dataBuilt:JSON.parse(ctx.ctx).built},200,o)}};
