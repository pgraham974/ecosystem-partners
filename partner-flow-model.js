/* PartnerFlowModel: local workbook-snapshot adapter. No network, DOM, secrets or storage.
 * build(data, today) is pure. today must be a real YYYY-MM-DD date; when omitted,
 * the snapshot's importedAt is used, never the machine clock.
 * Raw workbook values are preserved under fields; aliases are not verification.
 */
(function (root) {
  'use strict';
  const DIMENSIONS = [
    ['Rent vs evidenced OMR',15], ['Net effective income',10],
    ['Void / nomination protection',8], ['Term, breaks & indexation',7],
    ['Current commissioned demand',10], ['Regional requirement',8],
    ['Breadth of property fit',7], ['Repeatable buy box',5],
    ['Repairs & operating costs',10], ['Scale / capital deployment',10],
    ['Covenant / contract linkage',5], ['Engagement route',5]
  ];
  const GATES = ['G1 Rent','G2 Net income','G3 Term','G4 Voids','G5 Repairs',
    'G6 Operating costs','G7 Defined demand','G8 Scale','G9 Approval','G10 Covenant'];
  const unique = xs => [...new Set(xs)];
  const text = v => v == null ? '' : String(v).trim();
  function iso(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const y=Number(v.slice(0,4)), m=Number(v.slice(5,7)), d=Number(v.slice(8,10));
    const days=[31,(y%4===0 && (y%100!==0 || y%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];
    return y>0 && m>=1 && m<=12 && d>=1 && d<=days[m-1] ? v : null;
  }
  // Whole ID tokens only: GM-001 never matches GM-0010 or GM-001-C01.
  // Slash/comma lists work. All/Various and numeric ranges are not expanded.
  function oppTokens(v) {
    const matches = text(v).matchAll(/(?:^|[^A-Za-z0-9-])([A-Z]{2,8}-\d{3,})(?![A-Za-z0-9-])/g);
    return unique([...matches].map(m=>m[1]));
  }
  function evidenceTokens(v) {
    return unique([...text(v).matchAll(/(?:^|[^A-Za-z0-9])([E]\d+)(?![A-Za-z0-9])/g)].map(m=>m[1]));
  }
  function number(v, max) {
    if (typeof v !== 'number' && !(typeof v === 'string' && /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(v.trim()))) return null;
    const n=typeof v==='number'?v:Number(v.trim());
    return Number.isFinite(n) && n>=0 && n<=max ? n : null;
  }
  function gateStatus(v) {
    const s=text(v).toUpperCase();
    return ['PASS','CONDITIONAL','FAIL'].includes(s) ? s : 'NOT DEMONSTRATED';
  }
  function paused(v) { return /\bpaused\b|\bnot sourcing\b|\bclosed\b/i.test(text(v)); }
  function flagged(v) { return /^yes\b/i.test(text(v)); }
  function counts(gates) {
    const c={pass:0,conditional:0,fail:0,unknown:0,total:gates.length};
    for (const g of gates) c[g.status==='PASS'?'pass':g.status==='CONDITIONAL'?'conditional':g.status==='FAIL'?'fail':'unknown']++;
    return c;
  }
  function records(data, name) {
    const result=[];
    for (const book of data.books || []) for (const sheet of book.sheets || []) {
      if (sheet.name!==name) continue;
      for (const row of sheet.rows || []) {
        const fields=Object.fromEntries((sheet.columns || []).map((col,i)=>[col,row[i]===undefined?null:row[i]]));
        result.push({fields,source:{bookId:book.id ?? null,bookTitle:book.title ?? null,
          filename:book.filename ?? null,sheet:sheet.name,row:fields['Source row'] ?? null}});
      }
    }
    return result;
  }
  function build(data, today) {
    if (!data || !Array.isArray(data.books)) throw new TypeError('Expected workbook data with a books array');
    if (today===undefined) today=data.importedAt;
    if (!iso(today)) throw new TypeError('today must be a real ISO YYYY-MM-DD date (or provide ISO importedAt)');
    const demands=records(data,'Demand Register').map(r=>{
      const f=r.fields, status=f['Requirement status'] ?? null, reviewBy=iso(f['Review by']);
      return {...r,id:f['Req ID'] ?? null,oppIds:oppTokens(f['Opp ID']),partner:f.Partner ?? null,
        region:f.Region ?? null,area:f['Area / local authority'] ?? null,programme:f['Programme / cohort'] ?? null,
        propertyType:f['Property type'] ?? null,status,reportedStatus:status,
        reviewBy,reviewOverdue:!!reviewBy && reviewBy<today,paused:paused(status),
        evidenceRefs:evidenceTokens(f['Evidence ref (Opp DB)'])};
    });
    const terms=records(data,'Partner Terms').map(r=>{const f=r.fields;return {...r,
      oppIds:oppTokens(f['Opp ID']),partner:f.Partner ?? null,programme:f.Programme ?? null,
      leaseTerm:f['Lease term'] ?? null,rentBasis:f['Rent basis'] ?? null,voids:f.Voids ?? null,
      repairs:f['Repairs / damage'] ?? null,operatingCosts:f['Utilities & council tax'] ?? null,
      indexation:f.Indexation ?? null,asAt:iso(f['As at']),evidenceRefs:evidenceTokens(f.Evidence)};});
    const contacts=records(data,'Contacts').map(r=>{const f=r.fields;return {...r,
      id:f['Contact ID'] ?? null,oppIds:oppTokens(f['Opp ID']),name:f['Name / team'] ?? null,
      role:f['Job title / function'] ?? null,email:f.Email ?? null,phone:f.Phone ?? null,
      verification:f.Verification ?? null,sourceDate:iso(f['Source date'])};});
    const evidence=records(data,'Evidence Register').map(r=>{const f=r.fields;return {...r,
      id:f.Code ?? null,oppIds:oppTokens(f['Linked Opp IDs']),title:f['Source / evidence'] ?? null,
      publisher:f.Publisher ?? null,date:iso(f['Publication / effective date']),type:f['Source type'] ?? null,
      fact:f['Exact fact (paraphrased)'] ?? null,url:f['URL / location'] ?? null,
      confidence:f.Confidence ?? null,contradiction:flagged(f['Contradiction flag']),
      contradictionFlag:f['Contradiction flag'] ?? null,verified:false};});
    const engagements=records(data,'Engagement Log').map(r=>{const f=r.fields;return {...r,
      oppIds:oppTokens(f['Opp ID']),date:iso(f.Date),type:f['Interaction type'] ?? null,
      summary:f.Summary ?? null,status:f.Status ?? null,nextDue:iso(f['Next action due']),
      owner:f['Next action owner'] ?? null,contactId:f['Contact ID'] ?? null};});
    const scoreRows=records(data,'Score Breakdown').map(r=>({...r,oppIds:oppTokens(r.fields['Opp ID'])}));
    const byId = (rows,id) => rows.filter(r=>r.oppIds.includes(id));
    const evidenceCodes=new Set(evidence.map(e=>e.id));
    const opportunities=records(data,'Opportunities').map(r=>{
      const f=r.fields, id=text(f['Opp ID']);
      const ds=byId(demands,id), ts=byId(terms,id), cs=byId(contacts,id), es=byId(engagements,id), ss=byId(scoreRows,id);
      // Deliberate evidence references are exact code joins; broad company names are never joins.
      const refs=unique([...evidenceTokens(f['Evidence refs']),...ds.flatMap(d=>d.evidenceRefs),...ts.flatMap(t=>t.evidenceRefs)]);
      const ev=evidence.filter(e=>e.oppIds.includes(id) || refs.includes(e.id));
      const missingEvidenceRefs=refs.filter(code=>!evidenceCodes.has(code));
      const allPausedDemand=ds.length>0 && ds.every(d=>d.paused);
      const allReviewsOverdue=ds.length>0 && ds.every(d=>d.reviewBy && d.reviewOverdue);
      const reviewOverdue=ds.some(d=>d.reviewOverdue), pausedDemand=ds.some(d=>d.paused);
      const contradictions=ev.filter(e=>e.contradiction).map(e=>e.id+': '+e.contradictionFlag);
      const gates=GATES.map(name=>{
        const sourceStatus=f[name] ?? null; let status=gateStatus(sourceStatus); const reasons=[];
        if (name==='G7 Defined demand' && allPausedDemand && ['PASS','CONDITIONAL'].includes(status)) {
          status='NOT DEMONSTRATED';
          reasons.push('All linked demand records report paused, not sourcing or closed; no current defined demand demonstrated.');
          contradictions.push('G7 '+sourceStatus+' conflicts with all linked demand being paused/not sourcing/closed.');
        }
        if (name==='G7 Defined demand' && allReviewsOverdue && status==='PASS') {
          status='CONDITIONAL'; reasons.push('All linked demand review dates are overdue as of '+today+'; reported PASS requires review.');
        }
        if (!['PASS','CONDITIONAL','FAIL'].includes(text(sourceStatus).toUpperCase())) reasons.push('No explicit recognised gate decision in workbook; narrative does not establish PASS.');
        return {name,status,sourceStatus,reasons,source:r.source};
      });
      const dimensions=DIMENSIONS.map(([name,max])=>({name,max,
        value:ss.length===1?number(ss[0].fields[name],max):null,source:ss.length===1?ss[0].source:null}));
      const complete=ss.length===1 && dimensions.every(d=>d.value!==null);
      const coreScore=complete?Number(dimensions.reduce((n,d)=>n+d.value,0).toFixed(8)):null;
      const gateCounts=counts(gates), readiness=gateCounts.pass*10+gateCounts.conditional*5;
      const blockers=gates.filter(g=>g.status!=='PASS').map(g=>g.name+': '+g.status);
      if (!complete) blockers.push(ss.length>1?'Multiple Score Breakdown rows: core score withheld.':'Core score not established: all 12 explicit valid dimensions required.');
      if (missingEvidenceRefs.length) blockers.push('Missing Evidence Register references: '+missingEvidenceRefs.join(', '));
      if (pausedDemand) blockers.push('Linked demand includes paused/not sourcing/closed records; historical status retained.');
      if (reviewOverdue) blockers.push('Linked demand review overdue; this is distinct from paused demand.');
      if (!ds.length) blockers.push('No Demand Register row linked by exact Opp ID.');
      if (contradictions.length) blockers.push('Reported contradictions require resolution.');
      return {id,name:f.Organisation ?? null,region:f.Region ?? null,
        programme:f['Opportunity / programme / contract'] ?? null,seedScore:number(f['Core score (/100)'],100),
        classification:f.Classification ?? null,nextAction:f['Primary evidence gap / next action'] ?? null,
        nextDue:iso(f['Next action due']),coreScore,dimensions,gates,readiness,
        readinessLabel:'Evidence coverage /100, not a credit or investment approval score',
        demands:ds,terms:ts,contacts:cs,evidence:ev,engagements:es,source:r.source,fields:f,
        reviewOverdue,pausedDemand,allPausedDemand,allReviewsOverdue,missingEvidenceRefs,
        contradictions,gateCounts,blockers};
    });
    const allGates=opportunities.flatMap(o=>o.gates);
    const stats={today,opportunities:opportunities.length,
      coreScored:opportunities.filter(o=>o.coreScore!==null).length,
      coreUnscored:opportunities.filter(o=>o.coreScore===null).length,
      reviewOverdue:opportunities.filter(o=>o.reviewOverdue).length,
      pausedDemand:opportunities.filter(o=>o.pausedDemand).length,
      overdueDemandRecords:demands.filter(d=>d.reviewOverdue).length,
      pausedDemandRecords:demands.filter(d=>d.paused).length,
      missingEvidenceRefs:unique(opportunities.flatMap(o=>o.missingEvidenceRefs)).length,
      opportunitiesWithMissingEvidence:opportunities.filter(o=>o.missingEvidenceRefs.length).length,
      contradictions:opportunities.filter(o=>o.contradictions.length).length,
      readinessAverage:opportunities.length?Number((opportunities.reduce((n,o)=>n+o.readiness,0)/opportunities.length).toFixed(2)):0,
      gateCounts:counts(allGates),
      linked:{demands:demands.filter(d=>opportunities.some(o=>d.oppIds.includes(o.id))).length,
        terms:terms.filter(t=>opportunities.some(o=>t.oppIds.includes(o.id))).length,
        contacts:contacts.filter(c=>opportunities.some(o=>c.oppIds.includes(o.id))).length,
        evidence:evidence.filter(e=>opportunities.some(o=>o.evidence.includes(e))).length,
        engagements:engagements.filter(e=>opportunities.some(o=>e.oppIds.includes(o.id))).length},
      limitations:[
        'Workbook snapshot only; reported facts, statuses, contacts and URLs are not independently verified.',
        'Joins use exact case-sensitive Opp ID tokens and explicit evidence-code references; no company-name joins, All/Various expansion or numeric-range expansion.',
        'A review date must be valid ISO YYYY-MM-DD. Due today is not overdue. All-review downgrade requires a valid overdue review date on every linked demand row.',
        'Readiness is recorded gate evidence coverage, not credit quality or investment approval. Core scores require one unambiguous complete Score Breakdown row.',
        'Evidence references indicate register presence, never verification. Source URL/location values can be private references or non-URLs.',
        'Omitted today uses the snapshot importedAt, not the current clock; pass today explicitly for current review flags.'
      ]};
    return {opportunities,stats};
  }
  root.PartnerFlowModel=Object.freeze({build});
})(typeof window!=='undefined'?window:globalThis);
