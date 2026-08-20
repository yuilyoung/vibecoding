import { createHash } from 'node:crypto';
import { access, readFile, readdir, rename as renameFs, rm as rmFs, stat } from 'node:fs/promises';
import path from 'node:path';

import { WORLD_OBJECT_BUILD_SPEC, createWorldObjectFrameRecords } from './spec.mjs';

export class WorldObjectAtlasContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorldObjectAtlasContractError';
  }
}

export function assertContract(condition, message) {
  if (!condition) throw new WorldObjectAtlasContractError(message);
}

export const sha256Bytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const sha256File = async (filePath) => sha256Bytes(await readFile(filePath));

export function clearTransparentRgb(bytes, channels = 4) {
  assertContract(channels === 4 && bytes.length % channels === 0, 'RGBA byte contract mismatch');
  const result = Buffer.from(bytes);
  for (let offset = 0; offset < result.length; offset += channels) {
    if (result[offset + 3] === 0) {
      result[offset] = 0;
      result[offset + 1] = 0;
      result[offset + 2] = 0;
    }
  }
  return result;
}

export function assertPathInside(rootPath, candidatePath, label = 'path') {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);
  assertContract(relative !== '', `${label} must be a descendant of ${root}`);
  assertContract(!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative), `${label} escapes ${root}`);
  return candidate;
}

export async function verifySourceLock(projectRoot, lock) {
  assertContract(lock.schemaVersion === WORLD_OBJECT_BUILD_SPEC.schemaVersion, 'source lock schema mismatch');
  const expectedFrames = createWorldObjectFrameRecords();
  assertContract(lock.sources?.length === expectedFrames.length, 'source lock count mismatch');
  const records = [];
  for (let index = 0; index < expectedFrames.length; index += 1) {
    const expected = expectedFrames[index];
    const pinned = lock.sources[index];
    assertContract(pinned?.path === expected.sourcePath, `source lock order mismatch at ${index}`);
    const absolutePath = path.join(projectRoot, pinned.path);
    const fileStat = await stat(absolutePath).catch(() => null);
    assertContract(fileStat?.isFile() === true, `source file is missing: ${pinned.path}`);
    assertContract(fileStat.size === pinned.bytes, `source byte length mismatch: ${pinned.path}`);
    const actualHash = await sha256File(absolutePath);
    assertContract(actualHash === pinned.sha256, `source SHA-256 mismatch: ${pinned.path}`);
    records.push({ ...pinned, absolutePath });
  }
  const targetPath = path.join(projectRoot, lock.targetFrame.path);
  const targetStat = await stat(targetPath).catch(() => null);
  assertContract(targetStat?.isFile() === true && targetStat.size === lock.targetFrame.bytes, 'target-frame byte contract mismatch');
  assertContract(await sha256File(targetPath) === lock.targetFrame.sha256, 'target-frame SHA-256 mismatch');
  return records;
}

export function validateFrameRecords(frames) {
  const expected = createWorldObjectFrameRecords();
  assertContract(frames.length === expected.length, `frame count mismatch: ${frames.length}`);
  const keys = new Set();
  for (let index = 0; index < expected.length; index += 1) {
    const actual = frames[index];
    const wanted = expected[index];
    assertContract(actual.key === wanted.key, `frame key/order mismatch at ${index}`);
    assertContract(actual.family === wanted.family && actual.state === wanted.state, `frame metadata mismatch: ${wanted.key}`);
    assertContract(actual.index === wanted.index, `frame index mismatch: ${wanted.key}`);
    assertContract(!keys.has(actual.key), `duplicate frame key: ${actual.key}`);
    keys.add(actual.key);
  }
}

export async function listRelativeFiles(directory) {
  const files = [];
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.isFile()) files.push(path.relative(directory, entryPath).split(path.sep).join('/'));
      else throw new WorldObjectAtlasContractError(`unsupported release entry: ${entryPath}`);
    }
  };
  await visit(directory);
  return files.sort();
}

export async function compareDirectoriesByteForByte(first, second) {
  const firstFiles = await listRelativeFiles(first);
  const secondFiles = await listRelativeFiles(second);
  assertContract(JSON.stringify(firstFiles) === JSON.stringify(secondFiles), 'clean build file lists differ');
  const records = [];
  for (const relativePath of firstFiles) {
    const [firstBytes, secondBytes] = await Promise.all([
      readFile(path.join(first, relativePath)),
      readFile(path.join(second, relativePath)),
    ]);
    assertContract(firstBytes.equals(secondBytes), `clean build bytes differ: ${relativePath}`);
    records.push({ path: relativePath, bytes: firstBytes.length, sha256: sha256Bytes(firstBytes) });
  }
  return records;
}

export async function calculateGeneratorHash(toolDir, files) {
  const hash = createHash('sha256');
  for (const relativePath of [...files].sort()) {
    hash.update(`${relativePath}\0`);
    hash.update(await readFile(path.join(toolDir, relativePath)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export async function validateRelease(releaseDir, manifest, sharp) {
  assertContract(manifest.schemaVersion === WORLD_OBJECT_BUILD_SPEC.schemaVersion, 'manifest schema mismatch');
  assertContract(manifest.skinId === WORLD_OBJECT_BUILD_SPEC.skinId, 'manifest skin mismatch');
  validateFrameRecords(manifest.frames);
  const atlas = manifest.atlas;
  assertContract(atlas?.imagePath === 'map-objects.webp' && atlas?.jsonPath === 'map-objects.json', 'atlas paths mismatch');
  const imagePath = path.join(releaseDir, atlas.imagePath);
  const jsonPath = path.join(releaseDir, atlas.jsonPath);
  const manifestPath = path.join(releaseDir, 'manifest.json');
  const [imageBytes, jsonBytes, manifestBytes] = await Promise.all([
    readFile(imagePath), readFile(jsonPath), readFile(manifestPath),
  ]);
  assertContract(imageBytes.length === atlas.transferBytes, 'atlas image byte length mismatch');
  assertContract(jsonBytes.length === atlas.jsonTransferBytes, 'atlas JSON byte length mismatch');
  assertContract(sha256Bytes(imageBytes) === atlas.imageSha256, 'atlas image SHA-256 mismatch');
  assertContract(sha256Bytes(jsonBytes) === atlas.jsonSha256, 'atlas JSON SHA-256 mismatch');
  const metadata = await sharp(imageBytes).metadata();
  assertContract(metadata.format === 'webp', 'atlas format mismatch');
  assertContract(metadata.width === WORLD_OBJECT_BUILD_SPEC.atlas.width && metadata.height === WORLD_OBJECT_BUILD_SPEC.atlas.height, 'atlas dimensions mismatch');
  const decoded = await sharp(imageBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assertContract(decoded.info.channels === 4, 'decoded atlas is not RGBA');
  assertContract(sha256Bytes(decoded.data) === atlas.pixelSha256, 'atlas pixel SHA-256 mismatch');
  for (let offset = 0; offset < decoded.data.length; offset += 4) {
    if (decoded.data[offset + 3] === 0) {
      assertContract(decoded.data[offset] === 0 && decoded.data[offset + 1] === 0 && decoded.data[offset + 2] === 0, 'transparent RGB is not canonical');
    }
  }

  const atlasJson = JSON.parse(jsonBytes.toString('utf8'));
  assertContract(atlasJson.meta?.image === atlas.imagePath && atlasJson.meta?.mipmaps === false, 'Phaser atlas metadata mismatch');
  assertContract(atlasJson.meta?.size?.w === WORLD_OBJECT_BUILD_SPEC.atlas.width && atlasJson.meta?.size?.h === WORLD_OBJECT_BUILD_SPEC.atlas.height, 'Phaser atlas size mismatch');
  assertContract(Object.keys(atlasJson.frames ?? {}).length === manifest.frames.length, 'Phaser frame count mismatch');
  for (const frame of manifest.frames) {
    const record = atlasJson.frames[frame.key];
    const expectedX = frame.index % WORLD_OBJECT_BUILD_SPEC.atlas.columns * WORLD_OBJECT_BUILD_SPEC.cell.width;
    const expectedY = Math.floor(frame.index / WORLD_OBJECT_BUILD_SPEC.atlas.columns) * WORLD_OBJECT_BUILD_SPEC.cell.height;
    assertContract(record?.frame?.x === expectedX && record?.frame?.y === expectedY, `Phaser frame coordinates mismatch: ${frame.key}`);
    assertContract(record?.frame?.w === WORLD_OBJECT_BUILD_SPEC.cell.width && record?.frame?.h === WORLD_OBJECT_BUILD_SPEC.cell.height, `Phaser frame size mismatch: ${frame.key}`);
  }

  const transferBytes = imageBytes.length + jsonBytes.length + manifestBytes.length;
  const gpuRgbaBytes = metadata.width * metadata.height * 4;
  assertContract(manifest.budgets.transferBytes === transferBytes, 'manifest total transfer mismatch');
  assertContract(manifest.budgets.transferLimitBytes === WORLD_OBJECT_BUILD_SPEC.budgets.transferBytes, 'manifest transfer limit mismatch');
  assertContract(transferBytes <= manifest.budgets.transferLimitBytes, `transfer budget exceeded: ${transferBytes}`);
  assertContract(manifest.budgets.gpuRgbaBytes === gpuRgbaBytes, 'manifest GPU estimate mismatch');
  assertContract(manifest.budgets.gpuRgbaLimitBytes === WORLD_OBJECT_BUILD_SPEC.budgets.gpuRgbaBytes, 'manifest GPU limit mismatch');
  assertContract(gpuRgbaBytes <= manifest.budgets.gpuRgbaLimitBytes, `GPU budget exceeded: ${gpuRgbaBytes}`);
  assertContract(manifest.budgets.mipmaps === false, 'mipmaps must be disabled');
  return { transferBytes, gpuRgbaBytes };
}

export async function promoteCompleteDirectory({ candidate, target, backup, rename = renameFs, rm = rmFs }) {
  const parent = path.dirname(path.resolve(target));
  const candidatePath = assertPathInside(parent, candidate, 'promotion candidate');
  const targetPath = assertPathInside(parent, target, 'promotion target');
  const backupPath = assertPathInside(parent, backup, 'promotion backup');
  assertContract(path.basename(candidatePath).startsWith('.world-object-next-'), 'unexpected candidate name');
  assertContract(path.basename(backupPath).startsWith('.world-object-previous-'), 'unexpected backup name');
  await access(candidatePath);
  let hadTarget = true;
  try { await access(targetPath); } catch { hadTarget = false; }
  if (hadTarget) await rename(targetPath, backupPath);
  try {
    await rename(candidatePath, targetPath);
  } catch (promotionError) {
    if (hadTarget) {
      try { await rename(backupPath, targetPath); }
      catch (rollbackError) { throw new AggregateError([promotionError, rollbackError], 'promotion and rollback failed'); }
    }
    throw promotionError;
  }
  if (hadTarget) await rm(backupPath, { recursive: true, force: false });
}
