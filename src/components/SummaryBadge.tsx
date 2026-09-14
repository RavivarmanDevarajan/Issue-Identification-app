import React from "react";

interface SummaryBadgeProps {
  eventCount: number;
}

export default function SummaryBadge({
  eventCount,
}: SummaryBadgeProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: 8,
        padding: "12px 18px",
        width: "fit-content",
      }}
    >
      <span
        style={{
          color: "#94a3b8",
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        Total Events
      </span>

      <span
        style={{
          color: "#38bdf8",
          fontSize: 24,
          fontWeight: "bold",
        }}
      >
        {eventCount.toLocaleString()}
      </span>
    </div>
  );
}