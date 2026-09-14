import React, {
  useEffect,
  useState,
} from "react";

interface Asg {
  id: number;
  asg_number: string;
  title: string;
  category: string;
  dataset_id: number | null;
  dataset_name: string | null;
  event_count: number | null;
  created_at: string;
}

const categoryColors: Record<string, string> = {
  Recurring: "#2563eb",
  "Re-occurring": "#7c3aed",
  Spike: "#dc2626",
  Seasonal: "#0891b2",
  Anomaly: "#d97706",
  Emerging: "#16a34a",
  Persistent: "#4f46e5",
};

export default function Asgs({
  navigate,
}: any) {
  const [asgs, setAsgs] = useState<Asg[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadAsgs();
  }, []);

  async function loadAsgs() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch(
        "http://localhost:5000/asgs"
      );
      const payload = await response.json();

      if (!payload.success) {
        throw new Error(
          payload.message || "Failed to load ASGs"
        );
      }

      setAsgs(payload.asgs || []);
    } catch (error: any) {
      setErrorMessage(
        error.message || "Failed to load ASGs"
      );
    } finally {
      setLoading(false);
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
      <div
        style={{
          height: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 35px",
          background: "#111827",
          borderBottom: "1px solid #334155",
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
            onClick={() => navigate("home")}
            style={{
              padding: "10px 18px",
              border: "none",
              borderRadius: 6,
              background: "#475569",
              color: "white",
              cursor: "pointer",
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
                color: "#94a3b8",
              }}
            >
              Flagged investigation trends with identifiers,
              titles, and issue categories.
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: 35, flex: 1 }}>
        {loading && (
          <div style={{ color: "#94a3b8" }}>
            Loading ASGs...
          </div>
        )}

        {errorMessage && (
          <div style={{ color: "#fca5a5" }}>
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && asgs.length === 0 && (
          <div
            style={{
              background: "#111827",
              border: "1px solid #334155",
              borderRadius: 12,
              padding: 40,
              color: "#94a3b8",
              maxWidth: 720,
            }}
          >
            No ASGs have been saved yet. Open the
            Investigation Workspace, apply filters to a
            trend, then use Save ASG.
          </div>
        )}

        {!loading && asgs.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {asgs.map((asg) => (
              <div
                key={asg.id}
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 12,
                  padding: "22px 24px",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 20,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        background: "#0f172a",
                        color: "#38bdf8",
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontWeight: 700,
                        fontSize: 14,
                        letterSpacing: 0.4,
                      }}
                    >
                      {asg.asg_number}
                    </span>

                    <h2
                      style={{
                        margin: 0,
                        fontSize: 20,
                        color: "#f8fafc",
                      }}
                    >
                      {asg.title}
                    </h2>
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      color: "#94a3b8",
                      fontSize: 14,
                    }}
                  >
                    {asg.dataset_name || "Unknown dataset"}
                    {asg.event_count != null
                      ? ` • ${asg.event_count} events`
                      : ""}
                    {asg.created_at
                      ? ` • Saved ${new Date(
                          asg.created_at
                        ).toLocaleString()}`
                      : ""}
                  </div>
                </div>

                <span
                  style={{
                    background:
                      categoryColors[asg.category] ||
                      "#475569",
                    color: "white",
                    padding: "7px 12px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {asg.category}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
