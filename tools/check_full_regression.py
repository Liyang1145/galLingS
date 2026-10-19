"""全作回归：浏览器里走完 3315 个节点，报出错节点数（nbad）和页面报错（nerrs）。

python tools/check_full_regression.py [作品文件夹] [截图输出目录]   需要 playwright + chromium。
"""
import asyncio,json,time
from playwright.async_api import async_playwright
import pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parent.parent
U=(pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'content/imports/vnstudio/海风与布丁').resolve().joinpath('index.html').as_uri()
OUT=pathlib.Path(sys.argv[2] if len(sys.argv)>2 else '.')
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--enable-precise-memory-info'])
    pg=await b.new_page(viewport={'width':1600,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append('console:'+m.text) if m.type=='error' else None)
    t0=time.time();await pg.goto(U,timeout=180000);await pg.wait_for_timeout(3000)
    R={'load_s':round(time.time()-t0,2)}
    await pg.screenshot(path=str(OUT/'title.jpg'),quality=70,type='jpeg')
    R['body']=await pg.evaluate("document.body.className")
    ch=await pg.evaluate("P.lines.map((l,i)=>l.chapter?[i,l.chapter]:null).filter(Boolean)")
    R['chapters']=len(ch)
    # walk every line in order via goNext, measure
    R['walk']=await pg.evaluate("""async()=>{const t=[];startPlay(0);let bad=[];
      for(let i=0;i<P.lines.length;i++){const s=performance.now();try{RT.idx=i;showPlay(false);}catch(e){bad.push([i,e.message]);}
        const st=document.querySelectorAll('#layer img, #layer .spr, #layer > *').length;t.push(performance.now()-s);
        if(i%200==0) await new Promise(r=>setTimeout(r,0));}
      t.sort((a,b)=>a-b);return {n:t.length,p50:t[t.length>>1],p99:t[Math.floor(t.length*.99)],max:t[t.length-1],bad:bad.slice(0,10),nbad:bad.length}}""")
    # CG first display decode timing
    R['cg']=await pg.evaluate("""async()=>{const out=[];const idx=P.lines.map((l,i)=>isCG(A(l.bg))?i:-1).filter(i=>i>=0);
      const seen=new Set();for(const i of idx){const b=P.lines[i].bg;if(seen.has(b))continue;seen.add(b);
        const s=performance.now();RT.idx=i;showPlay(false);const img=new Image();img.src=A(b).src;try{await img.decode()}catch(e){}out.push(performance.now()-s);}
      out.sort((a,b)=>a-b);return {n:out.length,p50:out[out.length>>1],max:out[out.length-1],heapMB:performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):null}}""")
    # save/load roundtrip
    for k,i in [('a',1200),('b',2500)]:
      pass
    R['save']=await pg.evaluate("""async()=>{const i=P.lines.findIndex((l,j)=>j>1500&&l.text&&!l.choices.length);startPlay(i);RT.vars['尾鳍']=7;
      for(let k=0;k<3;k++)goNext(RT.idx+1);const want={idx:RT.idx,id:P.lines[RT.idx].id,vars:JSON.stringify(RT.varsBefore)};
      await showSlots('save');document.querySelectorAll('#slots .slot')[0].click();await new Promise(r=>setTimeout(r,2500));
      startPlay(10);await showSlots('load');document.querySelectorAll('#slots .slot')[0].click();await new Promise(r=>setTimeout(r,1500));
      return {want,got:{idx:RT.idx,id:P.lines[RT.idx].id,vars:JSON.stringify(RT.vars)}}}""")
    # prev-line key
    R['prev']=await pg.evaluate("""()=>{startPlay(300);goNext(301);goNext(302);const a=RT.idx;document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));return [a,RT.idx]}""")
    await pg.evaluate("startPlay(P.lines.findIndex(l=>isCG(A(l.bg))))");await pg.wait_for_timeout(800)
    await pg.screenshot(path=str(OUT/'cg.jpg'),quality=70,type='jpeg')
    await pg.evaluate("stopPlay()");await pg.wait_for_timeout(1500)
    await pg.screenshot(path=str(OUT/'title2.jpg'),quality=70,type='jpeg')
    R['errs']=errs[:15];R['nerrs']=len(errs)
    print(json.dumps(R,ensure_ascii=False,indent=1))
    await b.close()
asyncio.run(main())
