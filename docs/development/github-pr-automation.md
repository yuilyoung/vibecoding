# GitHub PR Automation

The repository validates the active Phaser game through the root GitHub Actions
workflow at `.github/workflows/game-pr-validation.yml`. GitHub only discovers
workflows in the repository-root `.github/workflows` directory.

## Required checks

For pull requests that change `workspace/2D-FPS-game` (or the workflow itself), the
`Game PR validation` workflow runs two required check candidates:

1. `Quality gates`: deterministic install, TypeScript check, ESLint, Vitest,
   and production build.
2. `Browser E2E`: Chromium installation and the complete Playwright suite.

The workflow cancels obsolete runs for the same pull request. It uploads the
Playwright HTML report for completed E2E jobs and diagnostic traces/screenshots
and logs when E2E fails. Artifacts are retained for 14 days.

## Maintainer setup: make PR review the only manual gate

The workflow file alone cannot prohibit direct pushes. A repository
administrator must configure the `master` branch protection rule in GitHub:

1. Require a pull request before merging and require at least one approval.
2. Require status checks to pass before merging; select `Quality gates` and
   `Browser E2E` after their first successful workflow run.
3. Require branches to be up to date before merging, if the team wants the
   checks rerun against the latest `master`.
4. Restrict who can push to `master`, and do not grant bypass permission except
   to an explicitly approved release owner.

These controls require GitHub repository-admin access (or an authenticated
GitHub API token with administration permission), so they cannot be reliably
created by repository code or an unprivileged CI workflow. After enabling the
rule, contributors work through PRs while users only need to review and merge
green PRs.

## Local equivalent

Run these commands from `workspace/2D-FPS-game` before opening a PR:

```powershell
npm ci
npm run type-check
npm run lint
npm test
npm run build
npm run test:e2e
```
