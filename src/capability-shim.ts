import type { LlmService } from "./types.ts";

export interface CapabilityShimHandle {
  nativeImageSupport(provider: string, model: string): Promise<boolean>;
  restore(): void;
}

export function installCapabilityShim(llm: LlmService): CapabilityShimHandle {
  const origResolveModelInfo = llm.resolveModelInfo;
  const boundResolveModelInfo = origResolveModelInfo.bind(llm);
  const resolveModelInfoShim: LlmService["resolveModelInfo"] = async function (
    provider,
    model,
    signal,
  ) {
    const info = await boundResolveModelInfo(provider, model, signal);
    if (info?.inputModalities && !info.inputModalities.includes("image")) {
      return { ...info, inputModalities: [...info.inputModalities, "image"] };
    }
    return info;
  };
  llm.resolveModelInfo = resolveModelInfoShim;

  const origListModels = llm.listModels;
  const boundListModels = origListModels.bind(llm);
  const listModelsShim: LlmService["listModels"] = async function (provider) {
    const models = await boundListModels(provider);
    return models.map((model) =>
      model?.inputModalities && !model.inputModalities.includes("image")
        ? { ...model, inputModalities: [...model.inputModalities, "image"] }
        : model,
    );
  };
  llm.listModels = listModelsShim;

  async function nativeImageSupport(provider: string, model: string): Promise<boolean> {
    try {
      const info = await boundResolveModelInfo(provider, model);
      return Boolean(info?.inputModalities?.includes("image"));
    } catch {
      return false;
    }
  }

  function restore(): void {
    if (llm.resolveModelInfo === resolveModelInfoShim) {
      llm.resolveModelInfo = origResolveModelInfo;
    }
    if (llm.listModels === listModelsShim) {
      llm.listModels = origListModels;
    }
  }

  return { nativeImageSupport, restore };
}
