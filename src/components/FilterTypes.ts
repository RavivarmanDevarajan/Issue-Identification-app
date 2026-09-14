/* ======================================================
   FILTER TYPES
====================================================== */

export type FilterType =
  | "categorical"
  | "numeric"
  | "date";

export type NumericOperator =
  | ">"
  | ">="
  | "<"
  | "<="
  | "="
  | "between";

export type DatePreset =
  | "custom"
  | "today"
  | "yesterday"
  | "last7days"
  | "last30days"
  | "thisMonth"
  | "lastMonth"
  | "thisYear";

/* ======================================================
   FIELD FILTER
====================================================== */

export interface FieldFilter {
  field: string;

  filterType: FilterType;

  /* -----------------------------
     CATEGORICAL
  ----------------------------- */

  values: string[];

  /* -----------------------------
     NUMERIC
  ----------------------------- */

  operator?: NumericOperator;

  value?: number;

  min?: number;

  max?: number;

  /* -----------------------------
     DATE
  ----------------------------- */

  preset?: DatePreset;

  from?: string;

  to?: string;
}

/* ======================================================
   SCHEMA TYPES
====================================================== */

export interface Column {
  name: string;
  type: string;
  ontologyMapping: string;
}

export interface SchemaResponse {
  datasetName: string;
  columns: Column[];

  timestampColumn: string;

  primaryKey: string;
}