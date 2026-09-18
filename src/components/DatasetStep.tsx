import React, { useEffect, useState } from "react";

interface Dataset {
  id: number;
  dataset_name: string;
  file_name?: string;
  data_type?: string;
  status?: string;
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
  rawDatasets?: any;
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
}: DatasetStepProps) {
  const [rawDatasets, setRawDatasets] = useState<Dataset[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [datasetError, setDatasetError] = useState("");

  useEffect(() => {
    if (ingestionType !== "tagged") return;
    loadRawDatasets();
  }, [ingestionType]);

  async function loadRawDatasets() {
    try {
      setLoadingDatasets(true);
      setDatasetError("");
      const response = await fetch("http://localhost:5000/datasets");
      if (!response.ok) throw new Error(`Failed to load datasets (${response.status})`);
      const data = await response.json();
      const datasets = Array.isArray(data) ? data : data.datasets || [];

      const rawOnly = datasets.filter((dataset: Dataset) => {
        const type = String(dataset.data_type || (dataset as any).dataType || "raw").toLowerCase();
        return type === "raw";
      });

      setRawDatasets(rawOnly);
    } catch (error) {
      console.error("Failed to load raw datasets:", error);
      setDatasetError("Unable to load existing raw datasets.");
    } finally {
      setLoadingDatasets(false);
    }
  }

  function handleIngestionTypeChange(type: "raw" | "tagged") {
    setIngestionType(type);
    if (type === "raw") {
      setParentDatasetId(null);
      return;
    }
    setDatasetName("");
    setParentDatasetId(null);
  }

  function handleRawDatasetChange(event: React.ChangeEvent<HTMLSelectElement>) {
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
        alert("Please select an existing raw dataset.");
        return;
      }
      if (!datasetName.trim()) {
        alert("The selected raw dataset is missing a dataset name.");
        return;
      }
      next();
    }
  }

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

      {/* Ingestion Type Selection Cards */}
      <div style={{ marginBottom: 24 }}>
        <label className="labelStyle" style={{ display: "block", marginBottom: 12 }}>
          Select Data Ingestion Category:
          {refreshDatasetId && (
            <span style={{ marginLeft: 8, fontSize: 11, color: "var(--status-investigate)", fontWeight: 400 }}>
              (Locked in Refresh Mode)
            </span>
          )}
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Raw Data Card */}
          <label
            style={{
              padding: 16,
              borderRadius: "var(--radius-md)",
              backgroundColor: ingestionType === "raw" ? "var(--accent-dim)" : "var(--bg-input)",
              border: ingestionType === "raw" ? "1px solid var(--border-cyan)" : "1px solid var(--border-subtle)",
              cursor: refreshDatasetId ? "not-allowed" : "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="radio"
                name="ingestionType"
                value="raw"
                checked={ingestionType === "raw"}
                disabled={!!refreshDatasetId}
                onChange={() => handleIngestionTypeChange("raw")}
              />
              <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>
                Raw Data
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
              backgroundColor: ingestionType === "tagged" ? "var(--accent-dim)" : "var(--bg-input)",
              border: ingestionType === "tagged" ? "1px solid var(--border-cyan)" : "1px solid var(--border-subtle)",
              cursor: refreshDatasetId ? "not-allowed" : "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="radio"
                name="ingestionType"
                value="tagged"
                checked={ingestionType === "tagged"}
                disabled={!!refreshDatasetId}
                onChange={() => handleIngestionTypeChange("tagged")}
              />
              <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>
                Tagged Data
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 24 }}>
              Auxiliary annotations/labels mapped to an existing Raw dataset via <code>_id</code>.
            </div>
          </label>
        </div>
      </div>

      {/* Raw Data Input */}
      {ingestionType === "raw" && (
        <div style={{ padding: 18, borderRadius: "var(--radius-md)", backgroundColor: "var(--bg-card-hover)", border: "1px solid var(--border-subtle)", marginBottom: 24 }}>
          {refreshDatasetId ? (
            <div>
              <div style={{ fontSize: 12, color: "var(--status-investigate)", textTransform: "uppercase", fontWeight: 700 }}>
                🔄 Refresh Target Raw Dataset
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", marginTop: 4 }}>
                {datasetName || refreshDatasetMeta?.dataset_name || refreshDatasetMeta?.datasetName || `#${refreshDatasetId}`}
              </div>
            </div>
          ) : (
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                Dataset Display Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Flight Telemetry Batch 2026-Q3"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          )}
        </div>
      )}

      {/* Tagged Data Selection */}
      {ingestionType === "tagged" && (
        <div style={{ padding: 18, borderRadius: "var(--radius-md)", backgroundColor: "var(--bg-card-hover)", border: "1px solid var(--border-subtle)", marginBottom: 24 }}>
          {refreshDatasetId ? (
            <div>
              <div style={{ fontSize: 12, color: "var(--status-investigate)", textTransform: "uppercase", fontWeight: 700 }}>
                🔄 Refresh Target Tagged Dataset
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", marginTop: 4 }}>
                {datasetName || refreshDatasetMeta?.dataset_name || refreshDatasetMeta?.datasetName || `#${refreshDatasetId}`}
              </div>
            </div>
          ) : (
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
                <select value={parentDatasetId ?? ""} onChange={handleRawDatasetChange} style={{ width: "100%" }}>
                  <option value="">-- Select Parent Raw Dataset --</option>
                  {rawDatasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.dataset_name} (ID #{dataset.id})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button onClick={back} className="btn-secondary">
          ← Back to Preview
        </button>
        <button
          onClick={handleNext}
          className="btn-primary"
          disabled={!refreshDatasetId && ingestionType === "tagged" && (!parentDatasetId || rawDatasets.length === 0)}
        >
          Next: Schema Builder →
        </button>
      </div>
    </div>
  );
}