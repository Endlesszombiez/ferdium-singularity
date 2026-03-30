#!/usr/bin/env node
/* eslint-disable no-console */
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function fail(message) {
  console.error('\n*************** FAILING ***************');
  console.error(message);
  console.error('\nPlease read the developer documentation in CONTRIBUTING.md');
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(rootDir, relativePath), { encoding: 'utf8' }),
  );
}

function parseVersion(rawVersion) {
  const match = String(rawVersion)
    .trim()
    .match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/);

  if (!match) {
    throw new Error(`Unable to parse version "${rawVersion}"`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
  };
}

function compareVersions(left, right) {
  if (left.major !== right.major) {
    return left.major - right.major;
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  return left.patch - right.patch;
}

function satisfiesRange(version, range) {
  const comparators = String(range).trim().split(/\s+/).filter(Boolean);

  return comparators.every(comparator => {
    const match = comparator.match(/^(>=|<=|>|<|=)?v?(\d+(?:\.\d+){0,2})$/);

    if (!match) {
      throw new Error(
        `Unsupported comparator "${comparator}" in range "${range}"`,
      );
    }

    const operator = match[1] ?? '=';
    const target = parseVersion(match[2]);
    const diff = compareVersions(version, target);

    switch (operator) {
      case '>': {
        return diff > 0;
      }
      case '>=': {
        return diff >= 0;
      }
      case '<': {
        return diff < 0;
      }
      case '<=': {
        return diff <= 0;
      }
      case '=': {
        return diff === 0;
      }
      default: {
        return false;
      }
    }
  });
}

function runWhere(command) {
  try {
    return execFileSync('where.exe', [command], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    })
      .split(/\r?\n/)
      .map(entry => entry.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getCommandCandidates(command) {
  if (process.platform !== 'win32') {
    return [command];
  }

  const discovered = runWhere(command);

  return [
    ...new Set([
      ...discovered,
      command,
      `${command}.cmd`,
      `${command}.ps1`,
      `${command}.exe`,
    ]),
  ];
}

function formatShellInvocation(command, args) {
  const quotedArgs = args.map(arg => `"${String(arg).replaceAll('"', '\\"')}"`);

  return [command, ...quotedArgs].join(' ');
}

function run(command, args, options = {}) {
  if (process.platform === 'win32') {
    try {
      return execSync(formatShellInvocation(command, args), {
        cwd: rootDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        shell: true,
        ...options,
      }).trim();
    } catch {
      return null;
    }
  }

  for (const candidate of getCommandCandidates(command)) {
    try {
      const output = execFileSync(candidate, args, {
        cwd: rootDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        ...options,
      });

      return output.trim();
    } catch {
      // Try the next executable candidate on PATH.
    }
  }

  return null;
}

function ensurePnpm(rootManifest, recipesManifest) {
  const ranges = [
    {
      source: 'main repo',
      value: rootManifest.engines?.pnpm,
    },
    {
      source: 'recipes repo',
      value: recipesManifest.engines?.pnpm,
    },
  ];

  const pnpmVersion = run('pnpm', ['--version']);

  if (pnpmVersion) {
    const parsedPnpmVersion = parseVersion(pnpmVersion);
    const mismatch = ranges.find(
      ({ value }) => value && !satisfiesRange(parsedPnpmVersion, value),
    );

    if (!mismatch) {
      console.log(`Using pnpm ${pnpmVersion}`);
      return;
    }
  }

  const corepackVersion = run('corepack', ['--version']);

  if (!corepackVersion) {
    fail(
      `pnpm is missing or outside the supported range.\n` +
        `expected: [${ranges.map(({ source, value }) => `${source}: ${value}`).join(', ')}]\n` +
        `actual  : [${pnpmVersion ?? 'missing'}]\n` +
        'Install a compatible pnpm 10 release or enable Corepack and retry.',
    );
  }

  const packageManager = rootManifest.packageManager ?? 'pnpm@10';
  console.log(`Activating ${packageManager} via Corepack`);
  const prepared = run('corepack', ['prepare', packageManager, '--activate'], {
    stdio: 'inherit',
  });

  if (prepared === null) {
    fail(`Corepack could not activate ${packageManager}`);
  }

  const activatedPnpmVersion = run('pnpm', ['--version']);

  if (!activatedPnpmVersion) {
    fail('pnpm is still unavailable after Corepack activation');
  }

  const parsedActivatedPnpmVersion = parseVersion(activatedPnpmVersion);
  const mismatch = ranges.find(
    ({ value }) => value && !satisfiesRange(parsedActivatedPnpmVersion, value),
  );

  if (mismatch) {
    fail(
      `pnpm is outside the supported range after Corepack activation.\n` +
        `expected: [${ranges.map(({ source, value }) => `${source}: ${value}`).join(', ')}]\n` +
        `actual  : [${activatedPnpmVersion}]`,
    );
  }

  console.log(`Using pnpm ${activatedPnpmVersion}`);
}

const rootManifest = readJson('package.json');
const recipesManifestPath = path.join(rootDir, 'recipes', 'package.json');

if (!fs.existsSync(recipesManifestPath)) {
  fail("'recipes' folder is missing or submodule has not been checked out");
}

const recipesManifest = readJson(path.join('recipes', 'package.json'));
const nodeRanges = [
  {
    source: 'main repo',
    value: rootManifest.engines?.node,
  },
  {
    source: 'recipes repo',
    value: recipesManifest.engines?.node,
  },
];

const parsedNodeVersion = parseVersion(process.version);
const incompatibleNodeRange = nodeRanges.find(
  ({ value }) => value && !satisfiesRange(parsedNodeVersion, value),
);

if (incompatibleNodeRange) {
  fail(
    `You are not running a supported version of node.\n` +
      `expected: [${nodeRanges.map(({ source, value }) => `${source}: ${value}`).join(', ')}]\n` +
      `actual  : [${process.version}]`,
  );
}

console.log(`Using Node ${process.version}`);
ensurePnpm(rootManifest, recipesManifest);
