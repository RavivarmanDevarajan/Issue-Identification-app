import React from "react";

interface InvestigationTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const tabs = ["Time", "Distribution", "Data"];

export default function InvestigationTabs({
  activeTab,
  setActiveTab,
}: InvestigationTabsProps) {
  return (
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid #334155",
        paddingLeft: 20,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color:
              activeTab === tab
                ? "#38bdf8"
                : "#cbd5e1",
            padding: "15px 25px",
            fontSize: 15,
            fontWeight:
              activeTab === tab
                ? 600
                : 400,
            borderBottom:
              activeTab === tab
                ? "3px solid #38bdf8"
                : "3px solid transparent",
            transition: "all 0.2s ease",
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}