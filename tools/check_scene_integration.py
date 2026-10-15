"""Review scene-light inheritance, editing and export without paid model calls.

Run with the QA Python environment (Playwright). A temporary, read-only HTTP
server avoids local-file canvas restrictions and is stopped when review ends.
This complements check_character_direction.py; it does not repeat its 18 shots.
"""
from __future__ import annotations

import argparse
import asyncio
import functools
import hashlib
import json
import subprocess
import threading
import traceback
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright


ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "content/imports/vnstudio/海风与布丁"
GAME_URL = "/content/imports/vnstudio/海风与布丁/index.html"
DEFAULT_EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"


def project() -> dict:
    source = (GAME / "game.js").read_text(encoding="utf-8-sig")
    return json.loads(source.split("=", 1)[1].strip().removesuffix(";"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class ReviewHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def translate_path(self, path):
        # Match the authoring library's hosted asset URLs after JSON reload.
        path = urlsplit(path).path
        if path.startswith("/art-assets/"):
            path = "/content/" + path.removeprefix("/art-assets/")
        return super().translate_path(path)

    def do_POST(self):
        self.send_error(405, "Read-only review server")


@contextmanager
def review_server():
    handler = functools.partial(ReviewHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=2)


def check(report: dict, name: str, actual, expected):
    report["checks"][name] = {
        "actual": actual, "expected": expected, "passed": actual == expected,
    }


async def open_game(browser, url: str, errors: list, *, editor=False):
    page = await browser.new_page(reduced_motion="reduce")
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    await page.goto(url, timeout=60000)
    await page.wait_for_function('typeof P!=="undefined"', timeout=60000)
    if editor:
        await page.wait_for_function("window.VN_ART_READY===true", timeout=60000)
    return page


async def choose_cases(page) -> dict:
    return await page.evaluate("""() => {
      const candidates=P.lines.map((line,index)=>({line,index,bg:A(line.bg)}))
        .filter(c=>c.line.sprites.length===1 && c.bg?.sceneFit && !c.bg.cg);
      const night=candidates.find(c=>c.bg.lighting==='night' && c.bg.sceneFit.brightness<.9);
      const day=candidates.find(c=>c.bg.lighting==='day');
      const seats=candidates.filter(c=>c.bg.id==='acqkjhf8' && c.bg.productionArtId==='B07');
      const seat=seats.find(c=>[P.lines[c.index-1],P.lines[c.index+1]]
        .some(l=>l && visKey(l)===visKey(c.line)))||seats[0];
      const cg=P.lines.map((line,index)=>({line,index,bg:A(line.bg)}))
        .find(c=>c.bg?.cg && !c.line.sprites.length && !c.line.mood);
      const describe=c=>c?{index:c.index,id:c.line.id,bg:c.line.bg,
        name:c.bg.name,profile:c.bg.sceneFit||null,view:c.bg.view||null,
        sprite:c.line.sprites[0]||null}:null;
      return {night:describe(night),day:describe(day),seat:describe(seat),cg:describe(cg)};
    }""")


async def runtime_review(page, cases: dict, report: dict):
    if not all(cases.values()):
        raise AssertionError(f"Required authored night/day/B07/CG cases missing: {cases}")
    actual = await page.evaluate("""async(cases)=>{
      const l=P.lines[cases.night.index],s=l.sprites[0];
      const originalSprite=clone(s),originalMood=l.mood;
      const geometry=()=>JSON.stringify(P.lines.map(l=>({id:l.id,
        sprites:l.sprites.map(s=>[s.uid,s.asset,s.x,s.y,s.h,!!s.flip])})));
      const beforeGeometry=geometry();
      delete s.sceneFit;delete s.look;
      startPlay(cases.night.index);finishTyping();clearTimers();
      await new Promise(r=>setTimeout(r,500));
      let el=layer.querySelector('img.spr:not(.leaving)');
      const inherited={resolved:sceneFitFor(s,l),filter:getComputedStyle(el).filter,
        inline:el.style.getPropertyValue('--scene-light')};
      s.sceneFit={mode:'off'};s.look='gray';renderStage(l,false);
      const off={resolved:sceneFitFor(s,l),inline:el.style.getPropertyValue('--scene-light'),
        look:el.style.getPropertyValue('--lk'),filter:getComputedStyle(el).filter};
      s.sceneFit={mode:'custom',brightness:99,saturation:-99,warmth:NaN};renderStage(l,false);
      const bounded=sceneFitFor(s,l);el.classList.add('dim');
      const dim=getComputedStyle(el).filter;el.classList.remove('dim');
      const invalid=sceneFitFor({sceneFit:{mode:'custom',brightness:Infinity,
        saturation:NaN,warmth:null}},l);
      const low=sceneFitFor({sceneFit:{mode:'custom',brightness:-Infinity,
        saturation:Infinity,warmth:-100}},l);
      const high=sceneFitFor({sceneFit:{mode:'custom',brightness:-100,
        saturation:100,warmth:100}},l);
      const unknown=sceneFitFor({sceneFit:{mode:'unknown',brightness:.6}},l);
      s.sceneFit={mode:'custom',brightness:.9,saturation:.9,warmth:1};renderStage(l,false);
      const grayWarm=getComputedStyle(el).filter;
      el.classList.add('sel');const selected=getComputedStyle(el).filter;el.classList.remove('sel');
      l.mood='gray';renderStage(l,false);const mood=getComputedStyle(layer).filter;
      const mini=document.createElement('div');miniScene(mini,l);
      const miniFilter=mini.querySelector('img').style.filter;
      const expectedMini=document.createElement('img');expectedMini.style.filter=spriteFilterCss(s,l);
      const thumb=await makeThumb(l);
      Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,originalSprite);l.mood=originalMood;
      // A quick skip replaces the night grade with the authored day grade, rather than retaining it.
      RT.skip=true;goNext(cases.night.index);finishTyping();clearTimers();
      const nightInline=layer.querySelector('img.spr:not(.leaving)').style.getPropertyValue('--scene-light');
      goNext(cases.day.index);finishTyping();clearTimers();
      el=layer.querySelector('img.spr:not(.leaving)');
      const dl=P.lines[cases.day.index],ds=dl.sprites[0];
      const day={inline:el.style.getPropertyValue('--scene-light'),expected:sceneFitCss(sceneFitFor(ds,dl)),
        actualAsset:el.dataset.asset,expectedAsset:ds.asset,active:layer.querySelectorAll('img.spr:not(.leaving)').length,
        total:layer.querySelectorAll('img.spr').length,ghosts:layer.querySelectorAll('.pose-ghost').length};
      const savedFit=ds.sceneFit;ds.sceneFit={mode:'off'};renderStage(dl,false);
      const cleared=layer.querySelector('img.spr:not(.leaving)').style.getPropertyValue('--scene-light');
      if(savedFit===undefined)delete ds.sceneFit;else ds.sceneFit=savedFit;
      goNext(cases.seat.index);finishTyping();clearTimers();
      const seat={bg:P.lines[cases.seat.index].bg,assetView:A(P.lines[cases.seat.index].bg).view||null,
        size:bgEl.style.backgroundSize,position:bgEl.style.backgroundPosition};
      const viewProbe=document.createElement('div');viewProbe.style.backgroundSize=cases.seat.view?.size||'';
      viewProbe.style.backgroundPosition=cases.seat.view?.position||'';
      seat.expectedSize=viewProbe.style.backgroundSize;seat.expectedPosition=viewProbe.style.backgroundPosition;
      goNext(cases.cg.index);finishTyping();clearTimers();
      const cg={actors:layer.querySelectorAll('img.spr').length,backgroundFilter:getComputedStyle(bgEl).filter};
      return{inherited,off,bounded,invalid,low,high,unknown,dim,grayWarm,selected,mood,
        miniFilter,expectedMini:expectedMini.style.filter,canvasThumbnail:!!thumb?.startsWith('data:image/jpeg'),
        nightInline,day,cleared,seat,cg,geometryUnchanged:beforeGeometry===geometry(),
        geometryRows:P.lines.length};
    }""", cases)
    report["runtime"] = actual
    profile = {"mode": "inherit", **cases["night"]["profile"]}
    check(report, "inheritAuthoredNightProfile", actual["inherited"]["resolved"], profile)
    check(report, "offIsNeutral", actual["off"]["resolved"],
          {"mode": "off", "brightness": 1, "saturation": 1, "warmth": 0})
    check(report, "offClearsSceneFilter", actual["off"]["inline"], "")
    check(report, "offPreservesDramaticLook", "grayscale(1)" in actual["off"]["filter"], True)
    check(report, "customClampsAndRejectsNaN", actual["bounded"],
          {"mode": "custom", "brightness": 1.2, "saturation": .65, "warmth": 0})
    check(report, "invalidValuesUseNeutral", actual["invalid"],
          {"mode": "custom", "brightness": 1, "saturation": 1, "warmth": 0})
    check(report, "infinityAndNegativeWarmth", actual["low"],
          {"mode": "custom", "brightness": 1, "saturation": 1, "warmth": -1})
    check(report, "allFiniteBounds", actual["high"],
          {"mode": "custom", "brightness": .6, "saturation": 1.2, "warmth": 1})
    check(report, "unknownModeInherits", actual["unknown"], profile)
    check(report, "dimKeepsSceneAndLook", all(part in actual["dim"] for part in
          ["brightness(1.2)", "saturate(0.65)", "grayscale(1)", "brightness(0.62)"]), True)
    check(report, "grayLookAppliedAfterWarmth",
          actual["grayWarm"].index("sepia(") < actual["grayWarm"].index("grayscale(1)"), True)
    check(report, "selectedKeepsSceneAndLook", all(part in actual["selected"] for part in
          ["brightness(0.9)", "sepia(", "grayscale(1)", "drop-shadow("]), True)
    check(report, "grayMoodStillApplies", "grayscale(1)" in actual["mood"], True)
    check(report, "miniPreviewMatchesSpriteFilter", actual["miniFilter"], actual["expectedMini"])
    check(report, "canvasThumbnailRendered", actual["canvasThumbnail"], True)
    check(report, "fastDayGradeMatches", actual["day"]["inline"], actual["day"]["expected"])
    check(report, "nightAndDayGradesDiffer", actual["nightInline"] != actual["day"]["inline"], True)
    check(report, "fastDayActorMatches", actual["day"]["actualAsset"], actual["day"]["expectedAsset"])
    check(report, "oneActiveActor", actual["day"]["active"], 1)
    check(report, "oneTotalActorNoGhosts", [actual["day"]["total"], actual["day"]["ghosts"]], [1, 0])
    check(report, "offAfterFastChangeLeavesNoGrade", actual["cleared"], "")
    check(report, "seatUsesOriginalB07Asset", actual["seat"]["bg"], "acqkjhf8")
    check(report, "seatViewMetadata", actual["seat"]["assetView"], cases["seat"]["view"])
    check(report, "seatViewApplied", [actual["seat"]["size"], actual["seat"]["position"]],
          [actual["seat"]["expectedSize"], actual["seat"]["expectedPosition"]])
    check(report, "cgHasNoAddedActorOrGrade", actual["cg"], {"actors": 0, "backgroundFilter": "none"})
    check(report, "allGeometryUnchanged", actual["geometryUnchanged"], True)


async def editor_review(page, cases: dict, report: dict):
    before = await page.evaluate("""(cases)=>{
      goto(cases.seat.index);P.settings.link=true;
      window.__fitReviewBefore={indexes:affected(),sprites:affected().map(i=>clone(P.lines[i].sprites)),
        geometry:[L().sprites[0].x,L().sprites[0].y,L().sprites[0].h],history:hist.length,
        bg:L().bg,view:A(L().bg).view||null,profile:clone(A(L().bg).sceneFit)};
      return window.__fitReviewBefore;
    }""", cases)
    await page.locator("#bArtAdjust").click()
    await page.locator("#artSceneFit").select_option("custom")
    field = page.locator('[data-scene-fit="brightness"]')
    await field.fill("0.82")
    # Let an actual focus change commit exactly one change; dispatch+blur would double-fire.
    await field.press("Tab")
    after = await page.evaluate("""()=>{
      window.__fitReviewSaved=JSON.parse(JSON.stringify(P));
      return{fits:affected().map(i=>clone(P.lines[i].sprites[0].sceneFit)),
        geometry:[L().sprites[0].x,L().sprites[0].y,L().sprites[0].h],
        inline:layer.querySelector('img.spr').style.getPropertyValue('--scene-light'),history:hist.length,
        playable:VNArtLibrary.playableProject().lines[P.cur].sprites[0].sceneFit};
    }""")
    await page.locator("#modal [data-a=c]").click()
    await page.locator("#modal").wait_for(state="hidden")
    # Modal closure is explicit before toolbar clicks so they cannot hit an overlay.
    await page.locator("#bUndo").click()
    first_undo = await page.evaluate("L().sprites[0].sceneFit")
    await page.locator("#bUndo").click()
    restored = await page.evaluate("""()=>window.__fitReviewBefore.indexes.map(i=>clone(P.lines[i].sprites))""")
    reloaded = await page.evaluate("""()=>{
      const saved=window.__fitReviewSaved;loadProject(JSON.parse(JSON.stringify(saved)));
      return{fits:window.__fitReviewBefore.indexes.map(i=>clone(P.lines[i].sprites[0].sceneFit)),
        geometry:[L().sprites[0].x,L().sprites[0].y,L().sprites[0].h],bg:L().bg,view:A(L().bg).view||null,
        profile:clone(A(L().bg).sceneFit),size:bgEl.style.backgroundSize,position:bgEl.style.backgroundPosition,
        inline:layer.querySelector('img.spr').style.getPropertyValue('--scene-light'),
        sprite:clone(L().sprites[0]),modalVisible:getComputedStyle($('#modal')).display!=='none'};
    }""")
    report["editor"] = {"before": before, "after": after, "firstUndo": first_undo,
                        "restoredSprites": restored, "reloaded": reloaded}
    check(report, "editorHasLinkedRange", len(before["indexes"]) > 1, True)
    check(report, "editorChangesAllLinkedFits", [(f["mode"], f["brightness"]) for f in after["fits"]],
          [("custom", .82)] * len(before["indexes"]))
    check(report, "editorKeepsGeometry", after["geometry"], before["geometry"])
    check(report, "editorRecordsTwoUndoSteps", after["history"] - before["history"], 2)
    check(report, "editorUndoFirstChange", first_undo["brightness"] != .82, True)
    check(report, "editorUndoRestoresOriginalSprites", restored, before["sprites"])
    check(report, "playableExportKeepsFit", after["playable"], after["fits"][0])
    check(report, "jsonReloadKeepsLinkedFits", reloaded["fits"], after["fits"])
    check(report, "jsonReloadKeepsGeometry", reloaded["geometry"], before["geometry"])
    check(report, "jsonReloadKeepsBackdropView", reloaded["view"], before["view"])
    check(report, "jsonReloadKeepsBackdropProfile", reloaded["profile"], before["profile"])
    check(report, "jsonReloadKeepsOriginalB07Reference", reloaded["bg"], before["bg"])
    check(report, "jsonReloadAppliesSeatView", [reloaded["size"], reloaded["position"]],
          [report["runtime"]["seat"]["expectedSize"], report["runtime"]["seat"]["expectedPosition"]])
    check(report, "jsonReloadAppliesFit", reloaded["inline"], after["inline"])
    check(report, "editorModalClosed", reloaded["modalVisible"], False)
    boundary = await page.evaluate("""()=>{
      const rows=window.__fitReviewBefore.indexes,other=rows.find(i=>i!==P.cur);
      const s=P.lines[other].sprites[0],saved=clone(s.sceneFit);
      s.sceneFit={mode:'off'};
      const separated=!affected().includes(other);
      const lane=laneById('ch:'+charKey(A(s.asset)));
      const separateClip=cellOf(lane,other).key!==cellOf(lane,P.cur).key;
      const x=s.x;edit(l=>l.sprites[0].x+=1);
      const protectedPosition=s.x===x;undo();
      P.lines[other].sprites[0].sceneFit=saved;
      return {separated,separateClip,protectedPosition};
    }""")
    report["editor"]["independentGradeBoundary"] = boundary
    check(report, "differentGradeEndsLinkedRange", boundary["separated"], True)
    check(report, "timelineShowsIndependentGrade", boundary["separateClip"], True)
    check(report, "positionEditProtectsDifferentGrade", boundary["protectedPosition"], True)


async def offline_review(browser, single: Path, cases: dict, source: dict, report: dict):
    page = await browser.new_page(reduced_motion="reduce")
    page.on("pageerror", lambda exc: report["browserErrors"].append("offline:" + str(exc)))
    await page.route("http://**/*", lambda route: route.abort())
    await page.route("https://**/*", lambda route: route.abort())
    await page.goto(single.as_uri(), timeout=60000)
    await page.wait_for_function('typeof P!=="undefined"', timeout=60000)
    result = await page.evaluate("""async(cases)=>{
      startPlay(cases.night.index);finishTyping();clearTimers();await new Promise(r=>setTimeout(r,500));
      const l=P.lines[cases.night.index],s=l.sprites[0],el=layer.querySelector('img.spr:not(.leaving)');
      const night={profile:clone(A(l.bg).sceneFit),inline:el.style.getPropertyValue('--scene-light'),
        expected:sceneFitCss({mode:'inherit',...cases.night.profile}),actors:layer.querySelectorAll('img.spr').length};
      RT.skip=true;goNext(cases.seat.index);finishTyping();clearTimers();
      const seat={bg:P.lines[cases.seat.index].bg,view:A(P.lines[cases.seat.index].bg).view||null,
        size:bgEl.style.backgroundSize,position:bgEl.style.backgroundPosition,actors:layer.querySelectorAll('img.spr').length};
      return{ids:P.lines.map(l=>l.id),embedded:Object.values(P.assets).every(a=>a.src.startsWith('data:')),
        night,seat,assetCount:Object.keys(P.assets).length};
    }""", cases)
    report["offline"] = {"path": str(single), "sha256": sha256(single), **result}
    check(report, "offlineLineIdsMatchWorkingProject", result["ids"], [l["id"] for l in source["lines"]])
    check(report, "offlineAllAssetsEmbedded", result["embedded"], True)
    check(report, "offlineNightProfileMatchesWorkingProject", result["night"]["profile"], cases["night"]["profile"])
    check(report, "offlineNightGradeApplied", result["night"]["inline"], result["night"]["expected"])
    check(report, "offlineNoExtraActors", [result["night"]["actors"], result["seat"]["actors"]], [1, 1])
    check(report, "offlineOriginalB07Reference", result["seat"]["bg"], cases["seat"]["bg"])
    check(report, "offlineSeatViewPreserved", result["seat"]["view"], cases["seat"]["view"])
    check(report, "offlineSeatViewApplied", [result["seat"]["size"], result["seat"]["position"]],
          [report["runtime"]["seat"]["expectedSize"], report["runtime"]["seat"]["expectedPosition"]])
    await page.close()


async def review(output: Path, edge: str, single: Path | None):
    output.mkdir(parents=True, exist_ok=True)
    source = project()
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    report = {"baseline": {"head": head, "gameSha256": sha256(GAME / "game.js"),
                           "lines": len(source["lines"]), "sceneFitBackdrops":
                           [a["id"] for a in source["assets"].values() if a.get("sceneFit")]},
              "checks": {}, "browserErrors": []}
    lines=source['lines'];byid={l['id']:i for i,l in enumerate(lines)}
    poem=lines[byid['jifyqa4p']:byid['8a3f78h1']+1]
    counter=lines[byid['hkq3m6vy']:byid['1qnucnh3']+1]
    check(report,'poemUsesOneCoherentCg',sorted({source['assets'][l['bg']].get('productionArtId') for l in poem}),['C08'])
    check(report,'poemHasNoPastedSprite',sum(len(l['sprites']) for l in poem),0)
    check(report,'counterUsesOneCoherentCg',sorted({source['assets'][l['bg']].get('productionArtId') for l in counter}),['C26'])
    check(report,'counterHasNoPastedSprite',sum(len(l['sprites']) for l in counter),0)
    try:
        with review_server() as base:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(executable_path=edge, headless=True)
                try:
                    page = await open_game(browser, base + GAME_URL, report["browserErrors"])
                    cases = await choose_cases(page)
                    report["authoredCases"] = cases
                    await runtime_review(page, cases, report)
                    editor = await open_game(browser, base + GAME_URL + "?editor=1", report["browserErrors"], editor=True)
                    await editor_review(editor, cases, report)
                    if single:
                        await offline_review(browser, single.resolve(), cases, source, report)
                finally:
                    await browser.close()
    except Exception:
        report["exception"] = traceback.format_exc()
    check(report, "browserHasNoErrors", report["browserErrors"], [])
    report["gameSha256AfterReview"] = sha256(GAME / "game.js")
    check(report, "projectFileUnchangedDuringReview", report["gameSha256AfterReview"], report["baseline"]["gameSha256"])
    failures = [name for name, result in report["checks"].items() if not result["passed"]]
    report["failures"] = failures
    report["passed"] = not failures and "exception" not in report
    target = output / "scene-integration-validation.json"
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"report": str(target), "checks": len(report["checks"]),
                      "passed": report["passed"], "failures": failures,
                      "exception": report.get("exception")}, ensure_ascii=True))
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT.parent.parent / "outputs/scene-integration/review")
    parser.add_argument("--edge", default=DEFAULT_EDGE)
    parser.add_argument("--single", type=Path, help="Optional assembled single-file HTML to check with network blocked")
    args = parser.parse_args()
    asyncio.run(review(args.output, args.edge, args.single))
