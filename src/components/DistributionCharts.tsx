import React, { useMemo } from "react";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

interface Column {
  name: string;
  type: string;
  ontologyMapping: string;
}

interface Schema {
  columns: Column[];
}

interface Props {
  records: any[];

  schema: Schema | null;

  chartType: "bar" | "pie";

  setChartType: (
    value: "bar" | "pie"
  ) => void;

  filtersApplied?: boolean;
}

/* ======================================================
   COLORS
====================================================== */

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#eab308",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#ec4899",
  "#6366f1",
  "#84cc16",
];

/* ======================================================
   COMPONENT
====================================================== */

export default function DistributionCharts({
  records,
  schema,
  chartType,
  setChartType,
  filtersApplied = false,
}: Props) {

  /* ====================================================
     FIND DISTRIBUTION COLUMNS
  ==================================================== */

  const categoricalColumns =
    useMemo(() => {

      if (!schema) {
        return [];
      }

      return schema.columns.filter(
        (column) => {

          /* ----------------------------------------------
             Skip internal timestamp
          ---------------------------------------------- */

          if (
            column.ontologyMapping ===
            "opentimestamp"
          ) {
            return false;
          }

          const type =
            String(
              column.type || ""
            )
              .trim()
              .toLowerCase();

          /* ----------------------------------------------
             Skip numeric columns
          ---------------------------------------------- */

          if (
            type.includes("number") ||
            type.includes("integer") ||
            type.includes("float") ||
            type.includes("double") ||
            type.includes("decimal") ||
            type.includes("numeric")
          ) {
            return false;
          }

          /*
            Include:

            - normal categorical columns
            - list columns
          */

          return true;
        }
      );

    }, [schema]);

  /* ====================================================
     CHECK WHETHER COLUMN IS A LIST
  ==================================================== */

  function isListColumn(
    column: Column
  ): boolean {

    const type =
      String(
        column.type || ""
      )
        .trim()
        .toLowerCase();

    return (
      type === "list" ||
      type.startsWith("list<") ||
      type.startsWith("array") ||
      type.includes("list")
    );
  }

  /* ====================================================
     PARSE LIST VALUE
  ==================================================== */

  function parseListValue(
    value: any
  ): string[] {

    /* ----------------------------------------------
       Empty value
    ---------------------------------------------- */

    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return [];
    }

    /* ----------------------------------------------
       Already a JavaScript array

       Example:

       [
         "Low Power",
         "Underpowered"
       ]
    ---------------------------------------------- */

    if (
      Array.isArray(value)
    ) {

      return value
        .map(
          (item) =>
            String(item)
              .trim()
        )
        .filter(Boolean);
    }

    /*
      We only continue parsing if
      the value is a string.
    */

    if (
      typeof value !==
      "string"
    ) {
      return [];
    }

    let text =
      value.trim();

    if (!text) {
      return [];
    }

    /* ==================================================
       JSON ARRAY

       Example:

       ["Low Power", "Underpowered"]
    ================================================== */

    try {

      const parsed =
        JSON.parse(text);

      if (
        Array.isArray(parsed)
      ) {

        return parsed
          .map(
            (item) =>
              String(item)
                .trim()
          )
          .filter(Boolean);
      }

      /*
        Sometimes the backend may return
        a JSON string containing another
        serialized list.

        Example:

        "\"['Low Power', 'Underpowered']\""
      */

      if (
        typeof parsed ===
        "string"
      ) {

        text =
          parsed.trim();
      }

    } catch {
      /*
        Not valid JSON.

        Continue with Python-style
        list parsing below.
      */
    }

    /* ==================================================
       PYTHON-STYLE LIST

       Example:

       ['Low Power', 'Underpowered']
    ================================================== */

    if (
      text.startsWith("[") &&
      text.endsWith("]")
    ) {

      const inner =
        text.slice(
          1,
          -1
        );

      /*
        Try to extract quoted values.

        This handles:

        ['Low Power', 'Underpowered']

        and:

        ["Low Power", "Underpowered"]

        It also handles values
        containing commas.
      */

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
          .filter(Boolean);
      }

      /*
        Fallback for simple lists
        such as:

        [Battery, Charging]
      */

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
        )
        .filter(Boolean);
    }

    /* ==================================================
       SINGLE VALUE

       Example:

       "Battery"
    ================================================== */

    return [
      text
        .replace(
          /^['"]|['"]$/g,
          ""
        )
        .trim(),
    ].filter(Boolean);
  }

  /* ====================================================
     BUILD DISTRIBUTIONS
  ==================================================== */

  const distributions =
    useMemo(() => {

      const result: Record<
        string,
        {
          name: string;
          value: number;
        }[]
      > = {};

      categoricalColumns.forEach(
        (column) => {

          /* ==================================================
             LIST COLUMN
          ================================================== */

          if (
            isListColumn(
              column
            )
          ) {

            /*
              Map:

                List Value
                    ↓
                Unique Complaint IDs

              Example:

                Low Power
                  → Complaint 1
                  → Complaint 2
                  → Complaint 5

                count = 3

              This ensures that each complaint
              is counted only once for a given
              list value.
            */

            const valueComplaints =
              new Map<
                string,
                Set<string>
              >();

            records.forEach(
              (
                record,
                recordIndex
              ) => {

                const values =
                  parseListValue(
                    record[
                      column.name
                    ]
                  );

                /*
                  Ignore empty list values.

                  We want the chart to show
                  actual unique list values,
                  not the serialized empty list.
                */

                if (
                  values.length === 0
                ) {
                  return;
                }

                /*
                  Make values unique within
                  the same complaint.

                  Example:

                    ["Battery", "Battery"]

                  counts as:

                    Battery = 1 complaint

                  rather than:

                    Battery = 2 occurrences
                */

                const uniqueValues =
                  new Set(
                    values
                      .map(
                        (value) =>
                          String(value)
                            .trim()
                      )
                      .filter(Boolean)
                  );

                /*
                  Resolve the complaint/event ID.

                  Preferred order:

                    1. _id
                    2. id
                    3. Event Id
                    4. Event ID
                    5. record index fallback
                */

                const complaintId =
                  String(
                    record?._id ??
                    record?.id ??
                    record?.["Event Id"] ??
                    record?.["Event ID"] ??
                    recordIndex
                  ).trim();

                /*
                  Associate each unique list
                  value with this complaint.
                */

                uniqueValues.forEach(
                  (
                    value
                  ) => {

                    if (
                      !valueComplaints.has(
                        value
                      )
                    ) {

                      valueComplaints.set(
                        value,
                        new Set<string>()
                      );
                    }

                    valueComplaints
                      .get(value)!
                      .add(
                        complaintId
                      );
                  }
                );

              }
            );

            /*
              Convert:

                Map<
                  "Low Power",
                  Set("1", "2", "5")
                >

              into:

                {
                  name: "Low Power",
                  value: 3
                }
            */

            result[
              column.name
            ] =
              Array.from(
                valueComplaints.entries()
              )
                .map(
                  (
                    [
                      name,
                      complaintIds,
                    ]
                  ) => ({
                    name,
                    value:
                      complaintIds.size,
                  })
                )
                .sort(
                  (a, b) =>
                    b.value -
                    a.value
                );

            return;
          }

          /* ==================================================
             NORMAL CATEGORICAL COLUMN
          ================================================== */

          const counts: Record<
            string,
            number
          > = {};

          records.forEach(
            (record) => {

              let value =
                record[
                  column.name
                ];

              if (
                value ===
                  undefined ||
                value === null ||
                value === ""
              ) {

                value =
                  "(Blank)";
              }

              value =
                String(
                  value
                );

              counts[value] =
                (
                  counts[value] ||
                  0
                ) + 1;

            }
          );

          result[
            column.name
          ] =
            Object.entries(
              counts
            )
              .sort(
                (a, b) =>
                  b[1] -
                  a[1]
              )
              .map(
                (
                  [
                    name,
                    value,
                  ]
                ) => ({
                  name,
                  value,
                })
              );

        }
      );

      return result;

    }, [
      categoricalColumns,
      records,
    ]);

  /* ====================================================
     EMPTY DATA
  ==================================================== */

  if (
    records.length === 0
  ) {

    return (
      <div
        style={{
          display: "flex",
          justifyContent:
            "center",
          alignItems:
            "center",
          height: "100%",
          color: "#94a3b8",
          fontSize: 20,
        }}
      >
        Click "Load All Events"
        to generate distributions.
      </div>
    );

  }

  /* ====================================================
     RENDER
  ==================================================== */

  return (
    <div
      style={{
        display: "flex",
        flexDirection:
          "column",
        gap: 25,
      }}
    >

      {/* ==================================================
          HEADER
      ================================================== */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "center",
        }}
      >

        <div>

          <h2
            style={{
              margin: 0,
              color: "#94a3b8",
            }}
          >
            Variable Distributions
          </h2>

          <div
            style={{
              marginTop: 6,
              color:
                filtersApplied
                  ? "#22c55e"
                  : "#64748b",
              fontSize: 13,
            }}
          >
            {filtersApplied
              ? "Showing distributions for filtered records"
              : "Showing distributions for all records"}
          </div>

        </div>

        {/* ==================================================
            CHART TOGGLE
        ================================================== */}

        <div
          style={{
            display: "flex",
            gap: 10,
          }}
        >

          <button
            onClick={() =>
              setChartType(
                "bar"
              )
            }
            style={{
              padding:
                "8px 16px",
              border: "none",
              borderRadius: 6,
              cursor:
                "pointer",
              background:
                chartType ===
                "bar"
                  ? "#2563eb"
                  : "#334155",
              color: "white",
            }}
          >
            Histogram
          </button>

          <button
            onClick={() =>
              setChartType(
                "pie"
              )
            }
            style={{
              padding:
                "8px 16px",
              border: "none",
              borderRadius: 6,
              cursor:
                "pointer",
              background:
                chartType ===
                "pie"
                  ? "#2563eb"
                  : "#334155",
              color: "white",
            }}
          >
            Pie
          </button>

        </div>

      </div>

      {/* ==================================================
          CHARTS
      ================================================== */}

      {categoricalColumns.map(
        (column) => {

          const chartData =
            distributions[
              column.name
            ] || [];

          const isList =
            isListColumn(
              column
            );

          return (

            <div
              key={
                column.name
              }
              style={{
                background:
                  "#1e293b",
                border:
                  "1px solid #334155",
                borderRadius:
                  10,
                padding: 20,
              }}
            >

              {/* ==================================================
                  VARIABLE TITLE
              ================================================== */}

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  marginBottom:
                    20,
                }}
              >

                <div>

                  <h3
                    style={{
                      margin: 0,
                    }}
                  >
                    {column.name}
                  </h3>

                  <div
                    style={{
                      marginTop: 5,
                      color:
                        "#94a3b8",
                      fontSize: 14,
                    }}
                  >

                    {chartData.length}{" "}
                    unique values

                    {isList && (
                      <span>
                        {" "}
                        · complaints containing each value
                      </span>
                    )}

                  </div>

                </div>

              </div>

              {/* ==================================================
                  CHART
              ================================================== */}

              <div
                style={{
                  width:
                    "100%",
                  height: 420,
                }}
              >

                {chartType ===
                "bar" ? (

                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >

                    <BarChart
                      data={
                        chartData
                      }
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 80,
                      }}
                    >

                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#475569"
                      />

                      <XAxis
                        dataKey="name"
                        stroke="#cbd5e1"
                        angle={-30}
                        textAnchor="end"
                        interval={0}
                        height={90}
                      />

                      <YAxis
                        stroke="#cbd5e1"
                      />

                      <Tooltip
                        formatter={(
                          value
                        ) => [
                          value,
                          isList
                            ? "Complaints"
                            : "Records",
                        ]}
                      />

                      <Bar
                        dataKey="value"
                        fill="#3b82f6"
                        radius={[
                          5,
                          5,
                          0,
                          0,
                        ]}
                      />

                    </BarChart>

                  </ResponsiveContainer>

                ) : (

                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >

                    <PieChart>

                      <Pie
                        data={
                          chartData
                        }
                        dataKey="value"
                        nameKey="name"
                        outerRadius={140}
                        label
                      >

                        {chartData.map(
                          (
                            _,
                            index
                          ) => (

                            <Cell
                              key={
                                index
                              }
                              fill={
                                COLORS[
                                  index %
                                    COLORS.length
                                ]
                              }
                            />

                          )
                        )}

                      </Pie>

                      <Tooltip
                        formatter={(
                          value
                        ) => [
                          value,
                          isList
                            ? "Complaints"
                            : "Records",
                        ]}
                      />

                      <Legend />

                    </PieChart>

                  </ResponsiveContainer>

                )}

              </div>

            </div>

          );

        }
      )}

    </div>
  );
}