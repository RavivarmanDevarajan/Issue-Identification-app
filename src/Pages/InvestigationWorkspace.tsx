import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import InvestigationToolbar from "../components/InvestigationToolbar";
import InvestigationFieldsSidebar from "../components/InvestigationFieldsSidebar";
import InvestigationSetSidebar from "../components/InvestigationSetSidebar";
import InvestigationTabs from "../components/InvestigationTabs";
import TimelineChart from "../components/TimelineChart";
import RecordsTable from "../components/RecordsTable";
import DistributionCharts from "../components/DistributionCharts";
import SaveAsgModal from "../components/SaveAsgModal";

import type {
  FieldFilter,
  SchemaResponse,
} from "../components/filterTypes";

/* ======================================================
   TYPES
====================================================== */

interface TimelinePoint {
  month: string;
  count: number;
  category?: string;
}

interface DatasetMeta {
  id: number;
  dataset_name: string;
  file_name: string;
  uploaded_at: string;
  status: string;

  data_type?: string;
  dataType?: string;

  ingestion_type?: string;
  ingestionType?: string;

  parent_dataset_id?: number | null;
  parentDatasetId?: number | null;
}

interface DatasetBundle {
  raw: DatasetMeta;
  tagged: DatasetMeta[];
}

interface DatasetPayload {
  schema: SchemaResponse;
  records: any[];
  dataset: DatasetMeta;
}

interface Props {
  datasetId: number;
  navigate: any;
}

/* ======================================================
   HELPERS
====================================================== */

/*
  Normalize IDs so that:

    123
    "123"
    " 123 "

  are treated as the same identifier.
*/
function normalizeId(
  value: any
): string {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value).trim();
}

/* ======================================================
   LIST VALUE HELPERS
====================================================== */

/*
  Parse a categorical field that may contain:

    Actual JS array:
      ["Bat", "Handle"]

    JSON string:
      '["Bat", "Handle"]'

    Python-style string:
      "['Bat', 'Handle']"

    Comma-separated string:
      "Bat, Handle"

    Normal scalar:
      "Bat"

  The returned values are always individual
  categorical values.
*/
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
    Non-string scalar values are treated
    as a normal single categorical value.
  */
  if (
    typeof value !== "string"
  ) {
    return [
      String(value).trim(),
    ].filter(Boolean);
  }

  const trimmed =
    value.trim();

  if (!trimmed) {
    return [];
  }

  /*
    First try JSON.

    Example:

      ["Bat","Handle"]
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
    Python-style / single-quote list.

    Example:

      ['Bat', 'Handle']
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
    Comma-separated representation.

    Example:

      Bat, Handle
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
    Normal scalar categorical value.
  */
  return [
    trimmed,
  ];
}

/*
  Determine whether a field contains list values.

  We inspect the records rather than relying only
  on schema metadata because the backend may still
  describe a list-valued field as "string".
*/
function isListField(
  records: any[],
  fieldName: string
): boolean {

  return records.some(
    (record) => {

      const value =
        record?.[fieldName];

      /*
        Actual JavaScript array.
      */
      if (
        Array.isArray(value)
      ) {
        return true;
      }

      /*
        JSON/Python-style list stored
        as a string.
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

/*
  Get individual categorical values from a record.

  This is particularly important for Color By.

  Example:

    record[field] =
      ["Bat", "Handle"]

  returns:

    ["Bat", "Handle"]

  Duplicate values inside one record are removed.
*/
function getCategoricalValues(
  record: any,
  fieldName: string
): string[] {

  const rawValue =
    record?.[fieldName];

  const values =
    parseListValue(
      rawValue
    );

  /*
    Preserve blank handling.
  */
  if (
    values.length === 0
  ) {

    if (
      rawValue === undefined ||
      rawValue === null ||
      rawValue === ""
    ) {
      return ["(Blank)"];
    }

    return [];
  }

  /*
    A single record should contribute
    at most once to each category.

    Example:

      ["Bat", "Bat", "Handle"]

    contributes:

      Bat
      Handle

    rather than:

      Bat
      Bat
      Handle
  */
  return Array.from(
    new Set(values)
  );
}

/* ======================================================
   DATASET TYPE HELPERS
====================================================== */

function getParentDatasetId(
  dataset: DatasetMeta
): number | null {

  const value =
    dataset.parent_dataset_id ??
    dataset.parentDatasetId;

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function getDatasetType(
  dataset: DatasetMeta
): string {

  return String(
    dataset.ingestion_type ??
      dataset.ingestionType ??
      dataset.data_type ??
      dataset.dataType ??
      ""
  ).toLowerCase();
}

function isTaggedDataset(
  dataset: DatasetMeta
): boolean {

  const type =
    getDatasetType(dataset);

  return (
    type.includes("tagged") ||
    getParentDatasetId(dataset) !== null
  );
}

function isRawDataset(
  dataset: DatasetMeta
): boolean {

  return !isTaggedDataset(
    dataset
  );
}

/* ======================================================
   DATE PARSER
====================================================== */

function parseDateValue(
  value: any
): Date | null {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const text =
    String(value).trim();

  /*
    ISO / standard date formats.
  */
  let date =
    new Date(text);

  if (
    !Number.isNaN(
      date.getTime()
    )
  ) {
    return date;
  }

  /*
    DD/MM/YYYY
  */
  const slashParts =
    text.split("/");

  if (
    slashParts.length === 3
  ) {

    const day =
      Number(
        slashParts[0]
      );

    const month =
      Number(
        slashParts[1]
      );

    const year =
      Number(
        slashParts[2]
      );

    if (
      Number.isFinite(day) &&
      Number.isFinite(month) &&
      Number.isFinite(year)
    ) {

      date =
        new Date(
          year,
          month - 1,
          day
        );

      if (
        date.getFullYear() ===
          year &&
        date.getMonth() ===
          month - 1 &&
        date.getDate() ===
          day
      ) {
        return date;
      }
    }
  }

  /*
    DD-MM-YYYY
  */
  const dashParts =
    text.split("-");

  if (
    dashParts.length === 3 &&
    dashParts[0].length <= 2
  ) {

    const day =
      Number(
        dashParts[0]
      );

    const month =
      Number(
        dashParts[1]
      );

    const year =
      Number(
        dashParts[2]
      );

    if (
      Number.isFinite(day) &&
      Number.isFinite(month) &&
      Number.isFinite(year)
    ) {

      date =
        new Date(
          year,
          month - 1,
          day
        );

      if (
        date.getFullYear() ===
          year &&
        date.getMonth() ===
          month - 1 &&
        date.getDate() ===
          day
      ) {
        return date;
      }
    }
  }

  return null;
}

/* ======================================================
   NUMERIC FILTER
====================================================== */

function applyNumericFilter(
  rowValue: any,
  filter: any
): boolean {

  const numericValue =
    Number(rowValue);

  if (
    Number.isNaN(
      numericValue
    )
  ) {
    return false;
  }

  const operator =
    filter.operator ||
    "equals";

  const target =
    Number(filter.value);

  switch (
    operator
  ) {

    case "equals":

      return (
        numericValue ===
        target
      );

    case "notEquals":

      return (
        numericValue !==
        target
      );

    case "greaterThan":

      return (
        numericValue >
        target
      );

    case "greaterThanOrEqual":

      return (
        numericValue >=
        target
      );

    case "lessThan":

      return (
        numericValue <
        target
      );

    case "lessThanOrEqual":

      return (
        numericValue <=
        target
      );

    case "between":

      return (
        numericValue >=
          Number(
            filter.min
          ) &&
        numericValue <=
          Number(
            filter.max
          )
      );

    default:

      return true;
  }
}

/* ======================================================
   DATE FILTER
====================================================== */

function applyDateFilter(
  rowValue: any,
  filter: any
): boolean {

  const rowDate =
    parseDateValue(
      rowValue
    );

  if (!rowDate) {
    return false;
  }

  const fromDate =
    filter.from
      ? parseDateValue(
          filter.from
        )
      : null;

  const toDate =
    filter.to
      ? parseDateValue(
          filter.to
        )
      : null;

  if (
    fromDate &&
    rowDate < fromDate
  ) {
    return false;
  }

  if (
    toDate &&
    rowDate > toDate
  ) {
    return false;
  }

  return true;
}

/* ======================================================
   VALID ACTIVE FILTERS
====================================================== */

function getValidFilters(
  filters: FieldFilter[]
): FieldFilter[] {

  return filters.filter(
    (filter: any) => {

      if (!filter.field) {
        return false;
      }

      switch (filter.filterType) {

        case "categorical":
          return (
            Array.isArray(filter.values) &&
            filter.values.length > 0
          );

        case "numeric":
          if (filter.operator === "between") {
            return (
              filter.min !== undefined &&
              filter.max !== undefined
            );
          }

          return (
            filter.operator !== undefined &&
            filter.value !== undefined
          );

        case "date":
          return (
            !!filter.from ||
            !!filter.to
          );

        default:
          return false;
      }
    }
  );
}

/* ======================================================
   LOCAL FILTERING
====================================================== */

function applyLocalFilters(
  records: any[],
  filters: FieldFilter[]
): any[] {

  if (
    !Array.isArray(filters) ||
    filters.length === 0
  ) {
    return records;
  }

  return records.filter(
    (row) => {

      /*
        Different fields = AND
      */
      return filters.every(
        (filter: any) => {

          const {
            field,
            filterType,
            values,
          } = filter;

          if (!field) {
            return true;
          }

          const rowValue =
            row[field];

          /* ---------------------------------------------
             NUMERIC
          --------------------------------------------- */

          if (
            filterType ===
            "numeric"
          ) {

            return applyNumericFilter(
              rowValue,
              filter
            );
          }

          /* ---------------------------------------------
             DATE
          --------------------------------------------- */

          if (
            filterType ===
            "date"
          ) {

            return applyDateFilter(
              rowValue,
              filter
            );
          }

          /* ---------------------------------------------
             CATEGORICAL
          --------------------------------------------- */

          if (
            !Array.isArray(values) ||
            values.length === 0
          ) {
            return true;
          }

          /*
            Important:

            For list-valued categorical fields,
            compare the selected value against
            the individual list items.

            Example:

              row[field] =
                ["Bat", "Handle"]

            selected values:

              ["Handle"]

            => row matches.
          */
          const rowCategories =
            getCategoricalValues(
              row,
              field
            );

          return values.some(
            (
              selectedValue
            ) => {

              const normalizedSelectedValue =
                String(
                  selectedValue
                )
                  .trim()
                  .toLowerCase();

              return rowCategories.some(
                (
                  category
                ) =>
                  String(
                    category
                  )
                    .trim()
                    .toLowerCase() ===
                  normalizedSelectedValue
              );
            }
          );
        }
      );
    }
  );
}

/* ======================================================
   TIMELINE GENERATOR
====================================================== */

function generateLocalTimeline(
  records: any[],
  schema: SchemaResponse | null,
  dateColumn: string | null = null,
  colorBy: string | null = null
): TimelinePoint[] {

  if (!schema) {
    return [];
  }

  /*
    If Date By is empty, use opentimestamp.
  */
  const timestampColumn =
    schema.columns.find(
      (column) =>
        column.ontologyMapping ===
        "opentimestamp"
    )?.name || null;

  const selectedDateColumn =
    dateColumn ||
    timestampColumn;

  if (!selectedDateColumn) {
    return [];
  }

  const dateSchemaColumn =
    schema.columns.find(
      (column) =>
        column.name ===
        selectedDateColumn
    );

  if (!dateSchemaColumn) {
    return [];
  }

  /*
    We aggregate by:

      month

    or:

      month + individual Color By value
  */
  const counts: Record<
    string,
    number
  > = {};

  records.forEach(
    (row) => {

      const date =
        parseDateValue(
          row[
            selectedDateColumn
          ]
        );

      if (!date) {
        return;
      }

      const month =
        `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(
          2,
          "0"
        )}`;

      /*
        No Color By selected.

        Simply count one event for
        each month.
      */
      if (!colorBy) {

        counts[month] =
          (
            counts[month] ||
            0
          ) + 1;

        return;
      }

      /*
        ==================================================
        COLOR BY LIST FIELD FIX
        ==================================================

        Previously:

          row[colorBy]

        was converted directly to String().

        Therefore:

          ["Bat", "Handle"]

        became one category:

          ["Bat", "Handle"]

        Now we expand the value into
        individual categories.
      */
      const categories =
        getCategoricalValues(
          row,
          colorBy
        );

      /*
        A malformed/empty non-null value
        that cannot produce a category
        contributes nothing.
      */
      if (
        categories.length === 0
      ) {
        return;
      }

      /*
        Each unique category contributes
        exactly once for this event.

        Example:

          Failure Component =
            ["Bat", "Bat", "Handle"]

        contributes:

          Bat = 1
          Handle = 1

        rather than:

          Bat = 2
          Handle = 1
      */
      categories.forEach(
        (category) => {

          const key =
            `${month}|||${category}`;

          counts[key] =
            (
              counts[key] ||
              0
            ) + 1;
        }
      );
    }
  );

  const timeline:
    TimelinePoint[] = [];

  Object.entries(
    counts
  ).forEach(
    (
      [key, count]
    ) => {

      if (colorBy) {

        const separatorIndex =
          key.indexOf(
            "|||"
          );

        const month =
          separatorIndex >= 0
            ? key.slice(
                0,
                separatorIndex
              )
            : key;

        const category =
          separatorIndex >= 0
            ? key.slice(
                separatorIndex + 3
              )
            : "(Blank)";

        timeline.push({
          month,
          category,
          count,
        });

      } else {

        timeline.push({
          month: key,
          count,
        });
      }
    }
  );

  /*
    Sort chronologically, then
    alphabetically by category.
  */
  timeline.sort(
    (a, b) => {

      if (
        a.month <
        b.month
      ) {
        return -1;
      }

      if (
        a.month >
        b.month
      ) {
        return 1;
      }

      return String(
        a.category || ""
      ).localeCompare(
        String(
          b.category || ""
        )
      );
    }
  );

  return timeline;
}

/* ======================================================
   COMPONENT
====================================================== */

export default function InvestigationWorkspace({
  datasetId,
  navigate,
}: Props) {

  /* ====================================================
     LOGICAL DATASET
  ==================================================== */

  const [
    datasetBundle,
    setDatasetBundle,
  ] =
    useState<DatasetBundle | null>(
      null
    );

  const [
    logicalDatasetName,
    setLogicalDatasetName,
  ] =
    useState("");

  /* ====================================================
     SCHEMA
  ==================================================== */

  const [
    schema,
    setSchema,
  ] =
    useState<SchemaResponse | null>(
      null
    );

  /* ====================================================
     ORIGINAL / MERGED DATA
  ==================================================== */

  const [
    records,
    setRecords,
  ] =
    useState<any[]>([]);

  const [
    timeline,
    setTimeline,
  ] =
    useState<TimelinePoint[]>([]);

  /* ====================================================
     FILTERED DATA
  ==================================================== */

  const [
    filteredRecords,
    setFilteredRecords,
  ] =
    useState<any[]>([]);

  const [
    filteredTimeline,
    setFilteredTimeline,
  ] =
    useState<TimelinePoint[]>([]);

  const [
    filteredEventCount,
    setFilteredEventCount,
  ] =
    useState(0);

  /* ====================================================
     FILTER STATE
  ==================================================== */

  const [
    filters,
    setFilters,
  ] =
    useState<FieldFilter[]>([]);

  const [
    filtersApplied,
    setFiltersApplied,
  ] =
    useState(false);

  /* ====================================================
     UI STATE
  ==================================================== */

  const [
    loadingSchema,
    setLoadingSchema,
  ] =
    useState(true);

  const [
    loadingRecords,
    setLoadingRecords,
  ] =
    useState(true);

  const [
    loadingTimeline,
    setLoadingTimeline,
  ] =
    useState(false);

  const [
    loadingBundle,
    setLoadingBundle,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    activeTab,
    setActiveTab,
  ] =
    useState("Time");

  const [
    distributionType,
    setDistributionType,
  ] =
    useState<
      "bar" | "pie"
    >("bar");

  const [
    saveAsgOpen,
    setSaveAsgOpen,
  ] =
    useState(false);

  const [
    savingAsg,
    setSavingAsg,
  ] =
    useState(false);

  const [
    saveAsgError,
    setSaveAsgError,
  ] =
    useState("");

  const [
    saveAsgSuccess,
    setSaveAsgSuccess,
  ] =
    useState("");

  /* ====================================================
     TIME CONFIGURATION
  ==================================================== */

  const dateColumns =
    useMemo(() => {

      if (!schema) {
        return [];
      }

      return schema.columns.filter(
        (column) => {

          const type =
            String(
              column.type ||
                ""
            ).toLowerCase();

          const ontology =
            String(
              column.ontologyMapping ||
                ""
            ).toLowerCase();

          const isDate =
            type.includes(
              "date"
            ) ||
            type.includes(
              "datetime"
            ) ||
            type.includes(
              "time"
            ) ||
            type.includes(
              "timestamp"
            );

          const isOpenTimestamp =
            ontology ===
            "opentimestamp";

          return (
            isDate &&
            !isOpenTimestamp
          );
        }
      );

    }, [schema]);

  const categoricalColumns =
    useMemo(() => {

      if (!schema) {
        return [];
      }

      return schema.columns.filter(
        (column) => {

          const type =
            String(
              column.type ||
                ""
            ).toLowerCase();

          const isNumeric =
            type.includes(
              "number"
            ) ||
            type.includes(
              "integer"
            ) ||
            type.includes(
              "float"
            ) ||
            type.includes(
              "double"
            ) ||
            type.includes(
              "decimal"
            ) ||
            type.includes(
              "numeric"
            );

          const isDate =
            type.includes(
              "date"
            ) ||
            type.includes(
              "datetime"
            ) ||
            type.includes(
              "time"
            ) ||
            type.includes(
              "timestamp"
            );

          return (
            !isNumeric &&
            !isDate
          );
        }
      );

    }, [schema]);

  const [
    dateBy,
    setDateBy,
  ] =
    useState<string>("");

  const [
    colorBy,
    setColorBy,
  ] =
    useState<string>("");

  /* ====================================================
     RESET CONFIGURATION
  ==================================================== */

  useEffect(() => {

    setDateBy("");
    setColorBy("");
    setFilters([]);
    setFiltersApplied(false);

  }, [datasetId]);

  /* ====================================================
     VALIDATE TIME CONFIGURATION
  ==================================================== */

  useEffect(() => {

    if (!schema) {
      return;
    }

    if (
      dateBy &&
      !dateColumns.some(
        (column) =>
          column.name ===
          dateBy
      )
    ) {
      setDateBy("");
    }

    if (
      colorBy &&
      !categoricalColumns.some(
        (column) =>
          column.name ===
          colorBy
      )
    ) {
      setColorBy("");
    }

  }, [
    schema,
    dateColumns,
    categoricalColumns,
    dateBy,
    colorBy,
  ]);

  /* ====================================================
     LOAD DATASET LIST + RESOLVE RAW/TAGGED GROUP
  ==================================================== */

  useEffect(() => {

    loadDatasetBundle();

  }, [datasetId]);

  async function loadDatasetBundle() {

    try {

      setLoadingBundle(true);
      setLoadingSchema(true);
      setLoadingRecords(true);
      setErrorMessage("");

      /*
        Load all datasets first.

        This allows the frontend to resolve:

          Raw dataset
              |
              +---- Tagged dataset
              +---- Tagged dataset
              +---- ...
      */
      const datasetsResponse =
        await fetch(
          "http://localhost:5000/datasets"
        );

      if (
        !datasetsResponse.ok
      ) {
        throw new Error(
          "Failed to load datasets."
        );
      }

      const datasets:
        DatasetMeta[] =
        await datasetsResponse.json();

      const selectedDataset =
        datasets.find(
          (dataset) =>
            dataset.id ===
            Number(datasetId)
        );

      if (!selectedDataset) {
        throw new Error(
          "Selected dataset was not found."
        );
      }

      let rawDataset:
        DatasetMeta | undefined;

      /*
        If the selected dataset is Tagged,
        resolve its parent Raw dataset.
      */
      if (
        isTaggedDataset(
          selectedDataset
        )
      ) {

        const parentId =
          getParentDatasetId(
            selectedDataset
          );

        if (parentId !== null) {

          rawDataset =
            datasets.find(
              (dataset) =>
                dataset.id ===
                parentId
            );
        }

        /*
          Backward-compatible fallback.
        */
        if (!rawDataset) {

          rawDataset =
            datasets.find(
              (dataset) =>
                dataset.dataset_name ===
                  selectedDataset.dataset_name &&
                isRawDataset(
                  dataset
                )
            );
        }

      } else {

        rawDataset =
          selectedDataset;
      }

      if (!rawDataset) {

        throw new Error(
          "Unable to resolve the Raw dataset for this investigation."
        );
      }

      /*
        Find all Tagged datasets belonging
        to the Raw dataset.
      */
      let taggedDatasets =
        datasets.filter(
          (dataset) => {

            if (
              !isTaggedDataset(
                dataset
              )
            ) {
              return false;
            }

            const parentId =
              getParentDatasetId(
                dataset
              );

            if (
              parentId !== null
            ) {
              return (
                parentId ===
                rawDataset!.id
              );
            }

            return (
              dataset.dataset_name ===
              rawDataset!.dataset_name
            );
          }
        );

      taggedDatasets =
        taggedDatasets.filter(
          (dataset) =>
            dataset.id !==
            rawDataset!.id
        );

      const bundle: DatasetBundle = {
        raw: rawDataset,
        tagged: taggedDatasets,
      };

      setDatasetBundle(
        bundle
      );

      setLogicalDatasetName(
        rawDataset.dataset_name
      );

      /*
        Load Raw schema + records.
      */
      const rawPayload =
        await loadDatasetPayload(
          rawDataset
        );

      /*
        Load all Tagged schemas + records.
      */
      const taggedPayloads:
        DatasetPayload[] =
        await Promise.all(
          taggedDatasets.map(
            (
              dataset
            ) =>
              loadDatasetPayload(
                dataset
              )
          )
        );

      /*
        Merge Raw + Tagged.
      */
      const merged =
        mergeDatasets(
          rawPayload,
          taggedPayloads
        );

      setSchema(
        merged.schema
      );

      setRecords(
        merged.records
      );

      setFilteredRecords(
        merged.records
      );

      setFilteredEventCount(
        merged.records.length
      );

      /*
        Default timeline uses Raw
        opentimestamp.
      */
      const defaultTimeline =
        generateLocalTimeline(
          merged.records,
          merged.schema
        );

      setTimeline(
        defaultTimeline
      );

      setFilteredTimeline(
        defaultTimeline
      );

    } catch (error) {

      console.error(
        "Dataset bundle load failed:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load investigation dataset."
      );

      setSchema(null);
      setRecords([]);
      setFilteredRecords([]);
      setTimeline([]);
      setFilteredTimeline([]);

    } finally {

      setLoadingBundle(false);
      setLoadingSchema(false);
      setLoadingRecords(false);

    }
  }

  /* ====================================================
     LOAD DATASET PAYLOAD
  ==================================================== */

  async function loadDatasetPayload(
    dataset: DatasetMeta
  ): Promise<DatasetPayload> {

    const [
      schemaResponse,
      dataResponse,
    ] =
      await Promise.all([

        fetch(
          `http://localhost:5000/datasets/${dataset.id}/schema`
        ),

        fetch(
          `http://localhost:5000/datasets/${dataset.id}/data`
        ),

      ]);

    if (
      !schemaResponse.ok
    ) {
      throw new Error(
        `Failed to load schema for "${dataset.file_name}".`
      );
    }

    if (
      !dataResponse.ok
    ) {
      throw new Error(
        `Failed to load records for "${dataset.file_name}".`
      );
    }

    const schemaResult =
      await schemaResponse.json();

    const dataResult =
      await dataResponse.json();

    return {
      dataset,
      schema:
        schemaResult,
      records:
        Array.isArray(
          dataResult
        )
          ? dataResult
          : Array.isArray(
              dataResult?.records
            )
          ? dataResult.records
          : [],
    };
  }

  /* ====================================================
     MERGE RAW + TAGGED DATASETS
  ==================================================== */

  function mergeDatasets(
    rawPayload: DatasetPayload,
    taggedPayloads:
      DatasetPayload[]
  ): {
    schema: SchemaResponse;
    records: any[];
  } {

    const rawSchema =
      rawPayload.schema;

    const rawRecords =
      rawPayload.records;

    /*
      Find Raw _id column.
    */
    const rawIdColumn =
      rawSchema.columns.find(
        (column) =>
          column.ontologyMapping ===
          "_id"
      )?.name || "";

    /*
      Start with Raw schema.
    */
    const mergedColumns =
      [
        ...rawSchema.columns.map(
          (column) => ({
            ...column,
          })
        ),
      ];

    /*
      Store each Tagged dataset's
      column-name mapping.
    */
    const taggedColumnMaps:
      Array<{
        payload: DatasetPayload;
        idColumn: string;
        columnMap:
          Record<string, string>;
      }> = [];

    taggedPayloads.forEach(
      (payload) => {

        const taggedSchema =
          payload.schema;

        const taggedIdColumn =
          taggedSchema.columns.find(
            (column) =>
              column.ontologyMapping ===
              "_id"
          )?.name || "";

        if (!taggedIdColumn) {
          return;
        }

        const columnMap:
          Record<string, string> = {};

        taggedSchema.columns.forEach(
          (column) => {

            /*
              Do not duplicate Tagged _id
              when it has same field name
              as Raw ID.
            */
            if (
              column.ontologyMapping ===
                "_id" &&
              column.name ===
                rawIdColumn
            ) {
              return;
            }

            let mergedName =
              column.name;

            const rawCollision =
              mergedColumns.some(
                (existing) =>
                  existing.name ===
                  mergedName
              );

            const taggedCollision =
              Object.values(
                columnMap
              ).includes(
                mergedName
              );

            if (
              rawCollision ||
              taggedCollision
            ) {

              mergedName =
                `Tagged - ${payload.dataset.file_name} - ${column.name}`;
            }

            columnMap[
              column.name
            ] =
              mergedName;

            mergedColumns.push({
              ...column,
              name:
                mergedName,
            });
          }
        );

        taggedColumnMaps.push({
          payload,
          idColumn:
            taggedIdColumn,
          columnMap,
        });
      }
    );

    /*
      Build lookup maps for Tagged records.
    */
    const taggedLookups =
      taggedColumnMaps.map(
        ({
          payload,
          idColumn,
          columnMap,
        }) => {

          const lookup =
            new Map<
              string,
              any
            >();

          payload.records.forEach(
            (record) => {

              const id =
                normalizeId(
                  record?.[
                    idColumn
                  ]
                );

              if (id !== "") {

                lookup.set(
                  id,
                  record
                );
              }
            }
          );

          return {
            payload,
            idColumn,
            columnMap,
            lookup,
          };
        }
      );

    /*
      Merge Tagged values into every
      Raw record using shared _id.
    */
    const mergedRecords =
      rawRecords.map(
        (rawRecord) => {

          const mergedRecord = {
            ...rawRecord,
          };

          const rawId =
            rawIdColumn
              ? normalizeId(
                  rawRecord?.[
                    rawIdColumn
                  ]
                )
              : "";

          taggedLookups.forEach(
            ({
              lookup,
              columnMap,
            }) => {

              if (
                rawId === ""
              ) {
                return;
              }

              const taggedRecord =
                lookup.get(
                  rawId
                );

              if (
                !taggedRecord
              ) {
                return;
              }

              Object.entries(
                columnMap
              ).forEach(
                (
                  [
                    originalName,
                    mergedName,
                  ]
                ) => {

                  mergedRecord[
                    mergedName
                  ] =
                    taggedRecord[
                      originalName
                    ];
                }
              );
            }
          );

          return mergedRecord;
        }
      );

    const mergedSchema:
      SchemaResponse = {

      ...rawSchema,

      datasetName:
        rawSchema.datasetName ||
        rawPayload.dataset.dataset_name,

      columns:
        mergedColumns,

      timestampColumn:
        rawSchema.timestampColumn,

      primaryKey:
        rawSchema.primaryKey ||
        rawIdColumn,
    };

    return {
      schema:
        mergedSchema,
      records:
        mergedRecords,
    };
  }

  /* ====================================================
     LOAD DEFAULT TIMELINE
  ==================================================== */

  async function loadAllEvents() {

    try {

      setLoadingTimeline(
        true
      );

      const defaultTimeline =
        generateLocalTimeline(
          records,
          schema,
          dateBy || null,
          colorBy || null
        );

      setTimeline(
        defaultTimeline
      );

      setFilteredTimeline(
        generateLocalTimeline(
          filteredRecords,
          schema,
          dateBy || null,
          colorBy || null
        )
      );

    } catch (error) {

      console.error(
        "Timeline load failed:",
        error
      );

    } finally {

      setLoadingTimeline(
        false
      );
    }
  }

  /* ====================================================
     UPDATE TIMELINE WHEN DATE/COLOR CONFIG CHANGES
  ==================================================== */

  useEffect(() => {

    if (
      !schema ||
      loadingRecords
    ) {
      return;
    }

    const currentTimeline =
      generateLocalTimeline(
        records,
        schema,
        dateBy || null,
        colorBy || null
      );

    const currentFilteredTimeline =
      generateLocalTimeline(
        filteredRecords,
        schema,
        dateBy || null,
        colorBy || null
      );

    setTimeline(
      currentTimeline
    );

    setFilteredTimeline(
      currentFilteredTimeline
    );

  }, [
    dateBy,
    colorBy,
    schema,
    records,
    filteredRecords,
    loadingRecords,
  ]);

  /* ====================================================
     CASCADING FILTER OPTIONS
  ==================================================== */

  function getRecordsForFilter(
    currentField: string
  ): any[] {

    /*
      When building the options for a field, apply every
      currently active filter EXCEPT that field's own filter.

      Example:

        Bat Model = Model A
        Failure Condition = Reduced Rebound

      While rendering Failure Condition, only Bat Model is
      applied. This keeps all Failure Conditions available for
      Model A instead of narrowing the list to the currently
      selected Failure Condition.
    */
    const otherFilters =
      getValidFilters(filters).filter(
        (filter) =>
          filter.field !== currentField
      );

    if (otherFilters.length === 0) {
      return records;
    }

    return applyLocalFilters(
      records,
      otherFilters
    );
  }

  /* ====================================================
     FILTER CHANGES
  ==================================================== */

  function handleFilterChange(
    updatedFilters:
      FieldFilter[]
  ) {

    setFilters(
      updatedFilters
    );
  }

  /* ====================================================
     APPLY FILTERS
  ==================================================== */

  useEffect(() => {

    if (
      loadingRecords
    ) {
      return;
    }

    applyFilters();

  }, [
    filters,
    records,
    loadingRecords,
    schema,
  ]);

  function applyFilters() {

    const validFilters =
      getValidFilters(filters);

    /*
      No active filters.
    */
    if (
      validFilters.length ===
      0
    ) {

      setFilteredRecords(
        records
      );

      setFilteredTimeline(
        generateLocalTimeline(
          records,
          schema,
          dateBy || null,
          colorBy || null
        )
      );

      setFilteredEventCount(
        records.length
      );

      setFiltersApplied(
        false
      );

      return;
    }

    /*
      Apply locally to merged
      Raw + Tagged dataset.
    */
    const result =
      applyLocalFilters(
        records,
        validFilters
      );

    setFilteredRecords(
      result
    );

    setFilteredTimeline(
      generateLocalTimeline(
        result,
        schema,
        dateBy || null,
        colorBy || null
      )
    );

    setFilteredEventCount(
      result.length
    );

    setFiltersApplied(
      true
    );
  }

  /* ====================================================
     DOWNLOAD FILTERED DATA
  ==================================================== */

  function downloadFilteredData() {

    if (
      filteredRecords.length ===
      0
    ) {
      return;
    }

    const headers =
      Object.keys(
        filteredRecords[0]
      );

    const csvRows = [
      headers.join(","),
      ...filteredRecords.map(
        (row) =>
          headers
            .map(
              (header) =>
                `"${String(
                  row[header] ??
                    ""
                ).replace(
                  /"/g,
                  '""'
                )}"`
            )
            .join(",")
      ),
    ];

    const blob =
      new Blob(
        [
          csvRows.join(
            "\n"
          ),
        ],
        {
          type:
            "text/csv;charset=utf-8;",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      url;

    link.download =
      filtersApplied
        ? "filtered_dataset.csv"
        : "dataset.csv";

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(
      url
    );
  }

  /* ====================================================
     SAVE ASG
  ==================================================== */

  async function saveAsg(
    title: string,
    category: string
  ) {

    try {

      setSavingAsg(true);
      setSaveAsgError("");

      const response =
        await fetch(
          "http://localhost:5000/asgs",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              title,
              category,
              datasetId,
              datasetName:
                logicalDatasetName,
              dateBy,
              colorBy,
              eventCount:
                filteredEventCount,
              filters:
                getValidFilters(
                  filters
                ),
            }),
          }
        );

      const payload =
        await response.json();

      if (!payload.success) {
        throw new Error(
          payload.message ||
            "Failed to save ASG"
        );
      }

      setSaveAsgOpen(false);
      setSaveAsgSuccess(
        `Saved ${payload.asg.asg_number}: ${payload.asg.title}`
      );

    } catch (error: any) {

      setSaveAsgError(
        error.message ||
          "Failed to save ASG"
      );

    } finally {

      setSavingAsg(false);

    }
  }


  /* ====================================================
     RENDER
  ==================================================== */

  return (

    <div
      style={{
        background:
          "#0f172a",
        color:
          "white",
        height:
          "100vh",
        display:
          "flex",
        flexDirection:
          "column",
        overflow:
          "hidden",
      }}
    >

      {/* ==================================================
          TOOLBAR
      ================================================== */}

      <InvestigationToolbar
        navigate={
          navigate
        }
        loadAllEvents={
          loadAllEvents
        }
        loadingTimeline={
          loadingTimeline
        }
        downloadData={
          downloadFilteredData
        }
        filtersApplied={
          filtersApplied
        }
        onSaveAsg={() => {
          setSaveAsgError("");
          setSaveAsgSuccess("");
          setSaveAsgOpen(true);
        }}
      />

      {/* ==================================================
          LOGICAL DATASET HEADER
      ================================================== */}

      <div
        style={{
          background:
            "#111827",
          borderBottom:
            "1px solid #334155",
          padding:
            "12px 20px",
          display:
            "flex",
          alignItems:
            "center",
          justifyContent:
            "space-between",
          gap:
            16,
          flexWrap:
            "wrap",
        }}
      >

        <div>

          <div
            style={{
              fontSize:
                16,
              fontWeight:
                700,
              color:
                "#f8fafc",
            }}
          >
            {
              logicalDatasetName ||
              "Investigation Dataset"
            }
          </div>

          <div
            style={{
              marginTop:
                4,
              fontSize:
                12,
              color:
                "#94a3b8",
            }}
          >
            One logical dataset containing
            Raw and Tagged engineering data.
          </div>

        </div>

        {datasetBundle && (

          <div
            style={{
              display:
                "flex",
              gap:
                8,
              flexWrap:
                "wrap",
              alignItems:
                "center",
            }}
          >

            <span
              style={{
                background:
                  "#0ea5e9",
                color:
                  "white",
                padding:
                  "5px 10px",
                borderRadius:
                  12,
                fontSize:
                  12,
                fontWeight:
                  600,
              }}
            >
              Raw:{" "}
              {
                datasetBundle.raw.file_name
              }
            </span>

            {datasetBundle.tagged.map(
              (tagged) => (

                <span
                  key={
                    tagged.id
                  }
                  style={{
                    background:
                      "#f59e0b",
                    color:
                      "#111827",
                    padding:
                      "5px 10px",
                    borderRadius:
                      12,
                    fontSize:
                      12,
                    fontWeight:
                      600,
                  }}
                >
                  Tagged:{" "}
                  {
                    tagged.file_name
                  }
                </span>

              )
            )}

            {
              datasetBundle.tagged.length ===
              0 && (

                <span
                  style={{
                    color:
                      "#94a3b8",
                    fontSize:
                      12,
                  }}
                >
                  No Tagged dataset linked
                </span>

              )
            }

          </div>

        )}

      </div>

      {saveAsgSuccess && (
        <div
          style={{
            background: "#14532d",
            color: "#bbf7d0",
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {saveAsgSuccess}
        </div>
      )}

      {/* ==================================================
          ERROR
      ================================================== */}

      {errorMessage && (

        <div
          style={{
            margin:
              "12px 20px 0",
            padding:
              "12px 16px",
            background:
              "#7f1d1d",
            border:
              "1px solid #ef4444",
            borderRadius:
              8,
            color:
              "#fecaca",
          }}
        >
          {errorMessage}
        </div>

      )}

      {/* ==================================================
          LOADING
      ================================================== */}

      {loadingBundle ? (

        <div
          style={{
            flex:
              1,
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            color:
              "#94a3b8",
            fontSize:
              18,
          }}
        >
          Loading Raw and Tagged datasets...
        </div>

      ) : (

        <div
          style={{
            display:
              "flex",
            flex:
              1,
            overflow:
              "hidden",
          }}
        >

          {/* ==================================================
              FIELDS SIDEBAR
          ================================================== */}

          <InvestigationFieldsSidebar
            schema={
              schema
            }
            loadingSchema={
              loadingSchema
            }
            search={
              search
            }
            setSearch={
              setSearch
            }
            filters={
              filters
            }
            onFilterChange={
              handleFilterChange
            }
          />

          {/* ==================================================
              SET SIDEBAR
          ================================================== */}

          <InvestigationSetSidebar
            schema={
              schema
            }
            records={
              records
            }
            filters={
              filters
            }
            getRecordsForFilter={
              getRecordsForFilter
            }
            onFilterChange={
              handleFilterChange
            }
          />

          {/* ==================================================
              MAIN WORKSPACE
          ================================================== */}

          <div
            style={{
              flex:
                1,
              display:
                "flex",
              flexDirection:
                "column",
              overflow:
                "hidden",
            }}
          >

            {/* ==================================================
                TABS
            ================================================== */}

            <InvestigationTabs
              activeTab={
                activeTab
              }
              setActiveTab={
                setActiveTab
              }
            />

            {/* ==================================================
                TAB CONTENT
            ================================================== */}

            <div
              style={{
                flex:
                  1,
                overflow:
                  "auto",
                padding:
                  20,
              }}
            >

              {/* ==================================================
                  TIME TAB
              ================================================== */}

              {activeTab ===
                "Time" && (

                <div>

                  {/* ==================================================
                      TIME CONFIGURATION
                  ================================================== */}

                  <div
                    style={{
                      background:
                        "#111827",
                      border:
                        "1px solid #334155",
                      borderRadius:
                        10,
                      padding:
                        16,
                      marginBottom:
                        16,
                    }}
                  >

                    <div
                      style={{
                        marginBottom:
                          14,
                      }}
                    >

                      <div
                        style={{
                          fontSize:
                            15,
                          fontWeight:
                            600,
                        }}
                      >
                        Time Configuration
                      </div>

                      <div
                        style={{
                          fontSize:
                            12,
                          color:
                            "#94a3b8",
                          marginTop:
                            4,
                        }}
                      >
                        Configure the date field
                        and categorical field
                        used by the timeline.
                      </div>

                    </div>

                    <div
                      style={{
                        display:
                          "flex",
                        gap:
                          16,
                        flexWrap:
                          "wrap",
                      }}
                    >

                      {/* ==================================================
                          DATE BY
                      ================================================== */}

                      <div
                        style={{
                          minWidth:
                            240,
                          flex:
                            1,
                        }}
                      >

                        <label
                          style={{
                            display:
                              "block",
                            fontSize:
                              12,
                            fontWeight:
                              600,
                            color:
                              "#cbd5e1",
                            marginBottom:
                              7,
                          }}
                        >
                          Date By
                        </label>

                        <select
                          value={
                            dateBy
                          }
                          onChange={(
                            event
                          ) =>
                            setDateBy(
                              event.target.value
                            )
                          }
                          style={{
                            width:
                              "100%",
                            background:
                              "#0f172a",
                            color:
                              "white",
                            border:
                              "1px solid #475569",
                            borderRadius:
                              6,
                            padding:
                              "10px 12px",
                            outline:
                              "none",
                            cursor:
                              "pointer",
                          }}
                        >

                          <option
                            value=""
                          >
                            Default Event Date
                          </option>

                          {dateColumns.map(
                            (
                              column
                            ) => (

                              <option
                                key={
                                  column.name
                                }
                                value={
                                  column.name
                                }
                              >
                                {
                                  column.name
                                }
                              </option>

                            )
                          )}

                        </select>

                        <div
                          style={{
                            color:
                              "#64748b",
                            fontSize:
                              11,
                            marginTop:
                              5,
                          }}
                        >
                          Choose the date column
                          used on the X-axis.
                          The internal
                          opentimestamp field
                          is excluded.
                        </div>

                      </div>

                      {/* ==================================================
                          COLOR BY
                      ================================================== */}

                      <div
                        style={{
                          minWidth:
                            240,
                          flex:
                            1,
                        }}
                      >

                        <label
                          style={{
                            display:
                              "block",
                            fontSize:
                              12,
                            fontWeight:
                              600,
                            color:
                              "#cbd5e1",
                            marginBottom:
                              7,
                          }}
                        >
                          Color By
                        </label>

                        <select
                          value={
                            colorBy
                          }
                          onChange={(
                            event
                          ) =>
                            setColorBy(
                              event.target.value
                            )
                          }
                          style={{
                            width:
                              "100%",
                            background:
                              "#0f172a",
                            color:
                              "white",
                            border:
                              "1px solid #475569",
                            borderRadius:
                              6,
                            padding:
                              "10px 12px",
                            outline:
                              "none",
                            cursor:
                              "pointer",
                          }}
                        >

                          <option
                            value=""
                          >
                            No Color Grouping
                          </option>

                          {categoricalColumns.map(
                            (
                              column
                            ) => (

                              <option
                                key={
                                  column.name
                                }
                                value={
                                  column.name
                                }
                              >
                                {
                                  column.name
                                }
                              </option>

                            )
                          )}

                        </select>

                        <div
                          style={{
                            color:
                              "#64748b",
                            fontSize:
                              11,
                            marginTop:
                              5,
                          }}
                        >
                          Choose a categorical
                          field to color the
                          timeline. Multi-valued
                          fields are expanded into
                          individual categories.
                        </div>

                      </div>

                    </div>

                  </div>

                  {/* ==================================================
                      TIMELINE
                  ================================================== */}

                  <TimelineChart
                    timeline={
                      filteredTimeline
                    }
                    loadingTimeline={
                      loadingTimeline
                    }
                    records={
                      filteredRecords
                    }
                    schema={
                      schema
                    }
                    dateBy={
                      dateBy
                    }
                    colorBy={
                      colorBy
                    }
                  />

                </div>

              )}

              {/* ==================================================
                  DISTRIBUTION TAB
              ================================================== */}

              {activeTab ===
                "Distribution" && (

                <DistributionCharts
                  records={
                    filteredRecords
                  }
                  schema={
                    schema
                  }
                  chartType={
                    distributionType
                  }
                  setChartType={
                    setDistributionType
                  }
                  filtersApplied={
                    filtersApplied
                  }
                />

              )}

              {/* ==================================================
                  DATA TAB
              ================================================== */}

              {activeTab ===
                "Data" && (

                <RecordsTable
                  records={
                    filteredRecords
                  }
                  totalRecords={
                    filteredEventCount
                  }
                />

              )}

            </div>

          </div>

        </div>

      )}

      <SaveAsgModal
        open={saveAsgOpen}
        datasetName={logicalDatasetName}
        eventCount={filteredEventCount}
        filters={getValidFilters(filters)}
        saving={savingAsg}
        errorMessage={saveAsgError}
        onClose={() => setSaveAsgOpen(false)}
        onSave={saveAsg}
      />

    </div>
  );
}