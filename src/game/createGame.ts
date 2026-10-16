import * as Phaser from "phaser";
import { GameScene } from "./GameScene";

export function createGame(parentId: string) {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: parentId,
    width: window.innerWidth,
    height: window.innerHeight,
    fps: {
      target: 60,
      min: 30,
      forceSetTimeOut: false,
    },
    audio: {
      noAudio: true,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        fps: 60,
        fixedStep: true,
        debug: false,
      },
    },
    scene: [GameScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    backgroundColor: "#10160e",
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      powerPreference: "high-performance",
      batchSize: 4096,
    },
  };

  return new Phaser.Game(config);
}
