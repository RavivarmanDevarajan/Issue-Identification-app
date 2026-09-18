import React, { useMemo, useState } from "react";
import type { FieldFilter, FilterType, SchemaResponse } from "./filterTypes";

export interface FieldDisplaySetting {
  visible: boolean;
  label: string;
  showInDateBy?: boolean;
  showInColorBy?: boolean;
  showInData?: boolean;
}

interface Props {
  schema: SchemaResponse | null;
  loadingSchema: boolean;
  search: string;
  setSearch: (value: string) => void;
  filters: FieldFilter[];
  onFilterChange: (filters: FieldFilter[]) => void;
  fieldSettings: Record<string, FieldDisplaySetting>;
  setFieldSettings: React.Dispatch<React.SetStateAction<Record<string, FieldDisplaySetting>>>;
  onSaveSettings: () => Promise<void>;
  savingSettings: boolean;
  settingsMessage: string;
}

function getFilterType(columnType: string): FilterType {
  const type = String(columnType || "").toLowerCase();
  if (/number|integer|float|double|decimal|numeric/.test(type)) return "numeric";
  if (/date|datetime|time|timestamp/.test(type)) return "date";
  return "categorical";
}

export default function InvestigationFieldsSidebar({ schema, loadingSchema, search, setSearch, filters, onFilterChange, fieldSettings, setFieldSettings, onSaveSettings, savingSettings, settingsMessage }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [mappingOpen, setMappingOpen] = useState(false);
  const columns = schema?.columns || [];
  const getSetting = (name: string): FieldDisplaySetting => fieldSettings[name] || { visible: true, label: "", showInDateBy: true, showInColorBy: true, showInData: true };
  const displayName = (name: string) => getSetting(name).label.trim() || name;

  const visibleColumns = useMemo(() => {
    const term = search.trim().toLowerCase();
    return columns.filter((column) => {
      const setting = fieldSettings[column.name] || { visible: true, label: "" };
      return setting.visible && (!term || column.name.toLowerCase().includes(term) || setting.label.toLowerCase().includes(term));
    });
  }, [columns, fieldSettings, search]);

  const updateSetting = (name: string, change: Partial<FieldDisplaySetting>) => {
    setFieldSettings((current) => ({ ...current, [name]: { ...(current[name] || { visible: true, label: "", showInDateBy: true, showInColorBy: true, showInData: true }), ...change } }));
  };

  const addField = (column: (typeof columns)[number]) => {
    if (filters.some((filter) => filter.field === column.name)) return;
    onFilterChange([...filters, { field: column.name, filterType: getFilterType(column.type), values: [] }]);
  };

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, column: (typeof columns)[number]) => {
    event.dataTransfer.setData("application/json", JSON.stringify({ field: column.name, filterType: getFilterType(column.type), values: [] }));
    event.dataTransfer.effectAllowed = "copy";
  };

  return <div style={{ width: 280, minWidth: 280, background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
    <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)" }}>
      <button onClick={() => setExpanded((value) => !value)} style={{ background: "none", border: "none", color: "var(--text-primary)", fontWeight: 600, fontSize: 14, cursor: "pointer", padding: 0 }}>{expanded ? "▼" : "►"} Fields</button>
      <button onClick={() => setMappingOpen(true)} title="Configure visible fields and labels" className="btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}>Configure</button>
    </div>

    {expanded && <div style={{ padding: 12 }}>
      <input placeholder="Search fields..." value={search} onChange={(event) => setSearch(event.target.value)} style={{ width: "100%", padding: "8px 10px", background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", borderRadius: 6, marginBottom: 10, outline: "none", boxSizing: "border-box", fontSize: 13 }} />
      {loadingSchema ? <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 20, fontSize: 13 }}>Loading fields...</div> : visibleColumns.length === 0 ? <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 20, fontSize: 13 }}>No matching fields</div> : visibleColumns.map((column) => {
        const selected = filters.some((filter) => filter.field === column.name);
        return <button key={column.name} draggable={!selected} onDragStart={(event) => handleDragStart(event, column)} onClick={() => addField(column)} title={`${column.name}${selected ? " — added to Set A" : " — click or drag to add"}`} style={{ width: "100%", display: "block", textAlign: "left", padding: "8px 10px", marginBottom: 3, background: selected ? "rgba(0, 229, 255, 0.12)" : "transparent", border: "none", borderLeft: selected ? "3px solid #00E5FF" : "3px solid transparent", borderRadius: 4, color: selected ? "#00E5FF" : "var(--text-secondary)", fontWeight: selected ? 600 : 400, fontSize: 13, cursor: selected ? "default" : "grab", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName(column.name)}</button>;
      })}
    </div>}

    {mappingOpen && <div role="dialog" aria-modal="true" aria-label="Configure dataset fields" style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "min(760px, 100%)", maxHeight: "80vh", overflow: "auto", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 22, boxShadow: "0 20px 45px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
          <div><h2 style={{ margin: 0, fontSize: 18, color: "var(--text-primary)" }}>Configure Dataset Fields</h2><p style={{ margin: "6px 0 14px", color: "var(--text-secondary)", fontSize: 13 }}>Choose fields for the side panel and give them a user-friendly label. Original attributes remain unchanged.</p></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onSaveSettings} disabled={savingSettings} className="btn-primary" style={{ height: 34, padding: "0 14px", fontSize: 13 }}>{savingSettings ? "Saving..." : "Save"}</button>
            <button onClick={() => setMappingOpen(false)} className="btn-secondary" style={{ height: 34, padding: "0 14px", fontSize: 13 }}>Close</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "56px minmax(150px, 1fr) minmax(180px, 1fr)", gap: 10, alignItems: "center", color: "var(--text-muted)", fontSize: 12, padding: "0 4px 8px" }}><span>Show</span><span>Client attribute</span><span>Custom label</span></div>
        {columns.map((column) => {
          const setting = getSetting(column.name);
          const filterType = getFilterType(column.type);
          const canUseForDateBy = filterType === "date" && String(column.ontologyMapping || "").toLowerCase() !== "opentimestamp";
          const canUseForColorBy = filterType === "categorical";
          return <div key={column.name} style={{ display: "grid", gridTemplateColumns: "56px minmax(150px, 1fr) minmax(180px, 1fr)", gap: 10, alignItems: "center", padding: "9px 4px", borderTop: "1px solid var(--border-subtle)" }}>
            <input aria-label={`Show ${column.name}`} type="checkbox" checked={setting.visible} onChange={(event) => updateSetting(column.name, { visible: event.target.checked })} style={{ accentColor: "var(--accent-cyan)" }} />
            <div title={column.name} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)", fontSize: 13 }}>{column.name}{column.ontologyMapping && <span style={{ color: "var(--accent-cyan)", fontSize: 11 }}> · {column.ontologyMapping}</span>}</div>
            <input aria-label={`Custom label for ${column.name}`} placeholder="Use client attribute name" value={setting.label} onChange={(event) => updateSetting(column.name, { label: event.target.value })} style={{ width: "100%", boxSizing: "border-box", padding: 8, background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", borderRadius: 6, fontSize: 13 }} />
            <div style={{ gridColumn: "2 / -1", display: "flex", gap: 14, flexWrap: "wrap", color: "var(--text-secondary)", fontSize: 12 }}>
              <span>Show in:</span>
              {canUseForDateBy && <label><input type="checkbox" checked={setting.showInDateBy !== false} onChange={(event) => updateSetting(column.name, { showInDateBy: event.target.checked })} style={{ accentColor: "var(--accent-cyan)" }} /> Date By</label>}
              {canUseForColorBy && <label><input type="checkbox" checked={setting.showInColorBy !== false} onChange={(event) => updateSetting(column.name, { showInColorBy: event.target.checked })} style={{ accentColor: "var(--accent-cyan)" }} /> Color By</label>}
              <label><input type="checkbox" checked={setting.showInData !== false} onChange={(event) => updateSetting(column.name, { showInData: event.target.checked })} style={{ accentColor: "var(--accent-cyan)" }} /> Data tab</label>
            </div>
          </div>;
        })}
        {settingsMessage && <div style={{ color: settingsMessage.startsWith("Could") ? "#EF4444" : "#10B981", marginTop: 14, fontSize: 13 }}>{settingsMessage}</div>}
      </div>
    </div>}
  </div>;
}
