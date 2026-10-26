"""Player progress: real UI, refresh recovery, legacy/manual slots and storage failure.

python tools/check_player_progress.py --browser <browser.exe> --out <report.json>
"""
import argparse
import asyncio
import json
import functools
import http.server
import threading
import re
from urllib.parse import unquote, urlsplit
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / '海风与布丁'


class GameHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, game, overlay=None, **kw):
        self.game = game.resolve()
        self.overlay = overlay.resolve() if overlay else None
        super().__init__(*a, directory=str(self.game), **kw)

    def translate_path(self, path):
        rel = unquote(urlsplit(path).path).lstrip('/') or 'index.html'
        if self.overlay:
            candidate = (self.overlay / rel).resolve()
            if candidate.is_relative_to(self.overlay) and candidate.is_file():
                return str(candidate)
        return super().translate_path(path)

    def log_message(self, fmt, *args):
        pass

    def send_head(self):
        # Media seeking needs byte ranges, matching the packaged host and file://.
        self._range_bytes = None
        path = Path(self.translate_path(self.path))
        match = re.fullmatch(r'bytes=(\d+)-(\d*)', self.headers.get('Range', ''))
        if match and path.is_file():
            size = path.stat().st_size
            start, end = int(match[1]), min(int(match[2]) if match[2] else size - 1, size - 1)
            if start >= size or start > end:
                self.send_error(416)
                return None
            stream = path.open('rb')
            stream.seek(start)
            self._range_bytes = end - start + 1
            self.send_response(206)
            self.send_header('Content-Type', self.guess_type(str(path)))
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
            self.send_header('Content-Length', str(self._range_bytes))
            self.end_headers()
            return stream
        return super().send_head()

    def copyfile(self, source, outputfile):
        if self._range_bytes is None:
            return super().copyfile(source, outputfile)
        remaining = self._range_bytes
        while remaining:
            data = source.read(min(65536, remaining))
            if not data:
                break
            outputfile.write(data)
            remaining -= len(data)


async def check(args):
    report = {'checks': {}, 'errors': []}
    handler = functools.partial(GameHandler, game=args.game, overlay=args.overlay)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = 'http://127.0.0.1:%d/index.html' % server.server_port
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(**({'executable_path': args.browser} if args.browser else {'channel': 'msedge'}), args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await browser.new_context(viewport={'width': 1600, 'height': 900})
        page = await ctx.new_page()
        page.on('pageerror', lambda e: report['errors'].append(str(e)))

        async def loaded():
            await page.wait_for_function('typeof P !== "undefined" && document.querySelector("#title.show")')
            await page.wait_for_timeout(350)

        async def at(i):
            await page.evaluate('(i)=>{startPlay(i);finishTyping();clearTimers()}', i)
            await page.wait_for_timeout(900)

        async def continuation():
            await page.wait_for_function('document.querySelector("[data-t=start]").textContent === "继续游戏"')
            await page.locator('[data-t=start]').click()
            await page.wait_for_timeout(450)
            await page.evaluate('finishTyping();clearTimers()')

        await page.goto(url)
        await loaded()
        assert await page.evaluate('pref("ghost")') == .45
        assert await page.evaluate('pref("vbgm")') == .25
        assert await page.evaluate('voiceEnabledAt(0) && !voiceEnabledAt(P.lines.findIndex(l=>l.id===P.settings.voiceOptionalFromChapterId))')
        await at(45)
        bright = await page.locator('#ptx').evaluate('(e)=>({color:getComputedStyle(e).color,size:getComputedStyle(e).fontSize})')
        if args.shots:
            await page.mouse.move(2, 2)
            await page.screenshot(path=str(args.shots / 'reading-day.jpg'), quality=88)
        await at(1811)
        dim = await page.locator('#ptx').evaluate('(e)=>({color:getComputedStyle(e).color,size:getComputedStyle(e).fontSize})')
        assert bright['color'] != dim['color'] and bright['size'] == dim['size']
        report['checks']['reading'] = {'defaultOpacity': .45, 'day': bright, 'night': dim}
        if args.shots:
            await page.screenshot(path=str(args.shots / 'reading-night.jpg'), quality=88)

        await at(47)
        await page.locator('#choices button').first.click()
        await page.wait_for_timeout(850)
        assert await page.evaluate('RT.vars["好感"]') == 10
        await page.evaluate('showSlots("save")')
        await page.locator('#slots .slot').nth(1).click()
        await page.wait_for_function('!document.querySelectorAll("#slots .slot")[1].classList.contains("empty")')
        assert await page.locator('#slots .slot').count() == 6
        manual = await page.evaluate('async()=>(await idbGet(saveKey()))[2]')
        assert manual['lineId'] == '2360dvsq'
        await page.locator('#slots .ovx').click()
        await page.evaluate('goNext(166);finishTyping();clearTimers()')
        await page.wait_for_function('P.lines[RT.idx].id === "8h4dtt5t"')
        await page.wait_for_timeout(500)
        saves = await page.evaluate('async()=>{await playerSaveQueue;return idbGet(saveKey())}')
        assert saves['auto']['lineId'] == '8h4dtt5t' and saves['auto']['vars']['好感'] == 10
        assert saves['2'] == manual
        report['checks']['chapterAndManualCoexist'] = True
        await page.locator('[data-pc=exit]').click()
        await loaded()
        await page.reload()
        await loaded()
        await continuation()
        assert await page.evaluate('RT.idx===166 && RT.vars["好感"]===10')
        assert await page.evaluate('READ.has("8h4dtt5t")')
        report['checks']['chapterReloadContinue'] = True

        # This node applies a variable on entry; reloading must apply it once.
        await page.evaluate('startPlay(300);finishTyping();clearTimers()')
        await page.wait_for_timeout(900)
        await page.wait_for_function('bgmEl && bgmEl.readyState >= 2')
        await page.evaluate('bgmEl.currentTime=12')
        before = await page.evaluate('({tails:RT.vars["尾鳍"],music:bgmId,ambient:[...ambientTracks.keys()]})')
        assert before['tails'] == 1
        # Refresh before the new line's normal 650 ms write; unload recovery is required.
        await page.evaluate('goNext(301);finishTyping();clearTimers()')
        await page.reload()
        await loaded()
        await continuation()
        after = await page.evaluate('({idx:RT.idx,tails:RT.vars["尾鳍"],music:bgmId,time:bgmEl?.currentTime,ambient:[...ambientTracks.keys()]})')
        assert after['idx'] == 301 and after['tails'] == 1
        assert after['music'] == before['music'] and abs(after['time'] - 12) < 2, {'before': before, 'after': after}
        assert after['ambient'] == before['ambient']
        report['checks']['fastRefreshAndAudio'] = after
        await page.evaluate('startPlay(300);finishTyping();clearTimers()')
        await page.wait_for_timeout(850)
        await page.locator('[data-pc=exit]').click()
        await loaded()
        await continuation()
        assert await page.evaluate('RT.idx === 300 && RT.vars["尾鳍"] === 1')
        report['checks']['entryEffectNotDoubled'] = True

        await page.evaluate('setPref("ghost",.7)')
        await page.reload()
        await loaded()
        assert await page.evaluate('pref("ghost")') == .7
        report['checks']['customOpacityRetained'] = True
        await page.evaluate('showSlots("load")')
        await page.wait_for_timeout(900)
        assert await page.locator('#slots .resume-save').count() == 1
        assert await page.locator('#slots .resume-save').evaluate('(e)=>getComputedStyle(e).display') == 'grid'
        assert await page.locator('#slots .slot').count() == 6
        if args.shots:
            await page.screenshot(path=str(args.shots / 'load-progress.jpg'), quality=88)
        await page.locator('#slots .ovx').click()
        await page.wait_for_timeout(900)
        if args.shots:
            await page.screenshot(path=str(args.shots / 'title-continue.jpg'), quality=88)
        page.once('dialog', lambda d: d.dismiss())
        await page.locator('.restart-link').click()
        assert await page.locator('#title').is_visible()
        await page.evaluate('showSlots("load")')
        await page.wait_for_timeout(900)
        page.once('dialog', lambda d: d.accept())
        await page.locator('#slots .save-restart').click()
        await page.wait_for_function('RT.idx === 3')
        await page.wait_for_timeout(750)
        assert await page.evaluate('async()=>(await idbGet(saveKey()))[2].lineId') == manual['lineId']
        report['checks']['restartKeepsManualSlots'] = True
        await page.locator('[data-pc=exit]').click()
        await loaded()

        # Existing manual-only records with the old shape remain readable.
        legacy = await browser.new_context()
        p2 = await legacy.new_page()
        await p2.goto(url)
        await p2.wait_for_function('typeof P !== "undefined"')
        await p2.evaluate('async()=>{await idbSet(saveKey(),{6:{time:123,lineId:P.lines[300].id,idx:1,vars:{"好感":7,"尾鳍":4},back:[],text:"旧手动档",bg:P.lines[300].bg}});showTitle()}')
        await p2.wait_for_function('document.querySelector("[data-t=start]").textContent === "继续游戏"')
        await p2.locator('[data-t=start]').click()
        await p2.wait_for_timeout(350)
        assert await p2.evaluate('RT.idx===300 && RT.vars["好感"]===7 && RT.vars["尾鳍"]===5')
        report['checks']['legacyByStableId'] = True
        await legacy.close()

        # IndexedDB failure still leaves a usable synchronous recovery.
        await continuation()
        await page.evaluate('window.originalPlayerIdbSet=idbSet;idbSet=async()=>false;startPlay(166);finishTyping();clearTimers()')
        await page.wait_for_timeout(400)
        assert await page.evaluate('readRecovery()?.lineId === P.lines[166].id')
        await page.locator('[data-pc=exit]').click()
        await loaded()
        await continuation()
        assert await page.evaluate('RT.idx===166')
        report['checks']['idbFailureRecovery'] = True

        # Both stores fail: cancel keeps play running; explicit confirmation exits.
        await page.evaluate('()=>{window.originalStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(String(k).startsWith("vncontinue:"))throw new Error("test quota");return originalStorageSet.call(this,k,v)}}')
        page.once('dialog', lambda d: d.dismiss())
        await page.locator('[data-pc=exit]').click()
        await page.wait_for_timeout(400)
        assert not await page.locator('#title').is_visible()
        assert await page.evaluate('progressActive && !progressLeaving && RT.idx===166')
        report['checks']['failedSaveCancelExit'] = True
        page.once('dialog', lambda d: d.accept())
        await page.locator('[data-pc=exit]').click()
        await loaded()
        report['checks']['failedSaveConfirmedExit'] = True
        assert not report['errors'], report['errors']
        await ctx.close()
        await browser.close()
    server.shutdown()
    report['ok'] = True
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--game', type=Path, default=GAME)
    parser.add_argument('--overlay', type=Path, help='Optional isolated changed-file overlay; remaining assets come from --game')
    parser.add_argument('--browser')
    parser.add_argument('--out', type=Path)
    parser.add_argument('--shots', type=Path)
    args = parser.parse_args()
    if args.shots:
        args.shots.mkdir(parents=True, exist_ok=True)
    result = asyncio.run(check(args))
    if args.out:
        args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))
