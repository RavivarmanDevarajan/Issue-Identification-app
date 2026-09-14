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

/* ---------------- OPERATORS ---------------- */

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
    <div
      style={{
        padding: 15,
        borderTop: "1px solid #334155",
      }}
    >
      {/* Header */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 15,
        }}
      >
        <h3
          style={{
            margin: 0,
            color: "white",
            fontSize: 16,
          }}
        >
          Filters
        </h3>

        <button
          onClick={addFilter}
          style={{
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Add
        </button>
      </div>

      {/* Empty State */}

      {filters.length === 0 && (
        <div
          style={{
            color: "#94a3b8",
            fontSize: 13,
            textAlign: "center",
            padding: "15px 0",
          }}
        >
          No filters added.
        </div>
      )}

      {/* Filter Cards */}

      {filters.map((filter) => (
        <div
          key={filter.id}
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
          }}
        >
          {/* Field */}

          <div style={{ marginBottom: 10 }}>
            <label
              style={{
                fontSize: 12,
                color: "#cbd5e1",
              }}
            >
              Field
            </label>

            <select
              value={filter.field}
              onChange={(e) =>
                updateFilter(
                  filter.id,
                  "field",
                  e.target.value
                )
              }
              style={selectStyle}
            >
              <option value="">
                Select Field
              </option>

              {columns.map((column) => (
                <option
                  key={column.name}
                  value={column.name}
                >
                  {column.name}
                </option>
              ))}
            </select>
          </div>

          {/* Operator */}

          <div style={{ marginBottom: 10 }}>
            <label
              style={{
                fontSize: 12,
                color: "#cbd5e1",
              }}
            >
              Operator
            </label>

            <select
              value={filter.operator}
              onChange={(e) =>
                updateFilter(
                  filter.id,
                  "operator",
                  e.target.value
                )
              }
              style={selectStyle}
            >
              <option value="">
                Select Operator
              </option>

              {operators.map((operator) => (
                <option
                  key={operator.value}
                  value={operator.value}
                >
                  {operator.label}
                </option>
              ))}
            </select>
          </div>

          {/* Value */}

          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                fontSize: 12,
                color: "#cbd5e1",
              }}
            >
              Value
            </label>

            <input
              type="text"
              value={filter.value}
              onChange={(e) =>
                updateFilter(
                  filter.id,
                  "value",
                  e.target.value
                )
              }
              placeholder="Enter value..."
              style={inputStyle}
            />
          </div>

          {/* Remove */}

          <button
            onClick={() =>
              removeFilter(filter.id)
            }
            style={{
              width: "100%",
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "8px",
              cursor: "pointer",
            }}
          >
            Remove Filter
          </button>
        </div>
      ))}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 5,
  padding: "8px",
  borderRadius: 6,
  border: "1px solid #475569",
  background: "#0f172a",
  color: "white",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 5,
  padding: "8px",
  borderRadius: 6,
  border: "1px solid #475569",
  background: "#0f172a",
  color: "white",
  boxSizing: "border-box",
};