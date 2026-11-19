// Everything the player sees: the sun-soaked city from above, its traffic
// and crowds, and the HUD — wanted stars, health, money, the objective
// banner and the minimap. Canvas 2D, no images: Port Solano is drawn from
// the same data it is played on.

import { CONFIG } from './config.js';

export function drawWorld(ctx, world, cam, t) {
  const { x: cx, y: cy, w, h } = cam;
  // Sea and sand first (they extend past the east edge of the grid).
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(world.seaX - cx, -cy, w, h + cy);
  const wave = Math.sin(t * 0.8) * 6;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let y = -40; y < world.size + 200; y += 90) {
    ctx.fillRect(world.seaX + 26 + wave - cx, y - cy, 60, 5);
  }
  ctx.fillStyle = '#eed9a4';
  ctx.fillRect(world.beachX - cx, -cy, world.seaX - world.beachX, world.size + cy);

  // Roads: asphalt over the whole grid, then pavement blocks on top.
  ctx.fillStyle = '#4a4f57';
  ctx.fillRect(-cx, -cy, world.size, world.size);
  ctx.fillStyle = '#5d646e';
  const { pitch, roadWidth } = CONFIG;
  // Lane dashes.
  ctx.fillStyle = 'rgba(255, 214, 90, 0.75)';
  for (let k = 0; k <= CONFIG.blocksAcross; k++) {
    const c = k * pitch + roadWidth / 2;
    for (let s = 10; s < world.size; s += 56) {
      ctx.fillRect(c - 2 - cx, s - cy, 4, 30);
      ctx.fillRect(s - cx, c - 2 - cy, 30, 4);
    }
  }
  // Blocks: pavement, then buildings.
  ctx.fillStyle = '#b9bfae';
  for (let row = 0; row < CONFIG.blocksAcross; row++) {
    for (let col = 0; col < CONFIG.blocksAcross; col++) {
      const bx = roadWidth + col * pitch;
      const by = roadWidth + row * pitch;
      ctx.fillRect(bx - cx, by - cy, CONFIG.blockSize, CONFIG.blockSize);
    }
  }
  // Plaza fountain.
  const plaza = { x: world.size - 230, y: world.size - 230 };
  ctx.fillStyle = '#7fc4de';
  ctx.beginPath();
  ctx.arc(plaza.x - cx, plaza.y - cy, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8f6fb';
  ctx.beginPath();
  ctx.arc(plaza.x - cx, plaza.y - cy, 16, 0, Math.PI * 2);
  ctx.fill();

  for (const b of world.buildings) {
    if (b.x + b.w < cx - 60 || b.y + b.h < cy - 60 || b.x > cx + w + 60 || b.y > cy + h + 60) continue;
    // Shadow, then walls, then the roof the player actually reads.
    ctx.fillStyle = 'rgba(20, 16, 40, 0.28)';
    ctx.fillRect(b.x + 9 - cx, b.y + 12 - cy, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x - cx, b.y - cy, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 7 - cx, b.y + 7 - cy, b.w - 14, b.h - 14);
    ctx.fillStyle = 'rgba(90, 80, 60, 0.35)';
    const units = Math.max(1, Math.floor(b.w / 64));
    for (let i = 0; i < units; i++) {
      ctx.fillRect(b.x + 16 + i * 64 - cx, b.y + 16 - cy, 30, 18);
    }
    if (b.name && cam.zoom > 0.55) {
      ctx.fillStyle = 'rgba(30, 24, 48, 0.72)';
      ctx.font = '600 13px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2 - cx, b.y + b.h / 2 - cy);
    }
  }
  // Palms: a green star over a short trunk shadow.
  for (const tree of world.trees) {
    if (tree.x < cx - 40 || tree.y < cy - 40 || tree.x > cx + w + 40 || tree.y > cy + h + 40) continue;
    ctx.fillStyle = 'rgba(20,16,40,0.25)';
    ctx.beginPath();
    ctx.arc(tree.x + 5 - cx, tree.y + 6 - cy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2e8b47';
    ctx.lineWidth = 3.4;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(tree.x - cx, tree.y - cy);
      ctx.lineTo(tree.x + Math.cos(a) * 15 - cx, tree.y + Math.sin(a) * 15 - cy);
      ctx.stroke();
    }
  }
}

function carBody(ctx, car, cx, cy, t) {
  ctx.save();
  ctx.translate(car.x - cx, car.y - cy);
  ctx.rotate(car.angle);
  const L = 46;
  const W = 24;
  ctx.fillStyle = 'rgba(20,16,40,0.3)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
  ctx.fillStyle = car.dead ? '#333' : car.color;
  ctx.beginPath();
  ctx.roundRect(-L / 2, -W / 2, L, W, 7);
  ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = 'rgba(18, 24, 38, 0.9)';
  ctx.beginPath();
  ctx.roundRect(-6, -W / 2 + 4, 17, W - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(160, 210, 235, 0.85)';
  ctx.fillRect(9, -W / 2 + 5, 4, W - 10);
  ctx.fillRect(-11, -W / 2 + 5, 3, W - 10);
  // Headlights.
  ctx.fillStyle = '#ffeeb0';
  ctx.fillRect(L / 2 - 3, -W / 2 + 3, 3, 5);
  ctx.fillRect(L / 2 - 3, W / 2 - 8, 3, 5);
  if (car.kind === 'police') {
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(-L / 2 + 6, -W / 2, L - 12, W);
    ctx.fillStyle = Math.sin(t * 14) > 0 ? '#ff4444' : '#4477ff';
    ctx.fillRect(-4, -6, 9, 12);
    ctx.fillStyle = '#20303e';
    ctx.font = '900 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, -W / 2 - 4);
  }
  if (car.marked) {
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-L / 2 - 3, -W / 2 - 3, L + 6, W + 6, 9);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawEntities(ctx, world, game, cam, t) {
  const { x: cx, y: cy } = cam;
  for (const car of game.cars) {
    if (car === game.playerCar) continue;
    if (Math.abs(car.x - game.player.x) > cam.w / 2 + 120 || Math.abs(car.y - game.player.y) > cam.h / 2 + 120) continue;
    carBody(ctx, car, cx, cy, t);
  }
  if (game.playerCar) carBody(ctx, game.playerCar, cx, cy, t);
  // Pedestrians: a shirt, a head, a shadow; the fallen lie still.
  for (const ped of game.peds) {
    if (Math.abs(ped.x - game.player.x) > cam.w / 2 + 60 || Math.abs(ped.y - game.player.y) > cam.h / 2 + 60) continue;
    ctx.fillStyle = 'rgba(20,16,40,0.25)';
    ctx.beginPath();
    ctx.arc(ped.x + 2 - cx, ped.y + 3 - cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.down > 0 ? '#7a4a3a' : ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x - cx, ped.y - cy, ped.down > 0 ? 8 : 6.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98d';
    ctx.beginPath();
    ctx.arc(ped.x - cx, ped.y - cy, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player on foot: Reyes in a teal shirt.
  if (!game.playerCar) {
    const p = game.player;
    ctx.fillStyle = 'rgba(20,16,40,0.3)';
    ctx.beginPath();
    ctx.arc(p.x + 2 - cx, p.y + 3 - cy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#12b5a5';
    ctx.beginPath();
    ctx.arc(p.x - cx, p.y - cy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98d';
    ctx.beginPath();
    ctx.arc(p.x - cx, p.y - cy, 3.6, 0, Math.PI * 2);
    ctx.fill();
    // Aim tick toward the mouse.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - cx, p.y - cy);
    ctx.lineTo(p.x + Math.cos(p.angle) * 20 - cx, p.y + Math.sin(p.angle) * 20 - cy);
    ctx.stroke();
  }
  // Bullets and particles.
  ctx.fillStyle = '#ffe27a';
  for (const b of game.bullets) ctx.fillRect(b.x - 2 - cx, b.y - 2 - cy, 4, 4);
  for (const fx of game.particles) {
    ctx.globalAlpha = Math.max(0, fx.life / fx.maxLife);
    ctx.fillStyle = fx.color;
    ctx.fillRect(fx.x - fx.size / 2 - cx, fx.y - fx.size / 2 - cy, fx.size, fx.size);
  }
  ctx.globalAlpha = 1;
  // Mission beacon: a pillar of gold light at the active target.
  const target = game.activeTarget;
  if (target) {
    const pulse = 0.55 + Math.sin(t * 3.2) * 0.2;
    const grad = ctx.createLinearGradient(0, target.y - 190 - cy, 0, target.y - cy);
    grad.addColorStop(0, 'rgba(255, 210, 62, 0)');
    grad.addColorStop(1, `rgba(255, 210, 62, ${pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(target.x - 13 - cx, target.y - 190 - cy, 26, 190);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(target.x - cx, target.y - cy, 15 + Math.sin(t * 3.2) * 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#241300';
    ctx.font = '900 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', target.x - cx, target.y + 5 - cy);
  }
}

export function drawHUD(ctx, game, w, h) {
  const p = game.player;
  // Wanted stars, top centre-right.
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) {
    ctx.font = '26px sans-serif';
    ctx.fillStyle = i < game.wanted ? '#ffd23e' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', w - 18 - (4 - i) * 30, 36);
  }
  // Money and health, top left.
  ctx.textAlign = 'left';
  ctx.font = '900 24px "Segoe UI", sans-serif';
  ctx.fillStyle = '#7be495';
  ctx.fillText(`$${game.money.toLocaleString('en-US')}`, 18, 34);
  ctx.fillStyle = 'rgba(10,8,20,0.55)';
  ctx.fillRect(18, 46, 190, 13);
  ctx.fillStyle = p.health > 30 ? '#e2543e' : '#ff2222';
  ctx.fillRect(20, 48, 186 * Math.max(0, p.health / 100), 9);
  ctx.font = '600 13px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(game.playerCar ? 'IN CAR — F to get out · WASD drive' : 'WASD move · Shift run · E enter car · Click shoot', 18, 78);

  // Objective banner, bottom centre.
  if (game.objective) {
    ctx.font = '700 17px "Segoe UI", sans-serif';
    const text = game.objective;
    const tw = ctx.measureText(text).width + 34;
    ctx.fillStyle = 'rgba(10, 8, 24, 0.72)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - tw / 2, h - 64, tw, 38, 9);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, h - 39);
    ctx.textAlign = 'left';
  }
  // Toast line (Sol's words, pickups, warnings).
  if (game.toast && game.toast.until > performance.now()) {
    ctx.font = '600 16px "Segoe UI", sans-serif';
    const text = game.toast.text;
    const tw = Math.min(w - 60, ctx.measureText(text).width + 34);
    ctx.fillStyle = 'rgba(10, 8, 24, 0.78)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - tw / 2, 16, tw, 40, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, 41, w - 90);
    ctx.textAlign = 'left';
  }
  drawMinimap(ctx, game, w);
  // Low-health vignette.
  if (p.health < 32) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, h / 3, w / 2, h / 2, h / 1.2);
    grad.addColorStop(0, 'rgba(180,0,0,0)');
    grad.addColorStop(1, `rgba(180,0,0,${0.35 + Math.sin(performance.now() / 240) * 0.1})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawMinimap(ctx, game, w) {
  const S = 168;
  const x0 = w - S - 16;
  const y0 = 96;
  const scale = S / game.world.size;
  ctx.fillStyle = 'rgba(12, 14, 26, 0.82)';
  ctx.beginPath();
  ctx.roundRect(x0 - 4, y0 - 4, S + 8, S + 8, 10);
  ctx.fill();
  ctx.fillStyle = '#3d434c';
  ctx.fillRect(x0, y0, S, S);
  ctx.fillStyle = '#aeb6a2';
  for (const b of game.world.buildings) {
    ctx.fillRect(x0 + b.x * scale, y0 + b.y * scale, Math.max(1.4, b.w * scale), Math.max(1.4, b.h * scale));
  }
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(x0 + game.world.seaX * scale, y0, S - game.world.seaX * scale, S);
  for (const car of game.cars) {
    if (car.kind !== 'police' || car.dead) continue;
    ctx.fillStyle = '#ff5544';
    ctx.fillRect(x0 + car.x * scale - 2, y0 + car.y * scale - 2, 4, 4);
  }
  if (game.activeTarget) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(x0 + game.activeTarget.x * scale, y0 + game.activeTarget.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const px = x0 + game.player.x * scale;
  const py = y0 + game.player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(game.playerCar ? game.playerCar.angle : game.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
