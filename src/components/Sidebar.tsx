import React from "react";

export type Page =
  | "home"
  | "ingestion"
  | "investigate"
  | "workspace"
  | "asgs";

interface SidebarProps {
  currentPage: Page;
  navigate: (page: Page) => void;
  selectedDatasetName?: string | null;
  selectedASGTitle?: string | null;
}

export default function Sidebar({
  currentPage,
  navigate,
  selectedDatasetName,
  selectedASGTitle,
}: SidebarProps) {
  const navItems = [
    {
      id: "home" as Page,
      label: "Home Overview",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      id: "ingestion" as Page,
      label: "Data Ingestion",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      ),
    },
    {
      id: "investigate" as Page,
      label: "Dataset Catalog",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        </svg>
      ),
    },
    {
      id: "workspace" as Page,
      label: "Investigation Workspace",
      badge: selectedDatasetName ? "Active" : undefined,
      disabled: !selectedDatasetName,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      ),
    },
    {
      id: "asgs" as Page,
      label: "ASG Flagged Issues",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
    },
  ];

  return (
    <aside
      style={{
        width: 250,
        height: "100%",
        backgroundColor: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        userSelect: "none",
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      {/* Top Header Identity */}
      <div>
        <div
          style={{
            padding: "20px 20px 18px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "linear-gradient(135deg, #00E5FF 0%, #007799 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#000",
              boxShadow: "0 0 12px rgba(0, 229, 255, 0.3)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", letterSpacing: "0.02em" }}>
              ASG PLATFORM
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
              Issue Intelligence AI
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            const isDisabled = item.disabled;

            return (
              <button
                key={item.id}
                disabled={isDisabled}
                onClick={() => !isDisabled && navigate(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  backgroundColor: isActive
                    ? "var(--accent-dim)"
                    : "transparent",
                  color: isActive
                    ? "var(--accent-cyan)"
                    : isDisabled
                    ? "var(--text-disabled)"
                    : "var(--text-secondary)",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  transition: "all 0.15s ease",
                  textAlign: "left",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!isActive && !isDisabled) {
                    e.currentTarget.style.backgroundColor = "var(--bg-card-hover)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive && !isDisabled) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: isActive ? "var(--accent-cyan)" : "currentColor", display: "flex" }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4,
                      backgroundColor: "var(--accent-cyan)",
                      color: "#000",
                      textTransform: "uppercase",
                    }}
                  >
                    {item.badge}
                  </span>
                )}

                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 6,
                      bottom: 6,
                      width: 3,
                      borderRadius: "0 4px 4px 0",
                      backgroundColor: "var(--accent-cyan)",
                      boxShadow: "0 0 8px var(--accent-cyan)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Context Info Card */}
      <div style={{ padding: 14 }}>
        {selectedDatasetName ? (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.05em" }}>
              Active Dataset Context
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--accent-cyan)",
                marginTop: 4,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={selectedDatasetName}
            >
              {selectedDatasetName}
            </div>
            {selectedASGTitle && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  marginTop: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={selectedASGTitle}
              >
                ASG: {selectedASGTitle}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              border: "1px dashed var(--border-subtle)",
              fontSize: 11,
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            No active dataset selected
          </div>
        )}

        <div
          style={{
            marginTop: 14,
            fontSize: 11,
            color: "var(--text-disabled)",
            textAlign: "center",
            fontWeight: 500,
          }}
        >
          Issue Identification System v2.5
        </div>
      </div>
    </aside>
  );
}
