# ARS-001 V1 interview guide

This packet collects only task-completion evidence for the request-to-storyboard flow. Do not collect names, contact details, uploaded media, voice samples, screenshots containing personal data, copyrighted clips, or real-person images.

## Facilitator setup

- Assign an anonymized participant code such as `P01`; keep any recruitment contact list outside this repository.
- Show only an original, non-identifying sample scenario. Do not invite media uploads during the session.
- Tell participants that the local Studio is a simulation and that its precheck is not a rights, likeness, privacy, or media-safety approval.

## Independent task

Ask the participant to describe an original emotional scene, complete the source-relationship and rights acknowledgement fields, review the storyboard, and state whether they would confirm or edit it. Do not help unless the task cannot continue; record any intervention.

## Questions after completion

1. What did you understand the Studio would create?
2. Which field, label, or safety notice was unclear?
3. Did the storyboard preserve the emotional intent without copying a named work or person?
4. Would you confirm, edit, or abandon this request? Why?
5. Did you understand that the default result and delivery are private?

## Record template

Copy this block for every session into the `v1Interview.records` array in `ars-001-decision-log.json`. Keep free text free of personal data and protected-work details.

```json
{
  "participantCode": "P01",
  "recordedAt": "YYYY-MM-DD",
  "scenarioClass": "original non-identifying emotional scene",
  "completedWithoutAssistance": false,
  "outcome": "confirm | edit | abandon",
  "confusion": "brief non-identifying summary",
  "originalizationUnderstood": false,
  "privateDeliveryUnderstood": false,
  "notes": "No personal data, media, character names, or copied scene details."
}
```

## Success threshold

The V1 gate is met only when at least five anonymized records exist and at least four participants independently complete the request-to-storyboard flow. Record product changes separately in the decision log; do not mark ARS-001 complete solely because the guide exists.
