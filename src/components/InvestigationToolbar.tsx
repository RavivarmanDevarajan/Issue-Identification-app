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
    <div
      style={{
        height: 72,
        background: "#111827",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 30px",
        borderBottom: "1px solid #334155",
      }}
    >
      {/* LEFT SECTION */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <button
          onClick={() => navigate("investigate")}
          style={secondaryButton}
        >
          ← Back
        </button>

        <div>
          <div
            style={{
              color: "white",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            Investigation Workspace
          </div>

          <div
            style={{
              color: "#94a3b8",
              fontSize: 13,
              marginTop: 3,
            }}
          >
            Explore • Filter • Analyze • Save
          </div>
        </div>
      </div>

      {/* RIGHT SECTION */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {filtersApplied && (
          <div
            style={{
              background: "#16a34a",
              color: "white",
              padding: "7px 12px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Filters Applied
          </div>
        )}

        <button
          onClick={loadAllEvents}
          disabled={loadingTimeline}
          style={primaryButton}
        >
          {loadingTimeline
            ? "Loading..."
            : "Load All Events"}
        </button>

        <button
          onClick={downloadData}
          style={purpleButton}
        >
          Download CSV
        </button>

        <button
          onClick={onSaveAsg}
          style={saveButton}
        >
          Save ASG
        </button>
      </div>
    </div>
  );
}

/* ======================================================
   BUTTON STYLES
====================================================== */

const primaryButton: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  padding: "10px 18px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryButton: React.CSSProperties = {
  background: "#374151",
  color: "white",
  border: "none",
  padding: "10px 18px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};

const purpleButton: React.CSSProperties = {
  background: "#7c3aed",
  color: "white",
  border: "none",
  padding: "10px 18px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};

const saveButton: React.CSSProperties = {
  background: "#16a34a",
  color: "white",
  border: "none",
  padding: "10px 18px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};