import * as Phaser from "phaser";
import { synth } from "../audio";
import { offerFor, PASSIVE_MAX_RANK, PASSIVES, WEAPON_MAX_RANK, WEAPONS } from "../catalog";
import { bus } from "../eventBus";
import type { PassiveId, UpgradeId, UpgradeOffer, WeaponId } from "../types";

export interface LootContext {
  player: Phaser.Physics.Arcade.Sprite;
  faceX: number;
  stealth: boolean;
  hp: number;
  maxHp: number;
  battery: number;
  maxBattery: number;
  recharge: number;
  alive: boolean;
  setHp(hp: number): void;
  setMaxHp(maxHp: number): void;
  setBattery(battery: number): void;
  setMaxBattery(maxBattery: number): void;
  setRecharge(recharge: number): void;
  triggerBeerRage(seconds: number): void;
  banner(text: string, color: string): void;
  floater(x: number, y: number, text: string, color: string, scale?: number, isCrit?: boolean): void;
  dress(sprite: Phaser.Physics.Arcade.Sprite, key: string, height: number, hit: number): void;
  pauseGame(): void;
  resumeGame(): void;
  pushStats(): void;
  wlevel(id: WeaponId): number;
  upgradeWeapon(id: WeaponId): void;
  findNearestEnemy(x: number, y: number, bossOk: boolean): Phaser.Physics.Arcade.Sprite | null;
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
}

export class LootSystem {
  private ctx: LootContext;
  private gems: Phaser.Physics.Arcade.Group;
  private dog: Phaser.GameObjects.Sprite;

  level = 1;
  xp = 0;
  xpNeed = 18;
  choosing = false;
  rerolls = 2;
  ranks: Record<PassiveId, number> = { lumberjack: 0, pilsner: 0, nafo: 0 };
  private brickT = 0;

  constructor(ctx: LootContext, gems: Phaser.Physics.Arcade.Group, dog: Phaser.GameObjects.Sprite) {
    this.ctx = ctx;
    this.gems = gems;
    this.dog = dog;
  }

  reset() {
    this.level = 1;
    this.xp = 0;
    this.xpNeed = 18;
    this.choosing = false;
    this.rerolls = 2;
    this.ranks = { lumberjack: 0, pilsner: 0, nafo: 0 };
    this.brickT = 0;
    this.dog.setVisible(false);
  }

  spawnGem(x: number, y: number, value: number, keg = false) {
    if (keg) {
      const s = this.gems.get(x, y, "keg") as Phaser.Physics.Arcade.Sprite | null;
      if (!s) return;
      s.enableBody(true, x, y, true, true);
      this.ctx.dress(s, "keg", 40, 0.6);
      s.setData("v", 0);
      s.setData("keg", true);
      s.setData("idle", 0.25);
      s.setDepth(8);
      const body = s.body as Phaser.Physics.Arcade.Body;
      body.setVelocity((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50);
      return;
    }

    // High performance gem consolidation: when field has many gems, merge nearby dogtags
    const kids = this.gems.getChildren() as Phaser.Physics.Arcade.Sprite[];
    let activeGemCount = 0;
    for (let i = 0; i < kids.length; i++) {
      if (kids[i]?.active && !kids[i]?.getData("keg")) activeGemCount++;
    }

    if (activeGemCount > 80) {
      // Find nearby existing dogtag to consolidate XP into
      for (let i = 0; i < kids.length; i++) {
        const existing = kids[i];
        if (existing?.active && !existing.getData("keg")) {
          const edx = existing.x - x;
          const edy = existing.y - y;
          if (edx * edx + edy * edy < 80 * 80) {
            const curVal = (existing.getData("v") as number) || 4;
            const nextVal = curVal + value;
            existing.setData("v", nextVal);
            if (nextVal >= 20) {
              existing.setTint(0xffd700);
              existing.setScale(1.25 * (28 / existing.frame.height));
            }
            return;
          }
        }
      }
    }

    const s = this.gems.get(x, y, "dogtag") as Phaser.Physics.Arcade.Sprite | null;
    if (!s) {
      // Direct XP absorption if gem pool is saturated
      this.addXp(value);
      return;
    }
    s.enableBody(true, x, y, true, true);
    s.clearTint();
    this.ctx.dress(s, "dogtag", 28, 0.6);
    s.setData("v", value);
    s.setData("keg", false);
    s.setData("idle", 0.2);
    s.setDepth(8);
    const body = s.body as Phaser.Physics.Arcade.Body;
    body.setVelocity((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50);
  }

  tickGems(dt: number) {
    const magnet = 95 + (this.ctx.stealth && this.ranks.nafo > 0 ? 160 + this.ranks.nafo * 40 : 0);
    const magnetSq = magnet * magnet;
    const kids = this.gems.getChildren() as Phaser.Physics.Arcade.Sprite[];
    const px = this.ctx.player.x;
    const py = this.ctx.player.y;

    for (let i = 0; i < kids.length; i++) {
      const s = kids[i]!;
      if (!s.active) continue;

      const idle = (s.getData("idle") as number) - dt;
      s.setData("idle", idle);
      const dx = px - s.x;
      const dy = py - s.y;

      // Ultra-fast AABB bounding-box check before square distance
      if (Math.abs(dx) < magnet && Math.abs(dy) < magnet) {
        const dSq = dx * dx + dy * dy;
        if (idle <= 0 && dSq < magnetSq) {
          const d = Math.sqrt(dSq) || 1;
          const body = s.body as Phaser.Physics.Arcade.Body;
          const pull = 280 + (magnet - d) * 1.5;
          body.setVelocity((dx / d) * pull, (dy / d) * pull);
        }

        if (dSq < 32 * 32) {
          const keg = !!s.getData("keg");
          if (keg) {
            this.ctx.setHp(Math.min(this.ctx.maxHp, this.ctx.hp + this.ctx.maxHp * 0.35));
            this.ctx.setBattery(this.ctx.maxBattery);
            this.ctx.triggerBeerRage(5);
            this.ctx.floater(s.x, s.y, "🍺 PILSNER RAGE! x2 FIRE!", "#ffd60a", 1.4, true);
            synth.beerRage();
          } else {
            this.addXp((s.getData("v") as number) || 4);
            synth.pickup();
          }
          s.disableBody(true, true);
        }
      }
    }
  }

  addXp(n: number) {
    if (!this.ctx.alive) return;
    this.xp += n;
    if (this.xp >= this.xpNeed && !this.choosing) this.openLevel();
  }

  private openLevel() {
    if (!this.ctx.alive || this.choosing) return;
    if (this.xp < this.xpNeed) return;
    this.xp -= this.xpNeed;
    this.level += 1;
    this.xpNeed = Math.round(18 + this.level * 12);
    if (this.level % 4 === 0) this.rerolls += 1;
    this.ctx.setHp(Math.min(this.ctx.maxHp, this.ctx.hp + 12));
    this.choosing = true;
    const offers = this.rollOffers();
    synth.level();
    bus.emit("trigger-level-up", offers);
    this.ctx.pauseGame();
  }

  reroll(): UpgradeOffer[] | null {
    if (this.rerolls <= 0) return null;
    this.rerolls -= 1;
    synth.reroll();
    const offers = this.rollOffers();
    bus.emit("trigger-level-up", offers);
    this.ctx.pushStats();
    return offers;
  }

  rollOffers(): UpgradeOffer[] {
    const pool: UpgradeOffer[] = [];
    for (const w of WEAPONS) {
      const owned = this.ctx.wlevel(w.id);
      if (owned < WEAPON_MAX_RANK) pool.push(offerFor(w.id, owned + 1));
    }
    for (const p of PASSIVES) {
      const owned = this.ranks[p.id];
      if (owned < PASSIVE_MAX_RANK) pool.push(offerFor(p.id, owned + 1));
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i]!;
      pool[i] = pool[j]!;
      pool[j] = tmp;
    }
    if (pool.length >= 3) return pool.slice(0, 3);
    if (pool.length > 0) return pool;
    return [
      {
        id: "bren",
        kind: "weapon",
        name: "Field Rations",
        blurb: "RESTOCK",
        detail: "All gear maxed! Emergency field rations restore 40 HP.",
        rank: 1,
        maxRank: 1,
      },
    ];
  }

  pickUpgrade(id: UpgradeId) {
    if (!this.choosing) return;
    const isAllMaxed =
      !WEAPONS.some((w) => this.ctx.wlevel(w.id) < WEAPON_MAX_RANK) &&
      !PASSIVES.some((p) => this.ranks[p.id] < PASSIVE_MAX_RANK);
    if (isAllMaxed) {
      this.ctx.setHp(Math.min(this.ctx.maxHp, this.ctx.hp + 40));
      this.ctx.banner("FIELD RATIONS +40 HP", "#ffd60a");
    } else {
      const weapon = WEAPONS.find((w) => w.id === id);
      if (weapon) {
        this.ctx.upgradeWeapon(weapon.id);
      } else if (id === "lumberjack" || id === "pilsner" || id === "nafo") {
        const pid = id as PassiveId;
        if (this.ranks[pid] < PASSIVE_MAX_RANK) {
          this.ranks[pid] += 1;
          if (pid === "lumberjack") {
            const gain = Math.round(110 * 0.25);
            this.ctx.setMaxHp(this.ctx.maxHp + gain);
            this.ctx.setHp(this.ctx.hp + gain);
          }
          if (pid === "pilsner") {
            this.ctx.setMaxBattery(this.ctx.maxBattery + 1.5);
            this.ctx.setRecharge(this.ctx.recharge * 1.25);
            this.ctx.setBattery(this.ctx.maxBattery);
          }
          if (pid === "nafo") this.dog.setVisible(true);
        }
      }
      this.ctx.banner(id.toUpperCase(), "#38b000");
    }
    if (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level += 1;
      this.xpNeed = Math.round(30 + this.level * 14);
      this.ctx.setHp(Math.min(this.ctx.maxHp, this.ctx.hp + 8));
      this.ctx.pushStats();
      bus.emit("trigger-level-up", this.rollOffers());
      synth.level();
      return;
    }
    this.choosing = false;
    bus.emit("level-clear", null);
    this.ctx.resumeGame();
    this.ctx.pushStats();
  }

  tickDog(dt: number) {
    if (this.ranks.nafo <= 0) return;
    this.dog.setVisible(true);
    const tx = this.ctx.player.x - this.ctx.faceX * 36;
    const ty = this.ctx.player.y + 18;
    this.dog.x += (tx - this.dog.x) * Math.min(1, dt * 6);
    this.dog.y += (ty - this.dog.y) * Math.min(1, dt * 6);
    this.dog.setDepth(this.dog.y);
    this.dog.setFlipX(this.ctx.faceX < 0);
    this.brickT -= dt;
    if (this.brickT <= 0) {
      this.brickT = Math.max(0.45, 1.3 - this.ranks.nafo * 0.2);
      const target = this.ctx.findNearestEnemy(this.dog.x, this.dog.y, false);
      if (target) {
        const ang = Math.atan2(target.y - this.dog.y, target.x - this.dog.x);
        this.ctx.shoot(this.dog.x, this.dog.y, ang, 260, 8 + this.ranks.nafo * 4, 1, false, "brick", 1.2, 0);
      }
    }
  }
}
