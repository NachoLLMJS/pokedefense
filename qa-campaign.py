from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((ROOT/'index.html').as_uri())
    page.wait_for_function('window.pokeDefense')
    # Accelerate the real simulation; only public build/upgrade/wave methods spend or grant resources.
    result=page.evaluate('''()=>{
      const g=pokeDefense.game,report=[],seen=new Set();
      const placements=[['treecko',0],['squirtle',1],['pikachu',2],['piplup',3],['charmander',6],['fennekin',8],['squirtle',7],['pikachu',4],['treecko',9],['squirtle',5],['charmander',11],['pikachu',12],['fennekin',10],['squirtle',13]];
      for(let n=1;n<=15;n++){
        for(const [kind,pad] of placements)if(!g.towers.some(t=>t.pad===pad))g.build(kind,pad);
        for(let level=1;level<=2;level++)for(const t of g.towers)if(t.level===level)g.upgrade(t.id);
        if(!g.startWave())break;
        for(let i=0;i<12000&&g.status==='wave';i++){
          g.update(.05);G.FX.update(.05);
          for(const e of g.enemies)seen.add(e.dex);
        }
        report.push({wave:g.wave,status:g.status,hp:g.hp,kills:g.kills,gold:g.gold,towers:g.towers.length,projectiles:G.Projectiles.count,fields:G.Combat.fieldCount});
        if(g.status!=='ready')break;
      }
      return {waves:report,enemy_species_seen:seen.size,status:g.status,hp:g.hp,kills:g.kills};
    }''')
    assert result['status']=='won',result
    assert len(result['waves'])==15
    assert all(w['projectiles']==w['fields']==0 for w in result['waves'])
    assert not errors,errors
    page.wait_for_function('!document.querySelector("#overlay").hidden')
    assert page.locator('#overlay-title').inner_text()=='Home, safe home.'
    (ROOT/'qa-campaign-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
    browser.close()
