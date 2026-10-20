POKEDEFENSE — RESCUE GROVE

Open: double-click Abrir PokeDefense.cmd or index.html. No installation, account, wallet or internet needed for gameplay.

1. Choose one of six Pokemon in the team panel.
2. Click an empty circular spot beside the trail to deploy it.
3. Send a wave when ready. All six defenders use original ranged abilities; attacks happen automatically.
4. Click a deployed Pokemon to evolve/upgrade (up to level 3) or recall it for partial coins. Each paid upgrade advances one available evolution. If there is no next form, it still improves power, range and attack speed. Pikachu becomes Raichu at the FIRST upgrade; its second upgrade keeps Raichu and improves stats. Evolution uses original source sprites/animations in place, keeps the defender ID, deployment spot, invested coins and learned ranged ability, and does not duplicate or erase its in-flight attacks.
   Treecko -> Grovyle -> Sceptile
   Charmander -> Charmeleon -> Charizard
   Squirtle -> Wartortle -> Blastoise
   Pikachu -> Raichu -> Raichu (stat upgrade)
   Piplup -> Prinplup -> Empoleon
   Fennekin -> Braixen -> Delphox
5. Survive 15 waves. Start with 8 enemies; every following wave adds exactly 4 (8, 12, 16 ... 64). There are 60 normal enemy species in five progression groups, plus Onix, Dragonite and Mewtwo as bosses every fifth wave. Visitors reaching the rescue base reduce its integrity.
6. A centered wave-cleared modal shows the next enemy count and reward. NEXT WAVE starts it immediately; PREPARE TEAM returns to deployment/upgrades first. All projectiles, combat fields and particles are cleared when a wave ends; idle animations continue between waves.

The original map fills the entire browser viewport. Status panels, wave controls and the team dock float above it in PokeSurvivor's blue double-bordered menu style. The fullscreen button (top right) can hide browser chrome. Map and sprites retain a uniform scale rather than stretching to the window aspect ratio.

Controls: Space = send next wave; P = pause/resume; Escape = clear selection/close help. Speed button cycles 1x/2x/3x. Sound is optional and starts off. New run replaces the current run. No save/resume yet.

The game is independent of PokeSurvivor. Its original terrain and prop renderer is copied unchanged, not recreated: grass, earth patches, trees, tall grass, rocks and water all come from the original source. The original procedural map is fixed to seed 723 for repeatable tower-defense runs. The dotted route is a gameplay overlay, not a new painted road. Source files in PokeSurvivor were not edited.

Assets: see ASSET-SOURCES.txt and SOURCE-CREDITS.md. The new base is the orange-roof house with chimneys cropped directly from the supplied 8192.gif building sheet. Its original alpha and pixels are preserved. The GIF is a single-frame sprite sheet, not an animation. Original sheet retained as assets/source-buildings.gif with its creator credit. No commercial asset license has been supplied. Unofficial local fan project.

Original abilities are active, not generic replacement beams: Treecko uses Razor Leaf (returning ranged leaves), Charmander Ember, Squirtle Water Gun, Pikachu Thunder Shock, Piplup Bubble (radial ranged bubbles), and Fennekin Ember. No selectable defender uses a melee attack. Their move catalog, attack animation loader, combat resolver, projectile renderer, VFX and synthesized audio are copied unchanged from PokeSurvivor. The adapter handles stationary targeting and TD upgrades; only the original combat system applies attack damage.

Piplup, Prinplup and Empoleon face down in idle and attack animations. Bubble remains the original eight-projectile radial attack; other defenders still turn toward their targets.

Static production build: npm run build (outputs only runtime assets and credits to site/).
Vercel uses vercel.json with the explicit site/ output. No gameplay backend or secrets are required.
Development: node --test *.test.cjs
Source-fidelity tests compare against the original sibling PokeSurvivor folder, which must be present locally.
Piplup-family orientation, paid evolution and real combat QA: uv run --with playwright python qa-orientation.py [optional production URL]
Browser fullscreen QA: uv run --with playwright python qa-fullscreen.py
Browser gameplay QA: uv run --with playwright python qa-gameplay.py
All six evolution lines, paid upgrades, single-evolution case, source sprite decoding and ranged combat: uv run --with playwright python qa-evolution.py
Wave transitions and all enemy sprite decoding: uv run --with playwright python qa-phases.py
Full 15-wave real-source combat campaign (no injected funds/health/damage): uv run --with playwright python qa-campaign.py
Exact supplied house pixel/alpha verification: python qa-nexus.py
Optional server: python -m http.server 8768 --bind 127.0.0.1
