import React, {
  useMemo,
  useState,
} from "react";

import type {
  FieldFilter,
  FilterType,
  SchemaResponse,
} from "./filterTypes";

/* ======================================================
   COMPONENT PROPS
====================================================== */

interface Props {
  schema: SchemaResponse | null;

  loadingSchema: boolean;

  search: string;

  setSearch: (
    value: string
  ) => void;

  filters: FieldFilter[];

  onFilterChange: (
    filters: FieldFilter[]
  ) => void;
}

/* ======================================================
   FIELD TYPE DETECTION
====================================================== */

function getFilterType(
  columnType: string
): FilterType {

  const type =
    String(
      columnType || ""
    ).toLowerCase();

  const isNumeric =
    type.includes("number") ||
    type.includes("integer") ||
    type.includes("float") ||
    type.includes("double") ||
    type.includes("decimal") ||
    type.includes("numeric");

  if (isNumeric) {
    return "numeric";
  }

  const isDate =
    type.includes("date") ||
    type.includes("datetime") ||
    type.includes("time") ||
    type.includes("timestamp");

  if (isDate) {
    return "date";
  }

  return "categorical";
}

/* ======================================================
   COMPONENT
====================================================== */

export default function InvestigationFieldsSidebar({
  schema,
  loadingSchema,
  search,
  setSearch,
  filters,
  onFilterChange,
}: Props) {

  const [
    expanded,
    setExpanded,
  ] = useState(true);

  /* ====================================================
     ALL AVAILABLE COLUMNS
  ==================================================== */

  const availableColumns =
    useMemo(() => {

      if (!schema) {
        return [];
      }

      /*
        Show every column.

        This includes:

        - categorical
        - numeric
        - date
        - timestamp
        - primary key
        - ontology-mapped fields
      */

      return schema.columns;

    }, [
      schema,
    ]);

  /* ====================================================
     SEARCH
  ==================================================== */

  const filteredColumns =
    useMemo(() => {

      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return availableColumns;
      }

      return availableColumns.filter(
        (column) =>
          column.name
            .toLowerCase()
            .includes(term)
      );

    }, [
      availableColumns,
      search,
    ]);

  /* ====================================================
     ADD FIELD
  ==================================================== */

  const addField = (
    column: (
      typeof availableColumns
    )[number]
  ) => {

    const exists =
      filters.some(
        (filter) =>
          filter.field ===
          column.name
      );

    if (exists) {
      return;
    }

    const filterType =
      getFilterType(
        column.type
      );

    const newFilter: FieldFilter = {
      field:
        column.name,

      filterType,

      values: [],
    };

    onFilterChange([
      ...filters,
      newFilter,
    ]);
  };

  /* ====================================================
     DRAG START
  ==================================================== */

  const handleDragStart = (
    event:
      React.DragEvent<HTMLDivElement>,

    column: (
      typeof availableColumns
    )[number]
  ) => {

    const filterType =
      getFilterType(
        column.type
      );

    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        field:
          column.name,

        filterType,

        values: [],
      })
    );

    event.dataTransfer.effectAllowed =
      "copy";
  };

  /* ====================================================
     RENDER
  ==================================================== */

  return (

    <div
      style={{
        width: 280,

        minWidth: 280,

        background:
          "#111827",

        borderRight:
          "1px solid #334155",

        display:
          "flex",

        flexDirection:
          "column",

        overflowY:
          "auto",
      }}
    >

      {/* ==================================================
          HEADER
      ================================================== */}

      <div
        onClick={() =>
          setExpanded(
            !expanded
          )
        }
        style={{
          padding: 20,

          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "center",

          borderBottom:
            "1px solid #334155",

          cursor:
            "pointer",
        }}
      >

        <h3
          style={{
            margin: 0,
          }}
        >
          Fields
        </h3>

        <span>
          {expanded
            ? "▼"
            : "►"}
        </span>

      </div>

      {/* ==================================================
          FIELD CONTENT
      ================================================== */}

      {expanded && (

        <div
          style={{
            padding: 20,
          }}
        >

          {/* ==================================================
              SEARCH
          ================================================== */}

          <input
            placeholder="Search fields..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            style={{
              width:
                "100%",

              padding:
                10,

              background:
                "#0f172a",

              color:
                "white",

              border:
                "1px solid #334155",

              borderRadius:
                6,

              marginBottom:
                16,

              outline:
                "none",

              boxSizing:
                "border-box",
            }}
          />

          {/* ==================================================
              LOADING
          ================================================== */}

          {loadingSchema ? (

            <div
              style={{
                color:
                  "#94a3b8",

                textAlign:
                  "center",

                padding:
                  30,
              }}
            >
              Loading fields...
            </div>

          ) : filteredColumns.length === 0 ? (

            <div
              style={{
                color:
                  "#94a3b8",

                textAlign:
                  "center",

                padding:
                  30,
              }}
            >
              No matching fields
            </div>

          ) : (

            /* ==================================================
               FIELD LIST
            ================================================== */

            filteredColumns.map(
              (column) => {

                const isSelected =
                  filters.some(
                    (filter) =>
                      filter.field ===
                      column.name
                  );

                const isPrimary =
                  column.name ===
                  schema?.primaryKey;

                const filterType =
                  getFilterType(
                    column.type
                  );

                const isNumeric =
                  filterType ===
                  "numeric";

                const isDate =
                  filterType ===
                  "date";

                const fieldIcon =
                  isPrimary
                    ? "🔑"
                    : isDate
                    ? "📅"
                    : isNumeric
                    ? "🔢"
                    : "📄";

                return (

                  <div
                    key={
                      column.name
                    }

                    draggable={
                      true
                    }

                    onDragStart={(
                      event
                    ) =>
                      handleDragStart(
                        event,
                        column
                      )
                    }

                    onClick={() =>
                      addField(
                        column
                      )
                    }

                    style={{
                      background:
                        isSelected
                          ? "#1e3a5f"
                          : "#1e293b",

                      border:
                        isSelected
                          ? "1px solid #2563eb"
                          : "1px solid #334155",

                      borderRadius:
                        8,

                      padding:
                        12,

                      marginBottom:
                        10,

                      cursor:
                        isSelected
                          ? "default"
                          : "grab",

                      opacity:
                        isSelected
                          ? 0.85
                          : 1,

                      userSelect:
                        "none",
                    }}
                  >

                    {/* ==========================================
                        FIELD HEADER
                    ========================================== */}

                    <div
                      style={{
                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        alignItems:
                          "center",
                      }}
                    >

                      <div
                        style={{
                          fontWeight:
                            600,

                          overflow:
                            "hidden",

                          textOverflow:
                            "ellipsis",

                          whiteSpace:
                            "nowrap",
                        }}

                        title={
                          column.name
                        }
                      >
                        {
                          column.name
                        }
                      </div>

                      <span
                        title={
                          column.type
                        }

                        style={{
                          fontSize:
                            16,
                        }}
                      >
                        {
                          fieldIcon
                        }
                      </span>

                    </div>

                    {/* ==========================================
                        FIELD TYPE
                    ========================================== */}

                    <div
                      style={{
                        display:
                          "flex",

                        alignItems:
                          "center",

                        gap:
                          8,

                        marginTop:
                          6,

                        color:
                          "#94a3b8",

                        fontSize:
                          12,
                      }}
                    >

                      <span>
                        {
                          column.type
                        }
                      </span>

                      {isPrimary && (

                        <span
                          style={{
                            color:
                              "#38bdf8",
                          }}
                        >
                          Primary Key
                        </span>

                      )}

                    </div>

                    {/* ==========================================
                        TAGS
                    ========================================== */}

                    <div
                      style={{
                        display:
                          "flex",

                        gap:
                          6,

                        flexWrap:
                          "wrap",

                        marginTop:
                          9,
                      }}
                    >

                      <span
                        style={{
                          background:
                            "#334155",

                          color:
                            "#e2e8f0",

                          fontSize:
                            11,

                          padding:
                            "3px 8px",

                          borderRadius:
                            20,
                        }}
                      >
                        {
                          column.type
                        }
                      </span>

                      {column.ontologyMapping && (

                        <span
                          style={{
                            background:
                              "#2563eb",

                            color:
                              "white",

                            fontSize:
                              11,

                            padding:
                              "3px 8px",

                            borderRadius:
                              20,
                          }}
                        >
                          {
                            column.ontologyMapping
                          }
                        </span>

                      )}

                    </div>

                    {/* ==========================================
                        FILTER TYPE
                    ========================================== */}

                    <div
                      style={{
                        marginTop:
                          8,

                        fontSize:
                          11,

                        color:
                          "#64748b",
                      }}
                    >
                      Filter type:{" "}
                      {filterType}
                    </div>

                    {/* ==========================================
                        SELECTED STATE
                    ========================================== */}

                    {isSelected && (

                      <div
                        style={{
                          color:
                            "#38bdf8",

                          fontSize:
                            12,

                          marginTop:
                            8,
                        }}
                      >
                        Added to Set A
                      </div>

                    )}

                    {/* ==========================================
                        DRAG HINT
                    ========================================== */}

                    {!isSelected && (

                      <div
                        style={{
                          color:
                            "#64748b",

                          fontSize:
                            11,

                          marginTop:
                            8,
                        }}
                      >
                        Drag to Set A
                      </div>

                    )}

                  </div>

                );
              }
            )

          )}

        </div>

      )}

    </div>

  );
}