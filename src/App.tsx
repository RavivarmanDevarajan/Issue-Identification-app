import {
  useCallback,
  useEffect,
  useState,
} from "react";

import "./App.css";

import Home from "./Pages/Home";
import DataIngestion from "./Pages/DataIngestion";
import Investigation from "./Pages/Investigation";
import InvestigationWorkspace from "./Pages/InvestigationWorkspace";
import Asgs from "./Pages/Asgs";
import Sidebar from "./components/Sidebar";

import type {
  FieldFilter,
} from "./components/filterTypes";

import { findDuplicateASG } from "./components/asgHelpers";

type Page =
  | "home"
  | "ingestion"
  | "investigate"
  | "workspace"
  | "asgs";

/* ======================================================
   ASG TYPES
====================================================== */

export type ASGStatus =
  | "Detect"
  | "Investigate"
  | "Resolved"
  | "CAPA Implemented";

export interface CountermeasureAction {
  date: string;
  title?: string;
  description?: string;
}

export interface ASGTrend {
  id: string;
  number: string;
  title: string;
  category: string;

  datasetId?: number;
  datasetName?: string;

  description?: string;

  dateBy?: string;
  colorBy?: string;

  /*
    Kept for backward compatibility.

    This is the event count at the time the ASG
    was originally saved.

    It is NOT used as the current event count.
  */
  eventCount?: number;

  filters?: FieldFilter[];

  countermeasure?: CountermeasureAction;

  status: ASGStatus;

  createdAt: string;
}

export interface ASGCreatePayload {
  title: string;
  category: string;

  datasetId?: number;
  datasetName?: string;

  description?: string;

  dateBy?: string;
  colorBy?: string;

  eventCount?: number;
  filters?: FieldFilter[];

  countermeasure?: CountermeasureAction;
}

/*
  An ASG is rejected when another ASG already flags the
  same dataset with the same filters, because both
  would describe the same issue.
*/
export interface ASGCreateResult {
  created: boolean;
  duplicate?: ASGTrend;
}

/* ======================================================
   LOCAL STORAGE
====================================================== */

const ASG_STORAGE_KEY =
  "investigation-asgs";

/* ======================================================
   DATASET TYPES
====================================================== */

interface DatasetMeta {
  id: number;

  dataset_name?: string;
  file_name?: string;

  parent_dataset_id?: number | null;
  parentDatasetId?: number | null;

  ingestion_type?: string;
  ingestionType?: string;

  data_type?: string;
  dataType?: string;
}

interface DatasetColumn {
  name: string;
  type: string;
  ontologyMapping: string;
}

interface DatasetSchema {
  datasetName: string;
  columns: DatasetColumn[];
  timestampColumn: string;
  primaryKey: string;
}

interface DatasetPayload {
  dataset: DatasetMeta;
  schema: DatasetSchema;
  records: any[];
}

/* ======================================================
   DATASET HELPERS
====================================================== */

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

function getParentDatasetId(
  dataset: DatasetMeta
): number | null {
  const value =
    dataset.parent_dataset_id ??
    dataset.parentDatasetId;

  if (
    value === undefined ||
    value === null ||
    (value as any) === ""
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
   LIST VALUE PARSING
====================================================== */

function parseListValue(
  value: any
): string[] {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return [];
  }

  if (
    Array.isArray(value)
  ) {
    return value
      .map((item) =>
        String(item).trim()
      )
      .filter(Boolean);
  }

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
    JSON array.
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
    Python-style list.
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
    Comma-separated values.
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

  return [
    trimmed,
  ];
}

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

  if (
    values.length === 0 &&
    (
      rawValue === undefined ||
      rawValue === null ||
      rawValue === ""
    )
  ) {
    return [
      "(Blank)",
    ];
  }

  /*
    A list value occurring more than once
    within the same record counts once.
  */
  return Array.from(
    new Set(values)
  );
}

/* ======================================================
   DATE PARSING
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

  if (!text) {
    return null;
  }

  /*
    Native ISO / standard date parsing.
  */
  const nativeDate =
    new Date(text);

  if (
    !Number.isNaN(
      nativeDate.getTime()
    )
  ) {
    return nativeDate;
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
      const date =
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
      const date =
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
  filter: FieldFilter
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
    filter.operator;

  if (
    operator ===
    "between"
  ) {
    return (
      filter.min !==
        undefined &&
      filter.max !==
        undefined &&
      numericValue >=
        Number(filter.min) &&
      numericValue <=
        Number(filter.max)
    );
  }

  /*
    Support symbolic operators.
  */
  switch (
    operator
  ) {
    case ">":
      return (
        filter.value !==
          undefined &&
        numericValue >
          Number(filter.value)
      );

    case ">=":
      return (
        filter.value !==
          undefined &&
        numericValue >=
          Number(filter.value)
      );

    case "<":
      return (
        filter.value !==
          undefined &&
        numericValue <
          Number(filter.value)
      );

    case "<=":
      return (
        filter.value !==
          undefined &&
        numericValue <=
          Number(filter.value)
      );

    case "=":
      return (
        filter.value !==
          undefined &&
        numericValue ===
          Number(filter.value)
      );

    default:
      /*
        Support older saved filters.
      */
      switch (
        String(operator)
      ) {
        case "equals":
          return (
            filter.value !==
              undefined &&
            numericValue ===
              Number(
                filter.value
              )
          );

        case "notEquals":
          return (
            filter.value !==
              undefined &&
            numericValue !==
              Number(
                filter.value
              )
          );

        case "greaterThan":
          return (
            filter.value !==
              undefined &&
            numericValue >
              Number(
                filter.value
              )
          );

        case "greaterThanOrEqual":
          return (
            filter.value !==
              undefined &&
            numericValue >=
              Number(
                filter.value
              )
          );

        case "lessThan":
          return (
            filter.value !==
              undefined &&
            numericValue <
              Number(
                filter.value
              )
          );

        case "lessThanOrEqual":
          return (
            filter.value !==
              undefined &&
            numericValue <=
              Number(
                filter.value
              )
          );

        default:
          return true;
      }
  }
}

/* ======================================================
   DATE FILTER
====================================================== */

function applyDateFilter(
  rowValue: any,
  filter: FieldFilter
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
   VALID FILTERS
====================================================== */

function getValidFilters(
  filters: FieldFilter[]
): FieldFilter[] {
  return filters.filter(
    (filter) => {
      if (!filter.field) {
        return false;
      }

      switch (
        filter.filterType
      ) {
        case "categorical":
          return (
            Array.isArray(
              filter.values
            ) &&
            filter.values.length >
              0
          );

        case "numeric":
          if (
            filter.operator ===
            "between"
          ) {
            return (
              filter.min !==
                undefined &&
              filter.max !==
                undefined
            );
          }

          return (
            filter.operator !==
              undefined &&
            filter.value !==
              undefined
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
   APPLY ASG FILTERS
====================================================== */

function applyASGFilters(
  records: any[],
  filters:
    | FieldFilter[]
    | undefined
): any[] {
  const validFilters =
    getValidFilters(
      Array.isArray(filters)
        ? filters
        : []
    );

  if (
    validFilters.length === 0
  ) {
    return records;
  }

  /*
    Different fields = AND.

    Multiple values within one categorical
    field = OR.
  */
  return records.filter(
    (row) =>
      validFilters.every(
        (filter) => {
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

          if (
            filterType ===
            "numeric"
          ) {
            return applyNumericFilter(
              rowValue,
              filter
            );
          }

          if (
            filterType ===
            "date"
          ) {
            return applyDateFilter(
              rowValue,
              filter
            );
          }

          if (
            !Array.isArray(
              values
            ) ||
            values.length === 0
          ) {
            return true;
          }

          const rowCategories =
            getCategoricalValues(
              row,
              field
            );

          return values.some(
            (selectedValue) => {
              const normalizedSelected =
                String(
                  selectedValue
                )
                  .trim()
                  .toLowerCase();

              return rowCategories.some(
                (category) =>
                  String(
                    category
                  )
                    .trim()
                    .toLowerCase() ===
                  normalizedSelected
              );
            }
          );
        }
      )
    )
  ;
}

/* ======================================================
   LOAD DATASET PAYLOAD
====================================================== */

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
      `Failed to load schema for "${
        dataset.file_name ||
        dataset.dataset_name ||
        dataset.id
      }".`
    );
  }

  if (
    !dataResponse.ok
  ) {
    throw new Error(
      `Failed to load records for "${
        dataset.file_name ||
        dataset.dataset_name ||
        dataset.id
      }".`
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

/* ======================================================
   MERGE RAW + TAGGED
====================================================== */

function mergeDatasetPayloads(
  rawPayload: DatasetPayload,
  taggedPayloads: DatasetPayload[]
): any[] {
  const rawSchema =
    rawPayload.schema;

  const rawRecords =
    rawPayload.records;

  /*
    Find the logical _id column in Raw.
  */
  const rawIdColumn =
    rawSchema.columns.find(
      (column) =>
        column.ontologyMapping ===
        "_id"
    )?.name || "";

  /*
    Prepare a lookup for each Tagged dataset.
  */
  const taggedLookups =
    taggedPayloads
      .map(
        (payload) => {
          const taggedIdColumn =
            payload.schema.columns.find(
              (column) =>
                column.ontologyMapping ===
                "_id"
            )?.name || "";

          if (
            !taggedIdColumn
          ) {
            return null;
          }

          const columnMap:
            Record<
              string,
              string
            > = {};

          payload.schema.columns.forEach(
            (column) => {
              /*
                If Tagged has the same physical
                _id column as Raw, do not duplicate it.
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
                rawSchema.columns.some(
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
                  `Tagged - ${
                    payload.dataset
                      .file_name ||
                    payload.dataset
                      .dataset_name ||
                    payload.dataset.id
                  } - ${column.name}`;
              }

              columnMap[
                column.name
              ] =
                mergedName;
            }
          );

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
                    taggedIdColumn
                  ]
                );

              if (id) {
                lookup.set(
                  id,
                  record
                );
              }
            }
          );

          return {
            lookup,
            columnMap,
          };
        }
      )
      .filter(
        (
          item
        ): item is {
          lookup: Map<
            string,
            any
          >;
          columnMap: Record<
            string,
            string
          >;
        } =>
          item !== null
      );

  /*
    Raw records remain the event population.

    Tagged records enrich matching Raw records.
  */
  return rawRecords.map(
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

      if (!rawId) {
        return mergedRecord;
      }

      taggedLookups.forEach(
        ({
          lookup,
          columnMap,
        }) => {
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
            ([
              originalName,
              mergedName,
            ]) => {
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
}

/* ======================================================
   ASG NORMALIZATION
====================================================== */

function normalizeCountermeasure(
  value: any
): CountermeasureAction | undefined {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return undefined;
  }

  const date =
    value.date != null
      ? String(value.date)
      : "";

  /*
    A countermeasure without a date cannot be
    placed on the timeline, so it is dropped.
  */
  if (!date) {
    return undefined;
  }

  const title =
    value.title != null
      ? String(value.title)
      : "";

  const description =
    value.description != null
      ? String(
          value.description
        )
      : "";

  return {
    date,

    title:
      title || undefined,

    description:
      description || undefined,
  };
}

function normalizeASG(
  value: any
): ASGTrend | null {
  if (!value) {
    return null;
  }

  const id =
    value.id != null
      ? String(value.id)
      : "";

  const number =
    value.number != null
      ? String(value.number)
      : value.asg_number != null
      ? String(
          value.asg_number
        )
      : "";

  const title =
    value.title != null
      ? String(value.title)
      : "";

  const category =
    value.category != null
      ? String(value.category)
      : "";

  if (
    !id ||
    !title
  ) {
    return null;
  }

  const datasetId =
    value.datasetId != null
      ? Number(
          value.datasetId
        )
      : value.dataset_id != null
      ? Number(
          value.dataset_id
        )
      : undefined;

  const datasetName =
    value.datasetName != null
      ? String(
          value.datasetName
        )
      : value.dataset_name != null
      ? String(
          value.dataset_name
        )
      : undefined;

  const eventCount =
    value.eventCount != null
      ? Number(
          value.eventCount
        )
      : value.event_count != null
      ? Number(
          value.event_count
        )
      : undefined;

  const status: ASGStatus =
    value.status ===
      "Investigate" ||
    value.status ===
      "Resolved" ||
    value.status ===
      "CAPA Implemented"
      ? value.status
      : "Detect";

  return {
    id,
    number,
    title,
    category,

    datasetId:
      Number.isFinite(
        datasetId
      )
        ? datasetId
        : undefined,

    datasetName,

    description:
      value.description != null
        ? String(
            value.description
          )
        : undefined,

    dateBy:
      value.dateBy != null
        ? String(
            value.dateBy
          )
        : undefined,

    colorBy:
      value.colorBy != null
        ? String(
            value.colorBy
          )
        : undefined,

    eventCount:
      Number.isFinite(
        eventCount
      )
        ? eventCount
        : undefined,

    filters:
      Array.isArray(
        value.filters
      )
        ? value.filters
        : undefined,

    countermeasure:
      normalizeCountermeasure(
        value.countermeasure
      ),

    status,

    createdAt:
      value.createdAt != null
        ? String(
            value.createdAt
          )
        : value.created_at != null
        ? String(
            value.created_at
          )
        : new Date().toISOString(),
  };
}

function loadStoredASGs(): ASGTrend[] {
  try {
    const stored =
      localStorage.getItem(
        ASG_STORAGE_KEY
      );

    if (!stored) {
      return [];
    }

    const parsed =
      JSON.parse(
        stored
      );

    if (
      !Array.isArray(parsed)
    ) {
      return [];
    }

    return parsed
      .map(normalizeASG)
      .filter(
        (
          asg
        ): asg is ASGTrend =>
          asg !== null
      );
  } catch (error) {
    console.error(
      "Failed to load ASGs:",
      error
    );

    return [];
  }
}

/* ======================================================
   APP
====================================================== */

function App() {
  const [
    page,
    setPage,
  ] = useState<Page>(
    "home"
  );

  const [
    selectedDatasetId,
    setSelectedDatasetId,
  ] = useState<
    number | null
  >(null);

  const [
    selectedASG,
    setSelectedASG,
  ] = useState<
    ASGTrend | null
  >(null);

  const [
    asgs,
    setAsgs,
  ] = useState<ASGTrend[]>(
    loadStoredASGs
  );

  /*
    Current event counts.

    These are only a UI cache.
    They are NOT persisted as the source of truth.
  */
  const [
    asgEventCounts,
    setAsgEventCounts,
  ] = useState<
    Record<
      string,
      number
    >
  >({});

  /* ====================================================
     SAVE ASGS
  ==================================================== */

  useEffect(() => {
    try {
      localStorage.setItem(
        ASG_STORAGE_KEY,
        JSON.stringify(asgs)
      );
    } catch (error) {
      console.error(
        "Failed to save ASGs:",
        error
      );
    }
  }, [asgs]);

  /* ====================================================
     DYNAMIC ASG EVENT COUNT
  ==================================================== */

  const getASGEventCount =
    useCallback(
      async (
        asg: ASGTrend
      ): Promise<
        number | null
      > => {
        if (
          asg.datasetId ===
            undefined ||
          asg.datasetId ===
            null
        ) {
          return null;
        }

        try {
          /*
            Always retrieve the latest dataset
            metadata from the backend.
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

          const datasetsResult =
            await datasetsResponse.json();

          /*
            Support both:
              [...]
            and:
              { datasets: [...] }
          */
          const datasets: DatasetMeta[] =
            Array.isArray(
              datasetsResult
            )
              ? datasetsResult
              : Array.isArray(
                  datasetsResult?.datasets
                )
              ? datasetsResult.datasets
              : [];

          if (
            datasets.length === 0
          ) {
            throw new Error(
              "No datasets were returned by the backend."
            );
          }

          /*
            Find the dataset referenced by the ASG.
          */
          const selectedDataset =
            datasets.find(
              (dataset) =>
                Number(
                  dataset.id
                ) ===
                Number(
                  asg.datasetId
                )
            );

          if (
            !selectedDataset
          ) {
            throw new Error(
              "ASG dataset was not found."
            );
          }

          /* --------------------------------------------
             RESOLVE RAW DATASET
          -------------------------------------------- */

          let rawDataset:
            | DatasetMeta
            | undefined;

          if (
            isTaggedDataset(
              selectedDataset
            )
          ) {
            const parentId =
              getParentDatasetId(
                selectedDataset
              );

            /*
              Preferred relationship:
              Tagged -> parent_dataset_id -> Raw
            */
            if (
              parentId !== null
            ) {
              rawDataset =
                datasets.find(
                  (dataset) =>
                    Number(
                      dataset.id
                    ) ===
                    Number(
                      parentId
                    )
                );
            }

            /*
              Backward-compatible fallback.
            */
            if (
              !rawDataset
            ) {
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

          if (
            !rawDataset
          ) {
            throw new Error(
              "Unable to resolve the Raw dataset for this ASG."
            );
          }

          /* --------------------------------------------
             FIND LINKED TAGGED DATASETS
          -------------------------------------------- */

          const taggedDatasets =
            datasets
              .filter(
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
                      Number(
                        parentId
                      ) ===
                      Number(
                        rawDataset!.id
                      )
                    );
                  }

                  /*
                    Backward-compatible fallback
                    for Tagged datasets without
                    parent_dataset_id.
                  */
                  return (
                    dataset.dataset_name ===
                    rawDataset!.dataset_name
                  );
                }
              )
              .filter(
                (dataset) =>
                  Number(
                    dataset.id
                  ) !==
                  Number(
                    rawDataset!.id
                  )
              );

          /* --------------------------------------------
             LOAD CURRENT RAW + TAGGED DATA
          -------------------------------------------- */

          const rawPayload =
            await loadDatasetPayload(
              rawDataset
            );

          const taggedPayloads =
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

          /* --------------------------------------------
             MERGE
          -------------------------------------------- */

          const mergedRecords =
            mergeDatasetPayloads(
              rawPayload,
              taggedPayloads
            );

          /* --------------------------------------------
             APPLY SAVED ASG FILTERS
          -------------------------------------------- */

          const filteredRecords =
            applyASGFilters(
              mergedRecords,
              asg.filters
            );

          /*
            Event count is simply the number of
            current merged Raw events remaining
            after the ASG's saved filters.
          */
          const count =
            filteredRecords.length;

          /*
            Update UI cache.
          */
          setAsgEventCounts(
            (current) => ({
              ...current,
              [asg.id]:
                count,
            })
          );

          return count;
        } catch (error) {
          console.error(
            `Failed to calculate current event count for ASG ${asg.number}:`,
            error
          );

          return null;
        }
      },
      []
    );

  /* ====================================================
     REFRESH ALL ASG COUNTS
  ==================================================== */

  useEffect(() => {
    if (
      asgs.length === 0
    ) {
      setAsgEventCounts(
        {}
      );

      return;
    }

    let cancelled =
      false;

    async function refreshCounts() {
      const results:
        Record<
          string,
          number
        > = {};

      await Promise.all(
        asgs.map(
          async (
            asg
          ) => {
            const count =
              await getASGEventCount(
                asg
              );

            if (
              count !== null
            ) {
              results[
                asg.id
              ] = count;
            }
          }
        )
      );

      if (
        !cancelled
      ) {
        setAsgEventCounts(
          results
        );
      }
    }

    refreshCounts();

    return () => {
      cancelled = true;
    };
  }, [
    asgs,
    getASGEventCount,
  ]);

  /* ====================================================
     CREATE ASG
  ==================================================== */

  /*
    Finds the ASG that already flags this dataset with
    this exact set of filters, if there is one.
  */
  const findExistingASG =
    useCallback(
      (
        datasetId: number | undefined,
        datasetName: string | undefined,
        filters: FieldFilter[]
      ) =>
        findDuplicateASG(
          asgs,
          datasetId,
          datasetName,
          filters
        ),
      [asgs]
    );

  function addASG(
    payload: ASGCreatePayload
  ): ASGCreateResult {
    /*
      Two ASGs with the same dataset and filters would
      describe the same issue, so the second one is
      rejected and the existing one is reported back.
    */
    const duplicate =
      findExistingASG(
        payload.datasetId,
        payload.datasetName,
        payload.filters || []
      );

    if (duplicate) {
      return {
        created: false,
        duplicate,
      };
    }

    setAsgs(
      (currentASGs) => {
        let highestNumber =
          0;

        currentASGs.forEach(
          (asg) => {
            const match =
              String(
                asg.number ||
                  ""
              ).match(
                /^C-(\d+)$/
              );

            if (match) {
              const number =
                Number(
                  match[1]
                );

              if (
                Number.isFinite(
                  number
                ) &&
                number >
                  highestNumber
              ) {
                highestNumber =
                  number;
              }
            }
          }
        );

        const nextNumber =
          highestNumber + 1;

        const asgNumber =
          `C-${String(
            nextNumber
          ).padStart(
            2,
            "0"
          )}`;

        const newASG:
          ASGTrend = {
          id:
            `${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 9)}`,

          number:
            asgNumber,

          title:
            payload.title.trim(),

          category:
            payload.category,

          datasetId:
            payload.datasetId,

          datasetName:
            payload.datasetName,

          description:
            payload.description,

          dateBy:
            payload.dateBy,

          colorBy:
            payload.colorBy,

          /*
            Historical value only.
            The ASG page uses the dynamic
            value from the latest dataset.
          */
          eventCount:
            payload.eventCount,

          filters:
            payload.filters,

          countermeasure:
            payload.countermeasure,

          status:
            "Detect",

          createdAt:
            new Date().toISOString(),
        };

        return [
          ...currentASGs,
          newASG,
        ];
      }
    );

    return {
      created: true,
    };
  }

  /* ====================================================
     OPEN ASG
  ==================================================== */

  function openASG(
    asg: ASGTrend
  ) {
    if (
      asg.datasetId ===
        undefined ||
      asg.datasetId ===
        null
    ) {
      console.error(
        "ASG does not contain a dataset ID:",
        asg
      );

      return;
    }

    /*
      Store the ASG so Workspace can restore:
        - dataset
        - filters
        - Date By
        - Color By
    */
    setSelectedASG(
      asg
    );

    setSelectedDatasetId(
      asg.datasetId
    );

    setPage(
      "workspace"
    );
  }

  /* ====================================================
     DELETE ASG
  ==================================================== */

  function deleteASG(
    id: string
  ) {
    setAsgs(
      (currentASGs) =>
        currentASGs.filter(
          (asg) =>
            asg.id !== id
        )
    );

    setAsgEventCounts(
      (current) => {
        const next = {
          ...current,
        };

        delete next[id];

        return next;
      }
    );

    if (
      selectedASG?.id ===
      id
    ) {
      setSelectedASG(
        null
      );
    }
  }

  /* ====================================================
     UPDATE ASG
  ==================================================== */

  function updateASG(
    id: string,
    updates: Partial<ASGTrend>
  ) {
    setAsgs(
      (currentASGs) =>
        currentASGs.map(
          (asg) =>
            asg.id === id
              ? {
                  ...asg,
                  ...updates,
                }
              : asg
        )
    );

    /*
      Keep selected ASG synchronized
      while it is open.
    */
    if (
      selectedASG?.id ===
      id
    ) {
      setSelectedASG(
        (current) =>
          current
            ? {
                ...current,
                ...updates,
              }
            : current
      );
    }
  }

  /* ====================================================
     START NEW INVESTIGATION
  ==================================================== */

  function startInvestigation() {
    setSelectedASG(
      null
    );
  }

  /* ====================================================
     RENDER
  ==================================================== */

  return (
    <div className="app-container">
      <Sidebar
        currentPage={page}
        navigate={(nextPage: Page) => {
          if (nextPage === "investigate") {
            startInvestigation();
          }
          setPage(nextPage);
        }}
        selectedDatasetName={
          selectedASG?.datasetName ||
          (selectedDatasetId !== null ? `Dataset #${selectedDatasetId}` : null)
        }
        selectedASGTitle={selectedASG?.title}
      />

      <div className="app-main-content">
        <div className="page-content">

          {/* ==================================================
              HOME
          ================================================== */}

          {page === "home" && (
            <Home
              navigate={(nextPage: Page) => {
                if (nextPage === "investigate") {
                  startInvestigation();
                }
                setPage(nextPage);
              }}
            />
          )}

          {/* ==================================================
              DATA INGESTION
          ================================================== */}

          {page === "ingestion" && (
            <DataIngestion navigate={setPage} />
          )}

          {/* ==================================================
              INVESTIGATION
          ================================================== */}

          {page === "investigate" && (
            <Investigation
              navigate={(nextPage: Page) => {
                if (nextPage === "workspace") {
                  startInvestigation();
                }
                setPage(nextPage);
              }}
              setSelectedDatasetId={(id) => {
                setSelectedASG(null);
                setSelectedDatasetId(id);
              }}
            />
          )}

          {/* ==================================================
              INVESTIGATION WORKSPACE
          ================================================== */}

          {page === "workspace" && selectedDatasetId !== null && (
            <InvestigationWorkspace
              datasetId={selectedDatasetId}
              navigate={(nextPage: Page) => {
                setPage(nextPage);
              }}
              onFlagTrend={addASG}
              onUpdateASG={updateASG}
              findExistingASG={findExistingASG}
              initialASG={selectedASG}
            />
          )}

          {/* ==================================================
              ASGs
          ================================================== */}

          {page === "asgs" && (
            <Asgs
              navigate={setPage}
              asgs={asgs}
              deleteASG={deleteASG}
              updateASG={updateASG}
              onOpenASG={openASG}
              getASGEventCount={getASGEventCount}
              dynamicEventCounts={asgEventCounts}
            />
          )}

        </div>
      </div>
    </div>
  );
}

export default App;
