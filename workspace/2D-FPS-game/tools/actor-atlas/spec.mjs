export const BUILD_SPEC = Object.freeze({
  schemaVersion: '1.0.0',
  blenderVersion: '4.5.12',
  teams: Object.freeze(['BLUE', 'RED']),
  states: Object.freeze({
    idle: Object.freeze({ framesPerDirection: 4, frameRate: 6, repeat: true }),
    run: Object.freeze({ framesPerDirection: 6, frameRate: 12, repeat: true }),
    fire: Object.freeze({ framesPerDirection: 4, frameRate: 12, repeat: false }),
    hit: Object.freeze({ framesPerDirection: 2, frameRate: 12, repeat: false }),
    death: Object.freeze({ framesPerDirection: 6, frameRate: 8, repeat: false }),
  }),
  directions: Object.freeze([
    'east',
    'south-east',
    'south',
    'south-west',
    'west',
    'north-west',
    'north',
    'north-east',
  ]),
  cell: Object.freeze({ width: 128, height: 128 }),
  atlas: Object.freeze({ width: 2048, height: 2048, maxCount: 2, columns: 16 }),
  budgets: Object.freeze({ transferBytes: 8 * 1024 * 1024, gpuRgbaBytes: 32 * 1024 * 1024 }),
});

export const DIRECTION_ANGLES_DEGREES = Object.freeze({
  east: 90,
  'south-east': 45,
  south: 0,
  'south-west': -45,
  west: -90,
  'north-west': -135,
  north: 180,
  'north-east': 135,
});

export const SOURCE_INPUTS = Object.freeze([
  Object.freeze({
    id: 'quaternius-universal-base-characters',
    officialUrl: 'https://quaternius.com/packs/universalbasecharacters.html',
    acquiredAt: '2026-08-17',
    license: 'CC0-1.0',
    path: 'public/assets/source/quaternius-universal-base-characters/Universal Base Characters[Standard].zip',
    bytes: 128968391,
    sha256: 'fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40',
    entries: Object.freeze([
      'Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf',
      'Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.bin',
      'Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Eye_Brown.png',
      'Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Eye_Normal.png',
      'Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Hair_1_BaseColor.png',
      'Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Hair_1_Normal.png',
      'Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Superhero_Male_Dark.png',
      'Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Superhero_Male_Normal.png',
      'Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Superhero_Male_Roughness.png',
    ]),
    aliases: Object.freeze({
      'Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Eye_Normal_png.png':
        'Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Eye_Normal.png',
      'Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Hair_1_Normal_png.png':
        'Universal Base Characters[Standard]/Base Characters/Godot - UE/T_Hair_1_Normal.png',
    }),
  }),
  Object.freeze({
    id: 'quaternius-universal-animation-library',
    officialUrl: 'https://quaternius.com/packs/universalanimationlibrary.html',
    acquiredAt: '2026-08-17',
    license: 'CC0-1.0',
    path: 'public/assets/source/quaternius-universal-animation-library/Universal Animation Library[Standard].zip',
    bytes: 15904933,
    sha256: 'cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724',
    entries: Object.freeze([
      'Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb',
    ]),
    aliases: Object.freeze({}),
  }),
]);

export const TEAM_PALETTES = Object.freeze({
  BLUE: Object.freeze({ body: [0.025, 0.18, 0.8, 1], accent: [0.02, 0.75, 1, 1] }),
  RED: Object.freeze({ body: [0.78, 0.035, 0.02, 1], accent: [1, 0.42, 0.015, 1] }),
});

export function createFrameRecords() {
  const frames = [];
  for (const team of BUILD_SPEC.teams) {
    let index = 0;
    for (const [state, stateSpec] of Object.entries(BUILD_SPEC.states)) {
      for (const direction of BUILD_SPEC.directions) {
        for (let frame = 0; frame < stateSpec.framesPerDirection; frame += 1) {
          frames.push({
            key: `actor/${team.toLowerCase()}/${state}/${direction}/${String(frame).padStart(2, '0')}`,
            team,
            state,
            direction,
            frame,
            index,
          });
          index += 1;
        }
      }
    }
  }
  return frames;
}

export const FRAMES_PER_TEAM = Object.values(BUILD_SPEC.states).reduce(
  (sum, state) => sum + state.framesPerDirection * BUILD_SPEC.directions.length,
  0,
);
