/**
 * Architecture test: enforces the layer rules in CLAUDE.md section 3 by
 * parsing every import in src/, so a boundary violation fails `npm test`
 * instead of depending on someone noticing it in review.
 *
 * Never relax this file to make a build pass (CONSTRAINTS.md F3). Extending
 * it to cover a new boundary is fine.
 *
 * Test files (__tests__/, *.test.ts) are exempt: a test may reach across
 * layers to set up its fixtures.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const SRC = path.resolve(__dirname, '..');

type Layer = 'game' | 'storage' | 'store' | 'theme' | 'components' | 'screens' | 'navigation' | 'hooks';

// The one file in src/game/ that UI layers may import: plain data types
// (Card, Rank, Suit) a component needs for its own props. Never logic.
const GAME_TYPES = path.join(SRC, 'game', 'types');

interface Rule {
  // Other src/ layers this layer may import from.
  layers: readonly Layer[];
  // npm packages this layer may import ('*' = any package).
  packages: readonly string[] | '*';
  // May import src/game/types.ts even though 'game' is not in `layers`.
  gameTypes?: boolean;
}

const UI_PACKAGES = '*' as const;

const RULES: Record<Layer, Rule> = {
  // CLAUDE.md 3.1: pure logic, no React, no Expo, no other layer.
  game: { layers: [], packages: [] },
  // CLAUDE.md 3.2: SQLite only, no React, never game/store.
  storage: { layers: [], packages: ['expo-sqlite'] },
  // Design tokens: plain constants, imported by everyone, imports nothing.
  theme: { layers: [], packages: [] },
  // CLAUDE.md 3.3: the only layer that knows both game/ and storage/.
  store: { layers: ['game', 'storage', 'theme'], packages: ['zustand'] },
  // CLAUDE.md 3.3: UI goes through the store, never game logic or storage.
  components: { layers: ['store', 'theme'], packages: UI_PACKAGES, gameTypes: true },
  screens: { layers: ['store', 'theme', 'components', 'navigation'], packages: UI_PACKAGES, gameTypes: true },
  navigation: { layers: ['screens', 'theme', 'components'], packages: UI_PACKAGES, gameTypes: true },
  hooks: { layers: ['store', 'theme'], packages: UI_PACKAGES, gameTypes: true },
};

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function layerOf(absPath: string): Layer | null {
  const rel = path.relative(SRC, absPath);
  if (rel.startsWith('..')) return null;
  const top = rel.split(path.sep)[0];
  return (top in RULES ? top : null) as Layer | null;
}

function packageName(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

// Returns a description of each forbidden import in `file`, empty if none.
export function violationsIn(file: string, text: string): string[] {
  const fromLayer = layerOf(file);
  if (!fromLayer) return [];
  const rule = RULES[fromLayer];
  const { importedFiles } = ts.preProcessFile(text, true, true);
  const problems: string[] = [];

  for (const { fileName: spec } of importedFiles) {
    const where = `${path.relative(SRC, file)} imports '${spec}'`;

    if (!spec.startsWith('.')) {
      if (rule.packages !== '*' && !rule.packages.includes(packageName(spec))) {
        problems.push(`${where}: package not allowed in src/${fromLayer}/`);
      }
      continue;
    }

    const target = path.resolve(path.dirname(file), spec).replace(/\.(ts|tsx)$/, '');
    const toLayer = layerOf(target);
    if (toLayer === null) {
      // Outside src/ (assets/cards/*.png for Card.tsx). Only UI layers may.
      if (rule.packages !== '*') problems.push(`${where}: reaches outside src/`);
      continue;
    }
    if (toLayer === fromLayer) continue;
    if (toLayer === 'game' && rule.gameTypes && target === GAME_TYPES) continue;
    if (!rule.layers.includes(toLayer)) {
      problems.push(`${where}: src/${fromLayer}/ may not import src/${toLayer}/`);
    }
  }
  return problems;
}

describe('architecture boundaries (CLAUDE.md section 3)', () => {
  const files = listSourceFiles(SRC);

  it('finds the source tree', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('every src/ file sits in a known layer', () => {
    const unknown = files.filter((f) => layerOf(f) === null).map((f) => path.relative(SRC, f));
    expect(unknown).toEqual([]);
  });

  it('no file imports across a forbidden boundary', () => {
    const problems = files.flatMap((f) => violationsIn(f, fs.readFileSync(f, 'utf8')));
    expect(problems).toEqual([]);
  });

  // Proves the checker itself still bites: if one of these stops being
  // reported, the checker has been weakened, not the code made safer.
  it.each([
    ['game', 'game/x.ts', "import { View } from 'react-native';"],
    ['game', 'game/x.ts', "import { getBalance } from '../storage/walletRepository';"],
    ['game', 'game/x.ts', "const z = require('zustand');"],
    ['storage', 'storage/x.ts', "import { calculateScore } from '../game/scoring';"],
    ['storage', 'storage/x.ts', "import React from 'react';"],
    ['store', 'store/x.ts', "import Card from '../components/Card';"],
    ['screens', 'screens/X.tsx', "import { insertHand } from '../storage/handsRepository';"],
    ['screens', 'screens/X.tsx', "import {\n  playerHit,\n} from '../game/gameEngine';"],
    ['components', 'components/X.tsx', "import { getDatabase } from '../storage/db';"],
  ])('flags a planted violation in src/%s (%s)', (_layer, rel, source) => {
    expect(violationsIn(path.join(SRC, rel), source)).not.toEqual([]);
  });

  it.each([
    ['components/X.tsx', "import { Card } from '../game/types';"],
    ['screens/X.tsx', "import { useGameStore } from '../store/gameStore';"],
    ['store/x.ts', "import { playerHit } from '../game/gameEngine';"],
    ['storage/x.ts', "import * as SQLite from 'expo-sqlite';"],
  ])('allows a legitimate import (%s)', (rel, source) => {
    expect(violationsIn(path.join(SRC, rel), source)).toEqual([]);
  });
});
