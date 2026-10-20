import React, { useState, useEffect, useCallback } from "react";

const API = "http://localhost:5000";

/* ======================================================
   TYPES
====================================================== */

interface Dataset {
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

interface Taxonomy {
  id: number;
  name: string;
  status: string;
  layers: { name: string; description: string }[];
}

interface TransformFunction {
  id: number;
  name: string;
  description: string | null;
  function_type: "string_mapper" | "column_combiner";
  config: StringMapperConfig | ColumnCombinerConfig;
  output_dataset_id: number | null;
  output_attribute_name: string | null;
  execution_status: "pending" | "executed" | "error";
  last_executed_at: string | null;
  taxonomy_version_at_execution: number | null;
  created_at: string;
  updated_at: string;
}

interface StringMapperConfig {
  inputDatasetId: number | null;
  inputField: string;
  taxonomyId: number | null;
  layerIndex: number;
  unmappedPolicy: "keep_raw" | "blank" | "flag_review";
  nullPolicy: "blank";
}

interface ColumnCombinerConfig {
  inputDatasetId: number | null;
  field1: string;
  field2: string;
  separator: string;
  nullPolicy: "skip" | "blank" | "placeholder";
  placeholder?: string;
  trimWhitespace: boolean;
  mismatchPolicy: "flag_review" | "blank";
}

type View = "list" | "create" | "detail";

/* ======================================================
   HELPERS
====================================================== */

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    pending: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "rgba(245,158,11,0.3)" },
    executed: { bg: "rgba(16,185,129,0.12)", color: "#10B981", border: "rgba(16,185,129,0.3)" },
    error: { bg: "rgba(239,68,68,0.12)", color: "#F87171", border: "rgba(239,68,68,0.3)" },
  };
  const c = colors[status] || colors.pending;
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

function FunctionTypeBadge({ type }: { type: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: "var(--accent-dim)",
        color: "var(--accent-cyan)",
        border: "1px solid var(--border-cyan)",
      }}
    >
      {type === "string_mapper" ? "String Mapper" : "Column Combiner"}
    </span>
  );
}

/* ======================================================
   TRANSFORM LIST
====================================================== */

function TransformList({
  transforms,
  loading,
  onNew,
  onOpen,
  onDelete,
  onRefresh,
}: {
  transforms: TransformFunction[];
  loading: boolean;
  onNew: () => void;
  onOpen: (t: TransformFunction) => void;
  onDelete: (t: TransformFunction) => void;
  onRefresh: () => void;
}) {
  return (
    <div style={{ padding: "28px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 className="page-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
            </svg>
            Transform Functions
          </h1>
          <p className="page-subtitle" style={{ marginTop: 4 }}>
            Generate App Attributes from existing fields using taxonomy mappings or column combination
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-secondary" onClick={onRefresh}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
          <button className="btn-primary" onClick={onNew} id="transform-new-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Transform
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>Loading transforms…</div>
      ) : transforms.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", border: "1px dashed var(--border-medium)", borderRadius: "var(--radius-lg)", color: "var(--text-muted)" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: 16 }}>
            <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
          </svg>
          <p style={{ marginBottom: 16, fontSize: 15 }}>No transform functions yet</p>
          <button className="btn-primary" onClick={onNew}>Create your first transform</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {transforms.map((tf) => (
            <div key={tf.id} className="panel-card" style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>{tf.name}</span>
                  <FunctionTypeBadge type={tf.function_type} />
                  <StatusBadge status={tf.execution_status} />
                </div>
                {tf.description && (
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{tf.description}</p>
                )}
                <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
                  <span>Output: <span style={{ color: "var(--accent-cyan)", fontFamily: "var(--mono)" }}>{tf.output_attribute_name}</span></span>
                  {tf.last_executed_at && (
                    <span>Last run: {new Date(tf.last_executed_at).toLocaleString()}</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button className="btn-secondary" onClick={() => onOpen(tf)} style={{ fontSize: 12, padding: "7px 14px" }}>Open</button>
                <button className="btn-danger" onClick={() => onDelete(tf)} style={{ fontSize: 12, padding: "7px 10px" }} title="Delete">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
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
   CREATE TRANSFORM WIZARD
====================================================== */

function CreateTransform({
  datasets,
  taxonomies,
  onSaved,
  onCancel,
}: {
  datasets: Dataset[];
  taxonomies: Taxonomy[];
  onSaved: (t: TransformFunction) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"type" | "config">("type");
  const [funcType, setFuncType] = useState<"string_mapper" | "column_combiner" | null>(null);

  /* Common */
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [outputDatasetId, setOutputDatasetId] = useState<number | null>(null);
  const [outputAttr, setOutputAttr] = useState("");

  /* String mapper */
  const [smInputDatasetId, setSmInputDatasetId] = useState<number | null>(null);
  const [smInputField, setSmInputField] = useState("");
  const [smTaxonomyId, setSmTaxonomyId] = useState<number | null>(null);
  const [smLayerIndex, setSmLayerIndex] = useState(0);
  const [smUnmappedPolicy, setSmUnmappedPolicy] = useState<"keep_raw" | "blank" | "flag_review">("keep_raw");

  /* Column combiner */
  const [ccInputDatasetId, setCcInputDatasetId] = useState<number | null>(null);
  const [ccField1, setCcField1] = useState("");
  const [ccField2, setCcField2] = useState("");
  const [ccSeparator, setCcSeparator] = useState(" - ");
  const [ccNullPolicy, setCcNullPolicy] = useState<"skip" | "blank" | "placeholder">("skip");
  const [ccPlaceholder, setCcPlaceholder] = useState("");
  const [ccTrimWhitespace, setCcTrimWhitespace] = useState(true);
  const [ccMismatchPolicy, setCcMismatchPolicy] = useState<"flag_review" | "blank">("flag_review");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const smInputDataset = datasets.find((d) => d.id === smInputDatasetId);
  const ccInputDataset = datasets.find((d) => d.id === ccInputDatasetId);

  const smFields = (smInputDataset?.schema_json || []).filter(
    (c) => !c.isAppAttribute && c.ontologyMapping !== "_id"
  );
  const ccFields = (ccInputDataset?.schema_json || []).filter(
    (c) => !c.isAppAttribute && c.ontologyMapping !== "_id"
  );

  const selectedTaxonomy = taxonomies.find((t) => t.id === smTaxonomyId);

  async function handleSave() {
    if (!name.trim()) { setError("Transform name is required"); return; }
    if (!funcType) { setError("Select a function type"); return; }
    if (!outputDatasetId) { setError("Output dataset is required"); return; }
    if (!outputAttr.trim()) { setError("Output attribute name is required"); return; }

    let config: any;
    if (funcType === "string_mapper") {
      if (!smInputDatasetId || !smInputField) { setError("Select input dataset and field"); return; }
      if (!smTaxonomyId) { setError("Select a taxonomy"); return; }
      config = {
        inputDatasetId: smInputDatasetId,
        inputField: smInputField,
        taxonomyId: smTaxonomyId,
        layerIndex: smLayerIndex,
        unmappedPolicy: smUnmappedPolicy,
        nullPolicy: "blank",
      };
    } else {
      if (!ccInputDatasetId || !ccField1 || !ccField2) { setError("Select input dataset and both fields"); return; }
      if (ccField1 === ccField2) { setError("Field 1 and Field 2 must be different"); return; }
      config = {
        inputDatasetId: ccInputDatasetId,
        field1: ccField1,
        field2: ccField2,
        separator: ccSeparator,
        nullPolicy: ccNullPolicy,
        placeholder: ccNullPolicy === "placeholder" ? ccPlaceholder : undefined,
        trimWhitespace: ccTrimWhitespace,
        mismatchPolicy: ccMismatchPolicy,
      };
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/transforms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          functionType: funcType,
          config,
          outputDatasetId,
          outputAttributeName: outputAttr.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      onSaved(data.transform);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 800 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button className="btn-ghost" onClick={onCancel} style={{ padding: "6px 8px" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 className="page-title" style={{ fontSize: 18 }}>New Transform Function</h1>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#F87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      {step === "type" ? (
        <>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
            Select the type of transform function to create:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
            {[
              {
                id: "string_mapper" as const,
                title: "String-to-String Mapper",
                icon: "⇄",
                desc: "Map raw text values to refined standard values using a taxonomy. Ideal for standardising free-text categories.",
              },
              {
                id: "column_combiner" as const,
                title: "Column Combiner",
                icon: "+",
                desc: "Combine two fields into one with a configurable separator. E.g. 'Break' + 'Handle' → 'Break - Handle'.",
              },
            ].map((opt) => (
              <button
                key={opt.id}
                id={`transform-type-${opt.id}`}
                onClick={() => { setFuncType(opt.id); setStep("config"); }}
                style={{
                  padding: "20px",
                  border: `1px solid ${funcType === opt.id ? "var(--accent-cyan)" : "var(--border-medium)"}`,
                  borderRadius: "var(--radius-lg)",
                  background: funcType === opt.id ? "var(--accent-dim)" : "var(--bg-card)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-cyan)"; e.currentTarget.style.background = "var(--accent-dim)"; }}
                onMouseLeave={(e) => {
                  if (funcType !== opt.id) {
                    e.currentTarget.style.borderColor = "var(--border-medium)";
                    e.currentTarget.style.background = "var(--bg-card)";
                  }
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 10 }}>{opt.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{opt.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Identity */}
          <div className="panel-card" style={{ marginBottom: 20 }}>
            <div className="panel-header">
              <div className="panel-title">Transform Identity</div>
              <FunctionTypeBadge type={funcType!} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Name *</label>
                <input id="transform-name-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Failure Mode Mapper" style={{ width: "100%", fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional..." style={{ width: "100%", fontSize: 13 }} />
              </div>
            </div>
          </div>

          {/* Type-specific config */}
          {funcType === "string_mapper" ? (
            <div className="panel-card" style={{ marginBottom: 20 }}>
              <div className="panel-header">
                <div className="panel-title">Mapper Configuration</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Input Dataset *</label>
                    <select value={smInputDatasetId ?? ""} onChange={(e) => { setSmInputDatasetId(e.target.value ? Number(e.target.value) : null); setSmInputField(""); }} style={{ width: "100%", fontSize: 13 }}>
                      <option value="">Select dataset…</option>
                      {datasets.map((d) => <option key={d.id} value={d.id}>{d.dataset_name} ({d.data_type})</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Input Field *</label>
                    <select value={smInputField} onChange={(e) => setSmInputField(e.target.value)} style={{ width: "100%", fontSize: 13 }} disabled={!smInputDatasetId}>
                      <option value="">Select field…</option>
                      {smFields.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Taxonomy *</label>
                    <select value={smTaxonomyId ?? ""} onChange={(e) => { setSmTaxonomyId(e.target.value ? Number(e.target.value) : null); setSmLayerIndex(0); }} style={{ width: "100%", fontSize: 13 }}>
                      <option value="">Select taxonomy…</option>
                      {taxonomies.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.status})</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Taxonomy Layer *</label>
                    <select value={smLayerIndex} onChange={(e) => setSmLayerIndex(Number(e.target.value))} style={{ width: "100%", fontSize: 13 }} disabled={!smTaxonomyId}>
                      <option value="">Select layer…</option>
                      {(selectedTaxonomy?.layers || []).map((l, i) => (
                        <option key={i} value={i}>L{i + 1}: {l.name || "(unnamed)"}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Unmapped Value Policy</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[
                      { val: "keep_raw" as const, label: "Keep Raw Value (default)" },
                      { val: "blank" as const, label: "Return Blank" },
                      { val: "flag_review" as const, label: "Flag for Review" },
                    ].map((opt) => (
                      <label key={opt.val} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", padding: "8px 12px", border: `1px solid ${smUnmappedPolicy === opt.val ? "var(--accent-cyan)" : "var(--border-medium)"}`, borderRadius: 6, background: smUnmappedPolicy === opt.val ? "var(--accent-dim)" : "transparent" }}>
                        <input type="radio" name="unmapped-policy" value={opt.val} checked={smUnmappedPolicy === opt.val} onChange={() => setSmUnmappedPolicy(opt.val)} style={{ accentColor: "var(--accent-cyan)" }} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                    {smUnmappedPolicy === "keep_raw" && "Values without a taxonomy mapping are passed through unchanged."}
                    {smUnmappedPolicy === "blank" && "Values without a taxonomy mapping produce an empty output cell."}
                    {smUnmappedPolicy === "flag_review" && "Values without a mapping are preserved as-is and marked for taxonomy review."}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="panel-card" style={{ marginBottom: 20 }}>
              <div className="panel-header">
                <div className="panel-title">Combiner Configuration</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Input Dataset *</label>
                  <select value={ccInputDatasetId ?? ""} onChange={(e) => { setCcInputDatasetId(e.target.value ? Number(e.target.value) : null); setCcField1(""); setCcField2(""); }} style={{ width: "100%", fontSize: 13 }}>
                    <option value="">Select dataset…</option>
                    {datasets.map((d) => <option key={d.id} value={d.id}>{d.dataset_name} ({d.data_type})</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "flex-end" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>First Field *</label>
                    <select value={ccField1} onChange={(e) => setCcField1(e.target.value)} style={{ width: "100%", fontSize: 13 }} disabled={!ccInputDatasetId}>
                      <option value="">Select field…</option>
                      {ccFields.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                    </select>
                  </div>
                  <div style={{ textAlign: "center", paddingBottom: 8 }}>
                    <input type="text" value={ccSeparator} onChange={(e) => setCcSeparator(e.target.value)} style={{ width: 80, textAlign: "center", fontSize: 13, fontFamily: "var(--mono)" }} title="Separator" />
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Separator</div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Second Field *</label>
                    <select value={ccField2} onChange={(e) => setCcField2(e.target.value)} style={{ width: "100%", fontSize: 13 }} disabled={!ccInputDatasetId}>
                      <option value="">Select field…</option>
                      {ccFields.filter((f) => f.name !== ccField1).map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                    </select>
                  </div>
                </div>
                {/* Preview of separator */}
                {ccField1 && ccField2 && (
                  <div style={{ padding: "10px 14px", borderRadius: 6, background: "var(--bg-app)", border: "1px solid var(--border-subtle)", fontSize: 13, fontFamily: "var(--mono)", color: "var(--accent-cyan)" }}>
                    Example: <strong>{ccField1 || "Field1"}</strong> value + <strong>"{ccSeparator}"</strong> + <strong>{ccField2 || "Field2"}</strong> value
                  </div>
                )}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Missing Value Policy</label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[
                      { val: "skip" as const, label: "Skip (use available only)" },
                      { val: "blank" as const, label: "Return blank" },
                      { val: "placeholder" as const, label: "Use placeholder" },
                    ].map((opt) => (
                      <label key={opt.val} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", padding: "7px 12px", border: `1px solid ${ccNullPolicy === opt.val ? "var(--accent-cyan)" : "var(--border-medium)"}`, borderRadius: 6, background: ccNullPolicy === opt.val ? "var(--accent-dim)" : "transparent" }}>
                        <input type="radio" name="null-policy" value={opt.val} checked={ccNullPolicy === opt.val} onChange={() => setCcNullPolicy(opt.val)} style={{ accentColor: "var(--accent-cyan)" }} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  {ccNullPolicy === "placeholder" && (
                    <div style={{ marginTop: 10 }}>
                      <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Placeholder text</label>
                      <input type="text" value={ccPlaceholder} onChange={(e) => setCcPlaceholder(e.target.value)} placeholder='e.g. "N/A"' style={{ fontSize: 13, width: 200 }} />
                    </div>
                  )}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={ccTrimWhitespace} onChange={(e) => setCcTrimWhitespace(e.target.checked)} style={{ accentColor: "var(--accent-cyan)" }} />
                  Trim whitespace from input values
                </label>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>List-length mismatch policy</label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[{ val: "flag_review" as const, label: "Flag for review (safe default)" }, { val: "blank" as const, label: "Return blank" }].map((opt) => (
                      <label key={opt.val} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", padding: "7px 12px", border: `1px solid ${ccMismatchPolicy === opt.val ? "var(--accent-cyan)" : "var(--border-medium)"}`, borderRadius: 6, background: ccMismatchPolicy === opt.val ? "var(--accent-dim)" : "transparent" }}>
                        <input type="radio" name="mismatch-policy" checked={ccMismatchPolicy === opt.val} onChange={() => setCcMismatchPolicy(opt.val)} style={{ accentColor: "var(--accent-cyan)" }} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>Unequal lists are never paired, truncated, or repeated. Review flagged records and correct the source tags before rerunning.</p>
                </div>
              </div>
            </div>
          )}

          {/* Output */}
          <div className="panel-card" style={{ marginBottom: 24 }}>
            <div className="panel-header">
              <div className="panel-title">Output Configuration</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Target Dataset *</label>
                <select value={outputDatasetId ?? ""} onChange={(e) => setOutputDatasetId(e.target.value ? Number(e.target.value) : null)} style={{ width: "100%", fontSize: 13 }}>
                  <option value="">Select dataset…</option>
                  {datasets.map((d) => <option key={d.id} value={d.id}>{d.dataset_name} ({d.data_type})</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>App Attribute Name *</label>
                <input type="text" value={outputAttr} onChange={(e) => setOutputAttr(e.target.value)} placeholder='e.g. "Failure Mode"' style={{ width: "100%", fontSize: 13 }} />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  This will be a generated field distinguishable from original attributes.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button className="btn-secondary" onClick={() => setStep("type")} disabled={saving}>← Back</button>
            <button className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Creating…" : "Create Transform"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ======================================================
   TRANSFORM DETAIL / EXECUTION
====================================================== */

function TransformDetail({
  transform: initialTransform,
  datasets,
  onBack,
  onUpdated,
}: {
  transform: TransformFunction;
  datasets: Dataset[];
  onBack: () => void;
  onUpdated: (t: TransformFunction) => void;
}) {
  const [transform, setTransform] = useState(initialTransform);
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [unmapped, setUnmapped] = useState<{ value: string; count: number }[]>([]);
  const [unmappedLoading, setUnmappedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showUnmapped, setShowUnmapped] = useState(false);

  const config = transform.config as any;
  const outputDataset = datasets.find((d) => d.id === transform.output_dataset_id);
  const inputDataset = datasets.find((d) => d.id === config.inputDatasetId);

  async function loadPreview() {
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/transforms/${transform.id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleSize: 50 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      setPreview(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function loadUnmapped() {
    setUnmappedLoading(true);
    try {
      const res = await fetch(`${API}/transforms/${transform.id}/unmapped`);
      const data = await res.json();
      if (data.success) setUnmapped(data.unmapped || []);
    } catch {
      /* ignore */
    } finally {
      setUnmappedLoading(false);
    }
  }

  async function execute() {
    if (!window.confirm(`Execute "${transform.name}"? This will write the App Attribute to the target dataset.`)) return;
    setExecuting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/transforms/${transform.id}/execute`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      /* Reload transform */
      const tfRes = await fetch(`${API}/transforms/${transform.id}`);
      const tfData = await tfRes.json();
      if (tfData.success) {
        const updated = { ...tfData.transform, config: tfData.transform.config || JSON.parse(tfData.transform.config_json || "{}") };
        setTransform(updated);
        onUpdated(updated);
      }

      const summary = data.mapped !== undefined
        ? `Executed. ${data.mapped} mapped, ${data.unmapped} unmapped, ${data.blank} blank.`
        : `Executed. ${data.complete} complete, ${data.withMissing} with missing inputs.`;
      setSuccess(summary);
      setTimeout(() => setSuccess(null), 5000);

      /* Reload preview */
      await loadPreview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExecuting(false);
    }
  }

  useEffect(() => {
    loadPreview();
    if (transform.function_type === "string_mapper") {
      loadUnmapped();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isStale = preview?.taxonomyStale;

  return (
    <div style={{ padding: "28px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn-ghost" onClick={onBack} style={{ padding: "6px 8px" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="page-title" style={{ fontSize: 16 }}>{transform.name}</h1>
        </div>
        <FunctionTypeBadge type={transform.function_type} />
        <StatusBadge status={transform.execution_status} />
      </div>

      {/* Stale warning */}
      {isStale && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 6, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#F59E0B", fontSize: 13 }}>
          ⚠️ The taxonomy has changed since this transform was last executed. Rerun to update the output.
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#F87171", fontSize: 13 }}>
          {error} <button onClick={() => setError(null)} style={{ float: "right", background: "none", border: "none", color: "#F87171", cursor: "pointer" }}>✕</button>
        </div>
      )}
      {success && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 6, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981", fontSize: 13 }}>
          ✓ {success}
        </div>
      )}

      {/* Config summary */}
      <div className="panel-card" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <div className="panel-title">Configuration</div>
          <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={execute} disabled={executing}>
            {executing ? "Executing…" : "▶ Execute Transform"}
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, fontSize: 13 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Input Dataset</div>
            <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{inputDataset?.dataset_name || `DS-${config.inputDatasetId}`}</div>
          </div>
          {transform.function_type === "string_mapper" ? (
            <>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Input Field</div>
                <div style={{ color: "var(--accent-cyan)", fontFamily: "var(--mono)", fontSize: 12 }}>{config.inputField}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Unmapped Policy</div>
                <div style={{ color: "var(--text-primary)" }}>{config.unmappedPolicy || "keep_raw"}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Fields</div>
                <div style={{ color: "var(--accent-cyan)", fontFamily: "var(--mono)", fontSize: 12 }}>
                  {config.field1} <span style={{ color: "var(--text-muted)" }}>{config.separator}</span> {config.field2}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Missing Policy</div>
                <div style={{ color: "var(--text-primary)" }}>{config.nullPolicy}</div>
              </div>
            </>
          )}
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Output Dataset</div>
            <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{outputDataset?.dataset_name || `DS-${transform.output_dataset_id}`}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>App Attribute Name</div>
            <div style={{ color: "var(--accent-cyan)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700 }}>{transform.output_attribute_name}</div>
          </div>
          {transform.last_executed_at && (
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Last Executed</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{new Date(transform.last_executed_at).toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>

      {/* Preview summary */}
      {preview && (
        <div className="panel-card" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title">Preview Summary</div>
            <div style={{ display: "flex", gap: 10 }}>
              {transform.function_type === "string_mapper" && unmapped.length > 0 && (
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { setShowUnmapped((v) => !v); if (!showUnmapped) loadUnmapped(); }}>
                  {showUnmapped ? "Hide Unmapped" : `Show Unmapped (${unmapped.length})`}
                </button>
              )}
              <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={loadPreview} disabled={previewLoading}>
                {previewLoading ? "Loading…" : "Refresh Preview"}
              </button>
            </div>
          </div>

          {/* Summary metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 16 }}>
            {transform.function_type === "string_mapper" ? (
              <>
                {[
                  { label: "Total", value: preview.summary?.total, color: "var(--text-primary)" },
                  { label: "Mapped", value: preview.summary?.mapped, color: "#10B981" },
                  { label: "Unmapped", value: preview.summary?.unmapped, color: "#F59E0B" },
                  { label: "Blank", value: preview.summary?.blank, color: "var(--text-muted)" },
                  { label: "Changed", value: preview.summary?.changed, color: "var(--accent-cyan)" },
                ].map((m) => (
                  <div key={m.label} style={{ padding: "12px 14px", background: "var(--bg-app)", borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: m.color, marginTop: 4 }}>{m.value ?? "—"}</div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {[
                  { label: "Total", value: preview.summary?.total, color: "var(--text-primary)" },
                  { label: "Combined", value: preview.summary?.combined, color: "#10B981" },
                  { label: "Complete", value: preview.summary?.complete, color: "#10B981" },
                  { label: "Missing Input", value: preview.summary?.withMissing, color: "#F59E0B" },
                  { label: "List Mismatches", value: preview.summary?.mismatched, color: "#F87171" },
                  { label: "Needs Review", value: preview.summary?.needsReview, color: "#F59E0B" },
                ].map((m) => (
                  <div key={m.label} style={{ padding: "12px 14px", background: "var(--bg-app)", borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: m.color, marginTop: 4 }}>{m.value ?? "—"}</div>
                  </div>
                ))}
              </>
            )}
          </div>

          {transform.function_type === "column_combiner" && preview.summary?.mismatchRecords?.length > 0 && (
            <div style={{ marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 6, background: "rgba(239,68,68,0.08)", color: "#fecaca", fontSize: 12 }}>
              <strong>List-length mismatches:</strong>{" "}
              {preview.summary.mismatchRecords.slice(0, 10).map((item: any) => item.recordId ?? `row ${item.recordIndex + 1}`).join(", ")}
              {preview.summary.mismatchRecords.length > 10 ? " …" : ""}. These records were not combined.
            </div>
          )}

          {/* Unmapped table */}
          {showUnmapped && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Unmapped Values</div>
              {unmappedLoading ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
              ) : unmapped.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No unmapped values.</div>
              ) : (
                <div className="table-container" style={{ maxHeight: 200, overflowY: "auto" }}>
                  <table className="analytics-table">
                    <thead><tr><th>Raw Value</th><th style={{ textAlign: "right" }}>Occurrences</th></tr></thead>
                    <tbody>
                      {unmapped.slice(0, 50).map((u) => (
                        <tr key={u.value}>
                          <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{u.value}</td>
                          <td style={{ textAlign: "right", fontSize: 12 }}>{u.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Sample rows */}
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
            Sample Results (up to 50 rows)
          </div>
          <div className="table-container" style={{ maxHeight: 280, overflowY: "auto" }}>
            <table className="analytics-table">
              <thead>
                <tr>
                  {transform.function_type === "string_mapper" ? (
                    <>
                      <th>Raw Input</th>
                      <th>Refined Output</th>
                      <th>Mapping Found</th>
                      <th>Needs Review</th>
                    </>
                  ) : (
                    <>
                      <th>Field 1</th>
                      <th>Sep</th>
                      <th>Field 2</th>
                      <th>Output</th>
                      <th>Missing</th>
                      <th>Mismatch</th>
                      <th>Review</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {(preview.results || []).slice(0, 50).map((row: any, i: number) => (
                  <tr key={i}>
                    {transform.function_type === "string_mapper" ? (
                      <>
                        <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{row.isBlank ? <em style={{ color: "var(--text-muted)" }}>(blank)</em> : row.rawInput}</td>
                        <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: row.refinedOutput ? "var(--text-primary)" : "var(--text-muted)" }}>{row.refinedOutput ?? <em>(blank)</em>}</td>
                        <td>{row.mappingFound ? <span style={{ color: "#10B981" }}>✓</span> : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                        <td>{row.needsReview ? <span style={{ color: "#F59E0B" }}>⚑</span> : "—"}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{row.field1Value ?? <em style={{ color: "var(--text-muted)" }}>(blank)</em>}</td>
                        <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-muted)" }}>{row.separator}</td>
                        <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{row.field2Value ?? <em style={{ color: "var(--text-muted)" }}>(blank)</em>}</td>
                        <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: row.output ? "var(--text-primary)" : "var(--text-muted)" }}>{row.output ?? <em>(blank)</em>}</td>
                        <td>{row.hasMissing ? <span style={{ color: "#F59E0B" }}>⚠</span> : "—"}</td>
                        <td>{row.listLengthMismatch ? <span style={{ color: "#F87171" }}>⚠</span> : "—"}</td>
                        <td>{row.needsReview ? <span style={{ color: "#F59E0B" }}>⚑</span> : "—"}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================================================
   MAIN PAGE
====================================================== */

interface Props {
  navigate: (page: any) => void;
}

export default function TransformFunctions({ navigate: _navigate }: Props) {
  const [view, setView] = useState<View>("list");
  const [transforms, setTransforms] = useState<TransformFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([]);
  const [selectedTransform, setSelectedTransform] = useState<TransformFunction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransformFunction | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tfRes, dsRes, taxRes] = await Promise.all([
        fetch(`${API}/transforms`),
        fetch(`${API}/datasets`),
        fetch(`${API}/taxonomies`),
      ]);
      const [tfData, dsData, taxData] = await Promise.all([tfRes.json(), dsRes.json(), taxRes.json()]);
      if (tfData.success) setTransforms(tfData.transforms);
      if (Array.isArray(dsData)) setDatasets(dsData.map((d: any) => ({ ...d, schema_json: d.schema_json || [] })));
      if (taxData.success) setTaxonomies(taxData.taxonomies);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleDelete(tf: TransformFunction) {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${API}/transforms/${tf.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      setTransforms((prev) => prev.filter((t) => t.id !== tf.id));
      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  if (view === "create") {
    return (
      <div className="page-container" style={{ overflowY: "auto" }}>
        <CreateTransform
          datasets={datasets}
          taxonomies={taxonomies}
          onSaved={(t) => {
            setTransforms((prev) => [t, ...prev]);
            setSelectedTransform(t);
            setView("detail");
          }}
          onCancel={() => setView("list")}
        />
      </div>
    );
  }

  if (view === "detail" && selectedTransform) {
    return (
      <div className="page-container" style={{ overflowY: "auto" }}>
        <TransformDetail
          transform={selectedTransform}
          datasets={datasets}
          onBack={() => { setView("list"); setSelectedTransform(null); }}
          onUpdated={(updated) => {
            setSelectedTransform(updated);
            setTransforms((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          }}
        />
      </div>
    );
  }

  return (
    <div className="page-container" style={{ overflowY: "auto" }}>
      <TransformList
        transforms={transforms}
        loading={loading}
        onNew={() => setView("create")}
        onOpen={(t) => { setSelectedTransform(t); setView("detail"); }}
        onDelete={(t) => setDeleteTarget(t)}
        onRefresh={loadAll}
      />

      {/* Delete confirmation */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-modal)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 28, width: 420, boxShadow: "var(--shadow-lg)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Delete Transform</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              Delete <strong style={{ color: "var(--text-primary)" }}>{deleteTarget.name}</strong>? The App Attribute values already written to the dataset will remain, but the transform definition will be removed.
            </p>
            {deleteError && (
              <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(239,68,68,0.12)", color: "#F87171", fontSize: 13, marginBottom: 16 }}>{deleteError}</div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => { setDeleteTarget(null); setDeleteError(null); }} disabled={deleteLoading}>Cancel</button>
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
