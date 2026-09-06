#!/usr/bin/env node
/**
 * Static parity checks between the JS TurboModule spec and the native
 * implementations it is codegen'd against.
 *
 * Why this exists: no CI job compiles the native sources. RN codegen,
 * `pod install`, `xcodebuild` and `gradle assemble` all run first at a
 * consumer's build, because the native SDKs this wrapper bridges to are
 * not reachable from a fresh runner. That makes a green CI check on this
 * repo a statement about TypeScript only — a renamed or reordered
 * `configure` parameter passes every job we run and breaks every
 * consumer. These checks are not a substitute for compiling, but they
 * catch the drift that compiling would have caught, with no toolchain.
 *
 * It fails when it cannot find or parse a signature. A parser that
 * silently matches nothing and reports success is the exact failure this
 * file is meant to prevent.
 *
 * Usage: node scripts/check-native-parity.mjs   (yarn check:native)
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function read(relative) {
  try {
    return readFileSync(join(root, relative), 'utf8');
  } catch (error) {
    throw new Error(`cannot read ${relative}: ${error.message}`);
  }
}

/**
 * Returns the text between the parentheses that follow `header`, using a
 * depth scan so nested parens in types don't truncate the block.
 */
function parenBlock(source, header, where) {
  const match = header.exec(source);
  if (!match) {
    throw new Error(`${where}: no match for ${header}`);
  }
  const open = source.indexOf('(', match.index + match[0].length - 1);
  if (open === -1) throw new Error(`${where}: no '(' after signature`);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`${where}: unbalanced parentheses after signature`);
}

/** Splits a parameter list on top-level commas. */
function splitParams(block, where) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of block) {
    if ('([{<'.includes(ch)) depth++;
    else if (')]}>'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  const names = parts
    .map((part) => part.replace(/\/\/.*$/gm, '').trim())
    .filter(Boolean)
    .map((part) => {
      const label = part.split(':')[0].trim();
      // Swift external labels: `_ name: String` -> the internal name.
      const words = label.split(/\s+/);
      return words[words.length - 1];
    });
  if (names.length === 0) {
    throw new Error(`${where}: parsed an empty parameter list`);
  }
  return names;
}

function tsConfigureParams() {
  const source = read('src/NativeSdkReactNative.ts');
  const where = 'src/NativeSdkReactNative.ts';
  return splitParams(
    parenBlock(source, /\bconfigure\s*\(/, where),
    where
  );
}

function kotlinConfigureParams() {
  const file =
    'android/src/main/java/com/issuetracker/sdkreactnative/SdkReactNativeModule.kt';
  const source = read(file);
  return splitParams(
    parenBlock(source, /override\s+fun\s+configure\s*\(/, file),
    file
  );
}

function swiftConfigureParams() {
  const file = 'ios/IssuetrackerSdkBridge.swift';
  const source = read(file);
  return splitParams(
    parenBlock(source, /public\s+static\s+func\s+configure\s*\(/, file),
    file
  );
}

/**
 * Objective-C++ TurboModule method. The selector is
 * `configure:shakeToReport:...`, so the first parameter's name comes
 * from the variable, and the rest from the selector keywords.
 */
function objcConfigureParams() {
  const file = 'ios/SdkReactNative.mm';
  const source = read(file);
  const start = source.indexOf('- (void)configure:');
  if (start === -1) {
    throw new Error(`${file}: no '- (void)configure:' method found`);
  }
  const end = source.indexOf('\n{', start);
  if (end === -1) throw new Error(`${file}: configure: has no body`);
  const signature = source.slice(start, end);
  const names = [];
  const part = /(\w+)\s*:\s*\(([^)]*)\)\s*(\w+)/g;
  let match;
  while ((match = part.exec(signature)) !== null) {
    names.push(names.length === 0 ? match[3] : match[1]);
  }
  if (names.length === 0) {
    throw new Error(`${file}: parsed an empty parameter list`);
  }
  return names;
}

function compare(expected, actual, label) {
  const same =
    expected.length === actual.length &&
    expected.every((name, i) => name === actual[i]);
  if (!same) {
    failures.push(
      `configure() parameters drifted between the TurboModule spec and ${label}:\n` +
        `    spec  (${expected.length}): ${expected.join(', ')}\n` +
        `    ${label} (${actual.length}): ${actual.join(', ')}`
    );
  }
}

function checkConfigureSignatures() {
  const spec = tsConfigureParams();
  compare(spec, kotlinConfigureParams(), 'SdkReactNativeModule.kt');
  compare(spec, swiftConfigureParams(), 'IssuetrackerSdkBridge.swift');
  compare(spec, objcConfigureParams(), 'SdkReactNative.mm');
}

/**
 * iOS and Android must depend on the same version of the underlying
 * native SDK, and both must pin it to a single minor. On a 0.x line
 * CocoaPods' `~> 0.6` resolves to `>= 0.6, < 1.0`, which quietly adopts
 * a 0.7 that is free to break API — while Gradle stays on 0.6.0.
 */
function checkNativeSdkPins() {
  const podspec = read('SdkReactNative.podspec');
  const gradle = read('android/build.gradle');

  const pod = /s\.dependency\s+"IssuetrackerSDK",\s*"([^"]+)"/.exec(podspec);
  if (!pod) {
    failures.push(
      'SdkReactNative.podspec: no `s.dependency "IssuetrackerSDK", "..."` found'
    );
    return;
  }
  const gradleDep = /"no\.issuetracker:sdk:([^"]+)"/.exec(gradle);
  if (!gradleDep) {
    failures.push(
      'android/build.gradle: no `no.issuetracker:sdk:<version>` dependency found'
    );
    return;
  }

  const constraint = pod[1].trim();
  const androidVersion = gradleDep[1].trim();
  const optimistic = /^~>\s*(\d+)\.(\d+)\.(\d+)$/.exec(constraint);
  if (!optimistic) {
    failures.push(
      `SdkReactNative.podspec: IssuetrackerSDK constraint is "${constraint}"; ` +
        'expected `~> MAJOR.MINOR.PATCH` (three components), which on a 0.x ' +
        'line pins to a single minor the way android/build.gradle does'
    );
    return;
  }
  const iosVersion = optimistic.slice(1).join('.');
  if (iosVersion !== androidVersion) {
    failures.push(
      'Native SDK version pins disagree — bump both in one commit:\n' +
        `    SdkReactNative.podspec:  ${iosVersion} (from "${constraint}")\n` +
        `    android/build.gradle:    ${androidVersion}`
    );
  }
}

/**
 * CocoaPods consumers resolve this package by git tag, and the podspec
 * derives both its version and that tag from package.json. The release
 * workflow asserts tag == package.json version, which is only a
 * meaningful guarantee for CocoaPods while the podspec keeps deriving
 * them rather than hardcoding a version that can go stale.
 */
function checkPodspecVersionSource() {
  const podspec = read('SdkReactNative.podspec');
  if (!/s\.version\s*=\s*package\["version"\]/.test(podspec)) {
    failures.push(
      'SdkReactNative.podspec: `s.version` no longer reads package["version"]. ' +
        'A hardcoded version here drifts from the npm release and from the ' +
        'git tag CocoaPods resolves.'
    );
  }
  if (!/:tag\s*=>\s*"#\{s\.version\}"/.test(podspec)) {
    failures.push(
      'SdkReactNative.podspec: `s.source[:tag]` no longer derives from ' +
        '`s.version`. CocoaPods would resolve a tag nothing verifies.'
    );
  }
}

try {
  checkConfigureSignatures();
  checkNativeSdkPins();
  checkPodspecVersionSource();
} catch (error) {
  // A parse failure means the check did not run. Treat it as a failure,
  // never as a pass.
  console.error(`check-native-parity: ${error.message}`);
  console.error(
    'The signature parser could not read one of the native sources. Fix the ' +
      'parser (or the file) — do not delete the check.'
  );
  process.exit(1);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`\n✗ ${failure}`);
  }
  console.error('');
  process.exit(1);
}

console.log(
  'check-native-parity: configure() signature matches across spec, Kotlin, ' +
    'Swift and Obj-C++; iOS and Android pin the same native SDK version; ' +
    'the podspec still derives its version and tag from package.json.'
);
