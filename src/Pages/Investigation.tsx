import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

/* =========================================================
   DATASET TYPES
========================================================= */

interface Dataset {
  id: number;

  dataset_name: string;

  file_name: string;

  uploaded_at: string;

  status: string;

  /*
   * Expected values:
   * raw / tagged
   *
   * The backend may return values such as:
   * "Raw", "Raw Data", "raw"
   * "Tagged", "Tagged Data", "tagged"
   */
  data_type?: string;

  /*
   * Tagged datasets point to their parent Raw dataset.
   */
  parent_dataset_id?: number | null;
}

/* =========================================================
   LOGICAL DATASET GROUP
========================================================= */

interface DatasetGroup {
  id: number;

  datasetName: string;

  rawDataset: Dataset | null;

  taggedDatasets: Dataset[];

  latestUploadedAt: string;

  status: string;
}

/* =========================================================
   PROPS
========================================================= */

interface Props {
  navigate: (
    page:
      | "home"
      | "ingestion"
      | "investigate"
      | "workspace"
      | "asgs"
  ) => void;

  /*
   * We intentionally pass the RAW dataset ID.

   * InvestigationWorkspace can then use the raw ID to
   * retrieve the associated tagged dataset(s).
   */
  setSelectedDatasetId: (id: number) => void;
}

/* =========================================================
   HELPERS
========================================================= */

function normalizeDataType(
  dataType?: string
): string {
  return String(
    dataType || ""
  )
    .trim()
    .toLowerCase();
}

function isRawDataset(
  dataset: Dataset
): boolean {
  const type =
    normalizeDataType(
      dataset.data_type
    );

  return (
    type === "raw" ||
    type.includes("raw")
  );
}

function isTaggedDataset(
  dataset: Dataset
): boolean {
  const type =
    normalizeDataType(
      dataset.data_type
    );

  return (
    type === "tagged" ||
    type.includes("tagged")
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function Investigation({
  navigate,
  setSelectedDatasetId,
}: Props) {
  const [datasets, setDatasets] =
    useState<Dataset[]>([]);

  /*
   * IMPORTANT:
   *
   * selected contains the RAW dataset ID.
   *
   * This means one logical dataset is selected even
   * though it may contain multiple physical datasets.
   */
  const [selected, setSelected] =
    useState<number | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  /* =======================================================
     LOAD DATASETS
  ======================================================= */

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets =
    async () => {
      try {
        setLoading(true);
        setError(null);

        const response =
          await fetch(
            "http://localhost:5000/datasets"
          );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch datasets (${response.status})`
          );
        }

        const data =
          await response.json();

        if (!Array.isArray(data)) {
          throw new Error(
            "Invalid dataset response from server."
          );
        }

        setDatasets(data);

      } catch (error) {

        console.error(
          "Failed to load datasets:",
          error
        );

        setError(
          "Failed to load datasets."
        );

      } finally {

        setLoading(false);

      }
    };

  /* =======================================================
     BUILD LOGICAL DATASET GROUPS
  =======================================================

     Example backend data:

     RAW
     {
       id: 1,
       dataset_name: "Toss Dummy Raw",
       data_type: "raw"
     }

     TAGGED
     {
       id: 2,
       dataset_name: "Toss Dummy Raw",
       data_type: "tagged",
       parent_dataset_id: 1
     }

     Result:

     {
       id: 1,
       datasetName: "Toss Dummy Raw",
       rawDataset: dataset 1,
       taggedDatasets: [dataset 2]
     }

     Therefore the UI displays ONE row.
  ======================================================= */

  const datasetGroups =
    useMemo<DatasetGroup[]>(
      () => {

        if (
          datasets.length === 0
        ) {
          return [];
        }

        const datasetById =
          new Map<
            number,
            Dataset
          >();

        datasets.forEach(
          (dataset) => {
            datasetById.set(
              dataset.id,
              dataset
            );
          }
        );

        const groups =
          new Map<
            number,
            DatasetGroup
          >();

        /* -------------------------------------------------
           FIRST PASS

           Create groups for all RAW datasets.
        ------------------------------------------------- */

        datasets
          .filter(isRawDataset)
          .forEach(
            (rawDataset) => {

              groups.set(
                rawDataset.id,
                {
                  id:
                    rawDataset.id,

                  datasetName:
                    rawDataset.dataset_name,

                  rawDataset,

                  taggedDatasets:
                    [],

                  latestUploadedAt:
                    rawDataset.uploaded_at,

                  status:
                    rawDataset.status,
                }
              );

            }
          );

        /* -------------------------------------------------
           SECOND PASS

           Attach TAGGED datasets to their RAW parent.
        ------------------------------------------------- */

        datasets
          .filter(isTaggedDataset)
          .forEach(
            (taggedDataset) => {

              const parentId =
                taggedDataset.parent_dataset_id;

              /*
               * Preferred relationship:
               *
               * Tagged -> parent_dataset_id -> Raw
               */
              if (
                parentId !==
                  undefined &&
                parentId !== null
              ) {

                const parentRaw =
                  datasetById.get(
                    Number(parentId)
                  );

                /*
                 * Only attach to the group if the
                 * parent really is a Raw dataset.
                 */
                if (
                  parentRaw &&
                  isRawDataset(
                    parentRaw
                  )
                ) {

                  let group =
                    groups.get(
                      parentRaw.id
                    );

                  /*
                   * Safety fallback in case the raw
                   * dataset wasn't present in the
                   * initial grouping.
                   */
                  if (!group) {

                    group = {
                      id:
                        parentRaw.id,

                      datasetName:
                        parentRaw.dataset_name,

                      rawDataset:
                        parentRaw,

                      taggedDatasets:
                        [],

                      latestUploadedAt:
                        parentRaw.uploaded_at,

                      status:
                        parentRaw.status,
                    };

                    groups.set(
                      parentRaw.id,
                      group
                    );

                  }

                  group.taggedDatasets.push(
                    taggedDataset
                  );

                  return;
                }
              }

              /*
               * Fallback:
               *
               * If a Tagged dataset has no valid
               * parent_dataset_id, keep it as its
               * own logical group rather than losing
               * it from the Investigation page.
               */
              if (
                !groups.has(
                  taggedDataset.id
                )
              ) {

                groups.set(
                  taggedDataset.id,
                  {
                    id:
                      taggedDataset.id,

                    datasetName:
                      taggedDataset.dataset_name,

                    rawDataset:
                      null,

                    taggedDatasets:
                      [taggedDataset],

                    latestUploadedAt:
                      taggedDataset.uploaded_at,

                    status:
                      taggedDataset.status,
                  }
                );

              }

            }
          );

        /* -------------------------------------------------
           HANDLE UNKNOWN DATA TYPES

           If the backend contains a dataset whose
           data_type is neither raw nor tagged, don't
           silently hide it.
        ------------------------------------------------- */

        datasets
          .filter(
            (dataset) =>
              !isRawDataset(
                dataset
              ) &&
              !isTaggedDataset(
                dataset
              )
          )
          .forEach(
            (dataset) => {

              if (
                !groups.has(
                  dataset.id
                )
              ) {

                groups.set(
                  dataset.id,
                  {
                    id:
                      dataset.id,

                    datasetName:
                      dataset.dataset_name,

                    rawDataset:
                      dataset,

                    taggedDatasets:
                      [],

                    latestUploadedAt:
                      dataset.uploaded_at,

                    status:
                      dataset.status,
                  }
                );

              }

            }
          );

        /* -------------------------------------------------
           CALCULATE GROUP STATUS + LATEST UPLOAD
        ------------------------------------------------- */

        const result =
          Array.from(
            groups.values()
          ).map(
            (group) => {

              const allDatasets =
                [
                  ...(group.rawDataset
                    ? [
                        group.rawDataset,
                      ]
                    : []),

                  ...group.taggedDatasets,
                ];

              const latestDate =
                allDatasets
                  .map(
                    (dataset) =>
                      new Date(
                        dataset.uploaded_at
                      ).getTime()
                  )
                  .filter(
                    (value) =>
                      !Number.isNaN(
                        value
                      )
                  )
                  .sort(
                    (
                      a,
                      b
                    ) =>
                      b - a
                  )[0];

              const statuses =
                allDatasets.map(
                  (dataset) =>
                    dataset.status
                );

              let groupStatus =
                "Completed";

              if (
                statuses.some(
                  (status) =>
                    String(
                      status
                    ).toLowerCase() !==
                    "completed"
                )
              ) {

                groupStatus =
                  "Incomplete";

              }

              return {
                ...group,

                latestUploadedAt:
                  latestDate
                    ? new Date(
                        latestDate
                      ).toISOString()
                    : group.latestUploadedAt,

                status:
                  groupStatus,
              };

            }
          );

        /*
         * Latest logical dataset first.
         */
        result.sort(
          (
            a,
            b
          ) =>
            new Date(
              b.latestUploadedAt
            ).getTime() -
            new Date(
              a.latestUploadedAt
            ).getTime()
        );

        return result;

      },
      [datasets]
    );

  /* =======================================================
     SELECT DATASET GROUP
  ======================================================= */

  const toggleDataset =
    (
      rawDatasetId: number
    ) => {

      setSelected(
        selected ===
          rawDatasetId
          ? null
          : rawDatasetId
      );

    };

  /* =======================================================
     INVESTIGATE
  ======================================================= */

  const investigateDataset =
    () => {

      if (
        selected === null
      ) {
        return;
      }

      /*
       * IMPORTANT:
       *
       * selected is the RAW dataset ID.
       *
       * InvestigationWorkspace should use this ID
       * to load:
       *
       *   1. Raw dataset
       *   2. Associated Tagged dataset(s)
       */
      setSelectedDatasetId(
        selected
      );

      navigate(
        "workspace"
      );

    };

  /* =======================================================
     RENDER
  ======================================================= */

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

      {/* =================================================
          HEADER
      ================================================= */}

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
          background:
            "#111827",
          borderBottom:
            "1px solid #334155",
        }}
      >

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
              🔍 Investigation
            </h1>

            <p
              style={{
                marginTop:
                  5,
                color:
                  "#94a3b8",
              }}
            >
              Select a dataset and launch the
              investigation workspace.
            </p>

          </div>

        </div>

        <button
          disabled={
            selected === null
          }
          onClick={
            investigateDataset
          }
          style={{
            padding:
              "12px 24px",
            border:
              "none",
            borderRadius:
              6,
            fontSize:
              15,
            fontWeight:
              600,
            background:
              selected === null
                ? "#475569"
                : "#16a34a",
            color:
              "white",
            cursor:
              selected === null
                ? "not-allowed"
                : "pointer",
          }}
        >
          Investigate Selected
        </button>

      </div>

      {/* =================================================
          MAIN
      ================================================= */}

      <div
        style={{
          flex:
            1,
          padding:
            35,
          overflow:
            "auto",
        }}
      >

        {/* LOADING */}

        {loading && (
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "center",
              alignItems:
                "center",
              height:
                "60vh",
              fontSize:
                20,
            }}
          >
            Loading datasets...
          </div>
        )}

        {/* ERROR */}

        {!loading &&
          error && (
            <div
              style={{
                background:
                  "#7f1d1d",
                border:
                  "1px solid #ef4444",
                color:
                  "#fecaca",
                padding:
                  "14px 18px",
                borderRadius:
                  8,
              }}
            >
              ❌ {error}
            </div>
          )}

        {/* EMPTY */}

        {!loading &&
          !error &&
          datasetGroups.length ===
            0 && (
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "center",
                alignItems:
                  "center",
                height:
                  "60vh",
                color:
                  "#94a3b8",
                fontSize:
                  20,
              }}
            >
              No datasets available.
            </div>
          )}

        {/* DATASET TABLE */}

        {!loading &&
          !error &&
          datasetGroups.length >
            0 && (

            <div
              style={{
                background:
                  "#1e293b",
                borderRadius:
                  10,
                overflow:
                  "hidden",
                boxShadow:
                  "0 6px 18px rgba(0,0,0,0.35)",
              }}
            >

              <table
                style={{
                  width:
                    "100%",
                  borderCollapse:
                    "collapse",
                }}
              >

                <thead>

                  <tr
                    style={{
                      background:
                        "#111827",
                    }}
                  >

                    <th
                      style={
                        headerStyle
                      }
                    >
                      Select
                    </th>

                    <th
                      style={
                        headerStyle
                      }
                    >
                      Dataset Name
                    </th>

                    <th
                      style={
                        headerStyle
                      }
                    >
                      Raw Dataset
                    </th>

                    <th
                      style={
                        headerStyle
                      }
                    >
                      Tagged Dataset
                    </th>

                    <th
                      style={
                        headerStyle
                      }
                    >
                      Uploaded
                    </th>

                    <th
                      style={
                        headerStyle
                      }
                    >
                      Status
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {datasetGroups.map(
                    (
                      group
                    ) => {

                      const isSelected =
                        selected ===
                        group.id;

                      return (
                        <tr
                          key={
                            group.id
                          }
                          style={{
                            background:
                              isSelected
                                ? "#233554"
                                : "transparent",
                            transition:
                              "0.2s",
                          }}
                        >

                          {/* SELECT */}

                          <td
                            style={
                              cellStyle
                            }
                          >

                            <input
                              type="radio"
                              checked={
                                isSelected
                              }
                              onChange={() =>
                                toggleDataset(
                                  group.id
                                )
                              }
                            />

                          </td>

                          {/* DATASET NAME */}

                          <td
                            style={
                              cellStyle
                            }
                          >

                            <div
                              style={{
                                fontWeight:
                                  600,
                                color:
                                  "#f8fafc",
                              }}
                            >
                              {
                                group.datasetName
                              }
                            </div>

                            <div
                              style={{
                                marginTop:
                                  5,
                                fontSize:
                                  12,
                                color:
                                  "#94a3b8",
                              }}
                            >
                              {group.rawDataset
                                ? `Raw ID: ${group.rawDataset.id}`
                                : "No Raw dataset"}

                              {group.taggedDatasets
                                .length >
                                0 &&
                                ` • ${group.taggedDatasets.length} tagged dataset${
                                  group.taggedDatasets.length >
                                  1
                                    ? "s"
                                    : ""
                                }`}
                            </div>

                          </td>

                          {/* RAW DATASET */}

                          <td
                            style={
                              cellStyle
                            }
                          >

                            {group.rawDataset ? (
                              <div>

                                <div
                                  style={{
                                    color:
                                      "#e2e8f0",
                                  }}
                                >
                                  {
                                    group
                                      .rawDataset
                                      .file_name
                                  }
                                </div>

                                <span
                                  style={{
                                    display:
                                      "inline-block",
                                    marginTop:
                                      6,
                                    padding:
                                      "3px 8px",
                                    borderRadius:
                                      10,
                                    background:
                                      "#1d4ed8",
                                    color:
                                      "#dbeafe",
                                    fontSize:
                                      11,
                                    fontWeight:
                                      600,
                                  }}
                                >
                                  RAW
                                </span>

                              </div>
                            ) : (
                              <span
                                style={{
                                  color:
                                    "#64748b",
                                }}
                              >
                                —
                              </span>
                            )}

                          </td>

                          {/* TAGGED DATASET */}

                          <td
                            style={
                              cellStyle
                            }
                          >

                            {group.taggedDatasets
                              .length >
                            0 ? (

                              <div
                                style={{
                                  display:
                                    "flex",
                                  flexDirection:
                                    "column",
                                  gap:
                                    7,
                                }}
                              >

                                {group.taggedDatasets.map(
                                  (
                                    tagged
                                  ) => (

                                    <div
                                      key={
                                        tagged.id
                                      }
                                      style={{
                                        display:
                                          "flex",
                                        alignItems:
                                          "center",
                                        gap:
                                          8,
                                      }}
                                    >

                                      <span
                                        style={{
                                          color:
                                            "#e2e8f0",
                                        }}
                                      >
                                        {
                                          tagged.file_name
                                        }
                                      </span>

                                      <span
                                        style={{
                                          padding:
                                            "3px 8px",
                                          borderRadius:
                                            10,
                                          background:
                                            "#9333ea",
                                          color:
                                            "#f3e8ff",
                                          fontSize:
                                            11,
                                          fontWeight:
                                            600,
                                        }}
                                      >
                                        TAGGED
                                      </span>

                                    </div>

                                  )
                                )}

                              </div>

                            ) : (

                              <span
                                style={{
                                  color:
                                    "#64748b",
                                }}
                              >
                                No tagged dataset
                              </span>

                            )}

                          </td>

                          {/* UPLOADED */}

                          <td
                            style={
                              cellStyle
                            }
                          >

                            {new Date(
                              group.latestUploadedAt
                            ).toLocaleString()}

                          </td>

                          {/* STATUS */}

                          <td
                            style={
                              cellStyle
                            }
                          >

                            <span
                              style={{
                                background:
                                  group.status ===
                                  "Completed"
                                    ? "#16a34a"
                                    : "#d97706",
                                color:
                                  "white",
                                padding:
                                  "4px 10px",
                                borderRadius:
                                  12,
                                fontSize:
                                  13,
                              }}
                            >
                              {
                                group.status
                              }
                            </span>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

          )}

      </div>

    </div>
  );
}

/* =========================================================
   STYLES
========================================================= */

const headerStyle:
  React.CSSProperties = {
    padding:
      "16px",
    textAlign:
      "left",
    borderBottom:
      "1px solid #334155",
    color:
      "#e2e8f0",
    fontWeight:
      600,
  };

const cellStyle:
  React.CSSProperties = {
    padding:
      "16px",
    borderBottom:
      "1px solid #334155",
    verticalAlign:
      "top",
  };

