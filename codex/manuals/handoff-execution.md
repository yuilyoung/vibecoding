# Implement an approved handoff

> Turn one current Vision handoff into the smallest verified Codex change without widening its scope.

## Order

1. Decide whether the request is handoff-driven. Read `docs/handoffs/current-handoff.json` and the active workspace baseline only for that path; an explicit request naming another workspace stays scoped to that workspace and its governing documents.
2. Ask the `product_owner` agent for scope, acceptance criteria, and a verification plan when the change is non-trivial.
3. Implement only the accepted slice in the workspace named by the request or handoff; the current game handoff defaults to `workspace/2D-FPS-game`.
4. Run the relevant verification commands and retain their exact results.
5. Ask the `reviewer` agent to evaluate the diff and evidence before declaring completion.
6. Resolve reviewer findings, run manual drift and postflight, then synchronize root handoff, execution report, project status, and task records only for a handoff-driven task. Otherwise update only records inside the explicitly requested workspace.

## Method

- Treat `scope`, `constraints`, `acceptance`, and `files` as the execution contract.
- Do not apply an unrelated current handoff to an explicit user request for another workspace; retain the same PO, verification, reviewer, drift, and postflight gates within the requested scope.
- Prefer the active implementation baseline over older roadmap documents when they conflict.
- When a handoff references a multi-phase product program, keep the current phase executable and keep later phases locked behind their stated entry gates; do not silently widen the active slice.
- Make the smallest defensible change, then update the root execution report only when executing that root handoff; a separate-workspace task must not rewrite unrelated coordination artifacts.
- Keep final status fields consistent: implementation-ready, finalizing, and completed are different delivery states.

## Cautions

- Do not implement a completed or stale handoff without an explicit new request.
- Do not substitute a verbal claim for test, build, or runtime evidence.
- Do not turn the PO or reviewer into implementation agents.
