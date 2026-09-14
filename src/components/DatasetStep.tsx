import React, {
  useEffect,
  useState,
} from "react";

/* ======================================================
   TYPES
====================================================== */

interface Dataset {
  id: number;
  dataset_name: string;
  file_name?: string;
  data_type?: string;
  status?: string;
}

/* ======================================================
   PROPS
====================================================== */

interface DatasetStepProps {
  datasetName: string;

  setDatasetName: (
    value: string
  ) => void;

  ingestionType:
    | "raw"
    | "tagged";

  setIngestionType: (
    value: "raw" | "tagged"
  ) => void;

  /*
    Used later by DataIngestion /
    SchemaBuilder.

    For raw ingestion this remains empty.

    For tagged ingestion this contains
    the selected raw dataset ID.
  */

  parentDatasetId: number | null;

  setParentDatasetId: (
    value: number | null
  ) => void;

  next: () => void;

  back: () => void;
}

/* ======================================================
   COMPONENT
====================================================== */

export default function DatasetStep({
  datasetName,
  setDatasetName,
  ingestionType,
  setIngestionType,

  parentDatasetId,
  setParentDatasetId,

  next,
  back,
}: DatasetStepProps) {

  /* ====================================================
     EXISTING RAW DATASETS
  ==================================================== */

  const [
    rawDatasets,
    setRawDatasets,
  ] = useState<Dataset[]>([]);

  const [
    loadingDatasets,
    setLoadingDatasets,
  ] = useState(false);

  const [
    datasetError,
    setDatasetError,
  ] = useState("");

  /* ====================================================
     LOAD EXISTING RAW DATASETS
  ==================================================== */

  useEffect(() => {

    /*
      Only load the datasets when the user
      selects Tagged Data.
    */

    if (
      ingestionType !== "tagged"
    ) {

      return;

    }

    loadRawDatasets();

  }, [ingestionType]);

  async function loadRawDatasets() {

    try {

      setLoadingDatasets(true);

      setDatasetError("");

      const response =
        await fetch(
          "http://localhost:5000/datasets"
        );

      if (!response.ok) {

        throw new Error(
          `Failed to load datasets (${response.status})`
        );

      }

      const data =
        await response.json();

      /*
        The backend may return either:

        [
          ...
        ]

        or:

        {
          datasets: [...]
        }
      */

      const datasets =
        Array.isArray(data)
          ? data
          : data.datasets || [];

      /*
        Only RAW datasets should appear
        in the Tagged Data dropdown.
      */

      const rawOnly =
        datasets.filter(
          (dataset: Dataset) => {

            const type =
              String(
                dataset.data_type ||
                dataset.dataType ||
                "raw"
              ).toLowerCase();

            return (
              type === "raw"
            );

          }
        );

      setRawDatasets(
        rawOnly
      );

    } catch (error) {

      console.error(
        "Failed to load raw datasets:",
        error
      );

      setDatasetError(
        "Unable to load existing raw datasets."
      );

    } finally {

      setLoadingDatasets(false);

    }

  }

  /* ====================================================
     INGESTION TYPE CHANGE
  ==================================================== */

  function handleIngestionTypeChange(
    type: "raw" | "tagged"
  ) {

    setIngestionType(
      type
    );

    /*
      RAW DATA

      Clear the parent dataset because
      a raw dataset does not depend on
      another dataset.
    */

    if (
      type === "raw"
    ) {

      setParentDatasetId(
        null
      );

      /*
        Keep the manually entered
        dataset name.
      */

      return;

    }

    /*
      TAGGED DATA

      Clear the existing name.

      The name will be populated
      from the selected raw dataset.
    */

    setDatasetName("");

    setParentDatasetId(
      null
    );

  }

  /* ====================================================
     SELECT RAW DATASET
  ==================================================== */

  function handleRawDatasetChange(
    event: React.ChangeEvent<HTMLSelectElement>
  ) {

    const value =
      event.target.value;

    if (!value) {

      setParentDatasetId(
        null
      );

      setDatasetName("");

      return;

    }

    const selectedId =
      Number(value);

    const selectedDataset =
      rawDatasets.find(
        (dataset) =>
          dataset.id ===
          selectedId
      );

    if (!selectedDataset) {

      setParentDatasetId(
        null
      );

      setDatasetName("");

      return;

    }

    /*
      Store the raw dataset ID.

      This will be passed to the
      next step and eventually to
      SchemaBuilder/backend.
    */

    setParentDatasetId(
      selectedId
    );

    /*
      Tagged data uses the existing
      raw dataset name.

      This means the user does not
      manually type another dataset
      name.
    */

    setDatasetName(
      selectedDataset.dataset_name
    );

  }

  /* ====================================================
     VALIDATION
  ==================================================== */

  function handleNext() {

    /*
      RAW DATA
    */

    if (
      ingestionType === "raw"
    ) {

      if (
        !datasetName.trim()
      ) {

        alert(
          "Please enter a dataset name."
        );

        return;

      }

      next();

      return;

    }

    /*
      TAGGED DATA
    */

    if (
      ingestionType === "tagged"
    ) {

      if (
        !parentDatasetId
      ) {

        alert(
          "Please select an existing raw dataset."
        );

        return;

      }

      if (
        !datasetName.trim()
      ) {

        alert(
          "The selected raw dataset is missing a dataset name."
        );

        return;

      }

      next();

    }

  }

  /* ====================================================
     RENDER
  ==================================================== */

  return (

    <div
      style={{
        maxWidth: 800,
      }}
    >

      {/* ==================================================
          TITLE
      ================================================== */}

      <h2
        style={{
          marginBottom: 8,
          color: "white",
        }}
      >
        Step 3: Dataset
      </h2>

      <p
        style={{
          color: "#94a3b8",
          marginTop: 0,
          marginBottom: 30,
        }}
      >
        Configure the dataset type and
        dataset relationship.
      </p>

      {/* ==================================================
          INGESTION TYPE
      ================================================== */}

      <div
        style={{
          marginBottom: 30,
        }}
      >

        <h3
          style={{
            marginBottom: 15,
          }}
        >
          Ingestion Type
        </h3>

        <div
          style={{
            display: "flex",
            gap: 15,
          }}
        >

          {/* ==================================================
              RAW DATA
          ================================================== */}

          <label
            style={{
              flex: 1,
              padding: 18,
              background:
                ingestionType === "raw"
                  ? "#1e3a5f"
                  : "#1e293b",
              border:
                ingestionType === "raw"
                  ? "1px solid #2563eb"
                  : "1px solid #334155",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >

            <input
              type="radio"
              name="ingestionType"
              value="raw"
              checked={
                ingestionType ===
                "raw"
              }
              onChange={() =>
                handleIngestionTypeChange(
                  "raw"
                )
              }
            />

            <span
              style={{
                marginLeft: 10,
                fontWeight: 600,
              }}
            >
              Raw Data
            </span>

            <div
              style={{
                marginTop: 8,
                marginLeft: 24,
                fontSize: 12,
                color: "#94a3b8",
              }}
            >
              Create a new standalone
              dataset.
            </div>

          </label>

          {/* ==================================================
              TAGGED DATA
          ================================================== */}

          <label
            style={{
              flex: 1,
              padding: 18,
              background:
                ingestionType === "tagged"
                  ? "#1e3a5f"
                  : "#1e293b",
              border:
                ingestionType === "tagged"
                  ? "1px solid #2563eb"
                  : "1px solid #334155",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >

            <input
              type="radio"
              name="ingestionType"
              value="tagged"
              checked={
                ingestionType ===
                "tagged"
              }
              onChange={() =>
                handleIngestionTypeChange(
                  "tagged"
                )
              }
            />

            <span
              style={{
                marginLeft: 10,
                fontWeight: 600,
              }}
            >
              Tagged Data
            </span>

            <div
              style={{
                marginTop: 8,
                marginLeft: 24,
                fontSize: 12,
                color: "#94a3b8",
              }}
            >
              Add custom fields to an
              existing raw dataset.
            </div>

          </label>

        </div>

      </div>

      {/* ==================================================
          RAW DATA CONFIGURATION
      ================================================== */}

      {ingestionType === "raw" && (

        <div
          style={{
            background: "#111827",
            border:
              "1px solid #334155",
            borderRadius: 8,
            padding: 20,
            marginBottom: 30,
          }}
        >

          <h3
            style={{
              marginTop: 0,
            }}
          >
            New Dataset
          </h3>

          <label
            style={{
              display: "block",
              fontSize: 13,
              color: "#cbd5e1",
              marginBottom: 8,
            }}
          >
            Dataset Name
          </label>

          <input
            placeholder="Enter Dataset Name"
            value={
              datasetName
            }
            onChange={(event) =>
              setDatasetName(
                event.target.value
              )
            }
            style={{
              width: "100%",
              boxSizing:
                "border-box",
              padding:
                "11px 12px",
              background:
                "#0f172a",
              color:
                "white",
              border:
                "1px solid #475569",
              borderRadius: 6,
              outline: "none",
            }}
          />

        </div>

      )}

      {/* ==================================================
          TAGGED DATA CONFIGURATION
      ================================================== */}

      {ingestionType === "tagged" && (

        <div
          style={{
            background: "#111827",
            border:
              "1px solid #334155",
            borderRadius: 8,
            padding: 20,
            marginBottom: 30,
          }}
        >

          <h3
            style={{
              marginTop: 0,
            }}
          >
            Select Raw Dataset
          </h3>

          <p
            style={{
              color: "#94a3b8",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            Select the existing raw dataset
            that this tagged dataset belongs
            to. The tagged records will later
            be validated against the raw
            dataset's primary key (
            <strong>
              _id
            </strong>
            ).
          </p>

          {/* ==================================================
              LOADING
          ================================================== */}

          {loadingDatasets ? (

            <div
              style={{
                padding: 15,
                color: "#94a3b8",
              }}
            >
              Loading raw datasets...
            </div>

          ) : datasetError ? (

            <div
              style={{
                padding: 15,
                background:
                  "#450a0a",
                border:
                  "1px solid #7f1d1d",
                borderRadius: 6,
                color:
                  "#fca5a5",
                fontSize: 13,
              }}
            >
              {datasetError}
            </div>

          ) : rawDatasets.length ===
            0 ? (

            <div
              style={{
                padding: 15,
                background:
                  "#1e293b",
                border:
                  "1px solid #334155",
                borderRadius: 6,
                color:
                  "#94a3b8",
                fontSize: 13,
              }}
            >
              No raw datasets are available.
              Please ingest a raw dataset
              first.
            </div>

          ) : (

            <>
              <label
                style={{
                  display:
                    "block",
                  fontSize: 13,
                  color:
                    "#cbd5e1",
                  marginBottom: 8,
                }}
              >
                Raw Dataset
              </label>

              <select
                value={
                  parentDatasetId ??
                  ""
                }
                onChange={
                  handleRawDatasetChange
                }
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                  padding:
                    "11px 12px",
                  background:
                    "#0f172a",
                  color:
                    "white",
                  border:
                    "1px solid #475569",
                  borderRadius: 6,
                  outline: "none",
                  cursor:
                    "pointer",
                }}
              >

                <option value="">
                  Select a raw dataset
                </option>

                {rawDatasets.map(
                  (dataset) => (

                    <option
                      key={
                        dataset.id
                      }
                      value={
                        dataset.id
                      }
                    >
                      {
                        dataset.dataset_name
                      }
                    </option>

                  )
                )}

              </select>

              {/* ==================================================
                  SELECTED DATASET INFORMATION
              ================================================== */}

              {parentDatasetId && (

                <div
                  style={{
                    marginTop: 15,
                    padding: 14,
                    background:
                      "#0f172a",
                    border:
                      "1px solid #334155",
                    borderRadius: 6,
                  }}
                >

                  <div
                    style={{
                      fontSize: 12,
                      color:
                        "#94a3b8",
                      marginBottom:
                        5,
                    }}
                  >
                    Parent Raw Dataset
                  </div>

                  <div
                    style={{
                      fontSize: 15,
                      fontWeight:
                        600,
                      color:
                        "#38bdf8",
                    }}
                  >
                    {datasetName}
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color:
                        "#64748b",
                    }}
                  >
                    Tagged data will extend
                    this dataset using matching
                    <strong>
                      {" "}
                      _id
                    </strong>{" "}
                    values.
                  </div>

                </div>

              )}

            </>

          )}

        </div>

      )}

      {/* ==================================================
          NAVIGATION
      ================================================== */}

      <div
        style={{
          display: "flex",
          gap: 12,
        }}
      >

        <button
          onClick={back}
          style={{
            padding:
              "10px 20px",
            border: "none",
            borderRadius: 6,
            background:
              "#475569",
            color:
              "white",
            cursor:
              "pointer",
          }}
        >
          Back
        </button>

        <button
          onClick={handleNext}
          disabled={
            ingestionType ===
              "tagged" &&
            (
              loadingDatasets ||
              rawDatasets.length ===
                0 ||
              !parentDatasetId
            )
          }
          style={{
            padding:
              "10px 20px",
            border: "none",
            borderRadius: 6,
            background:
              ingestionType ===
                "tagged" &&
              (
                loadingDatasets ||
                rawDatasets.length ===
                  0 ||
                !parentDatasetId
              )
                ? "#334155"
                : "#2563eb",
            color:
              "white",
            cursor:
              ingestionType ===
                "tagged" &&
              (
                loadingDatasets ||
                rawDatasets.length ===
                  0 ||
                !parentDatasetId
              )
                ? "not-allowed"
                : "pointer",
          }}
        >
          Next
        </button>

      </div>

    </div>

  );
}