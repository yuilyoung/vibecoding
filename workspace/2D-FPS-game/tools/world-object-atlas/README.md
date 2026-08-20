# Product V1 world-object atlas

`npm run assets:world-object-atlas` verifies the twelve immutable alpha PNG sources and approved v5 target-frame hash, performs two isolated Sharp 0.35.3 builds, compares every output byte, validates the 1024x1024 lossless WebP/Phaser JSON/schema 1.0.0 manifest and budgets, then atomically promotes the complete release.

`npm run test:world-object-atlas` covers the exact frame matrix, source alpha contract, release hashes/dimensions/budgets, negative manifests, clean-build reproducibility, and failed-promotion rollback.

The runtime release is `public/assets/runtime/world/product-v1/`. Source generation provenance is in `public/assets/source/product-v1-map-objects/PROVENANCE.md`.
