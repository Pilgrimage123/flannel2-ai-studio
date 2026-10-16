# Petr Pavel — Arena Sprite Animation Reference

## Purpose

Use the two supplied pixel-art illustrations as **visual references**, not as finished animation frames. They establish the character's face, white hair and beard, proportions, palette, and two costume variants for *Operation: Flannel Storm*.

## Existing runtime assets

The game currently preloads these sprites from `public/sprites/` in `src/game/GameScene.ts`:

- `pavel-loud.png` — loud/combat variant.
- `pavel-stealth.png` — stealth/flannel variant.

The supplied images are reference illustrations and are not yet clean transparent sprite sheets. In particular, a black or checkerboard-looking background in a reference image must **not** be treated as transparency. Do not replace the existing runtime sprites with either reference image directly.

## Art direction

- Preserve the unmistakable stylized Petr Pavel likeness: swept-back white/grey hair, white beard, strong brows, and recognizable face silhouette.
- Keep crisp, deliberate pixel clusters and a consistent outline. Avoid smoothing/interpolating the pixel art.
- Maintain the two distinct looks:
  - **Flannel / stealth:** red-and-navy plaid shirt, blue jeans, brown boots, aviator sunglasses; no weapon or military uniform.
  - **Combat / military:** olive tactical clothing, Czech flag patch, gloves and boots; rifle held consistently across frames.
- Deliver the character isolated on a true transparent RGBA background, with no arena, checkerboard, drop shadow baked into the canvas, or surrounding effects.
- Keep a consistent canvas size, feet baseline, camera angle, outline thickness, lighting direction and character scale across every frame. Leave enough transparent padding to prevent clipping during motion.

## Animation deliverables

Create separate, named sprite sheets (or frame sequences) for each costume. Recommended initial loops:

| Animation | Frames | Target |
| --- | ---: | --- |
| Idle / breathing | 6–8 | Subtle torso, head and clothing movement |
| Run / move | 8 | Clear alternating footfalls and natural arm swing |
| Aim / fire | 4–6 | Stable weapon alignment, restrained recoil |
| Dash / dodge | 6 | Readable anticipation, movement and recovery |
| Hit / stagger | 3–4 | Short readable reaction |
| Victory | 6–8 | Exaggerated, humorous hero pose |

These are target counts, not a claim that the frames already exist. Generate the frames as a coherent sequence, then inspect them at native size for silhouette flicker, inconsistent anatomy, drifting feet, weapon jitter and edge halos.

## Phaser integration requirements

1. Preserve the existing `pavel-loud` and `pavel-stealth` asset keys until the replacement sheets have been verified.
2. Register each sheet with explicit frame dimensions and named animations in `GameScene` (or a focused player-animation module).
3. Select movement/idle animations from actual movement state; switch to the combat pose when firing and the appropriate variant when stealth is active.
4. Flip horizontally only when safe for the held weapon and costume. Avoid frame-by-frame texture creation and avoid generating new textures during the update loop.
5. Respect the existing Arcade Physics body: animation frames must not cause collision bounds to jump. Keep the physics body independent of the rendered frame.
6. Test on desktop and mobile sizes. Verify transparent edges, sprite scale, animation timing and performance under enemy-heavy scenes.

## Acceptance checklist

- [ ] Both supplied illustrations are retained as references in the repository (not used directly as gameplay frames).
- [ ] Runtime sprite sheets have genuine alpha transparency.
- [ ] Every animation has aligned frames and a stable feet baseline.
- [ ] Idle/movement/attack transitions do not pop or reset unnecessarily.
- [ ] Existing gameplay, hitboxes, stealth behavior and weapon systems remain unchanged.
- [ ] Typecheck, lint, tests and production build pass.

## Important implementation note

The existing `pavel-loud.png` and `pavel-stealth.png` files are already wired into the game. This document specifies how to evolve them into detailed, smoothly animated pixel-art characters without breaking the current runtime. Do not mark the animation work complete until the actual transparent frame assets are added and validated.
