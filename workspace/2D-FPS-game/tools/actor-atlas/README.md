# Actor atlas build adapter

`npm run assets:actor-atlas` is the Phase 11 offline build boundary. It verifies both vendored Quaternius source archives, the complete pinned Blender archive, `blender.exe`, Blender version/build/platform, the exact rig/action inventory, and `sharp@0.35.3` before rendering anything.

## Local Blender provisioning

Provisioning is deliberately separate from the build command. Place the official Windows x64 portable archive and its extracted directory at the paths in `blender-lock.json`:

- archive: `.local/downloads/blender-4.5.12-windows-x64.zip`
- executable: `.local/blender/blender-4.5.12-stable+v45.84afd5f785f7-windows.amd64-release/blender.exe`

The lock records the official Blender URL, archive byte length/SHA-256, executable SHA-256, exact version, build hash, and platform. The build performs no download and fails closed when any value differs.

## Output contract

Each invocation performs two isolated clean generations, compares every release byte, and promotes only the complete matching directory to `public/assets/runtime/actors`. The promoted release contains one 2048x2048 lossless WebP and one Phaser hash JSON per team plus `manifest.json`. Staging, local tool binaries, and partial output remain under ignored, validated paths.

Focused contract tests run with `npm run test:actor-atlas` and do not invoke Blender.
