import assertNode from 'node:assert/strict';
import { rename as renameFs } from 'node:fs/promises';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  JsonlStatusReporter,
  assertPathInside,
  assertRigInventory,
  clearTransparentRgb,
  compareDirectoriesByteForByte,
  parsePinnedBlenderVersion,
  promoteCompleteDirectory,
  sha256Bytes,
  validateFrameRecords,
  validateRelease,
  verifyPackerLock,
  verifyPinnedFile,
} from './lib.mjs';
import { BUILD_SPEC, FRAMES_PER_TEAM, createFrameRecords } from './spec.mjs';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const lock = JSON.parse(await readFile(path.join(TOOL_DIR, 'blender-lock.json'), 'utf8'));

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'actor-atlas-test-'));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  return directory;
}

function makePhaserJson(team, imagePath) {
  const frames = {};
  for (const frame of createFrameRecords().filter((item) => item.team === team)) {
    frames[frame.key] = {
      frame: {
        x: (frame.index % BUILD_SPEC.atlas.columns) * BUILD_SPEC.cell.width,
        y: Math.floor(frame.index / BUILD_SPEC.atlas.columns) * BUILD_SPEC.cell.height,
        w: BUILD_SPEC.cell.width,
        h: BUILD_SPEC.cell.height,
      },
    };
  }
  return { frames, meta: { image: imagePath, mipmaps: false } };
}

async function makeRelease(t, imageBytesPerTeam = 4) {
  const directory = await temporaryDirectory(t);
  const atlases = [];
  let transferBytes = 0;
  const decodedPixels = Buffer.alloc(BUILD_SPEC.atlas.width * BUILD_SPEC.atlas.height * 4);
  for (const team of BUILD_SPEC.teams) {
    const slug = team.toLowerCase();
    const imagePath = `actor-${slug}.webp`;
    const jsonPath = `actor-${slug}.json`;
    const imageBytes = Buffer.alloc(imageBytesPerTeam, team === 'BLUE' ? 1 : 2);
    const jsonBytes = Buffer.from(`${JSON.stringify(makePhaserJson(team, imagePath), null, 2)}\n`);
    await writeFile(path.join(directory, imagePath), imageBytes);
    await writeFile(path.join(directory, jsonPath), jsonBytes);
    transferBytes += imageBytes.length + jsonBytes.length;
    atlases.push({
      team,
      imagePath,
      jsonPath,
      imageSha256: sha256Bytes(imageBytes),
      pixelSha256: sha256Bytes(decodedPixels),
      jsonSha256: sha256Bytes(jsonBytes),
      transferBytes: imageBytes.length,
    });
  }
  const manifest = {
    schemaVersion: BUILD_SPEC.schemaVersion,
    frames: createFrameRecords().map(({ key, team, state, direction, index }) => ({ key, team, state, direction, index })),
    atlases,
    budgets: {
      transferBytes,
      gpuRgbaBytes: BUILD_SPEC.teams.length * BUILD_SPEC.atlas.width * BUILD_SPEC.atlas.height * 4,
    },
  };
  const fakePipeline = {
    metadata: async () => ({ format: 'webp', width: BUILD_SPEC.atlas.width, height: BUILD_SPEC.atlas.height }),
    ensureAlpha() {
      return this;
    },
    raw() {
      return this;
    },
    toBuffer: async () => ({
      data: decodedPixels,
      info: { channels: 4, width: BUILD_SPEC.atlas.width, height: BUILD_SPEC.atlas.height },
    }),
  };
  const fakeSharp = () => Object.create(fakePipeline);
  return { directory, manifest, fakeSharp };
}

test('build spec emits the exact stable 352-frame matrix', () => {
  const frames = createFrameRecords();
  validateFrameRecords(frames);
  assertNode.equal(FRAMES_PER_TEAM, 176);
  assertNode.equal(frames.length, 352);
  assertNode.equal(frames[0].key, 'actor/blue/idle/east/00');
  assertNode.equal(frames[175].key, 'actor/blue/death/north-east/05');
  assertNode.equal(frames[176].key, 'actor/red/idle/east/00');
  assertNode.equal(frames[351].key, 'actor/red/death/north-east/05');
  assertNode.equal(new Set(frames.map((frame) => frame.key)).size, frames.length);
});

test('fully transparent pixels have deterministic zero RGB without changing visible pixels', () => {
  const input = Buffer.from([12, 34, 56, 0, 78, 90, 123, 1, 210, 211, 212, 255]);
  const output = clearTransparentRgb(input);
  assertNode.deepEqual([...output], [0, 0, 0, 0, 78, 90, 123, 1, 210, 211, 212, 255]);
  assertNode.deepEqual([...input], [12, 34, 56, 0, 78, 90, 123, 1, 210, 211, 212, 255]);
  assertNode.throws(() => clearTransparentRgb(Buffer.alloc(3), 3), /requires RGBA/);
});

test('malformed or reordered frame records fail closed', () => {
  const missing = createFrameRecords().slice(1);
  assertNode.throws(() => validateFrameRecords(missing), /count mismatch/);
  const reordered = createFrameRecords();
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assertNode.throws(() => validateFrameRecords(reordered), /key\/order mismatch/);
});

test('Blender version, build hash, and platform are exact', () => {
  const valid = `${lock.blender.versionLabel}\n\tbuild hash: ${lock.blender.buildHash}\n\tbuild platform: ${lock.blender.platform}\n`;
  assertNode.deepEqual(parsePinnedBlenderVersion(valid, lock), {
    version: lock.blender.version,
    buildHash: lock.blender.buildHash,
  });
  assertNode.throws(() => parsePinnedBlenderVersion(valid.replace('4.5.12', '4.5.11'), lock), /version mismatch/);
  assertNode.throws(() => parsePinnedBlenderVersion(valid.replace(lock.blender.buildHash, 'bad-build'), lock), /build hash mismatch/);
});

test('source files reject wrong bytes and hashes', async (t) => {
  const directory = await temporaryDirectory(t);
  const sourcePath = path.join(directory, 'source.zip');
  await writeFile(sourcePath, 'pinned-source');
  const bytes = Buffer.from('pinned-source');
  await verifyPinnedFile(sourcePath, { bytes: bytes.length, sha256: sha256Bytes(bytes) });
  await assertNode.rejects(verifyPinnedFile(sourcePath, { bytes: bytes.length, sha256: '0'.repeat(64) }), /SHA-256 mismatch/);
  await assertNode.rejects(verifyPinnedFile(sourcePath, { bytes: bytes.length + 1, sha256: sha256Bytes(bytes) }), /byte length mismatch/);
});

test('sharp package version and integrity are pinned', () => {
  verifyPackerLock(
    { packages: { 'node_modules/sharp': { version: lock.packer.version, integrity: lock.packer.integrity } } },
    lock.packer.version,
    lock,
  );
  assertNode.throws(() => verifyPackerLock({ packages: {} }, lock.packer.version, lock), /package-lock sharp version mismatch/);
});

test('exact armature, bones, actions, ranges, and absent actions are validated', () => {
  const inventory = {
    targetArmature: lock.rig.targetArmature,
    sourceArmature: lock.rig.sourceArmature,
    boneNames: [...lock.rig.boneNames],
    actions: structuredClone(lock.rig.actions),
  };
  assertRigInventory(inventory, lock);
  delete inventory.actions.death;
  assertNode.throws(() => assertRigInventory(inventory, lock), /required action is missing for death/);
});

test('staging paths must be strict descendants', async (t) => {
  const root = await temporaryDirectory(t);
  assertNode.equal(assertPathInside(root, path.join(root, 'child'), 'child'), path.join(root, 'child'));
  assertNode.throws(() => assertPathInside(root, root, 'root'), /must be a descendant/);
  assertNode.throws(() => assertPathInside(root, path.join(root, '..', 'escape'), 'escape'), /escapes/);
});

test('release validation checks hashes, dimensions, counts, keys, and budgets', async (t) => {
  const { directory, manifest, fakeSharp } = await makeRelease(t);
  const result = await validateRelease(directory, manifest, fakeSharp);
  assertNode.equal(result.gpuRgbaBytes, 32 * 1024 * 1024);
  manifest.atlases[0].imageSha256 = '0'.repeat(64);
  await assertNode.rejects(validateRelease(directory, manifest, fakeSharp), /atlas image hash mismatch/);
});

test('release validation rejects transfer budget overflow', async (t) => {
  const { directory, manifest, fakeSharp } = await makeRelease(t, 4 * 1024 * 1024);
  await assertNode.rejects(validateRelease(directory, manifest, fakeSharp), /transfer budget exceeded/);
});

test('clean directories compare every file byte-for-byte', async (t) => {
  const root = await temporaryDirectory(t);
  const first = path.join(root, 'first');
  const second = path.join(root, 'second');
  await mkdir(first);
  await mkdir(second);
  await writeFile(path.join(first, 'file.bin'), 'same');
  await writeFile(path.join(second, 'file.bin'), 'same');
  assertNode.equal((await compareDirectoriesByteForByte(first, second)).length, 1);
  await writeFile(path.join(second, 'file.bin'), 'different');
  await assertNode.rejects(compareDirectoriesByteForByte(first, second), /bytes differ/);
});

test('failed promotion restores the prior complete release', async (t) => {
  const parent = await temporaryDirectory(t);
  const target = path.join(parent, 'actors');
  const candidate = path.join(parent, '.actor-atlas-next-test');
  const backup = path.join(parent, '.actor-atlas-previous-test');
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
  await assertNode.rejects(
    promoteCompleteDirectory({ candidate, target, backup, rename }),
    /injected promotion failure/,
  );
  assertNode.equal(await readFile(path.join(target, 'release.txt'), 'utf8'), 'prior');
  assertNode.equal(await readFile(path.join(candidate, 'release.txt'), 'utf8'), 'candidate');
});

test('JSONL status emits one terminal state and rejects later events', () => {
  const lines = [];
  const reporter = new JsonlStatusReporter((line) => lines.push(JSON.parse(line)));
  reporter.emit('queued', 'contract');
  reporter.emit('starting', 'toolchain');
  reporter.emit('running', 'build');
  reporter.emit('succeeded', 'completed');
  assertNode.equal(reporter.terminalCount, 1);
  assertNode.deepEqual(lines.map((line) => line.state), ['queued', 'starting', 'running', 'succeeded']);
  assertNode.equal(lines.filter((line) => line.terminal).length, 1);
  assertNode.throws(() => reporter.emit('failed', 'late'), /after terminal/);
});
