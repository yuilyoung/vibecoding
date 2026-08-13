import type { ImageBatchRepository } from "../business/image-batch";
import { ImageBatchStudio } from "./ImageBatchStudio";

export function ImageGenerationWorkspace({ repository, navigate }: { repository: ImageBatchRepository; navigate: (route: string) => void }) {
  return <div className="generation-workspace"><ImageBatchStudio repository={repository} onContinue={(batchId) => navigate(`/image-projects/${batchId}`)} /></div>;
}
