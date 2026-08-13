# Verify the active Phaser game

> Produce reproducible type, lint, unit, build, and browser evidence for a changed game behavior.

## Order

1. Change into `workspace/2D-FPS-game`.
2. Run the narrowest affected test first when a focused suite exists.
3. Run `npm run type-check`, `npm run lint`, `npm test`, and `npm run build` for a normal code change.
4. Run the relevant browser E2E test when user-facing runtime behavior changed.
5. Run the full browser suite when shared scene, HUD, or Playwright configuration changed.
6. Record commands, pass or fail results, and any omitted or interrupted gate with its reason.

## Method

- Use deterministic unit tests for pure logic and browser E2E for scene integration.
- Start with the smallest diagnostic command after a failure; do not mask failures by skipping the broader gate.
- Treat the current package scripts as authoritative when this manual conflicts with an older report.
- Use `FPS_E2E_PORT` only to point Playwright at an intentionally selected local preview; its default remains the configuration's authoritative port.

## Cautions

- Do not run browser tests when their required environment is unavailable without reporting that limit.
- Do not claim a visual or audio behavior passed from static checks alone.
- Keep generated artifacts and temporary test output out of the source diff.
- Distinguish assertion failures from browser or worker teardown failures, and preserve the last reproducible passing evidence for unchanged product code.
