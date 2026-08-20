import { IMAGE_PROJECT_PROTOCOL, readStoredPersonalImageProject, type PersonalImageProject, type PersonalImageProjectRepository } from "../business/image-project.ts";

type ProjectStorage = Pick<Storage, "getItem" | "setItem">;

export class LocalImageProjectRepository implements PersonalImageProjectRepository {
  private readonly storage: ProjectStorage;

  constructor(storage: ProjectStorage = window.sessionStorage) {
    this.storage = storage;
  }

  async get(batchId: string) {
    const serialized = this.storage.getItem(this.key(batchId));
    if (!serialized) return null;
    try {
      const project = readStoredPersonalImageProject(JSON.parse(serialized));
      return project?.batchId === batchId ? project : null;
    } catch {
      return null;
    }
  }

  async save(project: PersonalImageProject, signal?: AbortSignal) {
    if (signal?.aborted) throw new DOMException("Project save cancelled.", "AbortError");
    if (project.protocolVersion !== IMAGE_PROJECT_PROTOCOL) throw new Error("지원하지 않는 프로젝트 저장 버전입니다.");
    const canonical = readStoredPersonalImageProject(project);
    if (!canonical) throw new Error("프로젝트 저장 데이터가 올바르지 않습니다.");
    if (signal?.aborted) throw new DOMException("Project save cancelled.", "AbortError");
    this.storage.setItem(this.key(canonical.batchId), JSON.stringify(canonical));
    return readStoredPersonalImageProject(canonical)!;
  }

  private key(batchId: string) {
    return `animation-real-studio.image-project.${batchId}`;
  }
}
