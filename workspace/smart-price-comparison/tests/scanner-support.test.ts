import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BarcodeDetectorScanner,
  isScannerRuntimeSupported,
} from "../src/data/barcode-detector-scanner";

interface ScannerHarness {
  detect: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  removeOverlay: ReturnType<typeof vi.fn>;
}

const installScannerHarness = (
  detectedValues: Array<{ rawValue: string }>,
): ScannerHarness => {
  const detect = vi.fn(async () => detectedValues);
  const stop = vi.fn();
  const removeOverlay = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  const video = {
    autoplay: false,
    muted: false,
    playsInline: false,
    srcObject: null,
    play: vi.fn(async () => undefined),
  } as unknown as HTMLVideoElement;
  const overlay = {
    className: "",
    innerHTML: "",
    prepend: vi.fn(),
    remove: removeOverlay,
  } as unknown as HTMLDivElement;

  class FakeBarcodeDetector {
    detect = detect;
  }

  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn(async () => stream) },
  });
  vi.stubGlobal("document", {
    createElement: vi.fn((tag: string) => tag === "video" ? video : overlay),
    body: { append: vi.fn() },
  });
  vi.stubGlobal("window", {
    isSecureContext: true,
    BarcodeDetector: FakeBarcodeDetector,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (callback: FrameRequestCallback) =>
      setTimeout(() => callback(performance.now()), 0) as unknown as number,
    cancelAnimationFrame: (id: number) => clearTimeout(id),
  });

  return { detect, stop, removeOverlay };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scanner support gate", () => {
  it("requires secure context, camera, and BarcodeDetector together", () => {
    expect(isScannerRuntimeSupported({ isSecureContext: true, hasMediaDevices: true, hasBarcodeDetector: true })).toBe(true);
    expect(isScannerRuntimeSupported({ isSecureContext: false, hasMediaDevices: true, hasBarcodeDetector: true })).toBe(false);
    expect(isScannerRuntimeSupported({ isSecureContext: true, hasMediaDevices: false, hasBarcodeDetector: true })).toBe(false);
    expect(isScannerRuntimeSupported({ isSecureContext: true, hasMediaDevices: true, hasBarcodeDetector: false })).toBe(false);
  });

  it("returns the first code and always removes the overlay and camera track", async () => {
    const harness = installScannerHarness([{ rawValue: " 8801234567890 " }]);
    const code = await new BarcodeDetectorScanner().scan(new AbortController().signal, 1_000);

    expect(code).toBe("8801234567890");
    expect(harness.detect).toHaveBeenCalledTimes(1);
    expect(harness.stop).toHaveBeenCalledTimes(1);
    expect(harness.removeOverlay).toHaveBeenCalledTimes(1);
  });

  it("times out once, cleans resources, and stops scheduling detection", async () => {
    const harness = installScannerHarness([]);
    const scan = new BarcodeDetectorScanner().scan(new AbortController().signal, 15);

    await expect(scan).rejects.toMatchObject({ code: "timed-out" });
    const callsAtTimeout = harness.detect.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(harness.detect.mock.calls.length).toBe(callsAtTimeout);
    expect(harness.stop).toHaveBeenCalledTimes(1);
    expect(harness.removeOverlay).toHaveBeenCalledTimes(1);
  });

  it("aborts once and cleans resources without a post-abort detection call", async () => {
    const harness = installScannerHarness([]);
    const controller = new AbortController();
    const scan = new BarcodeDetectorScanner().scan(controller.signal, 1_000);
    await new Promise((resolve) => setTimeout(resolve, 5));
    controller.abort();

    await expect(scan).rejects.toMatchObject({ code: "cancelled" });
    const callsAtAbort = harness.detect.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(harness.detect.mock.calls.length).toBe(callsAtAbort);
    expect(harness.stop).toHaveBeenCalledTimes(1);
    expect(harness.removeOverlay).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported mode before requesting a camera", async () => {
    vi.stubGlobal("navigator", { mediaDevices: undefined });
    vi.stubGlobal("window", { isSecureContext: false, BarcodeDetector: undefined });
    const scan = new BarcodeDetectorScanner().scan(new AbortController().signal, 10);
    await expect(scan).rejects.toMatchObject({ code: "unsupported" });
  });
});
