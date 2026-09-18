import React, {
  useEffect,
  useState,
} from "react";

import UploadStep from "../components/UploadStep";
import PreviewStep from "../components/PreviewStep";
import DatasetStep from "../components/DatasetStep";
import SchemaStep from "../components/SchemaBuilder";

/* ======================================================
   TYPES
====================================================== */

interface RawDataset {
  id: number;
  datasetName: string;
  fileName?: string;
  dataType?: string;
  status?: string;
}

/* ======================================================
   COMPONENT
====================================================== */

export default function DataIngestion({
  navigate,
}: any) {

  /* ====================================================
     STEP
  ==================================================== */

  const [
    step,
    setStep,
  ] = useState(1);

  /* ====================================================
     FILE DATA
  ==================================================== */

  const [
    fileData,
    setFileData,
  ] = useState<any[]>([]);

  const [
    fileName,
    setFileName,
  ] = useState("");

  /* ====================================================
     DATASET INFORMATION
  ==================================================== */

  const [
    datasetName,
    setDatasetName,
  ] = useState("");

  const [
    ingestionType,
    setIngestionType,
  ] = useState<
    "raw" | "tagged"
  >("raw");

  /* ====================================================
     RAW DATASET SELECTION
  ==================================================== */

  /*
    ID of the existing Raw dataset selected
    when ingestion type is Tagged Data.

    Raw ingestion:
      null

    Tagged ingestion:
      existing raw dataset ID
  */

  const [
    parentDatasetId,
    setParentDatasetId,
  ] = useState<number | null>(
    null
  );

  const [
    refreshDatasetId,
    setRefreshDatasetId,
  ] = useState<number | null>(
    null
  );

  const [
    refreshDatasetMeta,
    setRefreshDatasetMeta,
  ] = useState<any>(null);

  /*
    Existing Raw datasets available
    for Tagged Data ingestion.
  */

  const [
    rawDatasets,
    setRawDatasets,
  ] = useState<
    RawDataset[]
  >([]);

  const [
    loadingRawDatasets,
    setLoadingRawDatasets,
  ] = useState(false);

  const [
    rawDatasetError,
    setRawDatasetError,
  ] = useState("");

  /* ====================================================
     LOAD EXISTING RAW DATASETS
  ==================================================== */

  useEffect(() => {

    /*
      Only load the existing Raw datasets
      when Tagged Data is selected.
    */

    if (
      ingestionType !== "tagged"
    ) {

      setRawDatasets([]);

      setParentDatasetId(null);

      setRawDatasetError("");

      return;

    }

    loadRawDatasets();

  }, [
    ingestionType,
  ]);

  async function loadRawDatasets() {

    try {

      setLoadingRawDatasets(true);

      setRawDatasetError("");

      /*
        Existing datasets endpoint.

        The backend should return the list
        of datasets.

        We filter to Raw datasets on the
        frontend as an additional safeguard.
      */

      const response =
        await fetch(
          "http://localhost:5000/datasets"
        );

      if (!response.ok) {

        throw new Error(
          `Failed to load datasets (${response.status})`
        );

      }

      const result =
        await response.json();

      /*
        Support either:

        [
          {...},
          {...}
        ]

        or:

        {
          datasets: [...]
        }
      */

      const datasets =
        Array.isArray(result)
          ? result
          : Array.isArray(
              result?.datasets
            )
          ? result.datasets
          : [];

      /*
        Keep only Raw datasets.

        This prevents an existing Tagged
        dataset from becoming a parent.
      */

      const rawOnly =
        datasets
          .filter(
            (dataset: any) => {

              const type =
                String(
                  dataset.data_type ??
                  dataset.dataType ??
                  dataset.ingestionType ??
                  dataset.type ??
                  ""
                ).toLowerCase();

              return (
                type === "raw"
              );

            }
          )
          .map(
            (dataset: any) => ({

              id:
                Number(
                  dataset.id
                ),

              datasetName:
                dataset.dataset_name ??
                dataset.datasetName ??
                dataset.name ??
                "",

              fileName:
                dataset.file_name ??
                dataset.fileName,

              dataType:
                dataset.data_type ??
                dataset.dataType,

              status:
                dataset.status,

            })
          )
          .filter(
            (dataset: RawDataset) =>
              Number.isFinite(
                dataset.id
              ) &&
              dataset.datasetName
          );

      setRawDatasets(
        rawOnly
      );

    } catch (error) {

      console.error(
        "Failed to load Raw datasets:",
        error
      );

      setRawDatasetError(
        "Unable to load existing Raw datasets."
      );

      setRawDatasets([]);

    } finally {

      setLoadingRawDatasets(
        false
      );

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
      If the user switches back to Raw Data,
      remove the parent relationship.
    */

    if (
      type === "raw"
    ) {

      setParentDatasetId(
        null
      );

    }

    /*
      Reset the dataset name.

      For Tagged Data, DatasetStep will populate
      the name from the selected Raw dataset.
    */

    setDatasetName("");

  }

  /* ====================================================
     SELECT RAW DATASET
  ==================================================== */

  function handleParentDatasetChange(
    datasetId: number | null
  ) {

    setParentDatasetId(
      datasetId
    );

    /*
      Automatically use the selected Raw
      dataset name as the Tagged dataset name.
    */

    if (
      datasetId === null
    ) {

      setDatasetName("");

      return;

    }

    const selectedDataset =
      rawDatasets.find(
        (dataset) =>
          dataset.id ===
          datasetId
      );

    if (
      selectedDataset
    ) {

      setDatasetName(
        selectedDataset.datasetName
      );

    }

  }

  /* ====================================================
     REFRESH MODE — SELECT EXISTING DATASET
  ==================================================== */

  function handleSelectRefreshDataset(
    datasetId: number,
    datasetMeta: any
  ) {

    setRefreshDatasetId(
      datasetId
    );

    setRefreshDatasetMeta(
      datasetMeta || null
    );

    const metaType =
      String(
        datasetMeta?.data_type ??
        datasetMeta?.dataType ??
        datasetMeta?.ingestionType ??
        ""
      ).toLowerCase();

    if (
      metaType === "raw"
    ) {

      setIngestionType(
        "raw"
      );

      setParentDatasetId(null);

    } else if (
      metaType === "tagged"
    ) {

      setIngestionType(
        "tagged"
      );

      if (
        datasetMeta?.parent_dataset_id ??
        datasetMeta?.parentDatasetId
      ) {

        const parentId =
          Number(
            datasetMeta?.parent_dataset_id ??
            datasetMeta?.parentDatasetId
          );

        setParentDatasetId(
          parentId
        );

      }

    }

    if (
      datasetMeta?.dataset_name ??
      datasetMeta?.datasetName
    ) {

      setDatasetName(
        (
          datasetMeta?.dataset_name ??
          datasetMeta?.datasetName ??
          ""
        ).toString()
      );

    }

  }

  function clearRefreshMode() {

    setRefreshDatasetId(null);
    setRefreshDatasetMeta(null);

  }

  /* ====================================================
     NEXT FROM DATASET STEP
  ==================================================== */

  function handleDatasetNext() {

    /*
      Raw Data

      A normal dataset name is required.
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

      setStep(4);

      return;

    }

    /*
      Tagged Data

      An existing Raw dataset must be selected.
    */

    if (
      ingestionType === "tagged"
    ) {

      if (
        parentDatasetId === null
      ) {

        alert(
          "Please select an existing Raw dataset."
        );

        return;

      }

      /*
        Dataset name should already have been
        populated from the selected Raw dataset.
      */

      if (
        !datasetName.trim()
      ) {

        const selectedDataset =
          rawDatasets.find(
            (dataset) =>
              dataset.id ===
              parentDatasetId
          );

        if (
          selectedDataset
        ) {

          setDatasetName(
            selectedDataset.datasetName
          );

        }

      }

      setStep(4);

    }

  }

  /* ====================================================
     BACK TO DATASET STEP
  ==================================================== */

  function handleBackToDataset() {

    setStep(3);

  }

  function handleResetAll() {

    setStep(1);
    setFileData([]);
    setFileName("");
    setDatasetName("");
    setIngestionType("raw");
    setParentDatasetId(null);
    clearRefreshMode();

  }

  function handleHeaderBackReset() {
    if (step === 1 && !refreshDatasetId && fileData.length === 0 && !fileName) {
      if (typeof navigate === "function") {
        navigate("home");
      }
      return;
    }

    handleResetAll();
  }

  /* ====================================================
     RENDER
  ==================================================== */

  return (

    <div
      style={{
        width:
          "100%",

        minHeight:
          "100vh",

        background:
          "#0f172a",

        color:
          "white",

        display:
          "flex",

        flexDirection:
          "column",
      }}
    >

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="page-header-bar" style={{ height: "auto", flexDirection: "column", gap: refreshDatasetId ? 14 : 0 }}>
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* HEADER LEFT */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={handleHeaderBackReset} className="btn-secondary">
              ← Back / Reset
            </button>
            <div>
              <h1 className="page-title">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Data Ingestion & Pipeline Configuration
              </h1>
              <p className="page-subtitle">
                Upload CSV datasets, configure ontology mappings, validate schemas, and manage raw/tagged data.
              </p>
            </div>
          </div>

          {/* STEP INDICATOR */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {[
              { num: 1, label: "Upload" },
              { num: 2, label: "Preview" },
              { num: 3, label: "Dataset" },
              { num: 4, label: "Schema" },
            ].map((st, idx) => (
              <React.Fragment key={st.num}>
                {idx > 0 && (
                  <div
                    style={{
                      width: 24,
                      height: 2,
                      backgroundColor: step >= st.num ? "var(--accent-cyan)" : "var(--border-subtle)",
                      transition: "all 0.2s ease",
                    }}
                  />
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 20,
                    backgroundColor: step === st.num ? "var(--accent-dim)" : step > st.num ? "var(--bg-card-active)" : "var(--bg-input)",
                    border: step === st.num ? "1px solid var(--border-cyan)" : "1px solid var(--border-subtle)",
                    color: step === st.num ? "var(--accent-cyan)" : step > st.num ? "var(--text-primary)" : "var(--text-muted)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      backgroundColor: step >= st.num ? "var(--accent-cyan)" : "var(--border-medium)",
                      color: step >= st.num ? "#000" : "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {st.num}
                  </span>
                  <span>{st.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {refreshDatasetId && (

          <div
            style={{
              width: "100%",
              padding:
                "10px 16px",
              background:
                "#78350f",
              border:
                "1px solid #b45309",
              borderRadius:
                8,
              display:
                "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap:
                16,
            }}
          >

            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap:
                  10,
              }}
            >

              <span
                style={{
                  fontSize:
                    18,
                }}
              >
                🔄
              </span>

              <div>

                <div
                  style={{
                    fontWeight:
                      700,
                    color:
                      "#fde68a",
                    fontSize:
                      14,
                  }}
                >
                  Refresh Mode — Updating existing dataset
                </div>

                <div
                  style={{
                    fontSize:
                      12,
                    color:
                      "#fcd34d",
                    marginTop:
                      2,
                  }}
                >
                  Dataset:
                  {" "}
                  <strong>
                    {datasetName ||
                      refreshDatasetMeta
                        ?.dataset_name ||
                      refreshDatasetMeta
                        ?.datasetName ||
                      `#${refreshDatasetId}`}
                  </strong>
                  {" • "}
                  Type:
                  {" "}
                  <strong>
                    {(
                      refreshDatasetMeta
                        ?.data_type ??
                      refreshDatasetMeta
                        ?.dataType ??
                      ingestionType
                    )?.toString()
                      .toUpperCase() ??
                      "—"}
                  </strong>
                  {" • "}
                  Schema & ontology mappings are
                  <em>
                    {" "}
                    reused from the original upload
                  </em>
                  .
                </div>

              </div>

            </div>

            <button
              onClick={handleResetAll}
              style={{
                padding:
                  "6px 12px",
                fontSize:
                  12,
                background:
                  "#1f2937",
                color:
                  "#fde68a",
                border:
                  "1px solid #92400e",
                borderRadius:
                  6,
                cursor:
                  "pointer",
                fontWeight:
                  600,
              }}
            >
              Exit Refresh Mode
            </button>

          </div>

        )}

      </div>

      {/* ==================================================
          MAIN WORKSPACE
      ================================================== */}

      <div
        style={{
          flex:
            1,

          padding:
            "35px",

          overflow:
            "auto",
        }}
      >

        {/* ==================================================
            STEP 1
        ================================================== */}

        {step === 1 && (

          <UploadStep

            setFileData={
              setFileData
            }

            setFileName={
              setFileName
            }

            next={() =>
              setStep(2)
            }

            onSelectRefreshDataset={
              handleSelectRefreshDataset
            }

            selectedRefreshDatasetId={
              refreshDatasetId
            }

            setSelectedRefreshDatasetId={
              setRefreshDatasetId
            }

          />

        )}

        {/* ==================================================
            STEP 2
        ================================================== */}

        {step === 2 && (

          <PreviewStep

            data={
              fileData
            }

            next={() =>
              setStep(3)
            }

            back={() =>
              setStep(1)
            }

            refreshDatasetId={
              refreshDatasetId
            }

            refreshDatasetMeta={
              refreshDatasetMeta
            }

          />

        )}

        {/* ==================================================
            STEP 3
        ================================================== */}

        {step === 3 && (

          <DatasetStep

            datasetName={
              datasetName
            }

            setDatasetName={
              setDatasetName
            }

            ingestionType={
              ingestionType
            }

            setIngestionType={
              handleIngestionTypeChange
            }

            /* ============================================
               NEW TAGGED DATA PROPS
            ============================================ */

            rawDatasets={
              rawDatasets
            }

            loadingRawDatasets={
              loadingRawDatasets
            }

            rawDatasetError={
              rawDatasetError
            }

            parentDatasetId={
              parentDatasetId
            }

            setParentDatasetId={
              handleParentDatasetChange
            }

            next={
              handleDatasetNext
            }

            back={() =>
              setStep(2)
            }

            /* ============================================
               REFRESH MODE PROPS
            ============================================ */

            refreshDatasetId={
              refreshDatasetId
            }

            refreshDatasetMeta={
              refreshDatasetMeta
            }

            clearRefreshMode={
              clearRefreshMode
            }

          />

        )}

        {/* ==================================================
            STEP 4
        ================================================== */}

        {step === 4 && (

          <SchemaStep

            initialData={
              fileData
            }

            datasetName={
              datasetName
            }

            fileName={
              fileName
            }

            ingestionType={
              ingestionType
            }

            /*
              NEW:
              Pass the selected Raw dataset
              to the schema/upload stage.

              This will allow SchemaBuilder to
              associate Tagged Data with its
              parent Raw dataset.
            */

            parentDatasetId={
              parentDatasetId
            }

            back={
              handleBackToDataset
            }

            /*
              A finished upload ends the ingestion
              flow and returns to the main window.
            */

            onUploaded={() =>
              navigate(
                "home"
              )
            }

            /* ============================================
               REFRESH MODE PROPS
            ============================================ */

            refreshDatasetId={
              refreshDatasetId
            }

            refreshDatasetMeta={
              refreshDatasetMeta
            }

          />

        )}

      </div>

    </div>

  );

}