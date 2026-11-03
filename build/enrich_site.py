#!/usr/bin/env python3
"""Build site/v4-enrich.json from the latest Laurito Opportunities workbook.
Integrates v4 scoring (A-E, gates, eligibility, blocker, next action), BiP
award/notice/spend evidence and the Fact_Register into the site's own tabs
(Frameworks, Mack Living, RPs & charities, Partner screen, Operators).
Usage: python3 build/enrich_site.py [workbook.xlsx]   (default: newest Laurito_Opportunities_v*.xlsx)
Rerunnable by the daily sync; curated links live in FW_LINKS / NEW_ITEMS below."""
import sys,json,glob,os,re,datetime as dt
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import v4_records as VR
from v4_records import clean,ids
ROOT=VR.ROOT
SITE=os.path.join(ROOT,'site') if os.path.isdir(os.path.join(ROOT,'site')) else ROOT
RW=VR.load(sys.argv[1] if len(sys.argv)>1 else None);wbp=RW['path']
bip={r['Evidence ID']:r for r in RW['bip']}
facts={r['Fact ID']:r for r in RW['facts']}
S=RW['opps']
REF=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'bip_refresh.json')))
A_KEYS=['A1 Rent-paying role','A2 Current intake in geography','A3 Funded contract','A4 Committed term','A5 Cost transfer','A6 Rent vs LHA','A7 Scale','A8 Access route']
GATES=['G-Geo','G-Route live','G-Elig','G-Req','G-Role']
opps=[]
for r in S:
    oid=r['Opp ID']
    ev=[k for k,b in bip.items() if oid in ids(b.get('Opp IDs'))]
    org=r.get('Organisation (original)','')
    m=re.split(r' - |: | \(',org)[0].strip()
    m=re.sub(r'\b(Group|Limited|Ltd|UK|Housing Association|The)\b','',m).strip() if not org.startswith('TBC') else ''
    opps.append({'id':oid,'org':org,'match':m if len(m)>=4 else '','region':r.get('Region'),'type':r.get('Row type (v3)'),
      'entity':r.get('Signing / counterparty entity (v3)'),'role':r.get('Role in rent chain (verified / inferred)'),
      'rank':r.get('Rank (v4)'),'pi':r.get('PI rounded'),'A':r.get('A capped'),'Acov':r.get('A coverage'),'B':r.get('B rounded'),
      'Bcov':r.get('B coverage'),'E':r.get('E rounded'),'Eband':r.get('E band'),
      'comp':{k.split(' ',1)[0]:[k.split(' ',1)[1],r.get(k)] for k in A_KEYS},
      'gates':{g:r.get(g) for g in GATES},'status':r.get('Eligibility status'),'reason':r.get('Plain-English reason'),
      'blocker':r.get('Main blocker'),'next':r.get('Next action'),'facts':ids(r.get('Fact refs (Fact_Register)')),'bip':ev,
      'routeEnd':r.get('Route / contract end date'),'owner':r.get('Engagement owner'),'cpk':r.get('Counterparty key'),
      'parent':r.get('Parent and guarantee position'),'geo':r.get('Geography and current intake'),'ptype':r.get('Property type, bed mix, volume'),
      'access':r.get('Access route'),'leaseTerms':r.get('Lease, breaks, repairs, rent terms'),'ranked':r.get('Ranked?')})
def ev(k):
    b=bip[k];o_={'id':k,'type':b.get('Record type'),'buyer':b.get('Buyer'),'suppliers':b.get('Supplier(s)'),'title':b.get('Title'),
      'value':b.get('Value £'),'basis':b.get('Value basis'),'start':b.get('Start'),'end':b.get('End'),'framework':b.get('Framework? (Y/N)')=='Y',
      'deadline':b.get('Deadline'),'region':b.get('Region / NUTS'),'url':b.get('Source (BiP URL)'),'fts':b.get('FTS ref'),
      'published':b.get('Publication date'),'checked':b.get('Date checked'),'status':b.get('Status'),'use':b.get('Decision use'),'facts':ids(b.get('Fact refs')),'opps':ids(b.get('Opp IDs'))}
    ref=REF['records'].get(k)
    if ref:
        for f in ('value','basis','url','fts','start','end','published'):
            if ref.get(f) is not None:o_[f]=ref[f]
        o_['refreshed']=REF['checked'];o_['lotSuppliers']=ref.get('lotSuppliers');o_['mackLots']=ref.get('mackLots');o_['spendByBuyer']=ref.get('spendByBuyer')
    return o_
# Curated links from existing frameworks.json items (matched by name regex) to BiP evidence.
FW_LINKS=[
 {'match':r'Community Accommodation Service \(CAS\) Open Framework','bip':['BE-01'],'facts':['F-048','F-049'],'kind':'Framework (appointees only; work via call-off competitions)',
  'lots':'Lot 1 Approved Premises (£347m); Lot 2 CAS2 accommodation and support (£307m); Lot 3 CAS3 TA and floating support (£1,244m); Lot 4 specialised (£113m)',
  'members':'; '.join(k+' ('+str(len(v))+'): '+', '.join(v) for k,v in REF['records']['BE-01']['lotSuppliers'].items()),
  'mack':'Mack Opco Ltd appointed to Lots 2, 3 and 4, 2 Nov 2026 to 1 Nov 2034. Appointment only: no call-off awarded yet, no volume committed.','upcoming':['NEW-CAS3-P1476']},
 {'match':r'CAS3 current regional contracts','bip':['BE-02','BE-03'],'facts':['F-001','F-050'],'kind':'Awarded regional contracts',
  'mack':'Not a CAS3 regional contractor; supply homes to the prime (e.g. Mears NW) or bid MCC P-1476 via the MoJ framework.','upcoming':['NEW-CAS3-P1476']},
 {'match':r'Housing Related Support - Accommodation Framework','bip':['BE-04','BE-05'],'facts':['F-051'],'kind':'Open framework (14 appointees; may re-open)',
  'members':'Caritas, Centennial, Contact, Depaul UK, Great Places, City of Liverpool YMCA, MSV, Nacro, SAHA, SSG, Riverside Care & Support, Salvation Army Trustee Co, Stepping Stone, Sanctuary',
  'mack':'Not appointed. Route is to lease homes to an appointee or join at a re-opening.','upcoming':['NEW-MCC-P1218']},
 {'match':r'Oldham nightly-paid','bip':['BE-08'],'facts':['F-053'],'kind':'Framework (8 appointees)','members':'8 suppliers incl. Rent Connect Housing Ltd',
  'mack':'Not appointed. Rent Connect is the ranked appointee route (GM-014).'},
 {'match':r'Supported Temporary Accommodation Framework \(STAF\)','bip':['BE-07'],'facts':['F-052'],'kind':'Framework (7 appointees)',
  'lots':'Family low support (dispersed self-contained); family medium support; singles',
  'members':'Ashley Community & Housing, Dawson Housing, LiveWest Homes, Nest & Rest Property Rentals, Places for People Living+, Sanctuary Home Care, YMCA North Tyneside',
  'mack':'Not appointed. Route is to lease homes to an appointee (BR-009).'},
 {'match':r'Guinness Partnership / ProcurePublic','bip':['BE-09'],'kind':'Framework','members':'ICAB, Jigsaw, LSH, Rent Connect, Thesqua.re, Unity Housing Support','mack':'Not appointed.'},
 {'match':r'GMCA 1769','bip':['BE-14'],'kind':'Framework (service contract)','mack':'Reviewed: support services framework, not a leasing route.'},
 {'match':r'^AASC','bip':['BE-19'],'kind':'Awarded contracts','mack':'Supply homes to Serco (GM) via its property team; no AASC spend rows seen in the BiP sample.'},
]
def item(k,name,accom,regions,status,route,notes,mack='',upcoming=None,kind=None):
    b=ev(k);return {'id':'NEW-'+k,'name':name,'buyer':b['buyer'],'accom_type':accom,'regions':regions,'geography':b['region'],'route':kind or b['type'],
      'status':status,'start':b['start'],'end':b['end'],'value_gbp':b['value'],'value_text':(('£'+format(int(b['value']),',')+' ') if b['value'] else '')+'CEILING / estimate, not committed ('+(b['basis'] or '')+')',
      'suppliers':[b['suppliers']] if b['suppliers'] else [],'investor_route':route,'notes':notes,'confidence':b['status'],'sources':[{'title':'BiP Intelligence '+b['id']+(' / FTS '+b['fts'] if b['fts'] else ''),'url':b['url'],'date':'checked '+(b['checked'] or '')}],
      'contacts':[],'v4':{'bip':[k],'kind':kind or b['type'],'mack':mack,'upcoming':upcoming or [],'new':True}}
NEW_ITEMS=[
 dict(item('BE-02','Manchester CAS3 accommodation and support (P-1476)','CAS3 probation accommodation',['GM'],'Forthcoming (pre-market engagement closed 10 Sep 2026)','Direct bid',
   'Minimum 66 single-sex self-contained or compliant shared units in Manchester; separate accommodation and floating support elements; est. 1 Apr 2027 to 23 Dec 2027. Provider covers repairs, utilities, council tax.',
   mack='Upcoming opportunity for Mack Opco via MoJ CAS framework appointment (Lot 3) or direct MCC tender. Track the contract notice.',kind='Upcoming tender (notice)'),id='NEW-CAS3-P1476'),
 dict(item('BE-06','MCC Domestic Abuse: Intersecting Needs Safe Accommodation (P-1475)','Domestic abuse safe accommodation',['GM'],'Live (awarded call-off contract)','Supply to provider',
   'Awarded to Centennial Property Limited. Contract award, not a framework.',mack='Not Mack. Centennial (GM-015) is the provider route.',kind='Awarded contract (call-off)'),id='NEW-MCC-P1475'),
 dict(item('BE-12','MCC Safety and Support Services for Temporary Accommodation (P-1218)','Temporary accommodation support services',['GM'],'Forthcoming (pipeline; contract notice expected 19 Nov 2026)','Monitor',
   'Services across the MCC TA estate, not property. Open procedure; est. 1 Apr 2027 to 1 Apr 2031.',mack='Context only: services, not a property route.',kind='Pipeline notice'),id='NEW-MCC-P1218'),
 dict(item('BE-11','Places for People: Specialist Decant Accommodation Provider','Temporary / decant accommodation',['National'],'Live (awarded contract)','Supply to provider',
   'Awarded to Jigsaw Conferences Limited, 30 Sep 2026 to 29 Sep 2029.',mack='Not Mack. Jigsaw (GM-029) context.',kind='Awarded contract'),id='NEW-PFP-DECANT'),
 dict(item('BE-10','Bolton At Home: Temporary Accommodation (Decant)','Temporary / decant accommodation',['GM'],'Closed (ended 30 Sep 2026)','Monitor',
   'Awarded to ICAB; ended 30 Sep 2026.',mack='Not Mack.',kind='Awarded contract'),id='NEW-BAH-DECANT'),
 dict(item('BE-13','Gloucestershire: Supported Accommodation at Trevone House','Supported accommodation 16+ young people',['GLOS'],'Forthcoming (tender, deadline 16 Nov 2026)','Monitor',
   'Ofsted-regulated care service in a named building for up to 19 young people: not a leasing route.',mack='Reviewed, not pursued.',kind='Tender notice'),id='NEW-GLOS-TREVONE'),
]
for n in NEW_ITEMS: n['v4']['id']=n['id']
# Mack Living panel
mack={'appointments':[{'framework':'MoJ Provision of Community Accommodation Services Open Framework','entity':'Mack Opco Ltd (Mack House, 13 Bath Road, Cheltenham GL53 7HG)',
  'lots':'Lots '+', '.join(x.split()[-1] for x in REF['records']['BE-01']['mackLots'][:-1])+' and '+REF['records']['BE-01']['mackLots'][-1].split()[-1]+' (BiP award 6030619061, re-checked '+REF['checked']+')','term':'2 Nov 2026 to 1 Nov 2034','status':'Appointed (framework only; no call-off awarded)','ceiling':'£2.0bn whole-framework estimated maximum ex VAT: CEILING, not committed',
  'evidence':['BE-01'],'facts':['F-048','F-049']}],
 'tenders':['NEW-CAS3-P1476','NEW-MCC-P1218','NEW-GLOS-TREVONE'],
 'focusOpps':['MJ-001','GM-046','BR-009','GL-001','GM-002','GM-001','GL-005','BR-005','GM-015','GM-014']}
FIN={f['Key']:f for f in RW['fin']}
fin={k:{'entity':f.get('Signing / counterparty entity'),'reg':f.get('Registry ID'),'period':f.get('Accounts period end'),'atype':f.get('Accounts type'),'rev':f.get('Revenue £m'),
  'pmeasure':f.get('Profit measure'),'profit':f.get('Profit £m'),'margin':f.get('Margin'),'assets':f.get('Net assets / reserves note'),
  'B':{x:f.get(c) for x,c in [('B1','B1 Entity matched'),('B2','B2 Accounts recency/type'),('B3','B3 Scale'),('B4','B4 Profitability'),('B5','B5 Liquidity/reserves'),('B6','B6 RSH viability')]},
  'parent':f.get('Parent / guarantee position'),'notes':f.get('Notes'),'facts':ids(f.get('Fact refs'))} for k,f in FIN.items()}
DK=['Req ID','Opp ID','Partner','Region','Area / local authority','Programme / cohort','Property type','Beds min','Beds max','Units required','Priority','Required by / mobilisation','Lease term (yrs)','Rent basis','Indicative rent min £ pcm','Indicative rent max £ pcm','BRMA (v3)','LHA benchmark £ pcm (formula)','Rent max vs LHA (formula)','Void cover','Repairs / damage','Utilities & council tax','Furnished','Compliance requirements','Requirement status (v3)','Evidence status (v3)','Fact refs']
demand=[{k:d.get(k) for k in DK if d.get(k) is not None} for d in RW['demand']]
lha=[{'key':l['Lookup key (BRMA|beds)'],'brma':l.get('BRMA'),'region':l.get('Region'),'beds':l.get('Bedrooms (0 = shared room)'),'pcm':l.get('LHA £ pcm (UC monthly)'),'url':l.get('Source'),'eff':l.get('Rates effective'),'status':l.get('Status')} for l in RW['lha']]
terms=[{'k':t['_k'],'partner':t.get('Partner'),'opps':ids(t.get('Opp ID')),**{c:t.get(c) for c in ['Programme','Lease term','Rent basis','Voids','Repairs / damage','Utilities & council tax','Indexation','Property standards / compliance','Submission route','Evidence','As at','v3 status']},'facts':ids(t.get('Fact refs'))} for t in RW['terms']]
meth=RW['meth']
for o in opps:
    o['fin']=o['cpk'] if o.get('cpk') in fin else None
    o['demand']=[d['Req ID'] for d in demand if d.get('Opp ID')==o['id']]
    o['terms']=[t['k'] for t in terms if o['id'] in t['opps']]
for k,b in bip.items():
    for oid in ids(b.get('Opp IDs')):
        oo=next((o for o in opps if o['id']==oid),None)
        if oo is not None and k not in oo['bip']:oo['bip'].append(k)
# placements: which tab renders each record (mirrors v4-enrich.js); coverage_check.py compares with the workbook.
FWB=set(x for L in FW_LINKS for x in L['bip'])|set(x for n in NEW_ITEMS for x in n['v4']['bip'])
PL={}
def put(k,*t):PL.setdefault(k,set()).update(t)
focus=set(mack['focusOpps'])
for o in opps:
    put('OPP:'+o['id'],'pscreen')
    if re.search(VR.RP_T,o['type'] or ''):put('OPP:'+o['id'],'rp')
    if re.search(VR.OP_T,o['type'] or ''):put('OPP:'+o['id'],'operators')
    if o['id'] in focus or o['demand'] or o['terms']:put('OPP:'+o['id'],'mack')
for k in facts:put('FACT:'+k,'pscreen')
for k in bip:put('BIP:'+k,'frameworks')
for k in fin:put('FIN:'+k,'pscreen')
for d in demand:put('DR:'+d['Req ID'],'mack')
for l in lha:put('LHA:'+l['key'],'mack')
for t in terms:put('TERMS:'+t['k'],'mack')
for m in meth:put('METH:'+m['_k'],'pscreen')
out={'version':'v4-'+dt.date.today().strftime('%Y%m%d'),'source':os.path.basename(wbp),'built':dt.datetime.now().strftime('%Y-%m-%d %H:%M'),
 'licence':'Includes licensed BiP Intelligence data. Values marked CEILING are estimated maxima, not committed spend or landlord revenue.',
 'opps':opps,'bip':{k:ev(k) for k in bip},'facts':{k:{'opps':ids(f.get('Opp IDs')),'field':f.get('Field'),'finding':f.get('Finding'),'url':f.get('Source URL'),'published':f.get('Publication date'),'checked':f.get('Date checked'),'status':f.get('Status')} for k,f in facts.items()},
 'fwLinks':FW_LINKS,'newItems':NEW_ITEMS,'mack':mack,'fin':fin,'demand':demand,'lha':lha,'terms':terms,'meth':meth,
 'fwBip':sorted(FWB),'refresh':{'checked':REF['checked'],'note':REF['note']},'placements':{k:sorted(v) for k,v in PL.items()},'sheetsOnly':VR.SHEETS_ONLY}
s=json.dumps(out,ensure_ascii=False,indent=1,default=str)
assert '\u2013' not in s and '\u2014' not in s
open(os.path.join(SITE,'v4-enrich.json'),'w').write(s)
print('wrote site/v4-enrich.json',len(opps),'opps',len(bip),'bip',len(facts),'facts',len(NEW_ITEMS),'new frameworks',len(fin),'fin',len(demand),'demand',len(lha),'lha',len(terms),'terms',len(meth),'meth',len(PL),'placed')
