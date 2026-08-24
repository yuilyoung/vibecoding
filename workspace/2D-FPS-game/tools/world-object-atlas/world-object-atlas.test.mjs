import assert from 'node:assert/strict';
import { rename as renameFs } from 'node:fs/promises';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { runCleanBuild } from './index.mjs';
import {
  calculateGeneratorHash,
  compareDirectoriesByteForByte,
  promoteCompleteDirectory,
  validateFrameRecords,
  validateRelease,
  verifySourceLock,
} from './lib.mjs';
import { WORLD_OBJECT_BUILD_SPEC, createWorldObjectFrameRecords } from './spec.mjs';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TOOL_DIR, '..', '..');
const RELEASE_DIR = path.join(PROJECT_ROOT, 'public', 'assets', 'runtime', 'world', 'product-v1');
const GENERATOR_FILES = ['chroma-source.mjs', 'index.mjs', 'lib.mjs', 'source-lock.json', 'spec.mjs'];

async function tempDirectory(t, prefix = 'world-object-atlas-test-') {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('emits the exact twenty-frame family/state matrix', () => {
  const frames = createWorldObjectFrameRecords();
  validateFrameRecords(frames);
  assert.equal(frames.length, 20);
  assert.equal(frames[0].key, 'world/product-v1/barrel/idle');
  assert.equal(frames[11].key, 'world/product-v1/teleporter/active');
  assert.equal(frames[12].key, 'world/product-v1/arena-obstacle/core');
  assert.equal(frames[19].key, 'world/product-v1/health-pickup/available');
  assert.equal(new Set(frames.map((frame) => frame.key)).size, 20);
});

test('pinned alpha sources have transparent corners and plausible coverage', async () => {
  const lock = JSON.parse(await readFile(path.join(TOOL_DIR, 'source-lock.json'), 'utf8'));
  const sources = await verifySourceLock(PROJECT_ROOT, lock);
  assert.equal(sources.length, 20);
  for (const source of sources) {
    const decoded = await sharp(source.absolutePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(decoded.info.channels, 4);
    const corners = [0, decoded.info.width - 1, (decoded.info.height - 1) * decoded.info.width,
      decoded.info.width * decoded.info.height - 1];
    assert.deepEqual(corners.map((pixel) => decoded.data[pixel * 4 + 3]), [0, 0, 0, 0]);
    let visible = 0;
    for (let offset = 3; offset < decoded.data.length; offset += 4) if (decoded.data[offset] > 0) visible += 1;
    const coverage = visible / (decoded.info.width * decoded.info.height);
    assert.ok(coverage >= 0.03 && coverage <= 0.75, `${source.path}: ${coverage}`);
  }
});

test('current release validates exact hashes, dimensions, JSON frames, and budgets', async () => {
  const manifest = JSON.parse(await readFile(path.join(RELEASE_DIR, 'manifest.json'), 'utf8'));
  const result = await validateRelease(RELEASE_DIR, manifest, sharp);
  assert.equal(result.gpuRgbaBytes, 8 * 1024 * 1024);
  assert.ok(result.transferBytes <= 4 * 1024 * 1024);
});

test('invalid frame, hash, and budget records fail closed', async () => {
  const manifest = JSON.parse(await readFile(path.join(RELEASE_DIR, 'manifest.json'), 'utf8'));
  const missing = structuredClone(manifest);
  missing.frames.pop();
  await assert.rejects(validateRelease(RELEASE_DIR, missing, sharp), /frame count mismatch/);
  const hash = structuredClone(manifest);
  hash.atlas.imageSha256 = '0'.repeat(64);
  await assert.rejects(validateRelease(RELEASE_DIR, hash, sharp), /image SHA-256 mismatch/);
  const budget = structuredClone(manifest);
  budget.budgets.transferLimitBytes = 1;
  await assert.rejects(validateRelease(RELEASE_DIR, budget, sharp), /transfer limit mismatch/);
});

test('two isolated clean builds are byte-identical', async (t) => {
  const runDir = await tempDirectory(t, 'world-object-clean-');
  const lock = JSON.parse(await readFile(path.join(TOOL_DIR, 'source-lock.json'), 'utf8'));
  const sources = await verifySourceLock(PROJECT_ROOT, lock);
  const generatorHash = await calculateGeneratorHash(TOOL_DIR, GENERATOR_FILES);
  const context = { lock, sources, generatorHash };
  const first = await runCleanBuild('first', runDir, context);
  const second = await runCleanBuild('second', runDir, context);
  const files = await compareDirectoriesByteForByte(first.releaseDir, second.releaseDir);
  assert.deepEqual(files.map((entry) => entry.path), ['manifest.json', 'map-objects.json', 'map-objects.webp']);
});

test('failed atomic promotion restores the previous complete release', async (t) => {
  const parent = await tempDirectory(t);
  const target = path.join(parent, 'product-v1');
  const candidate = path.join(parent, '.world-object-next-test');
  const backup = path.join(parent, '.world-object-previous-test');
  await mkdir(target);
  await mkdir(candidate);
  await writeFile(path.join(target, 'release.txt'), 'prior');
  await writeFile(path.join(candidate, 'release.txt'), 'candidate');
  let failed = false;
  const rename = async (from, to) => {
    if (!failed && from === candidate && to === target) {
      failed = true;
      throw new Error('injected promotion failure');
    }
    await renameFs(from, to);
  };
  await assert.rejects(promoteCompleteDirectory({ candidate, target, backup, rename }), /injected/);
  assert.equal(await readFile(path.join(target, 'release.txt'), 'utf8'), 'prior');
});
