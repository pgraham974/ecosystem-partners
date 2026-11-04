#!/usr/bin/env python3
"""Exactly-one-home check. Every record (all workbook records plus pipeline, partners, competitors, sites, contracts, notices, LHA rows)
must sit in exactly one row of exactly one tab of site-data.json, and the workbook must mirror the tabs (same sheet names, columns, IDs).
  python3 build/coverage_check.py [--dom URL] [out.json]   exit 1 on any missing or duplicated record, drift, dash, or JS error."""
import sys,os,json,re,collections
HERE=os.path.dirname(os.path.abspath(__file__));SITE=os.path.dirname(HERE);sys.path.insert(0,HERE)
import v4_records as VR
def universe():
    R=VR.load();J=json.load(open(os.path.join(SITE,'v4-enrich.json')))
    K=set(VR.keys(R,J.get('mack',{}).get('focusOpps',[])))
    MP=json.load(open(os.path.join(SITE,'mack-pipeline.json')));ML=json.load(open(os.path.join(SITE,'mack-living.json')));L=json.load(open(os.path.join(SITE,'market-lha.json')))
    K|={'PIPE:'+i['id'] for i in MP['items']}|{'PARTNER:'+b['name'] for b in MP['buyers']}|{'COMP:'+c['id'] for c in MP['competitors']}
    K|={'SITE:'+s['id'] for s in ML['sites']+ML['watchlist']}|{'ML:'+c['id'] for c in ML['contracts']}|{'NEW:'+n['id'] for n in J['newItems']}
    K|={'BRMA:'+r['name'] for r in L['rates']}|{'SCORE:'+k for k in 'ABCDE'}|{'SCORE:Gates'}
    if os.path.exists(os.path.join(SITE,'bip-data.json')):K|={'BIPDATA:'+str(r['id']) for r in json.load(open(os.path.join(SITE,'bip-data.json')))['rows']}
    return K
def check(homes,K,label,fail):
    c=collections.Counter(k for ks in homes.values() for k in ks)
    miss=sorted(K-set(c));dup=sorted(k for k,n in c.items() if n>1);extra=sorted(set(c)-K)
    fail+=['%s missing: %s'%(label,k) for k in miss]+['%s duplicated: %s'%(label,k) for k in dup]+['%s unknown record: %s'%(label,k) for k in extra]
    return len(K)-len(miss),len(dup)
def main():
    fail=[];K=universe();S=json.load(open(os.path.join(SITE,'site-data.json')))
    homes={};per={}
    for t in S['tabs']:
        ks=[k for s in t['sections'] for r in s['rows'] for k in [r['_rec']]+r.get('_also',[])];homes[t['key']]=ks;per[t['name']]=len(ks)
    ok,dup=check(homes,K,'data',fail)
    raw=open(os.path.join(SITE,'site-data.json'),encoding='utf-8').read()+open(os.path.join(SITE,'index.html'),encoding='utf-8').read()+open(os.path.join(SITE,'app.js'),encoding='utf-8').read()
    if re.search('[\u2013\u2014]',raw):fail.append('em or en dash found in site text')
    from openpyxl import load_workbook
    wb=load_workbook(os.path.join(SITE,S['workbook']),read_only=True)
    if wb.sheetnames!=[t['name'][:31] for t in S['tabs']]:fail.append('workbook sheets %s do not match tabs'%wb.sheetnames)
    else:
        for t in S['tabs']:
            vals=[r for r in wb[t['name'][:31]].iter_rows(values_only=True)];i=0
            for s in t['sections']:
                while i<len(vals) and vals[i][0]!=s['name']:i+=1
                hdr=[x for x in vals[i+1] if x is not None];ids=[str(v[[c[0] for c in s['cols']].index('id')]) for v in vals[i+2:i+2+len(s['rows'])]]
                if hdr!=[c[1] for c in s['cols']]:fail.append('workbook columns drift: '+s['name'])
                if ids!=[str(r['id']) for r in s['rows']]:fail.append('workbook IDs drift: '+s['name'])
                i+=2+len(s['rows'])
    print('records %d, homed exactly once %d, duplicates %d'%(len(K),ok-dup,dup));print('per tab',per)
    rep={'records':len(K),'perTab':per}
    if '--dom' in sys.argv:
        url=sys.argv[sys.argv.index('--dom')+1];dom,errs=dom_scan(url,S);rep['domPerTab']={k:len(v) for k,v in dom.items()};rep['errors']=errs
        okd,dupd=check(dom,K,'DOM',fail);print('DOM homed %d/%d, duplicates %d'%(okd,len(K),dupd),rep['domPerTab'])
        if errs:fail.append('console errors: %s'%errs[:3])
    out=[a for a in sys.argv[1:] if a.endswith('.json')]
    if out:json.dump(rep,open(out[0],'w'),indent=1)
    for f in fail[:60]:print('FAIL',f)
    print('COVERAGE','FAIL (%d)'%len(fail) if fail else 'OK');sys.exit(1 if fail else 0)
def dom_scan(url,S,shots=None):
    from playwright.sync_api import sync_playwright
    errs=[];res={}
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']);pg=b.new_page(viewport={'width':1500,'height':1000})
        pg.on('console',lambda m:m.type=='error' and errs.append(m.text));pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto(url,wait_until='networkidle')
        for t in S['tabs']:
            pg.evaluate("location.hash='%s'"%t['key']);pg.wait_for_timeout(1200)
            res[t['key']]=pg.evaluate("[...document.querySelectorAll('[data-rec]')].flatMap(x=>[x.dataset.rec,...(x.dataset.also||'').split(';').filter(Boolean)])")
            if shots:pg.screenshot(path=os.path.join(shots,t['key']+'.png'))
        b.close()
    return res,errs
if __name__=='__main__':main()
