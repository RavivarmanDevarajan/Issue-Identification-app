import React from "react";

export default function PreviewStep({
  data,
  next,
  back,
  refreshDatasetId,
  refreshDatasetMeta,
}: any) {
  if (!data || !data.length) {
    return <p style={{ color: "var(--text-muted)", padding: 20 }}>No dataset records parsed.</p>;
  }

  const columns = Object.keys(data[0]);

  const targetName =
    refreshDatasetMeta?.dataset_name ||
    refreshDatasetMeta?.datasetName ||
    (refreshDatasetId ? `#${refreshDatasetId}` : "");

  const targetType = (
    refreshDatasetMeta?.data_type ||
    refreshDatasetMeta?.dataType ||
    "raw"
  ).toUpperCase();

  return (
    <div className="panel-card" style={{ maxWidth: 1100 }}>
      <div className="panel-header">
        <div className="panel-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Step 2: CSV Data Preview & Sample Inspection
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span className="badge badge-cyan">{data.length} Total Records</span>
          <span className="badge badge-gray">{columns.length} Columns</span>
        </div>
      </div>

      {refreshDatasetId && (
        <div
          style={{
            marginBottom: 20,
            padding: "14px 18px",
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ fontSize: 22 }}>🔄</span>
          <div>
            <div style={{ fontWeight: 700, color: "#FCD34D", fontSize: 14 }}>
              Refresh Mode — Updating Existing Dataset
            </div>
            <div style={{ fontSize: 13, color: "#FDE68A", marginTop: 2 }}>
              Target Dataset: <strong>{targetName}</strong> • Ingestion Type: <strong>{targetType}</strong>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.4 }}>
              The incoming CSV columns will be matched against the original dataset schema. Matching records will be overwritten; new events will be appended.
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
        Previewing first 5 rows of parsed CSV data:
      </div>

      <div className="table-container" style={{ marginBottom: 24 }}>
        <table className="analytics-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 5).map((row: any, i: number) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col} style={{ whiteSpace: "nowrap" }}>
                    {String(row[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button onClick={back} className="btn-secondary">
          ← Back to File Upload
        </button>
        <button onClick={next} className="btn-primary">
          Next: Dataset Configuration →
        </button>
      </div>
    </div>
  );
}