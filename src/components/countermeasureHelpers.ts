import type { CountermeasureAction } from "../App";

/* ======================================================
   COUNTERMEASURE DRAFTS

   A countermeasure is optional as a whole.

   While it is being edited it is held as a draft of
   plain strings, so the inputs stay controlled even
   when the countermeasure does not exist yet.
====================================================== */

export interface CountermeasureDraft {
  date: string;
  title: string;
  description: string;
}

export const emptyCountermeasureDraft: CountermeasureDraft = {
  date: "",
  title: "",
  description: "",
};

export function toCountermeasureDraft(
  countermeasure?: CountermeasureAction | null
): CountermeasureDraft {
  return {
    date: countermeasure?.date || "",
    title: countermeasure?.title || "",
    description:
      countermeasure?.description || "",
  };
}

/*
  Returns the countermeasure, or undefined when the
  draft is blank, which means "no countermeasure".
*/
export function fromCountermeasureDraft(
  draft: CountermeasureDraft
): CountermeasureAction | undefined {
  if (
    !draft.date ||
    !draft.title.trim()
  ) {
    return undefined;
  }

  return {
    date: draft.date,
    title: draft.title.trim(),
    description:
      draft.description.trim() || undefined,
  };
}

/*
  A draft is only usable when it is completely blank
  or completely filled in.

  A date without a title would produce an unlabelled
  line on the timeline chart.
*/
export function isCountermeasureDraftPartial(
  draft: CountermeasureDraft
): boolean {
  return (
    Boolean(draft.date) !==
    Boolean(draft.title.trim())
  );
}

/*
  "2026-03-14" -> "14 Mar 2026"

  Falls back to the raw value so an unexpected format
  is still shown rather than hidden.
*/
export function formatCountermeasureDate(
  value?: string
): string {
  if (!value) {
    return "";
  }

  const match =
    value.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (!match) {
    return value;
  }

  const date =
    new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );

  if (
    isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}
