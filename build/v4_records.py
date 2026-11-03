"""Shared workbook record loader for enrich_site.py and coverage_check.py.
Every record in the newest Laurito_Opportunities workbook gets a key (e.g. OPP:GM-001) and the tabs it must appear in.
Sheets not surfaced on tabs are listed in SHEETS_ONLY with a reason; any other sheet, or any record without a tab, fails the coverage check."""
import os,re,glob,datetime as dt
import openpyxl
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(HERE)
def newest_workbook():
    c=glob.glob(os.path.join(ROOT,'Laurito_Opportunities_v*.xlsx'))+glob.glob(os.path.join(ROOT,'..','Laurito_Opportunities_v*.xlsx'))
    return sorted(c,key=lambda p:os.path.basename(p))[-1]
def clean(v):
    if isinstance(v,(dt.datetime,dt.date)):return v.strftime('%Y-%m-%d')
    if isinstance(v,float):return round(v,2)
    if isinstance(v,str):return re.sub(r'\s*[\u2013\u2014]\s*',' - ',v).strip()
    return v
def ids(s):
    out=[]
    for x in re.split(r'[,;/]',str(s or '')):
        x=x.strip()
        m=re.match(r'^([A-Z]{2})-(\d+)\.\.([A-Z]{2})-(\d+)$',x)
        if m:out+=['%s-%03d'%(m.group(1),i) for i in range(int(m.group(2)),int(m.group(4))+1)]
        elif re.match(r'^[A-Z]{1,3}-\d+$',x):out.append(x)
    return out
SHEETS_ONLY={
 'README':'Workbook cover note; its caveats are restated in each tab panel footer.',
 'Priority_Ranking':'Derived view of Opportunity_Scoring; every ranked row is shown on the tabs as an OPP card with its rank.',
 'Sources':'URL health-check log (HTTP status per URL); the URLs themselves appear as linked fact and BiP chips.',
 'Property_Pipeline':'Empty input template (0 property rows). The coverage check fails if rows are added, so they get mapped.',
 'Test_Cases':'Synthetic test rows that check the scoring formulas; not real partners.',
 'Checks':'Workbook self-checks (formula results vs expected); not partner data.',
 'Change_Log':'Audit trail of edits between versions; current values are what the tabs show.',
 'Orig_Contacts':'Archived v2 contacts; the Frameworks tab Outreach contacts directory carries the published contacts.',
 'Orig_Evidence_Register':'Archived v2 evidence, superseded by Fact_Register (all 58 facts are on the tabs).',
 'Orig_Engagement_Log':'Archived v2 engagement notes, superseded by v4 Next action on each card.',
 'Orig_Scoring_Model_v2':'Retired v2 scoring model, replaced by v4 Methodology (on the Partner screen).',
 'Orig_Score_Breakdown_v2':'Retired v2 score breakdown, replaced by v4 A-E components on each card.',
 'Orig_Capture_Template':'Blank v2 data-capture template.',
 'Orig_Read_Me':'Archived v2 read-me.',
 'Orig_Lists':'Drop-down lists for the v2 template.',
}
MAPPED=['Opportunity_Scoring','Fact_Register','BiP_Evidence','Counterparty_Financials','Demand_Register','Benchmarks','Partner_Terms','Methodology']
RP_T=r'Provider|Commissioner|Intermediary';OP_T=r'Direct lessee|Broker|Provider'
def rows(wb,name):
    rs=list(wb[name].iter_rows(values_only=True));h=[str(x).strip() if x else '' for x in rs[0]]
    return h,rs[1:]
def table(wb,name,keyre):
    h,rs=rows(wb,name);out=[]
    for r in rs:
        if not r or r[0] is None or not re.match(keyre,str(r[0])):continue
        out.append({h[i]:clean(v) for i,v in enumerate(r) if i<len(h) and h[i] and v is not None})
    return out
def load(wbp=None):
    wbp=wbp or newest_workbook();wb=openpyxl.load_workbook(wbp,data_only=True)
    R={'path':wbp,'sheets':wb.sheetnames}
    R['opps']=table(wb,'Opportunity_Scoring',r'^[A-Z]{2}-\d')
    R['facts']=table(wb,'Fact_Register',r'^F-\d')
    R['bip']=table(wb,'BiP_Evidence',r'^BE-\d')
    R['fin']=table(wb,'Counterparty_Financials',r'^[A-Z0-9]{3,}$')
    R['demand']=table(wb,'Demand_Register',r'^DR-\d')
    R['lha']=table(wb,'Benchmarks',r'^.+\|\d+$')
    R['terms']=[dict(r,_k='T%02d'%(i+1)) for i,r in enumerate(table(wb,'Partner_Terms',r'^\w'))]
    meth=[]
    for i,r in enumerate(wb['Methodology'].iter_rows(values_only=True)):
        cells=[clean(c) for c in r if c not in (None,'')]
        if cells:meth.append({'_k':'M%03d'%(i+1),'cells':[str(c) for c in cells]})
    R['meth']=meth
    R['pipeline_rows']=sum(1 for r in wb['Property_Pipeline'].iter_rows(min_row=2,values_only=True) if any(c not in (None,'') for c in r))
    return R
def keys(R,focus=()):
    """Return {record_key: set(expected tabs)}."""
    K={}
    dem_opps={d.get('Opp ID') for d in R['demand']}
    term_opps={o for t in R['terms'] for o in ids(t.get('Opp ID'))}
    for o in R['opps']:
        t={'pscreen'};ty=o.get('Row type (v3)','') or ''
        if re.search(RP_T,ty):t.add('rp')
        if re.search(OP_T,ty):t.add('operators')
        if o['Opp ID'] in focus or o['Opp ID'] in dem_opps or o['Opp ID'] in term_opps:t.add('mack')
        K['OPP:'+o['Opp ID']]=t
    for f in R['facts']:K['FACT:'+f['Fact ID']]={'pscreen'}
    for b in R['bip']:K['BIP:'+b['Evidence ID']]={'frameworks'}
    for f in R['fin']:K['FIN:'+f['Key']]={'pscreen'}
    for d in R['demand']:K['DR:'+d['Req ID']]={'mack'}
    for l in R['lha']:K['LHA:'+l['Lookup key (BRMA|beds)']]={'mack'}
    for t in R['terms']:K['TERMS:'+t['_k']]={'mack'}
    for m in R['meth']:K['METH:'+m['_k']]={'pscreen'}
    return K
