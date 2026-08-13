# Delivery contract

## Required trace fields

Every accepted item uses a stable `IMG-*` requirement ID and maps to:

`PDD outcome -> FSD behavior -> TDD boundary/interface -> WBS unit -> test evidence`

## Safe domain vocabulary

- Human subjects are fictional, non-identifying adults age 20+.
- Every human direction must explicitly say fictional, non-identifying, imaginary, invented, 가상, 비식별, or the supported equivalent; name/context detection is defense in depth, not identity recognition.
- `adult_university_student` means age 20 or older.
- `school_inspired` means a non-sexual adult editorial outfit; sensual or erotic direction conflicts with it.
- `bikini` and `lingerie` are valid for fictional adult humans age 20+ in consensual, non-graphic contexts.
- Animal and bird subjects cannot have a human profession or wardrobe.
- Classify safe adult sensual wording as `adult_non_graphic_allowed`.
- Reject English and Korean minor/teen/age-ambiguous (`minor_or_ambiguous_blocked`), real-person (`real_person_blocked`), explicit/pornographic/coercive (`explicit_sex_blocked`), and erotic school-coded (`age_coded_sexualization_blocked`) directions before any provider operation.

## Batch invariants

- `variantCount` is an integer from 1 through 3.
- Each variant has a unique ID, prompt variation, provider operation, and terminal state.
- One failure cannot erase another completed variant.
- Only a completed variant in the same batch may be selected.
- Selecting the current result is idempotent; selecting another completed result is a revision.
- Batch responses never contain source bytes or temporary paths.

## Retouch boundary

Do not implement retouching until masks, consent, reversible revisions, provenance, safety validation, and export disclosure have accepted protocol contracts and tests.
