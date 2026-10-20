export interface OllamaModelResponse {
  success: boolean;
  models?: string[];
  baseUrl?: string;
  message?: string;
}

export interface PreviewRecordResult {
  index: number;
  id: string | number;
  freeText: string;
  extracted: Record<string, string[]>;
  status: "success" | "failed";
  error?: string;
}

export interface TaggingPreviewResponse {
  success: boolean;
  results?: PreviewRecordResult[];
  totalDatasetRows?: number;
  sampleSize?: number;
  message?: string;
}

export interface TagDatasetResponse {
  success: boolean;
  records?: any[];
  totalCount?: number;
  processedCount?: number;
  successCount?: number;
  failedCount?: number;
  message?: string;
}

export interface TaggingConfig {
  datasetId: number | null;
  freeTextColumn: string;
  entities: string[];
  prompt: string;
  sampleSize: number;
  modelName: string;
  batchSize?: number;
}
