# Hermes delivery state machine

Load this reference only when extending, debugging, or auditing the harness.

## Ordered gates

| State | Required evidence | Next allowed action |
| --- | --- | --- |
| `designing` | Product-owner five-section plan and `Decision: approved` | edit |
| `design-approved` | approved design evidence reference | implementation change |
| `implementing` | current workspace fingerprint | deterministic verification |
| `verifying` | at least one passing check at that fingerprint | reviewer verdict |
| `reviewing` | `Verdict: pass` at that fingerprint | manual drift check |
| `finalizing` | passing drift check at that fingerprint | completion |
| `completed` | all evidence above | no mutation; terminal |

Any later edit resets verification, review, and finalization. A failed check or `Verdict: revise` enters `revision-required`; a reviewer `blocked` verdict is terminal.

## Hook responsibilities

- `UserPromptSubmit`: classify delivery/design work and create a run.
- `PreToolUse`: deny `apply_patch` and known mutating shell commands before design approval.
- `PostToolUse`: fingerprint edits and record allowlisted deterministic commands without storing raw command text.
- `SubagentStart` / `SubagentStop`: inject and validate product-owner/reviewer output contracts.
- `Stop`: continue once with the exact missing gate, or complete when every fingerprint matches.

The hook adapter also emits safe dashboard heartbeat, lifecycle, delegation, and reviewer-message events. It never copies prompts, tool payloads, or full role transcripts into the dashboard journal.

Runtime state is stored outside source control as an atomic `status.json` cache and append-only `events.jsonl`. The schemas live under `schemas/`. Do not log prompts, tool payloads, credentials, or raw reviewer transcripts.

## Enforcement boundary

Plugin hooks must be reviewed with `/hooks` after installation or after their hash changes. They are skipped until trusted. Some specialized tool paths can opt out of normal hook interception, so combine hooks with `AGENTS.md`, the delivery skill, deterministic tests, and the independent reviewer. Never use hook automation to bypass sandbox or user approval decisions.
