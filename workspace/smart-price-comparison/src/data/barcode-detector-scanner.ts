import { ScannerError, type IProductCodeScanner } from "../business/ports";

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

export interface ScannerRuntimeSupport {
  isSecureContext: boolean;
  hasMediaDevices: boolean;
  hasBarcodeDetector: boolean;
}

export const isScannerRuntimeSupported = (runtime: ScannerRuntimeSupport): boolean =>
  runtime.isSecureContext && runtime.hasMediaDevices && runtime.hasBarcodeDetector;

const scannerError = (error: unknown): ScannerError => {
  if (error instanceof ScannerError) return error;
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return new ScannerError("permission-denied", "카메라 권한이 거부되었습니다.");
  }
  return new ScannerError("unavailable", "카메라를 시작할 수 없습니다.");
};

export class BarcodeDetectorScanner implements IProductCodeScanner {
  isSupported(): boolean {
    return isScannerRuntimeSupported({
      isSecureContext: window.isSecureContext,
      hasMediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
      hasBarcodeDetector: Boolean(window.BarcodeDetector),
    });
  }

  async scan(signal: AbortSignal, timeoutMs: number): Promise<string> {
    if (!this.isSupported() || !window.BarcodeDetector) {
      throw new ScannerError("unsupported", "이 브라우저에서는 카메라 스캔을 지원하지 않습니다.");
    }

    return await new Promise<string>((resolve, reject) => {
      let stream: MediaStream | null = null;
      let overlay: HTMLDivElement | null = null;
      let frameId: number | null = null;
      let timeoutId: number | null = null;
      let settled = false;

      const cleanup = () => {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        if (frameId !== null) window.cancelAnimationFrame(frameId);
        signal.removeEventListener("abort", onAbort);
        stream?.getTracks().forEach((track) => track.stop());
        stream = null;
        overlay?.remove();
        overlay = null;
      };
      const succeed = (code: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(code);
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(scannerError(error));
      };
      const onAbort = () => fail(new ScannerError("cancelled", "스캔이 취소되었습니다."));

      signal.addEventListener("abort", onAbort, { once: true });
      timeoutId = window.setTimeout(
        () => fail(new ScannerError("timed-out", "15초 동안 코드를 찾지 못했습니다.")),
        Math.max(1, timeoutMs),
      );
      if (signal.aborted) {
        onAbort();
        return;
      }

      void (async () => {
        try {
          const acquiredStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          if (settled) {
            acquiredStream.getTracks().forEach((track) => track.stop());
            return;
          }
          stream = acquiredStream;

          const video = document.createElement("video");
          video.autoplay = true;
          video.muted = true;
          video.playsInline = true;
          video.srcObject = stream;
          overlay = document.createElement("div");
          overlay.className = "native-scanner-overlay";
          overlay.innerHTML = '<div class="native-scanner-frame"><span>QR 또는 상품 바코드를 프레임 안에 맞춰주세요</span></div>';
          overlay.prepend(video);
          document.body.append(overlay);
          await video.play();
          if (settled) return;

          const detector = new window.BarcodeDetector!({
            formats: ["qr_code", "ean_13", "ean_8", "upc_a", "upc_e"],
          });
          const detect = async () => {
            if (settled) return;
            try {
              const results = await detector.detect(video);
              if (settled) return;
              const code = results.find((result) => result.rawValue.trim())?.rawValue.trim();
              if (code) succeed(code);
              else frameId = window.requestAnimationFrame(detect);
            } catch (error) {
              fail(error);
            }
          };
          frameId = window.requestAnimationFrame(detect);
        } catch (error) {
          fail(error);
        }
      })();
    });
  }
}
