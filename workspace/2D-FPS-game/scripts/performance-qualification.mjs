export const PERFORMANCE_QUALIFICATION_LIMITS = Object.freeze({
  absoluteP95Ms: 16.7,
  cadenceP95Ms: 16.9,
  cadenceP50MinMs: 16.4,
  cadenceP50MaxMs: 16.9,
  cadenceMinSampleCount: 1790,
  missedRefreshThresholdMs: 25,
  regressionMs: 1
});

const EXPECTED_CAPTURE_ROUTES = Object.freeze([
  "legacy",
  "animated",
  "animated",
  "legacy",
  "legacy",
  "animated"
]);
const EXPECTED_PAIR_ORDERS = Object.freeze([
  Object.freeze(["legacy", "animated"]),
  Object.freeze(["animated", "legacy"]),
  Object.freeze(["legacy", "animated"])
]);
const round = (value, digits = 3) => Number(value.toFixed(digits));

const isD3D11Capture = (capture) => /direct3d11|d3d11/i.test(
  capture.fixedScene?.renderer?.unmaskedRenderer ?? ""
);

export function evaluatePerformanceQualification(captures, pairs, commonFailures = []) {
  const absoluteFailures = [];
  const cadenceFailures = [];
  const limits = PERFORMANCE_QUALIFICATION_LIMITS;

  for (const capture of captures) {
    const prefix = `capture ${capture.sequence} (${capture.route})`;
    if (capture.route === "animated" && capture.summary.p95Ms > limits.absoluteP95Ms) {
      absoluteFailures.push(`${prefix}: p95 ${capture.summary.p95Ms}ms exceeds ${limits.absoluteP95Ms}ms`);
    }
    if (!isD3D11Capture(capture)) {
      cadenceFailures.push(`${prefix}: display-cadence qualification requires hardware D3D11`);
    }
    if (capture.summary.sampleCount < limits.cadenceMinSampleCount) {
      cadenceFailures.push(`${prefix}: only ${capture.summary.sampleCount} samples; cadence minimum is ${limits.cadenceMinSampleCount}`);
    }
    if (capture.summary.p50Ms < limits.cadenceP50MinMs || capture.summary.p50Ms > limits.cadenceP50MaxMs) {
      cadenceFailures.push(`${prefix}: p50 ${capture.summary.p50Ms}ms is outside the declared 60Hz cadence band`);
    }
    if (capture.summary.p95Ms > limits.cadenceP95Ms) {
      cadenceFailures.push(`${prefix}: p95 ${capture.summary.p95Ms}ms exceeds one qualified refresh interval (${limits.cadenceP95Ms}ms)`);
    }
    const missedRefreshCount = capture.rawFrameDeltasMs.filter(
      (delta) => delta > limits.missedRefreshThresholdMs
    ).length;
    if (missedRefreshCount > 0) {
      cadenceFailures.push(`${prefix}: ${missedRefreshCount} frames exceeded ${limits.missedRefreshThresholdMs}ms`);
    }
  }

  if (captures.length !== 6) {
    cadenceFailures.push(`expected six AB/BA/AB captures, received ${captures.length}`);
  }

  for (let index = 0; index < EXPECTED_CAPTURE_ROUTES.length; index += 1) {
    const capture = captures[index];
    const expectedRoute = EXPECTED_CAPTURE_ROUTES[index];
    if (capture === undefined) continue;
    if (capture.sequence !== index + 1 || capture.route !== expectedRoute) {
      cadenceFailures.push(
        `capture ${index + 1}: expected sequence/route ${index + 1}/${expectedRoute}, received ${capture.sequence}/${capture.route}`
      );
    }
  }

  if (pairs.length !== 3) {
    cadenceFailures.push(`expected three AB/BA/AB comparison pairs, received ${pairs.length}`);
  }

  for (let pairIndex = 0; pairIndex < EXPECTED_PAIR_ORDERS.length; pairIndex += 1) {
    const pair = pairs[pairIndex];
    const expectedOrder = EXPECTED_PAIR_ORDERS[pairIndex];
    const pairCaptures = captures.slice(pairIndex * 2, pairIndex * 2 + 2);
    const legacy = pairCaptures.find((entry) => entry.route === "legacy");
    const animated = pairCaptures.find((entry) => entry.route === "animated");
    if (pair === undefined || legacy === undefined || animated === undefined) continue;
    const pairOrder = Array.isArray(pair.order) ? pair.order : [];
    if (pair.pair !== pairIndex + 1 || pairOrder.length !== 2 ||
      pairOrder[0] !== expectedOrder[0] || pairOrder[1] !== expectedOrder[1]) {
      cadenceFailures.push(`pair ${pairIndex + 1}: comparison order does not match ${expectedOrder.join(" -> ")}`);
    }
    const expectedDeltaMs = round(animated.summary.p95Ms - legacy.summary.p95Ms);
    if (pair.legacyP95Ms !== legacy.summary.p95Ms || pair.animatedP95Ms !== animated.summary.p95Ms ||
      pair.deltaMs !== expectedDeltaMs) {
      cadenceFailures.push(`pair ${pairIndex + 1}: comparison values do not match their capture summaries`);
    }
    if (expectedDeltaMs > limits.regressionMs) {
      cadenceFailures.push(`pair ${pairIndex + 1}: animated regression ${expectedDeltaMs}ms exceeds ${limits.regressionMs}ms`);
    }
  }

  const commonPassed = commonFailures.length === 0;
  const absolutePassed = commonPassed && absoluteFailures.length === 0;
  const cadenceQualified = commonPassed && cadenceFailures.length === 0;
  const qualification = absolutePassed
    ? "absolute"
    : cadenceQualified
      ? "display-cadence-exception"
      : "failed";

  return Object.freeze({
    absolutePassed,
    cadenceQualified,
    qualification,
    absoluteFailures: Object.freeze(absoluteFailures),
    cadenceFailures: Object.freeze(cadenceFailures),
    passed: absolutePassed || cadenceQualified
  });
}
