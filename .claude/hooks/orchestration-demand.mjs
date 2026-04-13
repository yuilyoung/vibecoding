import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const stateDir = path.join(projectDir, ".claude", "state");
const statePath = path.join(stateDir, "orchestration-required.json");

const rawInput = readFileSync(0, "utf8");
const payload = rawInput.length > 0 ? JSON.parse(rawInput) : {};

const collectStrings = (value, output) => {
  if (typeof value === "string") {
    output.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, output);
    }
    return;
  }

  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) {
      collectStrings(nested, output);
    }
  }
};

const texts = [];
collectStrings(payload, texts);
const normalized = texts.join("\n").toLowerCase();

const orchestrationSignals = [
  "\uc11c\ube0c\uc5d0\uc774\uc804\ud2b8",
  "subagent",
  "sub-agent",
  "\uc804\ubb38 \uc5d0\uc774\uc804\ud2b8",
  "\uc804\ubb38 \uc5d0\uc774\uc804\ud2b8\ub4e4",
  "\uc804\ubb38\uac00",
  "\uc804\ubb38 \ubd84\uc57c",
  "\uac01 \uc804\ubb38",
  "\uac01 \ub3c4\uba54\uc778",
  "\ub3c4\uba54\uc778",
  "\ub3c4\uba54\uc778 \uc804\ubb38\uac00",
  "\uac8c\uc784 \uac1c\ubc1c\ud300",
  "\uac8c\uc784 \uac1c\ubc1c",
  "\uac1c\ubc1c\ud300",
  "\ubcd1\ub82c",
  "parallel",
  "orchestr",
  "delegate",
  "designer",
  "reviewer",
  "tester",
  "unity developer",
  "unity-developer",
  "artist",
  "sounder",
  "texture-modeler",
  "modeler",
  "pixel-2d-expert"
];

const shouldRequireOrchestration = orchestrationSignals.some((signal) => normalized.includes(signal));

if (!shouldRequireOrchestration) {
  rmSync(statePath, { force: true });
  process.exit(0);
}

mkdirSync(stateDir, { recursive: true });

const state = {
  required: true,
  reason: "domain-subagent-orchestration-required",
  createdAt: new Date().toISOString()
};

writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    additionalContext: "[ORCHESTRATION] This user request requires domain subagent orchestration. Do not directly implement changes in work/2D-FPS-game from the main agent. First delegate to the relevant specialist subagents and coordinate their work."
  }
}));
