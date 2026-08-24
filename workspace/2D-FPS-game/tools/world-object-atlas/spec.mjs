export const WORLD_OBJECT_BUILD_SPEC = Object.freeze({
  schemaVersion: '1.1.0',
  skinId: 'product-v1',
  families: Object.freeze([
    Object.freeze({ id: 'barrel', states: Object.freeze(['idle', 'damaged']), content: Object.freeze({ width: 120, height: 170 }) }),
    Object.freeze({ id: 'mine', states: Object.freeze(['idle', 'armed']), content: Object.freeze({ width: 140, height: 90 }) }),
    Object.freeze({ id: 'crate', states: Object.freeze(['idle', 'damaged']), content: Object.freeze({ width: 170, height: 125 }) }),
    Object.freeze({ id: 'cover', states: Object.freeze(['idle', 'damaged']), content: Object.freeze({ width: 224, height: 100 }) }),
    Object.freeze({ id: 'bounce-wall', states: Object.freeze(['idle', 'active']), content: Object.freeze({ width: 232, height: 86 }) }),
    Object.freeze({ id: 'teleporter', states: Object.freeze(['idle', 'active']), content: Object.freeze({ width: 180, height: 120 }) }),
    Object.freeze({
      id: 'arena-obstacle',
      states: Object.freeze(['core', 'tower', 'barrier']),
      contentByState: Object.freeze({
        core: Object.freeze({ width: 150, height: 150 }),
        tower: Object.freeze({ width: 92, height: 220 }),
        barrier: Object.freeze({ width: 232, height: 96 }),
      }),
    }),
    Object.freeze({ id: 'service-gate', states: Object.freeze(['closed', 'open']), content: Object.freeze({ width: 232, height: 100 }) }),
    Object.freeze({ id: 'vent-hazard', states: Object.freeze(['active']), content: Object.freeze({ width: 232, height: 96 }) }),
    Object.freeze({ id: 'ammo-pickup', states: Object.freeze(['available']), content: Object.freeze({ width: 120, height: 100 }) }),
    Object.freeze({ id: 'health-pickup', states: Object.freeze(['available']), content: Object.freeze({ width: 120, height: 120 }) }),
  ]),
  cell: Object.freeze({ width: 256, height: 256 }),
  atlas: Object.freeze({ width: 2048, height: 1024, columns: 8 }),
  budgets: Object.freeze({ transferBytes: 4 * 1024 * 1024, gpuRgbaBytes: 8 * 1024 * 1024 }),
  shadow: Object.freeze({ red: 5, green: 11, blue: 22, opacity: 0.48, offsetX: 5, offsetY: 7, blur: 3 }),
});

export function getWorldObjectFrameContent(family, state) {
  return family.contentByState?.[state] ?? family.content;
}

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
