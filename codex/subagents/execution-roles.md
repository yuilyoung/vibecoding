# Ultron Subagent Roles

## Explorer

- 코드 구조 파악
- 변경 범위 계산
- 의존성 확인

## Worker

- 실제 코드 구현
- 테스트 수정
- 설정 파일 보완

## Verifier

- `type-check`
- `lint`
- `test`
- `build`

## 운영 원칙

- Explorer는 읽기 중심
- Worker는 명시된 파일 범위 안에서 구현
- Verifier는 구현 완료 후 결과를 검증
- 결과는 `docs/handoffs/current-execution-report.md`에 집계
