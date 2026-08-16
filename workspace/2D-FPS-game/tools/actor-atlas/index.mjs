import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  cp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
  ContractError,
  JsonlStatusReporter,
  assert,
  assertPathInside,
  calculateGeneratorHash,
  clearTransparentRgb,
  compareDirectoriesByteForByte,
  listRelativeFiles,
  parsePinnedBlenderVersion,
  promoteCompleteDirectory,
  sha256Bytes,
  validateFrameRecords,
  validateRelease,
  verifyPackerLock,
  verifyPinnedFile,
} from './lib.mjs';
import {
  BUILD_SPEC,
  DIRECTION_ANGLES_DEGREES,
  FRAMES_PER_TEAM,
  SOURCE_INPUTS,
  TEAM_PALETTES,
  createFrameRecords,
} from './spec.mjs';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TOOL_DIR, '..', '..');
const WORK_ROOT = path.join(TOOL_DIR, '.work');
const OUTPUT_PARENT = path.join(PROJECT_ROOT, 'public', 'assets', 'runtime');
const OUTPUT_DIR = path.join(OUTPUT_PARENT, 'actors');
const GENERATOR_FILES = Object.freeze([
  'blender-lock.json',
  'blender/render.py',
  'index.mjs',
  'lib.mjs',
  'spec.mjs',
]);
const require = createRequire(import.meta.url);

function appendTail(current, chunk, maximum = 65_536) {
  const combined = current + chunk.toString('utf8');
  return combined.length <= maximum ? combined : combined.slice(-maximum);
}

export async function runProcess(executable, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd || PROJECT_ROOT,
      env: options.env || process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout = appendTail(stdout, chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr = appendTail(stderr, chunk);
    });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code !== 0) {
        reject(
          new ContractError(
            `process failed (${code ?? signal}): ${executable}\nstdout tail:\n${stdout}\nstderr tail:\n${stderr}`,
          ),
        );
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function verifyToolchain(lock) {
  assert(process.platform === 'win32' && process.arch === 'x64', `unsupported platform: ${process.platform}/${process.arch}`);
  const archivePath = assertPathInside(TOOL_DIR, path.resolve(TOOL_DIR, lock.blender.archivePath), 'Blender archive');
  const executablePath = assertPathInside(TOOL_DIR, path.resolve(TOOL_DIR, lock.blender.executablePath), 'Blender executable');
  await verifyPinnedFile(archivePath, {
    bytes: lock.blender.archiveBytes,
    sha256: lock.blender.archiveSha256,
  });
  await verifyPinnedFile(executablePath, { sha256: lock.blender.executableSha256 });
  const versionResult = await runProcess(executablePath, ['--version']);
  parsePinnedBlenderVersion(versionResult.stdout, lock);

  const packageLock = await readJson(path.join(PROJECT_ROOT, 'package-lock.json'));
  const sharpEntryPath = require.resolve('sharp');
  const installedSharpVersion = (await readJson(path.resolve(path.dirname(sharpEntryPath), '..', 'package.json'))).version;
  verifyPackerLock(packageLock, installedSharpVersion, lock);

  const verifiedSources = [];
  for (const source of SOURCE_INPUTS) {
    const sourcePath = assertPathInside(PROJECT_ROOT, path.resolve(PROJECT_ROOT, source.path), `${source.id} source`);
    const verified = await verifyPinnedFile(sourcePath, source);
    verifiedSources.push({ ...source, absolutePath: sourcePath, ...verified });
  }
  return { archivePath, executablePath, sources: verifiedSources };
}

function createPhaserAtlas(team, imagePath, frames) {
  const atlasFrames = {};
  for (const frame of frames) {
    const x = (frame.index % BUILD_SPEC.atlas.columns) * BUILD_SPEC.cell.width;
    const y = Math.floor(frame.index / BUILD_SPEC.atlas.columns) * BUILD_SPEC.cell.height;
    atlasFrames[frame.key] = {
      frame: { x, y, w: BUILD_SPEC.cell.width, h: BUILD_SPEC.cell.height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: BUILD_SPEC.cell.width, h: BUILD_SPEC.cell.height },
      sourceSize: { w: BUILD_SPEC.cell.width, h: BUILD_SPEC.cell.height },
    };
  }
  return {
    frames: atlasFrames,
    meta: {
      app: 'actor-atlas',
      version: BUILD_SPEC.schemaVersion,
      image: imagePath,
      format: 'RGBA8888',
      size: { w: BUILD_SPEC.atlas.width, h: BUILD_SPEC.atlas.height },
      scale: '1',
      mipmaps: false,
      team,
    },
  };
}

export async function packTeamAtlas(team, renderDir, releaseDir) {
  const frames = createFrameRecords().filter((frame) => frame.team === team);
  assert(frames.length === FRAMES_PER_TEAM, `render frame count mismatch for ${team}`);
  const composites = [];
  for (const frame of frames) {
    const input = path.join(renderDir, team.toLowerCase(), `${String(frame.index).padStart(3, '0')}.png`);
    const inputStat = await stat(input);
    assert(inputStat.isFile() && inputStat.size > 0, `render frame is missing or empty: ${input}`);
    const metadata = await sharp(input).metadata();
    assert(metadata.width === BUILD_SPEC.cell.width && metadata.height === BUILD_SPEC.cell.height, `render frame dimensions mismatch: ${input}`);
    composites.push({
      input,
      left: (frame.index % BUILD_SPEC.atlas.columns) * BUILD_SPEC.cell.width,
      top: Math.floor(frame.index / BUILD_SPEC.atlas.columns) * BUILD_SPEC.cell.height,
    });
  }

  const teamSlug = team.toLowerCase();
  const imagePath = `actor-${teamSlug}.webp`;
  const jsonPath = `actor-${teamSlug}.json`;
  const absoluteImagePath = path.join(releaseDir, imagePath);
  const absoluteJsonPath = path.join(releaseDir, jsonPath);
  const composite = await sharp({
    create: {
      width: BUILD_SPEC.atlas.width,
      height: BUILD_SPEC.atlas.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert(composite.info.channels === 4, `atlas composite must be RGBA for ${team}`);
  const normalizedPixels = clearTransparentRgb(composite.data, composite.info.channels);
  const pixelSha256 = sha256Bytes(normalizedPixels);
  await sharp(normalizedPixels, {
    raw: {
      width: composite.info.width,
      height: composite.info.height,
      channels: composite.info.channels,
    },
  })
    .webp({
      lossless: true,
      nearLossless: false,
      smartSubsample: false,
      smartDeblock: false,
      effort: 6,
      alphaQuality: 100,
      exact: true,
      preset: 'default',
    })
    .toFile(absoluteImagePath);
  await writeJson(absoluteJsonPath, createPhaserAtlas(team, imagePath, frames));

  const [imageBytes, jsonBytes] = await Promise.all([
    readFile(absoluteImagePath),
    readFile(absoluteJsonPath),
  ]);
  return {
    team,
    imagePath,
    jsonPath,
    imageSha256: sha256Bytes(imageBytes),
    pixelSha256,
    jsonSha256: sha256Bytes(jsonBytes),
    transferBytes: imageBytes.length,
    jsonTransferBytes: jsonBytes.length,
  };
}

function manifestSource(source) {
  return {
    id: source.id,
    officialUrl: source.officialUrl,
    acquiredAt: source.acquiredAt,
    license: source.license,
    sha256: source.sha256,
  };
}

export async function runCleanBuild(label, runDir, context) {
  const buildDir = assertPathInside(runDir, path.join(runDir, label), `clean build ${label}`);
  const inputDir = path.join(buildDir, 'input');
  const renderDir = path.join(buildDir, 'render');
  const releaseDir = path.join(buildDir, 'release');
  await mkdir(releaseDir, { recursive: true });

  const frames = createFrameRecords();
  validateFrameRecords(frames);
  const config = {
    schemaVersion: BUILD_SPEC.schemaVersion,
    spec: BUILD_SPEC,
    directionAnglesDegrees: DIRECTION_ANGLES_DEGREES,
    palettes: TEAM_PALETTES,
    lock: context.lock,
    inputDir,
    outputDir: renderDir,
    sources: context.toolchain.sources.map((source) => ({
      id: source.id,
      path: source.absolutePath,
      entries: source.entries,
      aliases: source.aliases,
    })),
    frames,
  };
  const configPath = path.join(buildDir, 'render-config.json');
  await writeJson(configPath, config);

  const result = await runProcess(context.toolchain.executablePath, [
    '--background',
    '--factory-startup',
    '--python',
    path.join(TOOL_DIR, 'blender', 'render.py'),
    '--',
    '--config',
    configPath,
  ]);
  assert(result.stdout.includes('ACTOR_ATLAS_RENDER='), `Blender success marker is missing for ${label}`);

  sharp.cache(false);
  sharp.concurrency(1);
  const atlases = [];
  for (const team of BUILD_SPEC.teams) {
    atlases.push(await packTeamAtlas(team, renderDir, releaseDir));
  }
  const transferBytes = atlases.reduce((sum, atlas) => sum + atlas.transferBytes + atlas.jsonTransferBytes, 0);
  const gpuRgbaBytes = atlases.length * BUILD_SPEC.atlas.width * BUILD_SPEC.atlas.height * 4;
  const manifest = {
    schemaVersion: BUILD_SPEC.schemaVersion,
    source: context.toolchain.sources.map(manifestSource),
    generator: {
      blenderVersion: context.lock.blender.version,
      blenderSha256: context.lock.blender.executableSha256,
      blenderArchiveSha256: context.lock.blender.archiveSha256,
      blenderBuildHash: context.lock.blender.buildHash,
      sharpVersion: context.lock.packer.version,
      sharpIntegrity: context.lock.packer.integrity,
      scriptSha256: context.generatorHash,
    },
    frames: frames.map(({ key, team, state, direction, index }) => ({ key, team, state, direction, index })),
    atlases: atlases.map(({ jsonTransferBytes: _jsonTransferBytes, ...atlas }) => atlas),
    budgets: {
      transferBytes,
      transferLimitBytes: BUILD_SPEC.budgets.transferBytes,
      gpuRgbaBytes,
      gpuRgbaLimitBytes: BUILD_SPEC.budgets.gpuRgbaBytes,
      mipmaps: false,
    },
  };
  await writeJson(path.join(releaseDir, 'manifest.json'), manifest);
  await validateRelease(releaseDir, manifest, sharp);
  const releaseFiles = await listRelativeFiles(releaseDir);
  assert(
    JSON.stringify(releaseFiles) === JSON.stringify(['actor-blue.json', 'actor-blue.webp', 'actor-red.json', 'actor-red.webp', 'manifest.json']),
    `unexpected release file set: ${releaseFiles.join(', ')}`,
  );
  return { releaseDir, manifest };
}

export async function generateActorAtlases(reporter = new JsonlStatusReporter()) {
  const runToken = `${process.pid}-${randomUUID()}`;
  const runDir = assertPathInside(WORK_ROOT, path.join(WORK_ROOT, `run-${runToken}`), 'run staging');
  const candidate = assertPathInside(OUTPUT_PARENT, path.join(OUTPUT_PARENT, `.actor-atlas-next-${runToken}`), 'promotion candidate');
  const backup = assertPathInside(OUTPUT_PARENT, path.join(OUTPUT_PARENT, `.actor-atlas-previous-${runToken}`), 'promotion backup');
  reporter.emit('queued', 'contract');
  try {
    reporter.emit('starting', 'toolchain');
    const lock = await readJson(path.join(TOOL_DIR, 'blender-lock.json'));
    const toolchain = await verifyToolchain(lock);
    const generatorHash = await calculateGeneratorHash(TOOL_DIR, GENERATOR_FILES);
    const context = { lock, toolchain, generatorHash };
    await mkdir(runDir, { recursive: true });

    reporter.emit('running', 'clean-build-a', { frames: createFrameRecords().length });
    const first = await runCleanBuild('clean-a', runDir, context);
    reporter.emit('running', 'clean-build-b', { frames: createFrameRecords().length });
    const second = await runCleanBuild('clean-b', runDir, context);

    reporter.emit('running', 'byte-comparison');
    const reproducibility = await compareDirectoriesByteForByte(first.releaseDir, second.releaseDir);
    await mkdir(OUTPUT_PARENT, { recursive: true });
    await rm(candidate, { recursive: true, force: true });
    await rm(backup, { recursive: true, force: true });
    await cp(second.releaseDir, candidate, { recursive: true, errorOnExist: true, force: false });
    await compareDirectoriesByteForByte(second.releaseDir, candidate);

    reporter.emit('running', 'promotion');
    await promoteCompleteDirectory({ candidate, target: OUTPUT_DIR, backup });
    await compareDirectoriesByteForByte(second.releaseDir, OUTPUT_DIR);
    await validateRelease(OUTPUT_DIR, second.manifest, sharp);
    await rm(runDir, { recursive: true, force: false });
    reporter.emit('succeeded', 'completed', {
      files: reproducibility,
      transferBytes: second.manifest.budgets.transferBytes,
      gpuRgbaBytes: second.manifest.budgets.gpuRgbaBytes,
    });
    return second.manifest;
  } catch (error) {
    await rm(runDir, { recursive: true, force: true }).catch(() => {});
    await rm(candidate, { recursive: true, force: true }).catch(() => {});
    reporter.emit('failed', 'terminal-error', {
      name: error?.name || 'Error',
      message: error?.message || String(error),
    });
    throw error;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  generateActorAtlases().catch(() => {
    process.exitCode = 1;
  });
}
