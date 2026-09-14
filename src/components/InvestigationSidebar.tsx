import React, { useMemo, useState } from "react";

/* =========================================================
   TYPES
========================================================= */

interface Column {
  name: string;
  type: string;
  ontologyMapping: string;
}

interface SchemaResponse {
  datasetName: string;
  columns: Column[];
  timestampColumn: string;
  primaryKey: string;
}

export interface FieldFilter {
  field: string;
  values: string[];
}

interface InvestigationSidebarProps {
  schema: SchemaResponse | null;

  loadingSchema: boolean;

  search: string;

  setSearch: (value: string) => void;

  eventCount: number;

  records: any[];

  filters: FieldFilter[];

  onFilterChange: (filters: FieldFilter[]) => void;
}

/* =========================================================
   SORT TYPES
========================================================= */

type SortMode =
  | "count-desc"
  | "count-asc"
  | "alpha-asc"
  | "alpha-desc";

/* =========================================================
   COMPONENT
========================================================= */

export default function InvestigationSidebar({
  schema,
  loadingSchema,
  search,
  setSearch,
  eventCount,
  records,
  filters,
  onFilterChange,
}: InvestigationSidebarProps) {
  /* =======================================================
      EXPAND / COLLAPSE STATE
  ======================================================= */

  const [datasetExpanded, setDatasetExpanded] =
    useState(true);

  const [filtersExpanded, setFiltersExpanded] =
    useState(true);

  const [fieldsExpanded, setFieldsExpanded] =
    useState(true);

  /* =======================================================
      VALUE DROPDOWN STATE
  ======================================================= */

  const [openField, setOpenField] =
    useState<string | null>(null);

  const [valueSearch, setValueSearch] =
    useState("");

  const [sortMode, setSortMode] =
    useState<SortMode>("count-desc");

  const [selectedOnly, setSelectedOnly] =
    useState(false);

  /* =======================================================
      CATEGORICAL COLUMNS
  ======================================================= */

  const categoricalColumns = useMemo(() => {
    if (!schema) {
      return [];
    }

    return schema.columns.filter((column) => {
      /*
        Exclude timestamp column
      */

      if (
        column.name ===
        schema.timestampColumn
      ) {
        return false;
      }

      /*
        Exclude timestamp ontology
      */

      if (
        column.ontologyMapping ===
        "opentimestamp"
      ) {
        return false;
      }

      /*
        Exclude numeric columns
      */

      const type =
        String(column.type || "")
          .toLowerCase();

      if (
        type.includes("number") ||
        type.includes("integer") ||
        type.includes("float") ||
        type.includes("double") ||
        type.includes("decimal") ||
        type.includes("numeric")
      ) {
        return false;
      }

      /*
        Include both normal categorical
        columns and list columns.
      */

      return true;
    });
  }, [schema]);

  /* =======================================================
      CHECK LIST COLUMN
  ======================================================= */

  const isListColumn = (
    fieldName: string
  ): boolean => {
    const column =
      schema?.columns.find(
        (item) =>
          item.name === fieldName
      );

    return (
      String(column?.type || "")
        .trim()
        .toLowerCase() ===
      "list"
    );
  };

  /* =======================================================
      PARSE LIST VALUE
  ======================================================= */

  const parseListValue = (
    value: any
  ): string[] => {
    /*
      Empty value
    */

    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return [];
    }

    /*
      Already a real JavaScript array.
    */

    if (
      Array.isArray(value)
    ) {
      return value
        .map((item) =>
          String(item)
            .trim()
        )
        .filter(Boolean);
    }

    /*
      Backend may return JSON string:

        ["Battery","Charging"]

    */

    if (
      typeof value ===
      "string"
    ) {
      const trimmed =
        value.trim();

      if (!trimmed) {
        return [];
      }

      /*
        Try JSON first.
      */

      try {
        const parsed =
          JSON.parse(trimmed);

        if (
          Array.isArray(parsed)
        ) {
          return parsed
            .map((item) =>
              String(item)
                .trim()
            )
            .filter(Boolean);
        }
      } catch {
        /*
          Not valid JSON.
          Continue with fallback parsing.
        */
      }

      /*
        Defensive fallback for values such as:

          [Battery, Charging]

        or:

          Battery, Charging
      */

      const withoutBrackets =
        trimmed
          .replace(
            /^\[/,
            ""
          )
          .replace(
            /\]$/,
            ""
          );

      if (
        withoutBrackets
      ) {
        return withoutBrackets
          .split(",")
          .map((item) =>
            item
              .trim()
              .replace(
                /^["']|["']$/g,
                ""
              )
          )
          .filter(Boolean);
      }
    }

    /*
      If it cannot be interpreted
      as a list, return empty.
    */

    return [];
  };

  /* =======================================================
      SEARCH CATEGORICAL FIELDS
  ======================================================= */

  const filteredColumns = useMemo(() => {
    const searchTerm =
      search.trim().toLowerCase();

    if (!searchTerm) {
      return categoricalColumns;
    }

    return categoricalColumns.filter(
      (column) =>
        column.name
          .toLowerCase()
          .includes(searchTerm)
    );
  }, [
    categoricalColumns,
    search,
  ]);

  /* =======================================================
      FIND FILTER FOR FIELD
  ======================================================= */

  const getFieldFilter = (
    fieldName: string
  ) => {
    return filters.find(
      (filter) =>
        filter.field ===
        fieldName
    );
  };

  /* =======================================================
      GET VALUE COUNTS
  ======================================================= */

  const getValueCounts = (
    fieldName: string
  ) => {
    /*
      For normal categorical columns:

        value -> number of records

      For list columns:

        individual list value
          ->
        Set of complaint IDs

      The Set prevents the same complaint
      from being counted twice for the
      same list value.
    */

    if (
      isListColumn(fieldName)
    ) {
      const valueComplaints =
        new Map<
          string,
          Set<string>
        >();

      records.forEach(
        (
          record,
          recordIndex
        ) => {
          const values =
            parseListValue(
              record[
                fieldName
              ]
            );

          /*
            Prevent duplicate values
            inside the same complaint.

            Example:

              ["Battery", "Battery"]

            counts as:

              Battery = 1
          */

          const uniqueValues =
            new Set(values);

          /*
            Use primary key when
            available.

            Fall back to id,
            then record index.
          */

          const complaintId =
            String(
              record?._id ??
              record?.id ??
              record?.eventId ??
              recordIndex
            );

          uniqueValues.forEach(
            (value) => {
              if (
                !valueComplaints.has(
                  value
                )
              ) {
                valueComplaints.set(
                  value,
                  new Set<string>()
                );
              }

              valueComplaints
                .get(value)!
                .add(
                  complaintId
                );
            }
          );
        }
      );

      const counts: Record<
        string,
        number
      > = {};

      valueComplaints.forEach(
        (
          complaintIds,
          value
        ) => {
          counts[value] =
            complaintIds.size;
        }
      );

      return counts;
    }

    /*
      -------------------------------------
      NORMAL CATEGORICAL COLUMN
      -------------------------------------
    */

    const counts: Record<
      string,
      number
    > = {};

    records.forEach(
      (record) => {
        let value =
          record[fieldName];

        if (
          value === undefined ||
          value === null ||
          value === ""
        ) {
          value = "(Blank)";
        }

        const normalizedValue =
          String(value);

        counts[
          normalizedValue
        ] =
          (
            counts[
              normalizedValue
            ] || 0
          ) + 1;
      }
    );

    return counts;
  };

  /* =======================================================
      GET SORTED / SEARCHED VALUES
  ======================================================= */

  const getSortedValues = (
    fieldName: string
  ) => {
    const counts =
      getValueCounts(
        fieldName
      );

    const selectedValues =
      getFieldFilter(
        fieldName
      )?.values || [];

    let values =
      Object.entries(counts);

    /*
      Search values
    */

    const searchTerm =
      valueSearch
        .trim()
        .toLowerCase();

    if (searchTerm) {
      values =
        values.filter(
          ([value]) =>
            value
              .toLowerCase()
              .includes(
                searchTerm
              )
        );
    }

    /*
      Show selected only
    */

    if (selectedOnly) {
      values =
        values.filter(
          ([value]) =>
            selectedValues.includes(
              value
            )
        );
    }

    /*
      Sort values
    */

    values.sort(
      (
        [valueA, countA],
        [valueB, countB]
      ) => {
        switch (sortMode) {
          case "count-desc":
            return (
              countB -
              countA
            );

          case "count-asc":
            return (
              countA -
              countB
            );

          case "alpha-asc":
            return valueA.localeCompare(
              valueB
            );

          case "alpha-desc":
            return valueB.localeCompare(
              valueA
            );

          default:
            return 0;
        }
      }
    );

    return values;
  };

  /* =======================================================
      ADD FIELD TO FILTER SET
  ======================================================= */

  const addFieldFilter = (
    fieldName: string
  ) => {
    const alreadySelected =
      filters.some(
        (filter) =>
          filter.field ===
          fieldName
      );

    if (alreadySelected) {
      return;
    }

    onFilterChange([
      ...filters,
      {
        field: fieldName,
        values: [],
      },
    ]);

    setOpenField(
      fieldName
    );

    setValueSearch("");

    setSelectedOnly(false);
  };

  /* =======================================================
      TOGGLE VALUE
  ======================================================= */

  const toggleValue = (
    fieldName: string,
    value: string
  ) => {
    const existingFilter =
      getFieldFilter(
        fieldName
      );

    const currentValues =
      existingFilter?.values ||
      [];

    const valueExists =
      currentValues.includes(
        value
      );

    const updatedValues =
      valueExists
        ? currentValues.filter(
            (item) =>
              item !== value
          )
        : [
            ...currentValues,
            value,
          ];

    /*
      Keep the field in the
      filter set even when no
      values are selected.
    */

    const fieldExists =
      filters.some(
        (filter) =>
          filter.field ===
          fieldName
      );

    if (fieldExists) {
      onFilterChange(
        filters.map(
          (filter) =>
            filter.field ===
            fieldName
              ? {
                  ...filter,
                  values:
                    updatedValues,
                }
              : filter
        )
      );
    } else {
      onFilterChange([
        ...filters,
        {
          field: fieldName,
          values:
            updatedValues,
        },
      ]);
    }
  };

  /* =======================================================
      SELECT ALL VISIBLE VALUES
  ======================================================= */

  const selectAllVisible = (
    fieldName: string
  ) => {
    const visibleValues =
      getSortedValues(
        fieldName
      ).map(
        ([value]) =>
          value
      );

    const existingFilter =
      getFieldFilter(
        fieldName
      );

    const existingValues =
      existingFilter?.values ||
      [];

    const mergedValues =
      Array.from(
        new Set([
          ...existingValues,
          ...visibleValues,
        ])
      );

    /*
      Make sure the field exists
      before updating it.
    */

    const fieldExists =
      filters.some(
        (filter) =>
          filter.field ===
          fieldName
      );

    if (fieldExists) {
      onFilterChange(
        filters.map(
          (filter) =>
            filter.field ===
            fieldName
              ? {
                  ...filter,
                  values:
                    mergedValues,
                }
              : filter
        )
      );
    } else {
      onFilterChange([
        ...filters,
        {
          field: fieldName,
          values:
            mergedValues,
        },
      ]);
    }
  };

  /* =======================================================
      CLEAR VALUES FOR ONE FIELD
  ======================================================= */

  const clearFieldValues = (
    fieldName: string
  ) => {
    onFilterChange(
      filters.map(
        (filter) =>
          filter.field ===
          fieldName
            ? {
                ...filter,
                values: [],
              }
            : filter
      )
    );
  };

  /* =======================================================
      REMOVE FIELD FROM SET
  ======================================================= */

  const removeField = (
    fieldName: string
  ) => {
    onFilterChange(
      filters.filter(
        (filter) =>
          filter.field !==
          fieldName
      )
    );

    if (
      openField ===
      fieldName
    ) {
      setOpenField(null);
    }
  };

  /* =======================================================
      CLEAR ALL FILTERS
  ======================================================= */

  const clearAllFilters = () => {
    onFilterChange([]);

    setOpenField(null);

    setValueSearch("");

    setSelectedOnly(false);
  };

  /* =======================================================
      SELECTED FILTER COUNT
  ======================================================= */

  const selectedFilterCount =
    filters.reduce(
      (
        total,
        filter
      ) =>
        total +
        filter.values.length,
      0
    );

  /* =======================================================
      RENDER
  ======================================================= */

  return (
    <div
      style={{
        width: 360,
        minWidth: 360,
        background: "#111827",
        borderRight:
          "1px solid #334155",
        display: "flex",
        flexDirection:
          "column",
        overflowY: "auto",
      }}
    >
      {/* =================================================
          DATASET
      ================================================= */}

      <div
        style={{
          padding: 20,
          borderBottom:
            "1px solid #334155",
        }}
      >
        <div
          onClick={() =>
            setDatasetExpanded(
              !datasetExpanded
            )
          }
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            cursor:
              "pointer",
            marginBottom:
              datasetExpanded
                ? 15
                : 0,
          }}
        >
          <h3
            style={{
              margin: 0,
            }}
          >
            Dataset
          </h3>

          <span>
            {datasetExpanded
              ? "▼"
              : "►"}
          </span>
        </div>

        {datasetExpanded &&
          (loadingSchema ? (
            <div
              style={{
                color:
                  "#94a3b8",
              }}
            >
              Loading dataset...
            </div>
          ) : (
            <div
              style={{
                background:
                  "#1e293b",
                border:
                  "1px solid #334155",
                borderRadius: 8,
                padding: 15,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  marginBottom: 15,
                }}
              >
                {
                  schema?.datasetName
                }
              </div>

              <div
                style={{
                  color:
                    "#94a3b8",
                  fontSize: 13,
                }}
              >
                Events
              </div>

              <div
                style={{
                  fontSize: 34,
                  color:
                    "#38bdf8",
                  fontWeight:
                    "bold",
                }}
              >
                {eventCount.toLocaleString()}
              </div>
            </div>
          ))}
      </div>

      {/* =================================================
          SET A / FILTERS
      ================================================= */}

      <div
        style={{
          borderBottom:
            "1px solid #334155",
        }}
      >
        <div
          onClick={() =>
            setFiltersExpanded(
              !filtersExpanded
            )
          }
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            padding: 20,
            cursor:
              "pointer",
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
                  fontSize: 11,
                }}
              >
                {
                  selectedFilterCount
                }
              </span>
            )}
          </div>

          <span>
            {filtersExpanded
              ? "▼"
              : "►"}
          </span>
        </div>

        {filtersExpanded && (
          <div
            style={{
              padding:
                "0 20px 20px",
            }}
          >
            {filters.length ===
            0 ? (
              <div
                style={{
                  padding:
                    "20px 10px",
                  textAlign:
                    "center",
                  color:
                    "#94a3b8",
                  fontSize: 13,
                }}
              >
                Select a categorical
                field below to add
                it to Set A.
              </div>
            ) : (
              filters.map(
                (filter) => {
                  const isOpen =
                    openField ===
                    filter.field;

                  const values =
                    getSortedValues(
                      filter.field
                    );

                  const listField =
                    isListColumn(
                      filter.field
                    );

                  return (
                    <div
                      key={
                        filter.field
                      }
                      style={{
                        background:
                          "#1e293b",
                        border:
                          "1px solid #334155",
                        borderRadius:
                          8,
                        marginBottom:
                          12,
                        overflow:
                          "hidden",
                      }}
                    >
                      {/* FIELD HEADER */}

                      <div
                        style={{
                          padding: 12,
                          display:
                            "flex",
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

                            setValueSearch(
                              ""
                            );

                            setSelectedOnly(
                              false
                            );
                          }}
                          style={{
                            cursor:
                              "pointer",
                            flex: 1,
                          }}
                        >
                          <div
                            style={{
                              fontWeight:
                                600,
                            }}
                          >
                            {
                              filter.field
                            }
                          </div>

                          <div
                            style={{
                              color:
                                "#94a3b8",
                              fontSize:
                                12,
                              marginTop:
                                4,
                            }}
                          >
                            {
                              filter.values
                                .length
                            }{" "}
                            selected
                          </div>
                        </div>

                        <div
                          style={{
                            display:
                              "flex",
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

                              setValueSearch(
                                ""
                              );

                              setSelectedOnly(
                                false
                              );
                            }}
                            style={{
                              cursor:
                                "pointer",
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
                              border:
                                "none",
                              background:
                                "transparent",
                              color:
                                "#f87171",
                              cursor:
                                "pointer",
                              fontSize:
                                16,
                            }}
                            title="Remove field"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {/* VALUE SELECTOR */}

                      {isOpen && (
                        <div
                          style={{
                            padding: 12,
                            borderTop:
                              "1px solid #334155",
                          }}
                        >
                          {/* LIST FIELD INDICATOR */}

                          {listField && (
                            <div
                              style={{
                                color:
                                  "#38bdf8",
                                fontSize:
                                  12,
                                marginBottom:
                                  8,
                              }}
                            >
                              Showing unique
                              values from
                              list column
                            </div>
                          )}

                          {/* SEARCH */}

                          <input
                            value={
                              valueSearch
                            }
                            onChange={(e) =>
                              setValueSearch(
                                e.target
                                  .value
                              )
                            }
                            placeholder="Search values..."
                            style={{
                              width:
                                "100%",
                              padding:
                                "8px 10px",
                              background:
                                "#0f172a",
                              color:
                                "white",
                              border:
                                "1px solid #475569",
                              borderRadius:
                                6,
                              boxSizing:
                                "border-box",
                              marginBottom:
                                10,
                            }}
                          />

                          {/* CONTROLS */}

                          <div
                            style={{
                              display:
                                "flex",
                              gap: 6,
                              marginBottom:
                                10,
                            }}
                          >
                            <select
                              value={
                                sortMode
                              }
                              onChange={(e) =>
                                setSortMode(
                                  e.target
                                    .value as SortMode
                                )
                              }
                              style={{
                                flex: 1,
                                padding:
                                  7,
                                background:
                                  "#0f172a",
                                color:
                                  "white",
                                border:
                                  "1px solid #475569",
                                borderRadius:
                                  6,
                              }}
                            >
                              <option value="count-desc">
                                Count ↓
                              </option>

                              <option value="count-asc">
                                Count ↑
                              </option>

                              <option value="alpha-asc">
                                A → Z
                              </option>

                              <option value="alpha-desc">
                                Z → A
                              </option>
                            </select>

                            <button
                              onClick={() =>
                                setSelectedOnly(
                                  !selectedOnly
                                )
                              }
                              style={{
                                padding:
                                  "7px 9px",
                                background:
                                  selectedOnly
                                    ? "#2563eb"
                                    : "#334155",
                                color:
                                  "white",
                                border:
                                  "none",
                                borderRadius:
                                  6,
                                cursor:
                                  "pointer",
                              }}
                            >
                              ✓ Selected
                            </button>
                          </div>

                          {/* ACTIONS */}

                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              alignItems:
                                "center",
                              marginBottom:
                                8,
                            }}
                          >
                            <span
                              style={{
                                color:
                                  "#94a3b8",
                                fontSize:
                                  12,
                              }}
                            >
                              {
                                values.length
                              }{" "}
                              values
                            </span>

                            <div
                              style={{
                                display:
                                  "flex",
                                gap: 8,
                              }}
                            >
                              <button
                                onClick={() =>
                                  selectAllVisible(
                                    filter.field
                                  )
                                }
                                style={{
                                  background:
                                    "transparent",
                                  border:
                                    "none",
                                  color:
                                    "#38bdf8",
                                  cursor:
                                    "pointer",
                                  fontSize:
                                    12,
                                }}
                              >
                                Select visible
                              </button>

                              <button
                                onClick={() =>
                                  clearFieldValues(
                                    filter.field
                                  )
                                }
                                style={{
                                  background:
                                    "transparent",
                                  border:
                                    "none",
                                  color:
                                    "#f87171",
                                  cursor:
                                    "pointer",
                                  fontSize:
                                    12,
                                }}
                              >
                                Clear all
                              </button>
                            </div>
                          </div>

                          {/* VALUES */}

                          <div
                            style={{
                              maxHeight:
                                260,
                              overflowY:
                                "auto",
                              border:
                                "1px solid #334155",
                              borderRadius:
                                6,
                            }}
                          >
                            {values.length ===
                            0 ? (
                              <div
                                style={{
                                  padding:
                                    15,
                                  textAlign:
                                    "center",
                                  color:
                                    "#94a3b8",
                                  fontSize:
                                    13,
                                }}
                              >
                                No matching
                                values
                              </div>
                            ) : (
                              values.map(
                                ([
                                  value,
                                  count,
                                ]) => {
                                  const isSelected =
                                    filter.values.includes(
                                      value
                                    );

                                  return (
                                    <label
                                      key={
                                        value
                                      }
                                      style={{
                                        display:
                                          "flex",
                                        alignItems:
                                          "center",
                                        justifyContent:
                                          "space-between",
                                        padding:
                                          "8px 10px",
                                        borderBottom:
                                          "1px solid #334155",
                                        cursor:
                                          "pointer",
                                      }}
                                    >
                                      <div
                                        style={{
                                          display:
                                            "flex",
                                          alignItems:
                                            "center",
                                          gap: 8,
                                          minWidth:
                                            0,
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={
                                            isSelected
                                          }
                                          onChange={() =>
                                            toggleValue(
                                              filter.field,
                                              value
                                            )
                                          }
                                        />

                                        <span
                                          style={{
                                            overflow:
                                              "hidden",
                                            textOverflow:
                                              "ellipsis",
                                            whiteSpace:
                                              "nowrap",
                                          }}
                                          title={
                                            value
                                          }
                                        >
                                          {
                                            value
                                          }
                                        </span>
                                      </div>

                                      <span
                                        style={{
                                          color:
                                            "#94a3b8",
                                          fontSize:
                                            12,
                                          marginLeft:
                                            8,
                                        }}
                                      >
                                        {
                                          count
                                        }
                                      </span>
                                    </label>
                                  );
                                }
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
              )
            )}

            {filters.length >
              0 && (
              <button
                onClick={
                  clearAllFilters
                }
                style={{
                  width:
                    "100%",
                  background:
                    "#7f1d1d",
                  color:
                    "white",
                  border:
                    "none",
                  borderRadius:
                    6,
                  padding: 9,
                  cursor:
                    "pointer",
                  marginTop: 5,
                }}
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* =================================================
          CATEGORICAL FIELDS
      ================================================= */}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection:
            "column",
        }}
      >
        <div
          onClick={() =>
            setFieldsExpanded(
              !fieldsExpanded
            )
          }
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            padding: 20,
            cursor:
              "pointer",
            borderBottom:
              fieldsExpanded
                ? "1px solid #334155"
                : "none",
          }}
        >
          <h3
            style={{
              margin: 0,
            }}
          >
            Categorical Fields
          </h3>

          <span>
            {fieldsExpanded
              ? "▼"
              : "►"}
          </span>
        </div>

        {fieldsExpanded && (
          <div
            style={{
              padding: 20,
            }}
          >
            {/* SEARCH FIELDS */}

            <input
              placeholder="Search fields..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              style={{
                width:
                  "100%",
                padding: 10,
                background:
                  "#0f172a",
                color:
                  "white",
                border:
                  "1px solid #334155",
                borderRadius:
                  6,
                marginBottom:
                  20,
                outline:
                  "none",
                boxSizing:
                  "border-box",
              }}
            />

            {filteredColumns.length ===
            0 ? (
              <div
                style={{
                  color:
                    "#94a3b8",
                  textAlign:
                    "center",
                  padding:
                    "30px 0",
                }}
              >
                No matching
                categorical fields
              </div>
            ) : (
              filteredColumns.map(
                (column) => {
                  const isTimestamp =
                    column.name ===
                    schema?.timestampColumn;

                  const isPrimary =
                    column.name ===
                    schema?.primaryKey;

                  const isSelected =
                    filters.some(
                      (filter) =>
                        filter.field ===
                        column.name
                    );

                  return (
                    <div
                      key={
                        column.name
                      }
                      onClick={() =>
                        addFieldFilter(
                          column.name
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
                        padding: 12,
                        marginBottom:
                          12,
                        cursor:
                          isSelected
                            ? "default"
                            : "pointer",
                      }}
                    >
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
                        <div>
                          <div
                            style={{
                              fontWeight:
                                600,
                            }}
                          >
                            {
                              column.name
                            }
                          </div>

                          <div
                            style={{
                              color:
                                "#94a3b8",
                              fontSize:
                                12,
                              marginTop:
                                3,
                            }}
                          >
                            {
                              column.type
                            }
                          </div>
                        </div>

                        <div
                          style={{
                            display:
                              "flex",
                            gap: 8,
                          }}
                        >
                          {isTimestamp && (
                            <span
                              title="Timestamp"
                            >
                              📅
                            </span>
                          )}

                          {isPrimary && (
                            <span
                              title="Primary Key"
                            >
                              🔑
                            </span>
                          )}

                          {isSelected && (
                            <span
                              style={{
                                color:
                                  "#38bdf8",
                                fontSize:
                                  12,
                              }}
                            >
                              Selected
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display:
                            "flex",
                          gap: 6,
                          flexWrap:
                            "wrap",
                          marginTop:
                            10,
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
                    </div>
                  );
                }
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
