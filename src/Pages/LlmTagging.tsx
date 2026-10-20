import React, { useState, useEffect, useRef } from "react";

interface LLMTaggingProps {
  navigate: (page: any) => void;
  selectedDatasetId: number | null;
  onDatasetTagged?: (newTaggedDatasetId: number) => void;
}

interface DatasetMeta {
  id: number;
  dataset_name?: string;
  file_name?: string;
  parent_dataset_id?: number | null;
  parentDatasetId?: number | null;
  ingestion_type?: string;
  ingestionType?: string;
  data_type?: string;
  dataType?: string;
}

interface DatasetColumn {
  name: string;
  type: string;
  ontologyMapping?: string;
}

interface DatasetSchema {
  datasetName: string;
  columns: DatasetColumn[];
  timestampColumn?: string;
  primaryKey?: string;
}

interface TaggingRecord {
  id: string | number;
  rowIndex: number;
  freeText: string;
  tags: Record<string, string[]>;
  rawRow: Record<string, any>;
  status: "success" | "failed";
  error?: string;
}

interface PreviewAttempt {
  id: string;
  attemptNumber: number;
  prompt: string;
  entities: string[];
  sampleSize: number;
  freeTextField: string;
  results: TaggingRecord[];
  validationStatus: "correct" | "needs_improvement" | "unreviewed";
}

const DEFAULT_PROMPT = `Extract the product, failure condition, component and root cause from the complaint.

Only extract information explicitly mentioned in the text.
Do not invent or infer information.
If multiple values exist for an entity, return all values.
If an entity is not present, return an empty list.`;

export default function LLMTagging({
  navigate,
  selectedDatasetId,
  onDatasetTagged,
}: LLMTaggingProps) {
  // Datasets state
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [currentDatasetId, setCurrentDatasetId] = useState<number | null>(selectedDatasetId);
  const [schema, setSchema] = useState<DatasetSchema | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Free-text Field selection
  const [freeTextColumn, setFreeTextColumn] = useState<string>("");

  // Ollama configuration
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("qwen2.5:7b");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Entities & Prompt
  const [entities, setEntities] = useState<string[]>([
    "Product",
    "Failure Condition",
    "Component",
  ]);
  const [newEntity, setNewEntity] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [sampleSize, setSampleSize] = useState(50);

  // Preview state
  const [isPreviewRunning, setIsPreviewRunning] = useState(false);
  const [previewProcessed, setPreviewProcessed] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<PreviewAttempt[]>([]);
  const [activeAttemptIdx, setActiveAttemptIdx] = useState(0);

  // Full processing state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isFullProcessing, setIsFullProcessing] = useState(false);
  const [fullProgress, setFullProgress] = useState({ processed: 0, total: 0, successful: 0, failed: 0 });
  const [finalTaggedRecords, setFinalTaggedRecords] = useState<TaggingRecord[]>([]);

  // UI state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [previewRowSampleIndex, setPreviewRowSampleIndex] = useState(0);
  const [previewSearchTerm, setPreviewSearchTerm] = useState("");
  const promptRef = useRef<HTMLDivElement>(null);

  // 1. Fetch available datasets from localhost:5000
  useEffect(() => {
    async function fetchDatasets() {
      try {
        const res = await fetch("http://localhost:5000/datasets");
        if (res.ok) {
          const data = await res.json();
          const list: DatasetMeta[] = Array.isArray(data) ? data : data.datasets || [];
          setDatasets(list);
          if (!currentDatasetId && list.length > 0) {
            setCurrentDatasetId(list[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load datasets:", err);
      }
    }
    fetchDatasets();
  }, []);

  // 2. Fetch Schema & Records when dataset changes
  useEffect(() => {
    if (!currentDatasetId) return;
    async function loadDataset() {
      setLoadingData(true);
      try {
        const [schemaRes, dataRes] = await Promise.all([
          fetch(`http://localhost:5000/datasets/${currentDatasetId}/schema`),
          fetch(`http://localhost:5000/datasets/${currentDatasetId}/data`),
        ]);

        let loadedColumns: string[] = [];
        let loadedRecords: any[] = [];

        if (schemaRes.ok) {
          const s = await schemaRes.json();
          setSchema(s);
          if (Array.isArray(s.columns)) {
            loadedColumns = s.columns.map((c: any) => (typeof c === "string" ? c : c.name));
          }
        }

        if (dataRes.ok) {
          const d = await dataRes.json();
          loadedRecords = Array.isArray(d) ? d : d.records || [];
          setRecords(loadedRecords);
          setSampleSize(Math.min(50, loadedRecords.length || 50));

          if (loadedColumns.length === 0 && loadedRecords.length > 0) {
            loadedColumns = Object.keys(loadedRecords[0]);
          }
        }

        const textCandidate = loadedColumns.find((col) =>
          /complaint|description|narrative|text|notes|summary|details|comments/i.test(col)
        );
        setFreeTextColumn(textCandidate || loadedColumns[0] || "");
      } catch (err) {
        console.error("Failed to load dataset details:", err);
      } finally {
        setLoadingData(false);
      }
    }
    loadDataset();
  }, [currentDatasetId]);

  // Derive all unique field names reliably
  const allFieldNames: string[] = React.useMemo(() => {
    if (schema?.columns && schema.columns.length > 0) {
      return schema.columns.map((c: any) => (typeof c === "string" ? c : c.name));
    }
    if (records.length > 0) {
      return Object.keys(records[0]);
    }
    return [];
  }, [schema, records]);

  // 3. Check Ollama Status
  const checkOllama = async () => {
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name);
        setAvailableModels(models);
        setOllamaConnected(true);
        if (models.length > 0 && !models.includes(ollamaModel)) {
          setOllamaModel(models[0]);
        }
      } else {
        setOllamaConnected(false);
      }
    } catch {
      setOllamaConnected(false);
    }
  };

  useEffect(() => {
    checkOllama();
  }, [ollamaUrl]);

  // Entity handlers
  const addEntity = () => {
    const trimmed = newEntity.trim();
    if (trimmed && !entities.includes(trimmed)) {
      setEntities([...entities, trimmed]);
      setNewEntity("");
    }
  };

  const removeEntity = (idx: number) => {
    setEntities(entities.filter((_, i) => i !== idx));
  };

  // Helper to insert edge case templates into prompt
  const insertEdgeCaseExample = (exampleSnippet: string) => {
    const trimmed = prompt.trim();
    setPrompt(`${trimmed}\n\n${exampleSnippet}`);
  };

  // Call Ollama for a single text record
  const callOllama = async (
    text: string,
    targetEntities: string[],
    instructionPrompt: string
  ): Promise<Record<string, string[]>> => {
    const systemPrompt = `You are an information extraction system.
Extract the requested entities from the supplied free-text.
Follow the user's extraction instructions and few-shot examples strictly.
Do not hallucinate. Only use information explicitly supported by the input text.
Return valid JSON where each entity is a key, and each value is an array of strings.
For every entity, return an array (e.g. ["item1"]). If no value exists, return [].`;

    const userMsg = `Instructions & Examples:
${instructionPrompt}

Entities to extract:
${targetEntities.map((e) => `- ${e}`).join("\n")}

Input Text:
"${text}"

JSON Output:`;

    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: userMsg,
        system: systemPrompt,
        stream: false,
        format: "json",
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama returned status ${res.status}`);
    }

    const data = await res.json();
    let cleaned = (data.response || "{}").trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    }
    const parsed = JSON.parse(cleaned);
    const result: Record<string, string[]> = {};
    for (const e of targetEntities) {
      const val = parsed[e];
      result[e] = Array.isArray(val) ? val.map(String) : val ? [String(val)] : [];
    }
    return result;
  };

  // Step 5: Run Preview
  const handleRunPreview = async () => {
    setPreviewError(null);
    if (!freeTextColumn) {
      setPreviewError("Please select the free-text column from your dataset fields.");
      return;
    }
    if (entities.length === 0) {
      setPreviewError("Please define at least one entity to extract.");
      return;
    }
    if (!prompt.trim()) {
      setPreviewError("Please enter extraction instructions.");
      return;
    }

    setIsPreviewRunning(true);
    setPreviewProcessed(0);

    const sampleSlice = records.slice(0, Math.min(sampleSize, records.length));
    const previewResults: TaggingRecord[] = [];

    try {
      for (let i = 0; i < sampleSlice.length; i++) {
        const row = sampleSlice[i];
        const text = String(row[freeTextColumn] || "");
        try {
          const tags = await callOllama(text, entities, prompt);
          previewResults.push({
            id: row.id || row.Complaint_ID || i + 1,
            rowIndex: i,
            freeText: text,
            tags,
            rawRow: row,
            status: "success",
          });
        } catch (err: any) {
          const emptyTags: Record<string, string[]> = {};
          entities.forEach((e) => (emptyTags[e] = []));
          previewResults.push({
            id: row.id || i + 1,
            rowIndex: i,
            freeText: text,
            tags: emptyTags,
            rawRow: row,
            status: "failed",
            error: err.message || "Failed to parse response",
          });
        }
        setPreviewProcessed(i + 1);
      }

      const newAttempt: PreviewAttempt = {
        id: `attempt-${Date.now()}`,
        attemptNumber: attempts.length + 1,
        prompt,
        entities: [...entities],
        sampleSize: sampleSlice.length,
        freeTextField: freeTextColumn,
        results: previewResults,
        validationStatus: "unreviewed",
      };

      const updated = [...attempts, newAttempt];
      setAttempts(updated);
      setActiveAttemptIdx(updated.length - 1);
    } catch (err: any) {
      setPreviewError(
        "Unable to connect to Ollama. Make sure Ollama is running locally and your model is downloaded."
      );
    } finally {
      setIsPreviewRunning(false);
    }
  };

  // Export helper for Preview Results CSV
  const handleExportPreviewCSV = () => {
    const currentAttempt = attempts[activeAttemptIdx];
    if (!currentAttempt || currentAttempt.results.length === 0) return;

    const originalCols = allFieldNames;
    const headers = [...originalCols, ...currentAttempt.entities];

    const lines = [headers.join(",")];
    currentAttempt.results.forEach((rec) => {
      const rowVals = originalCols.map((col) => {
        const val = rec.rawRow[col] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      currentAttempt.entities.forEach((ent) => {
        const tagArr = rec.tags[ent] || [];
        rowVals.push(`"${JSON.stringify(tagArr).replace(/"/g, '""')}"`);
      });
      lines.push(rowVals.join(","));
    });

    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dataset_${currentDatasetId || "export"}_preview_attempt_${currentAttempt.attemptNumber}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Full Dataset Processing
  const handleStartFullTagging = async () => {
    setShowConfirmModal(false);
    setIsFullProcessing(true);

    const total = records.length;
    setFullProgress({ processed: 0, total, successful: 0, failed: 0 });
    const allResults: TaggingRecord[] = [];

    for (let i = 0; i < total; i++) {
      const row = records[i];
      const text = String(row[freeTextColumn] || "");
      try {
        const tags = await callOllama(text, entities, prompt);
        allResults.push({
          id: row.id || i + 1,
          rowIndex: i,
          freeText: text,
          tags,
          rawRow: row,
          status: "success",
        });
      } catch (err: any) {
        const emptyTags: Record<string, string[]> = {};
        entities.forEach((e) => (emptyTags[e] = []));
        allResults.push({
          id: row.id || i + 1,
          rowIndex: i,
          freeText: text,
          tags: emptyTags,
          rawRow: row,
          status: "failed",
          error: err.message,
        });
      }

      setFullProgress({
        processed: i + 1,
        total,
        successful: allResults.filter((r) => r.status === "success").length,
        failed: allResults.filter((r) => r.status === "failed").length,
      });
    }

    setFinalTaggedRecords(allResults);
    setIsFullProcessing(false);
  };

  // Full CSV Export
  const handleExportFullCSV = () => {
    if (finalTaggedRecords.length === 0) return;

    const originalCols = allFieldNames;
    const headers = [...originalCols, ...entities];

    const lines = [headers.join(",")];
    finalTaggedRecords.forEach((rec) => {
      const rowVals = originalCols.map((col) => {
        const val = rec.rawRow[col] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      entities.forEach((ent) => {
        const tagArr = rec.tags[ent] || [];
        rowVals.push(`"${JSON.stringify(tagArr).replace(/"/g, '""')}"`);
      });
      lines.push(rowVals.join(","));
    });

    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dataset_${currentDatasetId}_tagged_full.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentAttempt = attempts[activeAttemptIdx] || null;

  // Filtered rows for preview table search
  const visiblePreviewRows = React.useMemo(() => {
    if (!currentAttempt) return [];
    if (!previewSearchTerm.trim()) return currentAttempt.results;
    const q = previewSearchTerm.toLowerCase();
    return currentAttempt.results.filter((r) => {
      if (r.freeText.toLowerCase().includes(q)) return true;
      for (const ent of currentAttempt.entities) {
        const tags = r.tags[ent] || [];
        if (tags.some((t) => t.toLowerCase().includes(q))) return true;
      }
      return false;
    });
  }, [currentAttempt, previewSearchTerm]);

  return (
    <div style={{ padding: "24px", maxWidth: "1280px", margin: "0 auto", color: "#e2e8f0" }}>
      {/* Top Header Identity */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: 0 }}>LLM Tagging Studio</h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0 0" }}>
            Select a dataset, isolate the free-text field, add few-shot edge case examples, and test locally before batch tagging.
          </p>
        </div>

        {/* Ollama Status Pill */}
        <div
          onClick={() => setShowConfig(!showConfig)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 14px",
            background: "#1e293b",
            borderRadius: "8px",
            border: "1px solid #334155",
            cursor: "pointer",
            fontSize: "12px",
          }}
          title="Click to view/edit Ollama settings"
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: ollamaConnected ? "#10b981" : "#ef4444",
            }}
          />
          <span>Local LLM • Ollama</span>
          <span style={{ color: "#94a3b8" }}>({ollamaModel})</span>
        </div>
      </div>

      {/* Ollama Config Drawer */}
      {showConfig && (
        <div style={{ background: "#0f172a", border: "1px solid #334155", padding: "16px", borderRadius: "12px", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "600", marginTop: 0 }}>Ollama Connection Settings</h3>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>Base URL</label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                style={{ padding: "6px 10px", background: "#1e293b", border: "1px solid #334155", color: "#fff", borderRadius: "6px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>Model Name</label>
              <input
                type="text"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                style={{ padding: "6px 10px", background: "#1e293b", border: "1px solid #334155", color: "#fff", borderRadius: "6px" }}
              />
            </div>
            <button
              onClick={checkOllama}
              style={{ padding: "8px 14px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
            >
              Test Connection
            </button>
          </div>
        </div>
      )}

      {/* Target Dataset Selection */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", padding: "16px", borderRadius: "12px", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600" }}>Target Dataset:</span>
            <select
              value={currentDatasetId || ""}
              onChange={(e) => setCurrentDatasetId(Number(e.target.value))}
              style={{ padding: "6px 12px", background: "#0f172a", border: "1px solid #334155", color: "#fff", borderRadius: "6px", fontSize: "13px" }}
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.file_name || d.dataset_name || `Dataset #${d.id}`}
                </option>
              ))}
            </select>
          </div>
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
            {records.length.toLocaleString()} Total Records Loaded • {allFieldNames.length} Total Fields Detected
          </span>
        </div>
      </div>

      {/* Step 1: Select Free-Text Column */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", padding: "18px", borderRadius: "12px", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: "600", margin: 0 }}>
              Step 1 — Select Free-Text Column for Tagging
            </h3>
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0 0" }}>
              Choose the specific narrative field to send to Ollama. All other columns are kept untouched and preserved in output.
            </p>
          </div>
          <span style={{ fontSize: "12px", color: "#38bdf8", background: "#0c4a6e", padding: "3px 10px", borderRadius: "6px" }}>
            Target: <strong>{freeTextColumn || "None"}</strong>
          </span>
        </div>

        <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap", marginBottom: "14px" }}>
          <div style={{ flex: "1", minWidth: "280px", maxWidth: "450px" }}>
            <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px", fontWeight: "600" }}>
              Free-Text Field:
            </label>
            <select
              value={freeTextColumn}
              onChange={(e) => setFreeTextColumn(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#0f172a",
                border: "1px solid #4f46e5",
                color: "#fff",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              {allFieldNames.length === 0 ? (
                <option value="">No fields detected</option>
              ) : (
                allFieldNames.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))
              )}
            </select>
          </div>

          <div style={{ flex: "2", minWidth: "260px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
              Quick-pick field from detected columns:
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {allFieldNames.map((col) => {
                const isSelected = freeTextColumn === col;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setFreeTextColumn(col)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      border: isSelected ? "1px solid #4f46e5" : "1px solid #334155",
                      background: isSelected ? "#312e81" : "#0f172a",
                      color: isSelected ? "#c7d2fe" : "#94a3b8",
                      cursor: "pointer",
                      fontWeight: isSelected ? "600" : "normal",
                    }}
                  >
                    {col}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Content Preview of Selected Field */}
        <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", padding: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600" }}>
              Live Sample from "{freeTextColumn || "None"}" (Record #{previewRowSampleIndex + 1} of {records.length}):
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              {[0, 1, 2].map((idx) => (
                <button
                  key={idx}
                  onClick={() => setPreviewRowSampleIndex(idx)}
                  disabled={idx >= records.length}
                  style={{
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    background: previewRowSampleIndex === idx ? "#4f46e5" : "#1e293b",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Row {idx + 1}
                </button>
              ))}
            </div>
          </div>

          <p style={{ margin: 0, fontSize: "12px", color: "#f8fafc", fontStyle: "italic", lineHeight: "1.5" }}>
            {records[previewRowSampleIndex] && freeTextColumn
              ? `"${String(records[previewRowSampleIndex][freeTextColumn] || "(Empty cell)")}"`
              : "No text available for this field."}
          </p>
        </div>
      </div>

      {/* Step 2: Define Entities */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", padding: "16px", borderRadius: "12px", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: "600", marginTop: 0 }}>Step 2 — Define Entities</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
          {entities.map((ent, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            >
              <span>{ent}</span>
              <button
                onClick={() => removeEntity(idx)}
                style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontWeight: "bold" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "8px", maxWidth: "400px" }}>
          <input
            type="text"
            value={newEntity}
            onChange={(e) => setNewEntity(e.target.value)}
            placeholder="Add entity (e.g. Root Cause)..."
            style={{ flex: 1, padding: "6px 10px", background: "#0f172a", border: "1px solid #334155", color: "#fff", borderRadius: "6px" }}
            onKeyDown={(e) => e.key === "Enter" && addEntity()}
          />
          <button
            onClick={addEntity}
            style={{ padding: "6px 14px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
          >
            + Add Entity
          </button>
        </div>
      </div>

      {/* Step 3: Prompt Editor with Edge Case Few-Shot Helpers */}
      <div ref={promptRef} style={{ background: "#1e293b", border: "1px solid #334155", padding: "16px", borderRadius: "12px", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "600", margin: 0 }}>
            Step 3 — Tagging Instructions & Edge Case Examples
          </h3>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            {prompt.length} characters • Fully editable
          </span>
        </div>

        <textarea
          rows={7}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter extraction instructions and few-shot examples for edge cases..."
          style={{
            width: "100%",
            padding: "12px",
            background: "#0f172a",
            border: "1px solid #334155",
            color: "#fff",
            borderRadius: "8px",
            fontFamily: "monospace",
            fontSize: "12px",
            resize: "vertical",
            lineHeight: "1.6",
          }}
        />

        {/* Few-Shot Edge Case Quick Add Tray */}
        <div style={{ marginTop: "12px", background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", padding: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "#fbbf24", marginBottom: "8px" }}>
            ✨ Quick-Add Edge Case Examples (Few-Shot Guidance for Ollama):
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <button
              type="button"
              onClick={() =>
                insertEdgeCaseExample(
                  `### Edge Case 1: No Defect / Normal Inspection (Return empty lists)\nExample Input: "Routine visual inspection of packaging and sterile seal completed with no anomalies observed."\nExample Expected Output: {"Product": [], "Failure Condition": [], "Component": []}`
                )
              }
              style={{ padding: "6px 12px", background: "#1e293b", border: "1px solid #334155", color: "#34d399", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}
            >
              + Edge Case: No defect / Return empty lists
            </button>

            <button
              type="button"
              onClick={() =>
                insertEdgeCaseExample(
                  `### Edge Case 2: Multiple Failures in One Narrative\nExample Input: "During stent deployment, balloon ruptured upon inflation and catheter shaft kinked."\nExample Expected Output: {"Product": ["stent", "catheter"], "Failure Condition": ["balloon rupture", "shaft kink"], "Component": ["balloon", "catheter shaft"]}`
                )
              }
              style={{ padding: "6px 12px", background: "#1e293b", border: "1px solid #334155", color: "#818cf8", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}
            >
              + Edge Case: Multiple failures in one sentence
            </button>

            <button
              type="button"
              onClick={() =>
                insertEdgeCaseExample(
                  `### Edge Case 3: Acronyms & Synonyms\nExample Input: "PTCA wire detached at distal tip; physician converted to alternate guide."\nExample Expected Output: {"Product": ["guidewire"], "Failure Condition": ["tip detachment"], "Component": ["distal tip"]}`
                )
              }
              style={{ padding: "6px 12px", background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}
            >
              + Edge Case: Acronyms & Synonyms
            </button>

            <button
              type="button"
              onClick={() =>
                insertEdgeCaseExample(
                  `### Custom Edge Case Example\nExample Input: "[Paste your problematic sample sentence here]"\nExample Expected Output: {"Product": ["..."], "Failure Condition": ["..."], "Component": ["..."]}`
                )
              }
              style={{ padding: "6px 12px", background: "#1e293b", border: "1px solid #334155", color: "#c084fc", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}
            >
              + Custom Example Template
            </button>
          </div>
        </div>
      </div>

      {/* Step 4 & 5: Sample Size & Run Preview */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", padding: "16px", borderRadius: "12px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", fontWeight: "600" }}>Preview sample size:</span>
          {[10, 25, 50, 100].map((sz) => (
            <button
              key={sz}
              disabled={sz > records.length}
              onClick={() => setSampleSize(sz)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #334155",
                background: sampleSize === sz ? "#4f46e5" : "#0f172a",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {sz}
            </button>
          ))}
        </div>

        <button
          onClick={handleRunPreview}
          disabled={isPreviewRunning}
          style={{
            padding: "10px 24px",
            background: isPreviewRunning ? "#312e81" : "#4f46e5",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: isPreviewRunning ? "wait" : "pointer",
          }}
        >
          {isPreviewRunning ? `Running local LLM... (${previewProcessed}/${sampleSize})` : "Run Preview"}
        </button>
      </div>

      {previewError && (
        <div style={{ padding: "12px", background: "#450a0a", border: "1px solid #991b1b", color: "#fca5a5", borderRadius: "8px", marginBottom: "16px", fontSize: "13px" }}>
          {previewError}
        </div>
      )}

      {/* Step 6 & 7: Preview Results Table with Direct CSV Download */}
      {currentAttempt && (
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", overflow: "hidden", marginBottom: "24px" }}>
          <div style={{ padding: "14px 16px", background: "#0f172a", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600" }}>
                Preview Results (Attempt {currentAttempt.attemptNumber} of {attempts.length})
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                {attempts.map((att, i) => (
                  <button
                    key={att.id}
                    onClick={() => setActiveAttemptIdx(i)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      background: activeAttemptIdx === i ? "#4f46e5" : "#1e293b",
                      color: "#fff",
                      border: "1px solid #334155",
                      cursor: "pointer",
                    }}
                  >
                    Attempt {att.attemptNumber}
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Preview CSV Download Button */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="text"
                placeholder="Search text or tags..."
                value={previewSearchTerm}
                onChange={(e) => setPreviewSearchTerm(e.target.value)}
                style={{ padding: "6px 10px", background: "#1e293b", border: "1px solid #334155", color: "#fff", borderRadius: "6px", fontSize: "12px", width: "180px" }}
              />
              <button
                onClick={handleExportPreviewCSV}
                style={{
                  padding: "6px 14px",
                  background: "#4f46e5",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                title="Download this preview sample as a CSV file"
              >
                <span>📥</span>
                <span>Export Preview CSV ({currentAttempt.results.length})</span>
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#0f172a", textAlign: "left", borderBottom: "1px solid #334155" }}>
                  <th style={{ padding: "10px" }}>#</th>
                  <th style={{ padding: "10px", minWidth: "260px" }}>Free Text ({currentAttempt.freeTextField})</th>
                  {currentAttempt.entities.map((e) => (
                    <th key={e} style={{ padding: "10px", minWidth: "160px" }}>
                      {e}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiblePreviewRows.map((row) => (
                  <tr key={row.rowIndex} style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "10px", color: "#94a3b8" }}>{row.rowIndex + 1}</td>
                    <td style={{ padding: "10px" }}>
                      <div
                        onClick={() => {
                          const next = new Set(expandedRows);
                          next.has(row.rowIndex) ? next.delete(row.rowIndex) : next.add(row.rowIndex);
                          setExpandedRows(next);
                        }}
                        style={{
                          cursor: "pointer",
                          maxWidth: "340px",
                          whiteSpace: expandedRows.has(row.rowIndex) ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {row.freeText}
                      </div>
                    </td>
                    {currentAttempt.entities.map((ent) => (
                      <td key={ent} style={{ padding: "10px", color: "#818cf8", fontFamily: "monospace" }}>
                        {JSON.stringify(row.tags[ent] || [])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Validation & Iteration Controls */}
          <div style={{ padding: "16px", background: "#0f172a", borderTop: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", gap: "16px" }}>
              <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="radio"
                  name="val"
                  checked={currentAttempt.validationStatus === "correct"}
                  onChange={() => {
                    const up = [...attempts];
                    up[activeAttemptIdx].validationStatus = "correct";
                    setAttempts(up);
                  }}
                />
                <span>○ Results look correct</span>
              </label>
              <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="radio"
                  name="val"
                  checked={currentAttempt.validationStatus === "needs_improvement"}
                  onChange={() => {
                    const up = [...attempts];
                    up[activeAttemptIdx].validationStatus = "needs_improvement";
                    setAttempts(up);
                  }}
                />
                <span>○ Results need improvement</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleExportPreviewCSV}
                style={{ padding: "8px 14px", background: "#1e293b", border: "1px solid #4f46e5", color: "#c7d2fe", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
              >
                📥 Download Preview CSV
              </button>
              <button
                onClick={() => promptRef.current?.scrollIntoView({ behavior: "smooth" })}
                style={{ padding: "8px 14px", background: "#334155", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
              >
                Edit Prompt & Examples
              </button>
              <button
                onClick={handleRunPreview}
                style={{ padding: "8px 14px", background: "#334155", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
              >
                Run Preview Again
              </button>
              <button
                onClick={() => setShowConfirmModal(true)}
                style={{ padding: "8px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
              >
                Tag Entire Dataset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#1e293b", padding: "24px", borderRadius: "12px", maxWidth: "480px", border: "1px solid #334155" }}>
            <h3 style={{ marginTop: 0 }}>Confirm Full Dataset Processing</h3>
            <p style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.5" }}>
              You are about to process <strong>{records.length.toLocaleString()} records</strong> using <code>{ollamaModel}</code>.
              <br /><br />
              <strong>Selected Free-Text Field:</strong> <code>{freeTextColumn}</code>
              <br /><br />
              All instructions, few-shot examples, and entity definitions from your validated preview will be applied across every row.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{ padding: "8px 16px", background: "#334155", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleStartFullTagging}
                style={{ padding: "8px 16px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
              >
                Tag Entire Dataset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Dialog during Full Processing */}
      {isFullProcessing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#1e293b", padding: "24px", borderRadius: "12px", width: "450px", border: "1px solid #334155" }}>
            <h3 style={{ marginTop: 0 }}>Tagging Dataset</h3>
            <div style={{ background: "#0f172a", height: "12px", borderRadius: "6px", overflow: "hidden", margin: "16px 0" }}>
              <div
                style={{
                  width: `${Math.round((fullProgress.processed / (fullProgress.total || 1)) * 100)}%`,
                  height: "100%",
                  background: "#4f46e5",
                  transition: "width 0.2s",
                }}
              />
            </div>
            <div style={{ fontSize: "13px", color: "#cbd5e1" }}>
              Processed: {fullProgress.processed} / {fullProgress.total}
            </div>
            <div style={{ display: "flex", gap: "16px", marginTop: "10px", fontSize: "12px" }}>
              <span style={{ color: "#10b981" }}>Successful: {fullProgress.successful}</span>
              <span style={{ color: "#ef4444" }}>Failed: {fullProgress.failed}</span>
            </div>
          </div>
        </div>
      )}

      {/* Final Export Banner */}
      {finalTaggedRecords.length > 0 && (
        <div style={{ padding: "20px", background: "#064e3b", border: "1px solid #059669", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: "15px" }}>Tagging Complete!</h4>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#a7f3d0" }}>
              Successfully processed {finalTaggedRecords.length.toLocaleString()} records from field "{freeTextColumn}". Original columns are preserved.
            </p>
          </div>
          <button
            onClick={handleExportFullCSV}
            style={{ padding: "10px 20px", background: "#10b981", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
          >
            Export Full Dataset CSV
          </button>
        </div>
      )}
    </div>
  );
}