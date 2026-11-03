/* Pure browser financial-evidence screen. No network, DOM, clock or storage dependencies.
 * score and coverage are raw weighted points out of 100, never coverage-normalised.
 * An explicit ISO today is required. UNKNOWN evidence awards no points but is not FAIL.
 */
(function (root) {
  'use strict';
  const DEFAULT_WEIGHTS = Object.freeze({age:10,revenue:15,profit:15,assets:20,liquidity:15,staff:10,governance:10,freshness:5});
  const DEFAULT_THRESHOLDS = Object.freeze({years:10,revenue:1000000,assets:250000,staff:10,accountsMaxMonths:18});
  const KEYS = Object.keys(DEFAULT_WEIGHTS);
  const LABELS = {age:'Operating history',revenue:'Revenue',profit:'Profitability',assets:'Net assets',liquidity:'Net current assets',staff:'Employees',governance:'Governance',freshness:'Accounts freshness'};
  const FORMS = new Set(['plc','charity','registered provider (rsh)','registered provider+charity','registered society']);
  const number = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
  const text = v => typeof v === 'string' ? v.trim() : '';
  function iso(v) {
    if (typeof v !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)) return null;
    const [y,m,d] = v.split('-').map(Number);
    if (y < 1 || m < 1 || m > 12 || d < 1) return null;
    const leap = y%4===0 && (y%100!==0 || y%400===0);
    if (d > [31,leap?29:28,31,30,31,30,31,31,30,31,30,31][m-1]) return null;
    return {y,m,d,raw:v};
  }
  // Source records sometimes contain ISO midnight timestamps; do not loosen options.today.
  function fieldDate(v) {
    if (typeof v!=='string') return null;
    const match=/^([0-9]{4}-[0-9]{2}-[0-9]{2})(?:T00:00:00(?:\.000)?Z?)?$/.exec(v);
    return match?iso(match[1]):null;
  }
  function shiftMonths(date, amount) {
    const index = date.y*12+date.m-1+amount;
    const y = Math.floor(index/12), m = index-y*12+1;
    const leap = y%4===0 && (y%100!==0 || y%400===0);
    const d = Math.min(date.d,[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][m-1]);
    return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  }
  function configuration(options) {
    if (!options || typeof options!=='object' || Array.isArray(options)) throw new TypeError('options must be an object');
    const today=iso(options.today);
    if (!today) throw new TypeError('options.today must be an explicit valid YYYY-MM-DD date');
    function merge(defaults, supplied, kind) {
      if (supplied!==undefined && (!supplied || typeof supplied!=='object' || Array.isArray(supplied))) throw new TypeError(kind+' must be an object');
      const result={...defaults,...supplied};
      for (const key of Object.keys(result)) {
        if (!(key in defaults)) throw new TypeError('Unknown '+kind+' key: '+key);
        if (number(result[key])===null || result[key]<0) throw new TypeError(kind+'.'+key+' must be finite and nonnegative');
      }
      return result;
    }
    const weights=merge(DEFAULT_WEIGHTS,options.weights,'weights');
    if (Math.abs(KEYS.reduce((sum,key)=>sum+weights[key],0)-100)>Number.EPSILON*100*KEYS.length) throw new RangeError('weights must total 100');
    const thresholds=merge(DEFAULT_THRESHOLDS,options.thresholds,'thresholds');
    if (!Number.isInteger(thresholds.accountsMaxMonths) || thresholds.accountsMaxMonths<1) throw new RangeError('accountsMaxMonths must be a positive integer');
    return {today,weights,thresholds};
  }
  // A populated material-uncertainty flag is adverse; explicit negative / review-not-done text is not.
  function materialFlag(v) {
    if (v===true) return true;
    if (typeof v!=='string' || !v.trim()) return false;
    return !/^(?:no|none|false|n\/a|not applicable|unknown|not reviewed|not assessed)(?:$|[ .:;])/i.test(v.trim()) && !/^(?:clean|no material|going concern (?:fine|confirmed))/i.test(v.trim());
  }
  function evaluate(partner, options={}) {
    const {today,weights,thresholds:t}=configuration(options);
    const p=partner && typeof partner==='object' ? partner : {};
    const dimensions=[],hardStops=[],warnings=[];
    function add(key,status,value,reason) { dimensions.push({key,label:LABELS[key],weight:weights[key],status,points:status==='PASS'?weights[key]:0,value,reason}); }
    function metric(key,field,predicate,pass,fail) {
      const value=number(p[field]);
      add(key,value===null?'UNKNOWN':predicate(value)?'PASS':'FAIL',value,value===null?'No explicit valid '+field+' figure.':predicate(value)?pass:fail);
    }
    const started=fieldDate(p.started);
    const years=started ? today.y-started.y-((today.m<started.m || (today.m===started.m && today.d<started.d))?1:0) : null;
    if (!started) add('age','UNKNOWN',null,'No valid entity-specific ISO start date.');
    else if (started.raw>today.raw) add('age','FAIL',years,'Start date is in the future.');
    else add('age',years>=t.years?'PASS':'FAIL',years,'Completed operating years '+years+'; minimum '+t.years+'.');
    metric('revenue','turnover',v=>v>=t.revenue,'Explicit turnover meets minimum '+t.revenue+'.','Explicit turnover is below minimum '+t.revenue+'.');
    metric('profit','profit',v=>v>0,'Explicit profit is positive.','Explicit profit is zero or negative.');
    metric('assets','net_assets',v=>v>=t.assets,'Explicit net assets meet minimum '+t.assets+'.','Explicit net assets are below minimum '+t.assets+'.');
    metric('liquidity','net_current',v=>v>=0,'Explicit net current assets are nonnegative.','Explicit net current assets are negative.');
    metric('staff','employees',v=>v>=t.staff,'Explicit employees meet minimum '+t.staff+'.','Explicit employees are below minimum '+t.staff+'.');
    const form=text(p.form).toLowerCase().replace(/\s*\+\s*/g,'+'), board=number(p.board);
    const validBoard=board!==null && Number.isInteger(board) && board>=0 ? board : null;
    const boardValue=validBoard===null?null:validBoard+' board member'+(validBoard===1?'':'s');
    if (FORMS.has(form)) add('governance','PASS',p.form,'Entity legal form meets regulated governance criterion; this is not financial assurance.');
    else if (validBoard!==null && validBoard<=2) add('governance','FAIL',boardValue,'At most two known directors; governance criterion not met, not a hard credit stop.');
    else if (validBoard!==null && validBoard>=3 && (form==='cio' || p.owner_managed===false)) add('governance','PASS',boardValue,form==='cio'?'CIO with at least three board members.':'At least three directors and explicitly not owner-managed.');
    else if (validBoard!==null && validBoard>=3 && p.owner_managed===true) add('governance','FAIL',validBoard,'Explicitly owner-managed; governance criterion not met.');
    else add('governance','UNKNOWN',boardValue,'Insufficient entity-specific governance evidence; parent governance is not inherited.');
    const period=fieldDate(p.period_end);
    if (p.overdue===true) add('freshness','FAIL',period?period.raw:null,'Accounts explicitly overdue.');
    else if (!period) add('freshness','UNKNOWN',null,'No valid ISO accounts period end.');
    else if (period.raw>today.raw) add('freshness','FAIL',period.raw,'Accounts period end is in the future.');
    else add('freshness',period.raw>=shiftMonths(today,-t.accountsMaxMonths)?'PASS':'FAIL',period.raw,'Period end must be within the last '+t.accountsMaxMonths+' calendar months.');
    if (p.insolvency) hardStops.push('Active insolvency flag.');
    if (p.overdue===true) hardStops.push('Accounts overdue.');
    if (materialFlag(p.going_concern)) hardStops.push('Explicit material going-concern flag: '+String(p.going_concern));
    if (p.audit_qualified===true) hardStops.push('Qualified audit flag.');
    if (number(p.net_assets)!==null && p.net_assets<0) hardStops.push('Negative net assets.');
    const companyStatus=text(p.status).toLowerCase();
    if (companyStatus && !['active','unknown','n/a','not known','not available'].includes(companyStatus)) hardStops.push('Company status is non-active: '+text(p.status)+'.');
    const scopeFields=Object.keys(p).filter(k=>k==='acc_type'||k==='flags'||/^(turnover|net_assets|net_current|profit|employees)_(src|source)$/.test(k));
    const groupFields=scopeFields.filter(k=>/\b(group|consolidated|parent)\b/i.test(text(p[k])));
    if (groupFields.length) warnings.push('Parent/group figures or scope mentioned in '+groupFields.join(', ')+': check exact company scope; no entity-level assurance or automatic score inheritance.');
    if (text(p.parent_gov)) warnings.push('Parent governance only: '+p.parent_gov+'. Not evidence of this entity governance or a parent guarantee.');
    if (text(p.rp_group)) warnings.push('Registered-provider group context: '+p.rp_group+'. Verify the contracting company and scope; no group score inheritance.');
    if (text(p.flags)) warnings.push('Source flags (unverified narrative): '+p.flags);
    warnings.push('Financial-evidence screen only, not credit approval, solvency assurance or a parent guarantee; verify exact legal-entity scope.');
    const passed=dimensions.filter(d=>d.status==='PASS').map(d=>d.key);
    const failed=dimensions.filter(d=>d.status==='FAIL').map(d=>d.key);
    const unknown=dimensions.filter(d=>d.status==='UNKNOWN').map(d=>d.key);
    const isMack=p.no==='05543523';
    return {score:dimensions.reduce((sum,d)=>sum+d.points,0),coverage:dimensions.reduce((sum,d)=>sum+(d.status==='UNKNOWN'?0:d.weight),0),dimensions,passed,failed,unknown,status:hardStops.length?'Hold for review':passed.length===8?'Meets screen':'Review evidence',hardStops,warnings,pinned:isMack,isMack};
  }
  const ALIASES = {turnover:'revenue',net_assets:'assets',net_current:'liquidity',employees:'staff',board:'governance',started:'age',period_end:'freshness',company:'name',legal_name:'legal'};
  function sort(rows, options={}) {
    if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
    const key=ALIASES[options.key]||options.key||'score';
    const direction=options.direction===undefined?(key==='score'?'desc':'asc'):options.direction;
    if (!['asc','desc','ascending','descending'].includes(direction)) throw new TypeError('direction must be asc or desc');
    const sign=direction==='desc'||direction==='descending'?-1:1;
    function value(row) {
      const r=row.result||{},p=row.partner||{};
      if (key==='score'||key==='coverage') return number(r[key]);
      if (key==='status') return text(r.status)||null;
      if (KEYS.includes(key)) {
        const d=Array.isArray(r.dimensions)?r.dimensions.find(d=>d.key===key):null;
        return d && d.status!=='UNKNOWN' ? d.value : null;
      }
      const v=p[key];
      return number(v)!==null?v:text(v)||null;
    }
    return rows.map((row,index)=>({row,index})).sort((a,b)=>{
      const ap=a.row.partner?.no==='05543523',bp=b.row.partner?.no==='05543523';
      if (ap!==bp) return ap?-1:1;
      const av=value(a.row),bv=value(b.row);
      if (av===null || bv===null) return av===bv?a.index-b.index:av===null?1:-1;
      const cmp=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'en',{numeric:true,sensitivity:'base'});
      return cmp?Math.sign(cmp)*sign:a.index-b.index;
    }).map(item=>item.row);
  }
  root.MarketScore=Object.freeze({DEFAULT_WEIGHTS,DEFAULT_THRESHOLDS,evaluate,sort});
})(window);
