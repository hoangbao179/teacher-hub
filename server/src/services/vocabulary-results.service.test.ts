import assert from "node:assert/strict";
import test from "node:test";
import type { AssignmentDetail } from "@teacher/shared";
import { VocabularyResultsService } from "./vocabulary-results.service";

const source: AssignmentDetail = {
  id: 7, teacherUserId: 1, title: "Animals", instruction: null,
  status: "CLOSED", audienceType: "SELECTED_STUDENTS", ageBand: "G2_G3",
  dueAt: null, recipientCount: 1, itemCount: 1, version: 3,
  updatedAt: new Date().toISOString(), vocabularySetId: null, classId: null,
  selectedStudentIds: [9], publicCode: "ABCDEFGH", templateCode: "CUSTOM",
  availableFrom: null, maxAttempts: 2, passScore: null,
  answerFeedbackMode: "IMMEDIATE", shuffleQuestions: true,
  publishedAt: new Date().toISOString(), closedAt: new Date().toISOString(),
  items: [{
    id: 11, displayOrder: 1, word: "cat", normalizedWord: "cat",
    meaningVi: "con mèo", speechText: "cat", tier: "CORE",
    illustration: { kind: "EMOJI", value: "🐱" },
    illustrationSnapshot: { kind: "EMOJI", value: "🐱" },
    supportsImageGame: true,
  }],
  activities: [{
    id: 12, displayOrder: 1, mechanic: "SELECT_ONE",
    presentation: "WORD_PICK_MEANING", required: true,
  }],
};

test("review workflow snapshots selected source data into a draft only", async () => {
  let created: { sourceId: number; status?: string; input?: unknown } | undefined;
  const assignments = {
    detail: async () => source,
    recipients: async () => [{
      id: 21, studentId: 9, studentName: "An", assignedAt: new Date().toISOString(),
      tokenRevokedAt: null, completedAt: null,
    }],
    createReview: async (input: unknown, sourceId: number) => {
      created = { sourceId, status: "DRAFT", input };
      return 99;
    },
  };
  const results = {
    owner: async () => ({
      id: 7, status: "CLOSED", audience_type: "SELECTED_STUDENTS",
    }),
    reviewCandidateItemIds: async () => [11],
  };
  const service = new VocabularyResultsService(results as never, assignments as never);
  const output = await service.createReviewDraft(7, {
    assignmentItemIds: [11], recipientIds: [21],
  }, 1);
  assert.deepEqual(output, {
    id: 99, status: "DRAFT", sourceAssignmentId: 7, itemCount: 1, recipientCount: 1,
  });
  assert.equal(created?.sourceId, 7);
  assert.equal((created?.input as { audienceType: string }).audienceType, "SELECTED_STUDENTS");
  assert.equal((created?.input as { selectedStudentIds: number[] }).selectedStudentIds[0], 9);
});

test("OPEN_LINK guest results cannot create authoritative review recipients", async () => {
  const service = new VocabularyResultsService({
    owner: async () => ({ id: 7, status: "PUBLISHED", audience_type: "OPEN_LINK" }),
  } as never, {
    detail: async () => ({ ...source, audienceType: "OPEN_LINK" }),
  } as never);
  await assert.rejects(
    service.createReviewDraft(7, { assignmentItemIds: [11], recipientIds: [21] }, 1),
    (error: unknown) =>
      (error as { code?: string }).code === "OPEN_LINK_RESULTS_NOT_AUTHORITATIVE",
  );
});
