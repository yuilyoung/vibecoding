import { ImageBatchService } from "./business/image-batch-service.mjs";
import { StudioPhotoProjectAdapter } from "./data/studio-photo-project-adapter.mjs";

export function createImageBatchService(studioService, overrides = {}) {
  const imageProjectGateway = overrides.imageProjectGateway ?? new StudioPhotoProjectAdapter(studioService);
  return new ImageBatchService({ imageProjectGateway, ...(overrides.now ? { now: overrides.now } : {}) });
}
