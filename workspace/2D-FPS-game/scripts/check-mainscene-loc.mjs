import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const maxLines = 850;
const target = resolve(process.cwd(), "src/scenes/MainScene.ts");
const contents = readFileSync(target, "utf8");
const lineCount = contents.split(/\r?\n/).length;

if (lineCount > maxLines) {
  console.error(`MainScene.ts line count ${lineCount} exceeds limit ${maxLines}.`);
  process.exit(1);
}

console.log(`MainScene.ts line count ${lineCount}/${maxLines}.`);
