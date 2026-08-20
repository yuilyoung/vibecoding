import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

const TRANSPARENT_THRESHOLD = 12;
const OPAQUE_THRESHOLD = 220;
const KEY_DOMINANCE_THRESHOLD = 16;
const ALPHA_NOISE_FLOOR = 8;

const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
const smoothstep = (value) => {
  const normalized = Math.max(0, Math.min(1, value));
  return normalized * normalized * (3 - 2 * normalized);
};

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

function sampleBorderKey(data, width, height, channels) {
  const samples = [[], [], []];
  const band = Math.max(1, Math.min(width, height, 6));
  const step = Math.max(1, Math.floor(Math.min(width, height) / 256));
  const sample = (x, y) => {
    const offset = (y * width + x) * channels;
    for (let channel = 0; channel < 3; channel += 1) samples[channel].push(data[offset + channel]);
  };
  for (let x = 0; x < width; x += step) {
    for (let y = 0; y < band; y += 1) {
      sample(x, y);
      sample(x, height - 1 - y);
    }
  }
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < band; x += 1) {
      sample(x, y);
      sample(width - 1 - x, y);
    }
  }
  return samples.map((channel) => Math.round(median(channel)));
}

function softAlpha(distance) {
  if (distance <= TRANSPARENT_THRESHOLD) return 0;
  if (distance >= OPAQUE_THRESHOLD) return 255;
  return clamp(255 * smoothstep((distance - TRANSPARENT_THRESHOLD) /
    (OPAQUE_THRESHOLD - TRANSPARENT_THRESHOLD)));
}

function dominanceAlpha(red, green, blue, key) {
  const nonKeyStrength = Math.max(red, blue);
  const dominance = green - nonKeyStrength;
  if (dominance <= 0) return 255;
  const denominator = Math.max(1, key[1] - nonKeyStrength);
  return clamp((1 - Math.min(1, dominance / denominator)) * 255);
}

export async function removeGreenChroma(inputPath, outputPath) {
  const decoded = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = decoded.info;
  if (channels !== 4) throw new Error(`Expected RGBA input: ${inputPath}`);
  const key = sampleBorderKey(decoded.data, width, height, channels);
  if (key[1] - Math.max(key[0], key[2]) < 128) {
    throw new Error(`Border is not a dominant green chroma key: ${inputPath} (${key.join(',')})`);
  }

  const output = Buffer.from(decoded.data);
  let transparent = 0;
  let partial = 0;
  let visible = 0;
  for (let offset = 0; offset < output.length; offset += 4) {
    let red = output[offset];
    let green = output[offset + 1];
    let blue = output[offset + 2];
    const sourceAlpha = output[offset + 3];
    const distance = Math.max(
      Math.abs(red - key[0]),
      Math.abs(green - key[1]),
      Math.abs(blue - key[2]),
    );
    const dominance = green - Math.max(red, blue);
    const keyLike = distance <= 32 || dominance >= KEY_DOMINANCE_THRESHOLD;
    let alpha = keyLike
      ? Math.min(softAlpha(distance), dominanceAlpha(red, green, blue, key))
      : (distance <= TRANSPARENT_THRESHOLD ? 0 : 255);
    alpha = clamp(alpha * sourceAlpha / 255);
    if (alpha > 0 && alpha <= ALPHA_NOISE_FLOOR) alpha = 0;
    if (alpha === 0) {
      output[offset] = 0;
      output[offset + 1] = 0;
      output[offset + 2] = 0;
      output[offset + 3] = 0;
      transparent += 1;
      continue;
    }
    if (keyLike && alpha < 252) {
      green = Math.min(green, Math.max(red, blue) - 1);
    }
    output[offset] = red;
    output[offset + 1] = Math.max(0, green);
    output[offset + 2] = blue;
    output[offset + 3] = alpha;
    visible += 1;
    if (alpha < 255) partial += 1;
  }

  const total = width * height;
  const coverage = visible / total;
  if (transparent === 0 || coverage < 0.03 || coverage > 0.75) {
    throw new Error(`Implausible subject coverage for ${inputPath}: ${coverage.toFixed(4)}`);
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(output, { raw: { width, height, channels } }).png().toFile(outputPath);
  return { key, width, height, transparent, partial, visible, coverage };
}

export async function processDirectory(inputDir, outputDir) {
  const files = (await readdir(inputDir)).filter((name) => name.endsWith('.png')).sort();
  if (files.length !== 12) throw new Error(`Expected 12 chroma sources, found ${files.length}`);
  const results = [];
  for (const file of files) {
    results.push({ file, ...(await removeGreenChroma(path.join(inputDir, file), path.join(outputDir, file))) });
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.slice(1))) {
  const [inputDir, outputDir] = process.argv.slice(2);
  if (!inputDir || !outputDir) throw new Error('Usage: node chroma-source.mjs <input-dir> <output-dir>');
  processDirectory(path.resolve(inputDir), path.resolve(outputDir))
    .then((results) => process.stdout.write(`${JSON.stringify(results, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.stack ?? error.message ?? String(error)}\n`);
      process.exitCode = 1;
    });
}
