# Run the local harness observability pipeline

> Record a sanitized, worktree-isolated harness run from approved design through deterministic verification.

## Order

1. Create a run design with its title and repository-relative path claims.
2. Create the run worktree only after the pipeline accepts the claims.
3. Mark development, then record each allowed verification result.
4. Complete the run only after all verification evidence passes and every modified path is inside its accepted claim.
5. Inspect the loopback dashboard for run freshness and evidence references.

## Method

- Treat `docs/development/harness-observability-design.md`, the generated per-run state, and the Git worktree as the current sources of truth.
- Use the root `harness:*` commands; event payloads contain metadata only and are validated by `packages/harness-observability-contract/`.
- The dashboard discovers every direct `work/` project without running any project command; project cards report provenance and freshness only.
- Keep runtime state below ignored `.local/harness-observability/` and use `127.0.0.1` only for the service.
- The only live dashboard is `http://127.0.0.1:4318/`; legacy static dashboard paths provide recovery guidance only.

## Cautions

- Never persist prompts, tool arguments, secrets, environment values, or raw command output in events.
- Do not claim a path already owned by an active run or reuse a dirty intake worktree.
- Claims are lowercase canonical repository paths; they must be harness-owned paths or paths under a discovered `work/<project>/` root.
- Completion requires current, successful `harness-tests` and `harness-audit` results at the same Git fingerprint.
- This pipeline does not install or enable any memory or external agent plugin; consult `experiments/memory-pocs/registry.json` for postponed candidates.
