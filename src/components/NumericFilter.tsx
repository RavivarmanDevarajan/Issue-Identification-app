import React from "react";

import type {
  FieldFilter,
} from "./filterTypes";

import {
  getNumericRange,
} from "./filterHelpers";

import {
  selectStyle,
  numberInputStyle,
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

export default function NumericFilter({

  records,

  filter,

  updateFilter,

}: Props) {

  const range =
    getNumericRange(
      records,
      filter.field
    );

  return (

    <div style={filterSectionStyle}>

      {/* Operator */}

      <select

        value={
          filter.operator ??
          ">"
        }

        onChange={(e) =>

          updateFilter({

            ...filter,

            operator:
              e.target.value as any,

          })

        }

        style={selectStyle}

      >

        <option value=">">
          Greater than
        </option>

        <option value=">=">
          Greater than or equal
        </option>

        <option value="<">
          Less than
        </option>

        <option value="<=">
          Less than or equal
        </option>

        <option value="=">
          Equals
        </option>

        <option value="between">
          Between
        </option>

      </select>

      {/* Between */}

      {filter.operator ===
      "between" ? (

        <>

          <input

            type="number"

            placeholder={`Minimum (${range.min})`}

            value={
              filter.min ?? ""
            }

            onChange={(e) =>

              updateFilter({

                ...filter,

                min:
                  e.target.value === ""
                    ? undefined
                    : Number(
                        e.target.value
                      ),

              })

            }

            style={numberInputStyle}

          />

          <input

            type="number"

            placeholder={`Maximum (${range.max})`}

            value={
              filter.max ?? ""
            }

            onChange={(e) =>

              updateFilter({

                ...filter,

                max:
                  e.target.value === ""
                    ? undefined
                    : Number(
                        e.target.value
                      ),

              })

            }

            style={numberInputStyle}

          />

        </>

      ) : (

        <input

          type="number"

          placeholder={`Value (${range.min} - ${range.max})`}

          value={
            filter.value ?? ""
          }

          onChange={(e) =>

            updateFilter({

              ...filter,

              value:
                e.target.value === ""
                  ? undefined
                  : Number(
                      e.target.value
                    ),

            })

          }

          style={numberInputStyle}

        />

      )}

      {/* Dataset Range */}

      <div style={helperTextStyle}>

        Dataset Range

        <br />

        <strong>

          {range.min}

          {"  →  "}

          {range.max}

        </strong>

      </div>

      {/* Clear */}

      <button

        style={dangerButton}

        onClick={() =>

          updateFilter({

            ...filter,

            operator: ">",

            value: undefined,

            min: undefined,

            max: undefined,

          })

        }

      >

        Clear Numeric Filter

      </button>

    </div>

  );

}