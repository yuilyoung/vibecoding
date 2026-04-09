---
name: dev-cycle
description: 전체 개발 사이클을 오케스트레이션한다. 서브에이전트를 spawn하고 mailbox로 협업을 조율.
user-invocable: true
argument-hint: "[기능 설명 또는 요구사항]"
---

## 역할

개발 사이클 오케스트레이터. 서브에이전트 팀을 spawn하고 파일 기반 mailbox로 작업을 조율한다.

## Mailbox 구조

각 사이클마다 `.dev-cycle/{cycle-id}/`에 mailbox를 생성한다.
cycle-id는 `YYYYMMDD-feature-name` 형식.

```
.dev-cycle/{cycle-id}/
├── status.md          # 현재 사이클 상태 (오케스트레이터가 관리)
├── prd.md             # analyze-prd 에이전트 출력
├── prd-review.md      # review-prd 에이전트 출력
├── tasks.md           # create-tasks 에이전트 출력
├── dev-output.md      # develop 에이전트 출력 (변경 파일, 구현 요약)
├── review-feedback.md # review-code 에이전트 출력 (리뷰 결과)
├── test-results.md    # verify 에이전트 출력 (테스트 결과)
└── iteration-log.md   # 피드백 루프 기록
```

## 오케스트레이션 프로세스

### Phase 1: PRD (순차)
1. **Agent spawn: analyze-prd** → `prd.md` 작성
2. 사용자에게 PRD 요약 표시 → **승인 대기**
3. **Agent spawn: review-prd** → `prd-review.md` 작성
4. FAIL 시 → analyze-prd 에이전트에 SendMessage로 수정 요청 → 반복
5. 사용자 최종 승인 → Phase 2

### Phase 2: 태스크 생성
6. **Agent spawn: create-tasks** → `tasks.md` 작성 + TaskCreate 실행
7. 사용자에게 WBS 표시 → 확인

### Phase 3: 개발 루프 (병렬 + 피드백)
이 단계에서 develop, review-code, verify 에이전트가 협업한다.

```
[develop] ──작성──→ dev-output.md
                         ↓
[review-code] ──읽기──→ review-feedback.md
                         ↓
    ┌─ APPROVE → [verify] ──→ test-results.md → 완료
    └─ REQUEST_CHANGES → dev-output.md에 피드백 추가
                         ↓
         [develop] ←─SendMessage─── 피드백 전달
                         ↓
                    (루프 반복, 최대 3회)
```

**피드백 루프 절차:**
1. develop 에이전트 spawn → 코드 구현 → `dev-output.md` 작성
2. review-code 에이전트 spawn → `dev-output.md` 읽기 → `review-feedback.md` 작성
3. 판정 확인:
   - **APPROVE** → verify 에이전트 spawn → `test-results.md` 작성
   - **REQUEST_CHANGES** → develop 에이전트에 SendMessage로 피드백 전달 → 수정 → 2번 반복
4. verify 결과 확인:
   - **VERIFIED** → 사이클 완료
   - **BLOCKED** → develop 에이전트에 SendMessage로 실패 내용 전달 → 수정 → 2번 반복
5. 최대 3회 반복 후에도 미해결 시 → 사용자에게 에스컬레이션

### Phase 4: 완료
- `status.md` 업데이트 (COMPLETED)
- `iteration-log.md`에 전체 루프 기록
- 모든 태스크 completed 처리
- 사용자에게 최종 요약 표시

## 에이전트 Spawn 규칙

각 에이전트를 spawn할 때 반드시 포함할 컨텍스트:
1. mailbox 경로: `.dev-cycle/{cycle-id}/`
2. 읽어야 할 파일 목록
3. 작성해야 할 출력 파일
4. `CLAUDE.md`, `docs/rules.md` 참조 지시

## status.md 형식

```markdown
# Dev Cycle: {feature-name}
- Phase: PRD / TASKS / DEV / REVIEW / TEST / COMPLETED
- Iteration: {n}/3
- Last Agent: {agent-name}
- Result: PENDING / PASS / FAIL
- Blockers: ...
```

## 규칙

- **사용자 승인 없이 Phase 2 이후 진행 금지**
- 피드백 루프 최대 3회 — 초과 시 사용자 판단 요청
- 모든 에이전트 출력은 mailbox 파일로 기록
- iteration-log.md에 각 반복의 변경사항/판정 누적 기록
