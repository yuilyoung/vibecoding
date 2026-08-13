---
name: rights-safety-gate
description: Classify user briefs and generated short-form media into pass, rewrite, needs-review, or blocked outcomes with auditable reason codes. Use before generation, after media quality checks, and when designing rights, likeness, reporting, or deletion workflows for Animation Real Studio.
---

# Rights Safety Gate

Read `../../../docs/01-prd.md` and `../../../docs/02-validation-plan.md` before changing policy behavior.

1. Inspect IP specificity, licence claims, real-person likeness or voice, sexual/minor content, privacy, impersonation, harassment, gore, and personal data.
2. Produce exactly one outcome: `pass`, `rewrite-required`, `needs-review`, or `blocked`. Attach stable reason codes and a user-facing next action.
3. Block exact copyrighted character, dialogue, logo, soundtrack, or scene reconstruction unless a separate approved rights process exists. Offer an original, abstracted rewrite only where safe.
4. Send ownership/licence claims and borderline cases to `needs-review`; do not infer permission from a checkbox or a public source.
5. Repeat the review after generation. Do not deliver a failed result, and preserve an auditable decision without exposing sensitive reviewer data to the user.

Do not present this classification as legal advice or approve a licence without authorised review.
