import React, { useEffect, useState } from "react";
import Papa from "papaparse";

export default function UploadStep({
  setFileData,
  setFileName,
  next,
}: any) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/datasets"
      );

      const data = await response.json();

      setDatasets(data);
    } catch (error) {
      console.error("Failed to fetch datasets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: any) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,

      complete: (results) => {
        setFileData(results.data);

        next();
      },

      error: (error) => {
        console.error("CSV Parse Error:", error);
        alert("Failed to parse CSV file");
      },
    });
  };

  const downloadDataset = async (id: number) => {
    try {
      const response = await fetch(
        `http://localhost:5000/datasets/${id}/download`
      );

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      const disposition =
        response.headers.get(
          "Content-Disposition"
        );

      let fileName = "dataset.csv";

      if (disposition) {
        const match =
          disposition.match(
            /filename="(.+)"/
          );

        if (match) {
          fileName = match[1];
        }
      }

      link.href = url;
      link.download = fileName;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);

      alert("Failed to download dataset");
    }
  };

  return (
    <div>
      {/* Upload Section */}
      <div
        style={{
          backgroundColor: "#1e293b",
          padding: "20px",
          borderRadius: "10px",
          marginBottom: "30px",
        }}
      >
        <h2
          style={{
            marginBottom: "15px",
            color: "white",
          }}
        >
          Step 1: Upload CSV
        </h2>

        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          style={{
            padding: "10px",
            backgroundColor: "#0f172a",
            color: "white",
            borderRadius: "5px",
          }}
        />
      </div>

      {/* Dashboard */}
      <div
        style={{
          backgroundColor: "#1e293b",
          padding: "20px",
          borderRadius: "10px",
        }}
      >
        <h2
          style={{
            marginBottom: "20px",
            color: "white",
          }}
        >
          📊 Previous Ingestions
        </h2>

        {loading ? (
          <p>Loading datasets...</p>
        ) : datasets.length === 0 ? (
          <p>No datasets uploaded yet.</p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                {[
                  "File Name",
                  "Dataset Name",
                  "Updated Date",
                  "Size (KB)",
                  "Data Type",
                  "Status",
                  "Time Taken (ms)",
                  "Download",
                ].map((head) => (
                  <th
                    key={head}
                    style={{
                      padding: "12px",
                      borderBottom:
                        "1px solid #334155",
                      textAlign: "left",
                    }}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {datasets.map((dataset) => (
                <tr key={dataset.id}>
                  <td style={cellStyle}>
                    {dataset.file_name || "-"}
                  </td>

                  <td style={cellStyle}>
                    {dataset.dataset_name || "-"}
                  </td>

                  <td style={cellStyle}>
                    {dataset.uploaded_at
                      ? new Date(
                          dataset.uploaded_at
                        ).toLocaleString()
                      : "-"}
                  </td>

                  <td style={cellStyle}>
                    {dataset.size_kb
                      ? dataset.size_kb.toFixed(2)
                      : "-"}
                  </td>

                  <td style={cellStyle}>
                    {dataset.data_type || "-"}
                  </td>

                  <td style={cellStyle}>
                    <span
                      style={{
                        color:
                          dataset.status ===
                          "Completed"
                            ? "#4ade80"
                            : "#facc15",
                      }}
                    >
                      {dataset.status || "-"}
                    </span>
                  </td>

                  <td style={cellStyle}>
                    {dataset.ingestion_time_ms ||
                      "-"}
                  </td>

                  <td style={cellStyle}>
                    <button
                      onClick={() =>
                        downloadDataset(
                          dataset.id
                        )
                      }
                      style={{
                        backgroundColor:
                          "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        padding:
                          "6px 12px",
                        cursor: "pointer",
                      }}
                    >
                      Download CSV
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const cellStyle = {
  padding: "12px",
  borderBottom: "1px solid #334155",
};