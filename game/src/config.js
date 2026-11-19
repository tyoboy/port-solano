// Port Solano — tuning for the whole game in one place.

export const CONFIG = {
  // The world is a square of city blocks; the sea borders the east.
  blocksAcross: 8,
  blockSize: 460, // pavement + buildings
  roadWidth: 120, // road between blocks
  get pitch() { return this.blockSize + this.roadWidth; },
  get worldSize() { return this.blocksAcross * this.pitch + this.roadWidth; },

  player: {
    walkSpeed: 215,
    runSpeed: 330,
    radius: 13,
    maxHealth: 100,
  },
  car: {
    accel: 340,
    brake: 520,
    maxSpeed: 560,
    maxReverse: 170,
    turnRate: 2.5, // radians per second at full lock, scaled by speed
    radius: 17,
  },
  traffic: { cars: 26, speed: 190 },
  peds: { count: 34 },
  police: {
    speed: 505,
    spawnEvery: 2.6, // seconds between reinforcements at a given level
    perStar: 2, // cars the level tries to keep on the player
  },
  wanted: {
    decaySeconds: 16, // out of sight this long, one star cools off
    crime: {
      steal: 1,
      hitPed: 2,
      hitCar: 1,
      shoot: 1,
      missionHeat: 2,
    },
  },
  saveKey: 'port-solano-save-v1',
};
