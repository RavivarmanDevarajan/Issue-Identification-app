import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import Papa from "papaparse";
import path from "path";
import { fileURLToPath } from "url";
import {
  expandRawValues,
  applyParseRule,
  applyStringMapper,
  applyColumnCombiner,
} from "./transformEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

/* =======================================================
   DATABASE
======================================================= */

const dbPath = process.env.DB_PATH || path.join(__dirname, "database.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

console.log("SQLite Connected at:", dbPath);

/* =======================================================
   TABLE
======================================================= */

db.prepare(`
  CREATE TABLE IF NOT EXISTS datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT,
    dataset_name TEXT,
    data_type TEXT,
    parent_dataset_id INTEGER,
    status TEXT,
    size_kb REAL,
    ingestion_time_ms INTEGER,
    schema_json TEXT,
    data_json TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

/* =======================================================
   DATASET VIEW PREFERENCES
======================================================= */

db.prepare(`
  CREATE TABLE IF NOT EXISTS dataset_view_preferences (
    dataset_id INTEGER PRIMARY KEY,
    field_settings_json TEXT NOT NULL DEFAULT '{}',
    chart_settings_json TEXT NOT NULL DEFAULT '{}',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

/* =======================================================
   DATABASE MIGRATION
======================================================= */

const datasetColumns =
  db.prepare(`
    PRAGMA table_info(datasets)
  `).all();

const hasParentDatasetId =
  datasetColumns.some(
    (column) =>
      column.name === "parent_dataset_id"
  );

if (!hasParentDatasetId) {

  console.log(
    "Adding parent_dataset_id column to datasets table..."
  );

  db.prepare(`
    ALTER TABLE datasets
    ADD COLUMN parent_dataset_id INTEGER
  `).run();

  console.log(
    "parent_dataset_id column added successfully"
  );
}

/*
  Datasets can be refreshed with a newer file after
  the schema has been defined once, so the time of the
  most recent refresh is tracked separately from the
  original upload time.
*/

const hasLastRefreshedAt =
  datasetColumns.some(
    (column) =>
      column.name === "last_refreshed_at"
  );

if (!hasLastRefreshedAt) {

  console.log(
    "Adding last_refreshed_at column to datasets table..."
  );

  db.prepare(`
    ALTER TABLE datasets
    ADD COLUMN last_refreshed_at DATETIME
  `).run();

  console.log(
    "last_refreshed_at column added successfully"
  );
}

const hasUpdatedAt =
  datasetColumns.some(
    (column) =>
      column.name === "updated_at"
  ) ||
  db.prepare(`PRAGMA table_info(datasets)`).all().some(
    (column) => column.name === "updated_at"
  );

if (!hasUpdatedAt) {
  console.log("Adding updated_at column to datasets table...");
  db.prepare(`
    ALTER TABLE datasets
    ADD COLUMN updated_at DATETIME
  `).run();
  console.log("updated_at column added successfully");
}

/* =======================================================
   TAXONOMY, TRANSFORM & APP ATTRIBUTE TABLES
======================================================= */

db.prepare(`
  CREATE TABLE IF NOT EXISTS taxonomies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    version INTEGER NOT NULL DEFAULT 1,
    layers_json TEXT NOT NULL DEFAULT '[]',
    sources_json TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS taxonomy_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    taxonomy_id INTEGER NOT NULL,
    layer_index INTEGER NOT NULL,
    source_dataset_id INTEGER NOT NULL,
    source_field TEXT NOT NULL,
    raw_value TEXT NOT NULL,
    refined_value TEXT,
    review_status TEXT NOT NULL DEFAULT 'unreviewed',
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(taxonomy_id, layer_index, source_dataset_id, source_field, raw_value),
    FOREIGN KEY(taxonomy_id) REFERENCES taxonomies(id) ON DELETE CASCADE
  )
`).run();

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_taxonomy_mappings_taxonomy_id
  ON taxonomy_mappings(taxonomy_id)
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS transform_functions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    function_type TEXT NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    output_dataset_id INTEGER,
    output_attribute_name TEXT,
    execution_status TEXT NOT NULL DEFAULT 'pending',
    last_executed_at DATETIME,
    taxonomy_version_at_execution INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS app_attributes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id INTEGER NOT NULL,
    attribute_name TEXT NOT NULL,
    transform_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dataset_id, attribute_name)
  )
`).run();

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_app_attributes_dataset_id
  ON app_attributes(dataset_id)
`).run();

/* =======================================================
   DATASET VIEW PREFERENCES API
======================================================= */

app.get(
  "/datasets/:id/view-preferences",
  (req, res) => {
    try {
      const datasetId = Number(req.params.id);

      if (!Number.isInteger(datasetId)) {
        return res.status(400).json({ error: "Invalid dataset id" });
      }

      const preference = db.prepare(`
        SELECT field_settings_json, chart_settings_json
        FROM dataset_view_preferences
        WHERE dataset_id = ?
      `).get(datasetId);

      return res.json({
        fieldSettings: preference
          ? JSON.parse(preference.field_settings_json)
          : {},
        chartSettings: preference
          ? JSON.parse(preference.chart_settings_json)
          : {},
      });
    } catch (error) {
      console.error("Load dataset view preferences error:", error);
      return res.status(500).json({ error: "Failed to load view preferences" });
    }
  }
);

app.put(
  "/datasets/:id/view-preferences",
  (req, res) => {
    try {
      const datasetId = Number(req.params.id);
      const { fieldSettings = {}, chartSettings = {} } = req.body || {};

      if (!Number.isInteger(datasetId)) {
        return res.status(400).json({ error: "Invalid dataset id" });
      }

      if (
        !fieldSettings ||
        typeof fieldSettings !== "object" ||
        Array.isArray(fieldSettings) ||
        !chartSettings ||
        typeof chartSettings !== "object" ||
        Array.isArray(chartSettings)
      ) {
        return res.status(400).json({ error: "Invalid view preferences" });
      }

      db.prepare(`
        INSERT INTO dataset_view_preferences (
          dataset_id,
          field_settings_json,
          chart_settings_json,
          updated_at
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(dataset_id) DO UPDATE SET
          field_settings_json = excluded.field_settings_json,
          chart_settings_json = excluded.chart_settings_json,
          updated_at = CURRENT_TIMESTAMP
      `).run(
        datasetId,
        JSON.stringify(fieldSettings),
        JSON.stringify(chartSettings)
      );

      return res.json({ success: true });
    } catch (error) {
      console.error("Save dataset view preferences error:", error);
      return res.status(500).json({ error: "Failed to save view preferences" });
    }
  }
);

/* =======================================================
   ASGs TABLE
======================================================= */

db.prepare(`
  CREATE TABLE IF NOT EXISTS asgs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asg_number TEXT UNIQUE,
    title TEXT,
    category TEXT,
    dataset_id INTEGER,
    dataset_name TEXT,
    date_by TEXT,
    color_by TEXT,
    event_count INTEGER,
    filters_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

function nextAsgNumber() {
  const latest =
    db.prepare(`
      SELECT asg_number
      FROM asgs
      ORDER BY id DESC
      LIMIT 1
    `).get();

  let next = 1;

  if (latest?.asg_number) {
    const match =
      String(latest.asg_number)
        .match(/C-(\d+)/i);

    if (match) {
      next = Number(match[1]) + 1;
    }
  }

  return `C-${String(next).padStart(2, "0")}`;
}

/* =======================================================
   COLUMN TYPE HELPERS
======================================================= */

function isDateColumn(column) {

  if (!column) {
    return false;
  }

  const type =
    String(
      column.type || ""
    ).toLowerCase();

  return (
    type.includes("date") ||
    type.includes("time") ||
    type.includes("timestamp")
  );
}

function isNumericColumn(column) {

  if (!column) {
    return false;
  }

  const type =
    String(
      column.type || ""
    ).toLowerCase();

  return (
    type.includes("number") ||
    type.includes("integer") ||
    type.includes("float") ||
    type.includes("double") ||
    type.includes("decimal")
  );
}

function isCategoricalColumn(column) {

  if (!column) {
    return false;
  }

  return (
    !isDateColumn(column) &&
    !isNumericColumn(column)
  );
}

/* =======================================================
   DATE PARSER
======================================================= */

function parseDateValue(value) {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {

    return null;
  }

  const text =
    String(value).trim();

  /* ---------------------------------------------------
     Standard / ISO date formats
  --------------------------------------------------- */

  let date =
    new Date(text);

  if (
    !Number.isNaN(
      date.getTime()
    )
  ) {

    return date;
  }

  /* ---------------------------------------------------
     DD/MM/YYYY
  --------------------------------------------------- */

  const slashParts =
    text.split("/");

  if (
    slashParts.length === 3
  ) {

    const day =
      slashParts[0];

    const month =
      slashParts[1];

    const year =
      slashParts[2];

    date =
      new Date(
        `${year}-${month}-${day}`
      );

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {

      return date;
    }
  }

  /* ---------------------------------------------------
     DD-MM-YYYY
  --------------------------------------------------- */

  const dashParts =
    text.split("-");

  if (
    dashParts.length === 3 &&
    dashParts[0].length <= 2
  ) {

    const day =
      dashParts[0];

    const month =
      dashParts[1];

    const year =
      dashParts[2];

    date =
      new Date(
        `${year}-${month}-${day}`
      );

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {

      return date;
    }
  }

  return null;
}

/* =======================================================
   ID HELPERS
======================================================= */

/*
  IMPORTANT:

  The Raw and Tagged datasets do NOT need to have
  the same column name for their _id.

  Example:

  Raw:
    Complaint ID -> ontologyMapping: "_id"

  Tagged:
    Event Id -> ontologyMapping: "_id"

  The system uses ontologyMapping to identify the
  logical ID column.
*/

/* -------------------------------------------------------
   GET _id COLUMN
------------------------------------------------------- */

function getIdColumn(schema) {

  if (!Array.isArray(schema)) {

    return {
      column: null,
      error: "Schema must be an array"
    };
  }

  const idColumns =
    schema.filter(
      (column) =>
        String(
          column?.ontologyMapping || ""
        ).trim() === "_id"
    );

  if (idColumns.length === 0) {

    return {
      column: null,
      error:
        'No column is mapped to "_id". Please map exactly one column to _id.'
    };
  }

  if (idColumns.length > 1) {

    return {
      column: null,
      error:
        'Multiple columns are mapped to "_id". Only one _id column is allowed.'
    };
  }

  return {
    column: idColumns[0],
    error: null
  };
}

/* -------------------------------------------------------
   NORMALIZE ID
------------------------------------------------------- */

function normalizeIdValue(value) {

  if (
    value === undefined ||
    value === null
  ) {

    return null;
  }

  /*
    IDs must be scalar values.

    Arrays / objects are not valid IDs.
  */

  if (
    typeof value === "object"
  ) {

    return null;
  }

  const normalized =
    String(value).trim();

  if (
    normalized === ""
  ) {

    return null;
  }

  return normalized;
}

/* -------------------------------------------------------
   VALIDATE DATASET IDS
------------------------------------------------------- */

/*
  Checks:

  1. Every record has an _id
  2. No duplicate _id values exist
  3. Returns normalized IDs for further validation
*/

function validateDatasetIds(
  data,
  idColumnName
) {

  const seen =
    new Map();

  const duplicateIds =
    new Set();

  const blankRows = [];

  const normalizedIds = [];

  data.forEach(
    (row, index) => {

      const rawValue =
        row?.[idColumnName];

      const normalizedId =
        normalizeIdValue(
          rawValue
        );

      if (
        normalizedId === null
      ) {

        blankRows.push(
          index + 1
        );

        normalizedIds.push(
          null
        );

        return;
      }

      normalizedIds.push(
        normalizedId
      );

      if (
        seen.has(
          normalizedId
        )
      ) {

        duplicateIds.add(
          normalizedId
        );

      } else {

        seen.set(
          normalizedId,
          index + 1
        );
      }

    }
  );

  return {

    valid:
      blankRows.length === 0 &&
      duplicateIds.size === 0,

    duplicateIds:
      Array.from(
        duplicateIds
      ),

    blankRows,

    normalizedIds,

  };
}

/* -------------------------------------------------------
   FORMAT ID VALIDATION ERROR
------------------------------------------------------- */

function buildIdValidationMessage(
  idColumnName,
  validation
) {

  const messages = [];

  if (
    validation.blankRows.length > 0
  ) {

    const rows =
      validation.blankRows
        .slice(0, 10)
        .join(", ");

    const suffix =
      validation.blankRows.length > 10
        ? "..."
        : "";

    messages.push(
      `Blank/null _id values found in ${idColumnName} at row(s): ${rows}${suffix}.`
    );
  }

  if (
    validation.duplicateIds.length > 0
  ) {

    const ids =
      validation.duplicateIds
        .slice(0, 20)
        .join(", ");

    const suffix =
      validation.duplicateIds.length > 20
        ? "..."
        : "";

    messages.push(
      `Duplicate _id values found in ${idColumnName}: ${ids}${suffix}.`
    );
  }

  return messages.join(" ");
}

/* =======================================================
   UPLOAD DATASET
======================================================= */

app.post(
  "/upload",
  (req, res) => {

    try {

      const start =
        Date.now();

      const {
        fileName,
        datasetName,
        ingestionType,
        schema,
        data,
        parentDatasetId,
      } = req.body;

      /* -------------------------------------------------
         VALIDATE INGESTION TYPE
      ------------------------------------------------- */

      const normalizedIngestionType =
        String(
          ingestionType || ""
        )
          .trim()
          .toLowerCase();

      if (
        normalizedIngestionType !== "raw" &&
        normalizedIngestionType !== "tagged"
      ) {

        return res.status(
          400
        ).json({

          success: false,

          message:
            "ingestionType must be either 'raw' or 'tagged",

        });
      }

      /* -------------------------------------------------
         VALIDATE DATASET NAME
      ------------------------------------------------- */

      if (
        !datasetName ||
        !String(
          datasetName
        ).trim()
      ) {

        return res.status(
          400
        ).json({

          success: false,

          message:
            "Dataset name is required",

        });
      }

      /* -------------------------------------------------
         VALIDATE SCHEMA
      ------------------------------------------------- */

      if (
        !Array.isArray(schema)
      ) {

        return res.status(
          400
        ).json({

          success: false,

          message:
            "Schema must be an array",

        });
      }

      /* -------------------------------------------------
         VALIDATE DATA
      ------------------------------------------------- */

      if (
        !Array.isArray(data)
      ) {

        return res.status(
          400
        ).json({

          success: false,

          message:
            "Data must be an array",

        });
      }

      /* =================================================
         _id VALIDATION
      ================================================= */

      const idColumnResult =
        getIdColumn(
          schema
        );

      if (
        idColumnResult.error
      ) {

        return res.status(
          400
        ).json({

          success: false,

          message:
            idColumnResult.error,

        });
      }

      const idColumn =
        idColumnResult.column.name;

      /* -------------------------------------------------
         CHECK BLANK + DUPLICATE IDs
      ------------------------------------------------- */

      const idValidation =
        validateDatasetIds(
          data,
          idColumn
        );

      if (
        !idValidation.valid
      ) {

        return res.status(
          400
        ).json({

          success: false,

          errorType:
            "INVALID_ID_VALUES",

          message:
            buildIdValidationMessage(
              idColumn,
              idValidation
            ),

          idColumn,

          duplicateIds:
            idValidation.duplicateIds,

          blankRows:
            idValidation.blankRows,

        });
      }

      /* =================================================
         PARENT DATASET
         
         Only Tagged Data may have a parent.
      ================================================= */

      let normalizedParentDatasetId =
        null;

      let parentDataset =
        null;

      if (
        normalizedIngestionType === "tagged"
      ) {

        if (
          parentDatasetId === null ||
          parentDatasetId === undefined ||
          parentDatasetId === ""
        ) {

          return res.status(
            400
          ).json({

            success: false,

            message:
              "Tagged Data requires a parent Raw dataset",

          });
        }

        normalizedParentDatasetId =
          Number(
            parentDatasetId
          );

        if (
          !Number.isInteger(
            normalizedParentDatasetId
          )
        ) {

          return res.status(
            400
          ).json({

            success: false,

            message:
              "Invalid parentDatasetId",

          });
        }

        /* ---------------------------------------------
           Check parent exists
        --------------------------------------------- */

        parentDataset =
          db.prepare(`
            SELECT
              id,
              dataset_name,
              data_type,
              schema_json,
              data_json
            FROM datasets
            WHERE id = ?
          `).get(
            normalizedParentDatasetId
          );

        if (!parentDataset) {

          return res.status(
            404
          ).json({

            success: false,

            message:
              "Parent Raw dataset not found",

          });
        }

        /* ---------------------------------------------
           Parent must be Raw
        --------------------------------------------- */

        if (
          String(
            parentDataset.data_type || ""
          ).toLowerCase() !== "raw"
        ) {

          return res.status(
            400
          ).json({

            success: false,

            message:
              "A Tagged dataset can only be linked to a Raw dataset",

          });
        }

        /* =================================================
           OPTION B — EVERY TAGGED _id MUST EXIST IN RAW
        ================================================= */

        let parentSchema = [];
        let parentData = [];

        try {

          parentSchema =
            JSON.parse(
              parentDataset.schema_json ||
              "[]"
            );

        } catch {

          return res.status(
            400
          ).json({

            success: false,

            message:
              "Parent Raw dataset contains invalid schema data",

          });
        }

        try {

          parentData =
            JSON.parse(
              parentDataset.data_json ||
              "[]"
            );

        } catch {

          return res.status(
            400
          ).json({

            success: false,

            message:
              "Parent Raw dataset contains invalid data",

          });
        }

        /* ---------------------------------------------
           Find Raw _id column
        --------------------------------------------- */

        const rawIdColumnResult =
          getIdColumn(
            parentSchema
          );

        if (
          rawIdColumnResult.error
        ) {

          return res.status(
            400
          ).json({

            success: false,

            message:
              `Parent Raw dataset is invalid: ${rawIdColumnResult.error}`,

          });
        }

        const rawIdColumn =
          rawIdColumnResult.column.name;

        /* ---------------------------------------------
           Validate parent Raw IDs

           This protects against old datasets that may
           have been uploaded before duplicate validation
           was introduced.
        --------------------------------------------- */

        const rawIdValidation =
          validateDatasetIds(
            parentData,
            rawIdColumn
          );

        if (
          !rawIdValidation.valid
        ) {

          return res.status(
            400
          ).json({

            success: false,

            errorType:
              "INVALID_PARENT_RAW_IDS",

            message:
              `The parent Raw dataset cannot be used because its _id values are invalid. ${buildIdValidationMessage(
                rawIdColumn,
                rawIdValidation
              )}`,

            rawIdColumn,

            duplicateIds:
              rawIdValidation.duplicateIds,

            blankRows:
              rawIdValidation.blankRows,

          });
        }

        /* ---------------------------------------------
           Build Raw ID lookup
        --------------------------------------------- */

        const rawIdSet =
          new Set(
            rawIdValidation.normalizedIds
          );

        /* ---------------------------------------------
           Find Tagged IDs that do not exist in Raw
        --------------------------------------------- */

        const missingTaggedIds =
          [];

        const seenMissingIds =
          new Set();

        idValidation.normalizedIds.forEach(
          (taggedId) => {

            if (
              taggedId === null
            ) {

              return;
            }

            if (
              !rawIdSet.has(
                taggedId
              ) &&
              !seenMissingIds.has(
                taggedId
              )
            ) {

              missingTaggedIds.push(
                taggedId
              );

              seenMissingIds.add(
                taggedId
              );
            }

          }
        );

        if (
          missingTaggedIds.length > 0
        ) {

          const displayedIds =
            missingTaggedIds
              .slice(0, 20)
              .join(", ");

          const suffix =
            missingTaggedIds.length > 20
              ? "..."
              : "";

          return res.status(
            400
          ).json({

            success: false,

            errorType:
              "TAGGED_ID_NOT_FOUND_IN_RAW",

            message:
              `Every Tagged _id must exist in the parent Raw dataset. The following Tagged IDs were not found in Raw: ${displayedIds}${suffix}`,

            rawIdColumn,

            taggedIdColumn:
              idColumn,

            missingTaggedIds,

          });
        }

        /* ---------------------------------------------
           IMPORTANT:

           Raw and Tagged column names are allowed to
           differ.

           Example:

             Raw    -> Complaint ID
             Tagged -> Event Id

           Both simply map to ontologyMapping "_id".
        --------------------------------------------- */

      }

      /* -------------------------------------------------
         RAW DATA MUST NOT HAVE A PARENT
      ------------------------------------------------- */

      if (
        normalizedIngestionType === "raw"
      ) {

        normalizedParentDatasetId =
          null;
      }

      /* -------------------------------------------------
         SIZE
      ------------------------------------------------- */

      const sizeKB =
        Buffer.byteLength(
          JSON.stringify(
            data
          )
        ) / 1024;

      /* -------------------------------------------------
         INGESTION TIME
      ------------------------------------------------- */

      const ingestionTime =
        Date.now() - start;

      /* -------------------------------------------------
         INSERT
      ------------------------------------------------- */

      const stmt =
        db.prepare(`
          INSERT INTO datasets (
            file_name,
            dataset_name,
            data_type,
            parent_dataset_id,
            status,
            size_kb,
            ingestion_time_ms,
            schema_json,
            data_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

      const result =
        stmt.run(

          fileName || null,

          String(
            datasetName
          ).trim(),

          normalizedIngestionType,

          normalizedParentDatasetId,

          "Completed",

          sizeKB,

          ingestionTime,

          JSON.stringify(
            schema
          ),

          JSON.stringify(
            data
          )

        );

      /* -------------------------------------------------
         RESPONSE
      ------------------------------------------------- */

      res.json({

        success: true,

        message:
          normalizedIngestionType === "tagged"
            ? "Tagged dataset uploaded successfully and linked to the Raw dataset"
            : "Raw dataset uploaded successfully",

        datasetId:
          result.lastInsertRowid,

        datasetName:
          String(
            datasetName
          ).trim(),

        ingestionType:
          normalizedIngestionType,

        parentDatasetId:
          normalizedParentDatasetId,

        idColumn,

      });

    } catch (error) {

      console.error(
        "Upload error:",
        error
      );

      res.status(
        500
      ).json({

        success: false,

        message:
          "Failed to upload dataset",

      });
    }
  }
);
/* =======================================================
   REFRESH HELPERS
======================================================= */

/*
  The headers of a dataset.

  Records are stored exactly as they were parsed from
  the file, so the stored records are the source of
  truth for the headers. The schema column names are
  used only when a dataset holds no records yet.
*/

function getDatasetHeaders(
  records,
  schema
) {

  if (
    Array.isArray(records) &&
    records.length > 0 &&
    records[0] &&
    typeof records[0] === "object"
  ) {

    return Object.keys(
      records[0]
    );
  }

  if (Array.isArray(schema)) {

    return schema.map(
      (column) =>
        String(column?.name || "")
    );
  }

  return [];
}

/*
  Compares the headers of an incoming file against the
  headers already defined for the dataset.

  Order is ignored. Missing and unexpected headers are
  reported separately so the message can say which
  side of the comparison is wrong.
*/

function compareHeaders(
  existingHeaders,
  incomingHeaders
) {

  const existingSet =
    new Set(existingHeaders);

  const incomingSet =
    new Set(incomingHeaders);

  const missingColumns =
    existingHeaders.filter(
      (header) =>
        !incomingSet.has(header)
    );

  const unexpectedColumns =
    incomingHeaders.filter(
      (header) =>
        !existingSet.has(header)
    );

  return {
    matches:
      missingColumns.length === 0 &&
      unexpectedColumns.length === 0,

    missingColumns,

    unexpectedColumns,
  };
}

function buildHeaderMismatchMessage(
  comparison
) {

  const messages = [];

  if (
    comparison.missingColumns.length > 0
  ) {

    messages.push(
      `Missing column(s): ${comparison.missingColumns
        .slice(0, 10)
        .join(", ")}${comparison.missingColumns.length > 10
        ? "..."
        : ""
      }.`
    );
  }

  if (
    comparison.unexpectedColumns.length > 0
  ) {

    messages.push(
      `Unexpected column(s): ${comparison.unexpectedColumns
        .slice(0, 10)
        .join(", ")}${comparison.unexpectedColumns.length > 10
        ? "..."
        : ""
      }.`
    );
  }

  return `The file headers do not match the dataset schema. ${messages.join(
    " "
  )}`;
}

/* =======================================================
   REFRESH VALUE NORMALIZATION
======================================================= */

/*
  Refresh files can contain list-valued columns in
  different textual representations.

  Examples:

    ["Bat","Handle"]
    ['Bat','Handle']
    [Bat, Handle]
    Bat, Handle
    Bat

  The original dataset schema is authoritative.

  If a column is defined as a list in the stored schema,
  its value is always converted to an actual JavaScript
  array before the refreshed records are stored.

  Duplicate list values (e.g. multiple identical failure
  components on a complaint) are preserved to match the input
  data as reflected during initial upload.

  This prevents the same Tagged dataset from containing:

    ["Bat", "Handle"]

  in some records and:

    "[\"Bat\", \"Handle\"]"

  in others.
*/

function parseListValueForRefresh(
  value
) {

  if (
    Array.isArray(value)
  ) {

    return value
      .flatMap(
        (item) =>
          parseListValueForRefresh(
            item
          )
      )
      .map(
        (item) =>
          String(item).trim()
      )
      .filter(
        (item) =>
          item !== ""
      );
  }

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {

    return [];
  }

  const text =
    String(value).trim();

  if (
    text === ""
  ) {

    return [];
  }

  /* ---------------------------------------------------
     JSON array
  --------------------------------------------------- */

  if (
    text.startsWith("[") &&
    text.endsWith("]")
  ) {

    try {

      const parsed =
        JSON.parse(text);

      if (
        Array.isArray(parsed)
      ) {

        return parsed
          .flatMap(
            (item) =>
              parseListValueForRefresh(
                item
              )
          )
          .map(
            (item) =>
              String(item).trim()
          )
          .filter(
            (item) =>
              item !== ""
          );
      }

    } catch {
      /* Continue with Python-style parsing below. */
    }

    /* -------------------------------------------------
       Python-style list

       Example:

         ['Bat', 'Handle']

    ------------------------------------------------- */

    const inner =
      text
        .slice(
          1,
          -1
        )
        .trim();

    if (
      inner === ""
    ) {

      return [];
    }

    const quotedMatches =
      inner.match(
        /'(?:\\'|[^'])*'|"(?:\\"|[^"])*"/g
      );

    if (
      quotedMatches &&
      quotedMatches.length > 0
    ) {
      return quotedMatches
        .map(
          (item) =>
            item
              .replace(
                /^['"]|['"]$/g,
                ""
              )
              .trim()
        )
        .filter(
          (item) =>
            item !== ""
        );
    }

    return inner
      .split(",")
      .map(
        (item) =>
          item
            .trim()
            .replace(
              /^['"]|['"]$/g,
              ""
            )
            .trim()
      )
      .filter(
        (item) =>
          item !== ""
      );
  }

  /* ---------------------------------------------------
     Comma-separated list
  --------------------------------------------------- */

  if (
    text.includes(",")
  ) {

    return text
      .split(",")
      .map(
        (item) =>
          item.trim()
      )
      .filter(
        (item) =>
          item !== ""
      );
  }

  /* ---------------------------------------------------
     Single list value
  --------------------------------------------------- */

  return [
    text
  ];
}

function isListSchemaColumn(
  column
) {

  const type =
    String(
      column?.type || ""
    )
      .trim()
      .toLowerCase();

  return (
    type === "list" ||
    type.includes("array") ||
    type.includes("list")
  );
}

function normalizeRecordToSchema(
  record,
  schema
) {

  if (
    !record ||
    typeof record !== "object" ||
    Array.isArray(record) ||
    !Array.isArray(schema)
  ) {

    return record;
  }

  const normalized = {
    ...record,
  };

  schema.forEach(
    (column) => {

      if (
        !column?.name ||
        column?.isAppAttribute ||
        !isListSchemaColumn(
          column
        )
      ) {

        return;
      }

      normalized[column.name] =
        parseListValueForRefresh(
          normalized[column.name]
        );
    }
  );

  return normalized;
}

function normalizeRecordsToSchema(
  records,
  schema
) {

  if (
    !Array.isArray(records)
  ) {

    return [];
  }

  return records.map(
    (record) =>
      normalizeRecordToSchema(
        record,
        schema
      )
  );
}

/* =======================================================
   REFRESH DATASET

   Adds new events and overwrites existing events of a
   dataset that already has a schema.

   The schema is defined once, at the original upload.
   A refresh only requires that the incoming file has
   the same headers.

   Records are matched on the column mapped to "_id":

     known _id    -> the stored record is replaced
     unknown _id  -> the record is appended

   Nothing is ever deleted, so Tagged datasets that
   reference this dataset stay valid.

   Passing validateOnly returns the same counts without
   writing anything, which lets the UI preview the
   result before it is committed.
======================================================= */

app.post(
  "/datasets/:id/refresh",
  (req, res) => {

    try {

      const start =
        Date.now();

      const {
        id,
      } = req.params;

      const {
        fileName,
        data,
        validateOnly,
      } = req.body;

      const isValidateOnly =
        validateOnly === true;

      /* -------------------------------------------------
         VALIDATE DATA
      ------------------------------------------------- */

      if (
        !Array.isArray(data)
      ) {

        return res.status(
          400
        ).json({

          success: false,

          message:
            "Data must be an array",

        });
      }

      if (
        data.length === 0
      ) {

        return res.status(
          400
        ).json({

          success: false,

          message:
            "The file contains no records",

        });
      }

      /* -------------------------------------------------
         LOAD DATASET
      ------------------------------------------------- */

      const dataset =
        db.prepare(`
          SELECT
            id,
            dataset_name,
            data_type,
            parent_dataset_id,
            schema_json,
            data_json
          FROM datasets
          WHERE id = ?
        `).get(id);

      if (!dataset) {

        return res.status(
          404
        ).json({

          success: false,

          message:
            "Dataset not found",

        });
      }

      let schema = [];
      let existingData = [];

      try {

        schema =
          JSON.parse(
            dataset.schema_json ||
            "[]"
          );

      } catch {

        return res.status(
          400
        ).json({

          success: false,

          message:
            "The dataset contains invalid schema data",

        });
      }

      try {

        existingData =
          JSON.parse(
            dataset.data_json ||
            "[]"
          );

      } catch {

        return res.status(
          400
        ).json({

          success: false,

          message:
            "The dataset contains invalid record data",

        });
      }

      /* -------------------------------------------------
         APP ATTRIBUTE COLUMNS

         Generated fields are not part of the original
         CSV schema. Refresh files must still match the
         original custom attributes even when App
         Attributes already exist on stored records.
      ------------------------------------------------- */

      const appAttrRows =
        db.prepare(`
          SELECT attribute_name, transform_id
          FROM app_attributes
          WHERE dataset_id = ?
        `).all(dataset.id);

      const appAttrNames = new Set(
        appAttrRows.map((row) => row.attribute_name)
      );

      if (Array.isArray(schema)) {
        schema.forEach((column) => {
          if (column?.isAppAttribute && column.name) {
            appAttrNames.add(column.name);
          }
        });
      }

      /* -------------------------------------------------
         HEADERS AND SCHEMA EVOLUTION

         Existing source columns must be present so an
         update cannot accidentally erase data. Extra
         CSV headers are accepted and added to the stored
         schema; existing rows receive those new columns
         through normalisation and incoming rows carry
         their uploaded values.

         App Attribute columns are ignored on both sides
         because they are generated by transforms, not by
         an uploaded CSV.
      ------------------------------------------------- */

      /* -------------------------------------------------
         _id COLUMN
      ------------------------------------------------- */

      const idColumnResult =
        getIdColumn(
          schema
        );

      if (
        idColumnResult.error
      ) {

        return res.status(
          400
        ).json({

          success: false,

          message:
            `The dataset schema is invalid: ${idColumnResult.error}`,

        });
      }

      const idColumn =
        idColumnResult.column.name;

      const existingHeaders =
        getDatasetHeaders(
          existingData,
          schema
        ).filter(
          (header) => !appAttrNames.has(header)
        );

      const incomingHeaders =
        getDatasetHeaders(
          data,
          null
        ).filter(
          (header) => !appAttrNames.has(header)
        );

      const missingColumns =
        existingHeaders.filter(
          (header) => !incomingHeaders.includes(header)
        );

      const addedColumns =
        incomingHeaders.filter(
          (header) => !existingHeaders.includes(header)
        );

      /* The incoming file MUST contain the dataset ID column */
      if (!incomingHeaders.includes(idColumn)) {

        return res.status(
          400
        ).json({

          success: false,

          errorType:
            "HEADER_MISMATCH",

          message:
            `The upload is missing the required dataset ID column '${idColumn}'. Include the ID column to match and update records.`,

          expectedHeaders:
            existingHeaders,

          receivedHeaders:
            incomingHeaders,

          missingColumns:
            [idColumn],

          unexpectedColumns:
            [],

        });
      }

      const updatedSchema = Array.isArray(schema)
        ? [...schema]
        : [];

      const clientSchema = Array.isArray(req.body.schema) ? req.body.schema : [];

      addedColumns.forEach((columnName) => {
        const clientCol = clientSchema.find((c) => c && c.name === columnName);
        const looksLikeList = clientCol?.type === "list" || data.some((row) => {
          const value = row?.[columnName];
          if (Array.isArray(value)) return true;
          const text = String(value ?? "").trim();
          return text.startsWith("[") && text.endsWith("]");
        });

        updatedSchema.push({
          name: columnName,
          type: clientCol?.type || (looksLikeList ? "list" : "string"),
          ontologyMapping: clientCol?.ontologyMapping || "",
          include: true,
        });
      });

      /* -------------------------------------------------
         NORMALIZE RECORDS TO THE STORED SCHEMA

         The original schema remains authoritative. In
         particular, list columns are converted back to
         arrays before ID validation and merging. Existing
         records are normalized as well so a previous
         refresh cannot leave mixed list representations
         in the dataset.
      ------------------------------------------------- */

      const normalizedExistingData =
        normalizeRecordsToSchema(
          existingData,
          updatedSchema
        );

      const normalizedIncomingData =
        normalizeRecordsToSchema(
          data,
          updatedSchema
        );

      /* -------------------------------------------------
         INCOMING IDs MUST BE PRESENT AND UNIQUE
      ------------------------------------------------- */

      const idValidation =
        validateDatasetIds(
          normalizedIncomingData,
          idColumn
        );

      if (
        !idValidation.valid
      ) {

        return res.status(
          400
        ).json({

          success: false,

          errorType:
            "INVALID_ID_VALUES",

          message:
            buildIdValidationMessage(
              idColumn,
              idValidation
            ),

          idColumn,

          duplicateIds:
            idValidation.duplicateIds,

          blankRows:
            idValidation.blankRows,

        });
      }

      /* -------------------------------------------------
         TAGGED DATA STILL NEEDS A MATCHING RAW ROW

         A refresh can introduce new Tagged events, and
         those must reference an event that exists in
         the parent Raw dataset.
      ------------------------------------------------- */

      if (
        String(
          dataset.data_type || ""
        ).toLowerCase() === "tagged"
      ) {

        const parentDataset =
          db.prepare(`
            SELECT
              id,
              schema_json,
              data_json
            FROM datasets
            WHERE id = ?
          `).get(
            dataset.parent_dataset_id
          );

        if (!parentDataset) {

          return res.status(
            404
          ).json({

            success: false,

            message:
              "Parent Raw dataset not found",

          });
        }

        let parentSchema = [];
        let parentData = [];

        try {

          parentSchema =
            JSON.parse(
              parentDataset.schema_json ||
              "[]"
            );

          parentData =
            JSON.parse(
              parentDataset.data_json ||
              "[]"
            );

        } catch {

          return res.status(
            400
          ).json({

            success: false,

            message:
              "Parent Raw dataset contains invalid data",

          });
        }

        const rawIdColumnResult =
          getIdColumn(
            parentSchema
          );

        if (
          rawIdColumnResult.error
        ) {

          return res.status(
            400
          ).json({

            success: false,

            message:
              `Parent Raw dataset is invalid: ${rawIdColumnResult.error}`,

          });
        }

        const rawIdColumn =
          rawIdColumnResult.column.name;

        const rawIds =
          new Set(
            parentData
              .map(
                (row) =>
                  normalizeIdValue(
                    row?.[rawIdColumn]
                  )
              )
              .filter(
                (value) =>
                  value !== null
              )
          );

        const missingTaggedIds =
          Array.from(
            new Set(
              normalizedIncomingData
                .map(
                  (row) =>
                    normalizeIdValue(
                      row?.[idColumn]
                    )
                )
                .filter(
                  (value) =>
                    value !== null &&
                    !rawIds.has(value)
                )
            )
          );

        if (
          missingTaggedIds.length > 0
        ) {

          const displayedIds =
            missingTaggedIds
              .slice(0, 20)
              .join(", ");

          const suffix =
            missingTaggedIds.length > 20
              ? "..."
              : "";

          return res.status(
            400
          ).json({

            success: false,

            errorType:
              "TAGGED_ID_NOT_FOUND_IN_RAW",

            message:
              `Every Tagged _id must exist in the parent Raw dataset. The following Tagged IDs were not found in Raw: ${displayedIds}${suffix}`,

            rawIdColumn,

            taggedIdColumn:
              idColumn,

            missingTaggedIds,

          });
        }
      }

      /* -------------------------------------------------
         MERGE

         Existing records keep their position so the
         dataset order stays stable across refreshes.
         New records are appended in file order.

         Derived App Attribute values are cleared for
         updated and new records so they can be recomputed
         after the source data changes.
      ------------------------------------------------- */

      const merged =
        [...normalizedExistingData];

      const indexById =
        new Map();

      merged.forEach(
        (row, index) => {

          const normalizedId =
            normalizeIdValue(
              row?.[idColumn]
            );

          if (
            normalizedId !== null
          ) {

            indexById.set(
              normalizedId,
              index
            );
          }
        }
      );

      let added = 0;
      let updated = 0;

      normalizedIncomingData.forEach(
        (row) => {

          const normalizedId =
            normalizeIdValue(
              row?.[idColumn]
            );

          if (
            normalizedId === null
          ) {
            return;
          }

          const existingIndex =
            indexById.get(
              normalizedId
            );

          if (
            existingIndex === undefined
          ) {

            indexById.set(
              normalizedId,
              merged.length
            );

            /* New record — initialize from updatedSchema columns, then copy incoming values */
            const newRow = {};
            updatedSchema.forEach((col) => {
              if (col && col.name) {
                newRow[col.name] = isListSchemaColumn(col) ? [] : null;
              }
            });
            Object.assign(newRow, row);
            appAttrNames.forEach(
              (attr) => {
                newRow[attr] = null;
              }
            );

            merged.push(
              newRow
            );

            added += 1;

            return;
          }

          /* Updated source record — override existing fields with incoming fields, preserve unmentioned fields, clear derived values. */
          const updatedRow = {
            ...merged[existingIndex],
            ...row,
          };
          appAttrNames.forEach(
            (attr) => {
              updatedRow[attr] = null;
            }
          );

          merged[existingIndex] =
            updatedRow;

          updated += 1;
        }
      );

      /* Ensure all existing records have new columns from addedColumns */
      if (addedColumns.length > 0) {
        merged.forEach((record) => {
          addedColumns.forEach((colName) => {
            if (!(colName in record) || record[colName] === undefined) {
              const colDef = updatedSchema.find((c) => c.name === colName);
              record[colName] = colDef && isListSchemaColumn(colDef) ? [] : null;
            }
          });
        });
      }

      /* -------------------------------------------------
         PREVIEW ONLY
      ------------------------------------------------- */

      if (isValidateOnly) {

        return res.json({

          success: true,

          validateOnly: true,

          datasetId:
            dataset.id,

          datasetName:
            dataset.dataset_name,

          ingestionType:
            dataset.data_type,

          idColumn,

          added,

          updated,

          totalBefore:
            existingData.length,

          totalAfter:
            merged.length,

          staleAppAttributes:
            appAttrNames.size,

          addedColumns,

        });
      }

      /* -------------------------------------------------
         WRITE
      ------------------------------------------------- */

      const sizeKB =
        Buffer.byteLength(
          JSON.stringify(
            merged
          )
        ) / 1024;

      db.prepare(`
        UPDATE datasets
        SET
          data_json = ?,
          schema_json = ?,
          size_kb = ?,
          ingestion_time_ms = ?,
          file_name = COALESCE(?, file_name),
          status = 'Completed',
          last_refreshed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(

        JSON.stringify(
          merged
        ),

        JSON.stringify(
          updatedSchema
        ),

        sizeKB,

        Date.now() - start,

        fileName || null,

        dataset.id

      );

      const transformIds = appAttrRows
        .map((row) => Number(row.transform_id))
        .filter((value) => Number.isInteger(value));

      if (transformIds.length > 0) {
        const placeholders = transformIds.map(() => "?").join(", ");
        db.prepare(`
          UPDATE transform_functions
          SET execution_status = 'pending', updated_at = CURRENT_TIMESTAMP
          WHERE id IN (${placeholders})
        `).run(...transformIds);
      }

      res.json({

        success: true,

        validateOnly: false,

        message:
          `Dataset refreshed. ${added} event(s) added, ${updated} event(s) updated.`,

        datasetId:
          dataset.id,

        datasetName:
          dataset.dataset_name,

        ingestionType:
          dataset.data_type,

        idColumn,

        added,

        updated,

        totalBefore:
          existingData.length,

        totalAfter:
          merged.length,

        staleAppAttributes:
          appAttrNames.size,

        addedColumns,

      });

    } catch (error) {

      console.error(
        "Refresh dataset error:",
        error
      );

      res.status(
        500
      ).json({

        success: false,

        message:
          "Failed to refresh dataset",

      });
    }
  }
);

/* =======================================================
   FETCH DATASETS
======================================================= */

app.get(
  "/datasets",
  (req, res) => {

    try {

      const rows =
        db.prepare(`
          SELECT *
          FROM datasets
          ORDER BY uploaded_at DESC
        `).all();

      const parsed =
        rows.map(
          (row) => {

            let schema = [];
            let data = [];

            try {

              schema =
                JSON.parse(
                  row.schema_json ||
                  "[]"
                );

            } catch {

              schema = [];
            }

            try {

              data =
                JSON.parse(
                  row.data_json ||
                  "[]"
                );

            } catch {

              data = [];
            }

            return {

              ...row,

              parent_dataset_id:
                row.parent_dataset_id ??
                null,

              parentDatasetId:
                row.parent_dataset_id ??
                null,

              ingestionType:
                row.data_type,

              schema_json:
                schema,

              data_json:
                data,

            };
          }
        );

      res.json(
        parsed
      );

    } catch (error) {

      console.error(
        "Fetch datasets error:",
        error
      );

      res.status(
        500
      ).json({

        success: false,

        message:
          "Failed to fetch datasets",

      });
    }
  }
);

/* =======================================================
   INVESTIGATION DATASET GROUPS
======================================================= */

/*
  IMPORTANT:

  This endpoint is specifically for the Investigation page.

  Instead of returning:

    Toss Dummy Raw
    Toss Dummy Raw

  where one is Raw and one is Tagged,

  it returns:

    Toss Dummy
      Raw:    Dummy_raw.csv
      Tagged: Dummy_tagged.csv

  One investigation row is therefore created for each
  Raw dataset.

  The Raw dataset ID is the investigation anchor.
*/

app.get(
  "/investigation/datasets",
  (req, res) => {

    try {

      const rawDatasets =
        db.prepare(`
          SELECT
            id,
            dataset_name,
            file_name,
            data_type,
            status,
            size_kb,
            ingestion_time_ms,
            uploaded_at
          FROM datasets
          WHERE LOWER(data_type) = 'raw'
          ORDER BY uploaded_at DESC
        `).all();

      const taggedDatasets =
        db.prepare(`
          SELECT
            id,
            dataset_name,
            file_name,
            data_type,
            parent_dataset_id,
            status,
            size_kb,
            ingestion_time_ms,
            uploaded_at
          FROM datasets
          WHERE LOWER(data_type) = 'tagged'
          ORDER BY uploaded_at DESC
        `).all();

      const grouped =
        rawDatasets.map(
          (raw) => {

            const tagged =
              taggedDatasets.filter(
                (dataset) =>
                  Number(
                    dataset.parent_dataset_id
                  ) ===
                  Number(
                    raw.id
                  )
              );

            return {

              /*
                Investigation anchor
              */

              id:
                raw.id,

              datasetId:
                raw.id,

              rawDatasetId:
                raw.id,

              /* ---------------------------------------
                 Dataset identity
              --------------------------------------- */

              dataset_name:
                raw.dataset_name,

              datasetName:
                raw.dataset_name,

              /* ---------------------------------------
                 Raw information
              --------------------------------------- */

              raw: {

                id:
                  raw.id,

                file_name:
                  raw.file_name,

                dataset_name:
                  raw.dataset_name,

                status:
                  raw.status,

                uploaded_at:
                  raw.uploaded_at,

              },

              rawFileName:
                raw.file_name,

              rawStatus:
                raw.status,

              rawUploadedAt:
                raw.uploaded_at,

              /* ---------------------------------------
                 Tagged information
              --------------------------------------- */

              tagged,

              taggedCount:
                tagged.length,

              taggedFileNames:
                tagged.map(
                  (dataset) =>
                    dataset.file_name
                ),

              taggedDatasetIds:
                tagged.map(
                  (dataset) =>
                    dataset.id
                ),

              /* ---------------------------------------
                 Backward-friendly fields
              --------------------------------------- */

              file_name:
                raw.file_name,

              uploaded_at:
                raw.uploaded_at,

              status:
                raw.status,

            };
          }
        );

      res.json(
        grouped
      );

    } catch (error) {

      console.error(
        "Investigation datasets error:",
        error
      );

      res.status(
        500
      ).json({

        success: false,

        message:
          "Failed to load investigation datasets",

      });
    }
  }
);

/* =======================================================
   INVESTIGATION DATASET DETAILS
======================================================= */

/*
  Returns the complete investigation package:

    Raw dataset
    +
    all Tagged datasets linked to it

  The endpoint accepts either:

    /investigation/datasets/1

  where 1 is the Raw ID,

  OR

    /investigation/datasets/2

  where 2 is a Tagged ID.

  If a Tagged ID is supplied, the Raw parent is resolved
  automatically.
*/

app.get(
  "/investigation/datasets/:id",
  (req, res) => {

    try {

      const requestedId =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(
          requestedId
        )
      ) {

        return res.status(
          400
        ).json({

          success: false,

          message:
            "Invalid dataset ID",

        });
      }

      let anchorDataset =
        db.prepare(`
          SELECT *
          FROM datasets
          WHERE id = ?
        `).get(
          requestedId
        );

      if (!anchorDataset) {

        return res.status(
          404
        ).json({

          success: false,

          message:
            "Dataset not found",

        });
      }

      /* -------------------------------------------------
         If selected dataset is Tagged, resolve parent Raw
      ------------------------------------------------- */

      if (
        String(
          anchorDataset.data_type || ""
        ).toLowerCase() === "tagged"
      ) {

        if (
          !anchorDataset.parent_dataset_id
        ) {

          return res.status(
            400
          ).json({

            success: false,

            message:
              "Tagged dataset does not have a parent Raw dataset",

          });
        }

        anchorDataset =
          db.prepare(`
            SELECT *
            FROM datasets
            WHERE id = ?
          `).get(
            anchorDataset.parent_dataset_id
          );

        if (!anchorDataset) {

          return res.status(
            404
          ).json({

            success: false,

            message:
              "Parent Raw dataset not found",

          });
        }
      }

      /* -------------------------------------------------
         Anchor must be Raw
      ------------------------------------------------- */

      if (
        String(
          anchorDataset.data_type || ""
        ).toLowerCase() !== "raw"
      ) {

        return res.status(
          400
        ).json({

          success: false,

          message:
            "Investigation must be anchored to a Raw dataset",

        });
      }

      /* -------------------------------------------------
         Parse Raw data
      ------------------------------------------------- */

      let rawSchema = [];
      let rawData = [];

      try {

        rawSchema =
          JSON.parse(
            anchorDataset.schema_json ||
            "[]"
          );

      } catch {

        rawSchema = [];
      }

      try {

        rawData =
          JSON.parse(
            anchorDataset.data_json ||
            "[]"
          );

      } catch {

        rawData = [];
      }

      /* -------------------------------------------------
         Load Tagged datasets
      ------------------------------------------------- */

      const taggedDatasets =
        db.prepare(`
          SELECT *
          FROM datasets
          WHERE parent_dataset_id = ?
          AND LOWER(data_type) = 'tagged'
          ORDER BY uploaded_at DESC
        `).all(
          anchorDataset.id
        );

      const parsedTagged =
        taggedDatasets.map(
          (tagged) => {

            let taggedSchema = [];
            let taggedData = [];

            try {

              taggedSchema =
                JSON.parse(
                  tagged.schema_json ||
                  "[]"
                );

            } catch {

              taggedSchema = [];
            }

            try {

              taggedData =
                JSON.parse(
                  tagged.data_json ||
                  "[]"
                );

            } catch {

              taggedData = [];
            }

            const taggedIdResult =
              getIdColumn(
                taggedSchema
              );

            return {

              id:
                tagged.id,

              dataset_name:
                tagged.dataset_name,

              file_name:
                tagged.file_name,

              data_type:
                tagged.data_type,

              parent_dataset_id:
                tagged.parent_dataset_id,

              status:
                tagged.status,

              size_kb:
                tagged.size_kb,

              ingestion_time_ms:
                tagged.ingestion_time_ms,

              uploaded_at:
                tagged.uploaded_at,

              schema:
                taggedSchema,

              data:
                taggedData,

              idColumn:
                taggedIdResult.column?.name ||
                null,

            };
          }
        );

      /* -------------------------------------------------
         Raw ID column
      ------------------------------------------------- */

      const rawIdResult =
        getIdColumn(
          rawSchema
        );

      res.json({

        success: true,

        datasetId:
          anchorDataset.id,

        rawDatasetId:
          anchorDataset.id,

        datasetName:
          anchorDataset.dataset_name,

        /* ------------------------------------------------
           RAW
        ------------------------------------------------ */

        raw: {

          id:
            anchorDataset.id,

          dataset_name:
            anchorDataset.dataset_name,

          file_name:
            anchorDataset.file_name,

          data_type:
            anchorDataset.data_type,

          status:
            anchorDataset.status,

          size_kb:
            anchorDataset.size_kb,

          ingestion_time_ms:
            anchorDataset.ingestion_time_ms,

          uploaded_at:
            anchorDataset.uploaded_at,

          schema:
            rawSchema,

          data:
            rawData,

          idColumn:
            rawIdResult.column?.name ||
            null,

        },

        /* ------------------------------------------------
           TAGGED
        ------------------------------------------------ */

        tagged:
          parsedTagged,

        taggedCount:
          parsedTagged.length,

      });

    } catch (error) {

      console.error(
        "Investigation dataset details error:",
        error
      );

      res.status(
        500
      ).json({

        success: false,

        message:
          "Failed to load investigation dataset",

      });
    }
  }
);

/* =======================================================
   DATASET SCHEMA
======================================================= */

app.get(
  "/datasets/:id/schema",
  (req, res) => {

    try {

      const {
        id,
      } = req.params;

      const dataset =
        db.prepare(`
          SELECT
            id,
            dataset_name,
            data_type,
            parent_dataset_id,
            schema_json
          FROM datasets
          WHERE id = ?
        `).get(id);

      if (!dataset) {

        return res.status(
          404
        ).json({

          success: false,

          message:
            "Dataset not found",

        });
      }

      const columns =
        JSON.parse(
          dataset.schema_json ||
          "[]"
        );

      const timestampColumn =
        columns.find(
          (column) =>
            column.ontologyMapping ===
            "opentimestamp"
        )?.name || "";

      const primaryKey =
        columns.find(
          (column) =>
            column.ontologyMapping ===
            "_id"
        )?.name || "";

      res.json({

        success: true,

        datasetId:
          dataset.id,

        datasetName:
          dataset.dataset_name,

        ingestionType:
          dataset.data_type,

        parentDatasetId:
          dataset.parent_dataset_id ??
          null,

        columns,

        timestampColumn,

        primaryKey,

      });

    } catch (error) {

      console.error(
        "Schema error:",
        error
      );

      res.status(
        500
      ).json({

        success: false,

        message:
          "Failed to load schema",

      });
    }
  }
);

/* =======================================================
   PARENT RAW DATASET
======================================================= */

app.get(
  "/datasets/:id/parent",
  (req, res) => {

    try {

      const {
        id,
      } = req.params;

      const dataset =
        db.prepare(`
          SELECT
            id,
            dataset_name,
            data_type,
            parent_dataset_id
          FROM datasets
          WHERE id = ?
        `).get(id);

      if (!dataset) {

        return res.status(
          404
        ).json({

          success: false,

          message:
            "Dataset not found",

        });
      }

      if (
        !dataset.parent_dataset_id
      ) {

        return res.json({

          success: true,

          parent: null,

        });
      }

      const parent =
        db.prepare(`
          SELECT
            id,
            dataset_name,
            file_name,
            data_type,
            status,
            size_kb,
            ingestion_time_ms,
            uploaded_at
          FROM datasets
          WHERE id = ?
        `).get(
          dataset.parent_dataset_id
        );

      if (!parent) {

        return res.status(
          404
        ).json({

          success: false,

          message:
            "Parent dataset not found",

        });
      }

      res.json({

        success: true,

        parent,

      });

    } catch (error) {

      console.error(
        "Parent dataset error:",
        error
      );

      res.status(
        500
      ).json({

        success: false,

        message:
          "Failed to load parent dataset",

      });
    }
  }
);

/* =======================================================
   CHILD TAGGED DATASETS
======================================================= */

app.get(
  "/datasets/:id/children",
  (req, res) => {

    try {

      const {
        id,
      } = req.params;

      const parent =
        db.prepare(`
          SELECT
            id,
            dataset_name,
            data_type
          FROM datasets
          WHERE id = ?
        `).get(id);

      if (!parent) {

        return res.status(
          404
        ).json({

          success: false,

          message:
            "Dataset not found",

        });
      }

      const children =
        db.prepare(`
          SELECT
            id,
            dataset_name,
            file_name,
            data_type,
            parent_dataset_id,
            status,
            size_kb,
            ingestion_time_ms,
            uploaded_at
          FROM datasets
          WHERE parent_dataset_id = ?
          ORDER BY uploaded_at DESC
        `).all(id);

      res.json({

        success: true,

        parentDatasetId:
          Number(id),

        children,

      });

    } catch (error) {

      console.error(
        "Child datasets error:",
        error
      );

      res.status(
        500
      ).json({

        success: false,

        message:
          "Failed to load child datasets",

      });
    }
  }
);

/* =======================================================
   TIMELINE HELPER
======================================================= */

function generateTimeline(
  records,
  schema,
  dateColumn = null,
  colorBy = null
) {

  const timestampColumn =
    schema.find(
      (column) =>
        column.ontologyMapping ===
        "opentimestamp"
    )?.name || null;

  const selectedDateColumn =
    dateColumn ||
    timestampColumn;

  if (
    !selectedDateColumn
  ) {

    return [];
  }

  const dateSchemaColumn =
    schema.find(
      (column) =>
        column.name ===
        selectedDateColumn
    );

  if (
    !dateSchemaColumn ||
    !isDateColumn(
      dateSchemaColumn
    )
  ) {

    return [];
  }

  let selectedColorColumn =
    null;

  if (colorBy) {

    const colorSchemaColumn =
      schema.find(
        (column) =>
          column.name ===
          colorBy
      );

    if (
      colorSchemaColumn &&
      isCategoricalColumn(
        colorSchemaColumn
      )
    ) {

      selectedColorColumn =
        colorBy;
    }
  }

  const counts = {};

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

      if (
        !selectedColorColumn
      ) {

        counts[month] =
          (
            counts[month] ||
            0
          ) + 1;

        return;
      }

      let category =
        row[
        selectedColorColumn
        ];

      if (
        category === undefined ||
        category === null ||
        category === ""
      ) {

        category =
          "(Blank)";
      }

      category =
        String(
          category
        ).trim();

      const key =
        `${month}|||${category}`;

      counts[key] =
        (
          counts[key] ||
          0
        ) + 1;

    }
  );

  const timeline = [];

  Object.entries(
    counts
  ).forEach(
    (
      [key, count]
    ) => {

      if (
        selectedColorColumn
      ) {

        const [
          month,
          category,
        ] =
          key.split(
            "|||"
          );

        timeline.push({

          month,

          category,

          count,

        });

      } else {

        timeline.push({

          month:
            key,

          count,

        });
      }
    }
  );

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

      if (
        a.category &&
        b.category
      ) {

        return String(
          a.category
        ).localeCompare(
          String(
            b.category
          )
        );
      }

      return 0;
    }
  );

  return timeline;
}

/* =======================================================
   DATASET TIMELINE
======================================================= */

app.get(
  "/datasets/:id/timeline",
  (req, res) => {

    try {

      const {
        id,
      } = req.params;

      const dateColumn =
        typeof req.query.dateColumn === "string" &&
          req.query.dateColumn.trim() !== ""
          ? req.query.dateColumn.trim()
          : null;

      const colorBy =
        typeof req.query.colorBy === "string" &&
          req.query.colorBy.trim() !== ""
          ? req.query.colorBy.trim()
          : null;

      const dataset =
        db.prepare(`
          SELECT
            schema_json,
            data_json
          FROM datasets
          WHERE id = ?
        `).get(id);

      if (!dataset) {

        return res.status(
          404
        ).json({

          success: false,

          message:
            "Dataset not found",

        });
      }

      const schema =
        JSON.parse(
          dataset.schema_json ||
          "[]"
        );

      const records =
        JSON.parse(
          dataset.data_json ||
          "[]"
        );

      const timeline =
        generateTimeline(
          records,
          schema,
          dateColumn,
          colorBy
        );

      const defaultTimestampColumn =
        schema.find(
          (column) =>
            column.ontologyMapping ===
            "opentimestamp"
        )?.name || "";

      const dateColumns =
        schema
          .filter(
            (column) =>
              isDateColumn(
                column
              )
          )
          .filter(
            (column) =>
              column.ontologyMapping !==
              "opentimestamp"
          )
          .map(
            (column) =>
              column.name
          );

      const categoricalColumns =
        schema
          .filter(
            (column) =>
              isCategoricalColumn(
                column
              )
          )
          .map(
            (column) =>
              column.name
          );

      res.json({

        success:
          true,

        eventCount:
          records.length,

        timeline,

        dateColumn:
          dateColumn ||
          defaultTimestampColumn,

        colorBy:
          colorBy ||
          null,

        dateColumns,

        categoricalColumns,

      });

    } catch (error) {

      console.error(
        "Timeline error:",
        error
      );

      res.status(
        500
      ).json({

        success:
          false,

        message:
          "Failed to load timeline",

      });
    }
  }
);

/* =======================================================
   DATASET DATA
======================================================= */

app.get(
  "/datasets/:id/data",
  (req, res) => {

    try {

      const {
        id,
      } = req.params;

      const dataset =
        db.prepare(`
          SELECT data_json
          FROM datasets
          WHERE id = ?
        `).get(id);

      if (!dataset) {

        return res.status(
          404
        ).json({

          success:
            false,

          message:
            "Dataset not found",

        });
      }

      const records =
        JSON.parse(
          dataset.data_json ||
          "[]"
        );

      res.json({

        success:
          true,

        records,

      });

    } catch (error) {

      console.error(
        "Dataset data error:",
        error
      );

      res.status(
        500
      ).json({

        success:
          false,

        message:
          "Failed to load dataset data",

      });
    }
  }
);

/* =======================================================
   NUMERIC FILTER
======================================================= */

function applyNumericFilter(
  rowValue,
  filter
) {

  const numericValue =
    Number(
      rowValue
    );

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
    Number(
      filter.value
    );

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

/* =======================================================
   DATE FILTER
======================================================= */

function applyDateFilter(
  rowValue,
  filter
) {

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

/* =======================================================
   APPLY FIELD FILTERS
======================================================= */

function applyDatasetFilters(
  records,
  filters
) {

  if (
    !Array.isArray(
      filters
    ) ||
    filters.length === 0
  ) {

    return records;
  }

  return records.filter(
    (row) => {

      return filters.every(
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

          /* -------------------------------------------
             NUMERIC
          ------------------------------------------- */

          if (
            filterType ===
            "numeric"
          ) {

            return applyNumericFilter(
              rowValue,
              filter
            );
          }

          /* -------------------------------------------
             DATE
          ------------------------------------------- */

          if (
            filterType ===
            "date"
          ) {

            return applyDateFilter(
              rowValue,
              filter
            );
          }

          /* -------------------------------------------
             CATEGORICAL
          ------------------------------------------- */

          if (
            !Array.isArray(
              values
            ) ||
            values.length === 0
          ) {

            return true;
          }

          let normalizedRowValue =
            rowValue;

          if (
            normalizedRowValue === undefined ||
            normalizedRowValue === null ||
            normalizedRowValue === ""
          ) {

            normalizedRowValue =
              "(Blank)";
          }

          normalizedRowValue =
            String(
              normalizedRowValue
            )
              .trim()
              .toLowerCase();

          return values.some(
            (selectedValue) => {

              const normalizedSelectedValue =
                String(
                  selectedValue
                )
                  .trim()
                  .toLowerCase();

              return (
                normalizedRowValue ===
                normalizedSelectedValue
              );
            }
          );
        }
      );
    }
  );
}

/* =======================================================
   FILTER DATASET
======================================================= */

app.post(
  "/datasets/:id/filter",
  (req, res) => {

    try {

      const {
        id,
      } = req.params;

      const {
        filters = [],
      } = req.body;

      const dataset =
        db.prepare(`
          SELECT
            schema_json,
            data_json
          FROM datasets
          WHERE id = ?
        `).get(id);

      if (!dataset) {

        return res.status(
          404
        ).json({

          success:
            false,

          message:
            "Dataset not found",

        });
      }

      const schema =
        JSON.parse(
          dataset.schema_json ||
          "[]"
        );

      const records =
        JSON.parse(
          dataset.data_json ||
          "[]"
        );

      const filteredRecords =
        applyDatasetFilters(
          records,
          filters
        );

      const timeline =
        generateTimeline(
          filteredRecords,
          schema
        );

      res.json({

        success:
          true,

        eventCount:
          filteredRecords.length,

        records:
          filteredRecords,

        timeline,

      });

    } catch (error) {

      console.error(
        "Filter error:",
        error
      );

      res.status(
        500
      ).json({

        success:
          false,

        message:
          "Failed to apply filters",

      });
    }
  }
);

/* =======================================================
   DOWNLOAD DATASET
======================================================= */

app.get(
  "/datasets/:id/download",
  (req, res) => {

    try {

      const {
        id,
      } = req.params;

      const dataset =
        db.prepare(`
          SELECT *
          FROM datasets
          WHERE id = ?
        `).get(id);

      if (!dataset) {

        return res.status(
          404
        ).json({

          success:
            false,

          message:
            "Dataset not found",

        });
      }

      const data =
        JSON.parse(
          dataset.data_json ||
          "[]"
        );

      const csv =
        Papa.unparse(
          data
        );

      let fileName =
        dataset.file_name ||
        `dataset_${id}.csv`;

      if (
        !fileName
          .toLowerCase()
          .endsWith(
            ".csv"
          )
      ) {

        fileName +=
          ".csv";
      }

      res.setHeader(
        "Content-Type",
        "text/csv"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );

      res.send(
        csv
      );

    } catch (error) {

      console.error(
        "Download error:",
        error
      );

      res.status(
        500
      ).json({

        success:
          false,

        message:
          "Failed to download dataset",

      });
    }
  }
);

/* =======================================================
   CREATE ASG
======================================================= */

app.post(
  "/asgs",
  (req, res) => {

    try {

      const {
        title,
        category,
        datasetId,
        datasetName,
        dateBy,
        colorBy,
        eventCount,
        filters,
      } = req.body;

      const trimmedTitle =
        String(title || "").trim();

      const trimmedCategory =
        String(category || "").trim();

      if (!trimmedTitle) {
        return res.status(400).json({
          success: false,
          message: "ASG title is required",
        });
      }

      if (!trimmedCategory) {
        return res.status(400).json({
          success: false,
          message: "Issue category is required",
        });
      }

      const asgNumber = nextAsgNumber();

      const result =
        db.prepare(`
          INSERT INTO asgs (
            asg_number,
            title,
            category,
            dataset_id,
            dataset_name,
            date_by,
            color_by,
            event_count,
            filters_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          asgNumber,
          trimmedTitle,
          trimmedCategory,
          datasetId ?? null,
          datasetName || null,
          dateBy || null,
          colorBy || null,
          eventCount ?? 0,
          JSON.stringify(filters || [])
        );

      const asg =
        db.prepare(`
          SELECT *
          FROM asgs
          WHERE id = ?
        `).get(result.lastInsertRowid);

      res.json({
        success: true,
        asg,
      });

    } catch (error) {

      console.error("Create ASG error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to save ASG",
      });
    }
  }
);

/* =======================================================
   LIST ASGs
======================================================= */

app.get(
  "/asgs",
  (req, res) => {

    try {

      const asgs =
        db.prepare(`
          SELECT *
          FROM asgs
          ORDER BY id DESC
        `).all();

      res.json({
        success: true,
        asgs,
      });

    } catch (error) {

      console.error("List ASGs error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to load ASGs",
      });
    }
  }
);

/* =======================================================
   OLLAMA LLM TAGGING SERVICES
======================================================= */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const DEFAULT_TAGGING_BATCH_SIZE = Number(process.env.TAGGING_BATCH_SIZE) || 10;

/* -------------------------------------------------------
   DISCOVER OLLAMA MODELS
------------------------------------------------------- */

app.get("/ollama/models", async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message: `Ollama returned status ${response.status}`,
        baseUrl: OLLAMA_BASE_URL,
      });
    }

    const data = await response.json();
    const models = Array.isArray(data.models)
      ? data.models.map((m) => m.name || m.model)
      : [];

    return res.json({
      success: true,
      models,
      baseUrl: OLLAMA_BASE_URL,
    });
  } catch (error) {
    console.error("Ollama connection error:", error);
    return res.status(503).json({
      success: false,
      message: `Unable to connect to Ollama at ${OLLAMA_BASE_URL}. Make sure Ollama is running locally and models are installed.`,
      baseUrl: OLLAMA_BASE_URL,
    });
  }
});

/* -------------------------------------------------------
   HELPER: EXTRACT ENTITIES FROM SINGLE RECORD
------------------------------------------------------- */

async function extractEntitiesWithOllama({
  text,
  entities,
  prompt,
  modelName,
}) {
  if (!text || !String(text).trim()) {
    const emptyResult = {};
    entities.forEach((entity) => {
      emptyResult[entity] = [];
    });
    return {
      status: "success",
      extracted: emptyResult,
      rawResponse: "Empty input text",
    };
  }

  const systemInstructions = `You are an information extraction system.
Extract the requested entities from the supplied free-text.
Follow the user's extraction instructions strictly.
Do not invent or infer information. Only use explicitly stated facts.
Return ONLY valid JSON.
For every entity requested, return an array of string values.
If no value exists for an entity, return an empty array [].`;

  const entityJsonTemplate = {};
  entities.forEach((entity) => {
    entityJsonTemplate[entity] = ["..."];
  });

  const fullPrompt = `${systemInstructions}

USER INSTRUCTION:
${prompt}

ENTITIES TO EXTRACT:
${entities.join(", ")}

INPUT TEXT:
"${String(text).trim()}"

EXPECTED JSON FORMAT:
${JSON.stringify(entityJsonTemplate, null, 2)}`;

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        prompt: fullPrompt,
        stream: false,
        format: "json",
      }),
    });

    if (!response.ok) {
      return {
        status: "failed",
        error: `Ollama error HTTP ${response.status}`,
        extracted: {},
      };
    }

    const resData = await response.json();
    const rawText = resData.response || "";

    // Parse JSON output
    let parsed = null;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch (e) {
      // Defensive regex search for JSON inside response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (_) { }
      }
    }

    if (!parsed || typeof parsed !== "object") {
      return {
        status: "failed",
        error: "LLM returned an invalid structured JSON response.",
        rawResponse: rawText,
        extracted: {},
      };
    }

    // Normalize extracted values to array of strings per entity
    const normalized = {};
    entities.forEach((entity) => {
      const val = parsed[entity] ?? parsed[entity.toLowerCase()] ?? [];
      if (Array.isArray(val)) {
        normalized[entity] = val
          .map((v) => String(v).trim())
          .filter(Boolean);
      } else if (val !== null && val !== undefined && val !== "") {
        normalized[entity] = [String(val).trim()];
      } else {
        normalized[entity] = [];
      }
    });

    return {
      status: "success",
      extracted: normalized,
      rawResponse: rawText,
    };
  } catch (err) {
    return {
      status: "failed",
      error: err.message || "Network error calling Ollama",
      extracted: {},
    };
  }
}

/* -------------------------------------------------------
   TAG PREVIEW (SAMPLE SIZE)
------------------------------------------------------- */

app.post("/ollama/tag-preview", async (req, res) => {
  try {
    const { datasetId, freeTextColumn, entities, prompt, sampleSize = 50, modelName } = req.body;

    if (!datasetId || !freeTextColumn || !Array.isArray(entities) || entities.length === 0 || !prompt || !modelName) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: datasetId, freeTextColumn, entities, prompt, modelName",
      });
    }

    const dataset = db.prepare(`SELECT data_json FROM datasets WHERE id = ?`).get(Number(datasetId));
    if (!dataset) {
      return res.status(404).json({ success: false, message: "Dataset not found" });
    }

    const records = JSON.parse(dataset.data_json || "[]");
    const countToTake = Math.min(Number(sampleSize) || 50, records.length);
    const sampleRecords = records.slice(0, countToTake);

    const results = [];
    for (let i = 0; i < sampleRecords.length; i++) {
      const rec = sampleRecords[i];
      const textVal = rec[freeTextColumn] || "";

      const extraction = await extractEntitiesWithOllama({
        text: textVal,
        entities,
        prompt,
        modelName,
      });

      results.push({
        index: i + 1,
        id: rec._id ?? rec.id ?? rec.eventId ?? i + 1,
        freeText: textVal,
        extracted: extraction.extracted,
        status: extraction.status,
        error: extraction.error,
      });
    }

    return res.json({
      success: true,
      results,
      totalDatasetRows: records.length,
      sampleSize: sampleRecords.length,
    });
  } catch (error) {
    console.error("Tag preview error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate preview" });
  }
});

/* -------------------------------------------------------
   TAG ENTIRE DATASET (BATCHED)
------------------------------------------------------- */

app.post("/ollama/tag-dataset", async (req, res) => {
  try {
    const { datasetId, freeTextColumn, entities, prompt, modelName, batchSize } = req.body;

    if (!datasetId || !freeTextColumn || !Array.isArray(entities) || entities.length === 0 || !prompt || !modelName) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    const dataset = db.prepare(`SELECT data_json FROM datasets WHERE id = ?`).get(Number(datasetId));
    if (!dataset) {
      return res.status(404).json({ success: false, message: "Dataset not found" });
    }

    const records = JSON.parse(dataset.data_json || "[]");
    const bSize = Number(batchSize) || DEFAULT_TAGGING_BATCH_SIZE;

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    const enrichedRecords = [];

    for (let i = 0; i < records.length; i += bSize) {
      const batch = records.slice(i, i + bSize);

      const batchPromises = batch.map(async (record) => {
        const textVal = record[freeTextColumn] || "";
        const extraction = await extractEntitiesWithOllama({
          text: textVal,
          entities,
          prompt,
          modelName,
        });

        const newRec = { ...record };
        if (extraction.status === "success") {
          successCount++;
          entities.forEach((entity) => {
            newRec[entity] = extraction.extracted[entity] || [];
          });
          newRec._taggingStatus = "success";
        } else {
          failedCount++;
          entities.forEach((entity) => {
            newRec[entity] = [];
          });
          newRec._taggingStatus = "failed";
          newRec._taggingError = extraction.error;
        }

        return newRec;
      });

      const batchResults = await Promise.all(batchPromises);
      enrichedRecords.push(...batchResults);
      processedCount += batch.length;
    }

    return res.json({
      success: true,
      records: enrichedRecords,
      totalCount: records.length,
      processedCount,
      successCount,
      failedCount,
    });
  } catch (error) {
    console.error("Tag dataset error:", error);
    return res.status(500).json({ success: false, message: "Failed to process dataset" });
  }
});

/* -------------------------------------------------------
   SAVE TAGGED DATASET TO DB
------------------------------------------------------- */

app.post("/ollama/save-tagged-dataset", (req, res) => {
  try {
    const { parentDatasetId, datasetName, records, entities } = req.body;

    if (!parentDatasetId || !datasetName || !Array.isArray(records) || !Array.isArray(entities)) {
      return res.status(400).json({ success: false, message: "Invalid payload for saving tagged dataset" });
    }

    // Get parent dataset schema
    const parent = db.prepare(`SELECT schema_json, file_name FROM datasets WHERE id = ?`).get(Number(parentDatasetId));
    if (!parent) {
      return res.status(404).json({ success: false, message: "Parent dataset not found" });
    }

    const parentSchema = JSON.parse(parent.schema_json || "[]");

    // Construct schema with new list columns for entities
    const entityColumns = entities.map((entity) => ({
      name: entity,
      type: "list",
      ontologyMapping: "",
    }));

    const fullSchema = [...parentSchema, ...entityColumns];

    const result = db
      .prepare(`
        INSERT INTO datasets (
          file_name,
          dataset_name,
          data_type,
          parent_dataset_id,
          status,
          size_kb,
          ingestion_time_ms,
          schema_json,
          data_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        parent.file_name || `${datasetName}.csv`,
        datasetName,
        "tagged",
        Number(parentDatasetId),
        "completed",
        Math.round(JSON.stringify(records).length / 1024),
        0,
        JSON.stringify(fullSchema),
        JSON.stringify(records)
      );

    return res.json({
      success: true,
      datasetId: result.lastInsertRowid,
      datasetName,
    });
  } catch (error) {
    console.error("Save tagged dataset error:", error);
    return res.status(500).json({ success: false, message: "Failed to save tagged dataset" });
  }
});

/* =======================================================
   TAXONOMY CRUD
======================================================= */

function validateTaxonomySources(sources, layers) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return "Add at least one source dataset and field before saving the taxonomy";
  }
  if (!Array.isArray(layers) || layers.length === 0) {
    return "Add at least one taxonomy layer before configuring sources";
  }

  for (const [index, source] of sources.entries()) {
    const datasetId = Number(source?.datasetId);
    const fieldName = String(source?.fieldName || "").trim();
    const layerIndex = Number(source?.layerIndex);
    if (!Number.isInteger(datasetId) || !fieldName || !Number.isInteger(layerIndex) || !layers[layerIndex]) {
      return `Source ${index + 1} must specify a valid Tagged dataset, field, and taxonomy layer`;
    }

    const dataset = db.prepare("SELECT id, data_type, schema_json FROM datasets WHERE id = ?").get(datasetId);
    if (!dataset) return `Source dataset ${datasetId} was not found`;
    if (String(dataset.data_type || "").toLowerCase() !== "tagged") {
      return `Source dataset "${datasetId}" must be Tagged; Raw datasets cannot be used for taxonomy refinement`;
    }

    const column = parseDatasetSchema(dataset.schema_json).find((item) => item?.name === fieldName);
    if (!column || column.isAppAttribute || column.ontologyMapping === "_id") {
      return `Source field "${fieldName}" was not found as an original field on the selected Tagged dataset`;
    }
  }
  return null;
}

/* List all taxonomies */
app.get("/taxonomies", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT t.id, t.name, t.description, t.status, t.version,
             t.layers_json, t.sources_json, t.created_at, t.updated_at,
             (SELECT COUNT(*) FROM taxonomy_mappings m WHERE m.taxonomy_id = t.id) AS mapping_count,
             (SELECT COUNT(*) FROM taxonomy_mappings m WHERE m.taxonomy_id = t.id AND review_status = 'reviewed') AS reviewed_count,
             (SELECT COUNT(*) FROM taxonomy_mappings m WHERE m.taxonomy_id = t.id AND (review_status = 'unmapped' OR refined_value IS NULL OR TRIM(refined_value) = '')) AS unmapped_count
      FROM taxonomies t
      ORDER BY t.updated_at DESC
    `).all();

    const taxonomies = rows.map((row) => ({
      ...row,
      layers: JSON.parse(row.layers_json || "[]"),
      sources: JSON.parse(row.sources_json || "[]"),
      mappingCount: row.mapping_count,
      reviewedCount: row.reviewed_count,
      unmappedCount: row.unmapped_count,
    }));

    return res.json({ success: true, taxonomies });
  } catch (error) {
    console.error("List taxonomies error:", error);
    return res.status(500).json({ success: false, message: "Failed to list taxonomies" });
  }
});

/* Create taxonomy */
app.post("/taxonomies", (req, res) => {
  try {
    const { name, description, layers, sources } = req.body;

    const definitionLayers = Array.isArray(layers) ? layers : [];
    const definitionSources = Array.isArray(sources) ? sources : [];
    const sourceError = validateTaxonomySources(definitionSources, definitionLayers);
    if (sourceError) return res.status(400).json({ success: false, message: sourceError });

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Taxonomy name is required" });
    }

    const trimmedName = String(name).trim();

    const existing = db.prepare(
      "SELECT id FROM taxonomies WHERE name = ?"
    ).get(trimmedName);

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A taxonomy named "${trimmedName}" already exists`,
      });
    }

    const result = db.prepare(`
      INSERT INTO taxonomies (name, description, layers_json, sources_json, status, version)
      VALUES (?, ?, ?, ?, 'draft', 1)
    `).run(
      trimmedName,
      String(description || "").trim() || null,
      JSON.stringify(definitionLayers),
      JSON.stringify(definitionSources)
    );

    const created = db.prepare(
      "SELECT * FROM taxonomies WHERE id = ?"
    ).get(result.lastInsertRowid);

    return res.json({
      success: true,
      taxonomy: {
        ...created,
        layers: JSON.parse(created.layers_json || "[]"),
        sources: JSON.parse(created.sources_json || "[]"),
      },
    });
  } catch (error) {
    console.error("Create taxonomy error:", error);
    return res.status(500).json({ success: false, message: "Failed to create taxonomy" });
  }
});

/* Get single taxonomy */
app.get("/taxonomies/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: "Invalid taxonomy id" });
    }

    const row = db.prepare(
      "SELECT * FROM taxonomies WHERE id = ?"
    ).get(id);

    if (!row) {
      return res.status(404).json({ success: false, message: "Taxonomy not found" });
    }

    const mappings = db.prepare(`
      SELECT id, layer_index, source_dataset_id, source_field,
             raw_value, refined_value, review_status, occurrence_count
      FROM taxonomy_mappings
      WHERE taxonomy_id = ?
      ORDER BY layer_index, source_dataset_id, source_field, raw_value
    `).all(id);

    return res.json({
      success: true,
      taxonomy: {
        ...row,
        layers: JSON.parse(row.layers_json || "[]"),
        sources: JSON.parse(row.sources_json || "[]"),
      },
      mappings,
    });
  } catch (error) {
    console.error("Get taxonomy error:", error);
    return res.status(500).json({ success: false, message: "Failed to get taxonomy" });
  }
});

/* Update taxonomy */
app.put("/taxonomies/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: "Invalid taxonomy id" });
    }

    const existing = db.prepare(
      "SELECT * FROM taxonomies WHERE id = ?"
    ).get(id);

    if (!existing) {
      return res.status(404).json({ success: false, message: "Taxonomy not found" });
    }

    const { name, description, layers, sources, status } = req.body;

    const updatedName = name ? String(name).trim() : existing.name;
    if (!updatedName) {
      return res.status(400).json({ success: false, message: "Taxonomy name cannot be empty" });
    }

    /* Check name uniqueness if changed */
    if (updatedName !== existing.name) {
      const nameConflict = db.prepare(
        "SELECT id FROM taxonomies WHERE name = ? AND id != ?"
      ).get(updatedName, id);
      if (nameConflict) {
        return res.status(409).json({
          success: false,
          message: `A taxonomy named "${updatedName}" already exists`,
        });
      }
    }

    const validStatuses = ["draft", "complete"];
    const updatedStatus = validStatuses.includes(status) ? status : existing.status;
    const definitionLayers = Array.isArray(layers) ? layers : JSON.parse(existing.layers_json || "[]");
    const definitionSources = Array.isArray(sources) ? sources : JSON.parse(existing.sources_json || "[]");
    const sourceError = validateTaxonomySources(definitionSources, definitionLayers);
    if (sourceError) return res.status(400).json({ success: false, message: sourceError });

    db.prepare(`
      UPDATE taxonomies
      SET name = ?,
          description = ?,
          layers_json = ?,
          sources_json = ?,
          status = ?,
          version = version + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      updatedName,
      description != null ? String(description).trim() || null : existing.description,
      JSON.stringify(definitionLayers),
      JSON.stringify(definitionSources),
      updatedStatus,
      id
    );

    const updated = db.prepare(
      "SELECT * FROM taxonomies WHERE id = ?"
    ).get(id);

    return res.json({
      success: true,
      taxonomy: {
        ...updated,
        layers: JSON.parse(updated.layers_json || "[]"),
        sources: JSON.parse(updated.sources_json || "[]"),
      },
    });
  } catch (error) {
    console.error("Update taxonomy error:", error);
    return res.status(500).json({ success: false, message: "Failed to update taxonomy" });
  }
});

/* Delete taxonomy */
app.delete("/taxonomies/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: "Invalid taxonomy id" });
    }

    const existing = db.prepare(
      "SELECT id FROM taxonomies WHERE id = ?"
    ).get(id);

    if (!existing) {
      return res.status(404).json({ success: false, message: "Taxonomy not found" });
    }

    /* Dependency check: any transforms using this taxonomy? */
    const dependentTransforms = db.prepare(`
      SELECT id, name FROM transform_functions
      WHERE json_extract(config_json, '$.taxonomyId') = ?
    `).all(id);

    if (dependentTransforms.length > 0) {
      const names = dependentTransforms.map((t) => t.name).slice(0, 5).join(", ");
      return res.status(409).json({
        success: false,
        message: `Cannot delete: taxonomy is used by transform(s): ${names}`,
        dependentTransforms,
      });
    }

    const deleteTaxonomy = db.transaction(() => {
      db.prepare("DELETE FROM taxonomy_mappings WHERE taxonomy_id = ?").run(id);
      db.prepare("DELETE FROM taxonomies WHERE id = ?").run(id);
    });

    deleteTaxonomy();

    return res.json({ success: true });
  } catch (error) {
    console.error("Delete taxonomy error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete taxonomy" });
  }
});

/* Duplicate taxonomy (config + mappings) */
app.post("/taxonomies/:id/duplicate", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: "Invalid taxonomy id" });
    }

    const existing = db.prepare("SELECT * FROM taxonomies WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Taxonomy not found" });
    }

    const requestedName = req.body?.name ? String(req.body.name).trim() : "";
    let copyName = requestedName || `${existing.name} (copy)`;
    let suffix = 2;
    while (db.prepare("SELECT id FROM taxonomies WHERE name = ?").get(copyName)) {
      copyName = `${existing.name} (copy ${suffix})`;
      suffix += 1;
    }

    const duplicate = db.transaction(() => {
      const created = db.prepare(`
        INSERT INTO taxonomies (name, description, layers_json, sources_json, status, version)
        VALUES (?, ?, ?, ?, 'draft', 1)
      `).run(
        copyName,
        existing.description,
        existing.layers_json,
        existing.sources_json
      );

      const newId = created.lastInsertRowid;
      const mappings = db.prepare(`
        SELECT layer_index, source_dataset_id, source_field,
               raw_value, refined_value, review_status, occurrence_count
        FROM taxonomy_mappings
        WHERE taxonomy_id = ?
      `).all(id);

      const insertMapping = db.prepare(`
        INSERT INTO taxonomy_mappings (
          taxonomy_id, layer_index, source_dataset_id, source_field,
          raw_value, refined_value, review_status, occurrence_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const mapping of mappings) {
        insertMapping.run(
          newId,
          mapping.layer_index,
          mapping.source_dataset_id,
          mapping.source_field,
          mapping.raw_value,
          mapping.refined_value,
          mapping.review_status,
          mapping.occurrence_count
        );
      }

      return db.prepare("SELECT * FROM taxonomies WHERE id = ?").get(newId);
    });

    const created = duplicate();

    return res.json({
      success: true,
      taxonomy: {
        ...created,
        layers: JSON.parse(created.layers_json || "[]"),
        sources: JSON.parse(created.sources_json || "[]"),
      },
    });
  } catch (error) {
    console.error("Duplicate taxonomy error:", error);
    return res.status(500).json({ success: false, message: "Failed to duplicate taxonomy" });
  }
});

/* =======================================================
   TAXONOMY — EXTRACT UNIQUE ENTITIES
======================================================= */

app.post("/taxonomies/:id/extract", (req, res) => {
  try {
    const taxonomyId = Number(req.params.id);
    if (!Number.isInteger(taxonomyId)) {
      return res.status(400).json({ success: false, message: "Invalid taxonomy id" });
    }

    const taxonomy = db.prepare(
      "SELECT * FROM taxonomies WHERE id = ?"
    ).get(taxonomyId);

    if (!taxonomy) {
      return res.status(404).json({ success: false, message: "Taxonomy not found" });
    }

    const layers = JSON.parse(taxonomy.layers_json || "[]");
    const sources = JSON.parse(taxonomy.sources_json || "[]");

    const sourceValidationError = validateTaxonomySources(sources, layers);
    if (sourceValidationError) {
      return res.status(400).json({ success: false, message: sourceValidationError });
    }

    if (!Array.isArray(sources) || sources.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No source datasets/fields configured on this taxonomy",
      });
    }

    if (!Array.isArray(layers) || layers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No layers configured on this taxonomy. Configure layers before extracting.",
      });
    }

    const insertMapping = db.prepare(`
      INSERT INTO taxonomy_mappings (
        taxonomy_id, layer_index, source_dataset_id, source_field,
        raw_value, refined_value, review_status, occurrence_count
      ) VALUES (?, ?, ?, ?, ?, ?, 'unreviewed', ?)
      ON CONFLICT(taxonomy_id, layer_index, source_dataset_id, source_field, raw_value)
      DO UPDATE SET
        occurrence_count = excluded.occurrence_count,
        updated_at = CURRENT_TIMESTAMP
    `);

    let totalExtracted = 0;
    let totalNew = 0;
    const errors = [];

    const extractEntities = db.transaction(() => {
      for (const source of sources) {
        const { datasetId, fieldName, layerIndex } = source;

        if (
          datasetId == null ||
          !fieldName ||
          layerIndex == null
        ) {
          errors.push(`Invalid source configuration: ${JSON.stringify(source)}`);
          continue;
        }

        const layer = layers[layerIndex];
        if (!layer) {
          errors.push(`Layer index ${layerIndex} does not exist`);
          continue;
        }

        const dataset = db.prepare(
          "SELECT schema_json, data_json FROM datasets WHERE id = ?"
        ).get(Number(datasetId));

        if (!dataset) {
          errors.push(`Dataset ${datasetId} not found`);
          continue;
        }

        let records = [];
        try {
          records = JSON.parse(dataset.data_json || "[]");
        } catch {
          errors.push(`Dataset ${datasetId} has invalid data`);
          continue;
        }

        const parseRule = source.parseRule || layer.parseRule || null;
        const valueCounts = new Map();

        for (const record of records) {
          const expanded = expandRawValues(record[fieldName]);
          for (const expandedValue of expanded) {
            const parsedValues = applyParseRule(expandedValue, parseRule);
            for (const value of parsedValues) {
              valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
            }
          }
        }

        totalExtracted += valueCounts.size;

        for (const [rawValue, count] of valueCounts.entries()) {
          /* Check if this is a new mapping */
          const existingMapping = db.prepare(`
            SELECT id FROM taxonomy_mappings
            WHERE taxonomy_id = ? AND layer_index = ?
              AND source_dataset_id = ? AND source_field = ? AND raw_value = ?
          `).get(taxonomyId, layerIndex, Number(datasetId), fieldName, rawValue);

          if (!existingMapping) {
            totalNew += 1;
          }

          insertMapping.run(
            taxonomyId,
            layerIndex,
            Number(datasetId),
            fieldName,
            rawValue,
            rawValue, /* Default refined = same as raw */
            count
          );
        }
      }

      layers.forEach((layer, layerIndex) => {
        if (!layer || layer.origin !== "derived") {
          return;
        }

        const parentIndex = Number(layer.derivedFromLayerIndex);
        if (!Number.isInteger(parentIndex) || parentIndex < 0 || parentIndex >= layers.length) {
          errors.push(`Derived layer ${layerIndex} has an invalid parent layer`);
          return;
        }

        const parentMappings = db.prepare(`
          SELECT source_dataset_id, source_field, raw_value, refined_value, occurrence_count
          FROM taxonomy_mappings
          WHERE taxonomy_id = ? AND layer_index = ?
        `).all(taxonomyId, parentIndex);

        const valueCounts = new Map();
        for (const parent of parentMappings) {
          const derivedValue = String(parent.refined_value ?? parent.raw_value ?? "").trim();
          if (!derivedValue) {
            continue;
          }

          const key = `${parent.source_dataset_id}\0${parent.source_field}\0${derivedValue}`;
          const current = valueCounts.get(key) || {
            datasetId: parent.source_dataset_id,
            fieldName: parent.source_field,
            rawValue: derivedValue,
            count: 0,
          };
          current.count += parent.occurrence_count || 1;
          valueCounts.set(key, current);
        }

        totalExtracted += valueCounts.size;

        for (const item of valueCounts.values()) {
          const existingMapping = db.prepare(`
            SELECT id FROM taxonomy_mappings
            WHERE taxonomy_id = ? AND layer_index = ?
              AND source_dataset_id = ? AND source_field = ? AND raw_value = ?
          `).get(taxonomyId, layerIndex, Number(item.datasetId), item.fieldName, item.rawValue);

          if (!existingMapping) {
            totalNew += 1;
          }

          insertMapping.run(
            taxonomyId,
            layerIndex,
            Number(item.datasetId),
            item.fieldName,
            item.rawValue,
            item.rawValue,
            item.count
          );
        }
      });
    });

    extractEntities();

    /* Update taxonomy timestamp */
    db.prepare(
      "UPDATE taxonomies SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(taxonomyId);

    const totalMappings = db.prepare(
      "SELECT COUNT(*) as cnt FROM taxonomy_mappings WHERE taxonomy_id = ?"
    ).get(taxonomyId);

    const reviewed = db.prepare(
      "SELECT COUNT(*) as cnt FROM taxonomy_mappings WHERE taxonomy_id = ? AND review_status = 'reviewed'"
    ).get(taxonomyId);

    return res.json({
      success: true,
      totalExtracted,
      newEntities: totalNew,
      totalMappings: totalMappings.cnt,
      reviewed: reviewed.cnt,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Extract entities error:", error);
    return res.status(500).json({ success: false, message: "Failed to extract entities" });
  }
});

/* =======================================================
   TAXONOMY — MAPPINGS (bulk upsert)
======================================================= */

app.get("/taxonomies/:id/mappings", (req, res) => {
  try {
    const taxonomyId = Number(req.params.id);
    if (!Number.isInteger(taxonomyId)) {
      return res.status(400).json({ success: false, message: "Invalid taxonomy id" });
    }

    const taxonomy = db.prepare(
      "SELECT id FROM taxonomies WHERE id = ?"
    ).get(taxonomyId);

    if (!taxonomy) {
      return res.status(404).json({ success: false, message: "Taxonomy not found" });
    }

    const search = req.query.search
      ? String(req.query.search).trim()
      : "";

    const statusFilter = req.query.status
      ? String(req.query.status).trim()
      : "";

    const layerFilter = req.query.layerIndex != null
      ? Number(req.query.layerIndex)
      : null;

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(500, Math.max(10, Number(req.query.pageSize) || 100));
    const offset = (page - 1) * pageSize;

    let where = "WHERE taxonomy_id = ?";
    const params = [taxonomyId];

    if (search) {
      where += " AND (raw_value LIKE ? OR refined_value LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (statusFilter) {
      where += " AND review_status = ?";
      params.push(statusFilter);
    }

    if (layerFilter !== null && !Number.isNaN(layerFilter)) {
      where += " AND layer_index = ?";
      params.push(layerFilter);
    }

    const totalRow = db.prepare(
      `SELECT COUNT(*) as cnt FROM taxonomy_mappings ${where}`
    ).get(...params);

    const mappings = db.prepare(
      `SELECT id, layer_index, source_dataset_id, source_field,
              raw_value, refined_value, review_status, occurrence_count
       FROM taxonomy_mappings ${where}
       ORDER BY layer_index, source_dataset_id, source_field, raw_value
       LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset);

    const stats = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN review_status = 'reviewed' THEN 1 ELSE 0 END) AS reviewed,
        SUM(CASE WHEN review_status = 'unreviewed' THEN 1 ELSE 0 END) AS unreviewed,
        SUM(CASE WHEN review_status = 'unmapped' OR refined_value IS NULL OR TRIM(COALESCE(refined_value, '')) = '' THEN 1 ELSE 0 END) AS unmapped
      FROM taxonomy_mappings
      WHERE taxonomy_id = ?
    `).get(taxonomyId);

    return res.json({
      success: true,
      mappings,
      total: totalRow.cnt,
      page,
      pageSize,
      stats,
    });
  } catch (error) {
    console.error("Get mappings error:", error);
    return res.status(500).json({ success: false, message: "Failed to get mappings" });
  }
});

app.put("/taxonomies/:id/mappings", (req, res) => {
  try {
    const taxonomyId = Number(req.params.id);
    if (!Number.isInteger(taxonomyId)) {
      return res.status(400).json({ success: false, message: "Invalid taxonomy id" });
    }

    const taxonomy = db.prepare(
      "SELECT id FROM taxonomies WHERE id = ?"
    ).get(taxonomyId);

    if (!taxonomy) {
      return res.status(404).json({ success: false, message: "Taxonomy not found" });
    }

    const { mappings, markAllReviewed } = req.body || {};

    if (markAllReviewed === true) {
      const updateAllReviewed = db.transaction(() => {
        const result = db.prepare(`
          UPDATE taxonomy_mappings
          SET review_status = 'reviewed', updated_at = CURRENT_TIMESTAMP
          WHERE taxonomy_id = ? AND review_status = 'unreviewed'
        `).run(taxonomyId);
        if (result.changes > 0) {
          db.prepare(`
            UPDATE taxonomies
            SET version = version + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(taxonomyId);
        }
        return result.changes;
      });

      return res.json({ success: true, updatedCount: updateAllReviewed() });
    }

    if (!Array.isArray(mappings)) {
      return res.status(400).json({ success: false, message: "mappings must be an array" });
    }

    const updateMapping = db.prepare(`
      UPDATE taxonomy_mappings
      SET refined_value = ?,
          review_status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND taxonomy_id = ?
    `);

    const bulkUpdate = db.transaction(() => {
      let updatedCount = 0;
      for (const mapping of mappings) {
        const { id, refinedValue, reviewStatus } = mapping;
        if (!id) continue;

        const validStatuses = ["unreviewed", "reviewed", "unmapped"];
        const status = validStatuses.includes(reviewStatus) ? reviewStatus : "reviewed";

        const result = updateMapping.run(
          refinedValue != null ? String(refinedValue) : null,
          status,
          Number(id),
          taxonomyId
        );
        updatedCount += result.changes;
      }
      return updatedCount;
    });

    const updatedCount = bulkUpdate();

    /* Update taxonomy version to signal transforms may be stale */
    db.prepare(`
      UPDATE taxonomies
      SET version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(taxonomyId);

    return res.json({ success: true, updatedCount });
  } catch (error) {
    console.error("Update mappings error:", error);
    return res.status(500).json({ success: false, message: "Failed to update mappings" });
  }
});

/* =======================================================
   TAXONOMY — COMPLETE (validate & mark complete)
======================================================= */

app.post("/taxonomies/:id/complete", (req, res) => {
  try {
    const taxonomyId = Number(req.params.id);
    if (!Number.isInteger(taxonomyId)) {
      return res.status(400).json({ success: false, message: "Invalid taxonomy id" });
    }

    const taxonomy = db.prepare(
      "SELECT * FROM taxonomies WHERE id = ?"
    ).get(taxonomyId);

    if (!taxonomy) {
      return res.status(404).json({ success: false, message: "Taxonomy not found" });
    }

    const layers = JSON.parse(taxonomy.layers_json || "[]");
    const sources = JSON.parse(taxonomy.sources_json || "[]");

    const sourceValidationError = validateTaxonomySources(sources, layers);
    if (sourceValidationError) {
      return res.status(400).json({ success: false, message: sourceValidationError });
    }

    const validationErrors = [];

    if (!taxonomy.name || !taxonomy.name.trim()) {
      validationErrors.push("Taxonomy name is required");
    }

    if (layers.length === 0) {
      validationErrors.push("At least one layer must be configured");
    }

    if (sources.length === 0) {
      validationErrors.push("At least one source must be configured");
    }

    const totalMappings = db.prepare(
      "SELECT COUNT(*) as cnt FROM taxonomy_mappings WHERE taxonomy_id = ?"
    ).get(taxonomyId);

    const unreviewedCount = db.prepare(
      "SELECT COUNT(*) as cnt FROM taxonomy_mappings WHERE taxonomy_id = ? AND review_status = 'unreviewed'"
    ).get(taxonomyId);

    if (totalMappings.cnt === 0) {
      validationErrors.push("No entities have been extracted. Run extraction first.");
    }

    const unmappedCount = db.prepare(`
      SELECT COUNT(*) as cnt
      FROM taxonomy_mappings
      WHERE taxonomy_id = ?
        AND (review_status = 'unmapped' OR refined_value IS NULL OR TRIM(refined_value) = '')
    `).get(taxonomyId);

    if (unmappedCount.cnt > 0) {
      validationErrors.push(
        `${unmappedCount.cnt} entit${unmappedCount.cnt === 1 ? "y is" : "ies are"} unmapped. Map them or save as a draft.`
      );
    }

    const sourceLayers = layers.filter((layer) => !layer.origin || layer.origin === "source");
    if (sourceLayers.length > 0 && sources.length === 0) {
      validationErrors.push("At least one source must be configured");
    }

    if (validationErrors.length > 0) {
      return res.status(422).json({
        success: false,
        message: "Taxonomy validation failed",
        errors: validationErrors,
        unreviewedCount: unreviewedCount.cnt,
        totalMappings: totalMappings.cnt,
      });
    }

    db.prepare(`
      UPDATE taxonomies
      SET status = 'complete', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(taxonomyId);

    return res.json({
      success: true,
      unreviewedCount: unreviewedCount.cnt,
      totalMappings: totalMappings.cnt,
    });
  } catch (error) {
    console.error("Complete taxonomy error:", error);
    return res.status(500).json({ success: false, message: "Failed to complete taxonomy" });
  }
});

/* =======================================================
   TRANSFORM FUNCTIONS CRUD
======================================================= */

app.get("/transforms", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, name, description, function_type, config_json,
             output_dataset_id, output_attribute_name,
             execution_status, last_executed_at, taxonomy_version_at_execution,
             created_at, updated_at
      FROM transform_functions
      ORDER BY updated_at DESC
    `).all();

    const transforms = rows.map((row) => ({
      ...row,
      config: JSON.parse(row.config_json || "{}"),
    }));

    return res.json({ success: true, transforms });
  } catch (error) {
    console.error("List transforms error:", error);
    return res.status(500).json({ success: false, message: "Failed to list transforms" });
  }
});

app.post("/transforms", (req, res) => {
  try {
    const { name, description, functionType, config, outputDatasetId, outputAttributeName } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Transform name is required" });
    }

    const validTypes = ["string_mapper", "column_combiner"];
    if (!validTypes.includes(functionType)) {
      return res.status(400).json({
        success: false,
        message: `functionType must be one of: ${validTypes.join(", ")}`,
      });
    }

    if (!outputDatasetId) {
      return res.status(400).json({ success: false, message: "outputDatasetId is required" });
    }

    if (!outputAttributeName || !String(outputAttributeName).trim()) {
      return res.status(400).json({ success: false, message: "outputAttributeName is required" });
    }

    const normalizedConfig = { ...(config || {}) };
    if (functionType === "string_mapper" && !normalizedConfig.unmappedPolicy) {
      normalizedConfig.unmappedPolicy = "keep_raw";
    }
    if (functionType === "column_combiner" && normalizedConfig.separator == null) {
      normalizedConfig.separator = " - ";
    }

    const validationError = validateTransformConfig(
      functionType,
      normalizedConfig,
      outputDatasetId,
      outputAttributeName,
      null
    );

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const result = db.prepare(`
      INSERT INTO transform_functions (
        name, description, function_type, config_json,
        output_dataset_id, output_attribute_name, execution_status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      String(name).trim(),
      String(description || "").trim() || null,
      functionType,
      JSON.stringify(normalizedConfig),
      Number(outputDatasetId),
      String(outputAttributeName).trim()
    );

    const created = db.prepare(
      "SELECT * FROM transform_functions WHERE id = ?"
    ).get(result.lastInsertRowid);

    return res.json({
      success: true,
      transform: { ...created, config: JSON.parse(created.config_json || "{}") },
    });
  } catch (error) {
    console.error("Create transform error:", error);
    return res.status(500).json({ success: false, message: "Failed to create transform" });
  }
});

app.get("/transforms/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: "Invalid transform id" });
    }

    const row = db.prepare(
      "SELECT * FROM transform_functions WHERE id = ?"
    ).get(id);

    if (!row) {
      return res.status(404).json({ success: false, message: "Transform not found" });
    }

    return res.json({
      success: true,
      transform: { ...row, config: JSON.parse(row.config_json || "{}") },
    });
  } catch (error) {
    console.error("Get transform error:", error);
    return res.status(500).json({ success: false, message: "Failed to get transform" });
  }
});

app.put("/transforms/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: "Invalid transform id" });
    }

    const existing = db.prepare(
      "SELECT * FROM transform_functions WHERE id = ?"
    ).get(id);

    if (!existing) {
      return res.status(404).json({ success: false, message: "Transform not found" });
    }

    const { name, description, config, outputDatasetId, outputAttributeName } = req.body;

    const nextConfig = config || JSON.parse(existing.config_json || "{}");
    const nextOutputDatasetId = outputDatasetId != null ? Number(outputDatasetId) : existing.output_dataset_id;
    const nextOutputName = outputAttributeName
      ? String(outputAttributeName).trim()
      : existing.output_attribute_name;

    const validationError = validateTransformConfig(
      existing.function_type,
      nextConfig,
      nextOutputDatasetId,
      nextOutputName,
      id
    );

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    db.prepare(`
      UPDATE transform_functions
      SET name = ?,
          description = ?,
          config_json = ?,
          output_dataset_id = ?,
          output_attribute_name = ?,
          execution_status = 'pending',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ? String(name).trim() : existing.name,
      description != null ? String(description).trim() || null : existing.description,
      JSON.stringify(nextConfig),
      nextOutputDatasetId,
      nextOutputName,
      id
    );

    const updated = db.prepare(
      "SELECT * FROM transform_functions WHERE id = ?"
    ).get(id);

    return res.json({
      success: true,
      transform: { ...updated, config: JSON.parse(updated.config_json || "{}") },
    });
  } catch (error) {
    console.error("Update transform error:", error);
    return res.status(500).json({ success: false, message: "Failed to update transform" });
  }
});

app.delete("/transforms/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: "Invalid transform id" });
    }

    const existing = db.prepare(
      "SELECT * FROM transform_functions WHERE id = ?"
    ).get(id);

    if (!existing) {
      return res.status(404).json({ success: false, message: "Transform not found" });
    }

    // 1. Gather all attribute names associated with this transform
    const attrNamesToDelete = new Set();
    if (existing.output_attribute_name) {
      attrNamesToDelete.add(existing.output_attribute_name);
      attrNamesToDelete.add(reviewFlagFieldName(existing.output_attribute_name));
    }

    // Find all registered app attributes for this transform
    const registeredAttrs = db.prepare(
      "SELECT dataset_id, attribute_name FROM app_attributes WHERE transform_id = ?"
    ).all(id);

    for (const row of registeredAttrs) {
      if (row.attribute_name) {
        attrNamesToDelete.add(row.attribute_name);
        attrNamesToDelete.add(reviewFlagFieldName(row.attribute_name));
      }
    }

    // 2. Identify candidate datasets that could contain columns/data from this transform
    const candidateDatasetIds = new Set();
    if (existing.output_dataset_id) {
      candidateDatasetIds.add(Number(existing.output_dataset_id));
    }
    for (const row of registeredAttrs) {
      if (row.dataset_id) {
        candidateDatasetIds.add(Number(row.dataset_id));
      }
    }

    // Retrieve all datasets to ensure any dataset with schema containing this transform or attribute is cleaned
    const allDatasets = db.prepare("SELECT id, schema_json, data_json FROM datasets").all();

    // 3. Perform cleanup atomically in a transaction
    const deleteTx = db.transaction(() => {
      for (const ds of allDatasets) {
        const isTarget = candidateDatasetIds.has(ds.id);
        const schema = parseDatasetSchema(ds.schema_json);

        // Determine which columns in this dataset belong to the deleted transform
        const colsToRemove = new Set();
        for (const col of schema) {
          if (!col || !col.name) continue;
          if (col.transformId === id) {
            colsToRemove.add(col.name);
          } else if (col.isAppAttribute && attrNamesToDelete.has(col.name)) {
            colsToRemove.add(col.name);
          } else if (isTarget && attrNamesToDelete.has(col.name)) {
            colsToRemove.add(col.name);
          }
        }

        if (colsToRemove.size > 0) {
          // Remove from schema_json
          const updatedSchema = schema.filter(
            (col) => !colsToRemove.has(col.name) && col.transformId !== id
          );

          // Remove fields from data_json records
          let records = [];
          try {
            records = JSON.parse(ds.data_json || "[]");
          } catch {
            records = [];
          }

          if (Array.isArray(records)) {
            for (const record of records) {
              if (record && typeof record === "object") {
                for (const colName of colsToRemove) {
                  if (colName in record) {
                    delete record[colName];
                  }
                }
              }
            }
          }

          const sizeKB = Buffer.byteLength(JSON.stringify(records)) / 1024;
          db.prepare(`
            UPDATE datasets
            SET data_json = ?,
                schema_json = ?,
                size_kb = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            JSON.stringify(records),
            JSON.stringify(updatedSchema),
            sizeKB,
            ds.id
          );

          // Clean up view preferences for removed fields
          try {
            const pref = db.prepare(
              "SELECT field_settings_json FROM dataset_view_preferences WHERE dataset_id = ?"
            ).get(ds.id);
            if (pref && pref.field_settings_json) {
              const fs = JSON.parse(pref.field_settings_json || "{}");
              let fsChanged = false;
              for (const colName of colsToRemove) {
                if (fs[colName] !== undefined) {
                  delete fs[colName];
                  fsChanged = true;
                }
              }
              if (fsChanged) {
                db.prepare(`
                  UPDATE dataset_view_preferences
                  SET field_settings_json = ?, updated_at = CURRENT_TIMESTAMP
                  WHERE dataset_id = ?
                `).run(JSON.stringify(fs), ds.id);
              }
            }
          } catch (prefErr) {
            console.warn("Clean view preferences warning:", prefErr);
          }
        }
      }

      // Delete from app_attributes table
      db.prepare("DELETE FROM app_attributes WHERE transform_id = ?").run(id);

      for (const dsId of candidateDatasetIds) {
        for (const attr of attrNamesToDelete) {
          db.prepare(
            "DELETE FROM app_attributes WHERE dataset_id = ? AND attribute_name = ?"
          ).run(dsId, attr);
        }
      }

      // Finally delete from transform_functions table
      db.prepare("DELETE FROM transform_functions WHERE id = ?").run(id);
    });

    deleteTx();

    return res.json({
      success: true,
      message: "Transform function and associated field deleted successfully",
      deletedAttributes: Array.from(attrNamesToDelete),
    });
  } catch (error) {
    console.error("Delete transform error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete transform" });
  }
});

function parseDatasetSchema(schemaJson) {
  try {
    const parsed = JSON.parse(schemaJson || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function datasetHasField(schema, fieldName) {
  return schema.some((column) => column?.name === fieldName);
}

function reviewFlagFieldName(outputAttr) {
  return `${outputAttr}__needs_review`;
}

function loadMapperMappings(config) {
  const taxonomyId = Number(config.taxonomyId);
  const layerIndex = Number(config.layerIndex);
  const inputDatasetId = Number(config.inputDatasetId);
  const inputField = config.inputField;
  if (!Number.isInteger(taxonomyId) || !Number.isInteger(layerIndex) || !Number.isInteger(inputDatasetId) || !inputField) {
    throw new Error("Mapper requires a valid taxonomy, layer, input dataset, and input field");
  }
  const taxonomy = db.prepare("SELECT id, layers_json, sources_json FROM taxonomies WHERE id = ?").get(taxonomyId);
  if (!taxonomy) throw new Error("Selected taxonomy was not found");
  const layers = JSON.parse(taxonomy.layers_json || "[]");
  const sources = JSON.parse(taxonomy.sources_json || "[]");
  if (!layers[layerIndex]) throw new Error("Selected taxonomy layer does not exist");
  const derivedLayer = layers[layerIndex]?.origin === "derived";
  const sourceConfigured = sources.some((source) => Number(source.datasetId) === inputDatasetId && source.fieldName === inputField && Number(source.layerIndex) === layerIndex);
  if (!sourceConfigured && !derivedLayer) throw new Error("Selected taxonomy layer is not configured for this dataset field");

  return db.prepare(`
    SELECT raw_value, refined_value, review_status
    FROM taxonomy_mappings
    WHERE taxonomy_id = ? AND layer_index = ?
      AND source_dataset_id = ? AND source_field = ?
  `).all(taxonomyId, layerIndex, inputDatasetId, String(inputField));
}

function validateTransformConfig(functionType, config, outputDatasetId, outputAttributeName, transformId) {
  if (!config || typeof config !== "object") {
    return "Transform configuration is required";
  }

  const outputName = String(outputAttributeName || "").trim();
  if (!outputName) {
    return "outputAttributeName is required";
  }

  const outputDataset = db.prepare(
    "SELECT id, schema_json, data_type FROM datasets WHERE id = ?"
  ).get(Number(outputDatasetId));

  if (!outputDataset) {
    return "Output dataset not found";
  }

  if (String(outputDataset.data_type || "").toLowerCase() !== "tagged") {
    return "Target dataset must be a tagged dataset";
  }

  const outputSchema = parseDatasetSchema(outputDataset.schema_json);
  const conflictingOriginal = outputSchema.find(
    (column) => column?.name === outputName && !column.isAppAttribute
  );
  if (conflictingOriginal) {
    return `Output name "${outputName}" conflicts with an existing custom attribute`;
  }

  const existingAttr = db.prepare(`
    SELECT transform_id FROM app_attributes
    WHERE dataset_id = ? AND attribute_name = ?
  `).get(Number(outputDatasetId), outputName);

  if (
    existingAttr &&
    existingAttr.transform_id &&
    transformId &&
    Number(existingAttr.transform_id) !== Number(transformId)
  ) {
    return `Output name "${outputName}" is already generated by another transform`;
  }

  if (functionType === "string_mapper") {
    const unmappedPolicy = config.unmappedPolicy || "keep_raw";
    const validPolicies = ["keep_raw", "blank", "flag_review"];
    if (!validPolicies.includes(unmappedPolicy)) {
      return "unmappedPolicy must be keep_raw, blank, or flag_review";
    }

    if (!config.inputDatasetId || !config.inputField) {
      return "Input dataset and field are required";
    }

    const inputDataset = db.prepare(
      "SELECT id, schema_json, data_type FROM datasets WHERE id = ?"
    ).get(Number(config.inputDatasetId));

    if (!inputDataset) {
      return "Input dataset not found";
    }

    if (String(inputDataset.data_type || "").toLowerCase() !== "tagged") {
      return "Input dataset must be a tagged dataset";
    }

    const inputSchema = parseDatasetSchema(inputDataset.schema_json);
    if (!datasetHasField(inputSchema, config.inputField)) {
      return `Input field "${config.inputField}" was not found on the selected dataset`;
    }

    if (config.taxonomyId == null || config.layerIndex == null) {
      return "Taxonomy and layer are required";
    }

    const taxonomy = db.prepare(
      "SELECT id, sources_json, layers_json FROM taxonomies WHERE id = ?"
    ).get(Number(config.taxonomyId));

    if (!taxonomy) {
      return "Selected taxonomy was not found";
    }

    const layers = JSON.parse(taxonomy.layers_json || "[]");
    const sources = JSON.parse(taxonomy.sources_json || "[]");
    const layerIndex = Number(config.layerIndex);

    if (!layers[layerIndex]) {
      return "Selected taxonomy layer does not exist";
    }

    const compatible = sources.some(
      (source) =>
        Number(source.datasetId) === Number(config.inputDatasetId) &&
        source.fieldName === config.inputField &&
        Number(source.layerIndex) === layerIndex
    );

    const derivedLayer = layers[layerIndex]?.origin === "derived";
    if (!compatible && !derivedLayer) {
      return "The selected taxonomy layer is not configured for this dataset field";
    }
  }

  if (functionType === "column_combiner") {
    if (!config.inputDatasetId || !config.field1 || !config.field2) {
      return "Input dataset and both fields are required";
    }

    if (config.field1 === config.field2) {
      return "The two input fields must be different";
    }

    const mismatchPolicy = config.mismatchPolicy || "flag_review";
    if (!["flag_review", "blank"].includes(mismatchPolicy)) {
      return "mismatchPolicy must be flag_review or blank";
    }

    const inputDataset = db.prepare(
      "SELECT id, schema_json, data_type FROM datasets WHERE id = ?"
    ).get(Number(config.inputDatasetId));

    if (!inputDataset) {
      return "Input dataset not found";
    }

    if (String(inputDataset.data_type || "").toLowerCase() !== "tagged") {
      return "Input dataset must be a tagged dataset";
    }

    const inputSchema = parseDatasetSchema(inputDataset.schema_json);
    if (!datasetHasField(inputSchema, config.field1)) {
      return `Field "${config.field1}" was not found on the selected dataset`;
    }
    if (!datasetHasField(inputSchema, config.field2)) {
      return `Field "${config.field2}" was not found on the selected dataset`;
    }
  }

  return null;
}

function runTransform(functionType, records, config) {
  if (functionType === "string_mapper") {
    return applyStringMapper(records, config, loadMapperMappings(config));
  }

  if (functionType === "column_combiner") {
    return applyColumnCombiner(records, config);
  }

  return null;
}

function applyResultsToRecords({
  outputRecords,
  outputSchema,
  inputRecords,
  inputSchema,
  results,
  outputAttr,
  functionType,
  includeReviewFlag,
}) {
  const inputId = getIdColumn(inputSchema);
  const outputId = getIdColumn(outputSchema);
  const canJoinById = !inputId.error && !outputId.error;

  const resultById = new Map();
  if (canJoinById) {
    inputRecords.forEach((record, index) => {
      const id = normalizeIdValue(record?.[inputId.column.name]);
      if (id) {
        resultById.set(id, results[index]);
      }
    });
  }

  const reviewField = reviewFlagFieldName(outputAttr);

  return outputRecords.map((record, index) => {
    const next = { ...record };
    let result;

    if (canJoinById) {
      const id = normalizeIdValue(record?.[outputId.column.name]);
      result = id ? resultById.get(id) : undefined;
    } else {
      result = results[index];
    }

    if (result === undefined) {
      next[outputAttr] = null;
      if (includeReviewFlag) {
        next[reviewField] = null;
      }
      return next;
    }

    next[outputAttr] = functionType === "string_mapper"
      ? result.refinedOutput
      : result.output;

    if (includeReviewFlag) {
      next[reviewField] = result.needsReview ? "true" : "false";
    }

    return next;
  });
}

/* =======================================================
   TRANSFORM — PREVIEW
======================================================= */

app.post("/transforms/:id/preview", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: "Invalid transform id" });
    }

    const transform = db.prepare(
      "SELECT * FROM transform_functions WHERE id = ?"
    ).get(id);

    if (!transform) {
      return res.status(404).json({ success: false, message: "Transform not found" });
    }

    const config = JSON.parse(transform.config_json || "{}");
    const { sampleSize = 50 } = req.body || {};

    const inputDatasetId = Number(config.inputDatasetId);
    const dataset = db.prepare(
      "SELECT data_json FROM datasets WHERE id = ?"
    ).get(inputDatasetId);

    if (!dataset) {
      return res.status(404).json({ success: false, message: "Input dataset not found" });
    }

    const records = JSON.parse(dataset.data_json || "[]");
    const sample = records.slice(0, Math.min(Number(sampleSize) || 50, records.length));

    let previewResult;
    if (transform.function_type === "string_mapper") {
      const validationError = validateTransformConfig(transform.function_type, config, transform.output_dataset_id, transform.output_attribute_name, id);
      if (validationError) return res.status(400).json({ success: false, message: validationError });
      previewResult = runTransform(transform.function_type, sample, config);
    } else if (transform.function_type === "column_combiner") {
      previewResult = applyColumnCombiner(sample, config);
    } else {
      return res.status(400).json({ success: false, message: "Unknown function type" });
    }

    /* Check if taxonomy version has changed since last execution */
    let taxonomyStale = false;
    if (transform.function_type === "string_mapper" && config.taxonomyId) {
      const taxonomy = db.prepare(
        "SELECT version FROM taxonomies WHERE id = ?"
      ).get(Number(config.taxonomyId));
      if (
        taxonomy &&
        transform.taxonomy_version_at_execution != null &&
        taxonomy.version !== transform.taxonomy_version_at_execution
      ) {
        taxonomyStale = true;
      }
    }

    return res.json({
      success: true,
      functionType: transform.function_type,
      ...previewResult,
      sampleSize: sample.length,
      totalRecords: records.length,
      taxonomyStale,
    });
  } catch (error) {
    console.error("Preview transform error:", error);
    return res.status(500).json({ success: false, message: "Failed to preview transform" });
  }
});

/* =======================================================
   TRANSFORM — EXECUTE
======================================================= */

app.post("/transforms/:id/execute", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: "Invalid transform id" });
    }

    const transform = db.prepare(
      "SELECT * FROM transform_functions WHERE id = ?"
    ).get(id);

    if (!transform) {
      return res.status(404).json({ success: false, message: "Transform not found" });
    }

    const config = JSON.parse(transform.config_json || "{}");
    const outputDatasetId = Number(transform.output_dataset_id);
    const outputAttr = transform.output_attribute_name;

    if (!outputDatasetId || !outputAttr) {
      return res.status(400).json({
        success: false,
        message: "Transform is missing output dataset or attribute name",
      });
    }

    const outputDataset = db.prepare(
      "SELECT id, schema_json, data_json FROM datasets WHERE id = ?"
    ).get(outputDatasetId);

    if (!outputDataset) {
      return res.status(404).json({ success: false, message: "Output dataset not found" });
    }

    /* For string_mapper, inputDataset may differ from outputDataset.
       We read input records and write output attribute to outputDataset. */
    const inputDatasetId = Number(config.inputDatasetId);

    let inputRecords;
    let inputSchema;
    if (inputDatasetId === outputDatasetId) {
      /* Same dataset */
      inputRecords = JSON.parse(outputDataset.data_json || "[]");
      inputSchema = JSON.parse(outputDataset.schema_json || "[]");
    } else {
      /* Load input dataset separately */
      const inputDataset = db.prepare(
        "SELECT schema_json, data_json FROM datasets WHERE id = ?"
      ).get(inputDatasetId);
      if (!inputDataset) {
        return res.status(404).json({ success: false, message: "Input dataset not found" });
      }
      inputRecords = JSON.parse(inputDataset.data_json || "[]");
      inputSchema = JSON.parse(inputDataset.schema_json || "[]");
    }

    const outputRecords = JSON.parse(outputDataset.data_json || "[]");

    /* Build result map keyed by record index assuming same ordering when same dataset,
       or by _id when different datasets */
    let transformResult;
    if (transform.function_type === "string_mapper") {
      const validationError = validateTransformConfig(transform.function_type, config, outputDatasetId, outputAttr, id);
      if (validationError) return res.status(400).json({ success: false, message: validationError });
      transformResult = runTransform(transform.function_type, inputRecords, config);
    } else if (transform.function_type === "column_combiner") {
      transformResult = applyColumnCombiner(inputRecords, config);
    } else {
      return res.status(400).json({ success: false, message: "Unknown function type" });
    }

    /* Update schema to include the new App Attribute column */
    let schema = [];
    try {
      schema = JSON.parse(outputDataset.schema_json || "[]");
    } catch {
      schema = [];
    }

    const includeReviewFlag =
      (transform.function_type === "string_mapper" &&
        config.unmappedPolicy === "flag_review") ||
      (transform.function_type === "column_combiner" &&
        (config.mismatchPolicy || "flag_review") === "flag_review");

    /* Join by _id when the source and output datasets differ. This preserves
       Raw/Tagged record relationships instead of assuming matching row order. */
    const updatedRecords = applyResultsToRecords({
      outputRecords,
      outputSchema: schema,
      inputRecords,
      inputSchema,
      results: transformResult.results,
      outputAttr,
      functionType: transform.function_type,
      includeReviewFlag,
    });

    /* Remove existing entry for this attribute (idempotent) */
    const schemaWithoutAttr = schema.filter(
      (col) => col.name !== outputAttr
    );

    const newSchemaCol = {
      name: outputAttr,
      type: transformResult.results.some(
        (result) => Array.isArray(transform.function_type === "string_mapper" ? result.refinedOutput : result.output)
      ) ? "list" : "text",
      ontologyMapping: "",
      isAppAttribute: true,
      transformId: id,
    };

    const reviewField = reviewFlagFieldName(outputAttr);
    const schemaWithoutReviewField = schemaWithoutAttr.filter(
      (col) => col.name !== reviewField
    );
    const updatedSchema = [
      ...schemaWithoutReviewField,
      newSchemaCol,
      ...(includeReviewFlag ? [{
        name: reviewField,
        type: "text",
        ontologyMapping: "",
        isAppAttribute: true,
        transformId: id,
      }] : []),
    ];

    /* Get taxonomy version at execution */
    let taxonomyVersion = null;
    if (transform.function_type === "string_mapper" && config.taxonomyId) {
      const taxonomy = db.prepare(
        "SELECT version FROM taxonomies WHERE id = ?"
      ).get(Number(config.taxonomyId));
      taxonomyVersion = taxonomy ? taxonomy.version : null;
    }

    /* Persist atomically */
    const executeTransaction = db.transaction(() => {
      const sizeKB = Buffer.byteLength(JSON.stringify(updatedRecords)) / 1024;

      db.prepare(`
        UPDATE datasets
        SET data_json = ?,
            schema_json = ?,
            size_kb = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        JSON.stringify(updatedRecords),
        JSON.stringify(updatedSchema),
        sizeKB,
        outputDatasetId
      );

      /* Register in app_attributes */
      db.prepare(`
        INSERT INTO app_attributes (dataset_id, attribute_name, transform_id)
        VALUES (?, ?, ?)
        ON CONFLICT(dataset_id, attribute_name) DO UPDATE SET
          transform_id = excluded.transform_id,
          created_at = created_at
      `).run(outputDatasetId, outputAttr, id);

      if (includeReviewFlag) {
        db.prepare(`
          INSERT INTO app_attributes (dataset_id, attribute_name, transform_id)
          VALUES (?, ?, ?)
          ON CONFLICT(dataset_id, attribute_name) DO UPDATE SET
            transform_id = excluded.transform_id
        `).run(outputDatasetId, reviewField, id);
      } else {
        db.prepare(`
          DELETE FROM app_attributes
          WHERE dataset_id = ? AND attribute_name = ? AND transform_id = ?
        `).run(outputDatasetId, reviewField, id);
      }

      /* Update transform execution status */
      db.prepare(`
        UPDATE transform_functions
        SET execution_status = 'executed',
            last_executed_at = CURRENT_TIMESTAMP,
            taxonomy_version_at_execution = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(taxonomyVersion, id);
    });

    executeTransaction();

    return res.json({
      success: true,
      ...transformResult.summary,
      outputDatasetId,
      outputAttributeName: outputAttr,
    });
  } catch (error) {
    console.error("Execute transform error:", error);

    /* Mark transform as errored */
    try {
      db.prepare(`
        UPDATE transform_functions
        SET execution_status = 'error', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(Number(req.params.id));
    } catch (_) { /* best effort */ }

    return res.status(500).json({ success: false, message: "Failed to execute transform" });
  }
});

/* =======================================================
   TRANSFORM — UNMAPPED VALUE SUMMARY
======================================================= */

app.get("/transforms/:id/unmapped", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: "Invalid transform id" });
    }

    const transform = db.prepare(
      "SELECT * FROM transform_functions WHERE id = ?"
    ).get(id);

    if (!transform) {
      return res.status(404).json({ success: false, message: "Transform not found" });
    }

    if (transform.function_type !== "string_mapper") {
      return res.json({ success: true, unmapped: [], message: "Only string_mapper transforms have unmapped values" });
    }

    const config = JSON.parse(transform.config_json || "{}");
    const { inputDatasetId, inputField, taxonomyId, layerIndex } = config;

    if (!inputDatasetId || !inputField || taxonomyId == null || layerIndex == null) {
      return res.status(400).json({ success: false, message: "Transform config is incomplete" });
    }

    const dataset = db.prepare(
      "SELECT data_json FROM datasets WHERE id = ?"
    ).get(Number(inputDatasetId));

    if (!dataset) {
      return res.status(404).json({ success: false, message: "Input dataset not found" });
    }

    const records = JSON.parse(dataset.data_json || "[]");

    const mappingRows = db.prepare(`
      SELECT raw_value
      FROM taxonomy_mappings
      WHERE taxonomy_id = ? AND layer_index = ?
    `).all(Number(taxonomyId), Number(layerIndex));

    const mappedKeys = new Set(
      mappingRows.map((r) => String(r.raw_value).trim().toLowerCase())
    );

    const unmappedCounts = new Map();
    for (const record of records) {
      const rawVal = record[inputField];
      if (rawVal == null || String(rawVal).trim() === "") continue;
      const key = String(rawVal).trim().toLowerCase();
      if (!mappedKeys.has(key)) {
        const display = String(rawVal).trim();
        unmappedCounts.set(display, (unmappedCounts.get(display) || 0) + 1);
      }
    }

    const unmapped = Array.from(unmappedCounts.entries()).map(([value, count]) => ({
      value,
      count,
    })).sort((a, b) => b.count - a.count);

    return res.json({ success: true, unmapped });
  } catch (error) {
    console.error("Unmapped values error:", error);
    return res.status(500).json({ success: false, message: "Failed to get unmapped values" });
  }
});

/* =======================================================
   APP ATTRIBUTES — LIST FOR DATASET
======================================================= */

app.get("/datasets/:id/app-attributes", (req, res) => {
  try {
    const datasetId = Number(req.params.id);
    if (!Number.isInteger(datasetId)) {
      return res.status(400).json({ success: false, message: "Invalid dataset id" });
    }

    const attrs = db.prepare(`
      SELECT aa.id, aa.attribute_name, aa.transform_id, aa.created_at,
             tf.name as transform_name, tf.function_type, tf.execution_status
      FROM app_attributes aa
      LEFT JOIN transform_functions tf ON tf.id = aa.transform_id
      WHERE aa.dataset_id = ?
      ORDER BY aa.created_at DESC
    `).all(datasetId);

    return res.json({ success: true, appAttributes: attrs });
  } catch (error) {
    console.error("App attributes error:", error);
    return res.status(500).json({ success: false, message: "Failed to get app attributes" });
  }
});

/* =======================================================
   STATIC FRONTEND & SERVER
======================================================= */

const distPath = path.resolve(__dirname, "../../dist");
app.use(express.static(distPath));

app.use((req, res, next) => {
  if (
    req.method !== "GET" ||
    req.path.startsWith("/datasets") ||
    req.path.startsWith("/upload") ||
    req.path.startsWith("/ollama") ||
    req.path.startsWith("/taxonomies") ||
    req.path.startsWith("/transforms")
  ) {
    return next();
  }
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) next();
  });
});

const PORT = process.env.PORT || 5000;

app.listen(
  PORT,
  () => {
    console.log(
      `Server running on port ${PORT}`
    );
  }
);
