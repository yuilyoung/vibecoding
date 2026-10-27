# Combat service hardening capability matrix

- Evidence date: 2026-10-27 (Asia/Seoul)
- Runtime scope: browser-hosted Phaser client
- Status vocabulary: `implemented`, `verified`, `prepared`, `deferred`, `blocked`

| Requested capability | Status | Current evidence | Remaining production work |
| --- | --- | --- | --- |
| Reload lifecycle | verified | Exact-boundary completion, controller-path outgoing reload cancellation using the same `WeaponLogic` objects as `MainScene`, death/reset ammo restoration, and empty/reserve handling | Balance and subjective feel tuning only |
| Fire and hit detection | verified | Swept segment/AABB ordering runs before bounce response, hits an actor before a later wall, reflects at a fast swept wall contact, blocks actors behind earlier obstacles, and targets actor collections | Long-session balance soak |
| Map weather | verified | Selected storm state reaches mechanics, renderer, HUD and configured weather loop in a live browser round; five weather domain/renderer tests pass | Subjective visibility and audio mix QA on target devices |
| Map background music | verified | Eight arcade stages map to generated motifs; real PLAY/Enter browser input reaches a running Web Audio context, scheduled ambient/weather loops, and live 0% volume; unit coverage proves motif rescheduling beyond 256 beats plus idempotent ambient/weather/context teardown | Replace generated motifs with mastered/licensed assets if commercial soundtrack quality is required; device listening QA remains subjective |
| 1 vs many CPU battle | verified | `?enemies=3` creates three independent CPU actors with separate health, AI, weapon/reload state and identities; one elimination continues the round, team elimination scores once, reset restores all | Extended balance and accessibility playtest |
| Many vs many online battle | prepared | Versioned join/input/leave/snapshot/event protocol, bounded fail-closed validators and monotonic per-actor input sequence guard have unit coverage | No transport/server, lobby, authentication, authoritative simulation host, persistence, reconnect, region/capacity plan, abuse controls or deployment exists; online play is not available |
| IPC/RPC boundary | prepared | `SceneCombatActor` and dependency-injected scene ports isolate current in-process calls; `OnlineBattleProtocol` implements versioned RPC message unions, validators and sequence rules | Browser monolith needs no OS IPC today; documented `BattleTransport` is future design, with no adapter/server currently implemented |
| Single responsibility / object separation | implemented | Weapon, player/health, inventory, AI, roster, collision, projectile, map, weather, audio, presentation and protocol responsibilities reside in focused modules | Continue splitting `CombatController` orchestration if new weapon families add more branches |
| Interfaces, abstraction, encapsulation, polymorphism | implemented | `SceneCombatActor`, branded actor identity, private roster storage with frozen snapshots, actor/view factories and controller-kind composition are in use | `ActorInputProvider` and `BattleTransport` remain explicitly marked future contracts |
| Architecture and UML | verified | The design separates an as-built component/class/1v3 sequence from explicitly future input/transport/server diagrams | Reconcile target diagrams when a real transport/deployment topology is approved |

## Release interpretation

Local browser play, including 1v3, is implemented and covered by deterministic unit and focused browser evidence. Online many-v-many is deliberately reported as protocol-ready only. A hosted online service must not be advertised until server authority, transport, operations and security gates exist and interoperate in staging.
