import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  FieldFilter,
} from "./filterTypes";

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
  onClose: () => void;
  onSave: (
    title: string,
    category: string
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
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(
    ASG_CATEGORIES[0]
  );

  useEffect(() => {
    if (open) {
      setTitle("");
      setCategory(ASG_CATEGORIES[0]);
    }
  }, [open]);

  const filterSummary = useMemo(
    () => filters.map(summarizeFilter),
    [filters]
  );

  if (!open) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 6, 23, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#111827",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 28,
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          style={{
            margin: 0,
            color: "#f8fafc",
            fontSize: 22,
          }}
        >
          Save ASG
        </h2>

        <p
          style={{
            marginTop: 8,
            color: "#94a3b8",
            fontSize: 14,
          }}
        >
          Flag this investigation trend with a title and
          issue category. It will appear in the ASGs module
          as C-01, C-02, and so on.
        </p>

        <label style={labelStyle}>Title</label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Handle failures in Q3"
          style={inputStyle}
        />

        <label style={labelStyle}>Issue category</label>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          style={inputStyle}
        >
          {ASG_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <div
          style={{
            marginTop: 18,
            padding: 14,
            background: "#0f172a",
            borderRadius: 8,
            border: "1px solid #334155",
            fontSize: 13,
            color: "#cbd5e1",
          }}
        >
          <div>
            Dataset:{" "}
            <strong>{datasetName || "Unknown"}</strong>
          </div>
          <div style={{ marginTop: 6 }}>
            Events: <strong>{eventCount}</strong>
          </div>
          <div style={{ marginTop: 6 }}>
            Filters:{" "}
            {filterSummary.length === 0
              ? "None (full dataset)"
              : filterSummary.join(" • ")}
          </div>
        </div>

        {errorMessage && (
          <div
            style={{
              marginTop: 14,
              color: "#fca5a5",
              fontSize: 13,
            }}
          >
            {errorMessage}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 22,
          }}
        >
          <button
            onClick={onClose}
            disabled={saving}
            style={secondaryButton}
          >
            Cancel
          </button>

          <button
            onClick={() => onSave(title, category)}
            disabled={saving || !title.trim()}
            style={{
              ...primaryButton,
              opacity: saving || !title.trim() ? 0.6 : 1,
              cursor:
                saving || !title.trim()
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save ASG"}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginTop: 16,
  marginBottom: 7,
  fontSize: 12,
  fontWeight: 600,
  color: "#cbd5e1",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0f172a",
  color: "white",
  border: "1px solid #475569",
  borderRadius: 6,
  padding: "10px 12px",
  outline: "none",
  boxSizing: "border-box",
};

const primaryButton: React.CSSProperties = {
  background: "#16a34a",
  color: "white",
  border: "none",
  padding: "10px 18px",
  borderRadius: 6,
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
