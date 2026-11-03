(function(root){
// Mack Living pipeline scoring. Inputs are 0-3 or null (unknown). Unknown is never scored as zero:
// it is left out of the weighted average and lowers coverage instead.
const KEYS=['A','B','C','D','E'];
function score(item,W){let num=0,den=0,tot=0;for(const k of KEYS){const w=+W[k]||0;tot+=w;const v=item.inputs[k];if(v==null)continue;num+=w*v/3*100;den+=w}
 const cov=tot?den/tot:0;const raw=den?num/den:null;const g=Object.values(item.gates||{});
 let status,score=raw==null?null:Math.round(raw*10)/10;
 if(g.includes('FAIL'))status='Excluded';else if(cov<0.5)status='Research needed';else if(g.includes('UNKNOWN')){status='Qualify';if(score!=null)score=Math.min(score,65)}else status='Eligible';
 const comp={};for(const k of KEYS)comp[k]=item.inputs[k]==null?null:Math.round(item.inputs[k]/3*100);
 return {score,raw:raw==null?null:Math.round(raw*10)/10,coverage:Math.round(cov*100)/100,status,comp,unknownGates:g.filter(x=>x==='UNKNOWN').length}}
const ORDER={'Eligible':0,'Qualify':1,'Research needed':2,'Excluded':3};
function rank(items,W){const out=items.map(i=>Object.assign({},i,{s:score(i,W)}));
 out.sort((a,b)=>ORDER[a.s.status]-ORDER[b.s.status]||(b.s.score??-1)-(a.s.score??-1)||(b.s.raw??-1)-(a.s.raw??-1)||(b.inputs.E??-1)-(a.inputs.E??-1)||(b.inputs.B??-1)-(a.inputs.B??-1)||a.id.localeCompare(b.id));
 let r=0;for(const o of out)o.rank=(o.s.status==='Eligible'||o.s.status==='Qualify')?++r:null;return out}
const api={score,rank,KEYS};if(typeof module!=='undefined')module.exports=api;else root.MackPipelineModel=api})(this);
