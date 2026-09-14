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

      <div
        style={{
          height:
            80,

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "space-between",

          padding:
            "0 35px",

          borderBottom:
            "1px solid #334155",

          background:
            "#111827",
        }}
      >

        {/* ==================================================
            HEADER LEFT
        ================================================== */}

        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              20,
          }}
        >

          <button
            onClick={() =>
              navigate(
                "home"
              )
            }

            style={{
              padding:
                "10px 18px",

              border:
                "none",

              borderRadius:
                6,

              background:
                "#475569",

              color:
                "white",

              cursor:
                "pointer",
            }}
          >
            ← Back
          </button>

          <div>

            <h1
              style={{
                margin:
                  0,

                fontSize:
                  30,

                color:
                  "#f8fafc",
              }}
            >
              📥 Data Ingestion
            </h1>

            <p
              style={{
                marginTop:
                  5,

                color:
                  "#94a3b8",
              }}
            >
              Upload and configure engineering
              datasets for investigation
            </p>

          </div>

        </div>

        {/* ==================================================
            STEP INDICATOR
        ================================================== */}

        <div
          style={{
            display:
              "flex",

            gap:
              10,
          }}
        >

          {[1, 2, 3, 4].map(
            (s) => (

              <div
                key={
                  s
                }

                style={{
                  width:
                    36,

                  height:
                    36,

                  borderRadius:
                    "50%",

                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "center",

                  background:
                    step >= s
                      ? "#2563eb"
                      : "#334155",

                  color:
                    "white",

                  fontWeight:
                    600,
                }}
              >
                {s}
              </div>

            )
          )}

        </div>

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

          />

        )}

      </div>

    </div>

  );

}