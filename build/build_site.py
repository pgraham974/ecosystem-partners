#!/usr/bin/env python3
"""One source for site and workbook. Reads mack-pipeline.json, v4-enrich.json, mack-living.json, market-lha.json
and writes site-data.json (5 MECE tabs, each record has exactly one home row) plus Mack_Living_Pipeline.xlsx with one sheet per tab."""
import json,os,re,sys
HERE=os.path.dirname(os.path.abspath(__file__));SITE=os.path.dirname(HERE)
sys.path.insert(0,HERE)
def L(f):return json.load(open(os.path.join(SITE,f)))
MP,J,ML,LHA=L('mack-pipeline.json'),L('v4-enrich.json'),L('mack-living.json'),L('market-lha.json')
def clean(v):
    if isinstance(v,str):return re.sub(r'\s*[\u2013\u2014]\s*',' - ',v).strip()
    if isinstance(v,list):return [clean(x) for x in v]
    if isinstance(v,dict):return {k:clean(x) for k,x in v.items()}
    return v
KEYS=['A','B','C','D','E'];ORDER={'Eligible':0,'Qualify':1,'Research needed':2,'Excluded':3}
def score(i,W):
    num=den=tot=0
    for k in KEYS:
        w=W[k];tot+=w;v=i['inputs'].get(k)
        if v is None:continue
        num+=w*v/3*100;den+=w
    cov=den/tot if tot else 0;raw=num/den if den else None;g=list(i['gates'].values())
    sc=None if raw is None else round(raw,1)
    if 'FAIL' in g:st='Excluded'
    elif cov<0.5:st='Research needed'
    elif 'UNKNOWN' in g:
        st='Qualify'
        if sc is not None:sc=min(sc,65)
    else:st='Eligible'
    return st,sc,(None if raw is None else round(raw,1)),round(cov,2)
def gbp(v):
    if v is None:return None
    return '£%.1fbn'%(v/1e9) if v>=1e9 else '£%.1fm'%(v/1e6) if v>=1e6 else '£%dk'%round(v/1e3) if v>=1e3 else '£%d'%round(v)
def j(x):return ', '.join(str(a) for a in x if a not in (None,'')) if isinstance(x,list) else x
OPP={o['id']:o for o in J['opps']}
def otab(o):
    t=o['type']
    if t.startswith('Commissioner'):return 'partners'
    if t in ('Intermediary / route','Windfall / market signal','Placeholder','Supply'):return 'supply'
    return 'competitors'
# ---------- Pipeline
W=MP['weights'];items=[]
for i in MP['items']:
    st,sc,raw,cov=score(i,W);items.append((i,st,sc,raw,cov))
items.sort(key=lambda t:(ORDER[t[1]],-(t[2] if t[2] is not None else -1),-(t[3] if t[3] is not None else -1),-(t[0]['inputs'].get('E') if t[0]['inputs'].get('E') is not None else -1),-(t[0]['inputs'].get('B') if t[0]['inputs'].get('B') is not None else -1),t[0]['id']))
newby={n['name']:n['id'] for n in J['newItems']}
pid={b['name']:'P-%02d'%(n+1) for n,b in enumerate(MP['buyers'])}
rk=0;prow=[]
for i,st,sc,raw,cov in items:
    r=None
    if st in('Eligible','Qualify'):rk+=1;r=rk
    also=(['ML:'+i['ml']] if i.get('ml') else [])+(['NEW:'+newby[i['name']]] if i['name'] in newby else [])
    prow.append({'_rec':'PIPE:'+i['id'],'_also':also,'rank':r,'id':i['id'],'name':i['name'],'partner':pid.get(i['buyer']),'kind':i['kind'],'region':i['region'],
     'status':st,'score':sc,'coverage':round(cov*100),**{k:i['inputs'].get(k) for k in KEYS},
     'gates':', '.join('%s %s'%(k.replace('G-',''),v) for k,v in i['gates'].items()),'mack':i['mackPos'],'deadline':i.get('deadline'),
     'dates':' to '.join(x for x in (i.get('start'),i.get('end')) if x) or None,'value':gbp(i.get('value')),
     'basis':(None if i.get('value') is None else 'Actual spend' if re.search('actual',i.get('basis') or '',re.I) else 'Ceiling, not committed'),
     'incumbents':j(i['incumbents']),'why':i['why'],'next':i['next'],'sources':i['bip']+i['facts'],'records':i['opps'],'_gates':i['gates']})
PIPE_COLS=[('rank','#'),('id','ID'),('name','Opportunity'),('partner','Partner'),('kind','Route'),('region','Region'),('status','Status'),('score','Score'),('coverage','Coverage %'),
 ('A','A'),('B','B'),('C','C'),('D','D'),('E','E'),('gates','Gates'),('mack','Mack position'),('deadline','Deadline'),('dates','Term'),('value','Value'),('basis','Value basis'),
 ('incumbents','Incumbents'),('why','Why'),('next','Next step'),('sources','Sources'),('records','Linked records')]
# ---------- Partners
part=[]
for b in MP['buyers']:
    part.append({'_rec':'PARTNER:'+b['name'],'id':pid[b['name']],'name':b['name'],'type':b['type'],'regions':j(b['regions']),'pipeline':b['items'],
     'ceiling':gbp(b.get('ceiling')),'fin':['FIN:'+b['fin']] if b.get('fin') else [],
     'spend':[s['id'] for s in MP['spend'] if s['buyer']==b['name']]})
def pmatch(org):
    for n,p in sorted(pid.items(),key=lambda x:-len(x[0])):
        if org.lower().startswith(n.lower()) or n.lower() in org.lower():return p
    a={'MoJ':'Ministry of Justice','Ministry of Justice':'Ministry of Justice'}
    return None
teams=[]
for o in J['opps']:
    if otab(o)!='partners':continue
    teams.append({'_rec':'OPP:'+o['id'],'id':o['id'],'name':o['org'],'partner':pmatch(o['org']),'type':o['type'],'region':o['region'],'role':o['role'],'status':o['status'],'next':o['next'],'sources':(o.get('bip') or [])+(o.get('facts') or [])})
# ---------- Competitors
comp=[]
for c in MP['competitors']:
    o=OPP.get(c['id']);also=['OPP:'+c['id']] if o else []
    comp.append({'_rec':'COMP:'+c['id'],'_also':also,'id':c['id'],'name':c['name'],'entity':c.get('entity'),'type':c['type'],'region':c['region'],'competes':c['competesOn'],
     'fin':['FIN:'+c['fin']] if c.get('fin') else [],'role':o['role'] if o else None,'status':o['status'] if o else None,'note':c.get('note'),'sources':(c.get('bip') or [])+(c.get('facts') or [])})
cids={c['id'] for c in MP['competitors']}
for o in J['opps']:
    if otab(o)=='competitors' and o['id'] not in cids:
        comp.append({'_rec':'OPP:'+o['id'],'id':o['id'],'name':o['org'],'entity':o.get('entity'),'type':o['type'],'region':o['region'],'competes':[],'fin':['FIN:'+o['fin']] if o.get('fin') else [],'role':o['role'],'status':o['status'],'note':None,'sources':(o.get('bip') or [])+(o.get('facts') or [])})
# ---------- Supply
sites=[]
for s in ML['sites']+ML['watchlist']:
    sites.append({'_rec':'SITE:'+s['id'],'id':s['id'],'address':s['address'],'council':s['council'],'postcode':s.get('postcode'),'homes':s.get('existingHomes'),'price':s.get('priceLabel') or gbp(s.get('priceGBP')),
     'status':s.get('status'),'asof':s.get('statusAsOf'),'uses':j(s.get('possibleUses') or []),'blockers':j(s.get('blockers') or []),'url':s.get('listingURL')})
dem=[]
for d in J['demand']:
    dem.append({'_rec':'DR:'+d['Req ID'],'id':d['Req ID'],'record':d.get('Opp ID'),'partner':d.get('Partner'),'region':d.get('Region'),'area':d.get('Area / local authority'),'type':d.get('Property type'),
     'beds':'%s to %s'%(d.get('Beds min'),d.get('Beds max')),'priority':d.get('Priority'),'by':d.get('Required by / mobilisation'),'lease':d.get('Lease term (yrs)'),'rent':d.get('Rent basis'),'lha':d.get('LHA benchmark £ pcm (formula)'),'voids':d.get('Void cover')})
terms=[]
for t in J['terms']:
    terms.append({'_rec':'TERMS:'+t['k'],'id':t['k'],'partner':t['partner'],'records':t['opps'],'programme':t.get('Programme'),'lease':t.get('Lease term'),'rent':t.get('Rent basis'),'voids':t.get('Voids'),
     'repairs':t.get('Repairs / damage'),'bills':t.get('Utilities & council tax'),'index':t.get('Indexation'),'standards':t.get('Property standards / compliance'),'route':t.get('Submission route'),'asof':t.get('As at'),'sources':t.get('facts') or []})
routes=[]
for o in J['opps']:
    if otab(o)=='supply':routes.append({'_rec':'OPP:'+o['id'],'id':o['id'],'name':o['org'],'type':o['type'],'region':o['region'],'role':o['role'],'status':o['status'],'next':o['next'],'sources':(o.get('bip') or [])+(o.get('facts') or [])})
v4l={}
for l in J['lha']:v4l.setdefault(l['brma'],[]).append('LHA:'+l['key'])
lha=[]
for r in LHA['rates']:
    lha.append({'_rec':'BRMA:'+r['name'],'_also':v4l.get(r['name'],[]),'id':r['name'],'country':r['country'],'SAR':r.get('SAR'),'b1':r.get('1'),'b2':r.get('2'),'b3':r.get('3'),'b4':r.get('4')})
# ---------- Method and sources
scoring=[{'_rec':'SCORE:'+k,'id':k,'what':MP['components'][k],'scale':MP['scale'][k],'weight':W[k]} for k in KEYS]+[{'_rec':'SCORE:Gates','id':'Gates','what':MP['gateRules'],'scale':None,'weight':None}]
facts=[{'_rec':'FACT:'+k,'id':k,'field':f['field'],'finding':f['finding'],'status':f['status'],'checked':f['checked'],'url':f.get('url'),'records':f.get('opps') or []} for k,f in J['facts'].items()]
bip=[{'_rec':'BIP:'+k,'id':k,'type':b['type'],'buyer':b['buyer'],'suppliers':b['suppliers'],'title':b['title'],'value':gbp(b.get('value')),'basis':b.get('basis'),'dates':' to '.join(x for x in (b.get('start'),b.get('end')) if x) or None,'checked':b.get('checked'),'url':b.get('url')} for k,b in J['bip'].items()]
fin=[{'_rec':'FIN:'+k,'id':'FIN:'+k,'entity':f['entity'],'reg':f.get('reg'),'period':f.get('period'),'accounts':f.get('atype'),'rev':f.get('rev'),'profit':f.get('profit'),'margin':f.get('margin'),'assets':f.get('assets'),'notes':f.get('notes'),'sources':f.get('facts') or []} for k,f in J['fin'].items()]
meth=[{'_rec':'METH:'+m['_k'],'id':m['_k'],'text':' | '.join(str(c) for c in m['cells'] if c not in (None,''))} for m in J['meth']]
TABS=[
 {'key':'pipeline','name':'Pipeline','sections':[{'key':'opps','name':'Opportunities','cols':PIPE_COLS,'rows':prow}]},
 {'key':'partners','name':'Partners','sections':[
   {'key':'partners','name':'Partners','cols':[('id','ID'),('name','Partner'),('type','Type'),('regions','Regions'),('pipeline','Pipeline'),('ceiling','Published ceilings'),('fin','Financials'),('spend','BiP spend')],'rows':part},
   {'key':'teams','name':'Commissioning teams','cols':[('id','ID'),('name','Team'),('partner','Partner'),('type','Type'),('region','Region'),('role','Role'),('status','Status'),('next','Next step'),('sources','Sources')],'rows':teams}]},
 {'key':'competitors','name':'Competitors','sections':[{'key':'comps','name':'Competitors and incumbents','cols':[('id','ID'),('name','Name'),('entity','Entity'),('type','Type'),('region','Region'),('competes','Competes on'),('fin','Financials'),('role','Role'),('status','Status'),('note','Note'),('sources','Sources')],'rows':comp}]},
 {'key':'supply','name':'Supply','sections':[
   {'key':'sites','name':'Mack sites','cols':[('id','ID'),('address','Address'),('council','Council'),('postcode','Postcode'),('homes','Homes'),('price','Price'),('status','Status'),('asof','As of'),('uses','Possible uses'),('blockers','Blockers'),('url','Listing')],'rows':sites},
   {'key':'demand','name':'Operator demand','cols':[('id','ID'),('record','Record'),('partner','Operator'),('region','Region'),('area','Area'),('type','Property'),('beds','Beds'),('priority','Priority'),('by','Needed by'),('lease','Lease yrs'),('rent','Rent basis'),('lha','LHA £ pcm'),('voids','Voids')],'rows':dem},
   {'key':'terms','name':'Lease terms','cols':[('id','ID'),('partner','Operator'),('records','Records'),('programme','Programme'),('lease','Lease'),('rent','Rent'),('voids','Voids'),('repairs','Repairs'),('bills','Bills'),('index','Indexation'),('standards','Standards'),('route','Submission'),('asof','As at'),('sources','Sources')],'rows':terms},
   {'key':'routes','name':'Routes and demand signals','cols':[('id','ID'),('name','Name'),('type','Type'),('region','Region'),('role','Role'),('status','Status'),('next','Next step'),('sources','Sources')],'rows':routes},
   {'key':'lha','name':'LHA rates %s (£ pcm)'%LHA['period'],'cols':[('id','BRMA'),('country','Country'),('SAR','Shared room'),('b1','1 bed'),('b2','2 bed'),('b3','3 bed'),('b4','4 bed')],'rows':lha}]},
 {'key':'sources','name':'Method and sources','sections':[
   {'key':'scoring','name':'Scoring','cols':[('id','Score'),('what','Measures'),('scale','Scale 0 to 3'),('weight','Weight')],'rows':scoring},
   {'key':'facts','name':'Fact register','cols':[('id','ID'),('field','Field'),('finding','Finding'),('status','Status'),('checked','Checked'),('url','Source'),('records','Records')],'rows':facts},
   {'key':'bip','name':'BiP evidence','cols':[('id','ID'),('type','Type'),('buyer','Buyer'),('suppliers','Suppliers'),('title','Title'),('value','Value'),('basis','Basis'),('dates','Term'),('checked','Checked'),('url','Link')],'rows':bip},
   {'key':'fin','name':'Financials','cols':[('id','ID'),('entity','Entity'),('reg','Reg'),('period','Period'),('accounts','Accounts'),('rev','Revenue £m'),('profit','Profit £m'),('margin','Margin'),('assets','Assets'),('notes','Notes'),('sources','Sources')],'rows':fin},
   {'key':'meth','name':'Methodology','cols':[('id','ID'),('text','Rule')],'rows':meth}]}]
# optional full BiP pull lands as a section here, never a new tab
bp=os.path.join(SITE,'bip-data.json')
if os.path.exists(bp):
    B=json.load(open(bp));TABS[4]['sections'].insert(3,{'key':'bipdata','name':'BiP data','cols':[tuple(c) for c in B['cols']],'rows':[dict(r,_rec='BIPDATA:'+str(r['id'])) for r in B['rows']]})
for t in TABS:
    for s in t['sections']:s['cols']=[list(c) for c in s['cols']]
OUT=clean({'built':MP['built'],'checkDate':MP['checkDate'],'weights':W,'workbook':'Mack_Living_Pipeline.xlsx','tabs':TABS})
json.dump(OUT,open(os.path.join(SITE,'site-data.json'),'w'),ensure_ascii=False,separators=(',',':'))
# ---------- workbook: one sheet per tab, sections stacked, same columns and IDs
from openpyxl import Workbook
from openpyxl.styles import Font,PatternFill
wb=Workbook();wb.remove(wb.active);H=PatternFill('solid',fgColor='E8EEF7')
for t in OUT['tabs']:
    ws=wb.create_sheet(t['name'][:31]);r=1
    for s in t['sections']:
        ws.cell(r,1,s['name']).font=Font(bold=True,size=12);r+=1
        for c,(k,lab) in enumerate(s['cols'],1):x=ws.cell(r,c,lab);x.font=Font(bold=True);x.fill=H
        r+=1
        for row in s['rows']:
            for c,(k,lab) in enumerate(s['cols'],1):
                v=row.get(k);ws.cell(r,c,j(v) if isinstance(v,list) else v)
            r+=1
        r+=1
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width=min(60,max(8,max(len(str(x.value or '')) for x in col[:200])*0.9))
wb.save(os.path.join(SITE,'Mack_Living_Pipeline.xlsx'))
n=sum(len(s['rows']) for t in OUT['tabs'] for s in t['sections'])
print('site-data.json and Mack_Living_Pipeline.xlsx: %d tabs, %d rows'%(len(OUT['tabs']),n))
