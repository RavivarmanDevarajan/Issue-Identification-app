import React from "react";

interface HomeProps {
  navigate: (page: "home" | "ingestion" | "investigate" | "workspace" | "asgs") => void;
}

export default function Home({ navigate }: HomeProps) {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100%",
        backgroundColor: "var(--bg-main)",
        color: "var(--text-primary)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Header Bar */}
      <div className="page-header-bar">
        <div>
          <h1 className="page-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9" rx="1"/>
              <rect x="14" y="3" width="7" height="5" rx="1"/>
              <rect x="14" y="12" width="7" height="9" rx="1"/>
              <rect x="3" y="16" width="7" height="5" rx="1"/>
            </svg>
            System Overview & Executive Launchpad
          </h1>
          <p className="page-subtitle">
            AI-powered issue identification, data quality monitoring, and trend analytics platform.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-secondary" onClick={() => navigate("ingestion")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Ingest Dataset
          </button>
          <button className="btn-primary" onClick={() => navigate("investigate")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Launch Investigation
          </button>
        </div>
      </div>

      {/* Main Content Viewport */}
      <div style={{ padding: 28, flex: 1, display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Executive Quick Stats Tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div className="metric-card">
            <div className="metric-label">Data Ingestion Engine</div>
            <div className="metric-value">Active</div>
            <div className="metric-change" style={{ color: "var(--accent-cyan)" }}>
              ✓ Raw & Tagged Schema Support
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Issue Detection Status</div>
            <div className="metric-value" style={{ color: "var(--accent-cyan)" }}>Automated</div>
            <div className="metric-change" style={{ color: "var(--text-secondary)" }}>
              ASG Flagging Enabled
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Dataset Merging</div>
            <div className="metric-value">_id Match</div>
            <div className="metric-change" style={{ color: "var(--status-resolved)" }}>
              ✓ Parent-Child Linked
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Analytics Workspace</div>
            <div className="metric-value">BI Mode</div>
            <div className="metric-change" style={{ color: "var(--text-secondary)" }}>
              Multi-Field Filters Active
            </div>
          </div>
        </div>

        {/* Primary Platform Modules */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Platform Modules
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>

            {/* Ingestion Module */}
            <div
              className="panel-card interactive"
              onClick={() => navigate("ingestion")}
              style={{ cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 240 }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: "rgba(0, 229, 255, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-cyan)" }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <div>
                      <h2 style={{ fontSize: 17, fontWeight: 600, color: "#ffffff" }}>Data Ingestion</h2>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Pipeline & Schema Manager</div>
                    </div>
                  </div>
                  <span className="badge badge-cyan">Module 01</span>
                </div>

                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Upload raw CSV engineering logs, define ontology schemas, map timestamp fields, and execute incremental upsert refreshes.
                </p>
              </div>

              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                <button className="btn-secondary" style={{ width: "100%" }}>
                  Open Data Ingestion →
                </button>
              </div>
            </div>

            {/* Investigation Module */}
            <div
              className="panel-card interactive"
              onClick={() => navigate("investigate")}
              style={{ cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 240 }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--status-resolved)" }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                    </div>
                    <div>
                      <h2 style={{ fontSize: 17, fontWeight: 600, color: "#ffffff" }}>Dataset Catalog</h2>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Investigation Workspace</div>
                    </div>
                  </div>
                  <span className="badge badge-cyan">Module 02</span>
                </div>

                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Browse uploaded datasets, merge Raw with Tagged records by primary key, analyze multi-dimensional distributions and timeline trends.
                </p>
              </div>

              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                <button className="btn-primary" style={{ width: "100%" }}>
                  Launch Investigation Workspace →
                </button>
              </div>
            </div>

            {/* ASGs Module */}
            <div
              className="panel-card interactive"
              onClick={() => navigate("asgs")}
              style={{ cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 240 }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: "rgba(245, 158, 11, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--status-investigate)" }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    </div>
                    <div>
                      <h2 style={{ fontSize: 17, fontWeight: 600, color: "#ffffff" }}>ASGs (Flagged Issues)</h2>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Trend & Quality Tracking</div>
                    </div>
                  </div>
                  <span className="badge badge-cyan">Module 03</span>
                </div>

                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Review flagged engineering anomalies, monitor dynamic event counts across fresh dataset refreshes, track countermeasures, and update resolution statuses.
                </p>
              </div>

              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                <button className="btn-secondary" style={{ width: "100%" }}>
                  Manage Flagged ASGs →
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}