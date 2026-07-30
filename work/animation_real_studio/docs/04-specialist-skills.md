# 전문 스킬과 책임 경계

전문성은 사람 조직도를 복제하는 역할명이 아니라, 재사용 가능한 **입력·출력 계약**으로 분리한다. 각 스킬은 프로젝트 로컬 `.codex/skills`에 있으며 실제 구현 태스크가 필요한 문서만 읽도록 작게 유지한다.

| 스킬 | 수행 시점 | 입력 → 출력 | 하지 않는 일 |
|---|---|---|---|
| [`adaptation-intake`](../.codex/skills/adaptation-intake/SKILL.md) | 요청 폼/기획안 | 자유 서술 → 구조화된 장면 브리프·결측 질문·오리지널화 메모 | 영상 생성, 권리 최종 승인 |
| [`rights-safety-gate`](../.codex/skills/rights-safety-gate/SKILL.md) | 제출 전·결과 후 | 브리프/결과 → 통과·재작성·검토·차단과 사유 코드 | 법률 자문, 라이선스 주장 자동 승인 |
| [`vertical-short-director`](../.codex/skills/vertical-short-director/SKILL.md) | 스토리보드 승인 전 | 안전한 브리프 → 15초 9:16 비트·자막·사운드 계획 | 기존 작품 장면/대사의 재현 |
| [`media-delivery-ops`](../.codex/skills/media-delivery-ops/SKILL.md) | QC·보관함·공유 | 공급자 산출물 → manifest·상태 전이·표시/보관 확인 | 접근 제어 우회, 공개 기본값 변경 |
| [`youtube-distribution-ops`](../.codex/skills/youtube-distribution-ops/SKILL.md) | 운영자 승인 뒤 외부 배포 | video version → OAuth 채널 게시·처리·자막·상태·감사 기록 | 무인 자동 공개, 개인 토큰 공유 |

## 호출 순서

```text
adaptation-intake → rights-safety-gate → vertical-short-director
                   ↓ (검토/차단)             ↓ (사용자 승인)
              운영자 검토                 generation worker
                                             ↓
                                rights-safety-gate → media-delivery-ops
                                                           ↓ (운영자 승인)
                                                youtube-distribution-ops
```

## 스킬 작성 기준

- 권리·동의·개인정보·공개 범위는 각각의 처리 단계에서 다시 확인한다. 한 번의 체크로 뒤 단계를 면제하지 않는다.
- 외부 모델의 현재 약관·기능은 스킬 본문에 고정하지 않는다. `ARS-018`의 공급자 평가 결과나 최신 공식 문서만 참조한다.
- 스킬의 판정은 `reason_code`와 함께 기록될 수 있어야 하며, 사용자에게는 다음 행동(재작성, 증빙 제출, 검토 대기)을 설명한다.
- 다섯 스킬은 구현 코드가 생긴 뒤 단위 테스트/통합 테스트의 입력 fixture와 운영 문구의 기준으로도 사용한다.
