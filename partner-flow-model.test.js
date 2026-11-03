/* Run: node partner-flow-model.test.js [optional/path/to/sheets_public.json] */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'partner-flow-model.js'),'utf8'),sandbox,{filename:'partner-flow-model.js'});
const build=(data,today='2026-11-03')=>JSON.parse(JSON.stringify(sandbox.window.PartnerFlowModel.build(data,today)));
const dimNames=['Rent vs evidenced OMR','Net effective income','Void / nomination protection','Term, breaks & indexation','Current commissioned demand','Regional requirement','Breadth of property fit','Repeatable buy box','Repairs & operating costs','Scale / capital deployment','Covenant / contract linkage','Engagement route'];
const weights=[15,10,8,7,10,8,7,5,10,10,5,5];
const gates=['G1 Rent','G2 Net income','G3 Term','G4 Voids','G5 Repairs','G6 Operating costs','G7 Defined demand','G8 Scale','G9 Approval','G10 Covenant'];
function sheet(name,objects){const columns=[...new Set(objects.flatMap(Object.keys))];return {name,columns,rows:objects.map(o=>columns.map(c=>o[c]??null))};}
function fixture({gate='PASS',demandStatus='Live – sourcing',review='2026-10-30',score=weights}={}){
  return {importedAt:'2026-10-20',books:[{id:'test-book',title:'Test workbook',filename:'original.xlsx',sheets:[
    sheet('Opportunities',[{'Source row':5,'Opp ID':'GM-001',Organisation:'Same Company','Region':'Greater Manchester','Core score (/100)':88,'Evidence refs':'E1, E999','Next action due':'03/11/2026',...Object.fromEntries(gates.map(g=>[g,gate]))},{'Source row':6,'Opp ID':'GM-002',Organisation:'Same Company','Core score (/100)':72}]),
    sheet('Demand Register',[{'Source row':8,'Req ID':'DR-1','Opp ID':'GM-001','Requirement status':demandStatus,'Review by':review}]),
    sheet('Partner Terms',[{'Source row':9,'Opp ID':'GM-001 / GL-001 / BR-002',Partner:'Same Company',Evidence:'E2'}]),
    sheet('Contacts',[{'Source row':10,'Opp ID':'GM-001','Contact ID':'C1','Name / team':'Explicit'},{'Source row':11,'Opp ID':'GM-0010','Name / team':'Wrong prefix'},{'Source row':12,'Opp ID':'GM-001-C01','Name / team':'Wrong contact token'},{'Source row':13,'Opp ID':null,'Organisation (lookup)':'Same Company','Name / team':'Wrong company join'}]),
    sheet('Evidence Register',[{'Source row':14,Code:'E1','Linked Opp IDs':'All','Source type':'Primary'},{'Source row':15,Code:'E2','Linked Opp IDs':'GL-001'},{'Source row':16,Code:'E3','Linked Opp IDs':'GM-001 / GM-002','Contradiction flag':'Yes – reported conflict'},{'Source row':17,Code:'E4','Linked Opp IDs':'All GM'}]),
    sheet('Engagement Log',[{'Source row':18,'Opp ID':'GM-001','Date':'2026-10-20','Status':'Closed'}]),
    sheet('Score Breakdown',[{'Source row':19,'Opp ID':'GM-001',...Object.fromEntries(dimNames.map((n,i)=>[n,score[i]]))}])]}]};
}
function change(data,name,field,value,row=0){const s=data.books[0].sheets.find(s=>s.name===name);let i=s.columns.indexOf(field);if(i<0){i=s.columns.length;s.columns.push(field);for(const r of s.rows)r.push(null);}s.rows[row][i]=value;return data;}
let passed=0,failed=0;const tests=[];
function test(name,fn){try{fn();passed++;tests.push('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);process.exitCode=1;}}
test('exposes only build and exact top-level shape',()=>{assert.deepEqual(Object.keys(sandbox.window.PartnerFlowModel),['build']);assert.deepEqual(Object.keys(build(fixture())),['opportunities','stats']);});
test('all twelve valid dimensions produce 100, never seed score',()=>{const o=build(fixture()).opportunities[0];assert.equal(o.coreScore,100);assert.equal(o.seedScore,88);assert.equal(o.dimensions.reduce((s,d)=>s+d.max,0),100);});
test('blank/invalid/out-of-range dimensions cannot coerce into score',()=>{for(const v of [null,'',true,false,'not scored','8/8',-1,16,Infinity]){const f=fixture();change(f,'Score Breakdown',dimNames[0],v);assert.equal(build(f).opportunities[0].coreScore,null,String(v));}});
test('zero is explicit and numeric strings are unambiguous',()=>{const f=fixture({score:weights.map(()=>0)});assert.equal(build(f).opportunities[0].coreScore,0);change(f,'Score Breakdown',dimNames[0],'15');assert.equal(build(f).opportunities[0].coreScore,15);});
test('duplicate score rows do not silently choose one',()=>{const f=fixture();const s=f.books[0].sheets.find(s=>s.name==='Score Breakdown');s.rows.push(s.rows[0].slice());assert.equal(build(f).opportunities[0].coreScore,null);});
test('exact joins reject prefixes/contact IDs/company names',()=>{const os=build(fixture()).opportunities;assert.equal(os[0].contacts.length,1);assert.equal(os[1].contacts.length,0);assert.equal(os[1].demands.length,0);});
test('slash-separated Opp IDs link terms and evidence',()=>{const o=build(fixture()).opportunities[0];assert.equal(o.terms.length,1);assert.ok(o.evidence.some(e=>e.id==='E3'));});
test('evidence is exact union of codes and Opp IDs, not All GM',()=>{const o=build(fixture()).opportunities[0];assert.deepEqual(o.evidence.map(e=>e.id),['E1','E2','E3']);assert.deepEqual(o.missingEvidenceRefs,['E999']);assert.ok(o.evidence.every(e=>e.verified===false));});
test('factual flags distinct from evidence-link metadata',()=>{const o=build(fixture()).opportunities[0];assert.equal(o.contradictions.length,1);assert.ok(o.contradictions[0].includes('E3'));});
test('all overdue reviews downgrade G7 only, preserve commercial PASS',()=>{const o=build(fixture()).opportunities[0];assert.equal(o.reviewOverdue,true);assert.equal(o.allReviewsOverdue,true);assert.equal(o.readiness,95);assert.equal(o.gates[6].sourceStatus,'PASS');assert.equal(o.gates[6].status,'CONDITIONAL');assert.equal(o.gates[0].status,'PASS');assert.ok(o.gates[6].reasons.length);});
test('all paused demands downgrade G7 but preserve historic report',()=>{for(const status of ['Paused / not sourcing','Closed / filled','Not sourcing']){const o=build(fixture({demandStatus:status})).opportunities[0];assert.equal(o.gates[6].status,'NOT DEMONSTRATED');assert.equal(o.gates[6].sourceStatus,'PASS');assert.equal(o.demands[0].status,status);assert.equal(o.demands[0].reportedStatus,status);assert.equal(o.pausedDemand,true);assert.equal(o.reviewOverdue,true);}});
test('CONDITIONAL G7 also downgrades when all demand paused',()=>{assert.equal(build(fixture({gate:'CONDITIONAL',demandStatus:'Paused'})).opportunities[0].gates[6].status,'NOT DEMONSTRATED');});
test('mixed active/paused and overdue/future do not trigger all-rules',()=>{const f=fixture({demandStatus:'Paused'});const s=f.books[0].sheets.find(s=>s.name==='Demand Register');s.rows.push(s.rows[0].slice());change(f,'Demand Register','Requirement status','Live – sourcing',1);change(f,'Demand Register','Review by','2026-11-27',1);const o=build(f).opportunities[0];assert.equal(o.allPausedDemand,false);assert.equal(o.allReviewsOverdue,false);assert.equal(o.pausedDemand,true);assert.equal(o.reviewOverdue,true);assert.equal(o.gates[6].status,'PASS');});
test('missing review date prevents all-review downgrade',()=>{const f=fixture();const s=f.books[0].sheets.find(s=>s.name==='Demand Register');s.rows.push(s.rows[0].slice());change(f,'Demand Register','Review by',null,1);assert.equal(build(f).opportunities[0].gates[6].status,'PASS');});
test('FAIL never promoted; narrative does not imply PASS',()=>{const f=fixture({gate:'FAIL'});change(f,'Opportunities','G1 Rent','Rent guaranteed and perfect');const o=build(f).opportunities[0];assert.equal(o.gates[0].status,'NOT DEMONSTRATED');assert.equal(o.gates[1].status,'FAIL');assert.equal(o.readiness,0);assert.deepEqual(o.gateCounts,{pass:0,conditional:0,fail:9,unknown:1,total:10});});
test('today strict ISO, dates calendar checked',()=>{for(const day of ['2026-02-29','2026-13-01','2026-11-31','03/11/2026','2026-11-03T00:00:00Z','0000-01-01'])assert.throws(()=>build(fixture(),day));assert.equal(build(fixture(),'2028-02-29').stats.today,'2028-02-29');assert.equal(build(fixture()).opportunities[0].nextDue,null);});
test('review due today not overdue; invalid dates not guessed',()=>{for(const d of ['2026-11-03','30/10/2026','2026-02-30']){const o=build(fixture({review:d})).opportunities[0];assert.equal(o.reviewOverdue,false);assert.equal(o.gates[6].status,'PASS');}});
test('omitted today uses deterministic importedAt',()=>{const m=sandbox.window.PartnerFlowModel.build(fixture());assert.equal(m.stats.today,'2026-10-20');assert.equal(m.opportunities[0].reviewOverdue,false);});
test('source metadata on opportunities and related objects',()=>{const o=build(fixture()).opportunities[0];for(const r of [o,...o.demands,...o.terms,...o.contacts,...o.evidence,...o.engagements,...o.gates,...o.dimensions]){assert.equal(r.source.bookId,'test-book');assert.equal(r.source.filename,'original.xlsx');assert.ok(r.source.sheet);assert.ok(r.source.row>=5);}assert.equal(o.demands[0].source.row,8);assert.equal(o.dimensions[0].source.row,19);});
test('pure deterministic build never mutates input',()=>{const f=fixture(),before=JSON.stringify(f);const a=build(f),b=build(f);assert.equal(JSON.stringify(f),before);assert.deepEqual(a,b);});
test('separate paused and overdue counters',()=>{const r=build(fixture({demandStatus:'Paused',review:'2027-01-29'}));assert.equal(r.stats.pausedDemand,1);assert.equal(r.stats.reviewOverdue,0);assert.equal(r.stats.pausedDemandRecords,1);assert.equal(r.stats.overdueDemandRecords,0);});
test('empty well-formed input works',()=>{const r=build({books:[]});assert.equal(r.opportunities.length,0);assert.equal(r.stats.readinessAverage,0);});
const realPath=process.argv[2]||path.join(__dirname,'sheets_public.json');
if(fs.existsSync(realPath)) test('real snapshot: 60 opportunities, no invented core scores, full audit metadata',()=>{
  const input=JSON.parse(fs.readFileSync(realPath,'utf8')),r=build(input);
  assert.equal(r.opportunities.length,60);assert.equal(r.stats.coreScored,0);
  assert.equal(r.opportunities.find(o=>o.id==='GM-003').demands.length,2);
  assert.equal(r.opportunities.find(o=>o.id==='GM-003').gates[6].status,'FAIL');
  assert.equal(r.opportunities.find(o=>o.id==='GM-003').pausedDemand,true);
  assert.equal(r.opportunities.find(o=>o.id==='GM-003').reviewOverdue,false);
  assert.equal(r.opportunities.find(o=>o.id==='GL-001').terms.length,1);
  assert.equal(r.opportunities.find(o=>o.id==='BR-002').terms.length,1);
  assert.ok(r.opportunities.every(o=>o.source.bookId && o.source.sheet==='Opportunities' && o.source.row));
  console.log('REAL SNAPSHOT STATS '+JSON.stringify(r.stats));
});
console.log(tests.join('\n'));
console.log(passed+'/'+(passed+failed)+' tests passed');
