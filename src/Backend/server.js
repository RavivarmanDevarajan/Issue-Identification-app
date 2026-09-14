import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import Papa from "papaparse";

const app = express();

app.use(cors());
app.use(express.json());

/* =======================================================
   DATABASE
======================================================= */

const db = new Database("database.db");

console.log("SQLite Connected");

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
   SERVER
======================================================= */

app.listen(
  5000,
  () => {

    console.log(
      "Server running on port 5000"
    );
  }
);