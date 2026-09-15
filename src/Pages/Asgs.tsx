import React, {
  useState,
} from "react";

import type {
  ASGStatus,
  ASGTrend,
} from "../App";

interface Props {
  navigate: any;

  asgs: ASGTrend[];

  deleteASG: (
    id: string
  ) => void;

  updateASG: (
    id: string,
    updates: Partial<ASGTrend>
  ) => void;

  onOpenASG: (
    asg: ASGTrend
  ) => void;

  /*
  Calculates the current event count
  against the latest dataset.
  */
  getASGEventCount: (
    asg: ASGTrend
  ) => Promise<number | null>;

  /*
  Cached current counts supplied by App.
  */
  dynamicEventCounts: Record<
    string,
    number
  >;
}

const categories = [
  "Recurring",
  "Re-occurring",
  "Spike",
  "Seasonal",
  "Anomaly",
  "Emerging",
  "Persistent",
];

const statuses: ASGStatus[] = [
  "Detect",
  "Investigate",
  "Resolved",
  "CAPA Implemented",
];

const categoryColors: Record<
  string,
  string
> = {
  Recurring: "#2563eb",
  "Re-occurring": "#7c3aed",
  Spike: "#dc2626",
  Seasonal: "#0891b2",
  Anomaly: "#d97706",
  Emerging: "#16a34a",
  Persistent: "#4f46e5",
};

const statusColors: Record<
  ASGStatus,
  string
> = {
  Detect: "#2563eb",
  Investigate: "#d97706",
  Resolved: "#16a34a",
  "CAPA Implemented": "#7c3aed",
};

export default function Asgs({
  navigate,
  asgs,
  deleteASG,
  updateASG,
  onOpenASG,
  getASGEventCount,
  dynamicEventCounts,
}: Props) {
  const [
    editingId,
    setEditingId,
  ] = useState<
    string | null
  >(null);

  const [
    editingTitle,
    setEditingTitle,
  ] = useState("");

  const [
    editingCategory,
    setEditingCategory,
  ] = useState("");

  const [
    deleteConfirmId,
    setDeleteConfirmId,
  ] = useState<
    string | null
  >(null);

  /*
  Track ASGs whose count is currently
  being refreshed from the latest dataset.
  */
  const [
    refreshingIds,
    setRefreshingIds,
  ] = useState<
    Record<string, boolean>
  >({});

  function startEditing(
    asg: ASGTrend
  ) {
    setEditingId(
      asg.id
    );

    setEditingTitle(
      asg.title
    );

    setEditingCategory(
      asg.category
    );

    setDeleteConfirmId(
      null
    );
  }

  function cancelEditing() {
    setEditingId(
      null
    );

    setEditingTitle(
      ""
    );

    setEditingCategory(
      ""
    );
  }

  function saveEditing() {
    if (!editingId) {
      return;
    }

    const title =
      editingTitle.trim();

    if (!title) {
      return;
    }

    updateASG(
      editingId,
      {
        title,
        category:
          editingCategory,
      }
    );

    cancelEditing();
  }

  function changeStatus(
    id: string,
    status: ASGStatus
  ) {
    updateASG(
      id,
      {
        status,
      }
    );
  }

  async function refreshCount(
    asg: ASGTrend
  ) {
    if (
      asg.datasetId ===
        undefined ||
      asg.datasetId ===
        null
    ) {
      return;
    }

    setRefreshingIds(
      (current) => ({
        ...current,
        [asg.id]: true,
      })
    );

    try {
      await getASGEventCount(
        asg
      );
    } finally {
      setRefreshingIds(
        (current) => ({
          ...current,
          [asg.id]: false,
        })
      );
    }
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ==================================================
          HEADER
      ================================================== */}

      <div
        style={{
          minHeight: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 35px",
          background: "#111827",
          borderBottom:
            "1px solid #334155",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <button
            onClick={() =>
              navigate("home")
            }
            style={{
              padding: "10px 18px",
              border: "none",
              borderRadius: 6,
              background: "#475569",
              color: "white",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ← Back
          </button>

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 30,
                color: "#f8fafc",
              }}
            >
              📊 ASGs
            </h1>

            <p
              style={{
                marginTop: 5,
                marginBottom: 0,
                color: "#94a3b8",
              }}
            >
              Flagged investigation trends
              and their lifecycle status.
            </p>
          </div>
        </div>

        <div
          style={{
            color: "#94a3b8",
            fontSize: 14,
          }}
        >
          {asgs.length}{" "}
          {asgs.length === 1
            ? "ASG"
            : "ASGs"}
        </div>
      </div>

      {/* ==================================================
          CONTENT
      ================================================== */}

      <div
        style={{
          padding: 35,
          flex: 1,
        }}
      >
        {asgs.length === 0 && (
          <div
            style={{
              background: "#111827",
              border:
                "1px solid #334155",
              borderRadius: 12,
              padding: 40,
              color: "#94a3b8",
              maxWidth: 720,
            }}
          >
            <div
              style={{
                fontSize: 18,
                color: "#e2e8f0",
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              No ASGs have been saved yet.
            </div>

            <div>
              Open the Investigation
              Workspace, apply filters to
              identify a trend, then use
              Save ASG.
            </div>
          </div>
        )}

        {asgs.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {asgs.map(
              (asg) => {
                const isEditing =
                  editingId ===
                  asg.id;

                const isDeleting =
                  deleteConfirmId ===
                  asg.id;

                const isRefreshing =
                  !!refreshingIds[
                    asg.id
                  ];

                const currentEventCount =
                  dynamicEventCounts[
                    asg.id
                  ];

                return (
                  <div
                    key={asg.id}
                    style={{
                      background:
                        "#1e293b",
                      border:
                        "1px solid #334155",
                      borderRadius: 12,
                      padding:
                        "22px 24px",
                    }}
                  >
                    {/* ==================================================
                        ASG INFORMATION
                    ================================================== */}

                    {isEditing ? (
                      <div
                        style={{
                          display:
                            "flex",
                          flexDirection:
                            "column",
                          gap: 12,
                        }}
                      >
                        <input
                          value={
                            editingTitle
                          }
                          onChange={(
                            event
                          ) =>
                            setEditingTitle(
                              event
                                .target
                                .value
                            )
                          }
                          autoFocus
                          style={{
                            width:
                              "100%",
                            maxWidth:
                              650,
                            boxSizing:
                              "border-box",
                            padding:
                              "10px 12px",
                            background:
                              "#0f172a",
                            border:
                              "1px solid #475569",
                            borderRadius:
                              6,
                            color:
                              "#f8fafc",
                            fontSize:
                              18,
                          }}
                        />

                        <select
                          value={
                            editingCategory
                          }
                          onChange={(
                            event
                          ) =>
                            setEditingCategory(
                              event
                                .target
                                .value
                            )
                          }
                          style={{
                            width:
                              "fit-content",
                            minWidth:
                              200,
                            padding:
                              "9px 12px",
                            background:
                              "#0f172a",
                            border:
                              "1px solid #475569",
                            borderRadius:
                              6,
                            color:
                              "#f8fafc",
                          }}
                        >
                          {categories.map(
                            (
                              category
                            ) => (
                              <option
                                key={
                                  category
                                }
                                value={
                                  category
                                }
                              >
                                {
                                  category
                                }
                              </option>
                            )
                          )}
                        </select>

                        <div
                          style={{
                            display:
                              "flex",
                            gap: 8,
                          }}
                        >
                          <button
                            onClick={
                              saveEditing
                            }
                            disabled={
                              !editingTitle.trim()
                            }
                            style={{
                              padding:
                                "8px 14px",
                              border:
                                "none",
                              borderRadius:
                                6,
                              background:
                                "#16a34a",
                              color:
                                "white",
                              cursor:
                                !editingTitle.trim()
                                  ? "not-allowed"
                                  : "pointer",
                              fontWeight:
                                600,
                              opacity:
                                !editingTitle.trim()
                                  ? 0.6
                                  : 1,
                            }}
                          >
                            Save
                          </button>

                          <button
                            onClick={
                              cancelEditing
                            }
                            style={{
                              padding:
                                "8px 14px",
                              border:
                                "1px solid #475569",
                              borderRadius:
                                6,
                              background:
                                "#334155",
                              color:
                                "#e2e8f0",
                              cursor:
                                "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* ==================================================
                            TITLE
                        ================================================== */}

                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "space-between",
                            gap: 20,
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              alignItems:
                                "center",
                              gap: 12,
                              flexWrap:
                                "wrap",
                            }}
                          >
                            <span
                              style={{
                                background:
                                  "#0f172a",
                                color:
                                  "#38bdf8",
                                padding:
                                  "4px 10px",
                                borderRadius:
                                  6,
                                fontWeight:
                                  700,
                                fontSize:
                                  14,
                              }}
                            >
                              {
                                asg.number
                              }
                            </span>

                            <h2
                              style={{
                                margin: 0,
                                fontSize:
                                  20,
                                color:
                                  "#f8fafc",
                              }}
                            >
                              {
                                asg.title
                              }
                            </h2>
                          </div>

                          <span
                            style={{
                              background:
                                categoryColors[
                                  asg.category
                                ] ||
                                "#475569",
                              color:
                                "white",
                              padding:
                                "7px 12px",
                              borderRadius:
                                20,
                              fontSize:
                                13,
                              fontWeight:
                                600,
                            }}
                          >
                            {
                              asg.category
                            }
                          </span>
                        </div>

                        {/* ==================================================
                            DATASET INFORMATION
                        ================================================== */}

                        <div
                          style={{
                            marginTop:
                              10,
                            color:
                              "#94a3b8",
                            fontSize:
                              14,
                          }}
                        >
                          {
                            asg.datasetName ||
                            "Unknown dataset"
                          }

                          {" • "}

                          {isRefreshing ? (
                            <span
                              style={{
                                color:
                                  "#60a5fa",
                              }}
                            >
                              Updating events...
                            </span>
                          ) : currentEventCount !==
                            undefined ? (
                            <>
                              {
                                currentEventCount
                              }{" "}
                              {
                                currentEventCount ===
                                1
                                  ? "event"
                                  : "events"
                              }
                            </>
                          ) : (
                            "Calculating events..."
                          )}

                          {asg.createdAt &&
                            ` • Saved ${new Date(
                              asg.createdAt
                            ).toLocaleString()}`}
                        </div>

                        {/* ==================================================
                            CONFIGURATION SUMMARY
                        ================================================== */}

                        <div
                          style={{
                            marginTop:
                              8,
                            display:
                              "flex",
                            gap: 8,
                            flexWrap:
                              "wrap",
                          }}
                        >
                          {asg.filters &&
                            asg.filters
                              .length >
                              0 && (
                              <span
                                style={{
                                  background:
                                    "#334155",
                                  color:
                                    "#cbd5e1",
                                  padding:
                                    "5px 9px",
                                  borderRadius:
                                    6,
                                  fontSize:
                                    12,
                                }}
                              >
                                {
                                  asg
                                    .filters
                                    .length
                                }{" "}
                                filters
                              </span>
                            )}

                          {asg.dateBy && (
                            <span
                              style={{
                                background:
                                  "#334155",
                                color:
                                  "#cbd5e1",
                                padding:
                                  "5px 9px",
                                borderRadius:
                                  6,
                                fontSize:
                                  12,
                              }}
                            >
                              Date:{" "}
                              {
                                asg.dateBy
                              }
                            </span>
                          )}

                          {asg.colorBy && (
                            <span
                              style={{
                                background:
                                  "#334155",
                                color:
                                  "#cbd5e1",
                                padding:
                                  "5px 9px",
                                borderRadius:
                                  6,
                                fontSize:
                                  12,
                              }}
                            >
                              Color:{" "}
                              {
                                asg.colorBy
                              }
                            </span>
                          )}
                        </div>
                      </>
                    )}

                    {!isEditing && (
                      <>
                        {/* ==================================================
                            STATUS
                        ================================================== */}

                        <div
                          style={{
                            marginTop:
                              18,
                            paddingTop:
                              16,
                            borderTop:
                              "1px solid #334155",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: 12,
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <span
                            style={{
                              color:
                                "#cbd5e1",
                              fontSize:
                                13,
                              fontWeight:
                                600,
                            }}
                          >
                            Status
                          </span>

                          <select
                            value={
                              asg.status ||
                              "Detect"
                            }
                            onChange={(
                              event
                            ) =>
                              changeStatus(
                                asg.id,
                                event
                                  .target
                                  .value as ASGStatus
                              )
                            }
                            style={{
                              background:
                                "#0f172a",
                              color:
                                "#f8fafc",
                              border:
                                `1px solid ${
                                  statusColors[
                                    asg.status ||
                                      "Detect"
                                  ]
                                }`,
                              borderRadius:
                                20,
                              padding:
                                "7px 12px",
                              fontSize:
                                13,
                              fontWeight:
                                600,
                              cursor:
                                "pointer",
                              outline:
                                "none",
                            }}
                          >
                            {statuses.map(
                              (
                                status
                              ) => (
                                <option
                                  key={
                                    status
                                  }
                                  value={
                                    status
                                  }
                                >
                                  {
                                    status
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </div>

                        {/* ==================================================
                            ACTIONS
                        ================================================== */}

                        <div
                          style={{
                            marginTop:
                              14,
                            display:
                              "flex",
                            justifyContent:
                              "flex-end",
                            gap: 8,
                            flexWrap:
                              "wrap",
                          }}
                        >
                          {isDeleting ? (
                            <>
                              <span
                                style={{
                                  color:
                                    "#fca5a5",
                                  fontSize:
                                    13,
                                  alignSelf:
                                    "center",
                                }}
                              >
                                Delete this
                                ASG?
                              </span>

                              <button
                                onClick={() => {
                                  deleteASG(
                                    asg.id
                                  );
                                  setDeleteConfirmId(
                                    null
                                  );
                                }}
                                style={{
                                  padding:
                                    "8px 14px",
                                  border:
                                    "none",
                                  borderRadius:
                                    6,
                                  background:
                                    "#dc2626",
                                  color:
                                    "white",
                                  cursor:
                                    "pointer",
                                  fontWeight:
                                    600,
                                }}
                              >
                                Delete
                              </button>

                              <button
                                onClick={() =>
                                  setDeleteConfirmId(
                                    null
                                  )
                                }
                                style={{
                                  padding:
                                    "8px 14px",
                                  border:
                                    "1px solid #475569",
                                  borderRadius:
                                    6,
                                  background:
                                    "#334155",
                                  color:
                                    "#e2e8f0",
                                  cursor:
                                    "pointer",
                                }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              {/* ==================================================
                                  REFRESH CURRENT COUNT
                              ================================================== */}

                              <button
                                type="button"
                                onClick={() =>
                                  refreshCount(
                                    asg
                                  )
                                }
                                disabled={
                                  asg.datasetId ==
                                    null ||
                                  isRefreshing
                                }
                                style={{
                                  padding:
                                    "8px 14px",
                                  border:
                                    "1px solid #475569",
                                  borderRadius:
                                    6,
                                  background:
                                    "#334155",
                                  color:
                                    "#e2e8f0",
                                  cursor:
                                    asg.datasetId ==
                                      null ||
                                    isRefreshing
                                      ? "not-allowed"
                                      : "pointer",
                                  opacity:
                                    asg.datasetId ==
                                      null ||
                                    isRefreshing
                                      ? 0.5
                                      : 1,
                                }}
                              >
                                {isRefreshing
                                  ? "Refreshing..."
                                  : "Refresh"}
                              </button>

                              {/* ==================================================
                                  VIEW ASG
                              ================================================== */}

                              <button
                                type="button"
                                onClick={() =>
                                  onOpenASG(
                                    asg
                                  )
                                }
                                disabled={
                                  asg.datasetId ==
                                  null
                                }
                                style={{
                                  padding:
                                    "8px 16px",
                                  border:
                                    "1px solid #2563eb",
                                  borderRadius:
                                    6,
                                  background:
                                    "#1d4ed8",
                                  color:
                                    "white",
                                  cursor:
                                    asg.datasetId ==
                                    null
                                      ? "not-allowed"
                                      : "pointer",
                                  fontWeight:
                                    600,
                                  opacity:
                                    asg.datasetId ==
                                    null
                                      ? 0.5
                                      : 1,
                                }}
                              >
                                View ASG
                              </button>

                              {/* ==================================================
                                  EDIT
                              ================================================== */}

                              <button
                                type="button"
                                onClick={() =>
                                  startEditing(
                                    asg
                                  )
                                }
                                style={{
                                  padding:
                                    "8px 14px",
                                  border:
                                    "1px solid #475569",
                                  borderRadius:
                                    6,
                                  background:
                                    "#334155",
                                  color:
                                    "#e2e8f0",
                                  cursor:
                                    "pointer",
                                }}
                              >
                                Edit
                              </button>

                              {/* ==================================================
                                  DELETE
                              ================================================== */}

                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteConfirmId(
                                    asg.id
                                  )
                                }
                                style={{
                                  padding:
                                    "8px 14px",
                                  border:
                                    "1px solid #7f1d1d",
                                  borderRadius:
                                    6,
                                  background:
                                    "#450a0a",
                                  color:
                                    "#fca5a5",
                                  cursor:
                                    "pointer",
                                }}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}
