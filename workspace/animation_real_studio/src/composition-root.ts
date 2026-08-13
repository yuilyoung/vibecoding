import { HttpImageBatchRepository } from "./data/http-image-batch-repository";
import { LocalImageProjectRepository } from "./data/local-image-project-repository";

export const applicationServices = Object.freeze({
  imageBatchRepository: new HttpImageBatchRepository(),
  imageProjectRepository: new LocalImageProjectRepository(),
});
