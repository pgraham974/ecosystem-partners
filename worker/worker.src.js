// Mack Living pipeline chat proxy. Holds the OpenAI key (secret OPENAI_API_KEY) and optional TEAM_PASSCODE.
const SITE='https://pgraham974.github.io/ecosystem-partners/';
const ORIGIN='https://pgraham974.github.io';
const MODEL='gpt-4.1-mini';
const MAX_MSG=1500, MAX_HIST=12, RL_N=20, RL_WIN=600000, CACHE_MS=300000;
/*__MODEL__*/
const MPM=(function(){const root={};(function(){MODEL_SRC}).call(root);return root.MackPipelineModel})();
let cache={t:0,ctx:null};const hits=new Map();
function cors(o){return{'Access-Control-Allow-Origin':o===ORIGIN?ORIGIN:'null','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Team-Passcode','Access-Control-Max-Age':'86400','Vary':'Origin'}}
function j(b,s,o){return new Response(JSON.stringify(b),{status:s,headers:{'Content-Type':'application/json',...cors(o)}})}
async function getJ(p){const r=await fetch(SITE+p+'?t='+Math.floor(Date.now()/CACHE_MS),{cf:{cacheTtl:300}});if(!r.ok)throw new Error(p+' '+r.status);return r.json()}
async function context(){
 if(cache.ctx&&Date.now()-cache.t<CACHE_MS)return cache.ctx;
 const [P,V]=await Promise.all([getJ('mack-pipeline.json'),getJ('v4-enrich.json').catch(()=>({}))]);
 const ranked=MPM.rank(P.items,P.weights);
 const items=ranked.map(o=>({id:o.id,rank:o.rank,status:o.s.status,score:o.s.score,coverage:o.s.coverage,uncappedScore:o.s.raw,unknownGates:o.s.unknownGates,name:o.name,buyer:o.buyer,buyerType:o.buyerType,region:o.region,service:o.service,route:o.route,kind:o.kind,framework:o.framework,mackPosition:o.mackPos,value:o.value,valueBasis:o.basis,deadline:o.deadline,start:o.start,end:o.end,gates:o.gates,inputs:o.inputs,why:o.why,next:o.next,incumbents:o.incumbents,bip:o.bip,facts:o.facts,url:o.url}));
 const comps=(P.competitors||[]).map(c=>({id:c.id,name:c.name,entity:c.entity,region:c.region,type:c.type,competesOn:c.competesOn,bip:c.bip,facts:c.facts}));
 const facts={};for(const [k,f] of Object.entries(V.facts||{}))facts[k]={field:f.field,finding:f.finding,status:f.status,checked:f.checked};
 const ctx={built:P.built,checkDate:P.checkDate,weights:P.weights,components:P.components,gateRules:P.gateRules,mack:P.mack,mackIdentity:P.mlIdentity,items,buyers:P.buyers,spend:P.spend,competitors:comps,bipExtra:P.bipExtra,bipRecords:V.bip,facts};
 cache={t:Date.now(),ctx:JSON.stringify(ctx)};return cache.ctx}
function sys(ctx){const today=new Date().toISOString().slice(0,10);return `You are Mack Living's bid assistant on the Mack Living contract pipeline site. Today is ${today}.
Rules:
- Answer ONLY from the DATA below. If the data does not say, say it is unknown or not in the data. Never invent contracts, values, dates, people or IDs.
- Cite opportunity IDs (MP-xx) for every opportunity you mention, and cite BiP record IDs (BE-xx) and fact IDs (F-xxx) where they support a claim.
- Always distinguish a framework CEILING (maximum possible value) from actual spend or an awarded contract value, and a framework appointment from a call-off award. Use valueBasis to say which.
- Ranking: items are already ranked by the site's model (status Eligible first, then Qualify capped at 65 because a gate is UNKNOWN; Research needed and Excluded are unranked). Explain priorities using status, score, gates, deadline and the "why"/"next" fields.
- Unknown inputs (null) are unknown, never zero and never a pass.
- For date questions compare deadline/start dates with today's date; say when a deadline is null (unknown).
- UK English, concise, plain text with short bullet points. Format money as £ with m/k. Never use em dashes or en dashes; use commas, colons or the word "to".
DATA (JSON, checked ${''}):
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
 const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,temperature:0.2,max_tokens:900,messages:[{role:'system',content:sys(ctx)},...msgs]})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)return j({error:'AI error: '+(d.error&&d.error.message||r.status)},502,o);
 let a=(d.choices&&d.choices[0]&&d.choices[0].message.content)||'';a=a.replace(/\s*[\u2013\u2014]\s*/g,', ');
 return j({answer:a,model:MODEL,usage:d.usage,dataBuilt:JSON.parse(ctx).built},200,o)}};
