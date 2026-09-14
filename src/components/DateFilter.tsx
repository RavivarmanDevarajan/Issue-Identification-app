import React from "react";

import type {
  FieldFilter,
  DatePreset,
} from "./filterTypes";

import {
  getDateRange,
  today,
  yesterday,
  lastNDays,
  startOfThisMonth,
  startOfThisYear,
} from "./filterHelpers";

import {
  presetGridStyle,
  presetButtonStyle,
  dateInputStyle,
  helperTextStyle,
  filterSectionStyle,
  dangerButton,
} from "./styles";

interface Props {
  records: any[];

  filter: FieldFilter;

  updateFilter: (
    filter: FieldFilter
  ) => void;
}

export default function DateFilter({

  records,

  filter,

  updateFilter,

}: Props) {

  const range =
    getDateRange(
      records,
      filter.field
    );

  /* ===============================================
     APPLY PRESET
  =============================================== */

  const applyPreset = (
    preset: DatePreset
  ) => {

    let from = "";
    let to = "";

    switch (preset) {

      case "today":

        from = today();
        to = today();
        break;

      case "yesterday":

        from = yesterday();
        to = yesterday();
        break;

      case "last7days":

        from = lastNDays(7);
        to = today();
        break;

      case "last30days":

        from = lastNDays(30);
        to = today();
        break;

      case "thisMonth":

        from = startOfThisMonth();
        to = today();
        break;

      case "thisYear":

        from = startOfThisYear();
        to = today();
        break;

      case "custom":

      default:

        from = filter.from ?? "";
        to = filter.to ?? "";

    }

    updateFilter({

      ...filter,

      preset,

      from,

      to,

    });

  };

  return (

    <div style={filterSectionStyle}>

      {/* PRESETS */}

      <div style={presetGridStyle}>

        <button
          style={presetButtonStyle}
          onClick={() =>
            applyPreset("today")
          }
        >
          Today
        </button>

        <button
          style={presetButtonStyle}
          onClick={() =>
            applyPreset("yesterday")
          }
        >
          Yesterday
        </button>

        <button
          style={presetButtonStyle}
          onClick={() =>
            applyPreset("last7days")
          }
        >
          Last 7 Days
        </button>

        <button
          style={presetButtonStyle}
          onClick={() =>
            applyPreset("last30days")
          }
        >
          Last 30 Days
        </button>

        <button
          style={presetButtonStyle}
          onClick={() =>
            applyPreset("thisMonth")
          }
        >
          This Month
        </button>

        <button
          style={presetButtonStyle}
          onClick={() =>
            applyPreset("thisYear")
          }
        >
          This Year
        </button>

      </div>

      {/* CUSTOM RANGE */}

      <label>
        From
      </label>

      <input

        type="date"

        value={
          filter.from ?? ""
        }

        onChange={(e) =>

          updateFilter({

            ...filter,

            preset: "custom",

            from:
              e.target.value,

          })

        }

        style={dateInputStyle}

      />

      <label>
        To
      </label>

      <input

        type="date"

        value={
          filter.to ?? ""
        }

        onChange={(e) =>

          updateFilter({

            ...filter,

            preset: "custom",

            to:
              e.target.value,

          })

        }

        style={dateInputStyle}

      />

      {/* DATASET RANGE */}

      <div style={helperTextStyle}>

        Dataset Range

        <br />

        <strong>

          {range.min.toLocaleDateString()}

          {"  →  "}

          {range.max.toLocaleDateString()}

        </strong>

      </div>

      {/* CLEAR */}

      <button

        style={dangerButton}

        onClick={() =>

          updateFilter({

            ...filter,

            preset: "custom",

            from: "",

            to: "",

          })

        }

      >

        Clear Date Filter

      </button>

    </div>

  );

}