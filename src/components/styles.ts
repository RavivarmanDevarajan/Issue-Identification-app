import React from "react";

/* ======================================================
   COMMON INPUTS
====================================================== */

export const searchInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "#0f172a",
  color: "white",
  border: "1px solid #475569",
  borderRadius: 6,
  boxSizing: "border-box",
};

export const selectStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 10px",
  background: "#0f172a",
  color: "white",
  border: "1px solid #475569",
  borderRadius: 6,
  outline: "none",
};

export const numberInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "#0f172a",
  color: "white",
  border: "1px solid #475569",
  borderRadius: 6,
  boxSizing: "border-box",
};

export const dateInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "#0f172a",
  color: "white",
  border: "1px solid #475569",
  borderRadius: 6,
  boxSizing: "border-box",
};

/* ======================================================
   BUTTONS
====================================================== */

export const actionButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#38bdf8",
  cursor: "pointer",
  fontSize: 12,
};

export const smallButton: React.CSSProperties = {
  padding: "7px 10px",
  background: "#334155",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
};

export const dangerButton: React.CSSProperties = {
  padding: "9px 12px",
  background: "#7f1d1d",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};

/* ======================================================
   TOOLBARS
====================================================== */

export const toolbarStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginBottom: 12,
};

export const actionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
};

/* ======================================================
   VALUE LIST
====================================================== */

export const valueContainerStyle: React.CSSProperties = {
  maxHeight: 320,
  overflowY: "auto",
  border: "1px solid #334155",
  borderRadius: 6,
};

export const valueRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "9px 10px",
  borderBottom: "1px solid #334155",
  cursor: "pointer",
};

/* ======================================================
   FILTER PANELS
====================================================== */

export const filterSectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

export const helperTextStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 12,
};

export const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#e2e8f0",
};

/* ======================================================
   PRESET BUTTONS
====================================================== */

export const presetGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 8,
};

export const presetButtonStyle: React.CSSProperties = {
  padding: "8px",
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 6,
  color: "white",
  cursor: "pointer",
  fontSize: 12,
};