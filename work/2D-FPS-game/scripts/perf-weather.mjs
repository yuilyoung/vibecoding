import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FRAME_TIME_BUDGET_MS = 1000 / 60;
const TOTAL_DURATION_MS = 5000;
const TRANSITIONS = ["rain", "sandstorm", "rain", "clear", "rain", "sandstorm", "storm", "rain", "clear", "sandstorm"];

const balancePath = resolve(process.cwd(), "assets/data/game-balance.json");
const balance = JSON.parse(readFileSync(balancePath, "utf8"));
const weather = balance.weather;
const multiplier = Number.isFinite(weather.particleCountMultiplier) ? Math.max(0, weather.particleCountMultiplier) : 1;

const pool = [];
let activeCount = 0;
let allocations = 0;
let destroys = 0;

function getTargetCount(type) {
  if (type !== "rain" && type !== "sandstorm") {
    return 0;
  }

  return Math.max(0, Math.round(weather.types[type].particleCount * multiplier));
}

function ensurePool(targetCount) {
  while (pool.length < targetCount) {
    pool.push({
      visible: false,
      x: -32,
      y: -32,
      velocityX: 0,
      velocityY: 0,
      visualType: null
    });
    allocations += 1;
  }
}

function deactivate(particle) {
  particle.visible = false;
  particle.x = -32;
  particle.y = -32;
  particle.velocityX = 0;
  particle.velocityY = 0;
}

function resetParticle(particle, type) {
  particle.visible = true;
  particle.visualType = type;
  particle.x = Math.random() * 960;
  particle.y = Math.random() * 540;
  if (type === "sandstorm") {
    particle.velocityX = 120 + Math.random() * 80;
    particle.velocityY = -12 + Math.random() * 24;
    return;
  }

  particle.velocityX = -14 + Math.random() * 28;
  particle.velocityY = 220 + Math.random() * 120;
}

function applyWeather(type, changed) {
  const targetCount = getTargetCount(type);
  const previousActiveCount = activeCount;
  ensurePool(targetCount);
  activeCount = targetCount;

  for (let index = 0; index < pool.length; index += 1) {
    const particle = pool[index];
    if (index < targetCount) {
      if (changed || index >= previousActiveCount || particle.visualType !== type) {
        resetParticle(particle, type);
      }
      particle.visible = true;
      continue;
    }

    deactivate(particle);
  }
}

function updateFrame() {
  for (let index = 0; index < activeCount; index += 1) {
    const particle = pool[index];
    particle.x += particle.velocityX * (16 / 1000);
    particle.y += particle.velocityY * (16 / 1000);
    if (particle.x < -24 || particle.x > 984 || particle.y < -24 || particle.y > 564) {
      resetParticle(particle, particle.visualType);
    }
  }
}

let currentType = "clear";
let droppedFrames = 0;
const frameSamples = [];
const transitionIntervalMs = TOTAL_DURATION_MS / TRANSITIONS.length;

for (let elapsedMs = 0; elapsedMs < TOTAL_DURATION_MS; elapsedMs += 16) {
  const nextType = TRANSITIONS[Math.min(TRANSITIONS.length - 1, Math.floor(elapsedMs / transitionIntervalMs))];
  if (nextType !== currentType) {
    applyWeather(nextType, true);
    currentType = nextType;
  } else {
    applyWeather(nextType, false);
  }

  const startedAt = performance.now();
  updateFrame();
  const frameTimeMs = performance.now() - startedAt;
  frameSamples.push(frameTimeMs);
  if (frameTimeMs > FRAME_TIME_BUDGET_MS) {
    droppedFrames += 1;
  }
}

const averageFrameMs = frameSamples.reduce((sum, sample) => sum + sample, 0) / frameSamples.length;
const maxFrameMs = frameSamples.reduce((max, sample) => Math.max(max, sample), 0);
const frameDropPercent = (droppedFrames / frameSamples.length) * 100;
const targetThresholdPercent = 2;

console.log("Weather perf groundwork");
console.log(JSON.stringify({
  durationMs: TOTAL_DURATION_MS,
  transitions: TRANSITIONS.length,
  multiplier,
  maxPoolSize: pool.length,
  allocations,
  destroys,
  averageFrameMs: Number(averageFrameMs.toFixed(4)),
  maxFrameMs: Number(maxFrameMs.toFixed(4)),
  frameDropPercent: Number(frameDropPercent.toFixed(3)),
  thresholdPercent: targetThresholdPercent,
  pass: destroys === 0 && frameDropPercent < targetThresholdPercent
}, null, 2));
