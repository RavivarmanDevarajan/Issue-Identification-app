import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  FieldFilter,
} from "./filterTypes";

import type {
  ASGTrend,
  CountermeasureAction,
} from "../App";

import { CountermeasureFields } from "./Countermeasure";

import {
  emptyCountermeasureDraft,
  fromCountermeasureDraft,
  isCountermeasureDraftPartial,
  type CountermeasureDraft,
} from "./countermeasureHelpers";

export const ASG_CATEGORIES = [
  "Recurring",
  "Re-occurring",
  "Spike",
  "Seasonal",
  "Anomaly",
  "Emerging",
  "Persistent",
] as const;

interface Props {
  open: boolean;
  datasetName: string;
  eventCount: number;
  filters: FieldFilter[];
  saving: boolean;
  errorMessage: string;
  duplicateASG?: ASGTrend | null;
  onClose: () => void;
  onSave: (
    title: string,
    category: string,
    countermeasure?: CountermeasureAction
  ) => void;
}

function summarizeFilter(
  filter: FieldFilter
): string {
  if (filter.filterType === "categorical") {
    return `${filter.field}: ${filter.values.join(", ")}`;
  }

  if (filter.filterType === "numeric") {
    if (filter.operator === "between") {
      return `${filter.field}: ${filter.min} – ${filter.max}`;
    }
    return `${filter.field} ${filter.operator ?? ""} ${filter.value ?? ""}`;
  }

  if (filter.filterType === "date") {
    return `${filter.field}: ${filter.from || "…"} → ${filter.to || "…"}`;
  }

  return filter.field;
}

export default function SaveAsgModal({
  open,
  datasetName,
  eventCount,
  filters,
  saving,
  errorMessage,
  duplicateASG,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(
    ASG_CATEGORIES[0]
  );

  const [countermeasure, setCountermeasure] =
    useState<CountermeasureDraft>(
      emptyCountermeasureDraft
    );

  useEffect(() => {
    if (open) {
      setTitle("");
      setCategory(ASG_CATEGORIES[0]);
      setCountermeasure(emptyCountermeasureDraft);
    }
  }, [open]);

  const filterSummary = useMemo(
    () => filters.map(summarizeFilter),
    [filters]
  );

  const hasPartialCountermeasure =
    isCountermeasureDraftPartial(countermeasure);

  const isDuplicate = Boolean(duplicateASG);

  const cannotSave =
    saving ||
    !title.trim() ||
    hasPartialCountermeasure ||
    isDuplicate;

  if (!open) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        className="panel-card"
        style={{
          width: "100%",
          maxWidth: 580,
          maxHeight: "calc(100vh - 48px)",
          backgroundColor: "var(--bg-modal)",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: 18, fontWeight: 600 }}>
              Flag & Save ASG (Actionable System Group)
            </h2>
            <p style={{ marginTop: 4, color: "var(--text-muted)", fontSize: 12 }}>
              Save current investigation filter state into a tracked ASG issue.
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 4 }}>
            ✕
          </button>
        </div>

        <div style={{ padding: 24, overflowY: "auto", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {duplicateASG && (
            <div style={{ padding: "12px 14px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "var(--radius-md)" }}>
              <div style={{ color: "var(--status-detect)", fontWeight: 600, fontSize: 13 }}>
                ⚠️ Issue Duplicate Detected
              </div>
              <div style={{ color: "var(--text-primary)", fontSize: 13, marginTop: 4 }}>
                {duplicateASG.number} — {duplicateASG.title}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
                An ASG with the exact same dataset and active filters is already registered.
              </div>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
              ASG Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Flight Telemetry Vibration Spike in Motor B"
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
              Issue Classification Category *
            </label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%" }}>
              {ASG_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div style={{ paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 13 }}>
              Countermeasure Action Plan <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "4px 0 10px" }}>
              Plots a countermeasure reference marker on timeline charts for effectiveness tracking.
            </p>

            <CountermeasureFields draft={countermeasure} onChange={setCountermeasure} disabled={saving} />
          </div>

          <div style={{ padding: 14, backgroundColor: "var(--bg-input)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 4 }}>
            <div>Dataset: <strong style={{ color: "var(--text-primary)" }}>{datasetName || "Unknown"}</strong></div>
            <div>Current Events Match: <strong style={{ color: "var(--accent-cyan)" }}>{eventCount}</strong></div>
            <div>
              Active Filters:{" "}
              {filterSummary.length === 0 ? "None (full dataset)" : filterSummary.join(" • ")}
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-sidebar)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {errorMessage ? (
            <div style={{ color: "var(--status-detect)", fontSize: 12 }}>{errorMessage}</div>
          ) : <div />}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} disabled={saving} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => onSave(title, category, fromCountermeasureDraft(countermeasure))}
              disabled={cannotSave}
              className="btn-primary"
            >
              {saving ? "Saving..." : isDuplicate ? "Already Tracked" : "Save & Register ASG"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
