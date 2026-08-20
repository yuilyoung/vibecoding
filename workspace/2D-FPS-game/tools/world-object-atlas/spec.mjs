export const WORLD_OBJECT_BUILD_SPEC = Object.freeze({
  schemaVersion: '1.0.0',
  skinId: 'product-v1',
  families: Object.freeze([
    Object.freeze({ id: 'barrel', states: Object.freeze(['idle', 'damaged']), content: Object.freeze({ width: 120, height: 170 }) }),
    Object.freeze({ id: 'mine', states: Object.freeze(['idle', 'armed']), content: Object.freeze({ width: 140, height: 90 }) }),
    Object.freeze({ id: 'crate', states: Object.freeze(['idle', 'damaged']), content: Object.freeze({ width: 170, height: 125 }) }),
    Object.freeze({ id: 'cover', states: Object.freeze(['idle', 'damaged']), content: Object.freeze({ width: 224, height: 100 }) }),
    Object.freeze({ id: 'bounce-wall', states: Object.freeze(['idle', 'active']), content: Object.freeze({ width: 232, height: 86 }) }),
    Object.freeze({ id: 'teleporter', states: Object.freeze(['idle', 'active']), content: Object.freeze({ width: 180, height: 120 }) }),
  ]),
  cell: Object.freeze({ width: 256, height: 256 }),
  atlas: Object.freeze({ width: 1024, height: 1024, columns: 4 }),
  budgets: Object.freeze({ transferBytes: 2 * 1024 * 1024, gpuRgbaBytes: 4 * 1024 * 1024 }),
  shadow: Object.freeze({ red: 5, green: 11, blue: 22, opacity: 0.48, offsetX: 5, offsetY: 7, blur: 3 }),
});

export function createWorldObjectFrameRecords() {
  const frames = [];
  for (const family of WORLD_OBJECT_BUILD_SPEC.families) {
    for (const state of family.states) {
      frames.push({
        key: `world/product-v1/${family.id}/${state}`,
        family: family.id,
        state,
        index: frames.length,
        sourcePath: `public/assets/source/product-v1-map-objects/${family.id}-${state}.png`,
      });
    }
  }
  return frames;
}
