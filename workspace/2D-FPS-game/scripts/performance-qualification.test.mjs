import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePerformanceQualification } from "./performance-qualification.mjs";

const capture = (sequence, route, overrides = {}) => ({
  sequence,
  route,
  summary: { sampleCount: 1800, p50Ms: 16.7, p95Ms: 16.9 },
  rawFrameDeltasMs: [16.6, 16.7, 16.9],
  fixedScene: { renderer: { unmaskedRenderer: "ANGLE (NVIDIA, Direct3D11, D3D11)" } },
  ...overrides
});

const captures = (overrides = {}) => [
  capture(1, "legacy", overrides),
  capture(2, "animated", overrides),
  capture(3, "animated", overrides),
  capture(4, "legacy", overrides),
  capture(5, "legacy", overrides),
  capture(6, "animated", overrides)
];

const comparisonPairs = (captureSet) => [0, 1, 2].map((pairIndex) => {
  const pairCaptures = captureSet.slice(pairIndex * 2, pairIndex * 2 + 2);
  const legacy = pairCaptures.find((entry) => entry.route === "legacy");
  const animated = pairCaptures.find((entry) => entry.route === "animated");
  assert.ok(legacy);
  assert.ok(animated);
  return {
    pair: pairIndex + 1,
    order: pairCaptures.map((entry) => entry.route),
    legacyP95Ms: legacy.summary.p95Ms,
    animatedP95Ms: animated.summary.p95Ms,
    deltaMs: Number((animated.summary.p95Ms - legacy.summary.p95Ms).toFixed(3))
  };
});

test("preserves the absolute failure while qualifying a stable 60Hz D3D11 cadence", () => {
  const captureSet = captures();
  const result = evaluatePerformanceQualification(captureSet, comparisonPairs(captureSet));
  assert.equal(result.absolutePassed, false);
  assert.equal(result.cadenceQualified, true);
  assert.equal(result.qualification, "display-cadence-exception");
  assert.equal(result.passed, true);
  assert.equal(result.absoluteFailures.length, 3);
});

test("passes the original absolute contract when animated p95 is within 16.7ms", () => {
  const captureSet = captures({
    summary: { sampleCount: 1800, p50Ms: 16.6, p95Ms: 16.7 }
  });
  const result = evaluatePerformanceQualification(captureSet, comparisonPairs(captureSet));
  assert.equal(result.absolutePassed, true);
  assert.equal(result.qualification, "absolute");
});

test("rejects missed refreshes, short captures, and non-D3D11 renderers", () => {
  const short = captures();
  short[0] = capture(1, "legacy", {
    summary: { sampleCount: 1789, p50Ms: 16.7, p95Ms: 16.9 },
    rawFrameDeltasMs: [16.7, 25.1],
    fixedScene: { renderer: { unmaskedRenderer: "SwiftShader" } }
  });
  const result = evaluatePerformanceQualification(short, comparisonPairs(short));
  assert.equal(result.cadenceQualified, false);
  assert.match(result.cadenceFailures.join("\n"), /hardware D3D11/);
  assert.match(result.cadenceFailures.join("\n"), /cadence minimum/);
  assert.match(result.cadenceFailures.join("\n"), /frames exceeded 25ms/);
});

test("rejects p95 beyond one qualified refresh and animated regression", () => {
  const slow = captures();
  slow[2] = capture(3, "animated", {
    summary: { sampleCount: 1800, p50Ms: 16.7, p95Ms: 18.1 }
  });
  const result = evaluatePerformanceQualification(slow, comparisonPairs(slow));
  assert.equal(result.cadenceQualified, false);
  assert.match(result.cadenceFailures.join("\n"), /one qualified refresh/);
  assert.match(result.cadenceFailures.join("\n"), /regression 1.2ms/);
});

test("common runtime failures prevent both qualification paths", () => {
  const captureSet = captures({
    summary: { sampleCount: 1800, p50Ms: 16.6, p95Ms: 16.7 }
  });
  const result = evaluatePerformanceQualification(captureSet, comparisonPairs(captureSet), ["console error"]);
  assert.equal(result.absolutePassed, false);
  assert.equal(result.cadenceQualified, false);
  assert.equal(result.qualification, "failed");
});

test("rejects six captures that do not follow the exact AB/BA/AB route order", () => {
  const invalidCaptures = Array.from({ length: 6 }, (_, index) => capture(index + 1, "animated"));
  const result = evaluatePerformanceQualification(invalidCaptures, []);
  assert.equal(result.cadenceQualified, false);
  assert.match(result.cadenceFailures.join("\n"), /expected sequence\/route/);
  assert.match(result.cadenceFailures.join("\n"), /expected three AB\/BA\/AB comparison pairs/);
});

test("rejects pair metadata that does not match the ordered capture summaries", () => {
  const captureSet = captures();
  const invalidPairs = comparisonPairs(captureSet).map((pair) => ({ ...pair }));
  invalidPairs[1].order = ["legacy", "animated"];
  invalidPairs[2].deltaMs = 0.5;
  const result = evaluatePerformanceQualification(captureSet, invalidPairs);
  assert.equal(result.cadenceQualified, false);
  assert.match(result.cadenceFailures.join("\n"), /comparison order/);
  assert.match(result.cadenceFailures.join("\n"), /comparison values/);
});
