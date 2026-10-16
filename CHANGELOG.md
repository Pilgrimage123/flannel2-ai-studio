# Changelog

All notable changes to **Operation: Flannel Storm** are documented in this file.

## [Unreleased] - 2026-10-16

### Animated Pavel Sprite Runtime Support
- Added optional loading for transparent 128×128-frame Pavel spritesheets for loud and stealth outfits.
- Registered idle (8 frames), run (8 frames), and dash (6 frames) loops and switched states from movement/dash status when corresponding sheets exist.
- Reset animation playback when switching between the animated and legacy costume textures.
- Preserved existing static sprites as a fallback; actual sprite-sheet PNGs still need to be generated and committed before the animated path activates.

### Petr Pavel Sprite Art Direction
- Added `docs/PAVEL_SPRITE_ANIMATION.md` documenting the two costume references, transparent-background requirements, animation loops, Phaser integration constraints, and acceptance checks for detailed, smooth pixel-art player sprites.
- Kept the existing `pavel-loud` and `pavel-stealth` runtime assets as-is; the supplied reference illustrations are not yet verified transparent animation sheets.

### Gameplay & Grand Finale
- **5-Minute Grand Finale Boss Encounter**:
  - Scheduled the climactic final boss battle against **Big Zombie Prigožin Clone (Warlord)** to spawn at the 5-minute (300s) mark.
  - Accompanied by Wagner shockguard convoy, iconic quotes ("WHERE IS THE AMMUNITION?!"), sledgehammer ground slams, explosive ammo crate projectiles, and an enraged phase below 50% HP.
  - Defeating the final boss triggers an epic finale sequence: mass enemy retreat, victory fanfare, confetti and fireworks, a grand loot shower, and an victory screen awarding "SUPREME ALLIED FIELD MARSHAL" with an option to continue into **Endless Patrol Mode**.
- **Boss Scheduling & Escalation**:
  - Paced intermediate boss battles: Inflatable S-400 Decoy Battery at 60s, Hardened S-400 at 135s, and Twin S-400 Batteries at 210s.
  - Endless mode alternates between Inflatable S-400 Batteries and Prigožin Clones every 60–65 seconds.
- **Dynamic Squad Rushes**:
  - Specialized squad rushes cycle dynamically every ~25 seconds: K9 Attack Dog packs, Suicide Drone Kamikaze swarms, Golf Cart motorcades, Riot Shield phalanxes, and Turtle Tank squadrons.
- **Boss Encounter Health Bar & HUD Indicators**:
  - Added a dedicated pixel-styled HUD boss health bar (`.boss-health-bar`) with boss name, HP readout, and an animated pulsing glow for the grand finale.
  - Integrated smart HUD countdown timers showing `BOSS mm:ss`, `FINALE mm:ss`, or `⚠️ BOSS FIGHT!`.

### Bug Fixes & Refinements
- **Enemy & Boss Spawning State Desync**:
  - Fixed a critical bug where primitive copies of `timeSurvived`, `stealth`, `dashT`, and `alive` were passed to `EnemySystem`, leaving `timeSurvived` permanently frozen at `0`.
  - Converted `EnemyContext` properties to live getters closed over `GameScene`, restoring enemy wave escalations, attack dog sniffing, stealth immunity, and boss triggers.
- **Wave Progression & Archetype Variety**:
  - Rebalanced `rollKind()` across the 5-minute run so all 8 enemy archetypes spawn smoothly across escalating waves instead of only spawning basic grunts.
  - Added pool exhaustion fallback in `birth()` to guarantee boss and squad spawns are never dropped.
  - Sanitized boss attack timers on recycled sprite bodies to prevent basic grunts from inheriting boss attacks.
- **UI & TypeScript Integrity**:
  - Fixed TypeScript prop typing for `onEndless` in `PlayChrome` and connected the victory continuation flow to Endless Patrol mode.

## [0.2.0] - 2026-10-16

### Architecture & Modularity
- **Subsystem Decomposition**: Refactored monolithic `GameScene.ts` (~1,828 lines) into dedicated, cohesive subsystems:
  - `src/game/systems/EnemySystem.ts`: Encapsulates AI behaviors for all 8 enemy types, spawner progression, riot shield mechanics, combat hit registration, and enemy death drops.
  - `src/game/systems/WeaponSystem.ts`: Manages weapon cooldowns, volleys (Bren guns, artillery barrage, drone swarms, motorcycle charge, MLRS rockets), thermobaric flame patches, and ambush attack multipliers.
  - `src/game/systems/LootSystem.ts`: Handles dog tag and pilsner keg drops, magnetic attraction curves, XP calculation, level-up choices, and NAFO Shiba companion behavior.
  - `src/game/systems/FxSystem.ts`: Manages canvas procedural texture synthesis, visual explosion/smoke lifecycles, and a pre-allocated pool of 40 floating combat damage numbers.
  - `src/game/GameScene.ts`: Streamlined into a lean scene orchestrator (~820 lines) coordinating Phaser lifecycle events, input translation, camera tracking, and collision bindings.

### Performance & Algorithms
- **2D Spatial Hash Grid**: Introduced `src/game/spatial/SpatialGrid.ts` replacing the $O(N^2)$ nested pairwise distance checks with an $O(N)$ bucketed spatial index ($C = 32\text{px}$).
  - Uses symmetrical forward neighbor cell checks `(1, 0), (-1, 1), (0, 1), (1, 1)` and center cell to prevent duplicate checks.
  - Zero per-frame heap allocations using pre-allocated `Int32Array` linked lists (`head` and `next`) and an `activeCells` tracking buffer.
  - Added automated unit tests in `src/game/spatial/SpatialGrid.test.ts` verifying cluster separation and distance invariants.

### Type Safety & Audio Polish
- **Strongly Typed Event Bus**: Updated `BusMap["select-upgrade"]` in `src/game/eventBus.ts` and `GameApp.tsx` from raw strings to strongly-typed `UpgradeId`.
- **Audio Lifecycle Management**: Added timer tracking (`timers: number[]`) to `Synth` in `src/game/audio.ts` with `stop()` and `setMuted(m)` to cleanly clear pending Web Audio timeouts when muted or destroyed.
- **Defensive Persistence**: Hardened `loadSave()`, `recordRun()`, and `writeSave()` in `src/game/save.ts` with finite number sanitization (`sanitizeNum`) and error handling for storage quota / private browsing environments.
- **HUD Normalization**: Normalized Article 5 Overcharge gauge calculation dynamically in `GameApp.tsx`.
