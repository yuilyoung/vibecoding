const PRIVATE_KEY_BLOCK = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/i;
const SSH_PUBLIC_KEY = /\bssh-(?:rsa|ed25519|ecdsa-[a-z0-9-]+)\s+[a-z0-9+/]{40,}={0,3}/i;
const COMPACT_SENSITIVE_NAME = String.raw`[a-z0-9_.-]*(?:api[_-]?key|token|secret|password|passwd|authorization|private[_-]?key|access[_-]?key|auth[_-]?key)[a-z0-9_.-]*`;
const SPACED_SENSITIVE_NAME = String.raw`(?:[a-z0-9]+\s+){0,2}(?:api\s+key|secret\s+(?:access\s+)?key|access\s+key|client\s+secret|private\s+key|auth(?:orization)?\s+token|access\s+token|password)`;
const SENSITIVE_NAME = String.raw`(?:${COMPACT_SENSITIVE_NAME}|${SPACED_SENSITIVE_NAME})`;
const assignmentPattern = () => new RegExp(String.raw`(?:["']?\b${SENSITIVE_NAME}\b["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n,;]+)`, "gi");
const authorizationPattern = () => /\b(?:basic|bearer)\s+[a-z0-9._~+/=-]{4,}/gi;
const providerTokenPattern = () => /\b(?:sk-(?:proj-)?[a-z0-9_-]{8,}|(?:akia|asia)[a-z0-9]{16}|aiza[a-z0-9_-]{20,}|xox[baprs]-[a-z0-9-]{8,}|(?:gh[pousr]|github_pat|lsv2)_[a-z0-9_-]{8,}|glpat-[a-z0-9_-]{8,}|npm_[a-z0-9_-]{8,}|pypi-[a-z0-9_-]{12,}|eyj[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,})\b/gi;
const credentialUrlPattern = () => /(:\/\/)[^\s/:]+:[^\s@]+@/gi;

export const hasSensitiveContent = (value) => {
  const text = String(value ?? "");
  return PRIVATE_KEY_BLOCK.test(text)
    || SSH_PUBLIC_KEY.test(text)
    || assignmentPattern().test(text)
    || authorizationPattern().test(text)
    || providerTokenPattern().test(text)
    || credentialUrlPattern().test(text);
};

export const redactSensitiveText = (value) => {
  const raw = String(value ?? "");
  if (PRIVATE_KEY_BLOCK.test(raw) || SSH_PUBLIC_KEY.test(raw)) return "[sensitive content omitted]";
  const redacted = raw
    .replace(assignmentPattern(), "[REDACTED]")
    .replace(authorizationPattern(), "[REDACTED]")
    .replace(providerTokenPattern(), "[REDACTED]")
    .replace(credentialUrlPattern(), "$1[REDACTED]@");
  return hasSensitiveContent(redacted) ? "[sensitive content omitted]" : redacted;
};

export const createBoundedPromptPreview = (value, maximum = 160) => {
  const raw = String(value ?? ""), originalLength = [...raw].length;
  const redacted = redactSensitiveText(raw), points = [...redacted], preview = points.slice(0, maximum).join("");
  const suppressed = redacted === "[sensitive content omitted]";
  return {
    preview,
    originalLength,
    capturedLength: [...preview].length,
    lengthUnit: "unicode-code-points",
    truncated: points.length > maximum,
    redactionStatus: suppressed ? "suppressed" : redacted === raw ? "clean" : "redacted",
  };
};
