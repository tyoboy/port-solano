// The story: "Solano Nights". Reyes, a courier who owes the wrong people
// money, works it off for Marisol "Sol" Vega at the Marina Club — five jobs
// that climb from a simple introduction to a harbour run under police heat,
// and a last drive that has to end clean. Original people, original city.
//
// A mission is data: where it starts, what its steps ask (reach a place,
// fetch and deliver, steal a marked car and bring it home, reach a place
// and then lose the police), the words Sol says, the pay, and the heat it
// brings. The game loop in main.js runs the steps.

import { CONFIG } from './config.js';

export function missionDefs(world) {
  const S = world.size;
  const P = CONFIG.pitch;
  const sol = { x: S + 120, y: P * 2 + 60 }; // the marina pier, on the sand
  const cafe = { x: P + 60, y: P * 2 + 60 };
  const courthouse = { x: P * 3 + 60, y: P + 60 };
  const harbor = { x: S - 200, y: P + 60 };
  const plaza = { x: S - 230, y: S - 230 };
  const gallery = { x: P * 5 + 60, y: P * 4 + 60 };

  return [
    {
      id: 'first-wheels',
      title: 'First Wheels',
      from: sol,
      type: 'goto',
      target: sol,
      pay: 150,
      heat: 0,
      brief: 'Sol: "Reyes. You owe, I collect — in work, not blood. Get over to the Marina Club and we talk."',
      done: 'Sol: "You walk like a tourist. We fix that. Take the jobs, keep the change."',
    },
    {
      id: 'hot-delivery',
      title: 'Hot Delivery',
      from: sol,
      type: 'deliver',
      pickup: cafe,
      target: gallery,
      time: 150,
      pay: 300,
      heat: 0,
      brief: 'Sol: "A package waits at Café Brisa. The gallery on the west side wants it before the paint dries. Drive like you mean it."',
      done: 'Sol: "On time and in one piece. The gallery sends its love, and its money."',
    },
    {
      id: 'paper-trail',
      title: 'Paper Trail',
      from: sol,
      type: 'steal',
      stealAt: courthouse,
      target: sol,
      pay: 450,
      heat: 1,
      brief: 'Sol: "A blue coupe outside the courthouse holds a ledger with my name in it. Bring me the car, Reyes — the whole car."',
      done: 'Sol: "My name is out of their book. Yours is in mine, in the good column."',
    },
    {
      id: 'harbor-run',
      title: 'Harbor Run',
      from: sol,
      type: 'deliver',
      pickup: harbor,
      target: plaza,
      time: 180,
      pay: 650,
      heat: 2,
      brief: 'Sol: "Crates at Harbor Market, buyers at the plaza. The police have been watching the docks all week — expect company."',
      done: 'Sol: "Company came, and you left them behind. The buyers doubled their next order."',
    },
    {
      id: 'long-goodbye',
      title: 'The Long Goodbye',
      from: sol,
      type: 'escape',
      target: sol,
      pay: 1000,
      heat: 3,
      brief: 'Sol: "One last drive, Reyes. Take me to the marina, then make us invisible. Lose them, and the debt is smoke."',
      done: 'Sol: "Smoke, Reyes. We are even — and Solano is yours now. The city keeps turning: jobs at the club, whenever you want them."',
    },
  ];
}

// After the story, the club offers repeatable work: reach the marker, earn.
export function sideJob(rng, world) {
  const P = CONFIG.pitch;
  const spots = [
    { x: P * 2 + 60, y: P * 5 + 60 },
    { x: P * 6 + 60, y: P * 2 + 60 },
    { x: P + 60, y: P * 6 + 60 },
    { x: world.size - 200, y: P * 6 + 60 },
    { x: P * 4 + 60, y: P * 7 + 60 },
  ];
  const target = spots[rng.int(0, spots.length - 1)];
  return {
    id: 'side-job',
    title: 'Club Work',
    from: null,
    type: 'goto',
    target,
    pay: 120,
    heat: 0,
    brief: 'Sol: "A friend of the club needs a driver. The marker is on your map."',
    done: 'Sol: "Done and paid. There is always more work at the club."',
  };
}
