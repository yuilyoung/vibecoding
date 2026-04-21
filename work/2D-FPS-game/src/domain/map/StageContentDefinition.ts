import type { StageDefinition } from "./StageDefinition";

export type StageHazardKind = "lava" | "steam" | "electric" | "toxic" | "pressure" | "sludge";
export type StagePickupKind = "health" | "ammo" | "boost";
export type StageGateKind = "door" | "barrier" | "switch";
export type StageMapObjectKind = "mine" | "barrel" | "crate";

const MAP_OBJECT_CAPS: Readonly<Record<StageMapObjectKind, number>> = {
  mine: 12,
  barrel: 16,
  crate: Number.POSITIVE_INFINITY
};

export interface StageHazardDefinition {
  readonly id: string;
  readonly kind: StageHazardKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly damage: number;
  readonly tickMs: number;
  readonly label: string;
}

export interface StagePickupDefinition {
  readonly id: string;
  readonly kind: StagePickupKind;
  readonly x: number;
  readonly y: number;
  readonly amount: number;
  readonly respawnMs: number;
  readonly label: string;
}

export interface StageGateDefinition {
  readonly id: string;
  readonly kind: StageGateKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly locked: boolean;
  readonly label: string;
  readonly targetStageId?: string;
}

export interface StageMapObjectDefinition {
  readonly id: string;
  readonly kind: StageMapObjectKind;
  readonly x: number;
  readonly y: number;
}

export interface StageContentDefinition {
  readonly hazards: readonly StageHazardDefinition[];
  readonly pickups: readonly StagePickupDefinition[];
  readonly gates: readonly StageGateDefinition[];
  readonly mapObjects: readonly StageMapObjectDefinition[];
}

export interface StageDefinitionWithContent extends StageDefinition {
  readonly content: StageContentDefinition;
}

export const EMPTY_STAGE_CONTENT: StageContentDefinition = {
  hazards: [],
  pickups: [],
  gates: [],
  mapObjects: []
};

export function createStageContentDefinition(
  overrides: Partial<StageContentDefinition> = {}
): StageContentDefinition {
  return normalizeStageContentDefinition({
    ...EMPTY_STAGE_CONTENT,
    ...overrides
  });
}

export function normalizeStageContentDefinition(content: unknown): StageContentDefinition {
  const source = isRecord(content) ? content : {};

  return {
    hazards: normalizeHazards(source.hazards),
    pickups: normalizePickups(source.pickups),
    gates: normalizeGates(source.gates),
    mapObjects: normalizeMapObjects(source.mapObjects)
  };
}

export function isStageContentDefinition(content: unknown): content is StageContentDefinition {
  if (!isRecord(content)) {
    return false;
  }

  return (
    Array.isArray(content.hazards) &&
    content.hazards.every(isStageHazardDefinition) &&
    Array.isArray(content.pickups) &&
    content.pickups.every(isStagePickupDefinition) &&
    Array.isArray(content.gates) &&
    content.gates.every(isStageGateDefinition) &&
    Array.isArray(content.mapObjects) &&
    content.mapObjects.every(isStageMapObjectDefinition) &&
    isWithinMapObjectCaps(content.mapObjects)
  );
}

function normalizeHazards(value: unknown): StageHazardDefinition[] {
  return normalizeUniqueById(value, normalizeHazardDefinition);
}

function normalizePickups(value: unknown): StagePickupDefinition[] {
  return normalizeUniqueById(value, normalizePickupDefinition);
}

function normalizeGates(value: unknown): StageGateDefinition[] {
  return normalizeUniqueById(value, normalizeGateDefinition);
}

function normalizeMapObjects(value: unknown): StageMapObjectDefinition[] {
  return capMapObjectsByKind(normalizeUniqueById(value, normalizeMapObjectDefinition));
}

function normalizeUniqueById<T extends { readonly id: string }>(
  value: unknown,
  normalizeEntry: (entry: unknown) => T | null
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: T[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const normalized = normalizeEntry(entry);

    if (normalized === null || seen.has(normalized.id)) {
      continue;
    }

    seen.add(normalized.id);
    entries.push(normalized);
  }

  return entries;
}

function normalizeHazardDefinition(entry: unknown): StageHazardDefinition | null {
  const record = asRecord(entry);
  const id = normalizeId(record?.id);
  const kind = normalizeHazardKind(record?.kind);

  if (id === null || kind === null) {
    return null;
  }

  return {
    id,
    kind,
    x: normalizeCoordinate(record?.x),
    y: normalizeCoordinate(record?.y),
    width: normalizeDimension(record?.width),
    height: normalizeDimension(record?.height),
    damage: normalizeValue(record?.damage),
    tickMs: normalizeValue(record?.tickMs),
    label: normalizeLabel(record?.label, id)
  };
}

function normalizePickupDefinition(entry: unknown): StagePickupDefinition | null {
  const record = asRecord(entry);
  const id = normalizeId(record?.id);
  const kind = normalizePickupKind(record?.kind);

  if (id === null || kind === null) {
    return null;
  }

  return {
    id,
    kind,
    x: normalizeCoordinate(record?.x),
    y: normalizeCoordinate(record?.y),
    amount: normalizeValue(record?.amount),
    respawnMs: normalizeValue(record?.respawnMs),
    label: normalizeLabel(record?.label, id)
  };
}

function normalizeGateDefinition(entry: unknown): StageGateDefinition | null {
  const record = asRecord(entry);
  const id = normalizeId(record?.id);
  const kind = normalizeGateKind(record?.kind);

  if (id === null || kind === null) {
    return null;
  }

  return {
    id,
    kind,
    x: normalizeCoordinate(record?.x),
    y: normalizeCoordinate(record?.y),
    width: normalizeDimension(record?.width),
    height: normalizeDimension(record?.height),
    locked: record?.locked === true,
    label: normalizeLabel(record?.label, id),
    targetStageId: normalizeOptionalId(record?.targetStageId) ?? undefined
  };
}

function normalizeMapObjectDefinition(entry: unknown): StageMapObjectDefinition | null {
  const record = asRecord(entry);
  const id = normalizeId(record?.id);
  const kind = normalizeMapObjectKind(record?.kind);

  if (id === null || kind === null) {
    return null;
  }

  return {
    id,
    kind,
    x: normalizeCoordinate(record?.x),
    y: normalizeCoordinate(record?.y)
  };
}

function isStageHazardDefinition(entry: unknown): entry is StageHazardDefinition {
  const record = asRecord(entry);

  return (
    record !== null &&
    isStageHazardKind(record.kind) &&
    isId(record.id) &&
    isFiniteNumber(record.x) &&
    isFiniteNumber(record.y) &&
    isFiniteNumber(record.width) &&
    isFiniteNumber(record.height) &&
    isFiniteNumber(record.damage) &&
    isFiniteNumber(record.tickMs) &&
    isLabel(record.label)
  );
}

function isStagePickupDefinition(entry: unknown): entry is StagePickupDefinition {
  const record = asRecord(entry);

  return (
    record !== null &&
    isStagePickupKind(record.kind) &&
    isId(record.id) &&
    isFiniteNumber(record.x) &&
    isFiniteNumber(record.y) &&
    isFiniteNumber(record.amount) &&
    isFiniteNumber(record.respawnMs) &&
    isLabel(record.label)
  );
}

function isStageGateDefinition(entry: unknown): entry is StageGateDefinition {
  const record = asRecord(entry);

  return (
    record !== null &&
    isStageGateKind(record.kind) &&
    isId(record.id) &&
    isFiniteNumber(record.x) &&
    isFiniteNumber(record.y) &&
    isFiniteNumber(record.width) &&
    isFiniteNumber(record.height) &&
    typeof record.locked === "boolean" &&
    isLabel(record.label) &&
    (record.targetStageId === undefined || isId(record.targetStageId))
  );
}

function isStageMapObjectDefinition(entry: unknown): entry is StageMapObjectDefinition {
  const record = asRecord(entry);

  return (
    record !== null &&
    isStageMapObjectKind(record.kind) &&
    isId(record.id) &&
    isFiniteNumber(record.x) &&
    isFiniteNumber(record.y)
  );
}

function capMapObjectsByKind(mapObjects: readonly StageMapObjectDefinition[]): StageMapObjectDefinition[] {
  const counts: Record<StageMapObjectKind, number> = {
    mine: 0,
    barrel: 0,
    crate: 0
  };
  const capped: StageMapObjectDefinition[] = [];

  for (const mapObject of mapObjects) {
    if (counts[mapObject.kind] >= MAP_OBJECT_CAPS[mapObject.kind]) {
      continue;
    }

    counts[mapObject.kind] += 1;
    capped.push(mapObject);
  }

  return capped;
}

function isWithinMapObjectCaps(mapObjects: readonly StageMapObjectDefinition[]): boolean {
  const counts: Record<StageMapObjectKind, number> = {
    mine: 0,
    barrel: 0,
    crate: 0
  };

  for (const mapObject of mapObjects) {
    counts[mapObject.kind] += 1;

    if (counts[mapObject.kind] > MAP_OBJECT_CAPS[mapObject.kind]) {
      return false;
    }
  }

  return true;
}

function normalizeId(value: unknown): string | null {
  if (!isId(value)) {
    return null;
  }

  return value.trim();
}

function normalizeOptionalId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeLabel(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeCoordinate(value: unknown): number {
  return normalizeInteger(value, 0, 0);
}

function normalizeDimension(value: unknown): number {
  return normalizeInteger(value, 1, 1);
}

function normalizeValue(value: unknown): number {
  return normalizeInteger(value, 0, 0);
}

function normalizeInteger(value: unknown, fallback: number, minimum: number): number {
  if (!isFiniteNumber(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.floor(value));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isLabel(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeHazardKind(value: unknown): StageHazardKind | null {
  return normalizeKind(value, [
    "lava",
    "steam",
    "electric",
    "toxic",
    "pressure",
    "sludge"
  ]);
}

function normalizePickupKind(value: unknown): StagePickupKind | null {
  return normalizeKind(value, ["health", "ammo", "boost"]);
}

function normalizeGateKind(value: unknown): StageGateKind | null {
  return normalizeKind(value, ["door", "barrier", "switch"]);
}

function normalizeMapObjectKind(value: unknown): StageMapObjectKind | null {
  return normalizeKind(value, ["mine", "barrel", "crate"]);
}

function normalizeKind<T extends string>(value: unknown, kinds: readonly T[]): T | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return kinds.includes(normalized as T) ? (normalized as T) : null;
}

function isStageHazardKind(value: unknown): value is StageHazardKind {
  return normalizeHazardKind(value) !== null;
}

function isStagePickupKind(value: unknown): value is StagePickupKind {
  return normalizePickupKind(value) !== null;
}

function isStageGateKind(value: unknown): value is StageGateKind {
  return normalizeGateKind(value) !== null;
}

function isStageMapObjectKind(value: unknown): value is StageMapObjectKind {
  return normalizeMapObjectKind(value) !== null;
}
