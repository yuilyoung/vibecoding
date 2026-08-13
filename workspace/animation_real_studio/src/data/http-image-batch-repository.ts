import type { ImageBatch, ImageBatchDraft, ImageBatchRepository } from "../business/image-batch";

type ErrorBody = { error?: string; message?: string; errors?: Array<{ message?: string }> };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const body = await response.json() as T & ErrorBody;
  if (!response.ok) throw new Error(body.message ?? body.errors?.[0]?.message ?? body.error ?? "Image batch request failed.");
  return body;
}

export class HttpImageBatchRepository implements ImageBatchRepository {
  async create(draft: ImageBatchDraft, signal?: AbortSignal) {
    return (await request<{ batch: ImageBatch }>("/api/image-batches", { method: "POST", body: JSON.stringify(draft), signal })).batch;
  }
  async get(batchId: string, signal?: AbortSignal) {
    return (await request<{ batch: ImageBatch }>(`/api/image-batches/${batchId}`, { signal })).batch;
  }
  async select(batchId: string, variantId: string, signal?: AbortSignal) {
    return (await request<{ batch: ImageBatch }>(`/api/image-batches/${batchId}/selection`, { method: "POST", body: JSON.stringify({ variantId }), signal })).batch;
  }
}
