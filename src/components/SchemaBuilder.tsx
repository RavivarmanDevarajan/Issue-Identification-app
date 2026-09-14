import React, {
  useState,
  useEffect,
} from "react";

/* ======================================================
   TYPES
====================================================== */

type ColumnType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "list"
  | "multiline";

type OntologyType =
  | ""
  | "_id"
  | "opentimestamp"
  | "clientAttributes"
  | "freeText"
  | "customAttributes";

interface Column {
  name: string;
  type: ColumnType;
  ontologyMapping: OntologyType;
  error: string;
  include: boolean;
  sample: string;
}

/* ======================================================
   COMPONENT
====================================================== */

export default function SchemaBuilder({
  initialData,
  datasetName,
  fileName,
  ingestionType,
  parentDatasetId,
  back,
}: any) {

  /* ====================================================
     STATE
  ==================================================== */

  const [
    columns,
    setColumns,
  ] = useState<Column[]>([]);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  /*
    Parent Raw dataset schema.

    Only used for Tagged Data.
  */
  const [
    parentSchema,
    setParentSchema,
  ] = useState<any>(null);

  const [
    loadingParentSchema,
    setLoadingParentSchema,
  ] = useState(false);

  const [
    parentSchemaError,
    setParentSchemaError,
  ] = useState("");

  /*
    Parent Raw dataset records.

    Used for Tagged Data validation.
  */
  const [
    parentRecords,
    setParentRecords,
  ] = useState<any[]>([]);

  const [
    loadingParentRecords,
    setLoadingParentRecords,
  ] = useState(false);

  /*
    Validation result for Tagged Data.

    Kept as state for compatibility with the
    existing component structure.
  */
  const [
    taggedIdError,
    setTaggedIdError,
  ] = useState("");

  /* ====================================================
     FLEXIBLE DATE VALIDATION
  ==================================================== */

  const isValidDate = (
    value: any
  ): boolean => {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return true;
    }

    const str =
      String(value).trim();

    /* -----------------------------------------------
       NUMERIC DATES
    ------------------------------------------------ */

    const numericDateMatch =
      str.match(
        /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/
      );

    if (numericDateMatch) {

      const [
        ,
        first,
        second,
        yearString,
      ] = numericDateMatch;

      const firstNumber =
        Number(first);

      const secondNumber =
        Number(second);

      let year =
        Number(yearString);

      if (year < 100) {
        year += 2000;
      }

      let day: number;
      let month: number;

      if (
        firstNumber > 12
      ) {

        day =
          firstNumber;

        month =
          secondNumber;

      } else if (
        secondNumber > 12
      ) {

        month =
          firstNumber;

        day =
          secondNumber;

      } else {

        /*
          Ambiguous dates are interpreted
          as DD-MM-YYYY.
        */

        day =
          firstNumber;

        month =
          secondNumber;
      }

      if (
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
      ) {
        return false;
      }

      const date =
        new Date(
          year,
          month - 1,
          day
        );

      return (
        date.getFullYear() === year &&
        date.getMonth() ===
          month - 1 &&
        date.getDate() === day
      );
    }

    /* -----------------------------------------------
       TEXT MONTH DATES
    ------------------------------------------------ */

    const textDateMatch =
      str.match(
        /^(\d{1,2})[-\/\s]([A-Za-z]{3,9})[-\/\s](\d{2,4})$/
      );

    if (textDateMatch) {

      const [
        ,
        dayString,
        monthString,
        yearString,
      ] = textDateMatch;

      const day =
        Number(dayString);

      const year =
        yearString.length === 2
          ? 2000 +
            Number(yearString)
          : Number(yearString);

      const months: Record<
        string,
        number
      > = {

        jan: 0,
        january: 0,

        feb: 1,
        february: 1,

        mar: 2,
        march: 2,

        apr: 3,
        april: 3,

        may: 4,

        jun: 5,
        june: 5,

        jul: 6,
        july: 6,

        aug: 7,
        august: 7,

        sep: 8,
        september: 8,

        oct: 9,
        october: 9,

        nov: 10,
        november: 10,

        dec: 11,
        december: 11,

      };

      const month =
        months[
          monthString.toLowerCase()
        ];

      if (
        month === undefined
      ) {
        return false;
      }

      if (
        day < 1 ||
        day > 31
      ) {
        return false;
      }

      const date =
        new Date(
          year,
          month,
          day
        );

      return (
        date.getFullYear() === year &&
        date.getMonth() === month &&
        date.getDate() === day
      );
    }

    /* -----------------------------------------------
       ISO / STANDARD DATES
    ------------------------------------------------ */

    const parsed =
      Date.parse(str);

    return !isNaN(parsed);
  };

  /* ====================================================
     DETECT COLUMNS
  ==================================================== */

  useEffect(() => {

    if (
      initialData &&
      initialData.length > 0
    ) {

      const detected =
        Object.keys(
          initialData[0]
        ).map(
          (key) => ({

            name:
              key,

            type:
              "string" as ColumnType,

            ontologyMapping:
              "" as OntologyType,

            error:
              "",

            include:
              true,

            sample:
              initialData
                .slice(0, 3)
                .map(
                  (
                    row: any
                  ) =>
                    row[key]
                )
                .join(", "),

          })
        );

      setColumns(
        detected
      );

    } else {

      setColumns([]);

    }

  }, [
    initialData,
  ]);

  /* ====================================================
     LOAD PARENT RAW DATASET
  ==================================================== */

  useEffect(() => {

    /*
      Only Tagged Data needs
      a parent Raw dataset.
    */

    if (
      ingestionType !== "tagged" ||
      !parentDatasetId
    ) {

      setParentSchema(null);

      setParentRecords([]);

      setParentSchemaError("");

      return;
    }

    loadParentDataset();

  }, [
    ingestionType,
    parentDatasetId,
  ]);

  async function loadParentDataset() {

    try {

      setLoadingParentSchema(
        true
      );

      setLoadingParentRecords(
        true
      );

      setParentSchemaError("");

      /* -----------------------------------------------
         LOAD PARENT SCHEMA
      ------------------------------------------------ */

      const schemaResponse =
        await fetch(
          `http://localhost:5000/datasets/${parentDatasetId}/schema`
        );

      if (
        !schemaResponse.ok
      ) {

        throw new Error(
          `Failed to load parent schema (${schemaResponse.status})`
        );
      }

      const schemaResult =
        await schemaResponse.json();

      setParentSchema(
        schemaResult
      );

      /* -----------------------------------------------
         LOAD PARENT RECORDS
      ------------------------------------------------ */

      const dataResponse =
        await fetch(
          `http://localhost:5000/datasets/${parentDatasetId}/data`
        );

      if (
        !dataResponse.ok
      ) {

        throw new Error(
          `Failed to load parent data (${dataResponse.status})`
        );
      }

      const dataResult =
        await dataResponse.json();

      const records =
        Array.isArray(
          dataResult
        )
          ? dataResult
          : Array.isArray(
              dataResult?.records
            )
          ? dataResult.records
          : [];

      setParentRecords(
        records
      );

    } catch (error) {

      console.error(
        "Failed to load parent Raw dataset:",
        error
      );

      setParentSchemaError(
        "Unable to load the selected Raw dataset. Please go back and select the Raw dataset again."
      );

      setParentSchema(
        null
      );

      setParentRecords(
        []
      );

    } finally {

      setLoadingParentSchema(
        false
      );

      setLoadingParentRecords(
        false
      );

    }

  }

  /* ====================================================
     GET PARENT _ID COLUMN
  ==================================================== */

  const getParentIdColumn =
    (): string | null => {

      if (!parentSchema) {
        return null;
      }

      /*
        Support:

        {
          columns: [...]
        }

        and direct array responses.
      */

      const schemaColumns =
        Array.isArray(
          parentSchema
        )
          ? parentSchema
          : Array.isArray(
              parentSchema.columns
            )
          ? parentSchema.columns
          : [];

      const idColumn =
        schemaColumns.find(
          (
            column: any
          ) =>
            column.ontologyMapping ===
            "_id"
        );

      return (
        idColumn?.name ??
        null
      );
    };

  /* ====================================================
     GET CURRENT DATASET _ID COLUMN
  ==================================================== */

  const getCurrentIdColumn =
    (): string | null => {

      const idColumns =
        columns.filter(
          (
            column
          ) =>
            column.include &&
            column.ontologyMapping ===
              "_id"
        );

      if (
        idColumns.length !== 1
      ) {
        return null;
      }

      return idColumns[0].name;
    };

  /* ====================================================
     NORMALIZE _ID VALUE
  ==================================================== */

  /*
    IDs are compared as trimmed strings.

    Example:

      "ABC001"
      " ABC001 "

    are considered the same ID.

    Case is intentionally preserved.

    Therefore:

      "ABC001"
      "abc001"

    are treated as different IDs.
  */

  const normalizeId =
    (
      value: any
    ): string => {

      if (
        value === null ||
        value === undefined
      ) {
        return "";
      }

      return String(
        value
      ).trim();
    };

  /* ====================================================
     FIND DUPLICATE _ID VALUES
  ==================================================== */

  const findDuplicateIds =
    (
      records: any[],
      idColumn: string
    ): string[] => {

      const seen =
        new Set<string>();

      const duplicates =
        new Set<string>();

      records.forEach(
        (
          row: any
        ) => {

          const id =
            normalizeId(
              row?.[idColumn]
            );

          if (
            id === ""
          ) {
            return;
          }

          if (
            seen.has(id)
          ) {

            duplicates.add(
              id
            );

          } else {

            seen.add(
              id
            );

          }

        }
      );

      return Array.from(
        duplicates
      );
    };

  /* ====================================================
     FIND MISSING / BLANK _ID VALUES
  ==================================================== */

  const countMissingIds =
    (
      records: any[],
      idColumn: string
    ): number => {

      return records.filter(
        (
          row: any
        ) => {

          return (
            normalizeId(
              row?.[idColumn]
            ) === ""
          );

        }
      ).length;

    };

  /* ====================================================
     FORMAT DUPLICATE ERROR
  ==================================================== */

  const formatDuplicateError =
    (
      datasetLabel: string,
      idColumn: string,
      duplicateIds: string[]
    ): string => {

      const preview =
        duplicateIds
          .slice(0, 5)
          .map(
            (
              id
            ) =>
              `"${id}"`
          )
          .join(", ");

      const remaining =
        duplicateIds.length > 5
          ? ` and ${duplicateIds.length - 5} more`
          : "";

      return (
        `${datasetLabel} contains duplicate _id values in "${idColumn}": ${preview}${remaining}. Duplicate _ids are not allowed.`
      );
    };

  /* ====================================================
     VALIDATE RAW DATA _ID
  ==================================================== */

  const validateRawIds =
    (): string => {

      if (
        ingestionType !==
        "raw"
      ) {
        return "";
      }

      const idColumn =
        getCurrentIdColumn();

      if (
        !idColumn
      ) {

        return (
          "Raw Data must contain exactly one included _id mapping."
        );

      }

      const records =
        Array.isArray(
          initialData
        )
          ? initialData
          : [];

      if (
        records.length === 0
      ) {

        return (
          "The Raw dataset contains no records."
        );

      }

      /* -----------------------------------------------
         CHECK BLANK IDS
      ------------------------------------------------ */

      const missingCount =
        countMissingIds(
          records,
          idColumn
        );

      if (
        missingCount > 0
      ) {

        return (
          `${missingCount} Raw record(s) contain a blank or missing _id in "${idColumn}". Every Raw record must have an _id.`
        );

      }

      /* -----------------------------------------------
         CHECK DUPLICATE IDS
      ------------------------------------------------ */

      const duplicateIds =
        findDuplicateIds(
          records,
          idColumn
        );

      if (
        duplicateIds.length > 0
      ) {

        return formatDuplicateError(
          "Raw dataset",
          idColumn,
          duplicateIds
        );

      }

      return "";
    };

  /* ====================================================
     VALIDATE TAGGED _ID
  ==================================================== */

  /*
    OPTION B:

    The Tagged _id column does NOT need to have
    the same column name as the Raw _id column.

    Example:

      Raw:
        Complaint ID -> _id

      Tagged:
        Event ID -> _id

    This is VALID if:

      Event ID values exist in
      Complaint ID values.

    Additional rules:

      1. Raw IDs must be unique.
      2. Tagged IDs must be unique.
      3. Neither dataset may contain blank IDs.
      4. Every Tagged ID must exist in Raw.
  */

  const validateTaggedId =
    (): string => {

      if (
        ingestionType !==
        "tagged"
      ) {

        return "";

      }

      if (
        !parentDatasetId
      ) {

        return (
          "No parent Raw dataset has been selected."
        );

      }

      if (
        loadingParentSchema ||
        loadingParentRecords
      ) {

        return (
          "Loading parent Raw dataset..."
        );

      }

      if (
        parentSchemaError
      ) {

        return parentSchemaError;

      }

      const parentIdColumn =
        getParentIdColumn();

      if (
        !parentIdColumn
      ) {

        return (
          "The selected Raw dataset does not contain an _id mapping."
        );

      }

      /* -----------------------------------------------
         FIND TAGGED _ID
      ------------------------------------------------ */

      const taggedIdColumns =
        columns.filter(
          (
            column
          ) =>
            column.include &&
            column.ontologyMapping ===
              "_id"
        );

      if (
        taggedIdColumns.length !== 1
      ) {

        return (
          "Tagged Data must contain exactly one _id mapping."
        );

      }

      const taggedIdColumn =
        taggedIdColumns[0].name;

      const rawRecords =
        Array.isArray(
          parentRecords
        )
          ? parentRecords
          : [];

      const taggedRecords =
        Array.isArray(
          initialData
        )
          ? initialData
          : [];

      /* -----------------------------------------------
         CHECK RAW DATASET HAS RECORDS
      ------------------------------------------------ */

      if (
        rawRecords.length === 0
      ) {

        return (
          "The selected Raw dataset contains no records to validate against."
        );

      }

      /* -----------------------------------------------
         CHECK TAGGED DATASET HAS RECORDS
      ------------------------------------------------ */

      if (
        taggedRecords.length === 0
      ) {

        return (
          "The Tagged dataset contains no records."
        );

      }

      /* -----------------------------------------------
         CHECK DUPLICATE RAW IDS
      ------------------------------------------------ */

      const duplicateRawIds =
        findDuplicateIds(
          rawRecords,
          parentIdColumn
        );

      if (
        duplicateRawIds.length > 0
      ) {

        return formatDuplicateError(
          "Selected Raw dataset",
          parentIdColumn,
          duplicateRawIds
        );

      }

      /* -----------------------------------------------
         CHECK BLANK RAW IDS
      ------------------------------------------------ */

      const missingRawIds =
        countMissingIds(
          rawRecords,
          parentIdColumn
        );

      if (
        missingRawIds > 0
      ) {

        return (
          `${missingRawIds} record(s) in the selected Raw dataset contain a blank or missing _id in "${parentIdColumn}". The Raw dataset cannot be used as the parent dataset until all _ids are populated.`
        );

      }

      /* -----------------------------------------------
         CHECK DUPLICATE TAGGED IDS
      ------------------------------------------------ */

      const duplicateTaggedIds =
        findDuplicateIds(
          taggedRecords,
          taggedIdColumn
        );

      if (
        duplicateTaggedIds.length > 0
      ) {

        return formatDuplicateError(
          "Tagged dataset",
          taggedIdColumn,
          duplicateTaggedIds
        );

      }

      /* -----------------------------------------------
         CHECK BLANK TAGGED IDS
      ------------------------------------------------ */

      const missingTaggedIds =
        countMissingIds(
          taggedRecords,
          taggedIdColumn
        );

      if (
        missingTaggedIds > 0
      ) {

        return (
          `${missingTaggedIds} Tagged record(s) contain a blank or missing _id in "${taggedIdColumn}". Every Tagged record must have an _id.`
        );

      }

      /* -----------------------------------------------
         BUILD RAW ID SET
      ------------------------------------------------ */

      const rawIds =
        new Set<string>();

      rawRecords.forEach(
        (
          row: any
        ) => {

          const id =
            normalizeId(
              row?.[parentIdColumn]
            );

          if (
            id !== ""
          ) {

            rawIds.add(
              id
            );

          }

        }
      );

      /* -----------------------------------------------
         VALIDATE EVERY TAGGED ID EXISTS IN RAW
      ------------------------------------------------ */

      const invalidTaggedIds =
        new Set<string>();

      taggedRecords.forEach(
        (
          row: any
        ) => {

          const taggedId =
            normalizeId(
              row?.[taggedIdColumn]
            );

          if (
            taggedId !== "" &&
            !rawIds.has(
              taggedId
            )
          ) {

            invalidTaggedIds.add(
              taggedId
            );

          }

        }
      );

      if (
        invalidTaggedIds.size > 0
      ) {

        const invalidIds =
          Array.from(
            invalidTaggedIds
          );

        const preview =
          invalidIds
            .slice(0, 5)
            .map(
              (
                id
              ) =>
                `"${id}"`
            )
            .join(", ");

        const remaining =
          invalidIds.length > 5
            ? ` and ${invalidIds.length - 5} more`
            : "";

        return (
          `${invalidIds.length} unique Tagged _id value(s) do not exist in the selected Raw dataset: ${preview}${remaining}. Every Tagged _id must exist in the Raw dataset.`
        );

      }

      return "";
    };

  /* ====================================================
     LIST VALUE VALIDATION
  ==================================================== */

  /*
    List-valued columns can arrive from CSV/PapaParse in two
    different forms:

      1. A real JavaScript array:
         ["Bat", "Handle"]

      2. A string representation of a list:
         ['Bat', 'Handle']

    A single-item list is also valid:
         ['Bat']

    The previous validation only checked whether the string
    contained a comma. That incorrectly rejected valid
    single-item lists such as ['Bat'] and ['Handle Split'].

    We therefore validate the list structure instead of
    requiring a comma.
  */
  const isValidListValue = (
    value: any
  ): boolean => {

    if (
      Array.isArray(value)
    ) {
      return true;
    }

    if (
      typeof value !==
      "string"
    ) {
      return false;
    }

    const text =
      value.trim();

    if (
      text === ""
    ) {
      return true;
    }

    /*
      Accept Python/CSV-style list strings such as:

        ['Bat']
        ['Bat', 'Handle']
        ["Bat", "Handle"]
        []

      We intentionally do not require a comma because a
      one-element list is still a valid list.
    */
    if (
      !text.startsWith("[") ||
      !text.endsWith("]")
    ) {
      return false;
    }

    return true;
  };

  /* ====================================================
     VALIDATION
  ==================================================== */

  const validateColumn = (
    colName: string,
    type: ColumnType
  ) => {

    for (
      const row of initialData
    ) {

      const value =
        row[colName];

      /*
        Skip empty values.
      */

      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        continue;
      }

      switch (
        type
      ) {

        /* ---------------------------------------------
           NUMBER
        ---------------------------------------------- */

        case "number":

          if (
            isNaN(
              Number(value)
            )
          ) {

            return "Invalid number";

          }

          break;

        /* ---------------------------------------------
           BOOLEAN
        ---------------------------------------------- */

        case "boolean":

          if (
            ![
              "true",
              "false",
              true,
              false,
            ].includes(
              value
            )
          ) {

            return "Invalid boolean";

          }

          break;

        /* ---------------------------------------------
           DATE
        ---------------------------------------------- */

        case "date":

          if (
            !isValidDate(
              value
            )
          ) {

            return "Invalid date";

          }

          break;

        /* ---------------------------------------------
           LIST
        ---------------------------------------------- */

        case "list":

          if (
            !isValidListValue(
              value
            )
          ) {

            return (
              "Expected list (e.g. ['A'] or ['A', 'B'])"
            );

          }

          break;

        default:

          break;

      }

    }

    return "";
  };

  /* ====================================================
     HANDLE TYPE CHANGE
  ==================================================== */

  const handleTypeChange = (
    i: number,
    type: ColumnType
  ) => {

    const updated =
      [...columns];

    const error =
      validateColumn(
        updated[i].name,
        type
      );

    updated[i].type =
      type;

    updated[i].error =
      error;

    setColumns(
      updated
    );

  };

  /* ====================================================
     HANDLE ONTOLOGY CHANGE
  ==================================================== */

  const handleOntologyChange = (
    i: number,
    value: OntologyType
  ) => {

    const updated =
      [...columns];

    /*
      Prevent multiple _id
      mappings.

      If the user selects _id
      for one column, remove it
      from another column.
    */

    if (
      value === "_id"
    ) {

      updated.forEach(
        (
          column,
          index
        ) => {

          if (
            index !== i &&
            column.ontologyMapping ===
              "_id"
          ) {

            column.ontologyMapping =
              "";

          }

        }
      );

    }

    updated[i].ontologyMapping =
      value;

    setColumns(
      updated
    );

    /*
      Clear previous Tagged
      validation because the mapping
      has changed.
    */

    setTaggedIdError("");

  };

  /* ====================================================
     TOGGLE COLUMN INCLUDE
  ==================================================== */

  const toggleInclude = (
    i: number
  ) => {

    const updated =
      [...columns];

    updated[i].include =
      !updated[i].include;

    setColumns(
      updated
    );

    setTaggedIdError("");

  };

  /* ====================================================
     ONTOLOGY VALIDATION
  ==================================================== */

  const ontologyErrors =
    () => {

      const includedCols =
        columns.filter(
          (
            column
          ) =>
            column.include
        );

      /*
        Exactly one _id is required
        for both Raw and Tagged.
      */

      const idCount =
        includedCols.filter(
          (
            column
          ) =>
            column.ontologyMapping ===
              "_id"
        ).length;

      if (
        idCount !== 1
      ) {

        return (
          "Exactly one _id mapping is required."
        );

      }

      /*
        Raw datasets require
        at least one opentimestamp.
      */

      if (
        ingestionType ===
        "raw"
      ) {

        const timestampCount =
          includedCols.filter(
            (
              column
            ) =>
              column.ontologyMapping ===
                "opentimestamp"
          ).length;

        if (
          timestampCount < 1
        ) {

          return (
            "At least one opentimestamp mapping is required."
          );

        }

      }

      /*
        Tagged datasets must
        contain at least one
        customAttributes field.
      */

      if (
        ingestionType ===
        "tagged"
      ) {

        const customAttributeCount =
          includedCols.filter(
            (
              column
            ) =>
              column.ontologyMapping ===
                "customAttributes"
          ).length;

        if (
          customAttributeCount <
          1
        ) {

          return (
            "Tagged Data must contain at least one customAttributes mapping."
          );

        }

      }

      return "";
    };

  const ontologyErrorMessage =
    ontologyErrors();

  /* ====================================================
     COMBINED VALIDATION
  ==================================================== */

  /*
    Raw:

      Validate duplicate/missing _ids.

    Tagged:

      Validate:

        - parent Raw exists
        - Raw _ids are unique
        - Raw _ids are populated
        - Tagged _ids are unique
        - Tagged _ids are populated
        - every Tagged _id exists in Raw

    IMPORTANT:

      We intentionally DO NOT compare
      Tagged column name against Raw
      column name.

      Therefore:

        Raw:
          Complaint ID -> _id

        Tagged:
          Event ID -> _id

      is valid.
  */

  const validationError =
    ingestionType === "tagged"
      ? validateTaggedId()
      : validateRawIds();

  /* ====================================================
     SAVE SCHEMA
  ==================================================== */

  const handleSave = () => {

    if (
      hasErrors ||
      ontologyErrorMessage ||
      validationError
    ) {

      alert(
        "❌ Fix errors before saving."
      );

      return;
    }

    const schema =
      columns
        .filter(
          (
            column
          ) =>
            column.include
        )
        .map(
          (
            column
          ) => ({

            name:
              column.name,

            type:
              column.type,

            ontologyMapping:
              column.ontologyMapping,

          })
        );

    console.log(
      "✅ Schema:",
      schema
    );

    alert(
      "✅ Schema Saved Successfully!"
    );

  };

  /* ====================================================
     UPLOAD DATASET
  ==================================================== */

  const handleUpload =
    async () => {

      if (
        hasErrors ||
        ontologyErrorMessage ||
        validationError
      ) {

        alert(
          "❌ Fix errors before uploading."
        );

        return;
      }

      try {

        setUploading(
          true
        );

        /* ---------------------------------------------
           BUILD SCHEMA
        ---------------------------------------------- */

        const schema =
          columns
            .filter(
              (
                column
              ) =>
                column.include
            )
            .map(
              (
                column
              ) => ({

                name:
                  column.name,

                type:
                  column.type,

                ontologyMapping:
                  column.ontologyMapping,

              })
            );

        /* ---------------------------------------------
           BUILD PAYLOAD
        ---------------------------------------------- */

        const payload: any = {

          datasetName,

          fileName,

          ingestionType,

          schema,

          data:
            initialData,

        };

        /*
          Only Tagged Data gets
          a parent dataset relationship.
        */

        if (
          ingestionType ===
          "tagged"
        ) {

          payload.parentDatasetId =
            parentDatasetId;

        }

        console.log(
          "Uploading dataset:",
          payload
        );

        /* ---------------------------------------------
           SEND TO BACKEND
        ---------------------------------------------- */

        const response =
          await fetch(
            "http://localhost:5000/upload",
            {

              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  payload
                ),

            }
          );

        if (
          !response.ok
        ) {

          const errorText =
            await response.text();

          throw new Error(
            errorText ||
              "Upload failed"
          );

        }

        const result =
          await response.json();

        console.log(
          "✅ Upload Success:",
          result
        );

        alert(
          ingestionType ===
            "tagged"
            ? "✅ Tagged dataset uploaded successfully and linked to the Raw dataset!"
            : "✅ Raw dataset uploaded successfully!"
        );

      } catch (
        error
      ) {

        console.error(
          "Upload failed:",
          error
        );

        alert(
          "❌ Failed to upload dataset."
        );

      } finally {

        setUploading(
          false
        );

      }

    };

  /* ====================================================
     TYPE ERRORS
  ==================================================== */

  const hasErrors =
    columns.some(
      (
        column
      ) =>
        column.error
    );

  /* ====================================================
     RENDER
  ==================================================== */

  return (

    <div
      style={{
        padding:
          "20px",

        backgroundColor:
          "#0f172a",

        color:
          "#e2e8f0",

        minHeight:
          "100vh",
      }}
    >

      {/* ==================================================
          HEADER
      ================================================== */}

      <h2
        style={{
          marginBottom:
            "10px",

          color:
            "#e2e8f0",
        }}
      >
        Schema Definition
      </h2>

      <div
        style={{
          marginBottom:
            "20px",

          color:
            "#94a3b8",

          fontSize:
            "13px",
        }}
      >

        Dataset:
        {" "}

        <strong
          style={{
            color:
              "#f8fafc",
          }}
        >
          {datasetName}
        </strong>

        {" • "}

        Ingestion Type:
        {" "}

        <strong
          style={{
            color:
              ingestionType ===
              "tagged"
                ? "#f59e0b"
                : "#38bdf8",
          }}
        >

          {ingestionType ===
          "tagged"
            ? "Tagged Data"
            : "Raw Data"}

        </strong>

      </div>

      {/* ==================================================
          TAGGED DATA PARENT INFORMATION
      ================================================== */}

      {ingestionType ===
        "tagged" && (

        <div
          style={{
            backgroundColor:
              "#172554",

            border:
              "1px solid #1d4ed8",

            borderRadius:
              "8px",

            padding:
              "15px",

            marginBottom:
              "15px",
          }}
        >

          <div
            style={{
              fontWeight:
                600,

              marginBottom:
                "6px",

              color:
                "#bfdbfe",
            }}
          >
            Tagged Dataset Configuration
          </div>

          <div
            style={{
              fontSize:
                "13px",

              color:
                "#93c5fd",
            }}
          >

            Parent Raw Dataset ID:
            {" "}

            <strong>
              {parentDatasetId ??
                "Not selected"}
            </strong>

          </div>

          <div
            style={{
              fontSize:
                "13px",

              color:
                "#93c5fd",

              marginTop:
                "4px",
            }}
          >

            Raw dataset _id column:
            {" "}

            <strong>
              {getParentIdColumn() ??
                "Loading..."}
            </strong>

          </div>

          <div
            style={{
              fontSize:
                "13px",

              color:
                "#93c5fd",

              marginTop:
                "4px",
            }}
          >

            Tagged dataset _id column:
            {" "}

            <strong>
              {getCurrentIdColumn() ??
                "Not configured"}
            </strong>

          </div>

        </div>
      )}

      {/* ==================================================
          PARENT DATASET LOADING
      ================================================== */}

      {ingestionType ===
        "tagged" &&
        loadingParentSchema && (

        <div
          style={{
            backgroundColor:
              "#422006",

            border:
              "1px solid #92400e",

            padding:
              "10px",

            marginBottom:
              "15px",

            borderRadius:
              "5px",

            color:
              "#fcd34d",
          }}
        >
          Loading parent Raw dataset...
        </div>

      )}

      {/* ==================================================
          PARENT DATASET ERROR
      ================================================== */}

      {ingestionType ===
        "tagged" &&
        parentSchemaError && (

        <div
          style={{
            backgroundColor:
              "#7f1d1d",

            padding:
              "10px",

            marginBottom:
              "15px",

            borderRadius:
              "5px",

            color:
              "#fecaca",
          }}
        >
          ❌ {parentSchemaError}
        </div>

      )}

      {/* ==================================================
          TYPE ERRORS
      ================================================== */}

      {hasErrors && (

        <div
          style={{
            backgroundColor:
              "#7f1d1d",

            padding:
              "10px",

            marginBottom:
              "15px",

            borderRadius:
              "5px",
          }}
        >
          ❌ Some columns have invalid data.
        </div>

      )}

      {/* ==================================================
          ONTOLOGY ERRORS
      ================================================== */}

      {ontologyErrorMessage && (

        <div
          style={{
            backgroundColor:
              "#7f1d1d",

            padding:
              "10px",

            marginBottom:
              "15px",

            borderRadius:
              "5px",
          }}
        >
          ❌ {ontologyErrorMessage}
        </div>

      )}

      {/* ==================================================
          _ID VALIDATION ERROR
      ================================================== */}

      {validationError && (

        <div
          style={{
            backgroundColor:
              "#7f1d1d",

            border:
              "1px solid #ef4444",

            padding:
              "10px",

            marginBottom:
              "15px",

            borderRadius:
              "5px",

            color:
              "#fecaca",
          }}
        >
          ❌ {validationError}
        </div>

      )}

      {/* ==================================================
          SCHEMA TABLE
      ================================================== */}

      <table
        style={{
          width:
            "100%",

          borderCollapse:
            "collapse",

          backgroundColor:
            "#1e293b",
        }}
      >

        <thead>

          <tr>

            {[
              "Column",
              "Sample Values",
              "Include",
              "Type",

              ingestionType ===
              "raw"
                ? "Ontology Mapping"
                : "Tag Mapping",

              "Error",

            ].map(
              (
                head
              ) => (

                <th
                  key={
                    head
                  }

                  style={{
                    padding:
                      "10px",

                    borderBottom:
                      "1px solid #334155",

                    textAlign:
                      "left",
                  }}
                >
                  {head}
                </th>

              )
            )}

          </tr>

        </thead>

        <tbody>

          {columns.map(
            (
              column,
              index
            ) => (

              <tr
                key={
                  index
                }
              >

                {/* COLUMN NAME */}

                <td
                  style={{
                    padding:
                      "10px",

                    borderBottom:
                      "1px solid #334155",
                  }}
                >
                  {column.name}
                </td>

                {/* SAMPLE VALUES */}

                <td
                  style={{
                    padding:
                      "10px",

                    borderBottom:
                      "1px solid #334155",
                  }}
                >
                  {column.sample}
                </td>

                {/* INCLUDE */}

                <td
                  style={{
                    padding:
                      "10px",

                    borderBottom:
                      "1px solid #334155",
                  }}
                >

                  <input
                    type="checkbox"

                    checked={
                      column.include
                    }

                    onChange={() =>
                      toggleInclude(
                        index
                      )
                    }

                    style={{
                      transform:
                        "scale(1.2)",
                    }}
                  />

                </td>

                {/* TYPE */}

                <td
                  style={{
                    padding:
                      "10px",

                    borderBottom:
                      "1px solid #334155",
                  }}
                >

                  <select
                    value={
                      column.type
                    }

                    onChange={(
                      event
                    ) =>
                      handleTypeChange(
                        index,
                        event.target
                          .value as ColumnType
                      )
                    }

                    style={{
                      backgroundColor:
                        "#0f172a",

                      color:
                        "white",

                      border:
                        "1px solid #334155",

                      padding:
                        "5px",
                    }}
                  >

                    <option value="string">
                      String
                    </option>

                    <option value="number">
                      Number
                    </option>

                    <option value="date">
                      Date
                    </option>

                    <option value="boolean">
                      Boolean
                    </option>

                    <option value="list">
                      List
                    </option>

                    <option value="multiline">
                      Multiline
                    </option>

                  </select>

                </td>

                {/* ONTOLOGY MAPPING */}

                <td
                  style={{
                    padding:
                      "10px",

                    borderBottom:
                      "1px solid #334155",
                  }}
                >

                  <select
                    value={
                      column.ontologyMapping
                    }

                    onChange={(
                      event
                    ) =>
                      handleOntologyChange(
                        index,
                        event.target
                          .value as OntologyType
                      )
                    }

                    style={{
                      backgroundColor:
                        "#0f172a",

                      color:
                        "white",

                      border:
                        "1px solid #334155",

                      padding:
                        "5px",
                    }}
                  >

                    <option value="">
                      Select
                    </option>

                    {ingestionType ===
                    "raw" ? (

                      <>

                        <option value="_id">
                          _id
                        </option>

                        <option value="opentimestamp">
                          opentimestamp
                        </option>

                        <option value="clientAttributes">
                          clientAttributes
                        </option>

                        <option value="freeText">
                          freeText
                        </option>

                      </>

                    ) : (

                      <>

                        <option value="_id">
                          _id
                        </option>

                        <option value="customAttributes">
                          customAttributes
                        </option>

                      </>

                    )}

                  </select>

                </td>

                {/* ERROR */}

                <td
                  style={{
                    padding:
                      "10px",

                    borderBottom:
                      "1px solid #334155",

                    color:
                      "#f87171",
                  }}
                >
                  {column.error}
                </td>

              </tr>

            )
          )}

        </tbody>

      </table>

      {/* ==================================================
          BUTTONS
      ================================================== */}

      <div
        style={{
          display:
            "flex",

          gap:
            "12px",

          marginTop:
            "20px",
        }}
      >

        {/* BACK */}

        {back && (

          <button
            onClick={
              back
            }

            disabled={
              uploading
            }

            style={{
              padding:
                "10px 20px",

              backgroundColor:
                "#475569",

              color:
                "white",

              border:
                "none",

              borderRadius:
                "5px",

              cursor:
                uploading
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            ← Back
          </button>

        )}

        {/* SAVE SCHEMA */}

        <button
          onClick={
            handleSave
          }

          disabled={
            hasErrors ||
            !!ontologyErrorMessage ||
            !!validationError
          }

          style={{
            padding:
              "10px 20px",

            backgroundColor:
              hasErrors ||
              ontologyErrorMessage ||
              validationError
                ? "#64748b"
                : "#2563eb",

            color:
              "white",

            border:
              "none",

            borderRadius:
              "5px",

            cursor:
              hasErrors ||
              ontologyErrorMessage ||
              validationError
                ? "not-allowed"
                : "pointer",
          }}
        >
          Save Schema
        </button>

        {/* UPLOAD DATASET */}

        <button
          onClick={
            handleUpload
          }

          disabled={
            hasErrors ||
            !!ontologyErrorMessage ||
            !!validationError ||
            uploading
          }

          style={{
            padding:
              "10px 20px",

            backgroundColor:
              hasErrors ||
              ontologyErrorMessage ||
              validationError ||
              uploading
                ? "#64748b"
                : "#16a34a",

            color:
              "white",

            border:
              "none",

            borderRadius:
              "5px",

            cursor:
              hasErrors ||
              ontologyErrorMessage ||
              validationError ||
              uploading
                ? "not-allowed"
                : "pointer",
          }}
        >

          {uploading
            ? "Uploading..."
            : "Upload Dataset"}

        </button>

      </div>

    </div>

  );

}
