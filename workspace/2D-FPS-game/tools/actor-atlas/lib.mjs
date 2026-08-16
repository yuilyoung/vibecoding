import { createHash } from 'node:crypto';
import {
  access,
  readFile,
  readdir,
  rename as renameFs,
  rm as rmFs,
  stat,
} from 'node:fs/promises';
import path from 'node:path';

import { BUILD_SPEC, FRAMES_PER_TEAM, createFrameRecords } from './spec.mjs';

export class ContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContractError';
  }
}

export function assert(condition, message) {
  if (!condition) {
    throw new ContractError(message);
  }
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function clearTransparentRgb(bytes, channels = 4) {
  assert(channels === 4, `transparent RGB normalization requires RGBA input, got ${channels} channels`);
  assert(bytes.length % channels === 0, 'raw RGBA byte length is invalid');
  const normalized = Buffer.from(bytes);
  for (let offset = 0; offset < normalized.length; offset += channels) {
    if (normalized[offset + 3] === 0) {
      normalized[offset] = 0;
      normalized[offset + 1] = 0;
      normalized[offset + 2] = 0;
    }
  }
  return normalized;
}

export async function sha256File(filePath) {
  return sha256Bytes(await readFile(filePath));
}

export async function verifyPinnedFile(filePath, expected) {
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch (error) {
    throw new ContractError(`required file is missing: ${filePath} (${error.message})`);
  }
  assert(fileStat.isFile(), `required path is not a file: ${filePath}`);
  if (expected.bytes !== undefined) {
    assert(fileStat.size === expected.bytes, `byte length mismatch for ${filePath}: ${fileStat.size}`);
  }
  const actualHash = await sha256File(filePath);
  assert(actualHash === expected.sha256, `SHA-256 mismatch for ${filePath}: ${actualHash}`);
  return { bytes: fileStat.size, sha256: actualHash };
}

export function assertPathInside(rootPath, candidatePath, label = 'path') {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);
  assert(relative !== '', `${label} must be a descendant of ${root}`);
  assert(!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative), `${label} escapes ${root}`);
  return candidate;
}

export function parsePinnedBlenderVersion(output, lock) {
  const lines = String(output).replaceAll('\r', '').split('\n');
  assert(lines[0] === lock.blender.versionLabel, `Blender version mismatch: ${lines[0] || '<empty>'}`);
  const hashLine = lines.find((line) => line.trim().startsWith('build hash:'));
  assert(hashLine?.trim() === `build hash: ${lock.blender.buildHash}`, `Blender build hash mismatch: ${hashLine || '<missing>'}`);
  const platformLine = lines.find((line) => line.trim().startsWith('build platform:'));
  assert(platformLine?.trim() === `build platform: ${lock.blender.platform}`, `Blender platform mismatch: ${platformLine || '<missing>'}`);
  return { version: lock.blender.version, buildHash: lock.blender.buildHash };
}

export function verifyPackerLock(packageLock, installedVersion, lock) {
  assert(installedVersion === lock.packer.version, `sharp version mismatch: ${installedVersion}`);
  const entry = packageLock.packages?.['node_modules/sharp'];
  assert(entry?.version === lock.packer.version, `package-lock sharp version mismatch: ${entry?.version || '<missing>'}`);
  assert(entry?.integrity === lock.packer.integrity, `package-lock sharp integrity mismatch: ${entry?.integrity || '<missing>'}`);
}

export function assertRigInventory(inventory, lock) {
  assert(inventory.targetArmature === lock.rig.targetArmature, `target armature mismatch: ${inventory.targetArmature}`);
  assert(inventory.sourceArmature === lock.rig.sourceArmature, `source armature mismatch: ${inventory.sourceArmature}`);
  assert(JSON.stringify([...inventory.boneNames].sort()) === JSON.stringify(lock.rig.boneNames), 'rig bone names do not match the lock');
  for (const [state, expected] of Object.entries(lock.rig.actions)) {
    const actual = inventory.actions?.[state];
    assert(actual?.name === expected.name, `required action is missing for ${state}: ${expected.name}`);
    assert(Math.abs(actual.frameStart - expected.frameStart) < 0.0001, `action start mismatch for ${state}`);
    assert(Math.abs(actual.frameEnd - expected.frameEnd) < 0.0001, `action end mismatch for ${state}`);
  }
}

export function validateFrameRecords(frames) {
  const expected = createFrameRecords();
  assert(frames.length === expected.length, `frame record count mismatch: ${frames.length}`);
  const keys = new Set();
  for (let index = 0; index < expected.length; index += 1) {
    const actual = frames[index];
    const wanted = expected[index];
    assert(actual.key === wanted.key, `frame key/order mismatch at ${index}: ${actual.key}`);
    assert(actual.team === wanted.team && actual.state === wanted.state && actual.direction === wanted.direction, `frame metadata mismatch for ${wanted.key}`);
    assert(actual.index === wanted.index, `atlas index mismatch for ${wanted.key}`);
    assert(!keys.has(actual.key), `duplicate frame key: ${actual.key}`);
    keys.add(actual.key);
  }
}

export class JsonlStatusReporter {
  #sequence = 0;
  #state = null;
  #terminalCount = 0;
  #sink;

  constructor(sink = (line) => process.stdout.write(`${line}\n`)) {
    this.#sink = sink;
  }

  emit(state, stage, detail = {}) {
    const terminal = state === 'succeeded' || state === 'failed';
    assert(this.#terminalCount === 0, 'status emitted after terminal state');
    if (this.#state === null) {
      assert(state === 'queued', 'first status must be queued');
    } else if (state === 'starting') {
      assert(this.#state === 'queued', 'starting must follow queued');
    } else if (state === 'running') {
      assert(this.#state === 'starting' || this.#state === 'running', 'running must follow starting/running');
    } else if (terminal) {
      assert(this.#state === 'starting' || this.#state === 'running', 'terminal state must follow starting/running');
    } else {
      throw new ContractError(`unknown status state: ${state}`);
    }
    this.#sequence += 1;
    this.#state = state;
    if (terminal) this.#terminalCount += 1;
    this.#sink(
      JSON.stringify({
        schemaVersion: '1.0.0',
        component: 'actor-atlas',
        sequence: this.#sequence,
        state,
        stage,
        terminal,
        detail,
      }),
    );
  }

  get terminalCount() {
    return this.#terminalCount;
  }
}

export async function listRelativeFiles(directory) {
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.isFile()) files.push(path.relative(directory, entryPath).split(path.sep).join('/'));
      else throw new ContractError(`unsupported filesystem entry in release: ${entryPath}`);
    }
  }
  await visit(directory);
  return files.sort();
}

export async function compareDirectoriesByteForByte(first, second) {
  const firstFiles = await listRelativeFiles(first);
  const secondFiles = await listRelativeFiles(second);
  assert(JSON.stringify(firstFiles) === JSON.stringify(secondFiles), 'clean build file lists differ');
  const results = [];
  for (const relativePath of firstFiles) {
    const [firstBytes, secondBytes] = await Promise.all([
      readFile(path.join(first, relativePath)),
      readFile(path.join(second, relativePath)),
    ]);
    assert(firstBytes.equals(secondBytes), `clean build bytes differ: ${relativePath}`);
    results.push({ path: relativePath, bytes: firstBytes.length, sha256: sha256Bytes(firstBytes) });
  }
  return results;
}

export async function calculateGeneratorHash(rootPath, relativePaths) {
  const hash = createHash('sha256');
  for (const relativePath of [...relativePaths].sort()) {
    hash.update(`${relativePath}\0`);
    hash.update(await readFile(path.join(rootPath, relativePath)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export async function validateRelease(releaseDir, manifest, sharp) {
  validateFrameRecords(manifest.frames);
  assert(manifest.schemaVersion === BUILD_SPEC.schemaVersion, 'manifest schema version mismatch');
  assert(manifest.atlases.length === BUILD_SPEC.teams.length, `atlas count mismatch: ${manifest.atlases.length}`);
  assert(manifest.atlases.length <= BUILD_SPEC.atlas.maxCount, 'atlas count exceeds budget');

  let transferBytes = 0;
  for (let teamIndex = 0; teamIndex < BUILD_SPEC.teams.length; teamIndex += 1) {
    const team = BUILD_SPEC.teams[teamIndex];
    const atlas = manifest.atlases[teamIndex];
    assert(atlas.team === team, `atlas team order mismatch: ${atlas.team}`);
    const imagePath = assertPathInside(releaseDir, path.join(releaseDir, atlas.imagePath), 'atlas image');
    const jsonPath = assertPathInside(releaseDir, path.join(releaseDir, atlas.jsonPath), 'atlas JSON');
    const imageBytes = await readFile(imagePath);
    const jsonBytes = await readFile(jsonPath);
    assert(sha256Bytes(imageBytes) === atlas.imageSha256, `atlas image hash mismatch: ${atlas.imagePath}`);
    assert(sha256Bytes(jsonBytes) === atlas.jsonSha256, `atlas JSON hash mismatch: ${atlas.jsonPath}`);
    assert(imageBytes.length === atlas.transferBytes, `atlas transfer byte mismatch: ${atlas.imagePath}`);
    transferBytes += imageBytes.length + jsonBytes.length;

    const metadata = await sharp(imageBytes).metadata();
    assert(metadata.format === 'webp', `atlas format mismatch: ${atlas.imagePath}`);
    assert(metadata.width === BUILD_SPEC.atlas.width && metadata.height === BUILD_SPEC.atlas.height, `atlas dimensions mismatch: ${atlas.imagePath}`);
    const decoded = await sharp(imageBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert(decoded.info.channels === 4, `decoded atlas must be RGBA: ${atlas.imagePath}`);
    assert(decoded.info.width === BUILD_SPEC.atlas.width && decoded.info.height === BUILD_SPEC.atlas.height, `decoded atlas dimensions mismatch: ${atlas.imagePath}`);
    assert(sha256Bytes(decoded.data) === atlas.pixelSha256, `atlas pixel hash mismatch: ${atlas.imagePath}`);
    for (let offset = 0; offset < decoded.data.length; offset += 4) {
      if (decoded.data[offset + 3] === 0) {
        assert(
          decoded.data[offset] === 0 && decoded.data[offset + 1] === 0 && decoded.data[offset + 2] === 0,
          `transparent RGB is not canonical: ${atlas.imagePath}`,
        );
      }
    }

    const atlasJson = JSON.parse(jsonBytes.toString('utf8'));
    assert(atlasJson.meta?.image === atlas.imagePath, `Phaser JSON image mismatch: ${atlas.jsonPath}`);
    assert(atlasJson.meta?.mipmaps === false, `mipmaps must be disabled: ${atlas.jsonPath}`);
    const teamFrames = manifest.frames.filter((frame) => frame.team === team);
    assert(teamFrames.length === FRAMES_PER_TEAM, `manifest frame count mismatch for ${team}`);
    assert(Object.keys(atlasJson.frames || {}).length === FRAMES_PER_TEAM, `Phaser JSON frame count mismatch for ${team}`);
    for (const frame of teamFrames) {
      const jsonFrame = atlasJson.frames[frame.key];
      assert(jsonFrame, `Phaser JSON is missing ${frame.key}`);
      const expectedX = (frame.index % BUILD_SPEC.atlas.columns) * BUILD_SPEC.cell.width;
      const expectedY = Math.floor(frame.index / BUILD_SPEC.atlas.columns) * BUILD_SPEC.cell.height;
      assert(jsonFrame.frame?.x === expectedX && jsonFrame.frame?.y === expectedY, `frame coordinates mismatch for ${frame.key}`);
      assert(jsonFrame.frame?.w === BUILD_SPEC.cell.width && jsonFrame.frame?.h === BUILD_SPEC.cell.height, `frame size mismatch for ${frame.key}`);
    }
  }

  const gpuRgbaBytes = manifest.atlases.length * BUILD_SPEC.atlas.width * BUILD_SPEC.atlas.height * 4;
  assert(transferBytes === manifest.budgets.transferBytes, 'manifest transfer total mismatch');
  assert(gpuRgbaBytes === manifest.budgets.gpuRgbaBytes, 'manifest GPU total mismatch');
  assert(transferBytes <= BUILD_SPEC.budgets.transferBytes, `transfer budget exceeded: ${transferBytes}`);
  assert(gpuRgbaBytes <= BUILD_SPEC.budgets.gpuRgbaBytes, `GPU budget exceeded: ${gpuRgbaBytes}`);
  return { transferBytes, gpuRgbaBytes };
}

export async function promoteCompleteDirectory({ candidate, target, backup, rename = renameFs, rm = rmFs }) {
  const parent = path.dirname(path.resolve(target));
  const candidatePath = assertPathInside(parent, candidate, 'promotion candidate');
  const targetPath = assertPathInside(parent, target, 'promotion target');
  const backupPath = assertPathInside(parent, backup, 'promotion backup');
  assert(path.basename(candidatePath).startsWith('.actor-atlas-next-'), 'unexpected promotion candidate name');
  assert(path.basename(backupPath).startsWith('.actor-atlas-previous-'), 'unexpected promotion backup name');

  await access(candidatePath);
  let hadTarget = true;
  try {
    await access(targetPath);
  } catch {
    hadTarget = false;
  }
  if (hadTarget) await rename(targetPath, backupPath);
  try {
    await rename(candidatePath, targetPath);
  } catch (promotionError) {
    if (hadTarget) {
      try {
        await rename(backupPath, targetPath);
      } catch (rollbackError) {
        throw new AggregateError([promotionError, rollbackError], 'promotion failed and prior release could not be restored');
      }
    }
    throw promotionError;
  }
  if (hadTarget) await rm(backupPath, { recursive: true, force: false });
}
