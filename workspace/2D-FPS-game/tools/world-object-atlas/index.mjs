import { randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
  assertContract,
  assertPathInside,
  calculateGeneratorHash,
  clearTransparentRgb,
  compareDirectoriesByteForByte,
  promoteCompleteDirectory,
  sha256Bytes,
  validateFrameRecords,
  validateRelease,
  verifySourceLock,
} from './lib.mjs';
import { WORLD_OBJECT_BUILD_SPEC, createWorldObjectFrameRecords } from './spec.mjs';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TOOL_DIR, '..', '..');
const WORK_ROOT = path.join(TOOL_DIR, '.work');
const OUTPUT_PARENT = path.join(PROJECT_ROOT, 'public', 'assets', 'runtime', 'world');
const OUTPUT_DIR = path.join(OUTPUT_PARENT, 'product-v1');
const GENERATOR_FILES = Object.freeze(['chroma-source.mjs', 'index.mjs', 'lib.mjs', 'source-lock.json', 'spec.mjs']);

const writeJson = async (filePath, value) => writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);

function createPhaserAtlas(frames) {
  const records = {};
  for (const frame of frames) {
    const x = frame.index % WORLD_OBJECT_BUILD_SPEC.atlas.columns * WORLD_OBJECT_BUILD_SPEC.cell.width;
    const y = Math.floor(frame.index / WORLD_OBJECT_BUILD_SPEC.atlas.columns) * WORLD_OBJECT_BUILD_SPEC.cell.height;
    records[frame.key] = {
      frame: { x, y, w: WORLD_OBJECT_BUILD_SPEC.cell.width, h: WORLD_OBJECT_BUILD_SPEC.cell.height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: WORLD_OBJECT_BUILD_SPEC.cell.width, h: WORLD_OBJECT_BUILD_SPEC.cell.height },
      sourceSize: { w: WORLD_OBJECT_BUILD_SPEC.cell.width, h: WORLD_OBJECT_BUILD_SPEC.cell.height },
    };
  }
  return {
    frames: records,
    meta: {
      app: 'world-object-atlas', version: WORLD_OBJECT_BUILD_SPEC.schemaVersion,
      image: 'map-objects.webp', format: 'RGBA8888',
      size: { w: WORLD_OBJECT_BUILD_SPEC.atlas.width, h: WORLD_OBJECT_BUILD_SPEC.atlas.height },
      scale: '1', mipmaps: false,
    },
  };
}

async function createFrameCell(sourcePath, family) {
  const trimmed = await sharp(sourcePath)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
    .resize({ width: family.content.width, height: family.content.height, fit: 'inside', withoutEnlargement: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = clearTransparentRgb(trimmed.data, trimmed.info.channels);
  const shadowPixels = Buffer.alloc(pixels.length);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    shadowPixels[offset] = WORLD_OBJECT_BUILD_SPEC.shadow.red;
    shadowPixels[offset + 1] = WORLD_OBJECT_BUILD_SPEC.shadow.green;
    shadowPixels[offset + 2] = WORLD_OBJECT_BUILD_SPEC.shadow.blue;
    shadowPixels[offset + 3] = Math.round(pixels[offset + 3] * WORLD_OBJECT_BUILD_SPEC.shadow.opacity);
  }
  const raw = { width: trimmed.info.width, height: trimmed.info.height, channels: 4 };
  const subject = await sharp(pixels, { raw }).png().toBuffer();
  const shadow = await sharp(shadowPixels, { raw }).blur(WORLD_OBJECT_BUILD_SPEC.shadow.blur).png().toBuffer();
  const baseLeft = Math.floor((WORLD_OBJECT_BUILD_SPEC.cell.width - trimmed.info.width) / 2);
  const baseTop = Math.floor((WORLD_OBJECT_BUILD_SPEC.cell.height - trimmed.info.height) / 2) - 3;
  const cell = await sharp({
    create: {
      width: WORLD_OBJECT_BUILD_SPEC.cell.width,
      height: WORLD_OBJECT_BUILD_SPEC.cell.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([
    { input: shadow, left: baseLeft + WORLD_OBJECT_BUILD_SPEC.shadow.offsetX, top: baseTop + WORLD_OBJECT_BUILD_SPEC.shadow.offsetY },
    { input: subject, left: baseLeft, top: baseTop },
  ]).raw().toBuffer({ resolveWithObject: true });
  return sharp(clearTransparentRgb(cell.data, cell.info.channels), {
    raw: { width: cell.info.width, height: cell.info.height, channels: cell.info.channels },
  }).png().toBuffer();
}

function serializeManifestWithTransferTotal(base, payloadBytes) {
  let transferBytes = 0;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const manifest = { ...base, budgets: { ...base.budgets, transferBytes } };
    const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    const next = payloadBytes + bytes.length;
    if (next === transferBytes) return { manifest, bytes };
    transferBytes = next;
  }
  throw new Error('Manifest transfer total did not converge');
}

export async function runCleanBuild(label, runDir, context) {
  const releaseDir = assertPathInside(runDir, path.join(runDir, label, 'release'), `clean build ${label}`);
  await mkdir(releaseDir, { recursive: true });
  sharp.cache(false);
  sharp.concurrency(1);
  const frames = createWorldObjectFrameRecords();
  validateFrameRecords(frames);
  const cells = [];
  for (const frame of frames) {
    const family = WORLD_OBJECT_BUILD_SPEC.families.find((entry) => entry.id === frame.family);
    assertContract(family !== undefined, `missing family spec: ${frame.family}`);
    const source = context.sources[frame.index];
    cells.push({
      input: await createFrameCell(source.absolutePath, family),
      left: frame.index % WORLD_OBJECT_BUILD_SPEC.atlas.columns * WORLD_OBJECT_BUILD_SPEC.cell.width,
      top: Math.floor(frame.index / WORLD_OBJECT_BUILD_SPEC.atlas.columns) * WORLD_OBJECT_BUILD_SPEC.cell.height,
    });
  }
  const composite = await sharp({
    create: {
      width: WORLD_OBJECT_BUILD_SPEC.atlas.width,
      height: WORLD_OBJECT_BUILD_SPEC.atlas.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(cells).raw().toBuffer({ resolveWithObject: true });
  const normalized = clearTransparentRgb(composite.data, composite.info.channels);
  const imagePath = path.join(releaseDir, 'map-objects.webp');
  const jsonPath = path.join(releaseDir, 'map-objects.json');
  await sharp(normalized, {
    raw: { width: composite.info.width, height: composite.info.height, channels: composite.info.channels },
  }).webp({ lossless: true, nearLossless: false, smartSubsample: false, smartDeblock: false, effort: 6, alphaQuality: 100, exact: true }).toFile(imagePath);
  await writeJson(jsonPath, createPhaserAtlas(frames));
  const [imageBytes, jsonBytes] = await Promise.all([readFile(imagePath), readFile(jsonPath)]);
  const manifestBase = {
    schemaVersion: WORLD_OBJECT_BUILD_SPEC.schemaVersion,
    skinId: WORLD_OBJECT_BUILD_SPEC.skinId,
    targetFrame: context.lock.targetFrame,
    generator: {
      id: context.lock.generator,
      generatedAt: context.lock.generatedAt,
      sharpVersion: sharp.versions.sharp,
      scriptSha256: context.generatorHash,
    },
    sources: context.sources.map(({ absolutePath: _absolutePath, ...source }) => source),
    frames: frames.map(({ sourcePath: _sourcePath, ...frame }) => frame),
    atlas: {
      textureKey: 'world-product-v1', imagePath: 'map-objects.webp', jsonPath: 'map-objects.json',
      width: WORLD_OBJECT_BUILD_SPEC.atlas.width, height: WORLD_OBJECT_BUILD_SPEC.atlas.height,
      imageSha256: sha256Bytes(imageBytes), jsonSha256: sha256Bytes(jsonBytes), pixelSha256: sha256Bytes(normalized),
      transferBytes: imageBytes.length, jsonTransferBytes: jsonBytes.length,
    },
    budgets: {
      transferBytes: 0,
      transferLimitBytes: WORLD_OBJECT_BUILD_SPEC.budgets.transferBytes,
      gpuRgbaBytes: WORLD_OBJECT_BUILD_SPEC.atlas.width * WORLD_OBJECT_BUILD_SPEC.atlas.height * 4,
      gpuRgbaLimitBytes: WORLD_OBJECT_BUILD_SPEC.budgets.gpuRgbaBytes,
      mipmaps: false,
    },
  };
  const serialized = serializeManifestWithTransferTotal(manifestBase, imageBytes.length + jsonBytes.length);
  await writeFile(path.join(releaseDir, 'manifest.json'), serialized.bytes);
  await validateRelease(releaseDir, serialized.manifest, sharp);
  return { releaseDir, manifest: serialized.manifest };
}

export async function generateWorldObjectAtlas() {
  const token = `${process.pid}-${randomUUID()}`;
  const runDir = assertPathInside(WORK_ROOT, path.join(WORK_ROOT, `run-${token}`), 'run staging');
  const candidate = assertPathInside(OUTPUT_PARENT, path.join(OUTPUT_PARENT, `.world-object-next-${token}`), 'promotion candidate');
  const backup = assertPathInside(OUTPUT_PARENT, path.join(OUTPUT_PARENT, `.world-object-previous-${token}`), 'promotion backup');
  const emit = (state, stage, detail = {}) => process.stdout.write(`${JSON.stringify({ schemaVersion: '1.0.0', component: 'world-object-atlas', state, stage, detail })}\n`);
  emit('queued', 'contract');
  try {
    const lock = JSON.parse(await readFile(path.join(TOOL_DIR, 'source-lock.json'), 'utf8'));
    const sources = await verifySourceLock(PROJECT_ROOT, lock);
    const generatorHash = await calculateGeneratorHash(TOOL_DIR, GENERATOR_FILES);
    const context = { lock, sources, generatorHash };
    await mkdir(runDir, { recursive: true });
    emit('running', 'clean-build-a');
    const first = await runCleanBuild('clean-a', runDir, context);
    emit('running', 'clean-build-b');
    const second = await runCleanBuild('clean-b', runDir, context);
    const reproducibility = await compareDirectoriesByteForByte(first.releaseDir, second.releaseDir);
    await mkdir(OUTPUT_PARENT, { recursive: true });
    await rm(candidate, { recursive: true, force: true });
    await rm(backup, { recursive: true, force: true });
    await cp(second.releaseDir, candidate, { recursive: true, errorOnExist: true, force: false });
    await compareDirectoriesByteForByte(second.releaseDir, candidate);
    emit('running', 'atomic-promotion');
    await promoteCompleteDirectory({ candidate, target: OUTPUT_DIR, backup });
    await compareDirectoriesByteForByte(second.releaseDir, OUTPUT_DIR);
    await validateRelease(OUTPUT_DIR, second.manifest, sharp);
    await rm(runDir, { recursive: true, force: false });
    emit('succeeded', 'completed', { files: reproducibility, budgets: second.manifest.budgets });
    return second.manifest;
  } catch (error) {
    await rm(runDir, { recursive: true, force: true }).catch(() => {});
    await rm(candidate, { recursive: true, force: true }).catch(() => {});
    emit('failed', 'terminal-error', { name: error?.name ?? 'Error', message: error?.message ?? String(error) });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateWorldObjectAtlas().catch(() => { process.exitCode = 1; });
}
