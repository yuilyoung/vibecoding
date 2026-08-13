import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { ImageBatchRepository } from "../business/image-batch";
import { ImageBatchViewModel } from "./image-batch-view-model";

export function useImageBatchViewModel(repository: ImageBatchRepository) {
  const viewModel = useMemo(() => new ImageBatchViewModel(repository), [repository]);
  const state = useSyncExternalStore(viewModel.subscribe, viewModel.getSnapshot, viewModel.getSnapshot);
  useEffect(() => { viewModel.activate(); return () => viewModel.dispose(); }, [viewModel]);
  return {
    ...state,
    updateBrief: viewModel.updateBrief,
    setMode: viewModel.setMode,
    beginSourceInputRead: viewModel.beginSourceInputRead,
    setSourceInput: viewModel.setSourceInput,
    setSourceInputError: viewModel.setSourceInputError,
    toggleReferenceFocus: viewModel.toggleReferenceFocus,
    setOutputKind: viewModel.setOutputKind,
    setFrameCount: viewModel.setFrameCount,
    setVariantCount: viewModel.setVariantCount,
    setRightsAccepted: viewModel.setRightsAccepted,
    submit: viewModel.submit,
    selectVariant: viewModel.selectVariant,
    startNewGeneration: viewModel.startNewGeneration,
  };
}
