import React, {
  useState,
} from "react";

import type {
  FieldFilter,
  SchemaResponse,
} from "./filterTypes";

import CategoricalFilter from "./CategoricalFilter";
import NumericFilter from "./NumericFilter";
import DateFilter from "./DateFilter";

/* ======================================================
   PROPS
====================================================== */

interface Props {
  schema: SchemaResponse | null;

  records: any[];

  filters: FieldFilter[];

  /*
    Returns the records that should be used to populate the
    options for a particular field. The parent excludes the
    field's own filter and applies all other active filters.
  */
  getRecordsForFilter: (
    field: string
  ) => any[];

  onFilterChange: (
    filters: FieldFilter[]
  ) => void;
}

/* ======================================================
   SORT TYPES
====================================================== */

type SortMode =
  | "count-desc"
  | "count-asc"
  | "alpha-asc"
  | "alpha-desc";

/* ======================================================
   COMPONENT
====================================================== */

export default function InvestigationSetSidebar({

  schema,

  records,

  filters,

  getRecordsForFilter,

  onFilterChange,

}: Props) {

  const [
    expanded,
    setExpanded,
  ] = useState(true);

  const [
    openField,
    setOpenField,
  ] = useState<string | null>(
    null
  );

  const [
    valueSearch,
    setValueSearch,
  ] = useState("");

  const [
    selectedOnly,
    setSelectedOnly,
  ] = useState(false);

  const [
    sortMode,
    setSortMode,
  ] = useState<SortMode>(
    "count-desc"
  );

  const [
    isDragOver,
    setIsDragOver,
  ] = useState(false);

  /* ====================================================
     HELPERS
  ==================================================== */

  const updateFilter = (
    updated: FieldFilter
  ) => {

    onFilterChange(

      filters.map((filter) =>

        filter.field ===
        updated.field

          ? updated

          : filter

      )

    );

  };

  const removeField = (
    field: string
  ) => {

    onFilterChange(

      filters.filter(

        (filter) =>

          filter.field !==
          field

      )

    );

    if (
      openField === field
    ) {

      setOpenField(null);

    }

  };

  const clearAllFilters = () => {

    onFilterChange([]);

    setOpenField(null);

    setValueSearch("");

    setSelectedOnly(false);

  };

  /* ====================================================
     COLUMN TYPE
  ==================================================== */

  const getFilterType = (
    field: string
  ): FieldFilter["filterType"] => {

    const column =
      schema?.columns.find(

        (c) =>
          c.name === field

      );

    if (!column) {

      return "categorical";

    }

    const type =
      column.type.toLowerCase();

    if (
      type.includes("date")
    ) {

      return "date";

    }

    if (

      type.includes("number") ||

      type.includes("integer") ||

      type.includes("float") ||

      type.includes("double")

    ) {

      return "numeric";

    }

    return "categorical";

  };
  /* ====================================================
     DRAG & DROP
  ==================================================== */

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>
  ) => {

    event.preventDefault();

    event.dataTransfer.dropEffect =
      "copy";

    setIsDragOver(true);

  };

  const handleDragLeave = (
    event: React.DragEvent<HTMLDivElement>
  ) => {

    event.preventDefault();

    setIsDragOver(false);

  };

const handleDrop = (
  event: React.DragEvent<HTMLDivElement>
) => {

    event.preventDefault();

    setIsDragOver(false);

    const payload =
        event.dataTransfer.getData(
            "application/json"
        );

    if (!payload) {
        return;
    }

    try {

        const filter =
            JSON.parse(payload) as FieldFilter;

        const exists =
            filters.some(
                f =>
                    f.field ===
                    filter.field
            );

        if (exists) {
            return;
        }

        onFilterChange([
            ...filters,
            filter,
        ]);

        setOpenField(
            filter.field
        );

    } catch {

        console.error(
            "Invalid drag payload"
        );

    }

};

  /* ====================================================
     SELECTED COUNT
  ==================================================== */

  const selectedFilterCount =
    filters.reduce(
      (
        total,
        filter
      ) => {

        if (
          filter.filterType ===
          "categorical"
        ) {

          return (
            total +
            filter.values.length
          );

        }

        return total;

      },
      0
    );

  /* ====================================================
     RENDER
  ==================================================== */

  return (

    <div
      style={{
        width: 360,
        minWidth: 360,
        background: "#0f172a",
        borderRight:
          "1px solid #334155",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >

      {/* HEADER */}

      <div
        onClick={() =>
          setExpanded(
            !expanded
          )
        }
        style={{
          padding: 20,
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          borderBottom:
            "1px solid #334155",
          cursor: "pointer",
        }}
      >

        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: 10,
          }}
        >

          <h3
            style={{
              margin: 0,
            }}
          >
            Set A
          </h3>

          {selectedFilterCount >
            0 && (

            <span
              style={{
                background:
                  "#2563eb",
                color:
                  "white",
                borderRadius:
                  20,
                padding:
                  "3px 8px",
                fontSize:
                  11,
              }}
            >
              {
                selectedFilterCount
              }
            </span>

          )}

        </div>

        <span>

          {expanded
            ? "▼"
            : "►"}

        </span>

      </div>

      {expanded && (

        <div

          onDragOver={
            handleDragOver
          }

          onDragLeave={
            handleDragLeave
          }

          onDrop={
            handleDrop
          }

          style={{

            padding: 16,

            minHeight: 120,

            background:
              isDragOver
                ? "#1e3a5f"
                : "#0f172a",

            borderBottom:
              isDragOver
                ? "2px solid #38bdf8"
                : "1px solid transparent",

            transition:
              "all .2s",

          }}

        >

          {filters.length ===
          0 ? (

            <div
              style={{
                color:
                  isDragOver
                    ? "#38bdf8"
                    : "#94a3b8",
                textAlign:
                  "center",
                padding:
                  "30px 10px",
                fontSize: 13,
                border:
                  "1px dashed #475569",
                borderRadius: 8,
              }}
            >

              {isDragOver

                ? "Drop field here to add to Set A"

                : "Drag fields here to add them to Set A"}

            </div>

          ) : (

            <div>

              {isDragOver && (

                <div
                  style={{
                    border:
                      "1px dashed #38bdf8",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 12,
                    textAlign:
                      "center",
                    color:
                      "#38bdf8",
                    fontSize: 12,
                  }}
                >

                  Drop field here to add to Set A

                </div>

              )}
              {filters.map((filter) => {

                const isOpen =
                  openField ===
                  filter.field;

                /*
                  Build this field's options from records that
                  satisfy every other active filter. This makes
                  filters cascading/dependent without changing
                  the actual filter state.
                */
                const availableRecords =
                  getRecordsForFilter(
                    filter.field
                  );

                return (

                  <div
                    key={filter.field}
                    style={{
                      background:
                        "#1e293b",
                      border:
                        "1px solid #334155",
                      borderRadius: 8,
                      marginBottom: 12,
                      overflow: "hidden",
                    }}
                  >

                    {/* =====================================
                        FIELD HEADER
                    ====================================== */}

                    <div
                      style={{
                        padding: 12,
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                      }}
                    >

                      <div
                        onClick={() => {

                          setOpenField(

                            isOpen
                              ? null
                              : filter.field

                          );

                          setValueSearch("");

                          setSelectedOnly(
                            false
                          );

                        }}
                        style={{
                          flex: 1,
                          cursor: "pointer",
                        }}
                      >

                        <div
                          style={{
                            fontWeight: 600,
                          }}
                        >
                          {filter.field}
                        </div>

                        <div
                          style={{
                            color:
                              "#94a3b8",
                            fontSize: 12,
                            marginTop: 4,
                          }}
                        >

                          {filter.filterType ===
                          "categorical"

                            ? `${filter.values.length} selected`

                            : filter.filterType ===
                              "numeric"

                            ? "Numeric Filter"

                            : "Date Filter"}

                        </div>

                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems:
                            "center",
                        }}
                      >

                        <span
                          onClick={() => {

                            setOpenField(

                              isOpen
                                ? null
                                : filter.field

                            );

                            setValueSearch("");

                            setSelectedOnly(
                              false
                            );

                          }}
                          style={{
                            cursor: "pointer",
                          }}
                        >

                          {isOpen
                            ? "▲"
                            : "▼"}

                        </span>

                        <button
                          onClick={() =>
                            removeField(
                              filter.field
                            )
                          }
                          style={{
                            border: "none",
                            background:
                              "transparent",
                            color:
                              "#f87171",
                            cursor:
                              "pointer",
                            fontSize: 18,
                          }}
                        >
                          ×
                        </button>

                      </div>

                    </div>

                    {/* =====================================
                        FILTER BODY
                    ====================================== */}

                    {isOpen && (

                      <div
                        style={{
                          padding: 12,
                          borderTop:
                            "1px solid #334155",
                        }}
                      >

                        {filter.filterType ===
                          "categorical" && (

                          <CategoricalFilter

                            records={availableRecords}

                            filter={filter}

                            valueSearch={
                              valueSearch
                            }

                            setValueSearch={
                              setValueSearch
                            }

                            selectedOnly={
                              selectedOnly
                            }

                            setSelectedOnly={
                              setSelectedOnly
                            }

                            sortMode={
                              sortMode
                            }

                            setSortMode={
                              setSortMode
                            }

                            updateFilter={
                              updateFilter
                            }

                          />

                        )}

                        {filter.filterType ===
                          "numeric" && (

                          <NumericFilter

                            records={availableRecords}

                            filter={filter}

                            updateFilter={
                              updateFilter
                            }

                          />

                        )}

                        {filter.filterType ===
                          "date" && (

                          <DateFilter

                            records={availableRecords}

                            filter={filter}

                            updateFilter={
                              updateFilter
                            }

                          />

                        )}

                      </div>

                    )}

                  </div>

                );

              })}
              {/* =====================================
                  CLEAR ALL FILTERS
              ====================================== */}

              <button
                onClick={clearAllFilters}
                style={{
                  width: "100%",
                  background: "#7f1d1d",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  padding: 10,
                  cursor: "pointer",
                  marginTop: 4,
                  fontWeight: 600,
                }}
              >
                Clear All Filters
              </button>

            </div>

          )}

        </div>

      )}

    </div>

  );

}
