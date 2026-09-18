import React, { useEffect, useState } from "react";
import Papa from "papaparse";

export default function UploadStep({
  setFileData,
  setFileName,
  next,
  onSelectRefreshDataset,
  selectedRefreshDatasetId,
  setSelectedRefreshDatasetId,
}: any) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsingRefresh, setParsingRefresh] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  const processFile = (file: File) => {
    if (!file) return;
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

  const handleRefreshFileSelect = (datasetId: number, dataset: any) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setParsingRefresh(datasetId);
      setFileName(file.name);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setFileData(results.data);
          if (onSelectRefreshDataset) {
            onSelectRefreshDataset(datasetId, dataset);
          }
          setParsingRefresh(null);
          next();
        },
        error: (error) => {
          console.error("CSV Parse Error:", error);
          alert("Failed to parse CSV file");
          setParsingRefresh(null);
        },
      });
    };
    input.click();
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

        {selectedRefreshDatasetId && (
          <div
            style={{
              marginBottom: 18,
              padding: "12px 16px",
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: 13, color: "#FCD34D" }}>
              <strong>🔄 Active Refresh Target:</strong> Dataset #{selectedRefreshDatasetId}. Select a CSV file below to perform incremental refresh.
            </div>
            <button
              onClick={() => setSelectedRefreshDatasetId && setSelectedRefreshDatasetId(null)}
              className="btn-secondary"
              style={{ padding: "4px 10px", fontSize: 12 }}
            >
              Clear Target
            </button>
          </div>
        )}

        {/* Dropzone Container */}
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
        <div className="panel-header">
          <div className="panel-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
            Previous Ingestions & Incremental Refreshes
          </div>
          <span className="badge badge-gray">{datasets.length} Ingested Datasets</span>
        </div>

        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            background: "var(--accent-dim)",
            border: "1px solid var(--border-cyan)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-secondary)",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "var(--accent-cyan)" }}>💡 Upsert Ingestion Tip:</strong> Click{" "}
          <span style={{ color: "var(--status-investigate)", fontWeight: 700 }}>↻ Refresh</span> on any existing dataset to update it with new events. Schema and ontology mappings are reused automatically. Matching <code>_id</code> records will be updated; new records will be appended.
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading dataset catalog...</div>
        ) : datasets.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No datasets uploaded yet. Upload a CSV above to get started.</div>
        ) : (
          <div className="table-container">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Dataset Name</th>
                  <th>Updated Date</th>
                  <th>Size (KB)</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Ingestion Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((dataset) => (
                  <tr key={dataset.id}>
                    <td style={{ fontWeight: 500 }}>{dataset.file_name || "-"}</td>
                    <td style={{ color: "var(--accent-cyan)" }}>{dataset.dataset_name || "-"}</td>
                    <td>
                      {dataset.last_refreshed_at
                        ? new Date(dataset.last_refreshed_at).toLocaleString()
                        : dataset.uploaded_at
                        ? new Date(dataset.uploaded_at).toLocaleString()
                        : "-"}
                    </td>
                    <td>{dataset.size_kb ? dataset.size_kb.toFixed(2) : "-"}</td>
                    <td>
                      <span className="badge badge-gray">
                        {String(dataset.data_type || dataset.dataType || "Raw").toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${String(dataset.status).toLowerCase() === "completed" ? "resolved" : "investigate"}`}>
                        {dataset.status || "Completed"}
                      </span>
                    </td>
                    <td>{dataset.ingestion_time_ms ? `${dataset.ingestion_time_ms} ms` : "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => downloadDataset(dataset.id)}
                          className="btn-ghost"
                          style={{ fontSize: 12, padding: "4px 8px" }}
                        >
                          Download
                        </button>
                        <button
                          disabled={parsingRefresh === dataset.id}
                          onClick={() => handleRefreshFileSelect(dataset.id, dataset)}
                          className="btn-secondary"
                          style={{
                            fontSize: 12,
                            padding: "4px 10px",
                            borderColor: "var(--status-investigate)",
                            color: "var(--status-investigate)",
                          }}
                        >
                          {parsingRefresh === dataset.id ? "Parsing..." : "↻ Refresh"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}