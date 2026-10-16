import * as Phaser from "phaser";

export class FxSystem {
  private scene: Phaser.Scene;
  private fxGroup: Phaser.GameObjects.Group;
  private floaters: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, fxGroup: Phaser.GameObjects.Group) {
    this.scene = scene;
    this.fxGroup = fxGroup;
  }

  init() {
    this.paintFx();
    this.floaters = [];
    for (let i = 0; i < 60; i++) {
      const t = this.scene.add
        .text(0, 0, "", {
          fontFamily: "Courier New, monospace",
          fontSize: "16px",
          fontStyle: "bold",
          color: "#ffe66d",
          stroke: "#140e06",
          strokeThickness: 4,
        })
        .setActive(false)
        .setVisible(false)
        .setDepth(4000)
        .setOrigin(0.5, 1);
      this.floaters.push(t);
    }
  }

  private paintFx() {
    const textures = this.scene.textures;
    const paint = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
      if (textures.exists(key)) return;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      draw(ctx);
      textures.addCanvas(key, c);
    };

    paint("loot", 54, 18, (ctx) => {
      ctx.fillStyle = "#fff6d8";
      ctx.strokeStyle = "#1a1208";
      ctx.lineWidth = 3;
      ctx.font = "bold 12px Courier New";
      ctx.strokeText("LOOT!", 2, 14);
      ctx.fillText("LOOT!", 2, 14);
    });

    paint("ring", 96, 96, (ctx) => {
      ctx.strokeStyle = "#7ad0ff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(48, 48, 36, 0, Math.PI * 2);
      ctx.stroke();
    });

    paint("brick", 18, 12, (ctx) => {
      ctx.fillStyle = "#c44536";
      ctx.fillRect(0, 0, 18, 12);
      ctx.strokeStyle = "#1a0d0a";
      ctx.strokeRect(0.5, 0.5, 17, 11);
    });

    paint("flame", 48, 48, (ctx) => {
      ctx.fillStyle = "#ff7b00";
      ctx.beginPath();
      ctx.arc(24, 28, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd60a";
      ctx.beginPath();
      ctx.arc(24, 26, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    paint("tire", 18, 8, (ctx) => {
      ctx.fillStyle = "rgba(20,16,10,0.85)";
      ctx.fillRect(0, 2, 18, 4);
    });

    paint("sniff", 70, 18, (ctx) => {
      ctx.fillStyle = "#ffd6a0";
      ctx.strokeStyle = "#1a1208";
      ctx.lineWidth = 3;
      ctx.font = "bold 12px Courier New";
      ctx.strokeText("SNIFF", 2, 14);
      ctx.fillText("SNIFF", 2, 14);
    });

    paint("shield", 48, 30, (ctx) => {
      ctx.fillStyle = "#1d4e89";
      ctx.strokeStyle = "#071018";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(6, 3);
      ctx.lineTo(42, 3);
      ctx.quadraticCurveTo(46, 15, 42, 27);
      ctx.lineTo(6, 27);
      ctx.quadraticCurveTo(2, 15, 6, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffd60a";
      ctx.fillRect(8, 13, 32, 4);
    });

    paint("shockwave", 128, 128, (ctx) => {
      ctx.strokeStyle = "#00f5d4";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(64, 64, 56, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#ffd60a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(64, 64, 52, 0, Math.PI * 2);
      ctx.stroke();
    });

    paint("spark", 12, 12, (ctx) => {
      ctx.fillStyle = "#ffe66d";
      ctx.beginPath();
      ctx.arc(6, 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(6, 6, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    paint("star", 16, 16, (ctx) => {
      ctx.fillStyle = "#ffd60a";
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(10, 6);
      ctx.lineTo(16, 8);
      ctx.lineTo(10, 10);
      ctx.lineTo(8, 16);
      ctx.lineTo(6, 10);
      ctx.lineTo(0, 8);
      ctx.lineTo(6, 6);
      ctx.closePath();
      ctx.fill();
    });
  }

  explode(x: number, y: number, scale: number) {
    const s = this.fxGroup.get(x, y, "boom0") as Phaser.GameObjects.Sprite | null;
    if (!s) return;
    s.setActive(true).setVisible(true).setPosition(x, y).setDepth(3800);
    s.setScale(scale);
    s.setAlpha(1);
    s.setData("life", 0.36);
    this.shockwave(x, y, scale * 1.6);
    this.sparks(x, y, Math.min(8, Math.round(scale * 5)));
  }

  shockwave(x: number, y: number, maxScale = 1.8) {
    const s = this.fxGroup.get(x, y, "shockwave") as Phaser.GameObjects.Sprite | null;
    if (!s) return;
    s.setActive(true).setVisible(true).setPosition(x, y).setDepth(3700);
    s.setScale(0.2);
    s.setAlpha(0.9);
    s.setData("life", 0.32);
    s.setData("maxScale", maxScale);
  }

  sparks(x: number, y: number, count = 5) {
    for (let i = 0; i < count; i++) {
      const s = this.fxGroup.get(x, y, Math.random() < 0.4 ? "star" : "spark") as Phaser.GameObjects.Sprite | null;
      if (!s) continue;
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 120;
      s.setActive(true).setVisible(true).setPosition(x, y).setDepth(3750);
      s.setScale(0.8 + Math.random() * 0.4);
      s.setAlpha(1);
      s.setData("life", 0.28 + Math.random() * 0.15);
      s.setData("vx", Math.cos(ang) * spd);
      s.setData("vy", Math.sin(ang) * spd);
    }
  }

  puff(x: number, y: number, key: string, life: number, depth: number) {
    const s = this.fxGroup.get(x, y, key) as Phaser.GameObjects.Sprite | null;
    if (!s) return;
    s.setActive(true).setVisible(true).setPosition(x, y).setDepth(depth);
    s.setAlpha(1);
    s.setData("life", life);
  }

  floater(x: number, y: number, text: string, color: string, scale = 1, isCrit = false) {
    const t = this.floaters.find((f) => !f.visible);
    if (!t) return;
    t.setText(text)
      .setColor(color)
      .setPosition(x, y)
      .setVisible(true)
      .setActive(true)
      .setAlpha(1)
      .setScale(scale);

    if (isCrit) {
      t.setFontSize("22px");
      t.setStroke("#780000", 6);
      t.setData("life", 0.75);
      t.setData("vy", -55);
    } else {
      t.setFontSize("16px");
      t.setStroke("#140e06", 4);
      t.setData("life", 0.55);
      t.setData("vy", -36);
    }
  }

  critFloater(x: number, y: number, damage: number) {
    this.floater(x, y - 24, `⚡ CRIT ${Math.round(damage)}!`, "#ff9e00", 1.25, true);
    this.sparks(x, y - 10, 4);
  }

  comic(x: number, y: number, text: string, color = "#ffb703") {
    this.floater(x, y - 36, text, color, 1.4, true);
  }

  banner(playerX: number, playerY: number, text: string, color: string) {
    this.comic(playerX, playerY - 64, text, color);
  }

  tickFx(dt: number) {
    const kids = this.fxGroup.getChildren() as Phaser.GameObjects.Sprite[];
    for (const s of kids) {
      if (!s.active) continue;
      const key = s.texture.key;
      if (!key.startsWith("boom") && key !== "tire" && key !== "shockwave" && key !== "spark" && key !== "star") {
        continue;
      }
      const life = ((s.getData("life") as number) ?? 0) - dt;
      s.setData("life", life);

      if (key.startsWith("boom")) {
        const frame = Math.max(0, Math.min(3, Math.floor((1 - life / 0.36) * 4)));
        const boomKey = `boom${frame}`;
        if (s.texture.key !== boomKey && this.scene.textures.exists(boomKey)) s.setTexture(boomKey);
        s.setAlpha(Math.max(0, Math.min(1, life / 0.2)));
      } else if (key === "shockwave") {
        const maxScale = (s.getData("maxScale") as number) || 1.8;
        const progress = 1 - Math.max(0, life / 0.32);
        s.setScale(0.2 + progress * (maxScale - 0.2));
        s.setAlpha((1 - progress) * 0.9);
      } else if (key === "spark" || key === "star") {
        const vx = (s.getData("vx") as number) || 0;
        const vy = (s.getData("vy") as number) || 0;
        s.x += vx * dt;
        s.y += vy * dt;
        s.setAlpha(Math.max(0, life / 0.3));
        s.rotation += 8 * dt;
      } else {
        s.setAlpha(Math.max(0, Math.min(1, life / 0.2)));
      }

      if (life <= 0) s.setActive(false).setVisible(false);
    }
  }

  tickFloaters(dt: number) {
    for (const t of this.floaters) {
      if (!t.visible) continue;
      const life = ((t.getData("life") as number) ?? 0) - dt;
      t.setData("life", life);
      t.y += ((t.getData("vy") as number) ?? -30) * dt;
      t.setAlpha(Math.max(0, Math.min(1, life / 0.3)));
      if (life <= 0) t.setVisible(false).setActive(false);
    }
  }
}
