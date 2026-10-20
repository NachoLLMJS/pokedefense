from pathlib import Path
import json, sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
url=sys.argv[1] if len(sys.argv)>1 else (ROOT/'index.html').as_uri()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[];failed=[];results=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('requestfailed',lambda r:failed.append(r.url))
    page.goto(url)
    page.wait_for_function('window.pokeDefense && document.fonts.status === "loaded"')
    page.locator('.pokemon-card[data-type="piplup"]').click()
    q=page.evaluate('pokeDefense.toScreen(TD.pads[4].x,TD.pads[4].y)')
    page.mouse.click(q['x'],q['y'])
    for level,dex,name in [(1,393,'Piplup'),(2,394,'Prinplup'),(3,395,'Empoleon')]:
        if level>1: page.locator('#upgrade').click()
        page.wait_for_function(f'pokeDefense.skills.actor(pokeDefense.game.towers[0].id).dex==={dex}')
        check=page.evaluate('''async()=>{const g=pokeDefense.game,a=pokeDefense.skills.actor(g.towers[0].id);for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){a.aim=angle;a.cast(a.move);if(a.anim.dir!==0)throw Error('not facing down');}await G.Sprites.sheet(a.dex,'Shoot').img.decode();return {dex:a.dex,dir:a.anim.dir,move:a.move.id};}''')
        assert check=={'dex':dex,'dir':0,'move':'bubble'},check
        page.wait_for_timeout(250)
        page.screenshot(path=str(ROOT/f'qa-piplup-{dex}.png'))
        page.locator('#launch').click()
        combat=page.evaluate('''()=>{const g=pokeDefense.game;let maxShots=0,wrong=0;for(let i=0;i<12000&&g.status==='wave';i++){g.update(.05);const a=pokeDefense.skills.actor(g.towers[0].id);maxShots=Math.max(maxShots,G.Projectiles.count);if(a.anim.dir!==0)wrong++;}return {status:g.status,wrong,maxShots};}''')
        assert combat['status']=='ready' and combat['wrong']==0 and combat['maxShots']>=8,combat
        page.wait_for_function('!document.querySelector("#overlay").hidden')
        page.locator('#overlay-prepare').click()
        results.append({'name':name,**check,**combat})
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(300)
    assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
    page.screenshot(path=str(ROOT/'qa-piplup-mobile.png'))
    assert not errors,errors
    assert not failed,failed
    print(json.dumps({'url':url,'forms':results,'console_errors':errors,'failed_requests':failed},indent=2))
    browser.close()
