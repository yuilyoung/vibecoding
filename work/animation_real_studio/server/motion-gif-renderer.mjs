import sharp from "sharp";

const OUTPUT_WIDTH = 432;
const OUTPUT_HEIGHT = 768;
const FRAME_RATE = 10;
const MIN_FRAME_COUNT = 2;
const MAX_FRAME_COUNT = 30;
const MAX_GIF_BYTES = 12 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 12_000_000;

export class MotionGifRendererError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function isNineBySixteen(width, height) {
  return Number.isInteger(width) && Number.isInteger(height) && Math.abs(((width / height) / (9 / 16)) - 1) <= 0.001;
}

function boundedFrameCount(frameCount) {
  return Number.isInteger(frameCount) && frameCount >= MIN_FRAME_COUNT && frameCount <= MAX_FRAME_COUNT;
}

function cropForFrame(sourceWidth, sourceHeight, frameIndex, frameCount) {
  const progress = frameCount === 1 ? 0 : frameIndex / (frameCount - 1);
  const zoom = 1 + (0.06 * progress);
  const cropWidth = Math.floor(sourceWidth / zoom);
  const cropHeight = Math.floor(sourceHeight / zoom);
  const horizontalTravel = Math.max(0, sourceWidth - cropWidth);
  const verticalTravel = Math.max(0, sourceHeight - cropHeight);
  const left = Math.round((horizontalTravel * (0.5 + ((progress - 0.5) * 0.55))));
  const top = Math.round((verticalTravel * (0.5 + ((0.5 - progress) * 0.35))));
  return {
    left: Math.max(0, Math.min(horizontalTravel, left)),
    top: Math.max(0, Math.min(verticalTravel, top)),
    width: cropWidth,
    height: cropHeight,
  };
}

export class MotionGifRenderer {
  constructor({ sharpModule = sharp, width = OUTPUT_WIDTH, height = OUTPUT_HEIGHT, fps = FRAME_RATE, maxBytes = MAX_GIF_BYTES } = {}) {
    this.sharp = sharpModule;
    this.width = width;
    this.height = height;
    this.fps = fps;
    this.maxBytes = maxBytes;
  }

  async render({ sourceBytes, frameCount, onFrame = () => {} } = {}) {
    if (!Buffer.isBuffer(sourceBytes) || !sourceBytes.length) throw new MotionGifRendererError("gif_source_invalid", "A valid generated PNG is required for motion GIF encoding.");
    if (!boundedFrameCount(frameCount)) throw new MotionGifRendererError("gif_frame_count", "Motion GIF frame count must be between 2 and 30.");
    let source;
    try {
      source = await this.sharp(sourceBytes, { limitInputPixels: MAX_SOURCE_PIXELS }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    } catch {
      throw new MotionGifRendererError("gif_source_decode_failed", "The generated PNG could not be decoded for motion GIF encoding.");
    }
    if (!isNineBySixteen(source.info.width, source.info.height)) throw new MotionGifRendererError("gif_source_aspect", "Motion GIF encoding requires a 9:16 generated PNG.");
    const frames = [];
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const crop = cropForFrame(source.info.width, source.info.height, frameIndex, frameCount);
      try {
        const frame = await this.sharp(source.data, { raw: { width: source.info.width, height: source.info.height, channels: source.info.channels } })
          .extract(crop)
          .resize(this.width, this.height, { fit: "fill", kernel: "lanczos3" })
          .raw()
          .toBuffer();
        frames.push(frame);
      } catch {
        throw new MotionGifRendererError("gif_frame_encode_failed", "A motion GIF frame could not be rendered.");
      }
      onFrame({ currentFrame: frameIndex + 1, frameCount });
    }
    let bytes;
    try {
      bytes = await this.sharp(Buffer.concat(frames), { raw: { width: this.width, height: this.height * frameCount, channels: 4, pageHeight: this.height } })
        .gif({ loop: 0, delay: Array(frameCount).fill(Math.round(1000 / this.fps)), colours: 64, effort: 7, dither: 0.8, interFrameMaxError: 2, keepDuplicateFrames: true })
        .toBuffer();
    } catch {
      throw new MotionGifRendererError("gif_encode_failed", "The motion GIF could not be encoded.");
    }
    if (!bytes.length || bytes.length > this.maxBytes) throw new MotionGifRendererError("gif_output_oversize", "The motion GIF exceeds the trusted-local 12 MB output limit.");
    let metadata;
    try {
      metadata = await this.sharp(bytes, { animated: true }).metadata();
    } catch {
      throw new MotionGifRendererError("gif_output_invalid", "The motion GIF output could not be validated.");
    }
    if (metadata.format !== "gif" || metadata.width !== this.width || metadata.pageHeight !== this.height || metadata.pages !== frameCount || metadata.delay?.some((delay) => delay !== Math.round(1000 / this.fps))) {
      throw new MotionGifRendererError("gif_output_invalid", "The motion GIF output did not match the requested frame contract.");
    }
    return { bytes, mimeType: "image/gif", width: this.width, height: this.height, frameCount, fps: this.fps, durationSeconds: frameCount / this.fps, byteLength: bytes.length };
  }
}