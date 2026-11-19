import React, { useEffect, useState } from "react";

interface Dataset {
  id: number;
  dataset_name: string;
  file_name?: string;
  data_type?: string;
  status?: string;
  parent_dataset_id?: number | null;
}

interface DatasetStepProps {
  datasetName: string;
  setDatasetName: (value: string) => void;
  ingestionType: "raw" | "tagged";
  setIngestionType: (value: "raw" | "tagged") => void;
  parentDatasetId: number | null;
  setParentDatasetId: (value: number | null) => void;
  next: () => void;
  back: () => void;
  refreshDatasetId?: number | null;
  refreshDatasetMeta?: any;
  clearRefreshMode?: () => void;
  onSelectRefreshDataset?: (id: number, meta: any) => void;
  rawDatasets?: any[];
  loadingRawDatasets?: boolean;
  rawDatasetError?: string;
}

export default function DatasetStep({
  datasetName,
  setDatasetName,
  ingestionType,
  setIngestionType,
  parentDatasetId,
  setParentDatasetId,
  next,
  back,
  refreshDatasetId,
  refreshDatasetMeta,
  clearRefreshMode,
  onSelectRefreshDataset,
}: DatasetStepProps) {
  const [allDatasets, setAllDatasets] = useState<Dataset[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [datasetError, setDatasetError] = useState("");

  // Mode: "new" or "existing"
  const [uploadMode, setUploadMode] = useState<"new" | "existing">(
    refreshDatasetId ? "existing" : "new"
  );

  useEffect(() => {
    loadAllDatasets();
  }, []);

  useEffect(() => {
    setUploadMode(refreshDatasetId ? "existing" : "new");
  }, [refreshDatasetId]);

  async function loadAllDatasets() {
    try {
      setLoadingDatasets(true);
      setDatasetError("");
      const response = await fetch("http://localhost:5000/datasets");
      if (!response.ok) throw new Error(`Failed to load datasets (${response.status})`);
      const data = await response.json();
      const list = Array.isArray(data) ? data : data.datasets || [];
      setAllDatasets(list);
    } catch (error) {
      console.error("Failed to load datasets:", error);
      setDatasetError("Unable to load existing datasets.");
    } finally {
      setLoadingDatasets(false);
    }
  }

  const rawDatasets = allDatasets.filter((dataset: Dataset) => {
    const type = String(dataset.data_type || (dataset as any).dataType || "raw").toLowerCase();
    return type === "raw";
  });

  const taggedDatasets = allDatasets.filter((dataset: Dataset) => {
    const type = String(dataset.data_type || (dataset as any).dataType || "").toLowerCase();
    return type === "tagged";
  });

  function handleIngestionTypeChange(type: "raw" | "tagged") {
    setIngestionType(type);
    clearRefreshMode?.();
    setUploadMode("new");
    setDatasetName("");
    setParentDatasetId(null);
  }

  function handleModeChange(mode: "new" | "existing") {
    setUploadMode(mode);
    if (mode === "new") {
      clearRefreshMode?.();
      setDatasetName("");
      if (ingestionType === "raw") {
        setParentDatasetId(null);
      }
    } else {
      // Pick first available dataset of current category
      const targetList = ingestionType === "tagged" ? taggedDatasets : rawDatasets;
      if (targetList.length > 0) {
        const target = targetList[0];
        onSelectRefreshDataset?.(target.id, target);
      }
    }
  }

  function handleExistingDatasetChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (!value) {
      clearRefreshMode?.();
      return;
    }
    const selectedId = Number(value);
    const target = allDatasets.find((d) => d.id === selectedId);
    if (target) {
      onSelectRefreshDataset?.(target.id, target);
    }
  }

  function handleParentRawDatasetChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (!value) {
      setParentDatasetId(null);
      setDatasetName("");
      return;
    }

    const selectedId = Number(value);
    const selectedDataset = rawDatasets.find((dataset) => dataset.id === selectedId);
    if (!selectedDataset) {
      setParentDatasetId(null);
      setDatasetName("");
      return;
    }

    setParentDatasetId(selectedId);
    setDatasetName(selectedDataset.dataset_name);
  }

  function handleNext() {
    if (uploadMode === "existing" || refreshDatasetId) {
      if (!refreshDatasetId) {
        alert(`Please select an existing ${ingestionType === "raw" ? "Raw" : "Tagged"} dataset to update.`);
        return;
      }
      next();
      return;
    }

    if (ingestionType === "raw") {
      if (!datasetName.trim()) {
        alert("Please enter a dataset name.");
        return;
      }
      next();
      return;
    }

    if (ingestionType === "tagged") {
      if (!parentDatasetId) {
        alert("Please select an existing Raw dataset as parent.");
        return;
      }
      if (!datasetName.trim()) {
        alert("The selected Raw dataset is missing a dataset name.");
        return;
      }
      next();
    }
  }

  const selectedExistingMeta = allDatasets.find((d) => d.id === refreshDatasetId) || refreshDatasetMeta;

  return (
    <div className="panel-card" style={{ maxWidth: 840 }}>
      <div className="panel-header">
        <div className="panel-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
          Step 3: Dataset Type & Linkage Configuration
        </div>
        <span className="badge badge-cyan">Schema Context</span>
      </div>

      {/* 1. Ingestion Type Selection Cards */}
      <div style={{ marginBottom: 24 }}>
        <label className="labelStyle" style={{ display: "block", marginBottom: 12, fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
          1. Data Ingestion Category (Keep raw and tagged separate):
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Raw Data Card */}
          <label
            style={{
              padding: 16,
              borderRadius: "var(--radius-md)",
              backgroundColor: ingestionType === "raw" ? "var(--accent-dim)" : "var(--bg-input)",
              border: ingestionType === "raw" ? "2px solid var(--accent-cyan)" : "1px solid var(--border-subtle)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="radio"
                name="ingestionCategory"
                value="raw"
                checked={ingestionType === "raw"}
                onChange={() => handleIngestionTypeChange("raw")}
              />
              <span style={{ fontWeight: 700, color: ingestionType === "raw" ? "var(--accent-cyan)" : "var(--text-primary)", fontSize: 14 }}>
                📁 Raw Data
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 24 }}>
              Standalone engineering dataset containing primary log events and base telemetry.
            </div>
          </label>

          {/* Tagged Data Card */}
          <label
            style={{
              padding: 16,
              borderRadius: "var(--radius-md)",
              backgroundColor: ingestionType === "tagged" ? "rgba(245, 158, 11, 0.12)" : "var(--bg-input)",
              border: ingestionType === "tagged" ? "2px solid #f59e0b" : "1px solid var(--border-subtle)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="radio"
                name="ingestionCategory"
                value="tagged"
                checked={ingestionType === "tagged"}
                onChange={() => handleIngestionTypeChange("tagged")}
              />
              <span style={{ fontWeight: 700, color: ingestionType === "tagged" ? "#f59e0b" : "var(--text-primary)", fontSize: 14 }}>
                🏷️ Tagged Data
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 24 }}>
              Auxiliary annotations, failure components, and conditions mapped to an existing Raw dataset.
            </div>
          </label>
        </div>
      </div>

      {/* 2. Destination Mode: Create New vs Select Existing */}
      <div style={{ marginBottom: 24, padding: 18, borderRadius: "var(--radius-md)", backgroundColor: "var(--bg-card-hover)", border: "1px solid var(--border-subtle)" }}>
        <label style={{ display: "block", marginBottom: 12, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
          2. Destination for {ingestionType === "raw" ? "Raw Data" : "Tagged Data"}:
        </label>

        <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            <input
              type="radio"
              name="step3UploadMode"
              checked={uploadMode === "new"}
              onChange={() => handleModeChange("new")}
              style={{ accentColor: "var(--accent-cyan)" }}
            />
            Create a new {ingestionType === "raw" ? "Raw" : "Tagged"} dataset
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            <input
              type="radio"
              name="step3UploadMode"
              checked={uploadMode === "existing"}
              onChange={() => handleModeChange("existing")}
              style={{ accentColor: "var(--accent-cyan)" }}
            />
            Upload on existing {ingestionType === "raw" ? "Raw" : "Tagged"} dataset
          </label>
        </div>

        {/* Existing Dataset Selection Dropdown */}
        {uploadMode === "existing" && (
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
              Select Existing {ingestionType === "raw" ? "Raw" : "Tagged"} Dataset by Name *
            </label>

            {loadingDatasets ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading datasets...</div>
            ) : datasetError ? (
              <div style={{ color: "var(--status-detect)", fontSize: 13 }}>{datasetError}</div>
            ) : (ingestionType === "raw" ? rawDatasets : taggedDatasets).length === 0 ? (
              <div style={{ padding: 10, background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 6, color: "#fca5a5", fontSize: 12 }}>
                No existing {ingestionType.toUpperCase()} datasets found. Please switch to "Create a new dataset" above.
              </div>
            ) : (
              <select
                value={refreshDatasetId ?? ""}
                onChange={handleExistingDatasetChange}
                style={{ width: "100%", padding: "8px 12px", backgroundColor: "var(--bg-input)", color: "#fff", border: "1px solid var(--border-medium)", borderRadius: 6 }}
              >
                <option value="">-- Select {ingestionType === "raw" ? "Raw" : "Tagged"} Dataset by Name --</option>
                {(ingestionType === "raw" ? rawDatasets : taggedDatasets).map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.dataset_name} (ID #{dataset.id}) — {dataset.file_name || "CSV"}
                  </option>
                ))}
              </select>
            )}

            {refreshDatasetId && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: "#78350f", border: "1px solid #b45309", borderRadius: 6, color: "#fcd34d", fontSize: 12.5 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  🔄 Target: {selectedExistingMeta?.dataset_name || `Dataset #${refreshDatasetId}`}
                </div>
                <div>
                  Matching record IDs and fields will be overridden; new IDs will create new rows; new CSV headers will create new columns.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create New RAW Dataset */}
        {uploadMode === "new" && ingestionType === "raw" && (
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              New Dataset Display Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Flight Telemetry Batch 2026-Q3"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", backgroundColor: "var(--bg-input)", color: "#fff", border: "1px solid var(--border-medium)", borderRadius: 6 }}
            />
          </div>
        )}

        {/* Create New TAGGED Dataset */}
        {uploadMode === "new" && ingestionType === "tagged" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                Select Parent Raw Dataset *
              </label>
              {loadingDatasets ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading raw datasets...</div>
              ) : datasetError ? (
                <div style={{ color: "var(--status-detect)", fontSize: 13 }}>{datasetError}</div>
              ) : rawDatasets.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No Raw datasets found. Please upload a Raw dataset first.</div>
              ) : (
                <select value={parentDatasetId ?? ""} onChange={handleParentRawDatasetChange} style={{ width: "100%", padding: "8px 12px", backgroundColor: "var(--bg-input)", color: "#fff", border: "1px solid var(--border-medium)", borderRadius: 6 }}>
                  <option value="">-- Select Parent Raw Dataset --</option>
                  {rawDatasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.dataset_name} (ID #{dataset.id})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {parentDatasetId && (
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                  Tagged Dataset Name
                </label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", backgroundColor: "var(--bg-input)", color: "#fff", border: "1px solid var(--border-medium)", borderRadius: 6 }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button onClick={back} className="btn-secondary">
          ← Back to Preview
        </button>
        <button
          onClick={handleNext}
          className="btn-primary"
          disabled={
            uploadMode === "existing"
              ? !refreshDatasetId
              : ingestionType === "raw"
              ? !datasetName.trim()
              : !parentDatasetId || !datasetName.trim()
          }
        >
          Next: Schema Builder →
        </button>
      </div>
    </div>
  );
}
