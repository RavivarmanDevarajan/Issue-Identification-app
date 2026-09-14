import React from "react";
import Papa from "papaparse";

interface RecordsTableProps {
  records: any[];
  totalRecords?: number;
}

export default function RecordsTable({
  records,
  totalRecords,
}: RecordsTableProps) {

  const downloadCSV = () => {

    if (records.length === 0) return;

    const csv = Papa.unparse(records);

    const blob = new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      "filtered_records.csv";

    link.click();

    URL.revokeObjectURL(url);

  };

  return (

    <div

      style={{

        background: "#1e293b",

        borderRadius: 8,

        border:
          "1px solid #334155",

        display: "flex",

        flexDirection: "column",

        height: "100%",

      }}

    >

      {/* HEADER */}

      <div

        style={{

          display: "flex",

          justifyContent:
            "space-between",

          alignItems: "center",

          padding: 18,

          borderBottom:
            "1px solid #334155",

        }}

      >

        <div>

          <div

            style={{

              fontSize: 18,

              fontWeight: 600,

              color: "white",

            }}

          >

            Dataset Records

          </div>

          <div

            style={{

              color: "#94a3b8",

              marginTop: 5,

              fontSize: 13,

            }}

          >

            Showing{" "}

            <b>

              {records.length}

            </b>

            {typeof totalRecords ===
            "number" ? (
              <>
                {" "}
                of{" "}
                <b>
                  {totalRecords}
                </b>
              </>
            ) : null}

            {" "}records

          </div>

        </div>

        <button

          onClick={downloadCSV}

          disabled={
            records.length === 0
          }

          style={{

            background: "#2563eb",

            color: "white",

            border: "none",

            padding:
              "10px 16px",

            borderRadius: 6,

            cursor:
              records.length === 0
                ? "not-allowed"
                : "pointer",

            opacity:
              records.length === 0
                ? 0.6
                : 1,

          }}

        >

          Download CSV

        </button>

      </div>

      {/* TABLE */}

      <div

        style={{

          flex: 1,

          overflow: "auto",

        }}

      >

        {records.length === 0 ? (

          <div

            style={{

              display: "flex",

              justifyContent:
                "center",

              alignItems: "center",

              height: "100%",

              color: "#94a3b8",

              fontSize: 18,

            }}

          >

            No records to display.

          </div>

        ) : (

          <table

            style={{

              width: "100%",

              borderCollapse:
                "collapse",

            }}

          >

            <thead>

              <tr>

                <th
                  style={headerStyle}
                >
                  #
                </th>

                {Object.keys(
                  records[0]
                ).map((column) => (

                  <th

                    key={column}

                    style={headerStyle}

                  >

                    {column}

                  </th>

                ))}

              </tr>

            </thead>

            <tbody>

              {records.map(
                (
                  row,
                  index
                ) => (

                  <tr key={index}>

                    <td
                      style={
                        cellStyle
                      }
                    >
                      {index + 1}
                    </td>

                    {Object.keys(
                      records[0]
                    ).map(
                      (
                        column
                      ) => (

                        <td

                          key={
                            column
                          }

                          style={
                            cellStyle
                          }

                        >

                          {String(
                            row[
                              column
                            ] ?? ""
                          )}

                        </td>

                      )
                    )}

                  </tr>

                )
              )}

            </tbody>

          </table>

        )}

      </div>

    </div>

  );

}

const headerStyle: React.CSSProperties = {

  position: "sticky",

  top: 0,

  background: "#0f172a",

  color: "white",

  padding: 12,

  textAlign: "left",

  border:
    "1px solid #334155",

  whiteSpace: "nowrap",

  zIndex: 10,

};

const cellStyle: React.CSSProperties = {

  padding: 10,

  border:
    "1px solid #334155",

  whiteSpace: "nowrap",

  color: "#e5e7eb",

};