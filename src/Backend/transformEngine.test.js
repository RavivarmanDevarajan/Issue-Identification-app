import test from "node:test";
import assert from "node:assert/strict";
import { applyStringMapper } from "./transformEngine.js";

const mappings = [
  { raw_value: "Handle Split", refined_value: "Split", review_status: "reviewed" },
  { raw_value: "Handle Crack", refined_value: "Crack", review_status: "reviewed" },
];
const config = { inputField: "failure", unmappedPolicy: "keep_raw" };

test("maps actual and serialized list values while preserving list output", () => {
  for (const input of [["Handle Split"], "['Handle Split', 'Handle Crack']"]) {
    const result = applyStringMapper([{ failure: input }], config, mappings);
    assert.deepEqual(result.results[0].refinedOutput, input.length === 1 && Array.isArray(input) ? ["Split"] : ["Split", "Crack"]);
  }
});

test("counts mixed list entities individually and keeps unmapped values", () => {
  const result = applyStringMapper([{ failure: ["Handle Split", "New Failure Type"] }], config, mappings);
  assert.deepEqual(result.results[0].refinedOutput, ["Split", "New Failure Type"]);
  assert.equal(result.results[0].mappingFound, false);
  assert.equal(result.summary.mapped, 1);
  assert.equal(result.summary.unmapped, 1);
  assert.equal(result.summary.recordsWithUnmapped, 1);
});

test("maps scalar values as scalars", () => {
  const result = applyStringMapper([{ failure: "Handle Split" }], config, mappings);
  assert.equal(result.results[0].refinedOutput, "Split");
  assert.equal(result.results[0].mappingFound, true);
});

test("blank policy and review policy apply to each unmapped list member", () => {
  const blank = applyStringMapper([{ failure: ["Handle Split", "Unknown"] }], { ...config, unmappedPolicy: "blank" }, mappings);
  assert.deepEqual(blank.results[0].refinedOutput, ["Split", null]);
  const review = applyStringMapper([{ failure: ["Handle Split", "Unknown"] }], { ...config, unmappedPolicy: "flag_review" }, mappings);
  assert.deepEqual(review.results[0].refinedOutput, ["Split", "Unknown"]);
  assert.equal(review.results[0].needsReview, true);
});

test("incomplete saved mappings are not treated as mapped", () => {
  const result = applyStringMapper([{ failure: "Handle Split" }], config, [{ raw_value: "Handle Split", refined_value: null }]);
  assert.equal(result.results[0].refinedOutput, "Handle Split");
  assert.equal(result.summary.unmapped, 1);
});
