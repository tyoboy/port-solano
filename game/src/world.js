// Port Solano: the city itself, generated from a seed.
//
// A grid of blocks wrapped in roads, the sea along the east edge with a
// sand beach in front of it, palms on the pavements, and named buildings
// (the marina, the art-deco hotels of Avenida del Mar, the courthouse...).
// Everything the game needs to know about a point — road, pavement,
// building, sand, water — is answered here, and buildings are the solids
// every mover collides with.

import { CONFIG } from './config.js';
import { Rng } from './random.js';

const ROOF_PALETTE = ['#e8e3d8', '#d9c8a9', '#c7d3d8', '#e5b8a2', '#b9c9a8', '#f0e0ee', '#d8d8e8', '#efe6cf'];
const WALL_PALETTE = ['#f4ead8', '#eed9c0', '#dcebf0', '#f6dcc8', '#e2ecd9', '#f3e2f0', '#dde4f2', '#f8efdb'];

const NAMED = [
  'Hotel Marisol', 'Avenida Suites', 'Port Solano Bank', 'Courthouse', 'Marina Club',
  'Café Brisa', 'Solano Gallery', 'The Palms Hotel', 'City Records', 'Harbor Market',
  'Radio Solano', 'Clínica del Mar', 'Teatro Azul', 'Solano Motors', 'Customs House',
];

export function buildWorld(seed) {
  const rng = new Rng(seed);
  const { blocksAcross, blockSize, roadWidth, pitch, worldSize } = CONFIG;
  const buildings = [];
  const trees = [];
  const parkedSpots = [];
  let nameIdx = 0;

  for (let row = 0; row < blocksAcross; row++) {
    for (let col = 0; col < blocksAcross; col++) {
      const bx = roadWidth + col * pitch;
      const by = roadWidth + row * pitch;
      // The south-east block is the plaza: no buildings, palms and a fountain.
      const isPlaza = col === blocksAcross - 1 && row === blocksAcross - 1;
      if (isPlaza) {
        for (let i = 0; i < 10; i++) trees.push({ x: bx + rng.float(40, blockSize - 40), y: by + rng.float(40, blockSize - 40) });
        continue;
      }
      // Split each block into 2x2 lots with a lane between them.
      const lot = (blockSize - 36) / 2;
      for (let ly = 0; ly < 2; ly++) {
        for (let lx = 0; lx < 2; lx++) {
          const x = bx + 12 + lx * (lot + 12);
          const y = by + 12 + ly * (lot + 12);
          const w = lot - rng.float(0, 46);
          const h = lot - rng.float(0, 46);
          buildings.push({
            x, y, w, h,
            wall: rng.pick(WALL_PALETTE),
            roof: rng.pick(ROOF_PALETTE),
            floors: rng.int(2, 9),
            name: nameIdx < NAMED.length && rng.chance(0.5) ? NAMED[nameIdx++] : null,
          });
        }
      }
      // Palms along the block's south pavement.
      for (let i = 0; i < 3; i++) {
        trees.push({ x: bx + rng.float(20, blockSize - 20), y: by + blockSize + roadWidth / 2 + rng.float(-8, 8) });
      }
      // A parked car or two at the kerb of the block's east road, clear of
      // the running lanes (which sit at the road's centre ± 20).
      if (rng.chance(0.75)) {
        parkedSpots.push({
          x: bx + blockSize + roadWidth - 14,
          y: by + rng.float(60, blockSize - 60),
          angle: Math.PI / 2,
        });
      }
    }
  }

  const beachX = worldSize; // sand starts at the city's east edge
  return {
    seed,
    size: worldSize,
    buildings,
    trees,
    parkedSpots,
    beachX,
    seaX: worldSize + 260,

    zoneAt(x, y) {
      if (x >= this.seaX) return 'water';
      if (x >= this.beachX) return 'sand';
      if (x < 0 || y < 0 || y > this.size) return 'water';
      const mx = x % pitch;
      const my = y % pitch;
      if (mx < roadWidth || my < roadWidth) return 'road';
      return 'block';
    },
    buildingAt(x, y) {
      for (const b of buildings) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
      }
      return null;
    },
    // Circle vs buildings and the sea: returns a corrected position.
    collide(x, y, r) {
      for (const b of buildings) {
        const nx = Math.max(b.x, Math.min(x, b.x + b.w));
        const ny = Math.max(b.y, Math.min(y, b.y + b.h));
        const dx = x - nx;
        const dy = y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          if (d2 === 0) { x = b.x - r; continue; }
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          y = ny + (dy / d) * r;
        }
      }
      if (x > this.seaX - r) x = this.seaX - r;
      if (x < r) x = r;
      if (y < r) y = r;
      if (y > this.size - r) y = this.size - r;
      return { x, y };
    },
  };
}
