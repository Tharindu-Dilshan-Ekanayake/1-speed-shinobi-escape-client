# +1 Speed Shinobi Escape (web)

A browser remake of the Roblox game *+1 Speed Shinobi Escape*: React Three Fiber +
Rapier physics, the Bloxity SDK for login and avatars. Everything in the shop is
bought with wins.

## Run it

```bash
cp .env.example .env      # then set VITE_GAME_SLUG
npm install
npm run dev               # http://localhost:5173
```

Leaderboards need the server repo running (`npm run dev` there, port 3000). Without
it the game still works and the boards show only you.

## Controls

| Key | Action |
| --- | --- |
| W / S | run (you gain +Speed points every second you run) |
| A / D | turn the camera (turn off in Settings to strafe instead) |
| Space | jump; press again in the air for a front-flip double jump |
| E | dash |
| R / T / G / O / M / P / B | Rebirth, Trails, 7 Day, Online, Worlds, Settings, Shop |
| Q / X / 1-4 | speed limiter, buy x2 Speed, buy speed packs |
| Esc | close a panel |
| Right-drag / wheel | camera |

Every HUD button shows its key on its top-left corner.

Touch screens get a joystick and a jump button.

## What's in it

- **Lobby**: 12 win-unlocked shinobi on stepped terraces either side of the stage gate,
  4 shop shinobi on the gold VIP stage (bought with wins), each holding a signature
  pose; 8 animated treadmills (x1.5 / x2 / x4 by rebirths, x5 / x10 / x25 bought with
  wins), free chest, MOST WINS / MOST SPEED boards, portal to World 2. Layout lives in `LOBBY` / `buildWorld1Lobby` in `buildWorld.js`.
- **20 stages in World 1** (8 in World 2). Each ends with a *Wins x2 Forever* pad and a
  *+N Wins, Restart!* pad; falling or getting hit opens the *Want to revive?* popup.
  From stage 8 on, every stage is built around one shinobi's technique:

  | # | Stage | Shinobi | How you get through |
  | --- | --- | --- | --- |
  | 1 | River Run | Naruto | Jump across wooden platforms over the river |
  | 2 | Wall Run | Kakashi | Run along the leaning walls over a pit |
  | 3 | Hokage Tower | Hiruzen | Double jump up ledges inside the tower |
  | 4 | Red Hall | Tsunade | Double jump across the red hall |
  | 5 | The Great Gap | Minato | Dash (E) over a huge pit |
  | 6 | Training Logs | Naruto | Dodge spinning logs on a narrow bridge |
  | 7 | Zigzag Walls | Sasuke | Chain wall runs, switching sides |
  | 8 | Water Walk | Kakashi | Run on the lake; stop for 0.6 s and you sink |
  | 9 | Leaf Hurricane | Rock Lee | Green pads launch you up the cliffs |
  | 10 | Flying Raijin | Minato | Touch a kunai to teleport to the next island |
  | 11 | Toad Summoning | Jiraiya | Bounce from toad to toad across the pond |
  | 12 | Sand Coffin | Gaara | Ride moving sand rafts over the canyon |
  | 13 | Genjutsu | Itachi | Only the glowing platforms are real; they swap every 2.2 s |
  | 14 | Chidori | Sasuke | Dash (E) into the rock walls to smash them |
  | 15 | Shuriken Storm | Tenten | Giant shuriken sweep across the bridge |
  | 16 | Shinra Tensei | Pain | A blast every 3.2 s knocks you back unless rubble covers you |
  | 17 | Kamui | Obito | Only the portal under the Sharingan is real; fakes send you back |
  | 18 | Tengai Shinsei | Madara | Meteors land on the red circles |
  | 19 | Valley of the End | Naruto & Sasuke | Cross the river, climb beside the waterfall |
  | 20 | Hokage Rock | Final | Climb to the Hokage faces |

  Stage layouts live in `src/game/level/stages.js`; their timing rules in
  `src/game/level/mechanics.js` and `src/game/Player.jsx`.
- **Worlds**: World 1 (Hidden Leaf), World 2 (Hidden Sand, 2 rebirths).
- **HUD**: Rebirth, Trails, 7 Day, Online gifts, Worlds, Settings, Shop, speed limiter
  gauge, x2 Speed, speed packs, level bar with the current run speed.

- **Obstacles**: temple walls, pillars and trees crash across the path as you run past
  (dodge or outrun them); stone crushers slam down on a timer (watch the red shadow);
  lava under the wall runs and the dash gap.
- **Progression**: running earns Speed points, which level you up. Run speed comes
  only from level, in 10 equal steps over levels 1-25: 10 u/s at level 1, +2 every
  2.5 levels, 28 u/s at the top. Level 25 takes ~12,000 Speed points and unlocks
  Rebirth, which sends you back to level 1 (and run speed 10) for more Speed points
  and Wins from then on. Each gate shows a recommended level. Characters don't change
  speed: each has its own running / jumping particles (sparks, petals, lightning,
  leaves, sand, fire, feathers, aura), bigger for the later ones.
- **Feel**: footsteps, landing thuds, rushing wind, a koto + taiko soundtrack (all
  synthesized, no audio files), anime speed lines, dust, dash rings, a wider lens at
  speed, a trophy rain after every win.

Progress is saved in the browser (`localStorage`).

## Where things live

| File | What |
| --- | --- |
| `src/game/config.js` | every number: characters, prices, treadmills, trails, rewards, formulas |
| `src/game/level/buildWorld.js` | lobby + stage layouts (plain data) |
| `src/game/Player.jsx` | movement: run, double jump, dash, wall run, triggers |
| `src/game/gameStore.js` | progression, saving, rewards, death / revive |
| `src/game/shinobi/looks.jsx` | how each character looks |
| `src/game/monetization.js` | shop purchases (paid with wins) |
| `src/ui/` | HUD and panels |

## Shop

Every entry in `PRODUCTS` (`src/game/config.js`) is priced in wins; `buy()` in
`gameStore.js` takes the wins and grants it.

## Dev shortcuts

Only under `npm run dev`: `?stage=13`, `?world=2`, `?wins=500`, `?speed=2e4`,
`?level=100`, `?char=kakashi`, `?panel=trails`, `?pos=x,y,z,yaw`.
The console also has `window.__shinobi`.
