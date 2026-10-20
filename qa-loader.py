from pathlib import Path
import json, sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    results=[]
    for width,height in [(1440,900),(390,844),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(sys.argv[1] if len(sys.argv)>1 else (ROOT/'index.html').as_uri())
        assert page.locator('#intro-loader').count()==1,'The Flapcha loader must be present'
        assert page.locator('#intro-loader').is_visible()
        # Global gameplay shortcuts cannot act behind the introduction.
        page.keyboard.press('Space');page.keyboard.press('p');page.keyboard.press('Escape')
        page.wait_for_function('window.pokeDefense && !document.querySelector("#intro-entry").hidden')
        assert page.evaluate('pokeDefense.game.wave')==0
        assert not page.evaluate('pokeDefense.paused')
        assert page.locator('#intro-loader h1').inner_text()=='POKETH'
        assert page.locator('#intro-play').inner_text()=='PLAY'
        assert page.locator('#intro-loader p').count()==0
        assert page.locator('#intro-loader').inner_text().split()==['POKETH','PLAY']
        page.wait_for_function('document.querySelector("#intro-loader video").readyState>=2')
        video=page.evaluate('''()=>{const v=document.querySelector('#intro-loader video');return {time:v.currentTime,paused:v.paused,muted:v.muted,loop:v.loop,width:v.videoWidth,height:v.videoHeight};}''')
        assert not video['paused'] and video['muted'] and video['loop'],video
        page.wait_for_timeout(300)
        assert page.evaluate('document.querySelector("#intro-loader video").currentTime')>video['time']
        assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
        page.screenshot(path=str(ROOT/f'qa-loader-{width}x{height}.png'))
        # Escape must not dismiss the loader. Tab stays on the single entry control.
        page.keyboard.press('Escape');assert page.locator('#intro-loader').is_visible()
        page.locator('#intro-play').click()
        assert page.locator('#intro-loader').is_hidden()
        assert page.evaluate('document.querySelector("#intro-loader video").paused')
        assert not page.evaluate('document.querySelector(".interface").inert')
        page.locator('.pokemon-card[data-type="piplup"]').click()
        q=page.evaluate('pokeDefense.toScreen(TD.pads[4].x,TD.pads[4].y)')
        page.mouse.click(q['x'],q['y'])
        assert page.evaluate('pokeDefense.game.towers.length')==1
        page.locator('#launch').click()
        assert page.evaluate('pokeDefense.game.wave')==1
        assert not errors,errors
        results.append({'viewport':[width,height],'loader':'PASS','video':video,'play_enters_game':'PASS','deployment_and_wave':'PASS','console_errors':errors})
        page.close()
    print(json.dumps(results,indent=2))
    browser.close()
