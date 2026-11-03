const M=require('./mack-pipeline-model.js'),assert=require('assert'),D=require('./mack-pipeline.json');
const W={A:25,B:15,C:25,D:20,E:15};
const base={id:'T',inputs:{A:3,B:3,C:3,D:3,E:3},gates:{a:'PASS',b:'PASS'}};
assert.equal(M.score(base,W).score,100);assert.equal(M.score(base,W).status,'Eligible');
// unknown is not zero
const u={...base,inputs:{...base.inputs,D:null}};assert.equal(M.score(u,W).score,100);assert.equal(M.score(u,W).coverage,0.8);
const z={...base,inputs:{...base.inputs,D:0}};assert.equal(M.score(z,W).score,80);
// unknown gate caps at 65
assert.equal(M.score({...base,gates:{a:'UNKNOWN'}},W).score,65);assert.equal(M.score({...base,gates:{a:'UNKNOWN'}},W).status,'Qualify');
assert.equal(M.score({...base,gates:{a:'FAIL'}},W).status,'Excluded');assert.equal(M.score({...base,gates:{a:'N/A'}},W).status,'Eligible');
assert.equal(M.score({...base,inputs:{A:3,B:null,C:null,D:null,E:null}},W).status,'Research needed');
// ranking: eligible before qualify regardless of score
const r=M.rank([{...base,id:'Q',gates:{a:'UNKNOWN'}},{...base,id:'E',inputs:{A:1,B:1,C:1,D:1,E:1}}],W);assert.equal(r[0].id,'E');
// data integrity
const ids=new Set();for(const i of D.items){assert(!ids.has(i.id));ids.add(i.id);for(const k of M.KEYS){const v=i.inputs[k];assert(v==null||[0,1,2,3].includes(v),i.id+k)}for(const g of Object.values(i.gates))assert(['PASS','FAIL','UNKNOWN','N/A'].includes(g))}
const txt=JSON.stringify(D.items)+JSON.stringify(D.components)+JSON.stringify(D.scale);assert(!/[\u2013\u2014]/.test(txt),'no em or en dashes');
console.log('mack-pipeline-model tests OK',D.items.length,'items');
