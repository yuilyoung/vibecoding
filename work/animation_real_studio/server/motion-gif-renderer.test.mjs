import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { MotionGifRenderer, MotionGifRendererError } from "./motion-gif-renderer.mjs";

async function sourcePng() {
  return sharp({ create: { width: 90, height: 160, channels: 3, background: { r: 32, g: 104, b: 172 } } }).png().toBuffer();
}

test("renders 2, 12, and 30 deterministic 9:16 motion GIF frames", async () => {
  const sourceBytes = await sourcePng();
  for (const frameCount of [2, 12, 30]) {
    const updates = [];
    const result = await new MotionGifRenderer().render({ sourceBytes, frameCount, onFrame: (update) => updates.push(update) });
    const metadata = await sharp(result.bytes, { animated: true, pages: -1 }).metadata();
    assert.equal(result.mimeType, "image/gif");
    assert.equal(result.width, 432);
    assert.equal(result.height, 768);
    assert.equal(result.frameCount, frameCount);
    assert.equal(result.fps, 10);
    assert.equal(result.durationSeconds, frameCount / 10);
    assert.equal(metadata.format, "gif");
    assert.equal(metadata.width, 432);
    assert.equal(metadata.pageHeight, 768);
    assert.equal(metadata.pages, frameCount);
    assert.equal(updates.length, frameCount);
    assert.deepEqual(updates.at(-1), { currentFrame: frameCount, frameCount });
  }
});

test("rejects invalid source, invalid frame count, and over-limit GIF output", async () => {
  await assert.rejects(new MotionGifRenderer().render({ sourceBytes: Buffer.from("not-a-png"), frameCount: 2 }), (error) => error instanceof MotionGifRendererError && error.code === "gif_source_decode_failed");
  await assert.rejects(new MotionGifRenderer().render({ sourceBytes: await sourcePng(), frameCount: 31 }), (error) => error instanceof MotionGifRendererError && error.code === "gif_frame_count");
  await assert.rejects(new MotionGifRenderer({ maxBytes: 10 }).render({ sourceBytes: await sourcePng(), frameCount: 2 }), (error) => error instanceof MotionGifRendererError && error.code === "gif_output_oversize");
});
