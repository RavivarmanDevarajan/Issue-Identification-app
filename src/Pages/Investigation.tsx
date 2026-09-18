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
    <div className="page-container">
      {/* HEADER BAR */}
      <div className="page-header-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => navigate("home")} className="btn-secondary">
            ← Back
          </button>
          <div>
            <h1 className="page-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
              Dataset Catalog & Investigation Launcher
            </h1>
            <p className="page-subtitle">
              Select an ingested engineering dataset group to launch interactive multi-dimensional analytics.
            </p>
          </div>
        </div>

        <button
          disabled={selected === null}
          onClick={investigateDataset}
          className="btn-primary"
          style={{ padding: "10px 22px", fontSize: 14 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Investigate Selected Dataset →
        </button>
      </div>

      {/* MAIN VIEWPORT */}
      <div className="page-content" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", color: "var(--text-muted)", fontSize: 16 }}>
            Loading dataset catalog...
          </div>
        )}

        {!loading && error && (
          <div style={{ backgroundColor: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "var(--status-detect)", padding: "16px 20px", borderRadius: "var(--radius-lg)" }}>
            ❌ {error}
          </div>
        )}

        {!loading && !error && datasetGroups.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 15 }}>
            No datasets available. Ingest a dataset first.
          </div>
        )}

        {!loading && !error && datasetGroups.length > 0 && (
          <div className="panel-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Available Dataset Groups ({datasetGroups.length})
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Click any row to select for investigation
              </div>
            </div>

            <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th style={{ width: 50, textAlign: "center" }}>Select</th>
                    <th>Dataset Name</th>
                    <th>Raw Dataset</th>
                    <th>Tagged Dataset(s)</th>
                    <th>Latest Uploaded</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {datasetGroups.map((group) => {
                    const isSelected = selected === group.id;

                    return (
                      <tr
                        key={group.id}
                        className={isSelected ? "selected" : ""}
                        onClick={() => toggleDataset(group.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="radio"
                            checked={isSelected}
                            onChange={() => toggleDataset(group.id)}
                          />
                        </td>

                        <td>
                          <div style={{ fontWeight: 600, color: isSelected ? "var(--accent-cyan)" : "var(--text-primary)", fontSize: 14 }}>
                            {group.datasetName}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                            {group.rawDataset ? `Raw ID #${group.rawDataset.id}` : "No Raw Dataset"}
                            {group.taggedDatasets.length > 0 && ` • ${group.taggedDatasets.length} Tagged dataset(s)`}
                          </div>
                        </td>

                        <td>
                          {group.rawDataset ? (
                            <div>
                              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                                {group.rawDataset.file_name}
                              </div>
                              <span className="badge badge-cyan" style={{ marginTop: 4 }}>
                                RAW
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-disabled)" }}>—</span>
                          )}
                        </td>

                        <td>
                          {group.taggedDatasets.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {group.taggedDatasets.map((tagged) => (
                                <div key={tagged.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                                    {tagged.file_name}
                                  </span>
                                  <span className="badge badge-gray">TAGGED</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-disabled)", fontSize: 12 }}>No tagged dataset linked</span>
                          )}
                        </td>

                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {new Date(group.latestUploadedAt).toLocaleString()}
                        </td>

                        <td>
                          <span className={`status-badge ${String(group.status).toLowerCase() === "completed" ? "resolved" : "investigate"}`}>
                            {group.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

