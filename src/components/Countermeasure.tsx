import React, { useState } from "react";
import type { CountermeasureAction } from "../App";
import {
  fromCountermeasureDraft,
  isCountermeasureDraftPartial,
  toCountermeasureDraft,
  type CountermeasureDraft,
} from "./countermeasureHelpers";

interface FieldsProps {
  draft: CountermeasureDraft;
  onChange: (draft: CountermeasureDraft) => void;
  disabled?: boolean;
}

export function CountermeasureFields({
  draft,
  onChange,
  disabled = false,
}: FieldsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
        <div>
          <label className="labelStyle" style={{ display: "block", marginBottom: 6 }}>
            Action Date *
          </label>
          <input
            type="date"
            value={draft.date}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...draft,
                date: event.target.value,
              })
            }
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label className="labelStyle" style={{ display: "block", marginBottom: 6 }}>
            Countermeasure Title *
          </label>
          <input
            type="text"
            value={draft.title}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...draft,
                title: event.target.value,
              })
            }
            placeholder="e.g. Torque Specification Calibration Update"
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div>
        <label className="labelStyle" style={{ display: "block", marginBottom: 6 }}>
          Action Description <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          value={draft.description}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...draft,
              description: event.target.value,
            })
          }
          placeholder="Describe implementation steps taken for this countermeasure..."
          rows={2}
          style={{ width: "100%", resize: "vertical" }}
        />
      </div>

      {isCountermeasureDraftPartial(draft) && (
        <div style={{ color: "var(--status-investigate)", fontSize: 12 }}>
          ⚠️ Please provide both an action date and a title, or leave both blank.
        </div>
      )}
    </div>
  );
}

interface ModalProps {
  open: boolean;
  countermeasure?: CountermeasureAction | null;
  asgLabel?: string;
  saving?: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSave: (countermeasure: CountermeasureAction) => void;
  onRemove?: () => void;
}

export default function CountermeasureModal(props: ModalProps) {
  if (!props.open) return null;
  return <CountermeasureDialog {...props} />;
}

function CountermeasureDialog({
  countermeasure,
  asgLabel,
  saving = false,
  errorMessage = "",
  onClose,
  onSave,
  onRemove,
}: ModalProps) {
  const [draft, setDraft] = useState<CountermeasureDraft>(() =>
    toCountermeasureDraft(countermeasure)
  );
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isExisting = Boolean(countermeasure?.date);
  const result = fromCountermeasureDraft(draft);
  const canSave = Boolean(result) && !saving;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        className="panel-card"
        style={{
          width: "100%",
          maxWidth: 540,
          maxHeight: "calc(100vh - 48px)",
          backgroundColor: "var(--bg-modal)",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: 18, fontWeight: 600 }}>
              {isExisting ? "Edit Countermeasure Action" : "Add Countermeasure Action"}
            </h2>
            <p style={{ marginTop: 4, color: "var(--text-muted)", fontSize: 12 }}>
              {asgLabel ? `${asgLabel} — ` : ""}
              Action date will be plotted on timeline charts to measure effectiveness.
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 4 }}>
            ✕
          </button>
        </div>

        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          <CountermeasureFields draft={draft} onChange={setDraft} disabled={saving} />
          {errorMessage && (
            <div style={{ color: "var(--status-detect)", fontSize: 12, marginTop: 12 }}>{errorMessage}</div>
          )}
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-sidebar)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {isExisting && onRemove ? (
            confirmRemove ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--status-detect)", fontSize: 12 }}>Confirm remove?</span>
                <button onClick={() => { setConfirmRemove(false); onRemove(); }} disabled={saving} className="btn-danger" style={{ padding: "4px 10px", fontSize: 12 }}>
                  Yes, Remove
                </button>
                <button onClick={() => setConfirmRemove(false)} disabled={saving} className="btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmRemove(true)} disabled={saving} className="btn-danger">
                Remove Countermeasure
              </button>
            )
          ) : <div />}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} disabled={saving} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => { if (result) onSave(result); }}
              disabled={!canSave}
              className="btn-primary"
            >
              {saving ? "Saving..." : isExisting ? "Save Changes" : "Add Countermeasure"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
