/// <reference types="node" />
import assert from "node:assert/strict";
import test from "node:test";
import type { AssignmentActivityInput } from "@teacher/shared";
import { assignmentSourceAgeBand, autoAssignmentTitle, toggleAssignmentActivity } from "./assignmentWizardRules";

const activities = Array.from({ length: 9 }, (_, index) => ({
  displayOrder: index + 1,
  mechanic: "SELECT_ONE" as const,
  presentation: [
    "LISTEN_PICK_IMAGE", "IMAGE_PICK_WORD", "LISTEN_PICK_WORD", "WORD_PICK_MEANING",
    "MEANING_PICK_WORD", "FEED_MONSTER", "POP_BALLOON", "OPEN_TREASURE", "CHOOSE_TRAIN_CARRIAGE",
  ][index] as AssignmentActivityInput["presentation"],
  required: true,
}));

test("the ninth activity is disabled logically while a selected activity can be removed", () => {
  const selected = activities.slice(0, 8);
  assert.equal(toggleAssignmentActivity(selected, activities[8], 8), selected);
  const removed = toggleAssignmentActivity(selected, activities[0], 8);
  assert.equal(removed.length, 7);
  assert.deepEqual(removed.map((item) => item.displayOrder), [1, 2, 3, 4, 5, 6, 7]);
});

test("auto title updates until the teacher edits it", () => {
  assert.equal(autoAssignmentTitle({
    userEdited: false, currentTitle: "Old", className: "Lớp 3A", sourceTitle: "Unit 4 – Food and Drinks",
  }), "Lớp 3A – Unit 4 – Food and Drinks");
  assert.equal(autoAssignmentTitle({
    userEdited: true, currentTitle: "Bài riêng của cô", className: "Lớp 3A", sourceTitle: "Food",
  }), "Bài riêng của cô");
});

test("topic and unit sources always use the latest parent vocabulary-set age band", () => {
  assert.equal(assignmentSourceAgeBand("G2_G3"), "G2_G3");
  assert.equal(assignmentSourceAgeBand("G6_G9"), "G6_G9");
});
