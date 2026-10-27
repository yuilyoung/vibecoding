# Arena Strike 결제 서비스화 가이드

## 현재 배포 상태

- Production: https://vibecoding-2d-fps-game.vercel.app
- Hosting: Vercel, Vite 정적 빌드
- 현재 구조: 클라이언트 중심 Phaser 게임

## 권장 상품 모델

첫 출시에서는 무료 플레이를 유지하고, 다음 일회성 상품부터 시작한다.

1. 광고 제거 또는 후원자 배지
2. 프리미엄 캐릭터 스킨 팩
3. 프리미엄 무기 이미지/스킨 팩
4. 이후 계정 시스템이 안정화되면 시즌 패스 또는 구독

## 결제 선택지

### 빠른 검증: 결제 링크

Stripe Payment Link 또는 토스 링크페이를 만들어 버튼에 연결한다. 결제 페이지를 직접 만들지 않아도 되지만, 게임 내 구매 권한 자동 지급에는 계정과 서버 Webhook이 추가로 필요하다.

### 정식 글로벌 결제: Stripe Checkout

Vercel Function을 결제 백엔드로 추가한다.

- `api/create-checkout-session.ts`: 서버에 보관한 Price ID로 Checkout Session 생성
- `api/stripe-webhook.ts`: `checkout.session.completed`, 환불, 구독 상태 이벤트 수신
- Supabase/Postgres: 사용자, 주문, 구매 권한 저장
- 클라이언트: 서버 권한 확인 후 프리미엄 콘텐츠 해금

가격과 상품 권한은 브라우저가 아니라 서버에서 결정한다. 결제 성공 URL에 도착한 사실만으로 지급하지 않고, Stripe 서명 검증이 끝난 Webhook 이벤트를 기준으로 지급한다.

필요한 Vercel 환경변수:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
VITE_STRIPE_PUBLISHABLE_KEY
DATABASE_URL
```

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DATABASE_URL`은 클라이언트 번들에 포함되면 안 된다. Production 환경변수 변경 후에는 새 Production 배포가 필요하다.

### 국내 결제 중심: 토스페이먼츠 또는 포트원

한국 카드·간편결제·네이버페이·카카오페이 중심으로 운영할 경우 토스페이먼츠 또는 포트원을 검토한다. 결제 요청·인증·승인 단계에서 서버가 주문번호와 금액을 다시 검증하고, PG 계약 및 사업자 요건을 확인한다.

## 운영 순서

1. 테스트 모드 상품 1개 생성
2. Checkout/결제창을 Preview 환경에 연결
3. 성공·실패·취소·중복 Webhook 테스트
4. 구매 권한을 DB에 저장하고 게임에서 검증
5. 환불·문의·이용약관·개인정보처리방침·세금 처리를 준비
6. Production 키와 실제 상품으로 전환

## 보안 및 운영 원칙

- 비밀키를 `VITE_` 변수나 소스 코드에 넣지 않는다.
- 가격은 클라이언트 입력값을 믿지 않고 서버의 상품 ID로 확정한다.
- Webhook 원본 body와 서명을 검증한다.
- 결제 이벤트는 idempotency key와 주문 상태로 중복 지급을 막는다.
- 환불/구독 해지 이벤트에서도 게임 권한 상태를 갱신한다.
