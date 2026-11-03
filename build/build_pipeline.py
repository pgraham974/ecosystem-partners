#!/usr/bin/env python3
"""Build site/mack-pipeline.json: Mack Living's pipeline of contracts and buyers Mack can win.
Mack Living is the user and the bidder / supplier. Inputs:
  v4-enrich.json      (BiP evidence, Fact_Register, counterparty financials, v4 records)
  mack-living.json    (Mack route research)
  build/bip_pipeline.json (extra BiP notices pulled for Mack; optional, refreshed when BiP is reachable)
Every score input below is a judgement on a 0-3 scale taken from the cited evidence; None means
unknown and is never scored as zero. Gates are PASS / FAIL / UNKNOWN / N/A.
Usage: python3 build/build_pipeline.py"""
import json,os,datetime as dt
HERE=os.path.dirname(os.path.abspath(__file__));SITE=os.path.dirname(HERE)
V=json.load(open(os.path.join(SITE,'v4-enrich.json')));ML=json.load(open(os.path.join(SITE,'mack-living.json')))
X=json.load(open(os.path.join(HERE,'bip_pipeline.json'))) if os.path.exists(os.path.join(HERE,'bip_pipeline.json')) else {'items':[]}
U,P,F,N='UNKNOWN','PASS','FAIL','N/A'
def it(id,name,buyer,btype,region,service,route,kind,bip=(),facts=(),opps=(),ml=None,A=None,B=None,C=None,D=None,E=None,g=(U,U,U,U),why='',next='',incumbents=(),deadline=None,start=None,end=None,value=None,basis=None,url=None,mackPos=''):
    b=[V['bip'][k] for k in bip if k in V['bip']];b0=b[0] if b else {}
    val=value if value is not None else next_((x['value'] for x in b if x.get('value') is not None),None)
    bas=basis or next_((x['basis'] for x in b if x.get('value') is not None),None)
    return dict(id=id,name=name,buyer=buyer,buyerType=btype,region=region,service=service,route=route,kind=kind,bip=list(bip),facts=list(facts),opps=list(opps),ml=ml,
      inputs=dict(A=A,B=B,C=C,D=D,E=E),gates=dict(zip(['G-Service','G-Geo','G-Live','G-Elig'],g)),why=why,next=next,incumbents=list(incumbents),
      deadline=deadline or b0.get('deadline'),start=start or b0.get('start'),end=end or b0.get('end'),value=val,basis=bas,url=url or b0.get('url'),framework=any(x.get('framework') for x in b) or 'ramework' in kind,mackPos=mackPos)
def next_(g,d):
    for x in g:return x
    return d
L1=V['bip']['BE-01'].get('lotSuppliers') or {}
cas_comp=sorted({s for k in ('Lot 2','Lot 3','Lot 4') for s in L1.get(k,[]) if s!='Mack Opco Ltd'})
ITEMS=[
 it('MP-01','MoJ Community Accommodation Services framework: call-offs under Lots 2, 3 and 4','Ministry of Justice','Central government','England and Wales','CAS2 / CAS3 / specialised community accommodation','Call-off competitions under a framework Mack Opco already holds','Framework (Mack appointed)',
    bip=['BE-01'],facts=['F-048','F-049'],opps=['MJ-001'],A=3,B=3,C=3,D=2,E=3,g=(P,P,P,P),
    why='Mack Opco Ltd is appointed to Lots 2, 3 and 4 (2 Nov 2026 to 1 Nov 2034). Appointment only: no call-off awarded and no volume committed. £2.0bn is the whole-framework CEILING.',
    next='Watch for each regional call-off; prepare a standard call-off response pack (stock, support model, pricing).',incumbents=cas_comp,mackPos='Appointed (Lots 2, 3, 4)'),
 it('MP-02','Manchester CAS3 accommodation and support (P-1476)','Manchester City Council','Local authority','Greater Manchester','CAS3 probation accommodation','Direct tender (contract notice not yet published)','Upcoming tender',
    bip=['BE-02','BE-03'],facts=['F-050'],opps=['GM-046'],A=3,B=2,C=2,D=2,E=3,g=(P,P,P,U),
    why='Pre-market engagement closed 10 Sep 2026. Minimum 66 single-sex units in Manchester, est. 1 Apr 2027 to 23 Dec 2027. No value published. Whether bidding is open or limited to MoJ framework appointees is not published.',
    next='Track the contract notice; confirm eligibility and whether Mack Opco\'s Lot 3 appointment applies.',incumbents=['Mears Limited (current CAS3 North West contractor, F-001)'],mackPos='Not yet bid'),
 it('MP-03','MCC Safety and Support Services for Temporary Accommodation (P-1218)','Manchester City Council','Local authority','Greater Manchester','Support services in TA (not property)','Direct tender (pipeline notice)','Upcoming tender',
    bip=['BE-12'],facts=['F-058'],A=1,B=2,C=2,D=3,E=3,g=(U,P,P,U),
    why='Pipeline notice, contract notice expected 19 Nov 2026; est. 1 Apr 2027 to 1 Apr 2031. Services, not property: fit depends on whether Mack bids a support service.',
    next='Decide whether Mack offers on-site safety and support; read the contract notice when published.',mackPos='Not yet bid'),
 it('MP-04','Gloucestershire: Supported Accommodation at Trevone House','Gloucestershire County Council','Local authority','Gloucestershire','Ofsted-regulated supported accommodation (young people)','Direct tender','Open tender',
    bip=['BE-13'],A=1,B=2,C=2,D=3,E=3,g=(U,P,P,U),
    why='Tender deadline 16 Nov 2026. Care service in a named building for up to 19 young people, not a leasing route. Mack\'s Ofsted registration is not evidenced.',
    next='Only bid if Mack holds or partners for the required registration; otherwise log as watch.',mackPos='Not yet bid'),
 it('MP-05','GMCA 1769 Regional Care Cooperative supported accommodation (5 lots)','Greater Manchester Combined Authority','Combined authority','Greater Manchester','16-17 and care leaver supported accommodation services','Direct tender on The Chest (one lot per bidder)','Open tender (framework)',
    bip=['BE-14'],ml='gmca1769-supported-16plus',A=1,B=2,C=2,D=3,E=3,g=(U,P,P,U),
    why='Deadline 20 Nov 2026. £20m estimated framework value (CEILING). Service framework; lot registration and workforce conditions not confirmed.',
    next='Check lot requirements; consider partnering with a registered support provider.',mackPos='Not yet bid'),
 it('MP-06','Bristol Emergency Accommodation Open Framework (DN677298)','Bristol City Council','Local authority','Bristol','Emergency accommodation','Open framework: apply through council procurement','Open framework',
    ml='bristol-ea-dn677298',A=2,B=2,C=2,D=3,E=2,g=(P,P,P,U),value=96000000,basis='Registered framework value (CEILING, not spend)',
    why='Register says open for tenderers throughout contract life; ends 3 Dec 2027, review 1 Jan 2027. Register names Mack Residential: that entity is not confirmed as Mack Living or Mack Opco.',
    next='Confirm which Mack entity is on the register and what call-off capacity exists.',start='2023-12-04',end='2027-12-03',mackPos='Possibly listed (entity unconfirmed)'),
 it('MP-07','Bristol Supported Temporary Accommodation Framework (STAF)','Bristol City Council','Local authority','Bristol','Supported temporary accommodation (family, singles)','Join if re-opened; otherwise supply an appointee','Framework (not appointed)',
    bip=['BE-07'],facts=['F-052'],opps=['BR-009','BR-001'],A=3,B=2,C=0,D=1,E=3,g=(P,P,P,U),
    why='£106.9m CEILING, 1 Jul 2026 to 30 Jun 2031, 7 appointees. Mack not appointed; re-opening not published.',
    next='Ask Bristol procurement whether STAF re-opens; in the meantime treat appointees as competitors or lessees.',
    incumbents=['Ashley Community & Housing','Dawson Housing','LiveWest Homes','Nest & Rest Property Rentals','Places for People Living+','Sanctuary Home Care','YMCA North Tyneside'],mackPos='Not appointed'),
 it('MP-08','MCC Housing Related Support: Accommodation Framework (P-0816)','Manchester City Council','Local authority','Greater Manchester','Housing related support accommodation','Join at re-opening or re-procurement','Framework (not appointed)',
    bip=['BE-04','BE-05'],facts=['F-020','F-051'],A=2,B=2,C=0,D=1,E=3,g=(P,P,P,U),
    why='CEILING £31.6m ex VAT (award) / £9.875m (contract details), 1 Feb 2026 to 31 Jan 2028, 14 appointees. Renewal window opens ahead of Jan 2028.',
    next='Diary the re-procurement window for 2027.',incumbents=[x.strip() for x in 'Caritas, Centennial, Contact, Depaul UK, Great Places, City of Liverpool YMCA, MSV, Nacro, SAHA, SSG, Riverside Care & Support, Salvation Army Trustee Co, Stepping Stone, Sanctuary'.split(',')],mackPos='Not appointed'),
 it('MP-09','Oldham Temporary Accommodation Nightly Paid Framework','Oldham Metropolitan Borough Council','Local authority','Greater Manchester','Nightly-paid temporary accommodation','Join if re-opened','Framework (not appointed)',
    bip=['BE-08'],facts=['F-053'],opps=['GM-014'],A=2,B=2,C=0,D=1,E=3,g=(P,P,P,U),
    why='£39.6m CEILING, 8 Apr 2026 to 6 Apr 2029, 8 appointees including Rent Connect.',next='Ask Oldham whether the framework re-opens.',incumbents=['Rent Connect Housing Ltd','7 other appointees (names not in BiP record)'],mackPos='Not appointed'),
 it('MP-10','Guinness Partnership Temporary Accommodation Framework','The Guinness Partnership','Housing association','National','Temporary / decant accommodation','Join at re-procurement','Framework (not appointed)',
    bip=['BE-09'],A=2,B=2,C=0,D=1,E=3,g=(P,P,P,U),why='£41.7m CEILING ex VAT, 14 Oct 2025 to 13 Oct 2029, 6 appointees.',next='Diary re-procurement before Oct 2029.',
    incumbents=['ICAB','Jigsaw','LSH','Rent Connect','Thesqua.re','Unity Housing Support'],mackPos='Not appointed'),
 it('MP-11','Manchester long-term TA leasing (Empty Homes Team)','Manchester City Council','Local authority','Greater Manchester','Leased temporary accommodation','Direct lease enquiry to the council','Direct leasing route',
    ml='manchester-long-term-ta',facts=['F-021','F-022'],opps=['GM-035'],A=3,B=2,C=2,D=None,E=2,g=(P,P,P,P),
    why='Council page says it may lease empty property from owners. 10 years plus 1 day decision (Mar 2024) is historical authority, not a current offer. No rent published.',
    next='Enquire with the Empty Homes Team with a specific Mack-controlled property.',mackPos='No lease yet'),
 it('MP-12','Bristol private renting leasing scheme','Bristol City Council','Local authority','Bristol','Leased temporary / private rented accommodation','Direct lease enquiry','Direct leasing route',
    ml='bristol-private-renting',opps=['BR-001'],A=2,B=2,C=2,D=None,E=2,g=(P,P,P,P),
    why='Council page invites landlord enquiries for a 2-year leasing scheme; leasing rent not published.',next='Request the leasing scheme terms for Mack stock in Bristol.',mackPos='No lease yet'),
 it('MP-13','GM Empty Homes and Leasing Programme (lease and repair, 400 homes)','Greater Manchester Combined Authority and boroughs','Combined authority','Greater Manchester','Lease and repair into temporary or settled accommodation','Borough-level leasing','Programme',
    ml='gm-empty-homes-leasing',opps=['GM-036'],A=2,B=2,C=1,D=None,E=2,g=(P,P,U,U),value=10568100,basis='Programme budget (proposed, not committed)',
    why='Nov 2025 report proposes 400 homes; funding mobilisation and borough availability not confirmed.',next='Ask Manchester and Salford which borough intake is live.',mackPos='No lease yet'),
 it('MP-14','Home Office asylum accommodation (AASC) via regional primes','Home Office','Central government','GM, Bristol, Gloucestershire','Asylum dispersed accommodation','Subcontract supply to Serco (NW) or Clearsprings (South)','Supply to prime contractor',
    ml='aasc-landlord-supply',facts=['F-002','F-007','F-008'],opps=['GM-038','GM-002'],A=2,B=3,C=1,D=None,E=2,g=(P,P,P,U),
    why='Home Office contracts are held by primes; Mack can only supply property to them. Primes are competitors for any direct Home Office work.',
    next='Use the prime property routes only where terms suit; not a direct bid.',incumbents=['Serco','Clearsprings Ready Homes','Mears'],mackPos='No direct route'),
 it('MP-15','CAS3 current regional contracts via incumbents (Mears NW, THN SW)','Ministry of Justice (via primes)','Central government','GM, Bristol, Gloucestershire','CAS3 probation accommodation','Subcontract supply to incumbent until re-let; then compete','Supply to prime contractor',
    ml='cas3-incumbent-property-supply',bip=['BE-02'],facts=['F-001','F-050'],opps=['GM-001','GM-015'],A=3,B=3,C=1,D=1,E=3,g=(P,P,P,U),
    why='Mears CAS3 NW initial term to about Dec 2027, max Dec 2029; THN SW to Apr 2028. These incumbents are Mack\'s competitors at re-let.',
    next='Track re-let dates; prepare to compete through the MoJ framework.',incumbents=['Mears Limited','Centennial Property Limited T/A The Housing Network'],start='2024-06-24',end='2029-12-12',mackPos='Competitor of incumbents'),
 it('MP-16','Cheltenham homelessness: P3 emergency accommodation','P3 (with Cheltenham Borough Council demand)','Charity / provider','Gloucestershire','Emergency accommodation','Supply property to P3','Supply to provider',
    ml='glos-cheltenham-p3-council',opps=['GL-003'],A=2,B=None,C=1,D=None,E=1,g=(P,P,U,U),
    why='P3 markets 6 to 12 month contracts; council award and payment not confirmed.',next='Low priority: confirm council demand first.',mackPos='No route yet'),
 it('MP-17','Gloucester City Council homelessness and TA','Gloucester City Council','Local authority','Gloucestershire','Temporary accommodation','Unknown (no TA leasing notice found)','Research',
    bip=['BE-20'],opps=['GL-004'],A=2,B=None,C=None,D=None,E=1,g=(P,P,U,U),why='BiP notice search (Jun 2025 to Nov 2026) found no Gloucester or Cheltenham TA leasing notice.',next='Ask the housing team how it procures TA.',mackPos='No route yet'),
 it('MP-18','MCC Domestic Abuse: Intersecting Needs Safe Accommodation (P-1475)','Manchester City Council','Local authority','Greater Manchester','Domestic abuse safe accommodation','Awarded to Centennial; compete at re-let','Awarded contract',
    bip=['BE-06'],facts=['F-017','F-056'],opps=['GM-015'],A=2,B=2,C=0,D=1,E=3,g=(P,P,P,F),
    why='Awarded to Centennial Property Limited, 1 Oct 2026 to 31 Mar 2028 per BiP. No route for Mack until re-tender.',next='Diary the re-tender ahead of Mar 2028.',incumbents=['Centennial Property Limited'],mackPos='Not eligible until re-let'),
 it('MP-19','Places for People: Specialist Decant Accommodation Provider','Places For People Group Limited','Housing association','National','Decant accommodation','Awarded to Jigsaw; compete at re-let','Awarded contract',
    bip=['BE-11'],facts=['F-055'],A=1,B=2,C=0,D=1,E=3,g=(U,P,P,F),why='£13.5m awarded to Jigsaw Conferences Limited, 30 Sep 2026 to 29 Sep 2029.',next='Watch only.',incumbents=['Jigsaw Conferences Limited'],mackPos='Not eligible until re-let'),
 it('MP-20','Bolton At Home: Temporary Accommodation (Decant)','Bolton At Home','Housing association','Greater Manchester','Decant temporary accommodation','Ended; watch for re-tender','Awarded contract (ended)',
    bip=['BE-10'],opps=['GM-023'],A=2,B=2,C=None,D=0,E=3,g=(P,P,F,U),why='£400k awarded to ICAB, ended 30 Sep 2026. No re-tender found.',next='Search BiP for a successor notice.',incumbents=['Insurance Claims Accommodation Bureau'],mackPos='Watch'),
]
for x in X.get('items',[]):ITEMS.append(it(**x))
# Buyers: grouped from pipeline + BiP actual spend
spend=[V['bip'][k] for k in ('BE-15','BE-16','BE-17','BE-18') if k in V['bip']]
buyers={}
for p in ITEMS:
    b=buyers.setdefault(p['buyer'],{'name':p['buyer'],'type':p['buyerType'],'regions':set(),'items':[],'ceiling':0,'fin':None})
    b['regions'].add(p['region']);b['items'].append(p['id'])
    if p['value'] and p['basis'] and 'ctual' not in p['basis']:b['ceiling']+=p['value']
FINMAP={'Manchester City Council':'MCC','Bristol City Council':'BRISTOLCC','Ministry of Justice':'MOJ'}
for k,v in FINMAP.items():
    if k in buyers and v in V['fin']:buyers[k]['fin']=v
for b in buyers.values():b['regions']=sorted(b['regions'])
# Competitors: v4 provider records plus MoJ CAS co-appointees
PT=('Direct lessee','Provider / framework appointee','Broker / short-stay provider')
comps=[]
for o in V['opps']:
    if o['type'] in PT:
        held=[p['id'] for p in ITEMS if any(o['match'] and o['match'].lower() in i.lower() for i in p['incumbents'])]
        comps.append({'id':o['id'],'name':o['org'],'entity':o['entity'],'region':o['region'],'type':o['type'],'fin':o.get('fin'),'bip':o['bip'],'facts':o['facts'],'competesOn':held,
          'note':o['geo'],'also':'Could also be a lessee or subcontract route for Mack property' if o['type']=='Direct lessee' else ''})
known={c['name'].lower() for c in comps}
for s in cas_comp:
    if not any(s.lower().split()[0] in k for k in known):comps.append({'id':'CAS-'+s[:12].upper().replace(' ',''),'name':s,'entity':s,'region':'England and Wales','type':'MoJ CAS co-appointee','fin':None,'bip':['BE-01'],'facts':['F-048'],'competesOn':['MP-01'],'note':'Appointed to at least one of Lots 2 to 4 alongside Mack Opco.','also':''})
W=dict(A=25,B=15,C=25,D=20,E=15)
OUT={'version':'mack-pipeline-1','built':dt.datetime.now().isoformat(timespec='seconds'),'user':'Mack Living','checkDate':str(dt.date.today()),
 'weights':W,'gateRules':'Any FAIL gives Excluded. Any UNKNOWN gives Qualify, capped at 65 and ranked after Eligible. Known weights under 50% of total give Research needed.',
 'components':{'A':'Service fit to Mack (supported, temporary, community accommodation)','B':'Buyer strength and spend history (BiP spend, ceilings shown separately)','C':'Access and eligibility (on the framework, open to bid, supply via prime, or closed)','D':'Timing: deadline or renewal window','E':'Evidence confidence'},
 'scale':{'A':'3 core accommodation service; 2 adjacent; 1 support or care only; 0 outside scope','B':'3 central government or BiP actual spend evidenced; 2 council or large RP, ceiling only; 1 small or weak; unknown blank',
   'C':'3 Mack appointed; 2 open to bid or direct lease route; 1 only via a prime or incumbent; 0 closed or awarded to someone else','D':'3 deadline or live call-off within 6 months; 2 expected within 18 months; 1 renewal window later; 0 ended','E':'3 BiP verified plus dated facts; 2 official dated source; 1 inferred'},
 'items':ITEMS,'buyers':list(buyers.values()),'competitors':comps,'spend':spend,'mack':V['mack'],'mlIdentity':ML.get('identityNote'),'bipExtra':X.get('meta')}
json.dump(OUT,open(os.path.join(SITE,'mack-pipeline.json'),'w'),indent=1,default=str)
print('pipeline items',len(ITEMS),'buyers',len(buyers),'competitors',len(comps),'extra BiP',len(X.get('items',[])))
