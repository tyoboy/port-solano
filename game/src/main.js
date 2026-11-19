// Port Solano — the game itself. A top-down open-world crime game: steal
// and drive cars, run Sol Vega's jobs, draw the police and lose them again.
//
// State lives here; the world, its traffic and its crowds live in their own
// files; everything is drawn by render.js. Progress (money, the story's
// place, Reyes' position) is saved in localStorage between visits.

import { CONFIG } from './config.js';
import { Rng } from './random.js';
import { buildWorld } from './world.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import {
  spawnTraffic, spawnPeds, updateTraffic, updatePeds,
  spawnPolice, updatePolice, stepCar, makeCar,
} from './entities.js';
import { missionDefs, sideJob } from './missions.js';
import { drawWorld, drawEntities, drawHUD } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 20261119);
const rng = new Rng(seed ^ 0x9e3779b9);
const world = buildWorld(seed);
const input = new Input(canvas);
const sound = new Sound();

const game = {
  state: params.get('shot') ? 'shot' : 'menu',
  world,
  player: { x: world.size - 160, y: CONFIG.pitch * 2 + 60, angle: -Math.PI / 2, health: 100 },
  playerCar: null,
  cars: [],
  peds: [],
  bullets: [],
  particles: [],
  policeTimer: 0,
  wanted: 0,
  unseenFor: 0,
  money: 60,
  objective: '',
  toast: null,
  activeTarget: null,
  missionIndex: 0,
  mission: null, // { def, phase, step, timer, car }
  missions: missionDefs(world),
  storyDone: false,
  time: 0,
  shake: 0,
  hasSave: !!localStorage.getItem(CONFIG.saveKey),
};

game.cars = spawnTraffic(world, rng);
game.peds = spawnPeds(world, rng);

function toast(text, seconds = 5) {
  game.toast = { text, until: performance.now() + seconds * 1000 };
}

function burst(x, y, color, n = 10, speed = 160, size = 4) {
  for (let i = 0; i < n; i++) {
    const a = rng.float(0, Math.PI * 2);
    const s = rng.float(speed * 0.3, speed);
    game.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rng.float(0.25, 0.6), maxLife: 0.6, color, size: rng.float(2, size + 2),
    });
  }
}

// --- crime and the law -------------------------------------------------------

function commitCrime(kind, x, y) {
  // A crime only counts when seen: police close by, or a crowd watching.
  const seenByCop = game.cars.some((c) => c.kind === 'police' && !c.dead && Math.hypot(c.x - x, c.y - y) < 560);
  const seenByCrowd = game.peds.some((p) => !p.dead && p.down <= 0 && Math.hypot(p.x - x, p.y - y) < 210);
  if (!seenByCop && !seenByCrowd && game.wanted === 0) return;
  const stars = CONFIG.wanted.crime[kind] || 1;
  game.wanted = Math.min(5, game.wanted + stars);
  game.unseenFor = 0;
}

function updateWanted(dt) {
  const copsNear = game.cars.filter((c) => c.kind === 'police' && !c.dead);
  const anyClose = copsNear.some((c) => Math.hypot(c.x - game.player.x, c.y - game.player.y) < 720);
  if (game.wanted > 0 && !anyClose) {
    game.unseenFor += dt;
    if (game.unseenFor > CONFIG.wanted.decaySeconds) {
      game.wanted -= 1;
      game.unseenFor = 0;
      if (game.wanted === 0) toast('You lost the police.');
    }
  } else {
    game.unseenFor = 0;
  }
  // Reinforce toward the level's strength; let far, spare units drift off.
  const want = Math.min(8, game.wanted * CONFIG.police.perStar);
  game.policeTimer -= dt;
  if (copsNear.length < want && game.policeTimer <= 0) {
    game.cars.push(spawnPolice(world, rng, game.player));
    game.policeTimer = CONFIG.police.spawnEvery;
  }
  for (const cop of copsNear) {
    if (Math.hypot(cop.x - game.player.x, cop.y - game.player.y) > 2600 && copsNear.length > want) {
      cop.dead = true; // slipped away to another district
    }
  }
  game.cars = game.cars.filter((c) => !c.dead || c.kind === 'parked');
  sound.setSiren(game.wanted > 0 && game.state === 'playing');
}

// --- the player ----------------------------------------------------------------

function nearestCar(x, y, maxD) {
  let best = null;
  let bd = maxD;
  for (const car of game.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function enterCar(car) {
  game.playerCar = car;
  car.kind = 'player';
  car.speed = 0;
  if (car.wasParked) commitCrime('steal', car.x, car.y);
  sound.ensure();
}

function exitCar() {
  const car = game.playerCar;
  if (!car) return;
  car.kind = 'parked';
  car.wasParked = false;
  game.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  game.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  const fixed = world.collide(game.player.x, game.player.y, CONFIG.player.radius);
  game.player.x = fixed.x;
  game.player.y = fixed.y;
  game.playerCar = null;
  sound.setEngine(false);
}

function updatePlayer(dt) {
  const p = game.player;
  if (game.playerCar) {
    const car = game.playerCar;
    const throttle = input.down('KeyW', 'ArrowUp') ? 1 : input.down('KeyS', 'ArrowDown') ? -1 : 0;
    const steer = (input.down('KeyA', 'ArrowLeft') ? -1 : 0) + (input.down('KeyD', 'ArrowRight') ? 1 : 0);
    stepCar(car, dt, throttle, steer * (input.down('Space') ? 1.5 : 1));
    const fixed = world.collide(car.x, car.y, CONFIG.car.radius);
    if (fixed.x !== car.x || fixed.y !== car.y) {
      if (Math.abs(car.speed) > 200) { sound.crash(); game.shake = 5; burst(car.x, car.y, '#ffb03a', 8); }
      car.speed *= 0.5;
    }
    car.x = fixed.x;
    car.y = fixed.y;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    sound.setEngine(true, Math.abs(car.speed) / CONFIG.car.maxSpeed);
    if (input.hit('KeyF', 'KeyE')) exitCar();
  } else {
    const run = input.down('ShiftLeft', 'ShiftRight');
    const sp = run ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed;
    let mx = 0;
    let my = 0;
    if (input.down('KeyW', 'ArrowUp')) my -= 1;
    if (input.down('KeyS', 'ArrowDown')) my += 1;
    if (input.down('KeyA', 'ArrowLeft')) mx -= 1;
    if (input.down('KeyD', 'ArrowRight')) mx += 1;
    if (mx || my) {
      const len = Math.hypot(mx, my);
      p.x += (mx / len) * sp * dt;
      p.y += (my / len) * sp * dt;
      p.angle = Math.atan2(my, mx);
    }
    const fixed = world.collide(p.x, p.y, CONFIG.player.radius);
    p.x = fixed.x;
    p.y = fixed.y;
    // Face the mouse for aiming.
    const cam = camera();
    p.angle = Math.atan2(input.mouse.y + cam.y - p.y, input.mouse.x + cam.x - p.x);
    if (input.hit('KeyE')) {
      const car = nearestCar(p.x, p.y, 52);
      if (car) {
        car.wasParked = car.kind === 'parked';
        if (car.kind === 'traffic') { car.kind = 'parked'; }
        enterCar(car);
      }
    }
    if (input.mouse.down && game.time > (game.lastShot || 0) + 0.21) {
      game.lastShot = game.time;
      shoot();
    }
    sound.setEngine(false);
  }
  // Slow recovery when the heat is off.
  if (game.wanted === 0 && p.health > 0 && p.health < 100) {
    p.health = Math.min(100, p.health + dt * 2.2);
  }
}

function shoot() {
  const p = game.player;
  game.bullets.push({
    x: p.x + Math.cos(p.angle) * 18,
    y: p.y + Math.sin(p.angle) * 18,
    vx: Math.cos(p.angle) * 880,
    vy: Math.sin(p.angle) * 880,
    life: 0.55,
  });
  sound.ensure();
  sound.shot();
  commitCrime('shoot', p.x, p.y);
  burst(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, '#ffd23e', 3, 90, 3);
}

function updateBullets(dt) {
  for (const b of game.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (world.buildingAt(b.x, b.y)) { b.life = 0; burst(b.x, b.y, '#d8d3c8', 3, 70, 2); continue; }
    for (const ped of game.peds) {
      if (!ped.dead && ped.down <= 0 && Math.hypot(ped.x - b.x, ped.y - b.y) < 11) {
        ped.down = 6;
        ped.dead = rng.chance(0.4);
        b.life = 0;
        commitCrime('hitPed', ped.x, ped.y);
        burst(b.x, b.y, '#c0392b', 8, 120, 3);
        break;
      }
    }
    if (b.life <= 0) continue;
    for (const car of game.cars) {
      if (car !== game.playerCar && !car.dead && Math.hypot(car.x - b.x, car.y - b.y) < 22) {
        car.health -= 26;
        b.life = 0;
        burst(b.x, b.y, '#ffb03a', 5, 110, 3);
        if (car.health <= 0) {
          car.dead = true;
          burst(car.x, car.y, '#e2543e', 18, 200, 5);
          if (car.kind === 'police') commitCrime('hitCar', car.x, car.y);
        }
        break;
      }
    }
  }
  game.bullets = game.bullets.filter((b) => b.life > 0);
}

// Car-on-car and car-on-ped contact: shunts, damage, and consequences.
function updateCollisions(dt) {
  const movers = game.cars.filter((c) => !c.dead && (c.kind === 'player' || c.kind === 'police' || c.kind === 'traffic'));
  for (let i = 0; i < movers.length; i++) {
    for (let j = i + 1; j < movers.length; j++) {
      const a = movers[i];
      const b = movers[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < 40) {
        const push = (40 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 120) {
          sound.crash();
          game.shake = Math.max(game.shake, 3);
          burst((a.x + b.x) / 2, (a.y + b.y) / 2, '#ffd23e', 7, 130, 3);
          a.health -= impact * 0.03;
          b.health -= impact * 0.03;
          if (a.kind === 'player' || b.kind === 'player') {
            const other = a.kind === 'player' ? b : a;
            if (other.kind === 'police' || other.kind === 'traffic') commitCrime('hitCar', other.x, other.y);
          }
          a.speed *= 0.6;
          b.speed *= 0.6;
        }
      }
    }
  }
  // Running people down is the city's worst look.
  const driverCars = movers.filter((c) => Math.abs(c.speed) > 90);
  for (const car of driverCars) {
    for (const ped of game.peds) {
      if (ped.dead || ped.down > 0) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 24) {
        ped.down = 7;
        ped.dead = rng.chance(0.35);
        burst(ped.x, ped.y, '#c0392b', 8, 130, 3);
        if (car.kind === 'player') {
          commitCrime('hitPed', ped.x, ped.y);
          game.shake = 4;
        }
      }
    }
  }
  // Police contact hurts Reyes on foot.
  if (!game.playerCar) {
    for (const cop of game.cars) {
      if (cop.kind !== 'police' || cop.dead) continue;
      if (Math.hypot(cop.x - game.player.x, cop.y - game.player.y) < 30 && Math.abs(cop.speed) > 60) {
        game.player.health -= 26 * dt * 4;
        game.shake = 5;
      }
    }
  } else if (game.playerCar.health <= 0 && !game.playerCar.dead) {
    game.playerCar.dead = true;
    burst(game.playerCar.x, game.playerCar.y, '#e2543e', 22, 220, 5);
    game.player.health -= 22;
    exitCar();
    toast('Your ride is wrecked.');
  }
}

// --- missions ------------------------------------------------------------------

function currentDef() {
  if (game.storyDone) return game.sideDef || null;
  return game.missions[game.missionIndex] || null;
}

function offerMission() {
  const def = currentDef();
  game.mission = null;
  if (!def) return;
  game.activeTarget = def.from || def.target;
  game.objective = def.from
    ? `${def.title} — meet Sol at the Marina Club`
    : `${def.title} — reach the marker`;
  if (!def.from) startMission(def);
}

function startMission(def) {
  game.mission = { def, step: 0, timer: def.time || 0, car: null };
  toast(def.brief, 8);
  if (def.heat) {
    game.wanted = Math.max(game.wanted, def.heat);
    commitCrime('missionHeat', game.player.x, game.player.y);
    game.wanted = Math.max(game.wanted, def.heat);
  }
  if (def.type === 'steal') {
    const car = makeCar(def.stealAt.x, def.stealAt.y, Math.PI / 2, '#3d7bd9', 'parked');
    car.marked = true;
    game.cars.push(car);
    game.mission.car = car;
    game.activeTarget = def.stealAt;
    game.objective = `${def.title} — steal the marked coupe at the courthouse`;
  } else if (def.type === 'deliver') {
    game.activeTarget = def.pickup;
    game.objective = `${def.title} — pick up at the marker`;
  } else if (def.type === 'escape') {
    game.activeTarget = def.target;
    game.objective = `${def.title} — reach the marina, then lose the police`;
  } else {
    game.activeTarget = def.target;
    game.objective = `${def.title} — reach the marker`;
  }
}

function completeMission() {
  const def = game.mission.def;
  game.money += def.pay;
  toast(`${def.done} (+$${def.pay})`, 8);
  sound.success();
  game.mission = null;
  if (!game.storyDone) {
    game.missionIndex += 1;
    if (game.missionIndex >= game.missions.length) {
      game.storyDone = true;
      game.state = 'storydone';
      sound.success();
    }
  } else {
    game.sideDef = sideJob(rng, world);
  }
  saveGame();
  offerMission();
}

function failMission(why) {
  toast(`Job failed — ${why}. Sol still has work when you are ready.`, 6);
  sound.fail();
  game.mission = null;
  offerMission();
}

function updateMission(dt) {
  const def = currentDef();
  if (!def) { game.objective = 'Free roam — the city is yours. Club work pays at the gold marker.'; return; }
  if (!game.mission) {
    // Waiting at the offer marker.
    if (game.activeTarget && Math.hypot(game.player.x - game.activeTarget.x, game.player.y - game.activeTarget.y) < 46) {
      startMission(def);
    }
    return;
  }
  const m = game.mission;
  if (m.timer > 0) {
    m.timer -= dt;
    game.objective = `${def.title} — ${Math.max(0, Math.ceil(m.timer))}s left`;
    if (m.timer <= 0) { failMission('out of time'); return; }
  }
  const reach = (t, r = 48) => Math.hypot(game.player.x - t.x, game.player.y - t.y) < r;
  if (def.type === 'goto') {
    if (reach(def.target)) completeMission();
  } else if (def.type === 'deliver') {
    if (m.step === 0 && reach(def.pickup)) {
      m.step = 1;
      m.timer = def.time || 0;
      game.activeTarget = def.target;
      game.objective = `${def.title} — deliver to the marker`;
      sound.pickup();
      toast('Package collected. Go.');
    } else if (m.step === 1 && reach(def.target)) {
      completeMission();
    }
  } else if (def.type === 'steal') {
    if (m.step === 0) {
      if (m.car.dead) { failMission('the coupe is wrecked'); return; }
      if (game.playerCar === m.car) {
        m.step = 1;
        game.activeTarget = def.target;
        game.objective = `${def.title} — bring the coupe to Sol`;
        commitCrime('steal', m.car.x, m.car.y);
      }
    } else if (reach(def.target) && game.playerCar === m.car) {
      m.car.marked = false;
      completeMission();
    }
  } else if (def.type === 'escape') {
    if (m.step === 0 && reach(def.target)) {
      m.step = 1;
      game.objective = `${def.title} — now lose the police`;
    } else if (m.step === 1 && game.wanted === 0) {
      completeMission();
    }
  }
}

// --- save / load -----------------------------------------------------------------

function saveGame() {
  localStorage.setItem(CONFIG.saveKey, JSON.stringify({
    money: game.money,
    missionIndex: game.missionIndex,
    storyDone: game.storyDone,
    x: game.player.x,
    y: game.player.y,
  }));
  game.hasSave = true;
}

function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem(CONFIG.saveKey));
    if (!s) return false;
    game.money = s.money;
    game.missionIndex = s.missionIndex;
    game.storyDone = s.storyDone;
    game.player.x = s.x;
    game.player.y = s.y;
    if (game.storyDone) game.sideDef = sideJob(rng, world);
    return true;
  } catch {
    return false;
  }
}

function wasted() {
  game.state = 'wasted';
  game.money = Math.max(0, Math.floor(game.money * 0.9));
  game.wanted = 0;
  game.cars = game.cars.filter((c) => c.kind !== 'police');
  sound.setEngine(false);
  sound.setSiren(false);
  sound.fail();
}

function respawn() {
  game.player.health = 100;
  game.player.x = CONFIG.pitch * 5 + 40;
  game.player.y = CONFIG.pitch * 5 + 40;
  if (game.playerCar) exitCar();
  game.mission = null;
  game.state = 'playing';
  offerMission();
  saveGame();
}

// --- camera, loop, screens ---------------------------------------------------------

function camera() {
  const p = game.player;
  let x = p.x - W / 2;
  let y = p.y - H / 2;
  x = Math.max(-140, Math.min(world.seaX + 320 - W, x));
  y = Math.max(-40, Math.min(world.size + 40 - H, y));
  if (game.shake > 0) {
    x += rng.float(-game.shake, game.shake);
    y += rng.float(-game.shake, game.shake);
  }
  return { x, y, w: W, h: H, zoom: 1 };
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.time += dt;
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 9);

  if (game.state === 'playing') {
    updatePlayer(dt);
    updateTraffic(game.cars, world, rng, dt);
    const threats = [];
    if (game.wanted > 0) threats.push(game.player);
    for (const c of game.cars) if (Math.abs(c.speed) > 300) threats.push(c);
    updatePeds(game.peds, world, rng, dt, threats);
    for (const cop of game.cars) {
      if (cop.kind === 'police' && !cop.dead) updatePolice(cop, world, dt, game.player);
    }
    updateBullets(dt);
    updateCollisions(dt);
    updateWanted(dt);
    updateMission(dt);
    for (const fx of game.particles) {
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      fx.life -= dt;
    }
    game.particles = game.particles.filter((fx) => fx.life > 0);
    if (game.player.health <= 0) wasted();
    if (input.hit('KeyP', 'Escape')) game.state = 'paused';
  } else if (game.state === 'menu' || game.state === 'shot') {
    updateTraffic(game.cars, world, rng, dt);
    updatePeds(game.peds, world, rng, dt, []);
    if (game.state === 'menu' && input.hit('Enter', 'Space')) {
      sound.ensure();
      if (game.hasSave) loadGame();
      startGame();
    }
  } else if (game.state === 'paused') {
    if (input.hit('KeyP', 'Escape', 'Enter')) game.state = 'playing';
  } else if (game.state === 'wasted' || game.state === 'storydone') {
    if (input.hit('Enter', 'Space')) {
      if (game.state === 'wasted') respawn();
      else { game.state = 'playing'; offerMission(); }
    }
  }

  const cam = camera();
  drawWorld(ctx, world, cam, game.time);
  drawEntities(ctx, world, game, cam, game.time);
  if (game.state !== 'menu') drawHUD(ctx, game, W, H);
  drawScreens();
  input.endFrame();
  requestAnimationFrame(frame);
}

function startGame() {
  game.state = 'playing';
  game.player.health = 100;
  offerMission();
  toast(game.storyDone ? 'Welcome back to Port Solano.' : 'Welcome to Port Solano. Sol is waiting at the marina.', 6);
}

function drawScreens() {
  const cx = W / 2;
  if (game.state === 'menu') {
    ctx.fillStyle = 'rgba(16, 8, 32, 0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = '900 84px "Arial Black", "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffd23e';
    ctx.fillText('PORT SOLANO', cx, 250);
    ctx.font = '700 25px "Segoe UI", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('An open-world crime story in a city that never pays its debts', cx, 300);
    ctx.font = '600 19px "Segoe UI", sans-serif';
    ctx.fillStyle = '#e8dcff';
    ctx.fillText('Steal cars · Run Sol\'s jobs · Outrun the law · Own the streets', cx, 344);
    ctx.font = '700 22px "Segoe UI", sans-serif';
    ctx.fillStyle = '#7be495';
    ctx.fillText(game.hasSave ? 'Press ENTER to continue' : 'Press ENTER to start', cx, 430);
    ctx.font = '500 16px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('WASD drive & walk · E enter car · F exit · Click shoot · P pause', cx, 466);
    ctx.textAlign = 'left';
  } else if (game.state === 'paused') {
    ctx.fillStyle = 'rgba(10, 6, 22, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = '900 52px "Segoe UI", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('PAUSED', cx, H / 2);
    ctx.font = '600 18px "Segoe UI", sans-serif';
    ctx.fillText('P or ENTER to keep playing', cx, H / 2 + 40);
    ctx.textAlign = 'left';
  } else if (game.state === 'wasted') {
    ctx.fillStyle = 'rgba(60, 4, 4, 0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = '900 64px "Arial Black", sans-serif';
    ctx.fillStyle = '#ff4444';
    ctx.fillText('WASTED', cx, H / 2 - 10);
    ctx.font = '600 18px "Segoe UI", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('The Clínica del Mar patched you up. The bill came out of your pocket. ENTER to go on.', cx, H / 2 + 36);
    ctx.textAlign = 'left';
  } else if (game.state === 'storydone') {
    ctx.fillStyle = 'rgba(16, 30, 8, 0.5)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = '900 54px "Arial Black", sans-serif';
    ctx.fillStyle = '#ffd23e';
    ctx.fillText('DEBT PAID', cx, H / 2 - 16);
    ctx.font = '600 19px "Segoe UI", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('Solano Nights is complete. Port Solano stays open — club work, chaos, and the sea.', cx, H / 2 + 28);
    ctx.fillText('ENTER to keep playing', cx, H / 2 + 60);
    ctx.textAlign = 'left';
  }
}

if (params.get('shot')) stageShot(game, params.get('shot'));
requestAnimationFrame(frame);
