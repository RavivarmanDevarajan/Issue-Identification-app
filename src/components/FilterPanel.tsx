import React from "react";

interface Column {
  name: string;
  type: string;
  ontologyMapping: string;
}

interface InvestigationFilter {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface Props {
  columns: Column[];
  filters: InvestigationFilter[];
  addFilter: () => void;
  removeFilter: (id: string) => void;
  updateFilter: (
    id: string,
    key: keyof InvestigationFilter,
    value: string
  ) => void;
}

const operators = [
  { label: "Equals", value: "equals" },
  { label: "Not Equals", value: "!=" },
  { label: "Contains", value: "contains" },
  { label: "Starts With", value: "startsWith" },
  { label: "Ends With", value: "endsWith" },
  { label: "Greater Than", value: ">" },
  { label: "Greater Than or Equal", value: ">=" },
  { label: "Less Than", value: "<" },
  { label: "Less Than or Equal", value: "<=" },
];

export default function FilterPanel({
  columns,
  filters,
  addFilter,
  removeFilter,
  updateFilter,
}: Props) {
  return (
    <div style={{ padding: 16, borderTop: "1px solid var(--border-subtle)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Active Filters ({filters.length})
        </h3>
        <button onClick={addFilter} className="btn-primary" style={{ padding: "4px 10px", fontSize: 12 }}>
          + Add Filter
        </button>
      </div>

      {/* Empty State */}
      {filters.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: "16px 0" }}>
          No custom filters applied.
        </div>
      )}

      {/* Filter Cards */}
      {filters.map((filter) => (
        <div
          key={filter.id}
          style={{
            backgroundColor: "var(--bg-input)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: 12,
            marginBottom: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              Target Field
            </label>
            <select
              value={filter.field}
              onChange={(e) => updateFilter(filter.id, "field", e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">-- Select Field --</option>
              {columns.map((column) => (
                <option key={column.name} value={column.name}>
                  {column.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              Operator
            </label>
            <select
              value={filter.operator}
              onChange={(e) => updateFilter(filter.id, "operator", e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">-- Select Operator --</option>
              {operators.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              Value
            </label>
            <input
              type="text"
              value={filter.value}
              onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
              placeholder="Enter filter value..."
              style={{ width: "100%" }}
            />
          </div>

          <button onClick={() => removeFilter(filter.id)} className="btn-danger" style={{ marginTop: 4, width: "100%", padding: "6px" }}>
            Remove Filter
          </button>
        </div>
      ))}
    </div>
  );
}