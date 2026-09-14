import type { FieldFilter } from "./filterTypes";

/* ======================================================
   TYPES
====================================================== */

type SortMode =
  | "count-desc"
  | "count-asc"
  | "alpha-asc"
  | "alpha-desc";

/* ======================================================
   DETECT LIST VALUE
====================================================== */

function parseListValue(
  value: any
): string[] {

  /* -----------------------------------------------
     Empty value
  ----------------------------------------------- */

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return [];
  }

  /* -----------------------------------------------
     Already an actual array
  ----------------------------------------------- */

  if (Array.isArray(value)) {

    return value
      .map((item) =>
        String(item).trim()
      )
      .filter(Boolean);

  }

  /* -----------------------------------------------
     JSON string

     Example:

     '["Weak Handle","Handle Crack"]'
  ----------------------------------------------- */

  if (
    typeof value === "string"
  ) {

    const trimmed =
      value.trim();

    if (!trimmed) {
      return [];
    }

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
        Not valid JSON.

        Continue with defensive
        parsing below.
      */
    }

    /* ---------------------------------------------
       Defensive fallback

       Examples:

       [Weak Handle, Handle Crack]

       Weak Handle, Handle Crack
    --------------------------------------------- */

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

  return [];

}

/* ======================================================
   DETECT WHETHER VALUE IS A LIST
====================================================== */

function looksLikeList(
  value: any
): boolean {

  if (
    Array.isArray(value)
  ) {
    return true;
  }

  if (
    typeof value !== "string"
  ) {
    return false;
  }

  const trimmed =
    value.trim();

  /*
    JSON-style list
  */

  if (
    trimmed.startsWith("[") &&
    trimmed.endsWith("]")
  ) {
    return true;
  }

  return false;

}

/* ======================================================
   NORMALIZE VALUE

   Converts a record field into individual
   filterable values.

   Scalar:

     "North"

   becomes:

     ["North"]

   List:

     ["Weak Handle", "Handle Crack"]

   becomes:

     ["Weak Handle", "Handle Crack"]
====================================================== */

export function normalizeFilterValues(
  value: any
): string[] {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {

    return ["(Blank)"];

  }

  if (
    looksLikeList(value)
  ) {

    const values =
      parseListValue(value);

    /*
      Empty list should behave
      like a blank value.
    */

    if (
      values.length === 0
    ) {

      return ["(Blank)"];

    }

    /*
      Remove duplicate values
      inside the same record.

      Example:

      ["Battery", "Battery"]

      becomes:

      ["Battery"]
    */

    return Array.from(
      new Set(values)
    );

  }

  return [
    String(value)
  ];

}

/* ======================================================
   VALUE COUNTS

   IMPORTANT:

   For normal categorical columns:

     Record 1 -> North
     Record 2 -> North
     Record 3 -> South

   gives:

     North = 2
     South = 1


   For list columns:

     Record 1 -> ["Battery", "Charging"]
     Record 2 -> ["Battery"]

   gives:

     Battery = 2
     Charging = 1

   A list item is counted once per record,
   not once per occurrence inside the list.
====================================================== */

export function getValueCounts(
  records: any[],
  fieldName: string
): Record<string, number> {

  const counts: Record<
    string,
    number
  > = {};

  records.forEach((record) => {

    const values =
      normalizeFilterValues(
        record[fieldName]
      );

    /*
      Ensure that a value appears
      only once per record.

      This is important for:

      ["Battery", "Battery"]

      which should count as:

      Battery = 1

      rather than:

      Battery = 2
    */

    const uniqueValues =
      new Set(values);

    uniqueValues.forEach(
      (value) => {

        counts[value] =
          (
            counts[value] ||
            0
          ) + 1;

      }
    );

  });

  return counts;

}

/* ======================================================
   SORT VALUES
====================================================== */

export function getSortedValues(

  records: any[],

  fieldName: string,

  filter: FieldFilter,

  search: string,

  selectedOnly: boolean,

  sortMode: SortMode

): [string, number][] {

  const counts =
    getValueCounts(
      records,
      fieldName
    );

  let values =
    Object.entries(
      counts
    );

  /* -----------------------------------------------
     SEARCH VALUES
  ----------------------------------------------- */

  const term =
    search
      .trim()
      .toLowerCase();

  if (term) {

    values =
      values.filter(
        ([value]) =>
          value
            .toLowerCase()
            .includes(term)
      );

  }

  /* -----------------------------------------------
     SHOW SELECTED ONLY
  ----------------------------------------------- */

  if (
    selectedOnly
  ) {

    values =
      values.filter(
        ([value]) =>
          filter.values.includes(
            value
          )
      );

  }

  /* -----------------------------------------------
     SORT
  ----------------------------------------------- */

  values.sort(
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

  return values;

}

/* ======================================================
   CHECK WHETHER A RECORD MATCHES A FILTER

   This is the important part for the Time tab.

   Normal field:

     record:
       Region = "North"

     filter:
       ["North"]

     => true


   List field:

     record:
       Failure Condition =
         ["Weak Handle", "Handle Crack"]

     filter:
       ["Weak Handle"]

     => true


   If filter is:

     ["Excessive Weight"]

     => false
====================================================== */

export function recordMatchesFilter(
  record: any,
  filter: FieldFilter
): boolean {

  /*
    If the field has no selected
    values, do not restrict the field.

    This preserves the behavior where
    a field can be added to Set A before
    any values are selected.
  */

  if (
    !filter.values ||
    filter.values.length === 0
  ) {

    return true;

  }

  const recordValues =
    normalizeFilterValues(
      record[
        filter.field
      ]
    );

  /*
    Check whether ANY value in the
    record matches ANY selected
    filter value.

    Example:

    recordValues:
      ["Weak Handle", "Handle Crack"]

    selected:
      ["Weak Handle", "Excessive Weight"]

    Result:
      true
  */

  return recordValues.some(
    (recordValue) =>
      filter.values.includes(
        recordValue
      )
  );

}

/* ======================================================
   APPLY ALL FILTERS

   This helper can be used by the parent
   InvestigationWorkspace component.

   Multiple fields are treated as AND.

   Example:

     Failure Condition
       = Weak Handle

     AND

     Region
       = North

   Only records satisfying BOTH filters
   remain.
====================================================== */

export function applyFilters(
  records: any[],
  filters: FieldFilter[]
): any[] {

  /*
    No filters means return all records.
  */

  if (
    filters.length === 0
  ) {

    return records;

  }

  return records.filter(
    (record) => {

      /*
        Every field filter must
        match the record.
      */

      return filters.every(
        (filter) =>
          recordMatchesFilter(
            record,
            filter
          )
      );

    }
  );

}

/* ======================================================
   NUMERIC RANGE
====================================================== */

export function getNumericRange(

  records: any[],

  field: string

) {

  const values =
    records
      .map((record) =>
        Number(
          record[field]
        )
      )
      .filter(
        (value) =>
          !Number.isNaN(
            value
          )
      );

  if (
    values.length === 0
  ) {

    return {

      min: 0,

      max: 0,

    };

  }

  return {

    min: Math.min(
      ...values
    ),

    max: Math.max(
      ...values
    ),

  };

}

/* ======================================================
   DATE RANGE
====================================================== */

export function getDateRange(

  records: any[],

  field: string

) {

  const dates =
    records
      .map(
        (record) =>
          new Date(
            record[field]
          )
      )
      .filter(
        (date) =>
          !isNaN(
            date.getTime()
          )
      );

  if (
    dates.length === 0
  ) {

    const today =
      new Date();

    return {

      min: today,

      max: today,

    };

  }

  dates.sort(

    (a, b) =>
      a.getTime() -
      b.getTime()

  );

  return {

    min: dates[0],

    max:
      dates[
        dates.length - 1
      ],

  };

}

/* ======================================================
   DATE HELPERS
====================================================== */

export function formatDate(
  date: Date
) {

  return date
    .toISOString()
    .split("T")[0];

}

export function today() {

  return formatDate(
    new Date()
  );

}

export function yesterday() {

  const date =
    new Date();

  date.setDate(
    date.getDate() - 1
  );

  return formatDate(
    date
  );

}

export function lastNDays(
  days: number
) {

  const date =
    new Date();

  date.setDate(
    date.getDate() - days
  );

  return formatDate(
    date
  );

}

export function startOfThisMonth() {

  const today =
    new Date();

  return formatDate(

    new Date(

      today.getFullYear(),

      today.getMonth(),

      1

    )

  );

}

export function startOfThisYear() {

  const today =
    new Date();

  return formatDate(

    new Date(

      today.getFullYear(),

      0,

      1

    )

  );

}