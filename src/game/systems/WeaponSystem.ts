import * as Phaser from "phaser";
import { synth } from "../audio";
import type { Flame, Shell, WeaponId, WState } from "../types";

export interface WeaponContext {
  player: Phaser.Physics.Arcade.Sprite;
  faceX: number;
  dashX: number;
  dashY: number;
  stealth: boolean;
  dashT: number;
  fxGroup: Phaser.GameObjects.Group;
  dmgMul(): number;
  rateMul(): number;
  areaMul(): number;
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
  aoe(x: number, y: number, radius: number, damage: number, knock: number): void;
  explode(x: number, y: number, scale: number): void;
  shakeCam(duration: number, intensity: number): void;
  findNearestEnemy(x: number, y: number, bossOk: boolean): Phaser.Physics.Arcade.Sprite | null;
  getRandomLivingEnemy(): Phaser.Physics.Arcade.Sprite | null;
  delayedCall(delay: number, callback: () => void): void;
}

export class WeaponSystem {
  private ctx: WeaponContext;
  weapons: WState[] = [{ id: "bren", level: 1, timer: 0.15 }];
  shells: Shell[] = [];
  flames: Flame[] = [];

  constructor(ctx: WeaponContext) {
    this.ctx = ctx;
  }

  reset() {
    this.weapons = [{ id: "bren", level: 1, timer: 0.15 }];
    this.shells = [];
    this.flames = [];
  }

  has(id: WeaponId) {
    return this.weapons.some((w) => w.id === id);
  }

  wlevel(id: WeaponId) {
    return this.weapons.find((w) => w.id === id)?.level ?? 0;
  }

  resetTimers() {
    for (const w of this.weapons) w.timer = 0;
  }

  tickWeapons(dt: number) {
    if (this.ctx.stealth || this.ctx.dashT > 0) return;
    const rate = this.ctx.rateMul();
    for (const w of this.weapons) {
      w.timer -= dt * rate;
      if (w.timer > 0) continue;
      if (w.id === "bren") {
        // Snappy rapid-fire cadence for instant engagement
        w.timer = 0.22 / (1 + (w.level - 1) * 0.16);
        this.fireBren(w.level);
      } else if (w.id === "artillery") {
        // Fast, thunderous artillery support
        w.timer = 2.4 / (1 + (w.level - 1) * 0.14);
        this.dropShellOnCluster(w.level);
      } else if (w.id === "drone") {
        w.timer = 1.4 / (1 + (w.level - 1) * 0.15);
        const n = 1 + Math.floor(w.level / 2);
        for (let i = 0; i < n; i++) this.launchDrone(w.level, false);
      } else if (w.id === "moto") {
        w.timer = 8.5 / (1 + (w.level - 1) * 0.12);
        this.ghostBike(w.level);
      } else if (w.id === "mlrs") {
        w.timer = 3.0 / (1 + (w.level - 1) * 0.14);
        this.salvo(w.level);
      }
    }
  }

  tickProjectiles(dt: number) {
    // Tick falling artillery shells
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i]!;
      sh.life -= dt;
      const p = 1 - Math.max(0, sh.life) / 0.42;
      sh.sprite.setPosition(sh.x, sh.y - (1 - p) * 110);
      if (sh.life <= 0) {
        this.ctx.explode(sh.x, sh.y, 1.35);
        this.ctx.aoe(sh.x, sh.y, sh.r, sh.dmg, 130);
        this.ctx.shakeCam(130, 0.009);
        synth.boom(true);
        sh.sprite.setActive(false).setVisible(false);
        this.shells.splice(i, 1);
      }
    }

    // Tick thermobaric flame patches
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i]!;
      f.life -= dt;
      f.tick -= dt;
      f.sprite.setAlpha(Math.max(0, Math.min(1, f.life)));
      if (f.tick <= 0) {
        f.tick = 0.2;
        this.ctx.aoe(f.x, f.y, f.r, f.dps * 0.2, 16);
      }
      if (f.life <= 0) {
        f.sprite.setActive(false).setVisible(false);
        this.flames.splice(i, 1);
      }
    }
  }

  private fireBren(level: number) {
    const target = this.ctx.findNearestEnemy(this.ctx.player.x, this.ctx.player.y, false);
    const baseAng = target
      ? Math.atan2(target.y - this.ctx.player.y, target.x - this.ctx.player.x)
      : this.ctx.faceX < 0
        ? Math.PI
        : 0;

    const mul = this.ctx.dmgMul();
    const isAmbush = mul > 1;
    const pierce = isAmbush ? 15 : level >= 4 ? 3 : 1;
    const baseDmg = (11 + (level - 1) * 5) * mul;
    const speed = 640;

    // Snappy double-tap or quad-barrage
    this.ctx.shoot(this.ctx.player.x, this.ctx.player.y, baseAng, speed, baseDmg, pierce, false, "bullet", 0.75, 0);

    if (level >= 2 || isAmbush) {
      this.ctx.delayedCall(45, () => {
        this.ctx.shoot(
          this.ctx.player.x,
          this.ctx.player.y,
          baseAng + (Math.random() - 0.5) * 0.08,
          speed,
          baseDmg * 0.9,
          pierce,
          false,
          "bullet",
          0.75,
          0,
        );
      });
    }

    if (level >= 3) {
      this.ctx.shoot(this.ctx.player.x, this.ctx.player.y, baseAng + 0.18, speed, baseDmg * 0.85, pierce, false, "bullet", 0.75, 0);
      this.ctx.shoot(this.ctx.player.x, this.ctx.player.y, baseAng - 0.18, speed, baseDmg * 0.85, pierce, false, "bullet", 0.75, 0);
    }

    if (level >= 5) {
      // Overclocked Gatling Cannon: hyper fire!
      this.ctx.shoot(this.ctx.player.x, this.ctx.player.y, baseAng + 0.32, speed, baseDmg * 0.75, pierce, false, "bullet", 0.75, 0);
      this.ctx.shoot(this.ctx.player.x, this.ctx.player.y, baseAng - 0.32, speed, baseDmg * 0.75, pierce, false, "bullet", 0.75, 0);
    }

    if (isAmbush) synth.tracer();
    else synth.shoot();
  }

  private dropShellOnCluster(level: number) {
    const pick = this.ctx.getRandomLivingEnemy();
    if (!pick) return;
    const dmg = (34 + (level - 1) * 12) * this.ctx.dmgMul();
    const r = (65 + level * 6) * this.ctx.areaMul();
    this.queueShell(pick.x, pick.y, r, dmg);

    // Level 3+ drops a second shell on a nearby enemy!
    if (level >= 3) {
      this.ctx.delayedCall(160, () => {
        const second = this.ctx.getRandomLivingEnemy();
        if (second) this.queueShell(second.x, second.y, r * 0.9, dmg * 0.85);
      });
    }

    // Level 5 drops a 3rd cluster shell!
    if (level >= 5) {
      this.ctx.delayedCall(320, () => {
        const third = this.ctx.getRandomLivingEnemy();
        if (third) this.queueShell(third.x, third.y, r * 0.95, dmg * 0.9);
      });
    }
  }

  barrage(x: number, y: number, area: number, mul: number) {
    const level = this.wlevel("artillery");
    const dmg = (42 + level * 10) * mul;
    const r = 60 * area;
    // Massive 10-shell ring plus devastating center orbital strike
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.queueShell(x + Math.cos(a) * 95, y + Math.sin(a) * 95, r, dmg);
    }
    this.ctx.delayedCall(200, () => {
      this.queueShell(x, y, r * 1.5, dmg * 1.8);
    });
  }

  queueShell(x: number, y: number, r: number, dmg: number) {
    const sprite = this.ctx.fxGroup.get(x, y - 100, "shell") as Phaser.GameObjects.Sprite | null;
    if (!sprite) {
      this.ctx.delayedCall(380, () => this.ctx.aoe(x, y, r, dmg, 120));
      return;
    }
    sprite.setActive(true).setVisible(true).setDepth(3500);
    sprite.setScale(1.1);
    this.shells.push({ sprite, life: 0.42, x, y, r, dmg });
  }

  private launchDrone(level: number, turbo: boolean) {
    const ang = Math.random() * Math.PI * 2;
    const dmg = (18 + (level - 1) * 7) * (turbo ? this.ctx.dmgMul() : 1) * (turbo ? 1.4 : 1);
    this.ctx.shoot(
      this.ctx.player.x,
      this.ctx.player.y,
      ang,
      turbo ? 340 : 250,
      dmg,
      1,
      true,
      "drone",
      turbo ? 3.4 : 3.8,
      level >= 4 ? 42 : 0,
    );
  }

  swarm(x: number, y: number, mul: number) {
    const level = this.wlevel("drone");
    const count = 10 + level * 2;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      this.ctx.shoot(x, y, ang, 320, (22 + level * 6) * mul, 1, true, "drone", 3.8, 55);
    }
  }

  private ghostBike(level: number) {
    const ang = Math.atan2(this.ctx.dashY, this.ctx.dashX || this.ctx.faceX);
    const dmg = (26 + level * 9) * this.ctx.dmgMul();
    this.ctx.shoot(this.ctx.player.x, this.ctx.player.y, ang, 440, dmg, 25, false, "moto", 1.8, 25);
    synth.moto();
  }

  private salvo(level: number) {
    const n = 4 + level * 2;
    const dmg = (16 + level * 4) * this.ctx.dmgMul();
    for (let i = 0; i < n; i++) {
      const y = this.ctx.player.y + (i - (n - 1) / 2) * 24;
      const ang = (this.ctx.faceX < 0 ? Math.PI : 0) + (i - (n - 1) / 2) * 0.08;
      this.ctx.shoot(this.ctx.player.x - this.ctx.faceX * 20, y, ang, 380, dmg, 4, false, "rocket", 1.6, 36);
    }
    synth.shoot();
  }

  blanket(x: number, y: number, area: number, mul: number) {
    const level = this.wlevel("mlrs");
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const dist = 32 + (i % 3) * 44;
      const fx = this.ctx.fxGroup.get(x, y, "flame") as Phaser.GameObjects.Sprite | null;
      if (!fx) continue;
      const px = x + Math.cos(a) * dist;
      const py = y + Math.sin(a) * dist;
      fx.setActive(true).setVisible(true).setPosition(px, py).setDepth(6);
      fx.setScale(1.25 * area);
      this.flames.push({
        sprite: fx,
        life: 3.2,
        x: px,
        y: py,
        r: 52 * area,
        dps: (28 + level * 6) * mul,
        tick: 0,
      });
    }
  }
}
