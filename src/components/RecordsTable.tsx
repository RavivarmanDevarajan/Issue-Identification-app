import React from "react";
import Papa from "papaparse";

interface RecordsTableProps {
  records: any[];
  totalRecords?: number;
  columns?: {
    name: string;
    label: string;
  }[];
}

export default function RecordsTable({
  records,
  totalRecords,
  columns,
}: RecordsTableProps) {
  const displayedColumns =
    columns ||
    (records.length > 0
      ? Object.keys(records[0]).map((name) => ({ name, label: name }))
      : []);

  const downloadCSV = () => {
    if (records.length === 0) return;
    const csv = Papa.unparse(records);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "filtered_records.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
      {/* HEADER */}
      <div className="panel-header" style={{ padding: "16px 20px", marginBottom: 0 }}>
        <div>
          <div className="panel-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            Dataset Event Records
          </div>
          <div style={{ color: "var(--text-muted)", marginTop: 4, fontSize: 12 }}>
            Showing <strong style={{ color: "var(--accent-cyan)" }}>{records.length}</strong>
            {typeof totalRecords === "number" ? <> of <strong>{totalRecords}</strong></> : null} total records
          </div>
        </div>

        <button
          onClick={downloadCSV}
          disabled={records.length === 0}
          className="btn-primary"
          style={{ padding: "6px 14px", fontSize: 12 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
      </div>

      {/* TABLE */}
      <div className="table-container" style={{ flex: 1, border: "none", borderRadius: 0 }}>
        {records.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "var(--text-muted)", fontSize: 14, padding: 40 }}>
            No records to display for current filter selection.
          </div>
        ) : (
          <table className="analytics-table">
            <thead>
              <tr>
                <th style={{ width: 60, position: "sticky", top: 0, zIndex: 5 }}>#</th>
                {displayedColumns.map((column) => (
                  <th key={column.name} style={{ position: "sticky", top: 0, zIndex: 5 }}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((row, index) => (
                <tr key={index}>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{index + 1}</td>
                  {displayedColumns.map((column) => (
                    <td key={column.name} style={{ whiteSpace: "nowrap" }}>
                      {String(row[column.name] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
