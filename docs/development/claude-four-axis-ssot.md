# Claude Four-Axis SSOT Manual

## Purpose

This is the normative operating manual for durable Claude harness knowledge. It complements `AGENTS.md` and never overrides the active implementation baseline at `work/2D-FPS-game`.

## Canonical Sources

| Concern | Canonical source | Owner | Evidence |
|---|---|---|---|
| Shared workspace contract | `AGENTS.md` | Shared | Current file reference |
| Active execution baseline | `docs/development/active-workspace-baseline.md` | Ultron | Relevant command or test result |
| Claude SSOT policy | This manual | Vision | Adversarial verdict |
| Loop definition | `docs/development/claude-loop-specification.md` | Hermes | Named terminal state |
| Machine state | `.claude/state/ssot-metadata.json` | Hermes | `npm run harness-audit` |

When a canonical source conflicts with the active implementation workspace, the active workspace wins for executable decisions. Record the conflict; never silently merge it.

## Axis 1: Data Metadata

Every source has a stable path or URL, owner, format, last verification time, refresh interval, and deterministic verification method. `.claude/state/ssot-metadata.json` is the registry; an unregistered claim is not SSOT.

## Axis 2: Manual SSOT

Normative behavior belongs in versioned Markdown, not chat memory. Agent prompts can explain a manual but cannot overrule it. Register a new manual in the metadata before an agent relies on it.

## Axis 3: Self-Question and Adversarial Validation

Hermes creates a question pack for every non-trivial change. `adversarial-validator` independently seeks counterexamples for correctness, boundaries, security, regression, source conflicts, and freshness. A model's self-assessment is never sufficient evidence.

## Axis 4: Freshness Maintenance

Run `npm run harness-audit` before planning, review, or release decisions that depend on this harness. It fails for malformed metadata, missing manuals, incomplete required plugin policy, or expired sources.

Run `npm run harness-refresh` only with explicit approval for network access. It updates timestamps only after the official Anthropic plugin catalog and Hermes CLI reference both fetch successfully. The plugin catalog expires after seven days; the Hermes reference after 30 days.

## Plugin Policy

Installed approved plugins are `code-review`, `claude-md-management`, and `security-guidance` from `claude-plugins-official`. They augment, but do not replace, independent review and deterministic checks.

`semgrep` is opt-in until its prompt impact, permissions, and CI behavior have been reviewed for this workspace.

## Completion Gate

Completion requires current metadata, the applicable manual, a Hermes question pack, an independent adversarial verdict, reproducible verification evidence, and a named terminal state. Otherwise report `blocked`, `stalled`, or `unverified`.