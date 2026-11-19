// Staged scenes for the entry's screenshots (?shot=start|play|end&seed=1).
// Each is a real frame of the game itself, arranged deterministically: the
// title over the city, a police chase mid-mission, and the story's end.

import { CONFIG } from './config.js';
import { makeCar } from './entities.js';

export function stageShot(game, kind) {
  const P = CONFIG.pitch;
  if (kind === 'start') {
    game.state = 'menu';
    game.player.x = P * 3 + 200;
    game.player.y = P * 3 + 200;
    return;
  }
  if (kind === 'play') {
    game.state = 'shot';
    // Reyes in a stolen coupe on Avenida del Mar, three stars up, the
    // delivery on the clock and two units already on him.
    const x = P * 2 + 60;
    const y = P * 4 + 60;
    const car = makeCar(x, y, 0, '#d94f3d', 'player');
    car.speed = 300;
    game.cars.push(car);
    game.playerCar = car;
    game.player.x = x;
    game.player.y = y;
    game.player.angle = 0;
    const cop1 = makeCar(x - 190, y - 46, 0.15, '#20303e', 'police');
    const cop2 = makeCar(x - 300, y + 60, -0.1, '#20303e', 'police');
    game.cars.push(cop1, cop2);
    game.wanted = 3;
    game.money = 750;
    game.objective = 'Hot Delivery — deliver to the marker · 87s left';
    game.activeTarget = { x: P * 5 + 60, y: P * 4 + 60 };
    game.toast = { text: 'Sol: "The gallery wants it before the paint dries. Drive like you mean it."', until: Number.POSITIVE_INFINITY };
    return;
  }
  if (kind === 'end') {
    game.state = 'storydone';
    game.player.x = game.world.size + 110;
    game.player.y = P * 2 + 60;
    game.money = 3550;
    game.storyDone = true;
  }
}
