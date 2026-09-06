#!/usr/bin/env node
/**
 * Verifies the artifact `yarn prepare` just produced, from a consumer's
 * point of view.
 *
 * `bob build` exiting 0 says the compiler ran. It does not say that the
 * files package.json points `main`, `types` and `exports` at exist, that
 * they end up inside the tarball, or that nothing in the tarball imports
 * a devDependency. Those are the things a consumer actually depends on,
 * and every one of them has failed silently in this codebase before.
 *
 * Usage: node scripts/verify-package.mjs   (yarn verify:package)
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const failures = [];

function fail(message) {
  failures.push(message);
}

/** Every "./..." path package.json declares as an entry point. */
function declaredEntryPoints() {
  const paths = new Set();
  const walk = (value) => {
    if (typeof value === 'string') {
      if (value.startsWith('./')) paths.add(value.slice(2));
      return;
    }
    if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(pkg.main);
  walk(pkg.types);
  walk(pkg.exports);
  if (paths.size === 0) {
    fail(
      'package.json declares no entry points at all (main / types / exports) — ' +
        'refusing to call an unverifiable package good'
    );
  }
  return [...paths].sort();
}

/** The file list `yarn pack` would put in the tarball. */
function tarballContents() {
  const output = execFileSync(
    'yarn',
    ['pack', '--dry-run', '--json'],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  );
  const locations = output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((entry) => entry && typeof entry.location === 'string')
    .map((entry) => entry.location);
  if (locations.length === 0) {
    throw new Error(
      '`yarn pack --dry-run --json` listed no files — the check could not run'
    );
  }
  return locations;
}

function checkEntryPointsExist(entryPoints) {
  for (const entry of entryPoints) {
    let stats;
    try {
      stats = statSync(join(root, entry));
    } catch {
      fail(
        `package.json points at ./${entry}, which does not exist after the build`
      );
      continue;
    }
    if (!stats.isFile() || stats.size === 0) {
      fail(`./${entry} exists but is empty or is not a file`);
    }
  }
}

function checkEntryPointsShip(entryPoints, contents) {
  const shipped = new Set(contents);
  for (const entry of entryPoints) {
    if (!shipped.has(entry)) {
      fail(
        `./${entry} is declared as an entry point but is not in the tarball — ` +
          'check package.json `files`'
      );
    }
  }
}

function checkTypesSurface() {
  const types = typeof pkg.types === 'string' ? pkg.types.replace(/^\.\//, '') : null;
  if (!types) {
    fail('package.json has no explicit `types` — consumers get no declarations');
    return;
  }
  let contents = '';
  try {
    contents = readFileSync(join(root, types), 'utf8');
  } catch {
    return; // already reported by checkEntryPointsExist
  }
  if (!/\bexport\b/.test(contents)) {
    fail(`./${types} contains no \`export\` — the published type surface is empty`);
  }
}

function checkNoTestsShipped(contents) {
  const tests = contents.filter((location) =>
    /(^|\/)(__tests__|__mocks__|__fixtures__)\//.test(location) ||
    /\.(test|spec)\.[cm]?[jt]sx?(\.map)?$/.test(location) ||
    /\.(test|spec)\.d\.[cm]?ts(\.map)?$/.test(location)
  );
  if (tests.length > 0) {
    fail(
      'test files would be published in the tarball:\n    ' +
        tests.join('\n    ') +
        '\n  They import devDependencies consumers do not install. Check ' +
        '`files` in package.json, `exclude` in tsconfig.build.json, and ' +
        '`react-native-builder-bob.exclude`.'
    );
  }
}

function checkNativeSourcesShipped(contents) {
  const expectations = [
    ['a .podspec', (l) => l.endsWith('.podspec')],
    ['iOS sources (ios/)', (l) => l.startsWith('ios/')],
    ['Android sources (android/)', (l) => l.startsWith('android/')],
  ];
  for (const [label, matches] of expectations) {
    if (!contents.some(matches)) {
      fail(`the tarball contains no ${label} — consumers cannot build the native side`);
    }
  }
}

/**
 * Nothing reachable from the published JS entry point may import a
 * package the consumer will not have installed. This is what catches a
 * compiled test file (`import ... from 'vitest'`) or an accidental
 * devDependency import before it reaches npm.
 */
function checkRuntimeImports(contents) {
  const allowed = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
    ...builtinModules,
  ]);
  const devDeps = new Set(Object.keys(pkg.devDependencies ?? {}));

  const jsFiles = contents.filter(
    (location) => location.startsWith('lib/') && /\.[cm]?js$/.test(location)
  );
  if (jsFiles.length === 0) {
    fail('no compiled JavaScript under lib/ is in the tarball');
    return;
  }

  const specifier = /(?:from|import)\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const file of jsFiles) {
    let source;
    try {
      source = readFileSync(join(root, file), 'utf8');
    } catch {
      fail(`${file} is listed in the tarball but cannot be read`);
      continue;
    }
    let match;
    while ((match = specifier.exec(source)) !== null) {
      const request = match[1] ?? match[2];
      if (!request || request.startsWith('.') || request.startsWith('/')) continue;
      const bare = request.startsWith('@')
        ? request.split('/').slice(0, 2).join('/')
        : request.split('/')[0];
      if (allowed.has(bare) || allowed.has(request)) continue;
      const hint = devDeps.has(bare)
        ? ' (a devDependency — consumers will not have it installed)'
        : ' (not in dependencies or peerDependencies)';
      fail(`${file} imports "${request}"${hint}`);
    }
  }
}

let contents;
try {
  contents = tarballContents();
} catch (error) {
  console.error(`verify-package: ${error.message}`);
  process.exit(1);
}

const entryPoints = declaredEntryPoints();
checkEntryPointsExist(entryPoints);
checkEntryPointsShip(entryPoints, contents);
checkTypesSurface();
checkNoTestsShipped(contents);
checkNativeSourcesShipped(contents);
checkRuntimeImports(contents);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`\n✗ ${failure}`);
  }
  console.error('');
  process.exit(1);
}

// Printed on success so the exact published file list is reviewable in
// the CI log without downloading anything.
console.log(`verify-package: ${contents.length} files would be published:`);
for (const location of [...contents].sort()) {
  console.log(`  ${location}`);
}
console.log(
  `\nverify-package: entry points (${entryPoints.join(', ')}) exist and ship; ` +
    'no test files; no imports outside dependencies + peerDependencies.'
);
