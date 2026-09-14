import React from "react";

export default function Home({ navigate }: any) {
  const cardStyle: React.CSSProperties = {
    background: "#1e293b",
    borderRadius: "12px",
    padding: "35px",
    width: "380px",
    minHeight: "240px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
    cursor: "pointer",
    transition: "all 0.25s ease",
  };

  const buttonStyle: React.CSSProperties = {
    marginTop: "25px",
    padding: "12px",
    border: "none",
    borderRadius: "6px",
    color: "white",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: 600,
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div
        style={{
          padding: "30px 50px",
          borderBottom: "1px solid #334155",
          background: "#111827",
        }}
      >
        <h1
          style={{
            margin: 0,
            color: "#f8fafc",
            fontSize: "34px",
          }}
        >
          Issue Identification System
        </h1>

        <p
          style={{
            marginTop: "10px",
            color: "#94a3b8",
            fontSize: "16px",
          }}
        >
          AI-powered issue investigation platform for engineering datasets.
        </p>
      </div>

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}

      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "40px",
          padding: "60px",
          flexWrap: "wrap",
        }}
      >
        {/* ===================================================
            DATA INGESTION
        ==================================================== */}

        <div
          style={cardStyle}
          onClick={() => navigate("ingestion")}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform =
              "translateY(-6px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform =
              "translateY(0px)";
          }}
        >
          <div>
            <h2
              style={{
                color: "#f8fafc",
                marginBottom: "18px",
              }}
            >
              📥 Data Ingestion
            </h2>

            <p
              style={{
                color: "#cbd5e1",
                lineHeight: 1.7,
              }}
            >
              Upload CSV datasets, configure ontology
              mappings, validate schemas, and manage all
              ingested datasets.
            </p>
          </div>

          <button
            style={{
              ...buttonStyle,
              background: "#2563eb",
            }}
          >
            Open Module
          </button>
        </div>

        {/* ===================================================
            INVESTIGATION
        ==================================================== */}

        <div
          style={cardStyle}
          onClick={() => navigate("investigate")}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform =
              "translateY(-6px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform =
              "translateY(0px)";
          }}
        >
          <div>
            <h2
              style={{
                color: "#f8fafc",
                marginBottom: "18px",
              }}
            >
              🔍 Investigation
            </h2>

            <p
              style={{
                color: "#cbd5e1",
                lineHeight: 1.7,
              }}
            >
              Explore uploaded datasets, visualize event
              timelines, filter records, and investigate
              engineering issues interactively.
            </p>
          </div>

          <button
            style={{
              ...buttonStyle,
              background: "#16a34a",
            }}
          >
            Open Module
          </button>
        </div>

        {/* ===================================================
            ASGs
        ==================================================== */}

        <div
          style={cardStyle}
          onClick={() => navigate("asgs")}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform =
              "translateY(-6px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform =
              "translateY(0px)";
          }}
        >
          <div>
            <h2
              style={{
                color: "#f8fafc",
                marginBottom: "18px",
              }}
            >
              📊 ASGs
            </h2>

            <p
              style={{
                color: "#cbd5e1",
                lineHeight: 1.7,
              }}
            >
              Review flagged engineering trends from
              investigations, including their identifiers,
              titles, and issue categories.
            </p>
          </div>

          <button
            style={{
              ...buttonStyle,
              background: "#9333ea",
            }}
          >
            Open Module
          </button>
        </div>
      </div>
    </div>
  );
}