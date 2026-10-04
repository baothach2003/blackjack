/**
 * One-time (but reproducible) rename of assets/cards/ from raw Figma export
 * names (e.g. "Rank=10, Suit=Clubs@3x.png") to the clean convention specified
 * in CLAUDE.md section 8: rank ('2'-'9', 'T' for 10, 'J', 'Q', 'K', 'A') +
 * suit initial ('H'/'D'/'C'/'S'), e.g. "TC.png", "KS.png", and "back.png"
 * for the face-down variant.
 *
 * Usage: node scripts/rename-cards.js
 */
const fs = require('fs');
const path = require('path');

const CARDS_DIR = path.join(__dirname, '..', 'assets', 'cards');

const RANK_MAP = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', '10': 'T',
  J: 'J', Q: 'Q', K: 'K', A: 'A',
};

const SUIT_MAP = {
  Hearts: 'H',
  Diamonds: 'D',
  Clubs: 'C',
  Spades: 'S',
};

const FILENAME_RE = /^Rank=([^,]+), Suit=([^@]+)@3x\.png$/;

function targetName(rawName) {
  const match = rawName.match(FILENAME_RE);
  if (!match) return null;

  const [, rank, suit] = match;

  if (rank === 'Back' && suit === 'Back') {
    return 'back.png';
  }

  const cleanRank = RANK_MAP[rank];
  const cleanSuit = SUIT_MAP[suit];
  if (!cleanRank || !cleanSuit) return null;

  return `${cleanRank}${cleanSuit}.png`;
}

function main() {
  const files = fs.readdirSync(CARDS_DIR).filter((f) => f.endsWith('.png'));

  const renames = [];
  const unmatched = [];

  for (const file of files) {
    const newName = targetName(file);
    if (!newName) {
      unmatched.push(file);
      continue;
    }
    renames.push([file, newName]);
  }

  if (unmatched.length > 0) {
    console.error('Could not map the following files, aborting with no changes made:');
    unmatched.forEach((f) => console.error(`  ${f}`));
    process.exit(1);
  }

  const targetNames = renames.map(([, to]) => to);
  const duplicates = targetNames.filter((n, i) => targetNames.indexOf(n) !== i);
  if (duplicates.length > 0) {
    console.error('Rename would produce duplicate filenames, aborting with no changes made:');
    [...new Set(duplicates)].forEach((f) => console.error(`  ${f}`));
    process.exit(1);
  }

  if (renames.length !== 53) {
    console.error(`Expected 53 files, found ${renames.length}. Aborting with no changes made.`);
    process.exit(1);
  }

  // Two-phase rename (via temp names) so we never collide with a file that
  // hasn't been renamed yet in this same run.
  const tempSuffix = '.tmp-rename';
  for (const [from] of renames) {
    fs.renameSync(path.join(CARDS_DIR, from), path.join(CARDS_DIR, from + tempSuffix));
  }
  for (const [from, to] of renames) {
    fs.renameSync(path.join(CARDS_DIR, from + tempSuffix), path.join(CARDS_DIR, to));
  }

  console.log(`Renamed ${renames.length} files:`);
  targetNames
    .sort((a, b) => a.localeCompare(b))
    .forEach((name) => console.log(`  ${name}`));
}

main();
