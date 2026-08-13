# Smart 가격비교

소비자·자영업자·대행업체가 같은 계산 기준으로 메뉴 수익성과 마트 상품 단위가격을 비교하는 로컬 우선 웹 MVP입니다.

## 제공 기능

- 메뉴가격에서 원재료비, 인건비, 가스비, 포장비, 수도세, 전기세를 차감한 실제 예상 이익
- 총비용, 이익, 이익률, 원가율과 적자·손익분기 표시
- QR/EAN/UPC 카메라 스캔과 모든 환경에서 쓸 수 있는 수동 코드 입력
- 정상가·할인가·절감액·할인율 및 10g, 100g, 10ml당 가격 비교
- 같은 단위 기준 최저가 강조, 샘플 데이터, 브라우저 로컬 저장
- 데스크톱·모바일 반응형 한국어 UI

카메라 스캔은 지원 브라우저의 HTTPS 또는 localhost에서 동작합니다. 스캔은 상품 코드를 읽는 기능이며, 로컬 샘플에 없는 상품의 이름·매장·가격·용량은 사용자가 입력합니다.

## 실행

```powershell
npm install
npm run dev
```

브라우저에서 `http://127.0.0.1:4176`을 엽니다.

## 검증

```powershell
npm test
npm run build
npm run test:e2e
# 또는 전체 검증을 한 번에 실행
npm run verify
```

설계 계약과 향후 서버 저장소 확장 경계는 [docs/architecture.md](docs/architecture.md)에 있습니다.
완료 범위와 후속 후보는 [docs/mvp-handoff.md](docs/mvp-handoff.md)에 정리했습니다.
