import React, { useMemo } from "react";

import type {
  FieldFilter,
} from "./filterTypes";

import {
  searchInputStyle,
  toolbarStyle,
  selectStyle,
  smallButton,
  actionButton,
  valueContainerStyle,
  valueRowStyle,
} from "./styles";

interface Props {
  records: any[];

  filter: FieldFilter;

  valueSearch: string;

  setValueSearch: (
    value: string
  ) => void;

  selectedOnly: boolean;

  setSelectedOnly: (
    value: boolean
  ) => void;

  sortMode:
    | "count-desc"
    | "count-asc"
    | "alpha-asc"
    | "alpha-desc";

  setSortMode: (
    value:
      | "count-desc"
      | "count-asc"
      | "alpha-asc"
      | "alpha-desc"
  ) => void;

  updateFilter: (
    filter: FieldFilter
  ) => void;
}

/* =========================================================
   PARSE LIST VALUE
========================================================= */

function parseListValue(
  value: any
): string[] {

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
    Already a JavaScript array.

    Example:

    ["Weak Handle", "Handle Crack"]
  */

  if (
    Array.isArray(value)
  ) {
    return value
      .map((item) =>
        String(item).trim()
      )
      .filter(Boolean);
  }

  /*
    Non-string values are treated
    as a normal categorical value.
  */

  if (
    typeof value !== "string"
  ) {
    return [];
  }

  const trimmed =
    value.trim();

  if (!trimmed) {
    return [];
  }

  /*
    First try JSON.

    Example:

    ["Weak Handle","Handle Crack"]
  */

  try {

    const parsed =
      JSON.parse(trimmed);

    if (
      Array.isArray(parsed)
    ) {
      return parsed
        .map((item) =>
          String(item).trim()
        )
        .filter(Boolean);
    }

  } catch {
    /*
      Continue with fallback parsing.
    */
  }

  /*
    Handle Python-style / single-quote
    representations.

    Example:

    ['Weak Handle', 'Handle Crack']
  */

  if (
    trimmed.startsWith("[") &&
    trimmed.endsWith("]")
  ) {

    const withoutBrackets =
      trimmed.slice(
        1,
        -1
      );

    if (
      withoutBrackets.trim()
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
            .trim()
        )
        .filter(Boolean);

    }

    return [];
  }

  /*
    Fallback for comma-separated
    representations.

    Example:

    Weak Handle, Handle Crack
  */

  if (
    trimmed.includes(",")
  ) {

    return trimmed
      .split(",")
      .map((item) =>
        item
          .trim()
          .replace(
            /^["']|["']$/g,
            ""
          )
          .trim()
      )
      .filter(Boolean);

  }

  /*
    If it is not actually a list,
    return it as a single value.
  */

  return [trimmed];
}

/* =========================================================
   CHECK WHETHER FIELD CONTAINS LIST VALUES
========================================================= */

function isListField(
  records: any[],
  fieldName: string
): boolean {

  return records.some(
    (record) => {

      const value =
        record?.[fieldName];

      /*
        Actual array
      */

      if (
        Array.isArray(value)
      ) {
        return true;
      }

      /*
        JSON / Python-style list
        stored as a string
      */

      if (
        typeof value === "string"
      ) {

        const trimmed =
          value.trim();

        if (
          trimmed.startsWith("[") &&
          trimmed.endsWith("]")
        ) {
          return true;
        }

      }

      return false;
    }
  );
}

/* =========================================================
   BUILD VALUE COUNTS
========================================================= */

function buildValueCounts(
  records: any[],
  fieldName: string
): [string, number][] {

  const listField =
    isListField(
      records,
      fieldName
    );

  const counts =
    new Map<
      string,
      number
    >();

  /* =======================================================
     LIST FIELD
  ======================================================= */

  if (listField) {

    records.forEach(
      (record) => {

        const rawValue =
          record?.[fieldName];

        /*
          Parse the list.
        */

        const values =
          parseListValue(
            rawValue
          );

        /*
          Remove duplicates inside
          the same complaint.

          Example:

          Complaint 1:
          ["Weak Handle", "Weak Handle"]

          contributes:

          Weak Handle = 1

          NOT:

          Weak Handle = 2
        */

        const uniqueValues =
          Array.from(
            new Set(values)
          );

        /*
          Empty list
        */

        if (
          uniqueValues.length === 0
        ) {

          /*
            Only add Blank when the
            actual field is empty.
          */

          if (
            rawValue === undefined ||
            rawValue === null ||
            rawValue === ""
          ) {

            counts.set(
              "(Blank)",
              (
                counts.get(
                  "(Blank)"
                ) || 0
              ) + 1
            );

          }

          return;
        }

        /*
          Each unique list value
          represents one complaint.
        */

        uniqueValues.forEach(
          (value) => {

            counts.set(
              value,
              (
                counts.get(
                  value
                ) || 0
              ) + 1
            );

          }
        );

      }
    );

    return Array.from(
      counts.entries()
    );
  }

  /* =======================================================
     NORMAL CATEGORICAL FIELD
  ======================================================= */

  records.forEach(
    (record) => {

      let value =
        record?.[fieldName];

      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {

        value =
          "(Blank)";

      }

      const normalizedValue =
        String(value);

      counts.set(
        normalizedValue,
        (
          counts.get(
            normalizedValue
          ) || 0
        ) + 1
      );

    }
  );

  return Array.from(
    counts.entries()
  );
}

/* =========================================================
   SORT VALUES
========================================================= */

function sortValues(
  values: [string, number][],
  sortMode:
    | "count-desc"
    | "count-asc"
    | "alpha-asc"
    | "alpha-desc"
): [string, number][] {

  return [...values].sort(
    (
      [valueA, countA],
      [valueB, countB]
    ) => {

      switch (
        sortMode
      ) {

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
}

/* =========================================================
   COMPONENT
========================================================= */

export default function CategoricalFilter({

  records,

  filter,

  valueSearch,

  setValueSearch,

  selectedOnly,

  setSelectedOnly,

  sortMode,

  setSortMode,

  updateFilter,

}: Props) {

  /* =======================================================
     BUILD / SEARCH / SORT VALUES
  ======================================================= */

  const values =
    useMemo(() => {

      /*
        Build individual value counts.

        For list columns this produces:

        Weak Handle       13
        Lack of Power     12
        Excessive Weight  11

        instead of:

        ['Weak Handle', 'Handle Crack']  13
      */

      const valueCounts =
        buildValueCounts(
          records,
          filter.field
        );

      /*
        Search
      */

      const searchTerm =
        valueSearch
          .trim()
          .toLowerCase();

      let filteredValues =
        valueCounts;

      if (
        searchTerm
      ) {

        filteredValues =
          filteredValues.filter(
            ([value]) =>
              value
                .toLowerCase()
                .includes(
                  searchTerm
                )
          );

      }

      /*
        Selected only
      */

      if (
        selectedOnly
      ) {

        filteredValues =
          filteredValues.filter(
            ([value]) =>
              filter.values.includes(
                value
              )
          );

      }

      /*
        Sort
      */

      return sortValues(
        filteredValues,
        sortMode
      );

    }, [
      records,
      filter.field,
      filter.values,
      valueSearch,
      selectedOnly,
      sortMode,
    ]);

  /* =======================================================
     TOGGLE VALUE
  ======================================================= */

  const toggleValue = (
    value: string
  ) => {

    const selected =
      filter.values.includes(
        value
      );

    updateFilter({

      ...filter,

      values: selected

        ? filter.values.filter(
            (v) =>
              v !== value
          )

        : [
            ...filter.values,
            value,
          ],

    });

  };

  /* =======================================================
     SELECT VISIBLE
  ======================================================= */

  const selectVisible = () => {

    const merged =
      Array.from(

        new Set([

          ...filter.values,

          ...values.map(
            ([value]) =>
              value
          ),

        ])

      );

    updateFilter({

      ...filter,

      values: merged,

    });

  };

  /* =======================================================
     CLEAR VALUES
  ======================================================= */

  const clearValues = () => {

    updateFilter({

      ...filter,

      values: [],

    });

  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (

    <>

      {/* =================================================
          SEARCH
      ================================================= */}

      <input

        value={
          valueSearch
        }

        onChange={(e) =>
          setValueSearch(
            e.target.value
          )
        }

        placeholder="Search values..."

        style={{
          ...searchInputStyle,
          marginBottom: 10,
        }}

      />

      {/* =================================================
          TOOLBAR
      ================================================= */}

      <div
        style={
          toolbarStyle
        }
      >

        <select

          value={
            sortMode
          }

          onChange={(e) =>
            setSortMode(
              e.target.value as
                | "count-desc"
                | "count-asc"
                | "alpha-asc"
                | "alpha-desc"
            )
          }

          style={
            selectStyle
          }

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

          style={{

            ...smallButton,

            background:
              selectedOnly
                ? "#2563eb"
                : "#334155",

          }}

          onClick={() =>
            setSelectedOnly(
              !selectedOnly
            )
          }

        >

          ✓ Selected

        </button>

      </div>

      {/* =================================================
          ACTIONS
      ================================================= */}

      <div

        style={{

          display: "flex",

          justifyContent:
            "space-between",

          marginBottom: 10,

        }}

      >

        <span

          style={{

            color: "#94a3b8",

            fontSize: 12,

          }}

        >

          {values.length} values

        </span>

        <div

          style={{

            display: "flex",

            gap: 8,

          }}

        >

          <button

            style={
              actionButton
            }

            onClick={
              selectVisible
            }

          >

            Select visible

          </button>

          <button

            style={{
              ...actionButton,
              color: "#f87171",
            }}

            onClick={
              clearValues
            }

          >

            Clear all

          </button>

        </div>

      </div>

      {/* =================================================
          VALUES
      ================================================= */}

      <div
        style={
          valueContainerStyle
        }
      >

        {values.length === 0 ? (

          <div
            style={{
              padding: 15,
              textAlign:
                "center",
              color:
                "#94a3b8",
              fontSize: 13,
            }}
          >
            No matching values
          </div>

        ) : (

          values.map(
            (
              [value, count]
            ) => {

              const checked =
                filter.values.includes(
                  value
                );

              return (

                <label

                  key={value}

                  style={
                    valueRowStyle
                  }

                >

                  <div

                    style={{

                      display:
                        "flex",

                      alignItems:
                        "center",

                      gap: 8,

                      minWidth: 0,

                    }}

                  >

                    <input

                      type="checkbox"

                      checked={
                        checked
                      }

                      onChange={() =>
                        toggleValue(
                          value
                        )
                      }

                    />

                    <span

                      title={
                        value
                      }

                      style={{

                        overflow:
                          "hidden",

                        textOverflow:
                          "ellipsis",

                        whiteSpace:
                          "nowrap",

                      }}

                    >

                      {value}

                    </span>

                  </div>

                  <span

                    style={{

                      color:
                        "#94a3b8",

                      fontSize: 12,

                    }}

                  >

                    {count}

                  </span>

                </label>

              );

            }
          )

        )}

      </div>

    </>

  );

}