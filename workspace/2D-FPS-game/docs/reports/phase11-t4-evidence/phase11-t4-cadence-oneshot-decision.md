# Phase 11 T4 Display-Cadence One-Shot Decision

- Decision date: 2026-08-20
- Product-owner protocol: approved
- Official run start: capture 1 of the 2026-08-20 one-shot collection
- Official report: `phase11-t4-performance-cadence-oneshot-20260820.json`
- Report SHA-256: `8167047f4b75518d522f24c3f5db1e4988f741bc60487839ad3c88d9c441a8cb`
- Workspace fingerprint recorded by the collector: `c1e3b57ea58d05ce7df87c179b7618212817bdd21d26d58e5912f6093205afbb`

## Root-Cause Boundary

The prior controlling failure did not contain evidence of an actor-specific regression. Its nine missed-refresh frames clustered in the first legacy capture, one missed refresh appeared at the start of the following animated capture, p95 17.0 ms appeared on both routes, and all three route-pair deltas remained within 0.1 ms. This pattern is consistent with a route-independent transient host/display scheduling disturbance; it does not prove a specific host cause.

No runtime source or evaluator change was allowed after that conclusion. The following one-shot collection was declared in advance as the final T4 acceptance run, whether it passed or failed. No concurrent tests, reviewer work, image generation, or interactive browser activity was performed during capture.

## Frozen Inputs

| Input | SHA-256 |
| --- | --- |
| `dist/index.html` | `e65de5adf9cadb65a04c4a79dcc11d9646cfd6078f55fd615790bed194019a2b` |
| `dist/assets/index-BbcxEQdd.js` | `b239ed34279701abc60c1daa344239c1a416502cdd8a065ddc6861824fa8b832` |
| `dist/assets/index-Evixa4L2.css` | `a5f9b23c7e9a9ea2cd7a8777116133bb005fec4c0cb216f651055563dddedbbc` |
| `actor-blue.webp` | `fa0f63ab9c32b30c7250bc73f7e178bfd158e7b471bc11ff440fb7785e7f0be9` |
| `actor-red.webp` | `7cda584fdadf2ef96285907486e65e0a37e81131950788287025866f7b26670f` |
| actor `manifest.json` | `2669d9fd0576af1d03b136898a252e0d5c8e70504b706907f24b1de6490a5249` |
| `performance-qualification.mjs` | `3446ee75125c34b60cafb0454ce12819be5228a086d4aba0ec4c84794661d0aa` |
| `perf-actor-presentation.mjs` | `c9be7aeaa91f01372700f38a92729ebd6584b7f4ba04c88e3483590721381209` |

The production build completed immediately before collection with 1,795 transformed modules.

## Frozen Environment

- Timestamp: `2026-08-20T14:25:05.650Z`
- Windows `10.0.26200`, x64; Intel Core i7-8750H, 12 logical CPUs
- Node `v22.16.0`; Playwright `1.59.1`; system Chrome `151.0.7922.138`
- All six captures: NVIDIA GTX 1060 Max-Q through ANGLE Direct3D11
- Headless hardware WebGL, one context, one page, cache disabled, service workers blocked
- 960x540, DPR 1, Foundry/storm fixed scene, 5-second warm-up, 30-second samples
- Exact route order: legacy/animated, animated/legacy, legacy/animated

## Result

| Capture | Route | Samples | p50 | p95 | Max | Frames >25 ms |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | legacy | 1800 | 16.7 ms | 16.9 ms | 17.5 ms | 0 |
| 2 | animated | 1800 | 16.7 ms | 16.9 ms | 17.3 ms | 0 |
| 3 | animated | 1800 | 16.7 ms | 16.9 ms | 17.8 ms | 0 |
| 4 | legacy | 1800 | 16.7 ms | 16.9 ms | 17.6 ms | 0 |
| 5 | legacy | 1800 | 16.7 ms | 16.9 ms | 18.2 ms | 0 |
| 6 | animated | 1801 | 16.7 ms | 16.9 ms | 17.3 ms | 0 |

All three animated-minus-legacy p95 deltas are `0.0 ms`; runtime and browser failure arrays are empty.

- Absolute 16.7 ms gate: **failed and retained** (`absolutePassed=false`)
- Approved 60Hz D3D11 cadence exception: **passed** (`cadenceQualified=true`)
- Qualification: `display-cadence-exception`
- T4 decision: **complete through the explicit cadence exception**

The original absolute report, two prior failed cadence reports, and the preserved auxiliary passing sibling report remain in the same evidence directory. None is overwritten or hidden.
