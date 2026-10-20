import type {
  OllamaModelResponse,
  TaggingConfig,
  TaggingPreviewResponse,
  TagDatasetResponse,
} from "../types/tagging";

const API_BASE = "http://localhost:5000";

export async function fetchOllamaModels(): Promise<OllamaModelResponse> {
  try {
    const res = await fetch(`${API_BASE}/ollama/models`);
    return await res.json();
  } catch (error: any) {
    return {
      success: false,
      message: `Unable to connect to backend server or local Ollama. ${error?.message || ""}`,
    };
  }
}

export async function runTaggingPreview(
  config: TaggingConfig
): Promise<TaggingPreviewResponse> {
  try {
    const res = await fetch(`${API_BASE}/ollama/tag-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    return await res.json();
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to connect to backend: ${error?.message || ""}`,
    };
  }
}

export async function tagFullDataset(
  config: TaggingConfig
): Promise<TagDatasetResponse> {
  try {
    const res = await fetch(`${API_BASE}/ollama/tag-dataset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    return await res.json();
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to process full dataset: ${error?.message || ""}`,
    };
  }
}

export async function saveTaggedDataset(payload: {
  parentDatasetId: number;
  datasetName: string;
  records: any[];
  entities: string[];
}): Promise<{ success: boolean; datasetId?: number; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/ollama/save-tagged-dataset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to save tagged dataset: ${error?.message || ""}`,
    };
  }
}
