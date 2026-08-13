import { IMAGE_PROJECT_PROTOCOL, type PersonalImageProject, type PersonalImageProjectRepository } from "../business/image-project.ts";

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
      const project = JSON.parse(serialized) as PersonalImageProject;
      return project.protocolVersion === IMAGE_PROJECT_PROTOCOL && project.batchId === batchId ? project : null;
    } catch {
      return null;
    }
  }

  async save(project: PersonalImageProject) {
    this.storage.setItem(this.key(project.batchId), JSON.stringify(project));
    return { ...project };
  }

  private key(batchId: string) {
    return `animation-real-studio.image-project.${batchId}`;
  }
}
