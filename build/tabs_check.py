import sys,asyncio
from playwright.async_api import async_playwright
base=sys.argv[1]; shots=sys.argv[2] if len(sys.argv)>2 else None
TABS=['rp','pscreen','operators','frameworks','mack','sheets']
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=await b.new_page(viewport={'width':1400,'height':1000});errs=[];fails=[]
    pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('response',lambda r: r.status>=400 and fails.append(f'{r.status} {r.url}'))
    await pg.goto(base,wait_until='networkidle')
    for t in TABS:
      await pg.evaluate(f"viewMode('{t}')");await pg.wait_for_timeout(2500)
      txt=await pg.evaluate("(()=>{const v=[...document.querySelectorAll('[id$=_view]')].find(x=>!x.classList.contains('hidden'));return v?v.innerText.slice(0,300):'NONE'})()")
      n=await pg.evaluate("document.querySelectorAll('[data-v4-fw],[data-v4-mack],[data-v4-tab],.v4mini,.v4inl').length")
      print('TAB',t,'v4 blocks',n,'|',txt.replace('\n',' / ')[:160])
      if t=='frameworks':
        await pg.evaluate("document.querySelector('[data-v4i]')&&document.querySelector('[data-v4i]').click()");await pg.wait_for_timeout(800)
        print('detail v4',await pg.evaluate("!!document.querySelector('#fw_detail .v4sec')"))
      if shots and t in('frameworks','mack'): await pg.screenshot(path=f'{shots}/{t}_tab.png',full_page=True)
    print('ERRORS',errs);print('HTTPFAIL',fails)
    await b.close()
asyncio.run(main())
