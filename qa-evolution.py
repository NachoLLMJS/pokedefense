from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
LINES={'treecko':[(252,'Treecko'),(253,'Grovyle'),(254,'Sceptile')],'charmander':[(4,'Charmander'),(5,'Charmeleon'),(6,'Charizard')],'squirtle':[(7,'Squirtle'),(8,'Wartortle'),(9,'Blastoise')],'pikachu':[(25,'Pikachu'),(26,'Raichu'),(26,'Raichu')],'piplup':[(393,'Piplup'),(394,'Prinplup'),(395,'Empoleon')],'fennekin':[(653,'Fennekin'),(654,'Braixen'),(655,'Delphox')]}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[];failed=[];results=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('requestfailed',lambda r:failed.append(r.url))
    for kind,forms in LINES.items():
        page.goto((ROOT/'index.html').as_uri())
        page.wait_for_function('window.pokeDefense && document.fonts.status === "loaded"')
        page.locator(f'.pokemon-card[data-type="{kind}"]').click()
        q=page.evaluate('pokeDefense.toScreen(TD.pads[4].x,TD.pads[4].y)')
        page.mouse.click(q['x'],q['y'])
        assert page.locator('#upgrade').inner_text().startswith('EVOLVE'),kind
        before=page.evaluate('({gold:pokeDefense.game.gold,cost:TD.stats(pokeDefense.game.towers[0]).upgradeCost,id:pokeDefense.game.towers[0].id})')
        page.locator('#upgrade').click()
        assert page.locator('#inspect-name').inner_text()==f'{forms[1][1]} · Level 2'
        current=page.evaluate('''()=>{const t=pokeDefense.game.towers[0],a=pokeDefense.skills.actor(t.id);return {gold:pokeDefense.game.gold,id:t.id,dex:t.dex,actor:a.dex,anim:a.anim.dex,pad:t.pad,move:a.move.id}}''')
        assert current['gold']==before['gold']-before['cost']
        assert current['id']==before['id'] and current['pad']==4
        assert current['dex']==current['actor']==current['anim']==forms[1][0],current
        # Earn the remaining upgrade cost through real combat instead of forging balances.
        page.locator('#launch').click()
        first=page.evaluate('''()=>{const g=pokeDefense.game;for(let i=0;i<12000&&g.status==='wave';i++){g.update(.05);G.FX.update(.05);}return {status:g.status,hp:g.hp,gold:g.gold,kills:g.kills};}''')
        assert first['status']=='ready',first
        page.wait_for_function('!document.querySelector("#overlay").hidden')
        page.locator('#overlay-prepare').click()
        expected_label='UPGRADE' if kind=='pikachu' else 'EVOLVE'
        assert page.locator('#upgrade').inner_text().startswith(expected_label)
        assert page.locator('#upgrade').is_enabled(),{'kind':kind,'wave':first}
        page.locator('#upgrade').click()
        assert page.locator('#inspect-name').inner_text()==f'{forms[2][1]} · Level 3'
        assert page.locator('#upgrade').inner_text()=='MAX LEVEL'
        assert page.locator('#upgrade').is_disabled()
        stat_text=page.locator('#inspect-stats').inner_text()
        assert not __import__('re').search(r'\d+\.\d{3,}',stat_text),stat_text
        last=page.evaluate('''()=>{const t=pokeDefense.game.towers[0],a=pokeDefense.skills.actor(t.id);return {dex:t.dex,actor:a.dex,anim:a.anim.dex,id:t.id,pad:t.pad,level:t.level,move:a.move.id}}''')
        assert last['dex']==last['actor']==last['anim']==forms[2][0],last
        assert last['id']==before['id'] and last['pad']==4 and last['move']==current['move']
        if kind=='charmander':
            page.wait_for_timeout(650)
            page.screenshot(path=str(ROOT/'qa-evolution-charizard-desktop.png'))
        if kind=='pikachu':
            page.set_viewport_size({'width':390,'height':844})
            page.wait_for_timeout(650)
            page.screenshot(path=str(ROOT/'qa-evolution-raichu-mobile.png'))
            page.set_viewport_size({'width':1440,'height':900})
        # Evolved attacks must continue through the same source combat pipeline.
        page.locator('#launch').click()
        attacking=page.evaluate('''()=>{const g=pokeDefense.game,before=g.kills;let frames=0;for(let i=0;i<4000&&g.status==='wave';i++){g.update(.02);if(G.Projectiles.count)frames++;if(g.kills>before)break;}const a=pokeDefense.skills.actor(g.towers[0].id);return {frames,kind:a.move.kind,dex:a.dex};}''')
        assert attacking['frames']>0 and attacking['kind'] in ['projectile','boomerang','nova'],attacking
        # Recall returns the real invested value and rebuilding begins unevolved.
        refund=page.evaluate('TD.stats(pokeDefense.game.towers[0]).sellValue')
        gold=page.evaluate('pokeDefense.game.gold')
        page.locator('#sell').click()
        assert page.evaluate('pokeDefense.game.towers.length')==0
        assert page.evaluate('pokeDefense.game.gold')>=gold+refund
        results.append({'pokemon':kind,'first_upgrade':forms[1][1],'second_upgrade':forms[2][1],'same_defender_and_pad':'PASS','ranged_combat':'PASS','recall':'PASS'})
    assets=page.evaluate('''async()=>{const bad=[];for(const d of TD.defenderDex){for(const anim of ['Idle','Shoot']){const name=G.Sprites.animMeta(d,anim),s=G.Sprites.sheet(d,anim);try{await s.img.decode();if(!s.img.naturalWidth)bad.push([d,anim]);}catch{bad.push([d,anim]);}}}return {forms:TD.defenderDex.length,bad};}''')
    assert not assets['bad'],assets
    assert not errors,errors
    assert not failed,failed
    result={'upgrades':results,'assets':assets,'console_errors':errors,'failed_resources':failed}
    (ROOT/'qa-evolution-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
    browser.close()
