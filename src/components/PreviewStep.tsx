import React from "react";

export default function PreviewStep({ data, next, back }: any) {
  if (!data.length) return <p>No data</p>;

  const columns = Object.keys(data[0]);

  return (
    <div>
      <h2
          style={{
            marginBottom: "20px",
            color: "white",
          }}
        >Step 2: Preview</h2>

      <table border={1}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.slice(0, 5).map((row: any, i: number) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col}>{row[col]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={back}>Back</button>
      <button onClick={next}>Next</button>
    </div>
  );
}