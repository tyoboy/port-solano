// The moving city: traffic that keeps to its lanes, pedestrians on the
// pavements, police who steer after the player, and the shared arcade car
// physics the player and the police both drive with.

import { CONFIG } from './config.js';

const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8b93e', '#57b368', '#e8e3d8', '#8e6cc9', '#3fc1c9', '#d97bb0', '#5a6b7d'];
let carSeq = 0;

export function makeCar(x, y, angle, color, kind) {
  return {
    id: carSeq++,
    x, y, angle,
    speed: 0,
    color: color || CAR_COLORS[carSeq % CAR_COLORS.length],
    kind, // 'traffic' | 'parked' | 'police' | 'player'
    health: 100,
    lane: null,
    dead: false,
  };
}

// --- traffic ---------------------------------------------------------------
// Roads are the bands between blocks; a lane is a fixed line along one,
// offset for right-hand traffic. Cars run their lane and may turn at an
// intersection, which keeps the whole fleet orderly without steering code.

export function laneLines() {
  const { pitch, roadWidth } = CONFIG;
  const half = roadWidth / 2;
  const lines = [];
  for (let k = 0; k <= CONFIG.blocksAcross; k++) {
    lines.push({ axis: 'v', at: k * pitch + half + 20, dir: 1 });
    lines.push({ axis: 'v', at: k * pitch + half - 20, dir: -1 });
    lines.push({ axis: 'h', at: k * pitch + half - 20, dir: 1 });
    lines.push({ axis: 'h', at: k * pitch + half + 20, dir: -1 });
  }
  return lines;
}

export function spawnTraffic(world, rng) {
  const lines = laneLines();
  const cars = [];
  for (let i = 0; i < CONFIG.traffic.cars; i++) {
    const lane = rng.pick(lines);
    const along = rng.float(0, world.size);
    const x = lane.axis === 'v' ? lane.at : along;
    const y = lane.axis === 'v' ? along : lane.at;
    const car = makeCar(x, y, 0, null, 'traffic');
    car.lane = lane;
    car.speed = CONFIG.traffic.speed * rng.float(0.8, 1.1);
    snapCarToLane(car);
    cars.push(car);
  }
  // Parked cars on the marked spots, waiting to be borrowed.
  for (const spot of world.parkedSpots) {
    const car = makeCar(spot.x, spot.y, spot.angle, null, 'parked');
    cars.push(car);
  }
  return cars;
}

function snapCarToLane(car) {
  const { axis, dir } = car.lane;
  car.angle = axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
}

export function updateTraffic(cars, world, rng, dt) {
  const { pitch, roadWidth } = CONFIG;
  for (const car of cars) {
    if (car.kind !== 'traffic' || car.dead) continue;
    // Slow for the car ahead in the same lane.
    let speed = car.speed;
    for (const other of cars) {
      if (other === car || other.dead || !other.lane || other.lane !== car.lane) continue;
      const ahead = car.lane.axis === 'v'
        ? (other.y - car.y) * car.lane.dir
        : (other.x - car.x) * car.lane.dir;
      if (ahead > 0 && ahead < 84) speed = Math.min(speed, other.speed ?? speed);
    }
    const move = speed * dt;
    if (car.lane.axis === 'v') car.y += move * car.lane.dir;
    else car.x += move * car.lane.dir;
    // At an intersection, sometimes turn onto the crossing road: the new
    // lane is one of the crossing road's two lanes, and the car takes its
    // line from the intersection's centre.
    const cross = car.lane.axis === 'v' ? car.y : car.x;
    const near = Math.round((cross - roadWidth / 2) / pitch);
    const center = near * pitch + roadWidth / 2;
    if (Math.abs(cross - center) < move && near >= 0 && near <= CONFIG.blocksAcross && rng.chance(0.35)) {
      const otherAxis = car.lane.axis === 'v' ? 'h' : 'v';
      const options = laneLines().filter((l) => l.axis === otherAxis && Math.abs(l.at - center) < roadWidth / 2 + 1);
      if (options.length) {
        const nl = rng.pick(options);
        if (nl.axis === 'h') car.y = nl.at;
        else car.x = nl.at;
        car.lane = nl;
        snapCarToLane(car);
      }
    }
    // Wrap at the city edge.
    if (car.x < -60) car.x = world.size + 50;
    if (car.x > world.size + 60) car.x = -50;
    if (car.y < -60) car.y = world.size + 50;
    if (car.y > world.size + 60) car.y = -50;
    const fixed = world.collide(car.x, car.y, CONFIG.car.radius);
    car.x = fixed.x;
    car.y = fixed.y;
  }
}

// --- pedestrians -------------------------------------------------------------

export function spawnPeds(world, rng) {
  const peds = [];
  for (let i = 0; i < CONFIG.peds.count; i++) {
    let x = 0;
    let y = 0;
    do {
      x = rng.float(60, world.size - 60);
      y = rng.float(60, world.size - 60);
    } while (world.buildingAt(x, y) || world.zoneAt(x, y) === 'water');
    peds.push({
      x, y, angle: rng.float(0, Math.PI * 2),
      speed: rng.float(46, 78),
      color: rng.pick(CAR_COLORS),
      shirt: rng.pick(['#f2f2f2', '#ffd23e', '#3fc1c9', '#d94f3d', '#57b368', '#f6dcc8']),
      target: null,
      flee: 0,
      dead: false,
      down: 0,
    });
  }
  return peds;
}

export function updatePeds(peds, world, rng, dt, threats) {
  for (const ped of peds) {
    if (ped.dead) continue;
    if (ped.down > 0) { ped.down -= dt; continue; }
    // Flee the nearest threat (a crime, a fast car, gunfire).
    let threat = null;
    let best = 190;
    for (const t of threats) {
      const d = Math.hypot(t.x - ped.x, t.y - ped.y);
      if (d < best) { best = d; threat = t; }
    }
    if (threat) ped.flee = 1.6;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.y - threat.y, ped.x - threat.x);
      ped.angle = away;
      ped.x += Math.cos(away) * 205 * dt;
      ped.y += Math.sin(away) * 205 * dt;
    } else {
      if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 12) {
        // A new pavement target: somewhere walkable a short stroll away.
        for (let tries = 0; tries < 8; tries++) {
          const tx = ped.x + rng.float(-320, 320);
          const ty = ped.y + rng.float(-320, 320);
          if (!world.buildingAt(tx, ty) && world.zoneAt(tx, ty) !== 'water' && tx > 20 && ty > 20 && tx < world.size - 20 && ty < world.size - 20) {
            ped.target = { x: tx, y: ty };
            break;
          }
        }
      }
      if (ped.target) {
        const a = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
        ped.angle = a;
        ped.x += Math.cos(a) * ped.speed * dt;
        ped.y += Math.sin(a) * ped.speed * dt;
      }
    }
    const fixed = world.collide(ped.x, ped.y, 10);
    ped.x = fixed.x;
    ped.y = fixed.y;
  }
}

// --- shared car physics ------------------------------------------------------

export function stepCar(car, dt, throttle, steer) {
  const { accel, brake, maxSpeed, maxReverse, turnRate } = CONFIG.car;
  if (throttle > 0) car.speed += accel * throttle * dt;
  else if (throttle < 0) car.speed -= (car.speed > 0 ? brake : accel * 0.6) * -throttle * dt;
  // Drag and rolling resistance.
  car.speed -= car.speed * 0.55 * dt;
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;
  car.speed = Math.max(-maxReverse, Math.min(maxSpeed, car.speed));
  const grip = Math.min(1, Math.abs(car.speed) / 130);
  car.angle += steer * turnRate * grip * dt * (car.speed < 0 ? -1 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

// --- police ------------------------------------------------------------------

export function spawnPolice(world, rng, player) {
  // Roll in from a road a few blocks away, never on top of the player.
  for (let tries = 0; tries < 12; tries++) {
    const a = rng.float(0, Math.PI * 2);
    const d = rng.float(620, 900);
    const x = Math.max(30, Math.min(world.size - 30, player.x + Math.cos(a) * d));
    const y = Math.max(30, Math.min(world.size - 30, player.y + Math.sin(a) * d));
    if (world.zoneAt(x, y) === 'road') {
      return makeCar(x, y, a + Math.PI, '#20303e', 'police');
    }
  }
  return makeCar(40, 40, 0, '#20303e', 'police');
}

export function updatePolice(car, world, dt, target) {
  // Steer at the target, throttle hard, brake only when badly misaligned.
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const throttle = Math.abs(diff) > 2.2 ? -0.6 : 1;
  const topBefore = CONFIG.car.maxSpeed;
  CONFIG.car.maxSpeed = CONFIG.police.speed;
  stepCar(car, dt, throttle, steer);
  CONFIG.car.maxSpeed = topBefore;
  const fixed = world.collide(car.x, car.y, CONFIG.car.radius);
  if (fixed.x !== car.x || fixed.y !== car.y) car.speed *= 0.55;
  car.x = fixed.x;
  car.y = fixed.y;
}
