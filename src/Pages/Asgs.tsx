import React, { useState, useMemo } from "react";
import type {
  ASGStatus,
  ASGTrend,
  CountermeasureAction,
} from "../App";
import CountermeasureModal from "../components/Countermeasure";
import { formatCountermeasureDate } from "../components/countermeasureHelpers";

interface Props {
  navigate: any;
  asgs: ASGTrend[];
  deleteASG: (id: string) => void;
  updateASG: (id: string, updates: Partial<ASGTrend>) => void;
  onOpenASG: (asg: ASGTrend) => void;
  getASGEventCount: (asg: ASGTrend) => Promise<number | null>;
  dynamicEventCounts: Record<string, number>;
}

const categories = [
  "Recurring",
  "Re-occurring",
  "Spike",
  "Seasonal",
  "Anomaly",
  "Emerging",
  "Persistent",
];

const statuses: ASGStatus[] = [
  "Detect",
  "Investigate",
  "Resolved",
  "CAPA Implemented",
];

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  Recurring: { bg: "rgba(59, 130, 246, 0.15)", text: "#60A5FA", border: "rgba(59, 130, 246, 0.3)" },
  "Re-occurring": { bg: "rgba(139, 92, 246, 0.15)", text: "#A78BFA", border: "rgba(139, 92, 246, 0.3)" },
  Spike: { bg: "rgba(239, 68, 68, 0.15)", text: "#FCA5A5", border: "rgba(239, 68, 68, 0.3)" },
  Seasonal: { bg: "rgba(6, 182, 212, 0.15)", text: "#67E8F9", border: "rgba(6, 182, 212, 0.3)" },
  Anomaly: { bg: "rgba(245, 158, 11, 0.15)", text: "#FCD34D", border: "rgba(245, 158, 11, 0.3)" },
  Emerging: { bg: "rgba(16, 185, 129, 0.15)", text: "#6EE7B7", border: "rgba(16, 185, 129, 0.3)" },
  Persistent: { bg: "rgba(99, 102, 241, 0.15)", text: "#A5B4FC", border: "rgba(99, 102, 241, 0.3)" },
};

const statusColors: Record<ASGStatus, { bg: string; text: string; border: string }> = {
  Detect: { bg: "rgba(0, 229, 255, 0.12)", text: "#00E5FF", border: "rgba(0, 229, 255, 0.3)" },
  Investigate: { bg: "rgba(245, 158, 11, 0.12)", text: "#F59E0B", border: "rgba(245, 158, 11, 0.3)" },
  Resolved: { bg: "rgba(16, 185, 129, 0.12)", text: "#10B981", border: "rgba(16, 185, 129, 0.3)" },
  "CAPA Implemented": { bg: "rgba(139, 92, 246, 0.12)", text: "#8B5CF6", border: "rgba(139, 92, 246, 0.3)" },
};

export default function Asgs({
  navigate,
  asgs,
  deleteASG,
  updateASG,
  onOpenASG,
  getASGEventCount,
  dynamicEventCounts,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [countermeasureId, setCountermeasureId] = useState<string | null>(null);
  const [refreshingIds, setRefreshingIds] = useState<Record<string, boolean>>({});

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("All");

  function startEditing(asg: ASGTrend) {
    setEditingId(asg.id);
    setEditingTitle(asg.title);
    setEditingCategory(asg.category);
    setDeleteConfirmId(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingTitle("");
    setEditingCategory("");
  }

  function saveEditing() {
    if (!editingId) return;
    const title = editingTitle.trim();
    if (!title) return;
    updateASG(editingId, {
      title,
      category: editingCategory,
    });
    cancelEditing();
  }

  function changeStatus(id: string, status: ASGStatus) {
    updateASG(id, { status });
  }

  function saveCountermeasure(countermeasure?: CountermeasureAction) {
    if (!countermeasureId) return;
    updateASG(countermeasureId, { countermeasure });
    setCountermeasureId(null);
  }

  async function refreshCount(asg: ASGTrend) {
    if (asg.datasetId === undefined || asg.datasetId === null) return;
    setRefreshingIds((current) => ({ ...current, [asg.id]: true }));
    try {
      await getASGEventCount(asg);
    } finally {
      setRefreshingIds((current) => ({ ...current, [asg.id]: false }));
    }
  }

  // Summary statistics
  const stats = useMemo(() => {
    const total = asgs.length;
    const detect = asgs.filter((a) => (a.status || "Detect") === "Detect").length;
    const investigate = asgs.filter((a) => a.status === "Investigate").length;
    const resolved = asgs.filter((a) => a.status === "Resolved").length;
    const capa = asgs.filter((a) => a.status === "CAPA Implemented").length;
    return { total, detect, investigate, resolved, capa };
  }, [asgs]);

  // Filtered ASGs
  const filteredASGs = useMemo(() => {
    return asgs.filter((asg) => {
      const currentStatus = asg.status || "Detect";
      if (selectedStatusFilter !== "All" && currentStatus !== selectedStatusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = asg.title.toLowerCase().includes(query);
        const matchesNumber = (asg.number || "").toLowerCase().includes(query);
        const matchesCategory = asg.category.toLowerCase().includes(query);
        const matchesDataset = (asg.datasetName || "").toLowerCase().includes(query);
        return matchesTitle || matchesNumber || matchesCategory || matchesDataset;
      }
      return true;
    });
  }, [asgs, selectedStatusFilter, searchQuery]);

  return (
    <div style={{ width: "100%", padding: "28px 36px", boxSizing: "border-box" }}>
      {/* HEADER BAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
              ASG Trends Catalog
            </h1>
            <span style={{ background: "rgba(0, 229, 255, 0.12)", color: "var(--accent-cyan)", border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>
              {asgs.length} Total
            </span>
          </div>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
            Monitor, track lifecycle statuses, and attach countermeasures to identified anomaly trend groups.
          </p>
        </div>

        <button
          onClick={() => navigate("home")}
          className="btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px" }}
        >
          <span>←</span> Back to Dashboard
        </button>
      </div>

      {/* METRIC CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        <div className="panel-card" style={{ padding: "16px 20px" }}>
          <div style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Total ASGs
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginTop: 6 }}>
            {stats.total}
          </div>
        </div>

        <div className="panel-card" style={{ padding: "16px 20px", borderLeft: "3px solid #00E5FF" }}>
          <div style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Detect State
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#00E5FF", marginTop: 6 }}>
            {stats.detect}
          </div>
        </div>

        <div className="panel-card" style={{ padding: "16px 20px", borderLeft: "3px solid #F59E0B" }}>
          <div style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Investigating
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#F59E0B", marginTop: 6 }}>
            {stats.investigate}
          </div>
        </div>

        <div className="panel-card" style={{ padding: "16px 20px", borderLeft: "3px solid #8B5CF6" }}>
          <div style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            CAPA Implemented
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#8B5CF6", marginTop: 6 }}>
            {stats.capa}
          </div>
        </div>

        <div className="panel-card" style={{ padding: "16px 20px", borderLeft: "3px solid #10B981" }}>
          <div style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Resolved Trends
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#10B981", marginTop: 6 }}>
            {stats.resolved}
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      {asgs.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          {/* Status Tabs */}
          <div style={{ display: "flex", gap: 6, background: "var(--bg-input)", padding: 4, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
            {["All", ...statuses].map((st) => {
              const active = selectedStatusFilter === st;
              return (
                <button
                  key={st}
                  onClick={() => setSelectedStatusFilter(st)}
                  style={{
                    background: active ? "var(--bg-card)" : "transparent",
                    color: active ? "var(--accent-cyan)" : "var(--text-secondary)",
                    border: active ? "1px solid var(--border-subtle)" : "1px solid transparent",
                    borderRadius: 6,
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {st}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div style={{ position: "relative", minWidth: 260 }}>
            <input
              type="text"
              placeholder="Search ASGs by title, dataset..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {asgs.length === 0 && (
        <div className="panel-card" style={{ padding: 48, textAlign: "center", maxWidth: 640, margin: "40px auto 0" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0, 229, 255, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
            No ASGs Flagged Yet
          </h3>
          <p style={{ margin: "0 0 20px", color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.5 }}>
            Open the Investigation Workspace, explore trends by selecting field filters, and click <strong>"Save ASG"</strong> to track flagged issues here.
          </p>
          <button onClick={() => navigate("investigate")} className="btn-primary" style={{ padding: "10px 20px" }}>
            Browse Datasets & Start Investigation
          </button>
        </div>
      )}

      {/* ASG LISTING */}
      {asgs.length > 0 && filteredASGs.length === 0 && (
        <div className="panel-card" style={{ padding: 36, textAlign: "center", color: "var(--text-secondary)" }}>
          No ASGs match the selected filter or search criteria.
        </div>
      )}

      {filteredASGs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filteredASGs.map((asg) => {
            const isEditing = editingId === asg.id;
            const isDeleting = deleteConfirmId === asg.id;
            const isRefreshing = !!refreshingIds[asg.id];
            const currentEventCount = dynamicEventCounts[asg.id];

            const catStyle = categoryColors[asg.category] || {
              bg: "rgba(165, 173, 181, 0.15)",
              text: "#C2C9D1",
              border: "rgba(165, 173, 181, 0.3)",
            };

            const statStyle = statusColors[asg.status || "Detect"] || statusColors.Detect;

            return (
              <div
                key={asg.id}
                className="panel-card"
                style={{
                  padding: "20px 24px",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                }}
              >
                {/* EDITING STATE */}
                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        autoFocus
                        placeholder="ASG Title..."
                        style={{
                          flex: 1,
                          minWidth: 300,
                          padding: "10px 14px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--accent-cyan)",
                          borderRadius: 6,
                          color: "var(--text-primary)",
                          fontSize: 16,
                          outline: "none",
                        }}
                      />

                      <select
                        value={editingCategory}
                        onChange={(e) => setEditingCategory(e.target.value)}
                        style={{
                          padding: "10px 14px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: 6,
                          color: "var(--text-primary)",
                          fontSize: 14,
                          outline: "none",
                        }}
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={saveEditing}
                        disabled={!editingTitle.trim()}
                        className="btn-primary"
                        style={{ padding: "8px 18px", fontSize: 13 }}
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="btn-secondary"
                        style={{ padding: "8px 16px", fontSize: 13 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* NORMAL VIEW HEADER */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <span
                          style={{
                            background: "rgba(0, 229, 255, 0.1)",
                            color: "var(--accent-cyan)",
                            border: "1px solid rgba(0, 229, 255, 0.25)",
                            padding: "3px 10px",
                            borderRadius: 6,
                            fontWeight: 700,
                            fontSize: 13,
                            fontFamily: "monospace",
                          }}
                        >
                          {asg.number}
                        </span>

                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
                          {asg.title}
                        </h2>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {/* Category Badge */}
                        <span
                          style={{
                            background: catStyle.bg,
                            color: catStyle.text,
                            border: `1px solid ${catStyle.border}`,
                            padding: "4px 12px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {asg.category}
                        </span>

                        {/* Status Select */}
                        <div style={{ position: "relative" }}>
                          <select
                            value={asg.status || "Detect"}
                            onChange={(e) => changeStatus(asg.id, e.target.value as ASGStatus)}
                            style={{
                              background: statStyle.bg,
                              color: statStyle.text,
                              border: `1px solid ${statStyle.border}`,
                              borderRadius: 20,
                              padding: "4px 28px 4px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              outline: "none",
                              appearance: "none",
                            }}
                          >
                            {statuses.map((status) => (
                              <option
                                key={status}
                                value={status}
                                style={{ background: "#171A1D", color: "#F0F4F8" }}
                              >
                                {status}
                              </option>
                            ))}
                          </select>
                          <svg
                            width="10"
                            height="6"
                            viewBox="0 0 10 6"
                            fill="none"
                            stroke={statStyle.text}
                            strokeWidth="1.5"
                            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                          >
                            <path d="M1 1L5 5L9 1" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* METADATA LINE */}
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12, color: "var(--text-secondary)", fontSize: 13, flexWrap: "wrap" }}>
                      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                        {asg.datasetName || "Unknown dataset"}
                      </span>

                      <span>•</span>

                      {isRefreshing ? (
                        <span style={{ color: "var(--accent-cyan)", display: "flex", alignItems: "center", gap: 4 }}>
                          <span className="pulse-dot"></span> Calculating events...
                        </span>
                      ) : currentEventCount !== undefined ? (
                        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                          {currentEventCount.toLocaleString()} {currentEventCount === 1 ? "event" : "events"}
                        </span>
                      ) : (
                        <span>Calculating events...</span>
                      )}

                      {asg.createdAt && (
                        <>
                          <span>•</span>
                          <span>Saved {new Date(asg.createdAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>

                    {/* CONFIGURATION TAGS */}
                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {asg.filters && asg.filters.length > 0 && (
                        <span style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", padding: "3px 10px", borderRadius: 6, fontSize: 12 }}>
                          🔍 {asg.filters.length} {asg.filters.length === 1 ? "Filter" : "Filters"} Applied
                        </span>
                      )}

                      {asg.dateBy && (
                        <span style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", padding: "3px 10px", borderRadius: 6, fontSize: 12 }}>
                          📅 Date: {asg.dateBy}
                        </span>
                      )}

                      {asg.colorBy && (
                        <span style={{ background: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", padding: "3px 10px", borderRadius: 6, fontSize: 12 }}>
                          🎨 Color: {asg.colorBy}
                        </span>
                      )}
                    </div>

                    {/* COUNTERMEASURE ALERT CARD */}
                    {asg.countermeasure && (
                      <div
                        style={{
                          marginTop: 14,
                          padding: "12px 16px",
                          background: "rgba(245, 158, 11, 0.08)",
                          border: "1px solid rgba(245, 158, 11, 0.25)",
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Countermeasure Action • {formatCountermeasureDate(asg.countermeasure.date)}
                          </div>
                        </div>

                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginTop: 4 }}>
                          {asg.countermeasure.title || "Countermeasure Action"}
                        </div>

                        {asg.countermeasure.description && (
                          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, whiteSpace: "pre-wrap" }}>
                            {asg.countermeasure.description}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* BOTTOM ACTION BUTTONS */}
                {!isEditing && (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 14,
                      borderTop: "1px solid var(--border-subtle)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {/* VIEW ASG */}
                      <button
                        type="button"
                        onClick={() => onOpenASG(asg)}
                        disabled={asg.datasetId == null}
                        className="btn-primary"
                        style={{
                          padding: "6px 16px",
                          fontSize: 13,
                          opacity: asg.datasetId == null ? 0.5 : 1,
                          cursor: asg.datasetId == null ? "not-allowed" : "pointer",
                        }}
                      >
                        View ASG
                      </button>

                      {/* REFRESH COUNT */}
                      <button
                        type="button"
                        onClick={() => refreshCount(asg)}
                        disabled={asg.datasetId == null || isRefreshing}
                        className="btn-secondary"
                        style={{
                          padding: "6px 14px",
                          fontSize: 13,
                          opacity: asg.datasetId == null || isRefreshing ? 0.5 : 1,
                          cursor: asg.datasetId == null || isRefreshing ? "not-allowed" : "pointer",
                        }}
                      >
                        {isRefreshing ? "Refreshing..." : "Refresh Count"}
                      </button>

                      {/* COUNTERMEASURE */}
                      <button
                        type="button"
                        onClick={() => setCountermeasureId(asg.id)}
                        style={{
                          padding: "6px 14px",
                          border: "1px solid rgba(245, 158, 11, 0.4)",
                          borderRadius: 6,
                          background: "rgba(245, 158, 11, 0.12)",
                          color: "#FCD34D",
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {asg.countermeasure ? "Edit Countermeasure" : "+ Countermeasure"}
                      </button>

                      {/* EDIT */}
                      <button
                        type="button"
                        onClick={() => startEditing(asg)}
                        className="btn-secondary"
                        style={{ padding: "6px 14px", fontSize: 13 }}
                      >
                        Edit
                      </button>
                    </div>

                    {/* DELETE */}
                    <div>
                      {isDeleting ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#EF4444", fontSize: 12, fontWeight: 500 }}>
                            Confirm delete?
                          </span>
                          <button
                            onClick={() => {
                              deleteASG(asg.id);
                              setDeleteConfirmId(null);
                            }}
                            className="btn-danger"
                            style={{ padding: "6px 14px", fontSize: 13 }}
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="btn-secondary"
                            style={{ padding: "6px 12px", fontSize: 13 }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(asg.id)}
                          className="btn-danger"
                          style={{ padding: "6px 14px", fontSize: 13 }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* COUNTERMEASURE MODAL */}
      <CountermeasureModal
        open={countermeasureId !== null}
        countermeasure={asgs.find((a) => a.id === countermeasureId)?.countermeasure}
        asgLabel={(() => {
          const asg = asgs.find((a) => a.id === countermeasureId);
          return asg ? `${asg.number} ${asg.title}` : undefined;
        })()}
        onClose={() => setCountermeasureId(null)}
        onSave={saveCountermeasure}
        onRemove={() => saveCountermeasure(undefined)}
      />
    </div>
  );
}

