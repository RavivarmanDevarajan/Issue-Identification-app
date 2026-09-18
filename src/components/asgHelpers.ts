import type { ASGTrend } from "../App";

import type { FieldFilter } from "./filterTypes";

/* ======================================================
   ASG SIGNATURES

   Two ASGs describe the same issue when they flag the
   same dataset with the same set of filters.

   The signature is a canonical text form of that
   combination, so it can be compared directly.
====================================================== */

function normalizeText(
  value: unknown
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/*
  Canonical text for a single filter.

  Categorical values are sorted so that the same
  selection made in a different order still produces
  the same signature.
*/
function getFilterSignature(
  filter: FieldFilter
): string {
  const field =
    normalizeText(filter.field);

  switch (filter.filterType) {
    case "categorical": {
      const values = [
        ...(filter.values || []),
      ]
        .map(normalizeText)
        .sort()
        .join("|");

      return `categorical:${field}:${values}`;
    }

    case "numeric": {
      if (filter.operator === "between") {
        return `numeric:${field}:between:${filter.min}:${filter.max}`;
      }

      return `numeric:${field}:${
        filter.operator ?? ""
      }:${filter.value ?? ""}`;
    }

    case "date":
      return `date:${field}:${
        filter.from || ""
      }:${filter.to || ""}`;

    default:
      return `${filter.filterType}:${field}`;
  }
}

/*
  The dataset is identified by its logical name when
  there is one, so re-ingesting the same dataset does
  not hide an existing ASG behind a new dataset id.
*/
function getDatasetKey(
  datasetId?: number,
  datasetName?: string
): string {
  const name =
    normalizeText(datasetName);

  if (name) {
    return `name:${name}`;
  }

  return `id:${datasetId ?? "none"}`;
}

export function getASGSignature(
  datasetId: number | undefined,
  datasetName: string | undefined,
  filters: FieldFilter[] | undefined
): string {
  const parts = (filters || [])
    .map(getFilterSignature)
    .sort();

  return `${getDatasetKey(
    datasetId,
    datasetName
  )}::${parts.join("&&")}`;
}

/*
  Returns the existing ASG that already covers this
  dataset and filter combination, or null when the
  combination is new.

  ignoreId skips one ASG, so an ASG can be compared
  against every other ASG but not against itself.
*/
export function findDuplicateASG(
  asgs: ASGTrend[],
  datasetId: number | undefined,
  datasetName: string | undefined,
  filters: FieldFilter[] | undefined,
  ignoreId?: string
): ASGTrend | null {
  const signature =
    getASGSignature(
      datasetId,
      datasetName,
      filters
    );

  const match =
    asgs.find(
      (asg) =>
        asg.id !== ignoreId &&
        getASGSignature(
          asg.datasetId,
          asg.datasetName,
          asg.filters
        ) === signature
    );

  return match || null;
}
