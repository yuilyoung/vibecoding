# Implement an approved handoff

> Turn one current Vision handoff into the smallest verified Codex change without widening its scope.

## Order

1. Read `docs/handoffs/current-handoff.json` and the active workspace baseline.
2. Ask the `product_owner` agent for scope, acceptance criteria, and a verification plan when the change is non-trivial.
3. Implement only the accepted slice in `workspace/2D-FPS-game`.
4. Run the relevant verification commands and retain their exact results.
5. Ask the `reviewer` agent to evaluate the diff and evidence before declaring completion.
6. Resolve reviewer findings, run manual drift and postflight, then synchronize the handoff, project status, and task records before the scoped commit and push.

## Method

- Treat `scope`, `constraints`, `acceptance`, and `files` as the execution contract.
- Prefer the active implementation baseline over older roadmap documents when they conflict.
- When a handoff references a multi-phase product program, keep the current phase executable and keep later phases locked behind their stated entry gates; do not silently widen the active slice.
- Make the smallest defensible change, then update the execution report only with observed results.
- Keep final status fields consistent: implementation-ready, finalizing, and completed are different delivery states.

## Cautions

- Do not implement a completed or stale handoff without an explicit new request.
- Do not substitute a verbal claim for test, build, or runtime evidence.
- Do not turn the PO or reviewer into implementation agents.
