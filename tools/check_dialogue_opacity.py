"""Exercise the actual dialogue slider, compositing, reset and persisted zero.

python tools/check_dialogue_opacity.py [game-folder-or-html] [output-directory]
Requires Playwright and an installed Chromium or Edge browser.
"""
import asyncio,json,pathlib,sys
from playwright.async_api import async_playwright

ROOT=pathlib.Path(__file__).resolve().parents[1]
TARGET=pathlib.Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'海风与布丁'
if TARGET.is_dir():TARGET=TARGET/'index.html'
OUT=pathlib.Path(sys.argv[2]).resolve() if len(sys.argv)>2 else ROOT/'out/dialogue-opacity'
OUT.mkdir(parents=True,exist_ok=True)

async def main():
    errors=[];result={}
    async with async_playwright() as p:
        try:b=await p.chromium.launch(channel='msedge',args=['--autoplay-policy=no-user-gesture-required'])
        except Exception:b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        page=await b.new_page(viewport={'width':1600,'height':900})
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto(TARGET.as_uri(),timeout=180000)
        await page.wait_for_function("typeof P!=='undefined'&&P.lines.length===3315")
        assert await page.evaluate("pref('ghost')") == .45
        await page.evaluate('startPlay(19);finishTyping();clearTimers()')
        await page.wait_for_timeout(2000)
        async def state():
            await page.wait_for_timeout(550)
            return await page.evaluate("""()=>{const box=document.querySelector('#pdlg'),text=document.querySelector('#ptx');return {pref:pref('ghost'),stored:JSON.parse(localStorage.getItem('vnprefs:'+P.id)||'{}').ghost,background:getComputedStyle(box).backgroundColor,boxOpacity:+getComputedStyle(box).opacity,skinOpacity:+getComputedStyle(box,'::before').opacity,textOpacity:+getComputedStyle(text).opacity,controlsOpacity:+getComputedStyle(document.querySelector('#pctl')).opacity};}""")
        result['default']=await state()
        await page.screenshot(path=str(OUT/'default-45.png'))
        for value in [0,.2,.65,1]:
            await page.evaluate('showPrefs()')
            slider=page.locator('#psettings [data-k=ghost]')
            assert await slider.get_attribute('min')=='0' and await slider.get_attribute('max')=='1'
            await slider.fill(str(value));await slider.dispatch_event('input')
            assert await page.locator('#psettings [data-value=ghost]').inner_text()==str(round(value*100))+'%'
            await page.evaluate("document.querySelector('#psettings').classList.remove('show')")
            s=await state();result[str(value)]=s
            assert abs(s['skinOpacity']-value)<.001 and s['pref']==value and s['stored']==value
            assert s['boxOpacity']==s['textOpacity']==s['controlsOpacity']==1 and s['background']=='rgba(0, 0, 0, 0)'
            if value in [0,1]:await page.screenshot(path=str(OUT/('transparent-0.png' if value==0 else 'opaque-100.png')))
        await page.evaluate('showPrefs()')
        await page.get_by_role('button',name='恢复默认对话框不透明度',exact=True).click()
        assert await page.evaluate("pref('ghost')") == .45
        await page.locator('#psettings [data-k=ghost]').fill('0')
        await page.locator('#psettings [data-k=ghost]').dispatch_event('input')
        await page.reload(timeout=180000)
        await page.wait_for_function("typeof P!=='undefined'&&P.lines.length===3315")
        await page.evaluate('startPlay(19);finishTyping();clearTimers()')
        result['reloadedZero']=await state();assert result['reloadedZero']['skinOpacity']==0
        await page.evaluate("setPref('ghost',.27)")
        await page.reload(timeout=180000)
        await page.wait_for_function("typeof P!=='undefined'&&P.lines.length===3315")
        assert await page.evaluate("pref('ghost')") == .27
        result['customSettingRetained']=True
        await page.set_viewport_size({'width':430,'height':900})
        await page.evaluate("document.body.classList.add('vport');startPlay(19);finishTyping();clearTimers();setPref('ghost',0)")
        result['portraitZero']=await state();assert result['portraitZero']['skinOpacity']==0
        await page.evaluate("setPref('ghost',1)")
        result['portraitFull']=await state();assert result['portraitFull']['skinOpacity']==1
        await page.set_viewport_size({'width':1600,'height':900})
        await page.evaluate("document.body.classList.remove('vport');const i=P.lines.findIndex(l=>!l.text&&!l.speaker&&!l.choices.length);startPlay(i);clearTimers()")
        result['silent']=await state();assert result['silent']['skinOpacity']==0
        result['errors']=errors;result['passed']=not errors
        (OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(result,ensure_ascii=False))
        await b.close();assert result['passed']

if __name__=='__main__':asyncio.run(main())
