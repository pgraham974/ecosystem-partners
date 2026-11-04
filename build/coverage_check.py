#!/usr/bin/env python3
"""Coverage check: every workbook record must reach the site's integrated tabs.
  python3 build/coverage_check.py                 data mode: site/v4-enrich.json placements cover every record (fails otherwise)
  python3 build/coverage_check.py --dom URL [out.json]   also render each tab headless and confirm each record is in that tab's DOM
Exit code 1 on any unmapped sheet, unmapped record, or record missing from its tab."""
import sys,os,json,re
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import v4_records as VR
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(HERE)
SITE=os.path.join(ROOT,'site') if os.path.isdir(os.path.join(ROOT,'site')) else ROOT
TABS=['frameworks','mack','rp','pscreen','operators']
def main():
    R=VR.load();fail=[]
    for s in R['sheets']:
        if s not in VR.MAPPED and s not in VR.SHEETS_ONLY:fail.append('sheet not mapped and no Sheets-only reason: '+s)
    if R['pipeline_rows']:fail.append('Property_Pipeline has %d rows but no tab mapping'%R['pipeline_rows'])
    J=json.load(open(os.path.join(SITE,'v4-enrich.json')));P={k:set(v) for k,v in J.get('placements',{}).items()}
    K=VR.keys(R,J.get('mack',{}).get('focusOpps',[]))
    miss=[k for k in K if not P.get(k)];short=[k for k in K if P.get(k) and not K[k]<=P[k]]
    fail+=['record has no tab: '+k for k in miss]+['record missing expected tab %s: %s'%(sorted(K[k]-P[k]),k) for k in short]
    by={}
    for k in K:by.setdefault(k.split(':')[0],0);by[k.split(':')[0]]+=1
    print('workbook',os.path.basename(R['path']),'records',len(K),by)
    print('data mode: mapped %d/%d'%(len(K)-len(miss),len(K)))
    rep={'records':len(K),'byType':by,'dataUnmapped':miss}
    if '--dom' in sys.argv:
        url=sys.argv[sys.argv.index('--dom')+1];dom=dom_scan(url,K,R);rep['dom']=dom
        for t in TABS:print('DOM %-10s expected %4d present %4d missing %d'%(t,dom[t]['expected'],dom[t]['present'],len(dom[t]['missing'])))
        for t in TABS:fail+=['%s missing in DOM: %s'%(t,k) for k in dom[t]['missing']]
        if dom['errors']:fail.append('console errors: %s'%dom['errors'][:3])
    out=[a for a in sys.argv[1:] if a.endswith('.json')]
    if out:json.dump(rep,open(out[0],'w'),indent=1,default=list)
    for f in fail[:60]:print('FAIL',f)
    print('COVERAGE','FAIL (%d)'%len(fail) if fail else 'OK');sys.exit(1 if fail else 0)
def needles(k,R):
    t,i=k.split(':',1);n=[i]
    if t=='FIN':
        f=next(x for x in R['fin'] if x['Key']==i);n=[f.get('Signing / counterparty entity','')]
    if t=='TERMS':
        x=next(x for x in R['terms'] if x['_k']==i);n=[str(x.get('Programme',''))]
    if t=='LHA':
        x=next(x for x in R['lha'] if x['Lookup key (BRMA|beds)']==i);n=['%.2f'%x['LHA £ pcm (UC monthly)']]
    if t=='METH':
        x=next(x for x in R['meth'] if x['_k']==i);n=[x['cells'][0][:60]]
    return [s for s in n if s]
def dom_scan(url,K,R):
    from playwright.sync_api import sync_playwright
    res={'errors':[]}
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']);pg=b.new_page(viewport={'width':1400,'height':1000})
        pg.on('console',lambda m:m.type=='error' and res['errors'].append(m.text));pg.on('pageerror',lambda e:res['errors'].append(str(e)))
        pg.goto(url,wait_until='networkidle')
        for t in TABS:
            pg.evaluate(f"viewMode('{t}')");pg.wait_for_timeout(3000)
            d=pg.evaluate("""(()=>{const v=[...document.querySelectorAll('[id$=_view]')].find(x=>!x.classList.contains('hidden'))||document.body;
              const recs=[...v.querySelectorAll('[data-rec]')].flatMap(x=>x.dataset.rec.split(' '));return {recs,txt:v.textContent}})()""")
            recs=set(d['recs']);txt=d['txt'];exp=[k for k,v in K.items() if t in v];pres=[];all_=[]
            for k in K:
                ok=k in recs or any(n in txt for n in needles(k,R))
                if ok:all_.append(k)
            miss=[k for k in exp if k not in all_]
            res[t]={'expected':len(exp),'present':len(exp)-len(miss),'anyRecordPresent':len(all_),'missing':miss}
        b.close()
    return res
if __name__=='__main__':main()
