import React, {
  useMemo,
} from "react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ReferenceLine,
} from "recharts";

import { formatCountermeasureDate } from "./countermeasureHelpers";

/* ======================================================
   TYPES
====================================================== */

interface TimelinePoint {
  month: string;
  count: number;
}

interface TimelineChartProps {
  /*
    Existing backend timeline.

    Kept for compatibility, but the chart now
    primarily derives its data directly from records.
  */
  timeline: TimelinePoint[];

  loadingTimeline: boolean;

  /*
    Actual dataset records.

    The timeline is generated from these records.
  */
  records?: any[];

  /*
    Schema is used to automatically find the
    opentimestamp field.
  */
  schema?: any;

  /*
    Selected Date By field.

    Empty string means use the field mapped
    to "opentimestamp".
  */
  dateBy?: string;

  /*
    Selected categorical field.

    Empty string means no grouping.
  */
  colorBy?: string;

  countermeasure?: {
    date: string;
    title?: string;
    description?: string;
  };
}

/* ======================================================
   COUNTERMEASURE MARKER
====================================================== */

const COUNTERMEASURE_COLOR = "#f59e0b";

const COUNTERMEASURE_LABEL_MAX_CHARS = 34;

function truncateLabel(
  value: string
): string {

  if (
    value.length <=
    COUNTERMEASURE_LABEL_MAX_CHARS
  ) {
    return value;
  }

  return `${value.slice(
    0,
    COUNTERMEASURE_LABEL_MAX_CHARS - 1
  )}…`;
}

interface CountermeasureLabelProps {
  /*
    Supplied by Recharts.

    For a vertical reference line:
      x      = the line position
      y      = the top of the plot area
      height = the plot area height
  */
  viewBox?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };

  title: string;
  dateLabel: string;
  description?: string;

  /*
    Keeps the badge inside the plot area when the
    marker sits on the first or last month.
  */
  align: "start" | "middle" | "end";
}

function CountermeasureLabel({
  viewBox,
  title,
  dateLabel,
  description,
  align,
}: CountermeasureLabelProps) {

  const x =
    viewBox?.x ?? 0;

  const y =
    viewBox?.y ?? 0;

  const text =
    truncateLabel(title);

  /*
    SVG text has no layout, so the badge width is
    estimated from the character count.
  */
  const width =
    Math.max(
      text.length * 6.7,
      dateLabel.length * 6.2
    ) + 22;

  const height = 36;

  const boxX =
    align === "start"
      ? x - 6
      : align === "end"
      ? x - width + 6
      : x - width / 2;

  const boxY =
    y - height - 12;

  return (
    <g>

      {/*
        Native SVG tooltip, so the full title and the
        description stay reachable even when the
        badge text is truncated.
      */}
      <title>
        {`${title} — ${dateLabel}${
          description
            ? `\n${description}`
            : ""
        }`}
      </title>

      <rect
        x={boxX}
        y={boxY}
        width={width}
        height={height}
        rx={6}
        fill="rgba(245, 158, 11, 0.15)"
        stroke={COUNTERMEASURE_COLOR}
      />

      <text
        x={boxX + 11}
        y={boxY + 15}
        fill="#fde68a"
        fontSize={12}
        fontWeight={600}
      >
        {text}
      </text>

      <text
        x={boxX + 11}
        y={boxY + 29}
        fill={COUNTERMEASURE_COLOR}
        fontSize={11}
      >
        {dateLabel}
      </text>

      {/* Connector between the badge and the line */}
      <line
        x1={x}
        y1={boxY + height}
        x2={x}
        y2={y}
        stroke={COUNTERMEASURE_COLOR}
        strokeWidth={1}
        strokeDasharray="3 3"
      />

      <circle
        cx={x}
        cy={y}
        r={3.5}
        fill={COUNTERMEASURE_COLOR}
      />

    </g>
  );
}

/* ======================================================
   DATE PARSER
====================================================== */

function parseDate(
  value: any
): Date | null {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    value instanceof Date
  ) {
    return isNaN(
      value.getTime()
    )
      ? null
      : value;
  }

  const valueString =
    String(value).trim();

  if (!valueString) {
    return null;
  }

  /*
    YYYY-MM-DD
    YYYY-MM-DD HH:mm:ss
    YYYY-MM-DDTHH:mm:ss
  */
  const isoMatch =
    valueString.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})/
    );

  if (isoMatch) {

    const year =
      Number(
        isoMatch[1]
      );

    const month =
      Number(
        isoMatch[2]
      );

    const day =
      Number(
        isoMatch[3]
      );

    const date =
      new Date(
        year,
        month - 1,
        day
      );

    if (
      !isNaN(
        date.getTime()
      )
    ) {
      return date;
    }
  }

  /*
    DD/MM/YYYY
  */
  const slashMatch =
    valueString.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
    );

  if (slashMatch) {

    const day =
      Number(
        slashMatch[1]
      );

    const month =
      Number(
        slashMatch[2]
      );

    const year =
      Number(
        slashMatch[3]
      );

    const date =
      new Date(
        year,
        month - 1,
        day
      );

    if (
      !isNaN(
        date.getTime()
      )
    ) {
      return date;
    }
  }

  /*
    DD-MM-YYYY
  */
  const dashMatch =
    valueString.match(
      /^(\d{1,2})-(\d{1,2})-(\d{4})/
    );

  if (dashMatch) {

    const day =
      Number(
        dashMatch[1]
      );

    const month =
      Number(
        dashMatch[2]
      );

    const year =
      Number(
        dashMatch[3]
      );

    const date =
      new Date(
        year,
        month - 1,
        day
      );

    if (
      !isNaN(
        date.getTime()
      )
    ) {
      return date;
    }
  }

  /*
    Final fallback:
    native JavaScript parsing.
  */
  const parsed =
    new Date(
      valueString
    );

  if (
    !isNaN(
      parsed.getTime()
    )
  ) {
    return parsed;
  }

  return null;
}

/* ======================================================
   FORMAT MONTH
====================================================== */

function formatMonth(
  date: Date
): string {

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(
    2,
    "0"
  )}`;
}

/* ======================================================
   FIND DEFAULT EVENT DATE FIELD
====================================================== */

function findOpenTimestampField(
  schema: any
): string {

  if (
    !schema ||
    !Array.isArray(
      schema.columns
    )
  ) {
    return "";
  }

  const openTimestampColumn =
    schema.columns.find(
      (column: any) =>
        column.ontologyMapping ===
        "opentimestamp"
    );

  return (
    openTimestampColumn?.name ||
    ""
  );
}

/* ======================================================
   PARSE LIST VALUE
====================================================== */

/*
  This follows the same logic used by
  CategoricalFilter.tsx.

  Supported:

    Actual JS array:
      ["Bat", "Handle"]

    JSON string:
      '["Bat", "Handle"]'

    Python-style string:
      "['Bat', 'Handle']"

    Comma-separated string:
      "Bat, Handle"

    Normal scalar:
      "Bat"

  Result:

    ["Bat", "Handle"]

  instead of:

    ['["Bat", "Handle"]']
*/

function parseListValue(
  value: any
): string[] {

  /*
    Empty value
  */
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return [];
  }

  /*
    Already a JavaScript array.
  */
  if (
    Array.isArray(value)
  ) {

    return value
      .map(
        (item) =>
          String(item).trim()
      )
      .filter(Boolean);
  }

  /*
    Non-string values are treated
    as normal scalar categorical values.
  */
  if (
    typeof value !== "string"
  ) {

    return [
      String(value).trim(),
    ].filter(Boolean);
  }

  const trimmed =
    value.trim();

  if (!trimmed) {
    return [];
  }

  /*
    First try JSON.

    Example:

      ["Bat","Handle"]
  */
  try {

    const parsed =
      JSON.parse(
        trimmed
      );

    if (
      Array.isArray(
        parsed
      )
    ) {

      return parsed
        .map(
          (item) =>
            String(item).trim()
        )
        .filter(Boolean);
    }

  } catch {
    /*
      Continue with fallback parsing.
    */
  }

  /*
    Python-style / single-quote list.

    Example:

      ['Bat', 'Handle']
  */
  if (
    trimmed.startsWith("[") &&
    trimmed.endsWith("]")
  ) {

    const withoutBrackets =
      trimmed.slice(
        1,
        -1
      );

    if (
      withoutBrackets.trim()
    ) {

      return withoutBrackets
        .split(",")
        .map(
          (item) =>
            item
              .trim()
              .replace(
                /^["']|["']$/g,
                ""
              )
              .trim()
        )
        .filter(Boolean);
    }

    return [];
  }

  /*
    Comma-separated representation.

    Example:

      Bat, Handle
  */
  if (
    trimmed.includes(",")
  ) {

    return trimmed
      .split(",")
      .map(
        (item) =>
          item
            .trim()
            .replace(
              /^["']|["']$/g,
              ""
            )
            .trim()
      )
      .filter(Boolean);
  }

  /*
    Normal scalar.
  */
  return [
    trimmed,
  ];
}

/* ======================================================
   GET CATEGORICAL VALUES
====================================================== */

/*
  Returns the individual categorical values for
  one record and one field.

  This is the important function that keeps:

    Filtering
    Timeline
    Distribution

  consistent for multi-valued fields.
*/

function getCategoricalValues(
  record: any,
  fieldName: string
): string[] {

  const rawValue =
    record?.[
      fieldName
    ];

  /*
    Empty field.

    Return "(Blank)" so that blank values
    remain visible as a legitimate category.
  */
  if (
    rawValue === undefined ||
    rawValue === null ||
    rawValue === ""
  ) {
    return [
      "(Blank)",
    ];
  }

  /*
    Parse into individual categories.
  */
  const values =
    parseListValue(
      rawValue
    );

  /*
    Remove duplicates inside
    the same record.

    Example:

      ["Bat", "Bat", "Handle"]

    becomes:

      ["Bat", "Handle"]
  */
  return Array.from(
    new Set(
      values
        .map(
          (value) =>
            String(value).trim()
        )
        .filter(Boolean)
    )
  );
}

/* ======================================================
   COMPONENT
====================================================== */

export default function TimelineChart({

  timeline,

  loadingTimeline,

  records = [],

  schema,

  dateBy = "",

  colorBy = "",

  countermeasure,

}: TimelineChartProps) {

  /* ====================================================
     DEFAULT EVENT DATE FIELD
  ==================================================== */

  const defaultEventDateField =
    useMemo(
      () => {

        return findOpenTimestampField(
          schema
        );

      },
      [
        schema,
      ]
    );

  /*
    The actual date field used by the chart.

    If Date By is empty, automatically use
    the opentimestamp field.
  */
  const activeDateField =
    dateBy ||
    defaultEventDateField;

  /*
    The chart buckets events by month, so the
    countermeasure line is drawn on the month that
    contains the action date.
  */
  const countermeasureMonth =
    countermeasure?.date
      ? countermeasure.date.slice(0, 7)
      : "";

  /* ====================================================
     BUILD TIMELINE FROM RECORDS
  ==================================================== */

  const chartData =
    useMemo(
      () => {

        /*
          If records are available, always build
          the timeline directly from records.

          This means filters automatically affect
          the timeline.
        */
        if (
          records.length === 0
        ) {

          /*
            Fallback to backend timeline only if
            no records are available.
          */
          if (
            !dateBy &&
            timeline.length > 0
          ) {

            return timeline;
          }

          return [];
        }

        /*
          If we cannot identify a date field,
          return empty instead of rendering
          a broken chart.
        */
        if (
          !activeDateField
        ) {
          return [];
        }

        /*
          Structure:

            grouped[month][category] = count

          Example:

            grouped["2026-07"]["Bat"] = 8
            grouped["2026-07"]["Handle"] = 5

          When Color By is empty:

            grouped["2026-07"].count = 13
        */
        const grouped:
          Record<
            string,
            Record<
              string,
              number
            >
          > = {};

        records.forEach(
          (record) => {

            const rawDate =
              record[
                activeDateField
              ];

            const date =
              parseDate(
                rawDate
              );

            /*
              Ignore records where the selected
              date field cannot be parsed.
            */
            if (!date) {
              return;
            }

            const month =
              formatMonth(
                date
              );

            /* --------------------------------------------
               NO COLOR GROUPING
            -------------------------------------------- */

            if (
              !colorBy
            ) {

              if (
                !grouped[month]
              ) {

                grouped[month] = {
                  count: 0,
                };
              }

              grouped[
                month
              ].count += 1;

              return;
            }

            /* --------------------------------------------
               COLOR GROUPING
            -------------------------------------------- */

            /*
              IMPORTANT:

              Do NOT do:

                String(
                  record[colorBy]
                )

              because that converts:

                ["Bat", "Handle"]

              into:

                ["Bat", "Handle"]

              as one category.

              Instead, expand the field into
              individual categorical values.
            */
            const categories =
              getCategoricalValues(
                record,
                colorBy
              );

            /*
              One record can contain multiple
              categories.

              Example:

                Failure Component =
                  ["Bat", "Handle"]

              contributes:

                Bat    +1
                Handle +1

              But duplicate values inside
              the same record are removed.

              Example:

                ["Bat", "Bat", "Handle"]

              contributes:

                Bat    +1
                Handle +1
            */
            categories.forEach(
              (
                category
              ) => {

                if (
                  !grouped[month]
                ) {

                  grouped[month] = {};
                }

                if (
                  grouped[
                    month
                  ][
                    category
                  ] === undefined
                ) {

                  grouped[
                    month
                  ][
                    category
                  ] = 0;
                }

                grouped[
                  month
                ][
                  category
                ] += 1;
              }
            );
          }
        );

        /*
          Convert grouped object into
          Recharts-compatible array.
        */
        return Object.keys(
          grouped
        )
          .sort()
          .map(
            (month) => ({
              month,
              ...grouped[
                month
              ],
            })
          );

      },
      [
        records,
        timeline,
        activeDateField,
        colorBy,
        dateBy,
      ]
    );

  /* ====================================================
     COUNTERMEASURE MONTH BUCKET

     The X axis is categorical, so a reference line can
     only be drawn on a month that exists in the data.

     When no events fall in the countermeasure month, an
     empty bucket is inserted so the marker still shows.
     The bucket has no series keys, so it renders as a
     gap rather than a zero bar.
  ==================================================== */

  const chartDataWithMarker =
    useMemo(
      () => {

        if (
          !countermeasureMonth ||
          chartData.length === 0
        ) {
          return chartData;
        }

        const alreadyPresent =
          chartData.some(
            (
              point: any
            ) =>
              point.month ===
              countermeasureMonth
          );

        if (alreadyPresent) {
          return chartData;
        }

        return [
          ...chartData,
          {
            month:
              countermeasureMonth,
          },
        ].sort(
          (
            first: any,
            second: any
          ) =>
            String(
              first.month
            ).localeCompare(
              String(
                second.month
              )
            )
        );

      },
      [
        chartData,
        countermeasureMonth,
      ]
    );

  /*
    Alignment of the marker badge, so it is not cut off
    at the left or right edge of the plot area.
  */
  const countermeasureAlign =
    useMemo(
      () => {

        const index =
          chartDataWithMarker.findIndex(
            (
              point: any
            ) =>
              point.month ===
              countermeasureMonth
          );

        if (
          index < 0 ||
          chartDataWithMarker.length < 3
        ) {
          return "middle" as const;
        }

        if (index === 0) {
          return "start" as const;
        }

        if (
          index ===
          chartDataWithMarker.length - 1
        ) {
          return "end" as const;
        }

        return "middle" as const;

      },
      [
        chartDataWithMarker,
        countermeasureMonth,
      ]
    );

  /*
    Only true when the marker can actually be placed.
  */
  const showCountermeasureMarker =
    Boolean(countermeasureMonth) &&
    chartDataWithMarker.some(
      (
        point: any
      ) =>
        point.month ===
        countermeasureMonth
    );

  /* ====================================================
     COLOR CATEGORIES
  ==================================================== */

  const colorCategories =
    useMemo(
      () => {

        if (
          !colorBy ||
          chartData.length === 0
        ) {
          return [];
        }

        const categories =
          new Set<string>();

        chartData.forEach(
          (
            point: any
          ) => {

            Object.keys(
              point
            ).forEach(
              (key) => {

                if (
                  key !== "month"
                ) {

                  categories.add(
                    key
                  );
                }
              }
            );
          }
        );

        return Array.from(
          categories
        ).sort();

      },
      [
        chartData,
        colorBy,
      ]
    );

  /* ====================================================
     TOTAL EVENTS
  ==================================================== */

  const totalEvents =
    useMemo(
      () => {

        /*
          The event count should represent
          actual records, not category occurrences.

          Example:

            Record 1:
              ["Bat", "Handle"]

            Record 2:
              ["Bat"]

          Actual events = 2

          Category occurrences:
            Bat = 2
            Handle = 1

          Therefore the header should show:

            Events = 2

          NOT:

            Events = 3
        */
        if (
          records.length > 0
        ) {

          return records.length;
        }

        /*
          Fallback when records are unavailable.
        */
        if (
          chartData.length === 0
        ) {
          return 0;
        }

        if (
          !colorBy
        ) {

          return chartData.reduce(
            (
              total: number,
              item: any
            ) =>
              total +
              Number(
                item.count || 0
              ),
            0
          );
        }

        /*
          This fallback is only used when
          records are unavailable.

          Category totals may represent
          multi-valued category occurrences.
        */
        return chartData.reduce(
          (
            total: number,
            item: any
          ) => {

            return (
              total +
              colorCategories.reduce(
                (
                  categoryTotal,
                  category
                ) =>
                  categoryTotal +
                  Number(
                    item[
                      category
                    ] || 0
                  ),
                0
              )
            );
          },
          0
        );

      },
      [
        records,
        chartData,
        colorBy,
        colorCategories,
      ]
    );

  /* ====================================================
     TITLE
  ==================================================== */

  const chartTitle =
    colorBy
      ? `Events by ${
          activeDateField ||
          "Date"
        } and ${
          colorBy
        }`
      : `Events by ${
          activeDateField ||
          "Date"
        }`;

  /* ====================================================
     DESCRIPTION
  ==================================================== */

  const chartDescription =
    colorBy
      ? `Monthly distribution using ${
          activeDateField ||
          "the event date"
        }, grouped by ${
          colorBy
        }`
      : `Monthly distribution using ${
          activeDateField ||
          "the event date"
        }`;

  /* ====================================================
     EMPTY STATE
  ==================================================== */

  const isEmpty =
    chartData.length === 0;

  /* ====================================================
     RENDER
  ==================================================== */

  return (

    <div
      style={{
        background:
          "#1e293b",

        borderRadius:
          8,

        border:
          "1px solid #334155",

        width:
          "100%",

        minHeight:
          560,

        display:
          "flex",

        flexDirection:
          "column",

        overflow:
          "hidden",
      }}
    >

      {/* ==================================================
          HEADER
      ================================================== */}

      <div
        style={{
          padding:
            20,

          borderBottom:
            "1px solid #334155",

          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "center",
        }}
      >

        <div>

          <div
            style={{
              fontSize:
                18,

              fontWeight:
                600,

              color:
                "white",
            }}
          >
            {
              chartTitle
            }
          </div>

          <div
            style={{
              marginTop:
                5,

              fontSize:
                13,

              color:
                "#94a3b8",
            }}
          >
            {
              chartDescription
            }
          </div>

          {countermeasure?.date && (

            <div
              style={{
                marginTop:
                  10,

                display:
                  "inline-flex",

                flexDirection:
                  "column",

                gap:
                  2,

                padding:
                  "8px 12px",

                background:
                  "rgba(245, 158, 11, 0.12)",

                border:
                  `1px solid ${COUNTERMEASURE_COLOR}`,

                borderRadius:
                  8,

                maxWidth:
                  520,
              }}
            >

              <div
                style={{
                  fontSize:
                    12,

                  fontWeight:
                    600,

                  color:
                    "#fde68a",
                }}
              >
                Countermeasure ·{" "}
                {
                  formatCountermeasureDate(
                    countermeasure.date
                  )
                }
              </div>

              <div
                style={{
                  fontSize:
                    12,

                  color:
                    "#fbbf24",
                }}
              >
                {
                  countermeasure.title ||
                  "Countermeasure"
                }
              </div>

              {countermeasure.description && (

                <div
                  style={{
                    fontSize:
                      12,

                    color:
                      "#94a3b8",
                  }}
                >
                  {
                    countermeasure.description
                  }
                </div>

              )}

            </div>

          )}

        </div>

        {/* EVENT COUNT */}

        <div
          style={{
            background:
              "#0f172a",

            border:
              "1px solid #334155",

            borderRadius:
              8,

            padding:
              "10px 18px",

            textAlign:
              "center",

            minWidth:
              75,
          }}
        >

          <div
            style={{
              fontSize:
                12,

              color:
                "#94a3b8",
            }}
          >
            Events
          </div>

          <div
            style={{
              fontSize:
                24,

              fontWeight:
                "bold",

              color:
                "#38bdf8",
            }}
          >
            {
              totalEvents.toLocaleString()
            }
          </div>

        </div>

      </div>

      {/* ==================================================
          CHART BODY
      ================================================== */}

      <div
        style={{
          width:
            "100%",

          height:
            450,

          padding:
            20,

          boxSizing:
            "border-box",
        }}
      >

        {loadingTimeline ? (

          <div
            style={{
              display:
                "flex",

              justifyContent:
                "center",

              alignItems:
                "center",

              height:
                "100%",

              color:
                "#94a3b8",

              fontSize:
                18,
            }}
          >
            Loading timeline...
          </div>

        ) : isEmpty ? (

          <div
            style={{
              display:
                "flex",

              flexDirection:
                "column",

              justifyContent:
                "center",

              alignItems:
                "center",

              height:
                "100%",

              color:
                "#94a3b8",

              fontSize:
                16,

              textAlign:
                "center",

              gap:
                8,
            }}
          >

            <div>
              No timeline data available.
            </div>

            <div
              style={{
                fontSize:
                  12,

                color:
                  "#64748b",
              }}
            >
              Check that the selected date
              column contains valid dates.
            </div>

          </div>

        ) : (

          <ResponsiveContainer
            width="100%"
            height="100%"
          >

            <BarChart
              data={
                chartDataWithMarker
              }

              margin={{
                /*
                  Extra headroom so the countermeasure
                  badge sits above the plot area
                  instead of being clipped.
                */
                top:
                  showCountermeasureMarker
                    ? 64
                    : 20,

                right:
                  30,

                left:
                  10,

                bottom:
                  30,
              }}
            >

              <CartesianGrid
                stroke="var(--border-subtle)"
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="month"
                stroke="var(--text-secondary)"
                tick={{
                  fill: "var(--text-secondary)",
                  fontSize: 12,
                }}
              />

              <YAxis
                stroke="var(--text-secondary)"
                allowDecimals={false}
                tick={{
                  fill: "var(--text-secondary)",
                  fontSize: 12,
                }}
              />

              {/* ==================================================
                  COUNTERMEASURE MARKER
              ================================================== */}

              {showCountermeasureMarker && (
                <ReferenceLine
                  x={countermeasureMonth}
                  stroke={COUNTERMEASURE_COLOR}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  ifOverflow="visible"
                  label={(labelProps: { viewBox?: CountermeasureLabelProps["viewBox"] }) => (
                    <CountermeasureLabel
                      viewBox={labelProps?.viewBox}
                      title={countermeasure?.title || "Countermeasure"}
                      dateLabel={formatCountermeasureDate(countermeasure?.date || "")}
                      description={countermeasure?.description}
                      align={countermeasureAlign}
                    />
                  )}
                />
              )}

              <Tooltip
                cursor={{
                  fill: "rgba(0, 229, 255, 0.08)",
                }}
                contentStyle={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  color: "var(--text-primary)",
                }}
              />

              {/* ==================================================
                  LEGEND
              ================================================== */}

              {colorBy &&
                colorCategories.length >
                  0 && (

                <Legend
                  wrapperStyle={{
                    color:
                      "#cbd5e1",

                    paddingTop:
                      10,
                  }}
                />

              )}

              {/* ==================================================
                  SINGLE SERIES
              ================================================== */}

              {!colorBy && (
                <Bar
                  dataKey="count"
                  name="Events"
                  fill="var(--accent-cyan)"
                  radius={[4, 4, 0, 0]}
                />
              )}

              {/* ==================================================
                  GROUPED SERIES
              ================================================== */}

              {colorBy &&
                colorCategories.map((category, index) => (
                  <Bar
                    key={category}
                    dataKey={category}
                    name={category}
                    fill={
                      [
                        "#00E5FF",
                        "#3B82F6",
                        "#8B5CF6",
                        "#F59E0B",
                        "#10B981",
                        "#EC4899",
                        "#14B8A6",
                        "#F97316",
                        "#6366F1",
                        "#84CC16",
                      ][index % 10]
                    }
                    stackId="events"
                    radius={[0, 0, 0, 0]}
                  />
                ))}

            </BarChart>

          </ResponsiveContainer>

        )}

      </div>

    </div>

  );
}

