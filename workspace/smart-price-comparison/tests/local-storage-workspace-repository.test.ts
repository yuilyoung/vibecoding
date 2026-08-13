import { describe, expect, it } from "vitest";
import {
  LocalStorageWorkspaceRepository,
  WORKSPACE_STORAGE_KEY,
} from "../src/data/local-storage-workspace-repository";
import { createDefaultWorkspace } from "../src/data/sample-data";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("local workspace repository", () => {
  it("returns null when no saved snapshot exists", () => {
    expect(new LocalStorageWorkspaceRepository(new MemoryStorage()).load()).toBeNull();
  });

  it("round-trips a versioned snapshot without sharing the parsed object", () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageWorkspaceRepository(storage);
    const workspace = createDefaultWorkspace();
    repository.save(workspace);
    const loaded = repository.load();

    expect(loaded).toEqual(workspace);
    expect(loaded).not.toBe(workspace);
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toContain('"schemaVersion":1');
  });

  it("rejects corrupt or unsupported snapshots", () => {
    const storage = new MemoryStorage();
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ schemaVersion: 2 }));
    expect(() => new LocalStorageWorkspaceRepository(storage).load()).toThrow(/형식/);
  });

  it("rejects negative money, non-positive quantities, and duplicate ids", () => {
    const invalidSnapshots = [
      { ...createDefaultWorkspace(), menuDraft: { ...createDefaultWorkspace().menuDraft, laborCost: -1 } },
      {
        ...createDefaultWorkspace(),
        products: createDefaultWorkspace().products.map((product, index) =>
          index === 0 ? { ...product, quantity: 0 } : product,
        ),
      },
      {
        ...createDefaultWorkspace(),
        products: createDefaultWorkspace().products.map((product) => ({ ...product, id: "duplicate" })),
      },
    ];

    for (const snapshot of invalidSnapshots) {
      const storage = new MemoryStorage();
      storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
      expect(() => new LocalStorageWorkspaceRepository(storage).load()).toThrow(/형식/);
    }
  });
});
