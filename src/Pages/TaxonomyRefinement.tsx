import React, { useState, useEffect, useCallback, useRef } from "react";

const API = "http://localhost:5000";

/* ======================================================
   TYPES
====================================================== */

interface DatasetMeta {
  id: number;
  dataset_name: string;
  data_type: string;
  schema_json: SchemaColumn[];
}

interface SchemaColumn {
  name: string;
  type: string;
  ontologyMapping: string;
  isAppAttribute?: boolean;
}

interface TaxonomyLayer {
  name: string;
  description: string;
}

interface TaxonomySource {
  datasetId: number;
  datasetName: string;
  fieldName: string;
  layerIndex: number;
}

interface Taxonomy {
  id: number;
  name: string;
  description: string | null;
  status: "draft" | "complete";
  version: number;
  layers: TaxonomyLayer[];
  sources: TaxonomySource[];
  created_at: string;
  updated_at: string;
}

interface TaxonomyMapping {
  id: number;
  layer_index: number;
  source_dataset_id: number;
  source_field: string;
  raw_value: string;
  refined_value: string | null;
  review_status: "unreviewed" | "reviewed" | "unmapped";
  occurrence_count: number;
}

type View = "list" | "create" | "edit" | "workspace";

/* ======================================================
   HELPERS
====================================================== */

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    draft: {
      bg: "rgba(245,158,11,0.12)",
      color: "#F59E0B",
      border: "rgba(245,158,11,0.3)",
    },
    complete: {
      bg: "rgba(16,185,129,0.12)",
      color: "#10B981",
      border: "rgba(16,185,129,0.3)",
    },
    unreviewed: {
      bg: "rgba(245,158,11,0.12)",
      color: "#F59E0B",
      border: "rgba(245,158,11,0.3)",
    },
    reviewed: {
      bg: "rgba(16,185,129,0.12)",
      color: "#10B981",
      border: "rgba(16,185,129,0.3)",
    },
    unmapped: {
      bg: "rgba(239,68,68,0.12)",
      color: "#F87171",
      border: "rgba(239,68,68,0.3)",
    },
  };

  const c = colors[status] || colors.draft;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
      }}
    >
      {status}
    </span>
  );
}

/* ======================================================
   TAXONOMY LIST
====================================================== */

function TaxonomyList({
  taxonomies,
  loading,
  onNew,
  onOpen,
  onDelete,
  onRefresh,
}: {
  taxonomies: Taxonomy[];
  loading: boolean;
  onNew: () => void;
  onOpen: (t: Taxonomy) => void;
  onDelete: (t: Taxonomy) => void;
  onRefresh: () => void;
}) {
  return (
    <div style={{ padding: "28px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 className="page-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Taxonomy Refinement
          </h1>
          <p className="page-subtitle" style={{ marginTop: 4 }}>
            Define reusable entity taxonomies from custom dataset attributes
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-secondary" onClick={onRefresh}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
          <button className="btn-primary" onClick={onNew} id="taxonomy-new-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Taxonomy
          </button>
        </div>
      </div>

      {/* Empty / Loading */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
          Loading taxonomies...
        </div>
      ) : taxonomies.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            border: "1px dashed var(--border-medium)",
            borderRadius: "var(--radius-lg)",
            color: "var(--text-muted)",
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: 16 }}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <p style={{ marginBottom: 16, fontSize: 15 }}>No taxonomies yet</p>
          <button className="btn-primary" onClick={onNew}>Create your first taxonomy</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {taxonomies.map((tax) => (
            <div
              key={tax.id}
              className="panel-card"
              style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                    {tax.name}
                  </span>
                  <StatusBadge status={tax.status} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>v{tax.version}</span>
                </div>
                {tax.description && (
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{tax.description}</p>
                )}
                <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
                  <span>{tax.layers.length} layer{tax.layers.length !== 1 ? "s" : ""}</span>
                  <span>{tax.sources.length} source{tax.sources.length !== 1 ? "s" : ""}</span>
                  <span>Updated {new Date(tax.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button className="btn-secondary" onClick={() => onOpen(tax)} style={{ fontSize: 12, padding: "7px 14px" }}>
                  Open
                </button>
                <button
                  className="btn-danger"
                  onClick={() => onDelete(tax)}
                  style={{ fontSize: 12, padding: "7px 10px" }}
                  title="Delete taxonomy"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ======================================================
   CREATE / EDIT TAXONOMY
====================================================== */

function TaxonomyEditor({
  taxonomy,
  datasets,
  onSave,
  onCancel,
}: {
  taxonomy: Taxonomy | null;
  datasets: DatasetMeta[];
  onSave: (saved: Taxonomy) => void;
  onCancel: () => void;
}) {
  const isEditing = taxonomy !== null;

  const [name, setName] = useState(taxonomy?.name || "");
  const [description, setDescription] = useState(taxonomy?.description || "");
  const [layers, setLayers] = useState<TaxonomyLayer[]>(
    taxonomy?.layers?.length ? taxonomy.layers : [{ name: "", description: "" }]
  );
  const [sources, setSources] = useState<TaxonomySource[]>(taxonomy?.sources || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Source form state */
  const [srcDatasetId, setSrcDatasetId] = useState<number | null>(null);
  const [srcField, setSrcField] = useState("");
  const [srcLayerIndex, setSrcLayerIndex] = useState(0);

  const taggedDatasets = datasets.filter((dataset) => String(dataset.data_type || "").toLowerCase() === "tagged");

  const selectedDataset = taggedDatasets.find((d) => d.id === srcDatasetId);
  const availableFields = (selectedDataset?.schema_json || []).filter(
    (col) => !col.isAppAttribute && col.ontologyMapping !== "_id"
  );

  function addLayer() {
    setLayers((prev) => [...prev, { name: "", description: "" }]);
  }

  function removeLayer(index: number) {
    setLayers((prev) => prev.filter((_, i) => i !== index));
    /* Remove sources that reference this layer index */
    setSources((prev) =>
      prev
        .filter((s) => s.layerIndex !== index)
        .map((s) => ({
          ...s,
          layerIndex: s.layerIndex > index ? s.layerIndex - 1 : s.layerIndex,
        }))
    );
  }

  function updateLayer(index: number, field: keyof TaxonomyLayer, value: string) {
    setLayers((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    );
  }

  function moveLayer(index: number, dir: -1 | 1) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= layers.length) return;
    const newLayers = [...layers];
    [newLayers[index], newLayers[newIndex]] = [newLayers[newIndex], newLayers[index]];
    setLayers(newLayers);
    /* Remap sources */
    setSources((prev) =>
      prev.map((s) => {
        if (s.layerIndex === index) return { ...s, layerIndex: newIndex };
        if (s.layerIndex === newIndex) return { ...s, layerIndex: index };
        return s;
      })
    );
  }

  function addSource() {
    if (srcDatasetId === null || !srcField) return;
    const ds = taggedDatasets.find((d) => d.id === srcDatasetId);
    if (!ds) return;

    /* Check duplicate */
    const exists = sources.some(
      (s) => s.datasetId === srcDatasetId && s.fieldName === srcField && s.layerIndex === srcLayerIndex
    );
    if (exists) {
      setError("This source (dataset + field + layer) is already added");
      return;
    }

    setSources((prev) => [
      ...prev,
      { datasetId: srcDatasetId, datasetName: ds.dataset_name, fieldName: srcField, layerIndex: srcLayerIndex },
    ]);
    setSrcField("");
    setError(null);
  }

  function removeSource(index: number) {
    setSources((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave(saveAs: "draft" | "complete" = "draft") {
    if (!name.trim()) {
      setError("Taxonomy name is required");
      return;
    }
    if (layers.some((l) => !l.name.trim())) {
      setError("All layers must have a name");
      return;
    }
    if (sources.length === 0) {
      setError("Add at least one source dataset and field before saving the taxonomy.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        layers,
        sources,
        status: saveAs,
      };

      let res: Response;
      if (isEditing && taxonomy) {
        res = await fetch(`${API}/taxonomies/${taxonomy.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${API}/taxonomies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to save");
      onSave(data.taxonomy);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button className="btn-ghost" onClick={onCancel} style={{ padding: "6px 8px" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 className="page-title" style={{ fontSize: 18 }}>
          {isEditing ? `Edit: ${taxonomy!.name}` : "New Taxonomy"}
        </h1>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#F87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Section: Identity */}
      <div className="panel-card" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <div className="panel-title">Taxonomy Identity</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
              Name *
            </label>
            <input
              id="taxonomy-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Failure Mode Taxonomy"
              style={{ width: "100%", fontSize: 13 }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              style={{ width: "100%", fontSize: 13, resize: "vertical" }}
            />
          </div>
        </div>
      </div>

      {/* Section: Granularity Layers */}
      <div className="panel-card" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <div className="panel-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Granularity Layers
          </div>
          <button className="btn-secondary" onClick={addLayer} style={{ fontSize: 12, padding: "6px 12px" }}>
            + Add Layer
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {layers.map((layer, i) => (
            <div
              key={i}
              style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", background: "var(--bg-app)", borderRadius: 6, border: "1px solid var(--border-subtle)" }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-muted)", minWidth: 28, paddingTop: 9 }}>
                L{i + 1}
              </div>
              <div style={{ flex: 1, display: "flex", gap: 10 }}>
                <input
                  type="text"
                  value={layer.name}
                  onChange={(e) => updateLayer(i, "name", e.target.value)}
                  placeholder={`Layer ${i + 1} name (e.g. Failure Mode)`}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <input
                  type="text"
                  value={layer.description}
                  onChange={(e) => updateLayer(i, "description", e.target.value)}
                  placeholder="Description (optional)"
                  style={{ flex: 1, fontSize: 13 }}
                />
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button className="btn-ghost" style={{ padding: "4px 6px" }} onClick={() => moveLayer(i, -1)} disabled={i === 0} title="Move up">
                  ↑
                </button>
                <button className="btn-ghost" style={{ padding: "4px 6px" }} onClick={() => moveLayer(i, 1)} disabled={i === layers.length - 1} title="Move down">
                  ↓
                </button>
                {layers.length > 1 && (
                  <button className="btn-ghost" style={{ padding: "4px 6px", color: "#F87171" }} onClick={() => removeLayer(i)} title="Remove layer">
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Sources */}
      <div className="panel-card" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <div className="panel-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            Source Datasets &amp; Fields
          </div>
        </div>

        {/* Add source form */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 160px" }}>
            <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Dataset</label>
            <select
              value={srcDatasetId ?? ""}
              onChange={(e) => { setSrcDatasetId(e.target.value ? Number(e.target.value) : null); setSrcField(""); }}
              style={{ width: "100%", fontSize: 13 }}
            >
              <option value="">Select dataset…</option>
              {taggedDatasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.dataset_name} (Tagged)
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Field</label>
            <select
              value={srcField}
              onChange={(e) => setSrcField(e.target.value)}
              style={{ width: "100%", fontSize: 13 }}
              disabled={!srcDatasetId}
            >
              <option value="">Select field…</option>
              {availableFields.map((f) => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: "0 0 140px" }}>
            <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Maps to Layer</label>
            <select
              value={srcLayerIndex}
              onChange={(e) => setSrcLayerIndex(Number(e.target.value))}
              style={{ width: "100%", fontSize: 13 }}
            >
              {layers.map((l, i) => (
                <option key={i} value={i}>
                  L{i + 1}: {l.name || `(unnamed)`}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-secondary" onClick={addSource} disabled={srcDatasetId === null || !srcField} style={{ fontSize: 12, padding: "8px 14px" }}>
            + Add Source
          </button>
        </div>

        {sources.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>
            Add at least one Tagged dataset field before saving this taxonomy.
          </div>
        ) : (
          <div className="table-container">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Dataset</th>
                  <th>Field</th>
                  <th>Layer</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {sources.map((src, i) => (
                  <tr key={i}>
                    <td>{src.datasetName}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{src.fieldName}</td>
                    <td>
                      <span style={{ fontSize: 12, color: "var(--accent-cyan)" }}>
                        L{src.layerIndex + 1}: {layers[src.layerIndex]?.name || "(unnamed)"}
                      </span>
                    </td>
                    <td>
                      <button className="btn-ghost" style={{ color: "#F87171", padding: "4px 6px", fontSize: 12 }} onClick={() => removeSource(i)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn-secondary" onClick={() => handleSave("draft")} disabled={saving || sources.length === 0}>
          {saving ? "Saving…" : "Save as Draft"}
        </button>
        {isEditing && (
          <button className="btn-primary" onClick={() => handleSave("complete")} disabled={saving || sources.length === 0}>
            {saving ? "Saving…" : "Save & Continue to Workspace →"}
          </button>
        )}
        {!isEditing && (
          <button className="btn-primary" onClick={() => handleSave("draft")} disabled={saving || sources.length === 0}>
            {saving ? "Creating…" : "Create Taxonomy"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ======================================================
   REFINEMENT WORKSPACE
====================================================== */

function RefinementWorkspace({
  taxonomy,
  onBack,
  onUpdated,
}: {
  taxonomy: Taxonomy;
  onBack: () => void;
  onUpdated: (t: Taxonomy) => void;
}) {
  const [mappings, setMappings] = useState<TaxonomyMapping[]>([]);
  const [total, setTotal] = useState(0);
  const [mappingStats, setMappingStats] = useState({ total: 0, reviewed: 0, unreviewed: 0, unmapped: 0 });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [layerFilter, setLayerFilter] = useState<number | "">("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editRefined, setEditRefined] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkRefined, setBulkRefined] = useState("");
  const [savingMappings, setSavingMappings] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [extractResult, setExtractResult] = useState<any>(null);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (layerFilter !== "") params.set("layerIndex", String(layerFilter));

      const res = await fetch(`${API}/taxonomies/${taxonomy.id}/mappings?${params}`);
      const data = await res.json();
      if (data.success) {
        setMappings(data.mappings);
        setTotal(data.total);
        setMappingStats(data.stats || { total: data.total || 0, reviewed: 0, unreviewed: 0, unmapped: 0 });
      }
    } catch {
      setError("Failed to load mappings");
    } finally {
      setLoading(false);
    }
  }, [taxonomy.id, page, pageSize, search, statusFilter, layerFilter]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  /* Debounce search */
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchChange(val: string) {
    setSearch(val);
    setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadMappings(), 300);
  }

  async function extract() {
    setExtracting(true);
    setError(null);
    setExtractResult(null);
    try {
      const res = await fetch(`${API}/taxonomies/${taxonomy.id}/extract`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Extraction failed");
      setExtractResult(data);
      setPage(1);
      await loadMappings();
      setSuccessMsg(`Extracted ${data.newEntities} new entities (${data.totalMappings} total)`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExtracting(false);
    }
  }

  function startEdit(m: TaxonomyMapping) {
    setEditId(m.id);
    setEditRefined(m.refined_value ?? m.raw_value);
  }

  async function saveMapping(m: TaxonomyMapping, refined: string, status: TaxonomyMapping["review_status"]) {
    setSavingMappings(true);
    try {
      const res = await fetch(`${API}/taxonomies/${taxonomy.id}/mappings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappings: [{ id: m.id, refinedValue: refined, reviewStatus: status }],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      setMappings((prev) =>
        prev.map((item) =>
          item.id === m.id ? { ...item, refined_value: refined, review_status: status } : item
        )
      );
      setEditId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingMappings(false);
    }
  }

  async function applyBulk() {
    if (selected.size === 0 || !bulkRefined.trim()) return;
    setSavingMappings(true);
    try {
      const updates = Array.from(selected).map((id) => ({
        id,
        refinedValue: bulkRefined.trim(),
        reviewStatus: "reviewed" as const,
      }));
      const res = await fetch(`${API}/taxonomies/${taxonomy.id}/mappings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: updates }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      setMappings((prev) =>
        prev.map((m) =>
          selected.has(m.id)
            ? { ...m, refined_value: bulkRefined.trim(), review_status: "reviewed" }
            : m
        )
      );
      setSelected(new Set());
      setBulkRefined("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingMappings(false);
    }
  }

  async function markAllReviewed() {
    if (mappingStats.unreviewed === 0) return;
    setSavingMappings(true);
    setError(null);
    try {
      const res = await fetch(`${API}/taxonomies/${taxonomy.id}/mappings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllReviewed: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to mark mappings reviewed");
      await loadMappings();
      setSuccessMsg(`${data.updatedCount} mapping${data.updatedCount === 1 ? "" : "s"} marked as reviewed`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingMappings(false);
    }
  }

  async function completeTaxonomy() {
    setCompleting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/taxonomies/${taxonomy.id}/complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || (data.errors || []).join(". "));

      /* Reload taxonomy */
      const taxRes = await fetch(`${API}/taxonomies/${taxonomy.id}`);
      const taxData = await taxRes.json();
      if (taxData.success) onUpdated(taxData.taxonomy);

      setSuccessMsg("Taxonomy marked as complete");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCompleting(false);
    }
  }

  const reviewed = Number(mappingStats.reviewed) || 0;
  const pendingReview = Number(mappingStats.unreviewed) || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allPageSelected = mappings.length > 0 && mappings.every((m) => selected.has(m.id));

  function toggleAll() {
    if (allPageSelected) {
      setSelected((prev) => {
        const s = new Set(prev);
        mappings.forEach((m) => s.delete(m.id));
        return s;
      });
    } else {
      setSelected((prev) => {
        const s = new Set(prev);
        mappings.forEach((m) => s.add(m.id));
        return s;
      });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Top bar */}
      <div className="page-header-bar" style={{ flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-ghost" onClick={onBack} style={{ padding: "6px 8px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 className="page-title" style={{ fontSize: 16 }}>
              {taxonomy.name}
            </h1>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {taxonomy.layers.length} layer{taxonomy.layers.length !== 1 ? "s" : ""} · {taxonomy.sources.length} source{taxonomy.sources.length !== 1 ? "s" : ""}
            </div>
          </div>
          <StatusBadge status={taxonomy.status} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn-secondary"
            onClick={extract}
            disabled={extracting || taxonomy.sources.length === 0}
            title={taxonomy.sources.length === 0 ? "Add a source dataset and field to this taxonomy before extracting entities." : undefined}
            id="extract-entities-btn"
          >
            {extracting ? "Extracting…" : "Extract Entities"}
          </button>
          {taxonomy.status === "draft" && (
            <button
              className="btn-primary"
              onClick={completeTaxonomy}
              disabled={completing || total === 0}
            >
              {completing ? "Completing…" : "Mark Complete"}
            </button>
          )}
        </div>
      </div>

      {taxonomy.sources.length === 0 && (
        <div style={{ padding: "0 32px", marginTop: 10, color: "var(--text-muted)", fontSize: 12 }}>
          Entity extraction is disabled because this taxonomy has no source configured. Edit the taxonomy, add a dataset and field under “Source Datasets &amp; Fields,” then save it before extracting.
        </div>
      )}

      {/* Messages */}
      {(error || successMsg || extractResult) && (
        <div style={{ padding: "0 32px", marginTop: 14 }}>
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#F87171", fontSize: 13, marginBottom: 8 }}>
              {error}
              <button onClick={() => setError(null)} style={{ float: "right", background: "none", border: "none", color: "#F87171", cursor: "pointer" }}>✕</button>
            </div>
          )}
          {successMsg && (
            <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981", fontSize: 13, marginBottom: 8 }}>
              {successMsg}
            </div>
          )}
        </div>
      )}

      {/* Stats + Filters */}
      <div style={{ padding: "14px 32px", flexShrink: 0, borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        {/* Stats */}
        <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)" }}>Total: <strong style={{ color: "var(--text-primary)" }}>{mappingStats.total || total}</strong></span>
          <span style={{ color: "var(--text-muted)" }}>Reviewed: <strong style={{ color: "#10B981" }}>{reviewed}</strong></span>
          <span style={{ color: "var(--text-muted)" }}>Pending: <strong style={{ color: "#F59E0B" }}>{pendingReview}</strong></span>
          <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={markAllReviewed} disabled={savingMappings || pendingReview === 0}>
            {savingMappings ? "Saving…" : "Mark All as Reviewed"}
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginLeft: "auto", flexWrap: "wrap" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search raw / refined…"
            style={{ fontSize: 12, padding: "6px 10px", width: 200 }}
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ fontSize: 12, padding: "6px 10px" }}
          >
            <option value="">All statuses</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="reviewed">Reviewed</option>
            <option value="unmapped">Unmapped</option>
          </select>
          <select
            value={layerFilter}
            onChange={(e) => { setLayerFilter(e.target.value === "" ? "" : Number(e.target.value)); setPage(1); }}
            style={{ fontSize: 12, padding: "6px 10px" }}
          >
            <option value="">All layers</option>
            {taxonomy.layers.map((l, i) => (
              <option key={i} value={i}>L{i + 1}: {l.name || "(unnamed)"}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{ padding: "10px 32px", background: "var(--accent-dim)", borderBottom: "1px solid var(--border-cyan)", display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: "var(--accent-cyan)", fontWeight: 600 }}>
            {selected.size} selected
          </span>
          <input
            type="text"
            value={bulkRefined}
            onChange={(e) => setBulkRefined(e.target.value)}
            placeholder="Bulk refined value…"
            style={{ fontSize: 12, padding: "6px 10px", width: 200 }}
          />
          <button className="btn-primary" style={{ fontSize: 12, padding: "7px 14px" }} onClick={applyBulk} disabled={savingMappings || !bulkRefined.trim()}>
            Apply to Selected
          </button>
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 32px 24px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>Loading…</div>
        ) : mappings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            {total === 0
              ? "No entities extracted yet. Click \"Extract Entities\" to begin."
              : "No mappings match your filters."}
          </div>
        ) : (
          <>
            <div className="table-container" style={{ marginTop: 16 }}>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input type="checkbox" checked={allPageSelected} onChange={toggleAll} />
                    </th>
                    <th>Raw Entity</th>
                    <th>Source Dataset</th>
                    <th>Source Field</th>
                    <th>Layer</th>
                    <th>Refined Value</th>
                    <th>Status</th>
                    <th>Count</th>
                    <th style={{ width: 120 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m.id} className={selected.has(m.id) ? "selected" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(m.id)}
                          onChange={() => {
                            setSelected((prev) => {
                              const s = new Set(prev);
                              s.has(m.id) ? s.delete(m.id) : s.add(m.id);
                              return s;
                            });
                          }}
                        />
                      </td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12, maxWidth: 200 }}>
                        <span title={m.raw_value}>{m.raw_value}</span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {taxonomy.sources.find((s) => s.datasetId === m.source_dataset_id)?.datasetName || `DS-${m.source_dataset_id}`}
                      </td>
                      <td style={{ fontSize: 12, fontFamily: "var(--mono)" }}>{m.source_field}</td>
                      <td style={{ fontSize: 12 }}>
                        <span style={{ color: "var(--accent-cyan)" }}>L{m.layer_index + 1}</span>
                        {taxonomy.layers[m.layer_index]?.name && (
                          <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>
                            {taxonomy.layers[m.layer_index].name}
                          </span>
                        )}
                      </td>
                      <td>
                        {editId === m.id ? (
                          <input
                            type="text"
                            value={editRefined}
                            autoFocus
                            onChange={(e) => setEditRefined(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveMapping(m, editRefined, "reviewed");
                              if (e.key === "Escape") setEditId(null);
                            }}
                            style={{ fontSize: 12, padding: "4px 8px", width: "100%" }}
                          />
                        ) : (
                          <span
                            style={{ fontSize: 12, cursor: "pointer", color: m.refined_value ? "var(--text-primary)" : "var(--text-muted)" }}
                            onClick={() => startEdit(m)}
                            title="Click to edit"
                          >
                            {m.refined_value || m.raw_value || "—"}
                          </span>
                        )}
                      </td>
                      <td><StatusBadge status={m.review_status} /></td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>{m.occurrence_count}</td>
                      <td>
                        {editId === m.id ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              className="btn-primary"
                              style={{ fontSize: 11, padding: "4px 8px" }}
                              onClick={() => saveMapping(m, editRefined, "reviewed")}
                              disabled={savingMappings}
                            >
                              Save
                            </button>
                            <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 6px" }} onClick={() => setEditId(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => startEdit(m)}>
                              Edit
                            </button>
                            {m.review_status !== "reviewed" && (
                              <button
                                className="btn-ghost"
                                style={{ fontSize: 11, padding: "4px 8px", color: "#10B981" }}
                                onClick={() => saveMapping(m, m.refined_value ?? m.raw_value, "reviewed")}
                                disabled={savingMappings}
                              >
                                ✓
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16, alignItems: "center" }}>
                <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  ← Prev
                </button>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Page {page} / {totalPages}
                </span>
                <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ======================================================
   MAIN PAGE
====================================================== */

interface Props {
  navigate: (page: any) => void;
}

export default function TaxonomyRefinement({ navigate: _navigate }: Props) {
  const [view, setView] = useState<View>("list");
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([]);
  const [loading, setLoading] = useState(true);
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [selectedTaxonomy, setSelectedTaxonomy] = useState<Taxonomy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Taxonomy | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadTaxonomies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/taxonomies`);
      const data = await res.json();
      if (data.success) setTaxonomies(data.taxonomies);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDatasets = useCallback(async () => {
    try {
      const res = await fetch(`${API}/datasets`);
      const data = await res.json();
      if (Array.isArray(data)) setDatasets(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadTaxonomies();
    loadDatasets();
  }, [loadTaxonomies, loadDatasets]);

  async function handleDelete(tax: Taxonomy) {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${API}/taxonomies/${tax.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      setTaxonomies((prev) => prev.filter((t) => t.id !== tax.id));
      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  function openWorkspace(tax: Taxonomy) {
    setSelectedTaxonomy(tax);
    setView("workspace");
  }

  /* Render */
  if (view === "create") {
    return (
      <div className="page-container" style={{ overflowY: "auto" }}>
        <TaxonomyEditor
          taxonomy={null}
          datasets={datasets}
          onSave={(saved) => {
            setTaxonomies((prev) => [saved, ...prev]);
            setSelectedTaxonomy(saved);
            setView("workspace");
          }}
          onCancel={() => setView("list")}
        />
      </div>
    );
  }

  if (view === "edit" && selectedTaxonomy) {
    return (
      <div className="page-container" style={{ overflowY: "auto" }}>
        <TaxonomyEditor
          taxonomy={selectedTaxonomy}
          datasets={datasets}
          onSave={(saved) => {
            setTaxonomies((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
            setSelectedTaxonomy(saved);
            setView("workspace");
          }}
          onCancel={() => setView("workspace")}
        />
      </div>
    );
  }

  if (view === "workspace" && selectedTaxonomy) {
    return (
      <div className="page-container">
        <RefinementWorkspace
          taxonomy={selectedTaxonomy}
          onBack={() => {
            setView("list");
            setSelectedTaxonomy(null);
          }}
          onUpdated={(updated) => {
            setSelectedTaxonomy(updated);
            setTaxonomies((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          }}
        />
      </div>
    );
  }

  return (
    <div className="page-container" style={{ overflowY: "auto" }}>
      <TaxonomyList
        taxonomies={taxonomies}
        loading={loading}
        onNew={() => setView("create")}
        onOpen={openWorkspace}
        onDelete={(t) => setDeleteTarget(t)}
        onRefresh={loadTaxonomies}
      />

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--bg-modal)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              padding: 28,
              width: 420,
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
              Delete Taxonomy
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              Are you sure you want to delete <strong style={{ color: "var(--text-primary)" }}>{deleteTarget.name}</strong>? This will also delete all mappings and cannot be undone.
            </p>
            {deleteError && (
              <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.12)", color: "#F87171", fontSize: 13, marginBottom: 16 }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => { setDeleteTarget(null); setDeleteError(null); }} disabled={deleteLoading}>
                Cancel
              </button>
              <button className="btn-danger" onClick={() => handleDelete(deleteTarget)} disabled={deleteLoading}>
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
