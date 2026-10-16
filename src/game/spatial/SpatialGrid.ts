import type * as Phaser from "phaser";

export class SpatialGrid {
  private worldSize: number;
  private cellSize: number;
  private invCellSize: number;
  private cols: number;
  private rows: number;
  private maxEntities: number;

  // Zero-allocation flat typed arrays for O(1) linked-list bucket chaining
  private head: Int32Array;
  private next: Int32Array;

  // Scratch buffer for radius queries to avoid per-query heap allocations
  private scratchIndices: Int32Array;
  private scratchCount = 0;

  constructor(worldSize = 3600, cellSize = 64, maxEntities = 1024) {
    this.worldSize = worldSize;
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.cols = Math.ceil(worldSize / cellSize);
    this.rows = Math.ceil(worldSize / cellSize);
    this.maxEntities = maxEntities;

    this.head = new Int32Array(this.cols * this.rows);
    this.head.fill(-1);
    this.next = new Int32Array(this.maxEntities);
    this.next.fill(-1);
    this.scratchIndices = new Int32Array(this.maxEntities);
  }

  clear() {
    this.head.fill(-1);
  }

  private getKey(x: number, y: number): number {
    const col = Math.max(0, Math.min(this.cols - 1, (x * this.invCellSize) | 0));
    const row = Math.max(0, Math.min(this.rows - 1, (y * this.invCellSize) | 0));
    return row * this.cols + col;
  }

  insert(entity: Phaser.Physics.Arcade.Sprite, idx: number) {
    if (idx < 0 || idx >= this.maxEntities) return;
    const key = this.getKey(entity.x, entity.y);
    this.next[idx] = this.head[key];
    this.head[key] = idx;
  }

  /**
   * High performance O(N) spatial separation resolution with zero runtime allocations.
   * If focusX and focusY are provided, prioritizes separation for entities near the viewport/player
   * for massive performance gains when hundreds of enemies are spawned.
   */
  resolveSeparation(
    entities: Phaser.Physics.Arcade.Sprite[],
    limit = 12,
    force = 14,
    focusX?: number,
    focusY?: number,
    cullRadiusSq = 1200 * 1200
  ) {
    this.clear();
    const count = entities.length;
    if (count <= 1) return;

    // Fast batch insertion into spatial buckets
    for (let i = 0; i < count; i++) {
      const e = entities[i];
      if (e && e.active) {
        this.insert(e, i);
      }
    }

    const radius = 24;
    const radiusSq = radius * radius;
    const useCull = focusX !== undefined && focusY !== undefined;

    for (let i = 0; i < count; i++) {
      const entity = entities[i];
      if (!entity || !entity.active) continue;

      // Offscreen culling: entities far from player move straight, skipping heavy micro-separation
      if (useCull) {
        const pDx = entity.x - focusX;
        const pDy = entity.y - focusY;
        if (pDx * pDx + pDy * pDy > cullRadiusSq) continue;
      }

      const col = Math.max(0, Math.min(this.cols - 1, (entity.x * this.invCellSize) | 0));
      const row = Math.max(0, Math.min(this.rows - 1, (entity.y * this.invCellSize) | 0));
      let neighborsChecked = 0;

      const rMin = Math.max(0, row - 1);
      const rMax = Math.min(this.rows - 1, row + 1);
      const cMin = Math.max(0, col - 1);
      const cMax = Math.min(this.cols - 1, col + 1);

      let pushX = 0;
      let pushY = 0;

      for (let r = rMin; r <= rMax; r++) {
        const rowOffset = r * this.cols;
        for (let c = cMin; c <= cMax; c++) {
          const key = rowOffset + c;
          let otherIdx = this.head[key];

          while (otherIdx !== -1) {
            if (otherIdx !== i) {
              const other = entities[otherIdx];
              if (other && other.active) {
                const dx = entity.x - other.x;
                const dy = entity.y - other.y;

                // Fast AABB check before square distance
                if (Math.abs(dx) < radius && Math.abs(dy) < radius) {
                  const distSq = dx * dx + dy * dy;
                  if (distSq < radiusSq && distSq > 0.001) {
                    const dist = Math.sqrt(distSq);
                    const push = ((radius - dist) / radius) * force;
                    pushX += (dx / dist) * push;
                    pushY += (dy / dist) * push;

                    neighborsChecked++;
                    if (neighborsChecked >= limit) break;
                  }
                }
              }
            }
            otherIdx = this.next[otherIdx];
          }
          if (neighborsChecked >= limit) break;
        }
        if (neighborsChecked >= limit) break;
      }

      if (pushX !== 0 || pushY !== 0) {
        const body = entity.body as Phaser.Physics.Arcade.Body | null;
        if (body) {
          body.setVelocity(body.velocity.x + pushX, body.velocity.y + pushY);
        }
      }
    }
  }

  /**
   * Fast spatial query for AoE attacks. Checks only cells overlapping the radius
   * instead of iterating over every single entity in the world!
   */
  queryRadius(
    x: number,
    y: number,
    radius: number,
    entities: Phaser.Physics.Arcade.Sprite[]
  ): Phaser.Physics.Arcade.Sprite[] {
    const minCol = Math.max(0, Math.min(this.cols - 1, ((x - radius) * this.invCellSize) | 0));
    const maxCol = Math.max(0, Math.min(this.cols - 1, ((x + radius) * this.invCellSize) | 0));
    const minRow = Math.max(0, Math.min(this.rows - 1, ((y - radius) * this.invCellSize) | 0));
    const maxRow = Math.max(0, Math.min(this.rows - 1, ((y + radius) * this.invCellSize) | 0));
    const radiusSq = radius * radius;

    const result: Phaser.Physics.Arcade.Sprite[] = [];

    for (let r = minRow; r <= maxRow; r++) {
      const rowOffset = r * this.cols;
      for (let c = minCol; c <= maxCol; c++) {
        let idx = this.head[rowOffset + c];
        while (idx !== -1) {
          const entity = entities[idx];
          if (entity && entity.active) {
            const dx = entity.x - x;
            const dy = entity.y - y;
            if (dx * dx + dy * dy <= radiusSq) {
              result.push(entity);
            }
          }
          idx = this.next[idx];
        }
      }
    }

    return result;
  }
}
