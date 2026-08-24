# ARS-006A/006B — 이미지→영상 공급자 capability와 계약 기록

Status: official-document review corrected; provider-neutral adapter and offline job-orchestration contracts added; runtime integration deferred, 2026-08-24.

## 결론

현재 제품은 PNG와 한 장의 이미지를 결정적으로 pan/zoom하는 GIF까지만 제공한다. 이 GIF는 AI 영상이 아니며 MP4, 영상 공급자, 자막·오디오 합성 또는 영상 전달 경로는 없다.

사용자가 언급한 “H3”는 공식 모델 `MiniMaxAI/MiniMax-H3`로 확인됐다. 기능상 15초 9:16 이미지 기반 영상 요구와 잘 맞는다. 공식 Community License는 대한민국을 제외 지역으로 명시하므로 한국에서 **오픈 가중치를 로컬 배포하려면 MiniMax의 formal license가 필요**하다.

이 지역 제한을 hosted API까지 확장한 이전 판정은 부정확했다. MiniMax의 공식 License Q&A와 H3 FAQ는 보호 장치가 적용된 H3 API를 전 세계 제공한다고 명시하고, 공식 API reference는 모델 ID `MiniMax-H3`, `POST /v2/video_generation`, `GET /v2/query/video_generation/{task_id}`, `DELETE /v2/video_generation/{task_id}`를 공개한다. 다만 API의 존재는 데이터 사용·보존/삭제·처리 지역·상업 조건·비용·계정 책임 승인을 대신하지 않으므로 실제 제품 연결은 계속 보류한다.

`Wan-AI/Wan2.2-TI2V-5B`는 Apache-2.0이고 720p/24fps text-image-to-video와 세로 `704×1280` 출력을 공식 지원하므로 다음 벤치마크 후보로 유지한다. 다만 공식 단일 GPU 예시는 최소 24GB VRAM을 요구하고 현재 환경에서는 `nvidia-smi`가 확인되지 않았으므로 로컬 실행 가능성, 품질, 지연시간 또는 비용을 검증했다고 주장하지 않는다.

## 공식 capability 비교

| 항목 | MiniMax H3 | Wan2.2 TI2V-5B |
| --- | --- | --- |
| 공식 모델 ID | `MiniMaxAI/MiniMax-H3` | `Wan-AI/Wan2.2-TI2V-5B` |
| 입력 | text; 시작/종료 프레임 0–2장; 이미지·영상·오디오 reference | text 또는 text + 첫 이미지 |
| 출력 길이 | 4–15초 | 공식 고정 제품 길이 미확인; frame 수 기반 |
| 화면비/해상도 | 9:16 포함 다양한 비율; H3-Base 768p | 720p; 세로 `704×1280` |
| 프레임/오디오 | 24fps; 32kHz stereo native audio | 24fps; native audio는 공식 TI2V 출력으로 확인되지 않음 |
| 공개 가중치 | H3-Base FL2VA/Ref2VA; 33B BF16 | TI2V 5B |
| 라이선스 | MiniMax H3 Community License Agreement | Apache-2.0 |
| 오픈 가중치 대한민국 적합성 | **별도 formal license 필요** — Community License의 Excluded Territories에 Republic of Korea 포함 | 지역 제외는 공식 Apache-2.0 모델 카드에서 확인되지 않음 |
| Hosted API | 공식 Q&A는 globally available로 설명; `MiniMax-H3` `/v2` create/query/delete 문서 확인 | 이 카드에서 hosted API 미평가 |
| 공식 실행 조건 | SGLang 예시는 4 GPU; GPU 종류·VRAM 하한은 모델 카드에 미기재 | offload/T5 CPU 조건의 단일 GPU 예시가 최소 24GB VRAM 제시 |
| 현재 판정 | open weights: `blocked_without_formal_license_in_south_korea`; hosted API: `documented_globally_available_but_product_integration_deferred` | `benchmark_candidate` |

## 제품 계약에 미치는 영향

- `VideoProvider`는 계속 미선정이며 `integrationStatus: deferred`를 유지한다.
- H3 오픈 가중치 다운로드·로컬 실행은 formal license 전까지 추가하지 않는다.
- `video-provider.v1` Business 계약과 `MiniMaxH3HostedAdapter`의 `/v2` 매핑은 추가하지만, 기본 composition은 `DisabledVideoProvider`다. 테스트는 injected fake fetch와 fake media broker만 사용하며 실제 API 호출, 사용자 이미지 전송, provider 결과 다운로드 또는 MP4 UI는 없다. 설계는 [21-video-provider-v1-architecture.md](./21-video-provider-v1-architecture.md)에 있다.
- `video-job.v1`은 client request idempotency, `reserve → submit → CAS finalize`, stale/ambiguous outcome, refresh/cancel 경쟁과 redacted event 계약을 추가한다. test-only in-memory repository만 존재하며 production composition에는 연결하지 않는다. 설계는 [22-video-job-orchestration-architecture.md](./22-video-job-orchestration-architecture.md)에 있다.
- Wan2.2도 라이선스 하나만으로 상업 사용, 학습 재사용, 보존·삭제, 운영 비용, 호스팅 지역 또는 안전 심사를 승인한 것으로 간주하지 않는다.
- 기존 이미지 선택 결과를 미래 영상 입력으로 넘길 때는 최신 `batchId`, `variantId`, `selectionRevision`, source digest와 dimensions를 서버에서 다시 검증해야 한다.
- 리터치 `retouch-protocol.v1` U9–U12는 별개의 권리·보존·안전 게이트이며 이 조사로 활성화되지 않는다.

## 다음 실행 게이트

1. D-001 owner와 deadline을 정하고 MiniMax 오픈 가중치 formal license를 신청할지, hosted API 실사 또는 Wan2.2 벤치마크를 진행할지 결정한다.
2. Wan2.2 실행이 가능한 격리 GPU 또는 승인된 호스팅 환경과 비용 상한을 확보한다.
3. 권리를 보유한 비식별 9:16 fixture 한 장으로 4–15초 세로 I2V 품질·지연·VRAM·실패·삭제 증거를 기록한다.
4. 데이터 사용, 보존/삭제, 상업 사용, 지역, 워터마크와 출력 provenance를 서면 검토한다.
5. `video-job.v1`의 논리 durable schema와 오프라인 orchestration 다음 단계로 DB 엔진/migration, stale-reservation reconciler, private media broker, 비용 한도와 provider 실사 증거를 승인한다. 그 뒤에만 HTTP/UI와 실제 private MP4 delivery를 연결한다.

## 공식 출처

확인일: 2026-08-24.

- [MiniMax H3 공식 모델 카드](https://huggingface.co/MiniMaxAI/MiniMax-H3)
- [Hugging Face Diffusers MiniMax H3 공식 문서](https://huggingface.co/docs/diffusers/main/en/api/pipelines/minimax_h3)
- [MiniMax H3 Community License Agreement](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE)
- [MiniMax H3 License Q&A](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/docs/QA-about-License.md)
- [MiniMax H3 공식 FAQ](https://design.minimax.io/h3)
- [MiniMax H3 `/v2` create](https://platform.minimax.io/docs/api-reference/video-generation-v2-create)
- [MiniMax H3 `/v2` query](https://platform.minimax.io/docs/api-reference/video-generation-v2-query)
- [MiniMax H3 `/v2` cancel/delete](https://platform.minimax.io/docs/api-reference/video-generation-v2-delete)
- [Wan2.2 공식 저장소와 실행 조건](https://github.com/Wan-Video/Wan2.2)
- [Wan2.2 TI2V-5B 공식 모델 카드](https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B)
- [Wan2.2 Apache-2.0 LICENSE](https://github.com/Wan-Video/Wan2.2/blob/main/LICENSE.txt)
