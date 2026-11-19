import React, { useEffect, useState } from "react";
import Papa from "papaparse";

interface UploadStepProps {
  setFileData: (data: any[]) => void;
  setFileName: (name: string) => void;
  next: () => void;
  ingestionType?: "raw" | "tagged";
  setIngestionType?: (type: "raw" | "tagged") => void;
  onSelectRefreshDataset?: (id: number, meta: any) => void;
  onCreateNewDataset?: (type?: "raw" | "tagged") => void;
  selectedRefreshDatasetId?: number | null;
  selectedRefreshDatasetMeta?: any;
}

export default function UploadStep({
  setFileData,
  setFileName,
  next,
  ingestionType = "raw",
  setIngestionType,
  onSelectRefreshDataset,
  onCreateNewDataset,
  selectedRefreshDatasetId,
  selectedRefreshDatasetMeta,
}: UploadStepProps) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [tableFilter, setTableFilter] = useState<"all" | "raw" | "tagged">("all");

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      const response = await fetch("http://localhost:5000/datasets");
      const data = await response.json();
      setDatasets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch datasets:", error);
    } finally {
      setLoading(false);
    }
  };

  const rawDatasets = datasets.filter((dataset) => {
    const type = String(dataset.data_type || dataset.dataType || "raw").toLowerCase();
    return type === "raw";
  });

  const taggedDatasets = datasets.filter((dataset) => {
    const type = String(dataset.data_type || dataset.dataType || "").toLowerCase();
    return type === "tagged";
  });

  const activeCategory = ingestionType === "tagged" ? "tagged" : "raw";
  const currentCategoryDatasets = activeCategory === "tagged" ? taggedDatasets : rawDatasets;

  const selectedDataset = datasets.find((d) => d.id === selectedRefreshDatasetId) || selectedRefreshDatasetMeta;

  const handleCategorySwitch = (category: "raw" | "tagged") => {
    if (category === activeCategory) return;
    setIngestionType?.(category);
    // If the selected refresh dataset does not match the newly selected category, reset it
    if (selectedDataset) {
      const selectedType = String(selectedDataset.data_type || selectedDataset.dataType || "raw").toLowerCase();
      if (selectedType !== category) {
        onCreateNewDataset?.(category);
      }
    } else {
      onCreateNewDataset?.(category);
    }
  };

  const handleDestinationModeChange = (mode: "new" | "existing") => {
    if (mode === "new") {
      onCreateNewDataset?.(activeCategory);
    } else {
      // Pick first dataset in current category if available
      if (currentCategoryDatasets.length > 0) {
        const first = currentCategoryDatasets[0];
        onSelectRefreshDataset?.(first.id, first);
      }
    }
  };

  const handleSelectDatasetDropdown = (datasetIdStr: string) => {
    if (!datasetIdStr || datasetIdStr === "new") {
      onCreateNewDataset?.(activeCategory);
      return;
    }
    const target = datasets.find((d) => String(d.id) === datasetIdStr);
    if (target) {
      onSelectRefreshDataset?.(target.id, target);
    }
  };

  const processFile = (file: File) => {
    if (!file) return;

    if (selectedRefreshDatasetId && !selectedDataset) {
      alert(`Please select an existing ${activeCategory.toUpperCase()} dataset from the list first.`);
      return;
    }

    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setFileData(results.data);
        next();
      },
      error: (error) => {
        console.error("CSV Parse Error:", error);
        alert("Failed to parse CSV file");
      },
    });
  };

  const handleFileUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const downloadDataset = async (id: number) => {
    try {
      const response = await fetch(`http://localhost:5000/datasets/${id}/download`);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      const disposition = response.headers.get("Content-Disposition");
      let fileName = "dataset.csv";

      if (disposition) {
        const match = disposition.match(/filename="(.+)"/);
        if (match) fileName = match[1];
      }

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Failed to download dataset");
    }
  };

  const filteredTableDatasets = datasets.filter((dataset) => {
    if (tableFilter === "all") return true;
    const type = String(dataset.data_type || dataset.dataType || "raw").toLowerCase();
    return type === tableFilter;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Upload Section Card */}
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Step 1: Upload CSV Engineering Dataset
          </div>
          <span className="badge badge-cyan">CSV Format</span>
        </div>

        {/* 1. SEPARATE RAW AND TAGGED INGESTION */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            1. Select Data Ingestion Category (Keep raw and tagged uploads separate)
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* Raw Data Tab */}
            <div
              onClick={() => handleCategorySwitch("raw")}
              style={{
                padding: "14px 16px",
                borderRadius: "var(--radius-md)",
                backgroundColor: activeCategory === "raw" ? "var(--accent-dim)" : "var(--bg-input)",
                border: activeCategory === "raw" ? "2px solid var(--accent-cyan)" : "1px solid var(--border-subtle)",
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: activeCategory === "raw" ? "var(--accent-cyan)" : "var(--text-primary)" }}>
                  📁 Raw Data
                </span>
                <span className="badge badge-gray">{rawDatasets.length} Datasets</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Primary log records, base failure telemetry, and core complaint events.
              </div>
            </div>

            {/* Tagged Data Tab */}
            <div
              onClick={() => handleCategorySwitch("tagged")}
              style={{
                padding: "14px 16px",
                borderRadius: "var(--radius-md)",
                backgroundColor: activeCategory === "tagged" ? "rgba(245, 158, 11, 0.12)" : "var(--bg-input)",
                border: activeCategory === "tagged" ? "2px solid #f59e0b" : "1px solid var(--border-subtle)",
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: activeCategory === "tagged" ? "#f59e0b" : "var(--text-primary)" }}>
                  🏷️ Tagged Data
                </span>
                <span className="badge badge-gray">{taggedDatasets.length} Datasets</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Auxiliary taxonomy annotations, failure conditions, and component tags linked to Raw data.
              </div>
            </div>
          </div>
        </div>

        {/* 2. CHOOSE DESTINATION: CREATE NEW OR SELECT EXISTING */}
        <div style={{ marginBottom: 22, padding: "16px", borderRadius: "var(--radius-md)", backgroundColor: "var(--bg-card-hover)", border: "1px solid var(--border-subtle)" }}>
          <label style={{ display: "block", marginBottom: 10, fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            2. Choose Upload Destination for {activeCategory === "raw" ? "Raw Data" : "Tagged Data"}:
          </label>

          <div style={{ display: "flex", gap: 20, marginBottom: 14, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              <input
                type="radio"
                name="destinationMode"
                checked={!selectedRefreshDatasetId}
                onChange={() => handleDestinationModeChange("new")}
                style={{ accentColor: "var(--accent-cyan)" }}
              />
              Create a new {activeCategory === "raw" ? "Raw" : "Tagged"} dataset
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              <input
                type="radio"
                name="destinationMode"
                checked={!!selectedRefreshDatasetId}
                onChange={() => handleDestinationModeChange("existing")}
                style={{ accentColor: "var(--accent-cyan)" }}
              />
              Upload on existing {activeCategory === "raw" ? "Raw" : "Tagged"} dataset
            </label>
          </div>

          {selectedRefreshDatasetId ? (
            <div>
              <label htmlFor="select-existing-dataset" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                Select Existing {activeCategory === "raw" ? "Raw" : "Tagged"} Dataset:
              </label>

              {currentCategoryDatasets.length === 0 ? (
                <div style={{ padding: "10px", background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 6, color: "#fca5a5", fontSize: 12 }}>
                  No existing {activeCategory === "raw" ? "Raw" : "Tagged"} datasets found. Please choose "Create a new dataset" above.
                </div>
              ) : (
                <select
                  id="select-existing-dataset"
                  value={String(selectedRefreshDatasetId)}
                  onChange={(e) => handleSelectDatasetDropdown(e.target.value)}
                  style={{ width: "100%", maxWidth: 600, padding: "8px 12px", fontSize: 13, backgroundColor: "var(--bg-input)", color: "#fff", border: "1px solid var(--border-medium)", borderRadius: 6 }}
                >
                  {currentCategoryDatasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.dataset_name || `Dataset #${d.id}`} (ID #{d.id}) — {d.file_name || "CSV"}
                    </option>
                  ))}
                </select>
              )}

              <div style={{ marginTop: 8, fontSize: 12, color: "var(--accent-cyan)", display: "flex", alignItems: "center", gap: 6 }}>
                <span>ℹ️</span>
                <span>
                  Uploading on <strong>{selectedDataset?.dataset_name || `Dataset #${selectedRefreshDatasetId}`}</strong>:
                  Matching IDs and fields will be overridden; new IDs will create new rows; new headers will create new columns.
                </span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              You will configure the new dataset name and schema mappings in subsequent steps.
            </div>
          )}
        </div>

        {/* 3. CSV DROPZONE */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          style={{
            border: isDragging ? "2px dashed var(--accent-cyan)" : "2px dashed var(--border-medium)",
            borderRadius: "var(--radius-lg)",
            padding: "36px 20px",
            backgroundColor: isDragging ? "var(--accent-dim)" : "var(--bg-input)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            transition: "all 0.2s ease",
            cursor: "pointer",
          }}
          onClick={() => document.getElementById("csv-file-input")?.click()}
        >
          <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-cyan)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>

          <div>
            <div style={{ display: "inline-block", marginBottom: 6 }}>
              {selectedRefreshDatasetId ? (
                <span className="badge" style={{ backgroundColor: "#78350f", color: "#fcd34d", border: "1px solid #b45309" }}>
                  🔄 TARGET: {selectedDataset?.dataset_name || `Dataset #${selectedRefreshDatasetId}`} ({activeCategory.toUpperCase()})
                </span>
              ) : (
                <span className="badge badge-cyan">
                  ✨ TARGET: NEW {activeCategory.toUpperCase()} DATASET
                </span>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              Drag & Drop your CSV file here or click to browse
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              Supports .csv files with headers. Maximum size up to 100MB.
            </div>
          </div>

          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />

          <button className="btn-secondary" style={{ pointerEvents: "none" }}>
            Select CSV File
          </button>
        </div>
      </div>

      {/* Dataset History Table Panel */}
      <div className="panel-card">
        <div className="panel-header" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="panel-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
            Existing Datasets Catalog
          </div>

          {/* Catalog Filter Tabs */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setTableFilter("all")}
              className={tableFilter === "all" ? "btn-primary" : "btn-secondary"}
              style={{ fontSize: 12, padding: "4px 10px" }}
            >
              All ({datasets.length})
            </button>
            <button
              onClick={() => setTableFilter("raw")}
              className={tableFilter === "raw" ? "btn-primary" : "btn-secondary"}
              style={{ fontSize: 12, padding: "4px 10px" }}
            >
              Raw ({rawDatasets.length})
            </button>
            <button
              onClick={() => setTableFilter("tagged")}
              className={tableFilter === "tagged" ? "btn-primary" : "btn-secondary"}
              style={{ fontSize: 12, padding: "4px 10px" }}
            >
              Tagged ({taggedDatasets.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading dataset catalog...</div>
        ) : filteredTableDatasets.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No {tableFilter !== "all" ? tableFilter.toUpperCase() : ""} datasets found.
          </div>
        ) : (
          <div className="table-container">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Dataset Name</th>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Size (KB)</th>
                  <th>Last Updated</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTableDatasets.map((dataset) => {
                  const isRaw = String(dataset.data_type || dataset.dataType || "raw").toLowerCase() === "raw";
                  const isCurrentTarget = dataset.id === selectedRefreshDatasetId;

                  return (
                    <tr
                      key={dataset.id}
                      style={{
                        backgroundColor: isCurrentTarget ? "rgba(56, 189, 248, 0.08)" : undefined,
                      }}
                    >
                      <td style={{ fontWeight: 600, color: isRaw ? "var(--accent-cyan)" : "#f59e0b" }}>
                        {dataset.dataset_name || `Dataset #${dataset.id}`}
                        {isCurrentTarget && (
                          <span className="badge" style={{ marginLeft: 8, fontSize: 10, backgroundColor: "#78350f", color: "#fcd34d" }}>
                            Selected
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 500 }}>{dataset.file_name || "-"}</td>
                      <td>
                        <span className={`badge ${isRaw ? "badge-cyan" : "badge-gray"}`} style={{ color: isRaw ? undefined : "#f59e0b" }}>
                          {isRaw ? "RAW" : "TAGGED"}
                        </span>
                      </td>
                      <td>{dataset.size_kb ? dataset.size_kb.toFixed(2) : "-"}</td>
                      <td>
                        {dataset.last_refreshed_at
                          ? new Date(dataset.last_refreshed_at).toLocaleString()
                          : dataset.uploaded_at
                          ? new Date(dataset.uploaded_at).toLocaleString()
                          : "-"}
                      </td>
                      <td>
                        <span className={`status-badge ${String(dataset.status).toLowerCase() === "completed" ? "resolved" : "investigate"}`}>
                          {dataset.status || "Completed"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => {
                              const targetCat = isRaw ? "raw" : "tagged";
                              setIngestionType?.(targetCat);
                              onSelectRefreshDataset?.(dataset.id, dataset);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="btn-secondary"
                            style={{ fontSize: 11, padding: "3px 8px" }}
                          >
                            Upload on this
                          </button>
                          <button
                            onClick={() => downloadDataset(dataset.id)}
                            className="btn-ghost"
                            style={{ fontSize: 11, padding: "3px 8px" }}
                          >
                            Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
