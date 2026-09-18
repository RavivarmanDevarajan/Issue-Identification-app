import React from "react";

/* ======================================================
   COMMON INPUTS
====================================================== */

export const searchInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "#111416",
  color: "#F2F4F5",
  border: "1px solid #24282D",
  borderRadius: 6,
  boxSizing: "border-box",
  fontSize: 13,
  outline: "none",
};

export const selectStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  background: "#111416",
  color: "#F2F4F5",
  border: "1px solid #24282D",
  borderRadius: 6,
  outline: "none",
  fontSize: 13,
};

export const numberInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "#111416",
  color: "#F2F4F5",
  border: "1px solid #24282D",
  borderRadius: 6,
  boxSizing: "border-box",
  fontSize: 13,
};

export const dateInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "#111416",
  color: "#F2F4F5",
  border: "1px solid #24282D",
  borderRadius: 6,
  boxSizing: "border-box",
  fontSize: 13,
};

/* ======================================================
   BUTTONS
====================================================== */

export const actionButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#00E5FF",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};

export const smallButton: React.CSSProperties = {
  padding: "7px 12px",
  background: "#171A1D",
  color: "#F2F4F5",
  border: "1px solid #24282D",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500,
};

export const dangerButton: React.CSSProperties = {
  padding: "8px 14px",
  background: "rgba(239, 68, 68, 0.12)",
  color: "#F87171",
  border: "1px solid rgba(239, 68, 68, 0.3)",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

/* ======================================================
   TOOLBARS
====================================================== */

export const toolbarStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginBottom: 14,
};

export const actionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};

/* ======================================================
   VALUE LIST
====================================================== */

export const valueContainerStyle: React.CSSProperties = {
  maxHeight: 320,
  overflowY: "auto",
  border: "1px solid #24282D",
  borderRadius: 6,
  background: "#111416",
};

export const valueRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "9px 12px",
  borderBottom: "1px solid #24282D",
  cursor: "pointer",
  fontSize: 13,
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
  color: "#A5ADB5",
  fontSize: 12,
};

export const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#F2F4F5",
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
  padding: "8px 10px",
  background: "#171A1D",
  border: "1px solid #24282D",
  borderRadius: 6,
  color: "#F2F4F5",
  cursor: "pointer",
  fontSize: 12,
  textAlign: "center",
  transition: "all 0.15s ease",
};