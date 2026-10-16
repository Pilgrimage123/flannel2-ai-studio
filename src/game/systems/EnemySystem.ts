import * as Phaser from "phaser";
import { synth } from "../audio";
import { SpatialGrid } from "../spatial/SpatialGrid";
import type { BData, BossInfo, EData, Kind } from "../types";

export interface EnemyContext {
  player: Phaser.Physics.Arcade.Sprite;
  decoy: Phaser.Physics.Arcade.Sprite;
  stealth: boolean;
  dashT: number;
  alive: boolean;
  timeSurvived: number;
  cam: Phaser.Cameras.Scene2D.Camera;
  shakeCam(duration: number, intensity: number): void;
  hurtPlayer(amount: number, throughStealth?: boolean, honorIFrame?: boolean): void;
  aoe(x: number, y: number, radius: number, damage: number, knock: number): void;
  shoot(
    x: number,
    y: number,
    ang: number,
    speed: number,
    dmg: number,
    pierce: number,
    homing: boolean,
    key: string,
    life: number,
    aoe: number,
    friendly?: boolean,
  ): Phaser.Physics.Arcade.Sprite | null;
  dress(sprite: Phaser.Physics.Arcade.Sprite, key: string, height: number, hit: number): void;
  floater(x: number, y: number, text: string, color: string): void;
  critFloater?(x: number, y: number, damage: number): void;
  comic?(x: number, y: number, text: string, color: string): void;
  banner?(text: string, color: string): void;
  shockwave?(x: number, y: number, scale: number): void;
  explode(x: number, y: number, scale: number): void;
  recycle(sprite: Phaser.Physics.Arcade.Sprite): void;
  spawnGem(x: number, y: number, value: number, keg?: boolean): void;
  onKilled(): void;
  onFinaleVictory?(): void;
  delayedCall(delay: number, callback: () => void): void;
}

const KIND_TEX: Record<Kind, string> = {
  conscript: "conscript",
  tiktok: "tiktok",
  cart: "cart",
  turtle: "turtle",
  boss: "boss",
  riot: "riot",
  kamikaze: "kamikaze",
  dog: "k9",
  prigozhin: "prigozhin",
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export class EnemySystem {
  private ctx: EnemyContext;
  enemies: Phaser.Physics.Arcade.Group;
  private shields: Phaser.GameObjects.Group;
  private loots: Phaser.GameObjects.Group;
  spatialGrid: SpatialGrid;

  // Active enemies cache for O(1) length and allocation-free queries
  private activeEnemies: Phaser.Physics.Arcade.Sprite[] = [];
  private _activeCount = 0;

  private spawnAcc = 0;
  private swarmAcc = 5;
  private squadAcc = 10;
  nextBoss = 55; // First boss (S-400) at 55s!
  bossCount = 0;
  private eid = 1;
  private initialSpawned = false;

  prigozhinSpawned = false;
  private prigozhinSprite: Phaser.Physics.Arcade.Sprite | null = null;
  private currentBossSprite: Phaser.Physics.Arcade.Sprite | null = null;
  private finaleVictoryTriggered = false;
  private endlessMode = false;

  constructor(
    ctx: EnemyContext,
    enemies: Phaser.Physics.Arcade.Group,
    shields: Phaser.GameObjects.Group,
    loots: Phaser.GameObjects.Group,
  ) {
    this.ctx = ctx;
    this.enemies = enemies;
    this.shields = shields;
    this.loots = loots;
    // Spatial grid with 64px cell size and up to 1024 capacity
    this.spatialGrid = new SpatialGrid(3600, 64, 1024);
  }

  reset() {
    this.spawnAcc = 0;
    this.swarmAcc = 5;
    this.squadAcc = 10;
    this.nextBoss = 55;
    this.bossCount = 0;
    this.eid = 1;
    this.initialSpawned = false;
    this.prigozhinSpawned = false;
    this.prigozhinSprite = null;
    this.currentBossSprite = null;
    this.finaleVictoryTriggered = false;
    this.endlessMode = false;
    this.activeEnemies = [];
    this._activeCount = 0;
    this.spatialGrid.clear();
  }

  startEndlessMode() {
    this.endlessMode = true;
    this.nextBoss = this.ctx.timeSurvived + 45;
  }

  getActiveBoss(): BossInfo | null {
    if (this.prigozhinSprite?.active) {
      const e = this.ed(this.prigozhinSprite);
      return {
        name: e.enraged ? "🔥 BIG ZOMBIE PRIGOŽIN CLONE (ENRAGED) 🔥" : "💀 BIG ZOMBIE PRIGOŽIN CLONE (WARLORD)",
        kind: "prigozhin",
        hp: Math.max(0, Math.round(e.hp)),
        maxHp: Math.round(e.max),
        isFinale: true,
      };
    }
    if (this.currentBossSprite?.active) {
      const e = this.ed(this.currentBossSprite);
      return {
        name: "INFLATABLE S-400 DECOY BATTERY",
        kind: "boss",
        hp: Math.max(0, Math.round(e.hp)),
        maxHp: Math.round(e.max),
        isFinale: false,
      };
    }
    return null;
  }

  ed(s: Phaser.Physics.Arcade.Sprite): EData {
    let d = s.getData("ed") as EData | undefined;
    if (!d) {
      d = {
        kind: "conscript",
        hp: 1,
        max: 1,
        speed: 40,
        touch: 6,
        id: 0,
        axis: "h",
        face: 1,
        shoot: 1,
        vx: 1,
        vy: 0,
        aim: 0,
        hitCd: 0,
      };
      s.setData("ed", d);
    }
    return d;
  }

  activeCount(): number {
    return this._activeCount;
  }

  living(): Phaser.Physics.Arcade.Sprite[] {
    return this.activeEnemies;
  }

  nearest(x: number, y: number, bossOk: boolean) {
    let best: Phaser.Physics.Arcade.Sprite | null = null;
    let bestD = Infinity;
    const living = this.activeEnemies;
    const len = living.length;
    if (len === 0) return null;

    for (let i = 0; i < len; i++) {
      const s = living[i]!;
      const ek = this.ed(s).kind;
      if (!bossOk && (ek === "boss" || ek === "prigozhin") && len > 1) {
        continue;
      }
      const dx = s.x - x;
      const dy = s.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = s;
        if (bestD < 900) return best;
      }
    }
    return best;
  }

  toughest() {
    let best: Phaser.Physics.Arcade.Sprite | null = null;
    let hp = -1;
    const living = this.activeEnemies;
    for (let i = 0; i < living.length; i++) {
      const s = living[i]!;
      const e = this.ed(s);
      if (e.hp > hp) {
        hp = e.hp;
        best = s;
      }
    }
    return best;
  }

  pressure() {
    return 1 + this.ctx.timeSurvived / 75;
  }

  rollKind(): Kind {
    const t = this.ctx.timeSurvived;
    if (t < 15) {
      // Wave 1: Grunts with fast Kadyrovite / TikTok sharpshooters
      return Math.random() < 0.42 ? "tiktok" : "conscript";
    }
    if (t < 35) {
      // Wave 2: Attack dogs sniffing out Pavel + TikTok snipers + Conscripts
      const r = Math.random();
      if (r < 0.35) return "dog";
      if (r < 0.65) return "tiktok";
      return "conscript";
    }
    if (t < 55) {
      // Wave 3: Shield Troopers + Kamikaze dive bombers + Golf Carts
      const r = Math.random();
      if (r < 0.28) return "riot";
      if (r < 0.52) return "kamikaze";
      if (r < 0.76) return "cart";
      return "conscript";
    }
    if (t < 90) {
      // Wave 4-5: Heavy Armor - Turtle tanks + Golf Carts + Riot Shields + Kamikazes
      const r = Math.random();
      if (r < 0.26) return "turtle";
      if (r < 0.46) return "cart";
      if (r < 0.66) return "riot";
      if (r < 0.84) return "kamikaze";
      return "dog";
    }
    if (t < 135) {
      // Wave 6: Elite combined arms horde
      const r = Math.random();
      if (r < 0.24) return "turtle";
      if (r < 0.44) return "riot";
      if (r < 0.62) return "kamikaze";
      if (r < 0.78) return "cart";
      if (r < 0.9) return "dog";
      return "tiktok";
    }
    // Wave 7+: Intense frenzy of all enemy archetypes
    const r = Math.random();
    if (r < 0.22) return "turtle";
    if (r < 0.4) return "kamikaze";
    if (r < 0.56) return "cart";
    if (r < 0.72) return "riot";
    if (r < 0.86) return "dog";
    return "tiktok";
  }

  // Ensure free pool slots for vital spawns (like bosses) by recycling distant grunts
  private ensureFreeSlots(needed: number) {
    const px = this.ctx.player.x;
    const py = this.ctx.player.y;
    while (this._activeCount > 620 && needed > 0) {
      // Find furthest basic conscript or tiktok
      let furthest: Phaser.Physics.Arcade.Sprite | null = null;
      let maxD = 0;
      for (const s of this.activeEnemies) {
        const k = this.ed(s).kind;
        if (k === "boss" || k === "prigozhin") continue;
        const d = (s.x - px) * (s.x - px) + (s.y - py) * (s.y - py);
        if (d > maxD) {
          maxD = d;
          furthest = s;
        }
      }
      if (furthest) {
        this.killEnemy(furthest, false);
        needed--;
      } else {
        break;
      }
    }
  }

  spawnEnemy(kind: Kind) {
    const cam = this.ctx.cam;
    const dist = (Math.max(cam.width, cam.height) * 0.62) / cam.zoom;
    const ang = Math.random() * Math.PI * 2;
    let x = this.ctx.player.x + Math.cos(ang) * dist;
    let y = this.ctx.player.y + Math.sin(ang) * dist;
    x = clamp(x, 120, 3600 - 120);
    y = clamp(y, 120, 3600 - 120);
    if (Math.hypot(x - this.ctx.player.x, y - this.ctx.player.y) < 140) {
      x = clamp(this.ctx.player.x + (Math.random() < 0.5 ? -1 : 1) * 260, 120, 3600 - 120);
      y = clamp(this.ctx.player.y + (Math.random() < 0.5 ? -1 : 1) * 260, 120, 3600 - 120);
    }
    this.birth(kind, x, y);
  }

  spawnBatch(kind: Kind, count: number, cap: number) {
    const cam = this.ctx.cam;
    const baseDist = (Math.max(cam.width, cam.height) * 0.6) / cam.zoom;
    const baseAng = Math.random() * Math.PI * 2;

    for (let i = 0; i < count && this._activeCount < cap; i++) {
      const spreadAng = baseAng + (i - (count - 1) / 2) * 0.16 + (Math.random() - 0.5) * 0.08;
      const dist = baseDist + (Math.random() - 0.5) * 60;
      let x = this.ctx.player.x + Math.cos(spreadAng) * dist;
      let y = this.ctx.player.y + Math.sin(spreadAng) * dist;
      x = clamp(x, 120, 3600 - 120);
      y = clamp(y, 120, 3600 - 120);
      this.birth(kind, x, y);
    }
  }

  spawnBoss() {
    this.ensureFreeSlots(18);
    this.bossCount += 1;
    const cam = this.ctx.cam;
    const dist = (Math.max(cam.width, cam.height) * 0.58) / cam.zoom;
    const ang = Math.random() * Math.PI * 2;
    const x = clamp(this.ctx.player.x + Math.cos(ang) * dist, 160, 3600 - 160);
    const y = clamp(this.ctx.player.y + Math.sin(ang) * dist, 160, 3600 - 160);

    const s = this.birth("boss", x, y);
    if (s) this.currentBossSprite = s;

    // Escort convoy: spawn riot shields and carts guarding the boss
    for (let i = 0; i < 5; i++) {
      const escortAng = (i / 5) * Math.PI * 2;
      this.birth("riot", clamp(x + Math.cos(escortAng) * 90, 120, 3600 - 120), clamp(y + Math.sin(escortAng) * 90, 120, 3600 - 120));
      this.birth("cart", clamp(x + Math.cos(escortAng) * 135, 120, 3600 - 120), clamp(y + Math.sin(escortAng) * 135, 120, 3600 - 120));
    }

    synth.siren();
    this.ctx.shakeCam(320, 0.015);
    this.ctx.floater(this.ctx.player.x, this.ctx.player.y - 70, "⚠️ WARNING: INFLATABLE S-400 DEPLOYED! ⚠️", "#ff3333");
    if (this.ctx.banner) this.ctx.banner("INFLATABLE S-400 DETECTED — FLANNEL AMBUSH POPS IT!", "#ff3333");
  }

  spawnPrigozhin() {
    this.ensureFreeSlots(25);
    const cam = this.ctx.cam;
    const dist = (Math.max(cam.width, cam.height) * 0.52) / cam.zoom;
    const ang = Math.random() * Math.PI * 2;
    const x = clamp(this.ctx.player.x + Math.cos(ang) * dist, 200, 3600 - 200);
    const y = clamp(this.ctx.player.y + Math.sin(ang) * dist, 200, 3600 - 200);

    const s = this.birth("prigozhin", x, y);
    if (s) {
      this.prigozhinSprite = s;
      const e = this.ed(s);
      e.slamCd = 3.2;
      e.shoot = 2.4;
      e.summonCd = 8.5;
      e.phraseCd = 3.0;
      e.enraged = false;
    }

    // Heavy Wagner Shockguard Honor Convoy
    for (let i = 0; i < 6; i++) {
      const escortAng = (i / 6) * Math.PI * 2;
      this.birth("riot", clamp(x + Math.cos(escortAng) * 110, 140, 3460), clamp(y + Math.sin(escortAng) * 110, 140, 3460));
      this.birth("kamikaze", clamp(x + Math.cos(escortAng) * 150, 140, 3460), clamp(y + Math.sin(escortAng) * 150, 140, 3460));
    }

    synth.siren();
    synth.prigozhinRoar();
    this.ctx.shakeCam(450, 0.025);
    this.ctx.floater(this.ctx.player.x, this.ctx.player.y - 85, "🚨 FINALE: BIG ZOMBIE PRIGOŽIN CLONE! 🚨", "#ff0054");
    if (this.ctx.comic) this.ctx.comic(this.ctx.player.x, this.ctx.player.y - 120, "SHOIGU! GERASIMOV! WHERE IS THE AMMUNITION?!", "#ff3333");
    if (this.ctx.banner) this.ctx.banner("⚠️ GRAND FINALE: BIG ZOMBIE PRIGOŽIN CLONE HAS ARRIVED! ⚠️", "#ff0054");
  }

  birth(kind: Kind, x: number, y: number): Phaser.Physics.Arcade.Sprite | null {
    const s = this.enemies.get(x, y, KIND_TEX[kind]) as Phaser.Physics.Arcade.Sprite | null;
    if (!s) return null;
    s.enableBody(true, x, y, true, true);
    s.clearTint();
    const pressure = this.pressure();
    const hp =
      kind === "prigozhin"
        ? Math.round(2200 * pressure)
        : kind === "boss"
          ? Math.round((350 + this.bossCount * 260) * (1 + this.ctx.timeSurvived * 0.005))
          : kind === "turtle"
            ? 48 * pressure
            : kind === "riot"
              ? 34 * pressure
              : kind === "cart"
                ? 18 * pressure
                : kind === "kamikaze"
                  ? 12 * pressure
                  : kind === "dog"
                    ? 16 * pressure
                    : kind === "tiktok"
                      ? 18 * pressure
                      : 14 * pressure;
    const height =
      kind === "prigozhin"
        ? 155
        : kind === "boss"
          ? 120
          : kind === "turtle"
            ? 76
            : kind === "cart"
              ? 70
              : kind === "riot"
                ? 72
                : kind === "kamikaze"
                  ? 54
                  : kind === "dog"
                    ? 60
                    : 64;
    this.ctx.dress(
      s,
      KIND_TEX[kind],
      height,
      kind === "prigozhin" ? 0.46 : kind === "boss" ? 0.42 : kind === "kamikaze" ? 0.5 : 0.36,
    );
    const e = this.ed(s);
    e.kind = kind;
    e.hp = hp;
    e.max = hp;
    e.speed =
      kind === "prigozhin"
        ? 52
        : kind === "boss"
          ? 36
          : kind === "turtle"
            ? 44
            : kind === "riot"
              ? 34
              : kind === "cart"
                ? 145
                : kind === "kamikaze"
                  ? 188
                  : kind === "dog"
                    ? 118
                    : kind === "tiktok"
                      ? 64
                      : 78;
    const touchBase =
      kind === "prigozhin"
        ? 44
        : kind === "boss"
          ? 30
          : kind === "turtle"
            ? 22
            : kind === "riot"
              ? 20
              : kind === "cart"
                ? 20
                : kind === "kamikaze"
                  ? 36
                  : kind === "dog"
                    ? 22
                    : kind === "tiktok"
                      ? 14
                      : 16;
    e.touch = touchBase * pressure;
    e.id = this.eid++;
    e.axis = Math.random() < 0.5 ? "h" : "v";
    e.face = Math.random() < 0.5 ? -1 : 1;
    e.shoot = 0.45 + Math.random() * 0.6;
    e.hitCd = 0;
    const dir = Math.atan2(this.ctx.player.y - y, this.ctx.player.x - x);
    e.aim = dir;
    e.vx = Math.cos(dir) * e.speed;
    e.vy = Math.sin(dir) * e.speed;
    s.setData("loot", null);
    s.setData("lastDepth", y);

    // Track in contiguous active array with O(1) swap-and-pop index
    s.setData("activeIdx", this.activeEnemies.length);
    this.activeEnemies.push(s);
    this._activeCount++;

    if (kind === "riot") this.attachShield(s);
    else this.dropShield(s);
    s.setDepth(y);
    s.setFlipX(false);
    s.setRotation(0);
    return s;
  }

  private turnToward(current: number, desired: number, maxStep: number) {
    let diff = desired - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return current + clamp(diff, -maxStep, maxStep);
  }

  private attachShield(enemy: Phaser.Physics.Arcade.Sprite) {
    let shield = enemy.getData("shield") as Phaser.GameObjects.Sprite | null;
    if (shield?.active) return;
    shield = this.shields.get(enemy.x, enemy.y, "shield") as Phaser.GameObjects.Sprite | null;
    if (!shield) return;
    shield.setTexture("shield");
    shield.setActive(true).setVisible(true);
    shield.setScale(36 / Math.max(1, shield.height));
    enemy.setData("shield", shield);
  }

  private dropShield(enemy: Phaser.Physics.Arcade.Sprite) {
    const shield = enemy.getData("shield") as Phaser.GameObjects.Sprite | null;
    if (!shield) return;
    shield.setActive(false).setVisible(false);
    enemy.setData("shield", null);
  }

  private placeShield(enemy: Phaser.Physics.Arcade.Sprite, data: EData) {
    if (data.kind !== "riot") return;
    let shield = enemy.getData("shield") as Phaser.GameObjects.Sprite | null;
    if (!shield?.active) {
      this.attachShield(enemy);
      shield = enemy.getData("shield") as Phaser.GameObjects.Sprite | null;
    }
    if (!shield?.active) return;
    shield.setPosition(enemy.x + Math.cos(data.aim) * 26, enemy.y + Math.sin(data.aim) * 26);
    shield.setRotation(data.aim);
    shield.setDepth(enemy.depth + 2);
  }

  tickSpawns(dt: number) {
    if (!this.initialSpawned) {
      this.initialSpawned = true;
      // Start with engaging variety: 10 conscripts and 4 tiktok sharpshooters
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        const dist = 270 + (i % 2) * 40;
        const x = clamp(this.ctx.player.x + Math.cos(ang) * dist, 140, 3600 - 140);
        const y = clamp(this.ctx.player.y + Math.sin(ang) * dist, 140, 3600 - 140);
        this.birth("conscript", x, y);
      }
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + 0.35;
        const dist = 360;
        const x = clamp(this.ctx.player.x + Math.cos(ang) * dist, 140, 3600 - 140);
        const y = clamp(this.ctx.player.y + Math.sin(ang) * dist, 140, 3600 - 140);
        this.birth("tiktok", x, y);
      }
    }

    // Boss scheduling:
    // Wave 3 (55s): Inflatable S-400 Boss 1
    // Wave 7 (125s): Inflatable S-400 Boss 2
    // Wave 9 (180s): GRAND FINALE: BIG ZOMBIE PRIGOŽIN CLONE!
    if (!this.prigozhinSpawned && this.ctx.timeSurvived >= 180) {
      this.prigozhinSpawned = true;
      this.spawnPrigozhin();
    } else if (this.ctx.timeSurvived >= this.nextBoss && this.ctx.timeSurvived < 172) {
      this.nextBoss += 70; // 55s -> 125s
      this.spawnBoss();
    } else if (this.endlessMode && this.ctx.timeSurvived >= this.nextBoss) {
      this.nextBoss += 60;
      if (Math.random() < 0.5) this.spawnPrigozhin();
      else this.spawnBoss();
    }

    this.spawnAcc += dt;
    const interval = clamp(0.5 - this.ctx.timeSurvived * 0.002, 0.12, 0.5);
    const cap = Math.min(600, Math.round((25 + Math.floor(this.ctx.timeSurvived / 2.2)) * 3.2));

    if (this.spawnAcc >= interval && this._activeCount < cap) {
      this.spawnAcc = 0;
      // Spawn batches from rollKind() which has high variety for all enemy types!
      const batchSize = Math.random() < 0.5 ? 3 : 4;
      this.spawnBatch(this.rollKind(), batchSize, cap);

      if (this.ctx.timeSurvived > 30 && Math.random() < 0.5 && this._activeCount < cap) {
        this.spawnBatch(this.rollKind(), 3, cap);
      }
    }

    // Specialized Squad Rushes
    this.swarmAcc -= dt;
    if (this.swarmAcc <= 0) {
      this.swarmAcc = clamp(9.0 - this.ctx.timeSurvived * 0.015, 4.0, 9.0);
      const t = this.ctx.timeSurvived;
      if (t >= 18 && t < 45) {
        // K9 Attack Dog Pack!
        this.spawnBatch("dog", 5, cap);
        this.ctx.floater(this.ctx.player.x, this.ctx.player.y - 45, "🐕 K9 RECON PACK INBOUND!", "#ffd6a0");
      } else if (t >= 45 && t < 80) {
        // Suicide Drone Kamikaze Swarm!
        this.spawnBatch("kamikaze", 9, cap);
        this.ctx.floater(this.ctx.player.x, this.ctx.player.y - 45, "⚡ KAMIKAZE SWARM DIVE!", "#ff4d4d");
      } else if (t >= 80 && t < 120) {
        // Golf Cart Blitz!
        this.spawnBatch("cart", 6, cap);
        this.ctx.floater(this.ctx.player.x, this.ctx.player.y - 45, "🏎️ GOLF CART MOTORCADE!", "#ffd60a");
      } else if (t >= 120) {
        // Turtle Tank & Kamikaze assault!
        this.spawnBatch("turtle", 4, cap);
        this.spawnBatch("kamikaze", 6, cap);
      }
    }

    // Heavy Shield Wall / Armor columns
    this.squadAcc -= dt;
    if (this.squadAcc <= 0) {
      this.squadAcc = clamp(12 - this.ctx.timeSurvived * 0.02, 6.0, 12);
      if (this.ctx.timeSurvived > 25) {
        const squadKind: Kind = this.ctx.timeSurvived > 70 && Math.random() < 0.5 ? "turtle" : "riot";
        this.spawnBatch(squadKind, 5, cap);
      }
    }
  }

  tickEnemies(dt: number) {
    const lure = this.ctx.decoy.active;
    const active = this.activeEnemies;
    const count = active.length;
    if (count === 0) return;

    const px = this.ctx.player.x;
    const py = this.ctx.player.y;
    const tx = lure ? this.ctx.decoy.x : px;
    const ty = lure ? this.ctx.decoy.y : py;

    for (let i = 0; i < count; i++) {
      const s = active[i]!;
      if (!s.active) continue;

      const e = this.ed(s);

      // Distance to target
      const dx = tx - s.x;
      const dy = ty - s.y;
      const distSq = dx * dx + dy * dy;

      // Off-screen repositioning & wrapping:
      // If a regular enemy wandered more than 1150px away from the player,
      // teleport it to the perimeter of the screen so it rejoins the battle!
      const pDistSq = (s.x - px) * (s.x - px) + (s.y - py) * (s.y - py);
      if (pDistSq > 1150 * 1150 && e.kind !== "boss" && e.kind !== "prigozhin") {
        const reAng = Math.random() * Math.PI * 2;
        const reDist = 560 + Math.random() * 120;
        const newX = clamp(px + Math.cos(reAng) * reDist, 140, 3600 - 140);
        const newY = clamp(py + Math.sin(reAng) * reDist, 140, 3600 - 140);
        s.setPosition(newX, newY);
        const b = s.body as Phaser.Physics.Arcade.Body | null;
        b?.reset(newX, newY);
        continue;
      }

      let vx = 0;
      let vy = 0;
      const bonus = lure ? (e.kind === "conscript" ? 1.5 : 1.35) : 1;

      if (e.kind === "prigozhin") {
        // BIG ZOMBIE PRIGOŽIN CLONE AI & ATTACKS
        const desired = Math.atan2(dy, dx);
        e.aim = this.turnToward(e.aim, desired, 1.8 * dt);
        const currentSpeed = (e.enraged ? e.speed * 1.35 : e.speed) * (lure ? 1.25 : 1.0);
        vx = Math.cos(e.aim) * currentSpeed;
        vy = Math.sin(e.aim) * currentSpeed;
        e.face = vx < 0 ? -1 : 1;

        // Check for Enrage Phase (< 50% HP)
        if (!e.enraged && e.hp <= e.max * 0.5) {
          e.enraged = true;
          synth.prigozhinRoar();
          this.ctx.shakeCam(320, 0.02);
          this.ctx.floater(s.x, s.y - 80, "🔥 ZOMBIE PRIGOŽIN ENRAGED! 🔥", "#ff0054");
          if (this.ctx.comic) {
            this.ctx.comic(s.x, s.y - 110, "SHOIGU! GERASIMOV! WHERE IS THE AMMUNITION?!", "#ff3333");
          }
        }

        // Shouting Iconic Floaters
        if (e.phraseCd !== undefined) {
          e.phraseCd -= dt;
          if (e.phraseCd <= 0) {
            e.phraseCd = 4.5 + Math.random() * 3.0;
            const quotes = [
              "WHERE IS THE AMMUNITION?!",
              "SHOIGU! GERASIMOV!",
              "I NEED SHELLS, NOT FLANNEL!",
              "WAGNER ZOMBIE MARCH!",
              "MY SLEDGEHAMMER CRAVES STEEL!",
              "THE WASHING MACHINE IS MINE!",
            ];
            const q = quotes[Math.floor(Math.random() * quotes.length)]!;
            this.ctx.floater(s.x, s.y - 80, `💀 "${q}"`, e.enraged ? "#ff1a1a" : "#39ff14");
          }
        }

        // Attack 1: Sledgehammer Ground Slam (Shockwaves + AoE)
        if (e.slamCd !== undefined) {
          e.slamCd -= dt;
          if (e.slamCd <= 0) {
            e.slamCd = e.enraged ? 2.2 : 3.4;
            synth.boom(true);
            this.ctx.shakeCam(260, 0.016);
            this.ctx.floater(s.x, s.y - 65, "⚡ SLEDGEHAMMER SLAM! ⚡", "#ffcc00");
            this.ctx.aoe(s.x, s.y, 160, 32 * this.pressure(), 250);
            if (this.ctx.shockwave) this.ctx.shockwave(s.x, s.y, 2.8);
            this.ctx.explode(s.x, s.y, 1.8);
          }
        }

        // Attack 2: Ammo Crate Throw ("WHERE IS THE AMMUNITION?!")
        e.shoot -= dt;
        if (e.shoot <= 0) {
          e.shoot = e.enraged ? 1.6 : 2.5;
          const ang = Math.atan2(ty - s.y, tx - s.x);
          // Throw 2 explosive ammo crates
          for (let c = -1; c <= 1; c += 2) {
            const spread = ang + c * 0.16;
            const crate = this.ctx.shoot(s.x, s.y, spread, 180, 24 * this.pressure(), 1, false, "ammocrate", 2.2, 70, false);
            crate?.setTint(e.enraged ? 0xff4422 : 0x88ff66);
          }
        }

        // Attack 3: Wagner Squad Summons
        if (e.summonCd !== undefined) {
          e.summonCd -= dt;
          if (e.summonCd <= 0) {
            e.summonCd = 9.5;
            this.ctx.floater(s.x, s.y - 60, "☠️ WAGNER CHARGE! ☠️", "#00f5d4");
            for (let k = 0; k < 3; k++) {
              const sang = Math.random() * Math.PI * 2;
              this.birth("kamikaze", clamp(s.x + Math.cos(sang) * 80, 140, 3460), clamp(s.y + Math.sin(sang) * 80, 140, 3460));
            }
            this.birth("riot", clamp(s.x + 60, 140, 3460), clamp(s.y, 140, 3460));
            this.birth("riot", clamp(s.x - 60, 140, 3460), clamp(s.y, 140, 3460));
          }
        }
      } else if (e.kind === "cart" && !lure) {
        vx = e.vx;
        vy = e.vy;
      } else if (e.kind === "turtle") {
        if (Math.abs(dx) > Math.abs(dy)) {
          e.axis = "h";
          e.face = dx < 0 ? -1 : 1;
          vx = e.face * e.speed * bonus;
          vy = 0;
        } else {
          e.axis = "v";
          e.face = dy === 0 ? e.face : 1;
          vx = 0;
          vy = Math.sign(dy || 1) * e.speed * bonus;
        }
      } else if (e.kind === "tiktok" && !lure) {
        e.shoot -= dt;
        if (e.shoot > 0.45) {
          const len = Math.sqrt(distSq) || 1;
          vx = (dx / len) * e.speed;
          vy = (dy / len) * e.speed;
        } else if (e.shoot <= 0) {
          const ang = Math.random() * Math.PI * 2;
          const shot = this.ctx.shoot(s.x, s.y, ang, 190, 13 * this.pressure(), 1, false, "bullet", 1.4, 0, false);
          shot?.setTint(0xff5a36);
          e.shoot = 0.85 + Math.random() * 0.9;
        }
      } else if (e.kind === "riot") {
        const desired = Math.atan2(dy, dx);
        e.aim = this.turnToward(e.aim, desired, 0.72 * dt);
        const pace = lure ? 1.12 : 1;
        vx = Math.cos(e.aim) * e.speed * pace;
        vy = Math.sin(e.aim) * e.speed * pace;
        e.face = vx < 0 ? -1 : 1;
      } else if (e.kind === "dog") {
        const pDx = px - s.x;
        const pDy = py - s.y;
        const desired = Math.atan2(pDy, pDx);
        const turn = this.ctx.stealth ? 0.65 : 2.6;
        e.aim = this.turnToward(e.aim, desired, turn * dt);
        const spd = e.speed * (this.ctx.stealth ? 0.5 : 1);
        vx = Math.cos(e.aim) * spd;
        vy = Math.sin(e.aim) * spd;
        e.face = vx < 0 ? -1 : 1;
      } else if (e.kind === "kamikaze") {
        const wob = Math.sin(this.ctx.timeSurvived * 10 + e.id) * 0.22;
        const ang = Math.atan2(dy, dx) + wob;
        const pace = lure ? 1.3 : 1;
        vx = Math.cos(ang) * e.speed * pace;
        vy = Math.sin(ang) * e.speed * pace;
        e.aim = ang;
        e.face = vx < 0 ? -1 : 1;
      } else {
        // Conscript & general horde
        const len = Math.sqrt(distSq) || 1;
        vx = (dx / len) * e.speed * bonus;
        vy = (dy / len) * e.speed * bonus;
        e.face = vx < 0 ? -1 : 1;
        e.aim = Math.atan2(vy, vx);
      }

      if (e.kind === "boss") {
        e.shoot -= dt;
        if (e.shoot <= 0) {
          e.shoot = 1.55;
          const ang = Math.atan2(py - s.y, px - s.x);
          const shot = this.ctx.shoot(s.x, s.y, ang, 150, 22 * this.pressure(), 1, true, "rocket", 5, 0, false);
          shot?.setTint(0xff5533);
        }
      }

      if (e.hitCd > 0) e.hitCd -= dt;
      const body = s.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(vx, vy);

      if (e.kind === "kamikaze") {
        s.setFlipX(false);
        s.setRotation(e.aim);
      } else {
        s.setFlipX(e.face < 0 && e.kind !== "boss");
        s.setRotation(0);
      }

      // Re-depth check
      const lastDepth = (s.getData("lastDepth") as number) || 0;
      if (Math.abs(s.y - lastDepth) > 14) {
        s.setDepth(s.y);
        s.setData("lastDepth", s.y);
      }

      if (e.kind === "riot") {
        this.placeShield(s, e);
      }

      // Loot icon optimization
      if (lure || (e.kind === "dog" && this.ctx.stealth)) {
        const loot = s.getData("loot") as Phaser.GameObjects.Sprite | undefined;
        const showLoot = lure && e.kind !== "dog";
        const showSniff = e.kind === "dog" && this.ctx.stealth;
        if (showLoot || showSniff) {
          const key = showSniff ? "sniff" : "loot";
          let icon = loot;
          if (!icon || !icon.active || icon.texture.key !== key) {
            if (icon?.active) icon.setActive(false).setVisible(false);
            icon = (this.loots.get(s.x, s.y - 36, key) as Phaser.GameObjects.Sprite | null) ?? undefined;
            if (icon) {
              icon.setTexture(key);
              icon.setActive(true).setVisible(true).setDepth(3600);
              s.setData("loot", icon);
            }
          }
          icon?.setPosition(s.x, s.y - s.displayHeight * 0.55);
        } else if (loot?.active) {
          loot.setActive(false).setVisible(false);
          s.setData("loot", null);
        }
      }
    }

    // High performance Spatial Hash Grid separation
    const limit = lure ? 10 : 12;
    this.spatialGrid.resolveSeparation(active, limit, 14, px, py);
  }

  touchEnemy(enemy: Phaser.Physics.Arcade.Sprite) {
    if (!enemy.active || !this.ctx.alive) return;
    const e = this.ed(enemy);

    if (e.kind === "prigozhin" && this.ctx.stealth) {
      if (e.hitCd <= 0) {
        e.hitCd = 0.8;
        this.ctx.floater(enemy.x, enemy.y - 45, "💥 ARTICLE 5 AMBUSH STRIKE! 💥", "#ffd60a");
        this.damageEnemy(enemy, 280 * this.pressure());
        if (this.ctx.shockwave) this.ctx.shockwave(enemy.x, enemy.y, 2.5);
        this.ctx.shakeCam(220, 0.016);
      }
      return;
    }

    if (e.kind === "boss" && this.ctx.stealth) {
      this.popBoss(enemy);
      return;
    }

    if (e.kind === "kamikaze") {
      const dmg = e.touch;
      const x = enemy.x;
      const y = enemy.y;
      this.killEnemy(enemy, false);
      const pdx = this.ctx.player.x - x;
      const pdy = this.ctx.player.y - y;
      if (pdx * pdx + pdy * pdy < 46 * 46) {
        this.ctx.hurtPlayer(dmg, false, false);
      }
      return;
    }

    if (e.hitCd > 0) return;

    if (e.kind === "dog") {
      if (this.ctx.dashT > 0) return;
      e.hitCd = 0.55;
      this.ctx.hurtPlayer(e.touch, true, true);
      this.ctx.floater(this.ctx.player.x, this.ctx.player.y - 30, "CHOMP", "#ffd6a0");
      return;
    }

    if (this.ctx.stealth || this.ctx.dashT > 0) return;
    e.hitCd = 0.45;
    this.ctx.hurtPlayer(e.touch);
  }

  touchDecoy(enemy: Phaser.Physics.Arcade.Sprite) {
    if (!this.ctx.decoy.active || !enemy.active) return;
    const e = this.ed(enemy);
    if (e.kind !== "cart" && e.kind !== "kamikaze") return;
    this.killEnemy(enemy, false);
  }

  damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, amount: number, kx = 0, ky = 0) {
    if (!enemy.active) return;
    const e = this.ed(enemy);

    // Roll for Critical Hit (18% base, 55% during ambush/stealth)
    const isAmbush = this.ctx.stealth || this.ctx.dashT > 0;
    const critChance = isAmbush ? 0.55 : 0.18;
    const isCrit = Math.random() < critChance;
    const finalDmg = isCrit ? amount * 2.4 : amount;

    e.hp -= finalDmg;
    const body = enemy.body as Phaser.Physics.Arcade.Body | null;
    const len = Math.hypot(kx, ky);
    if (len > 0.01 && e.kind !== "boss" && e.kind !== "prigozhin" && body) {
      const push = (e.kind === "turtle" ? 35 : 75) * (isCrit ? 1.4 : 1);
      body.setVelocity(body.velocity.x + (kx / len) * push, body.velocity.y + (ky / len) * push);
    }

    enemy.setTint(isCrit ? 0xffcc00 : 0xffffff);
    this.ctx.delayedCall(80, () => {
      if (enemy.active) {
        if (e.kind === "prigozhin" && e.enraged) {
          enemy.setTint(0xff5533);
        } else {
          enemy.clearTint();
        }
      }
    });

    if (isCrit) {
      synth.crit();
      if (this.ctx.critFloater) {
        this.ctx.critFloater(enemy.x, enemy.y, finalDmg);
      } else {
        this.ctx.floater(enemy.x, enemy.y - 24, `⚡ CRIT ${Math.round(finalDmg)}!`, "#ff9e00");
      }
    } else if (finalDmg >= 16) {
      this.ctx.floater(enemy.x, enemy.y - 20, `${Math.round(finalDmg)}`, "#ffe66d");
    }

    if (e.hp <= 0) this.killEnemy(enemy, false);
  }

  killEnemy(enemy: Phaser.Physics.Arcade.Sprite, popped: boolean) {
    if (!enemy.active) return;
    const e = this.ed(enemy);
    const x = enemy.x;
    const y = enemy.y;
    const kind = e.kind;
    const loot = enemy.getData("loot") as Phaser.GameObjects.Sprite | null;
    if (loot?.active) loot.setActive(false).setVisible(false);
    this.dropShield(enemy);

    // O(1) swap-and-pop removal from activeEnemies
    const idx = enemy.getData("activeIdx") as number | undefined;
    if (idx !== undefined && idx >= 0 && idx < this.activeEnemies.length) {
      const last = this.activeEnemies.pop()!;
      if (idx < this.activeEnemies.length) {
        this.activeEnemies[idx] = last;
        last.setData("activeIdx", idx);
      }
      this._activeCount = Math.max(0, this._activeCount - 1);
    }

    if (kind === "prigozhin") {
      this.prigozhinSprite = null;
    } else if (kind === "boss") {
      this.currentBossSprite = null;
    }

    this.ctx.recycle(enemy);

    const isPrigozhin = kind === "prigozhin";
    const isBoss = kind === "boss" || isPrigozhin;
    this.ctx.explode(x, y, isPrigozhin ? 4.5 : isBoss ? 2.8 : 1.1);
    synth.boom(isBoss);
    this.ctx.onKilled();

    if (isPrigozhin) {
      this.ctx.shakeCam(500, 0.035);
      synth.prigozhinRoar();
      if (this.ctx.shockwave) this.ctx.shockwave(x, y, 4.5);
      this.ctx.floater(x, y - 70, "🏆 BIG ZOMBIE PRIGOŽIN DEFEATED! 🏆", "#ffd60a");

      // Grand loot shower!
      for (let i = 0; i < 28; i++) {
        this.ctx.spawnGem(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 120, 15);
      }
      for (let i = 0; i < 4; i++) {
        this.ctx.spawnGem(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 80, 0, true);
      }

      // Wipe out all remaining regular enemy invaders on screen
      const living = [...this.activeEnemies];
      for (const inv of living) {
        if (!inv.active) continue;
        const ik = this.ed(inv).kind;
        if (ik !== "boss" && ik !== "prigozhin") {
          this.ctx.floater(inv.x, inv.y - 20, "RETREAT!", "#ffffff");
          this.damageEnemy(inv, 9999);
        }
      }

      // Trigger the Grand Finale Victory!
      if (!this.finaleVictoryTriggered) {
        this.finaleVictoryTriggered = true;
        this.ctx.onFinaleVictory?.();
      }
    } else if (isBoss) {
      this.ctx.shakeCam(320, 0.018);
      this.ctx.floater(x, y - 55, "💥 S-400 OBLITERATED! 💥", "#ffd60a");
      for (let i = 0; i < 14; i++) {
        this.ctx.spawnGem(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60, 10);
      }
      this.ctx.spawnGem(x - 25, y, 0, true);
      this.ctx.spawnGem(x + 25, y, 0, true);
      if (popped) synth.pop();
    } else if (kind === "cart") {
      this.ctx.aoe(x, y, 85, 30, 110);
      this.ctx.shakeCam(100, 0.007);
    } else if (kind === "kamikaze") {
      this.ctx.aoe(x, y, 95, 26, 130);
      this.ctx.shakeCam(100, 0.008);
    }

    if (!isBoss) {
      this.ctx.spawnGem(x, y, kind === "turtle" || kind === "riot" ? 6 : 4);
      // Chance for a refreshing Pilsner keg drop
      if (Math.random() < (kind === "turtle" || kind === "riot" ? 0.22 : 0.08)) {
        this.ctx.spawnGem(x, y, 0, true);
      }
    }
  }

  popBoss(enemy: Phaser.Physics.Arcade.Sprite) {
    this.ctx.floater(enemy.x, enemy.y - 40, "POP! ARTICLE 5 COMBO!", "#7af0ff");
    this.killEnemy(enemy, true);
    this.ctx.aoe(enemy.x, enemy.y, 160, 45, 220);
    this.ctx.shakeCam(260, 0.015);
  }

  onFriendlyHit(bullet: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite) {
    if (!bullet.active || !enemy.active) return;
    const b = bullet.getData("bd") as BData;
    const e = this.ed(enemy);
    if (b.hit.includes(e.id)) return;
    b.hit.push(e.id);
    let dmg = b.dmg;
    if (e.kind === "turtle") {
      const fromBehind = (bullet.x - enemy.x) * e.face < 0;
      if (fromBehind) dmg *= 2.2;
      else dmg *= 0.45;
    }
    if (e.kind === "riot") {
      const into = b.vx * Math.cos(e.aim) + b.vy * Math.sin(e.aim);
      if (into <= 0) {
        this.ctx.floater(enemy.x + Math.cos(e.aim) * 18, enemy.y + Math.sin(e.aim) * 18, "BLOCK", "#9ad7ff");
        this.ctx.recycle(bullet);
        return;
      }
      dmg *= 2.15;
    }
    this.damageEnemy(enemy, dmg, b.vx, b.vy);
    if (b.aoe > 0) this.ctx.aoe(enemy.x, enemy.y, b.aoe, b.dmg * 0.45, 30);
    if (b.hit.length >= b.pierce) this.ctx.recycle(bullet);
  }
}
