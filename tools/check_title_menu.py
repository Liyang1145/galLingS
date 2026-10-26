"""Check the actual title menu, including extra and hidden host/plugin rows.

python tools/check_title_menu.py [game-folder-or-html] [output-directory]
"""
import asyncio,json,pathlib,sys
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
TARGET=pathlib.Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'海风与布丁'
if TARGET.is_dir():TARGET=TARGET/'index.html'
OUT=pathlib.Path(sys.argv[2]).resolve() if len(sys.argv)>2 else ROOT/'out/title-menu'
OUT.mkdir(parents=True,exist_ok=True)

async def main():
    errors=[];result={}
    async with async_playwright() as p:
        b=await p.chromium.launch(channel='msedge',args=['--autoplay-policy=no-user-gesture-required'])
        page=await b.new_page(viewport={'width':1600,'height':900})
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto(TARGET.as_uri(),timeout=180000)
        await page.wait_for_function("typeof P!=='undefined'&&document.querySelector('#title.show')")
        await page.wait_for_timeout(1300)
        async def rows():
            await page.wait_for_timeout(120)
            return await page.evaluate("""()=>{const s=document.querySelector('#stage').getBoundingClientRect();return [...document.querySelectorAll('#title .menu button')].filter(b=>!b.hidden&&getComputedStyle(b).display!=='none').map(b=>{const r=b.getBoundingClientRect();return {text:b.textContent,left:parseFloat(getComputedStyle(b).left),inside:r.top>=s.top-1&&r.bottom<=s.bottom+1&&r.left>=s.left-1&&r.right<=s.right+1};});}""")
        def check(items):
            assert len(items)>=8,items
            assert all(abs(r['left']+i*18)<.01 and r['inside'] for i,r in enumerate(items)),items
        result['initial']=await rows();check(result['initial'])
        await page.screenshot(path=str(OUT/'title.png'))
        await page.evaluate("""()=>{const m=document.querySelector('#title .menu');for(let i=0;i<2;i++){const b=document.createElement('button');b.dataset.menuTest='1';b.textContent='宿主追加 '+i;m.appendChild(b);}}""")
        result['extraRows']=await rows();check(result['extraRows'])
        await page.evaluate("document.querySelectorAll('#title .menu button')[3].style.display='none'")
        result['hiddenRow']=await rows();check(result['hiddenRow'])
        await page.evaluate("document.querySelectorAll('#title .menu button')[3].style.display='';document.querySelectorAll('[data-menu-test]').forEach(b=>b.remove());document.body.classList.add('smallstage')")
        result['smallStage']=await rows();assert all(r['left']==0 for r in result['smallStage'])
        await page.evaluate("document.body.classList.remove('smallstage')")
        await page.locator('#title [data-t=start]').click()
        assert not await page.locator('#title').is_visible()
        result['startClick']=True;result['errors']=errors;result['passed']=not errors
        (OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(result,ensure_ascii=False));await b.close();assert result['passed']
if __name__=='__main__':asyncio.run(main())
