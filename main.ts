// Port Solano — hand-in program (Node 22, standard library only).
//
// The entry is the game in game/: static files a desktop browser plays
// offline, no build step. This program copies game/ and screenshots/ into
// /output and writes /output/dossier.json with the kit's vendored library,
// byte for byte the dossier the gate rebuilds and compares. Serve the game
// locally with any static server, e.g. python3 -m http.server --directory
// game 8080, then open http://localhost:8080.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const shots = readdirSync(join(here, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f));
if (shots.length < 3 || shots.length > 4) {
  process.stderr.write(`gta6: screenshots/ must hold 3 or 4 images, found ${shots.length}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The caps are the sealed scorer's own (from the kit's rules): the dossier
// call refuses an entry the scorer would refuse, here instead of there.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163_840,
    screenshots: { max: 4, max_bytes: 262_144 },
    game_max_files: 993,
    game_max_bytes: 50_331_648,
    game_path_max_bytes: 1000,
  }),
);
process.stdout.write(`gta6: handed in game/ and ${shots.length} screenshots to ${out}\n`);
