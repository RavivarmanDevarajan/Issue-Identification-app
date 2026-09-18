import React from "react";

interface InvestigationToolbarProps {
  navigate: any;
  loadAllEvents: () => void;
  loadingTimeline: boolean;
  downloadData: () => void;
  filtersApplied: boolean;
  onSaveAsg: () => void;
}

export default function InvestigationToolbar({
  navigate,
  loadAllEvents,
  loadingTimeline,
  downloadData,
  filtersApplied,
  onSaveAsg,
}: InvestigationToolbarProps) {
  return (
    <div className="page-header-bar">
      {/* LEFT SECTION */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => navigate("investigate")} className="btn-secondary">
          ← Catalog
        </button>

        <div>
          <h1 className="page-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Investigation Workspace
          </h1>
          <p className="page-subtitle">
            Interactive multi-dimensional analytics, time-series, distribution breakdown & ASG flagging.
          </p>
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {filtersApplied && (
          <span className="badge badge-cyan" style={{ padding: "5px 10px", fontSize: 12 }}>
            ✓ Active Filters Applied
          </span>
        )}

        <button
          onClick={loadAllEvents}
          disabled={loadingTimeline}
          className="btn-secondary"
        >
          {loadingTimeline ? "Loading..." : "Load All Events"}
        </button>

        <button onClick={downloadData} className="btn-secondary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>

        <button onClick={onSaveAsg} className="btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          Save ASG
        </button>
      </div>
    </div>
  );
}