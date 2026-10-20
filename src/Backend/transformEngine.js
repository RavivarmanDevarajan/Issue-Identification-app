/*
  Pure transform / extraction helpers.

  Kept independent of Express and SQLite so behaviour can be
  validated without standing up the full server.
*/

export function isBlankValue(value) {
  return (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  );
}

export function expandRawValues(rawVal) {
  if (Array.isArray(rawVal)) {
    return rawVal
      .map((item) => (item == null ? null : String(item).trim()))
      .filter((item) => item !== null && item !== "");
  }

  if (rawVal == null || rawVal === "") {
    return [];
  }

  if (typeof rawVal !== "string") {
    const text = String(rawVal).trim();
    return text ? [text] : [];
  }

  const text = rawVal.trim();
  if (!text) {
    return [];
  }

  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (item == null ? null : String(item).trim()))
          .filter((item) => item !== null && item !== "");
      }
    } catch {
      return text
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, "").trim())
        .filter(Boolean);
    }
  }

  return [text];
}

export function applyParseRule(value, parseRule) {
  if (value == null) {
    return [];
  }

  const text = String(value);
  if (!parseRule || !parseRule.type || parseRule.type === "none") {
    const trimmed = text.trim();
    return trimmed ? [trimmed] : [];
  }

  if (parseRule.type === "delimiter") {
    const delimiter = String(parseRule.delimiter ?? "");
    if (!delimiter) {
      const trimmed = text.trim();
      return trimmed ? [trimmed] : [];
    }

    const parts = text.split(delimiter);
    const partIndex = Number(parseRule.partIndex);

    if (!Number.isInteger(partIndex) || partIndex < 0 || partIndex >= parts.length) {
      return [];
    }

    const part = String(parts[partIndex] ?? "").trim();
    return part ? [part] : [];
  }

  const trimmed = text.trim();
  return trimmed ? [trimmed] : [];
}

export function mappingLookupKey(rawValue) {
  return String(rawValue ?? "").trim().toLowerCase();
}

export function applyStringMapper(records, config, mappingRows) {
  const {
    inputField,
    unmappedPolicy = "keep_raw",
    nullPolicy = "blank",
  } = config || {};

  const lookupMap = new Map();
  for (const row of mappingRows || []) {
    lookupMap.set(mappingLookupKey(row.raw_value), {
      raw: row.raw_value,
      refined: row.refined_value,
    });
  }

  const results = [];
  let mappedCount = 0;
  let unmappedCount = 0;
  let blankCount = 0;
  let changedCount = 0;
  let flaggedCount = 0;

  for (const record of records) {
    const rawInput = record?.[inputField];

    if (isBlankValue(rawInput)) {
      blankCount += 1;
      results.push({
        rawInput: rawInput == null ? null : rawInput,
        refinedOutput: nullPolicy === "blank" ? null : null,
        mappingFound: false,
        needsReview: false,
        isBlank: true,
      });
      continue;
    }

    const expanded = expandRawValues(rawInput);
    if (expanded.length === 0) {
      blankCount += 1;
      results.push({
        rawInput,
        refinedOutput: null,
        mappingFound: false,
        needsReview: false,
        isBlank: true,
      });
      continue;
    }

    const mappedParts = [];
    let allMapped = true;
    let anyMapped = false;

    for (const part of expanded) {
      const match = lookupMap.get(mappingLookupKey(part));
      if (match) {
        anyMapped = true;
        mappedParts.push(match.refined != null ? match.refined : match.raw);
      } else {
        allMapped = false;
        if (unmappedPolicy === "blank") {
          mappedParts.push(null);
        } else {
          mappedParts.push(part);
        }
      }
    }

    const refinedParts = mappedParts.filter((part) => part != null && part !== "");
    const originalWasArray = Array.isArray(rawInput);
    let refinedOutput;

    if (unmappedPolicy === "blank" && !allMapped && expanded.length === 1) {
      refinedOutput = null;
    } else if (originalWasArray) {
      refinedOutput = refinedParts;
    } else if (expanded.length === 1) {
      refinedOutput = mappedParts[0];
    } else {
      refinedOutput = refinedParts.join(", ");
    }

    const needsReview = unmappedPolicy === "flag_review" && !allMapped;
    if (needsReview) {
      flaggedCount += 1;
    }

    if (allMapped) {
      mappedCount += 1;
    } else {
      unmappedCount += 1;
    }

    const comparableRaw = originalWasArray
      ? expanded.join(", ")
      : String(rawInput).trim();
    const comparableOut = Array.isArray(refinedOutput)
      ? refinedOutput.join(", ")
      : refinedOutput == null
        ? ""
        : String(refinedOutput);

    if (comparableOut !== comparableRaw) {
      changedCount += 1;
    }

    results.push({
      rawInput,
      refinedOutput,
      mappingFound: anyMapped && allMapped,
      needsReview,
      isBlank: false,
    });
  }

  return {
    results,
    summary: {
      total: records.length,
      mapped: mappedCount,
      unmapped: unmappedCount,
      blank: blankCount,
      changed: changedCount,
      flagged: flaggedCount,
    },
  };
}

export function applyColumnCombiner(records, config) {
  const {
    field1,
    field2,
    separator = " - ",
    nullPolicy = "skip",
    mismatchPolicy = "flag_review",
    trimWhitespace = true,
    placeholder = "",
  } = config || {};

  const results = [];
  let recordsWithMissing = 0;
  let mismatchCount = 0;
  let successfullyCombined = 0;
  let reviewCount = 0;
  const mismatchRecords = [];

  for (const record of records) {
    const source1 = parseCombinerInput(record?.[field1], trimWhitespace);
    const source2 = parseCombinerInput(record?.[field2], trimWhitespace);
    const isBlank1 = source1.values.length === 0;
    const isBlank2 = source2.values.length === 0;

    let hasMissing = false;
    let outputVal;
    let listLengthMismatch = false;
    let needsReview = false;

    if (isBlank1 || isBlank2) {
      hasMissing = true;
      recordsWithMissing += 1;

      if (nullPolicy === "blank") {
        outputVal = null;
      } else if (nullPolicy === "placeholder") {
        const token = String(placeholder || "");
        const part1 = isBlank1 ? token : source1.values[0];
        const part2 = isBlank2 ? token : source2.values[0];
        outputVal = `${part1}${separator}${part2}`;
      } else {
        const parts = [];
        if (!isBlank1) parts.push(...source1.values);
        if (!isBlank2) parts.push(...source2.values);
        outputVal = parts.length > 0 ? parts.join(separator) : null;
      }
    } else {
      if (source1.values.length !== source2.values.length) {
        listLengthMismatch = true;
        mismatchCount += 1;
        mismatchRecords.push({
          recordIndex: results.length,
          recordId: record?._id ?? record?.id ?? null,
          firstLength: source1.values.length,
          secondLength: source2.values.length,
        });
        needsReview = mismatchPolicy === "flag_review";
        if (needsReview) reviewCount += 1;
        /* Safe default: never manufacture positional pairs from unequal lists. */
        outputVal = null;
      } else {
        const pairs = source1.values.map(
          (value, index) => `${value}${separator}${source2.values[index]}`
        );
        const shouldRemainList =
          source1.isList || source2.isList || pairs.length > 1;
        outputVal = shouldRemainList ? pairs : pairs[0];
        successfullyCombined += 1;
      }
    }

    results.push({
      field1Value: record?.[field1],
      field2Value: record?.[field2],
      separator,
      output: outputVal,
      hasMissing,
      listLengthMismatch,
      needsReview,
    });
  }

  return {
    results,
    summary: {
      total: records.length,
      combined: successfullyCombined,
      withMissing: recordsWithMissing,
      complete: records.length - recordsWithMissing,
      mismatched: mismatchCount,
      needsReview: reviewCount,
      mismatchRecords,
    },
  };
}

/* Preserve list structure and duplicates for positional transforms. */
export function parseCombinerInput(value, trimWhitespace = true) {
  const isList = Array.isArray(value) || (
    typeof value === "string" &&
    value.trim().startsWith("[") &&
    value.trim().endsWith("]")
  );
  const values = expandRawValues(value).map((item) =>
    trimWhitespace ? String(item).trim() : String(item)
  ).filter((item) => item !== "");
  return { values, isList };
}
