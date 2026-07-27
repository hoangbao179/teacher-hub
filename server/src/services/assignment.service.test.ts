import assert from "node:assert/strict";
import test from "node:test";
import {
  assignmentActivitiesForTemplate,
  type AssignmentDetail,
  type CreateAssignmentDraftRequest,
} from "@teacher/shared";
import {
  assignmentPublicCode,
  assignmentToken,
  AssignmentService,
  verifyAssignmentToken,
} from "./assignment.service";

const draftInput: CreateAssignmentDraftRequest = {
  title: "Family review",
  instruction: "Chọn đáp án đúng",
  ageBand: "G2_G3",
  audienceType: "OPEN_LINK",
  templateCode: "WORD_RECOGNITION",
  answerFeedbackMode: "IMMEDIATE",
  shuffleQuestions: true,
  items: [
    { displayOrder: 1, word: "mother", meaningVi: "mẹ", tier: "CORE",
      illustration: { kind: "EMOJI", value: "👩" }, supportsImageGame: true },
    { displayOrder: 2, word: "father", meaningVi: "bố", tier: "CORE",
      illustration: { kind: "EMOJI", value: "👨" }, supportsImageGame: true },
    { displayOrder: 3, word: "sister", meaningVi: "chị gái", tier: "CORE",
      illustration: { kind: "EMOJI", value: "👧" }, supportsImageGame: true },
  ],
  activities: [{
    displayOrder: 1,
    mechanic: "SELECT_ONE",
    presentation: "LISTEN_PICK_IMAGE",
    required: true,
  }],
};

function detail(overrides: Partial<AssignmentDetail> = {}): AssignmentDetail {
  return {
    id: 1,
    teacherUserId: 1,
    title: draftInput.title,
    instruction: draftInput.instruction ?? null,
    status: "DRAFT",
    audienceType: "OPEN_LINK",
    ageBand: "G2_G3",
    dueAt: null,
    recipientCount: 0,
    itemCount: 2,
    version: 1,
    updatedAt: new Date().toISOString(),
    vocabularySetId: null,
    classId: null,
    selectedStudentIds: [],
    publicCode: null,
    templateCode: "WORD_RECOGNITION",
    availableFrom: null,
    maxAttempts: null,
    passScore: null,
    answerFeedbackMode: "IMMEDIATE",
    shuffleQuestions: true,
    publishedAt: null,
    closedAt: null,
    items: draftInput.items.map((item, index) => ({
      ...item,
      id: index + 1,
      normalizedWord: item.word,
      illustrationSnapshot: item.illustration,
    })),
    activities: draftInput.activities.map((activity, index) => ({
      ...activity,
      id: index + 1,
    })),
    ...overrides,
  };
}

test("assignment tokens have enough entropy, store only hash and compare safely", () => {
  const token = assignmentToken();
  assert.ok(Buffer.from(token.rawToken, "base64url").byteLength >= 32);
  assert.match(token.tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(token.rawToken.includes("student"), false);
  assert.equal(verifyAssignmentToken(token.rawToken, token.tokenHash), true);
  assert.equal(verifyAssignmentToken(`${token.rawToken}x`, token.tokenHash), false);
  assert.match(assignmentPublicCode(), /^[A-Z2-9]{8}$/);
});

test("activity templates fall back when images or age band are incompatible", () => {
  const young = assignmentActivitiesForTemplate("YOUNG_BEGINNER", {
    ageBand: "PRESCHOOL_G1",
    itemCount: 6,
    imageItemCount: 0,
    exampleItemCount: 0,
  });
  assert.ok(young.warnings.length > 0);
  assert.ok(young.activities.every((value) => !value.presentation.includes("IMAGE")));
  const spelling = assignmentActivitiesForTemplate("SPELLING_REVIEW", {
    ageBand: "PRESCHOOL_G1",
    itemCount: 6,
    imageItemCount: 6,
    exampleItemCount: 0,
  });
  assert.ok(spelling.warnings.some((value) => value.includes("Nhớ mặt chữ")));
});

test("publish returns one-time open access and QR without persisting raw token", async () => {
  let current = detail();
  let persistedHash = "";
  const repository = {
    detail: async () => current,
    publish: async (input: {
      publicCode: string;
      openToken?: { tokenHash: string };
    }) => {
      persistedHash = input.openToken?.tokenHash ?? "";
      current = detail({
        status: "PUBLISHED",
        publicCode: input.publicCode,
        version: 2,
        publishedAt: new Date().toISOString(),
      });
      return [];
    },
  };
  const service = new AssignmentService(
    repository as never,
    "https://tienganhcovy.com",
    { materializeItems: async (items: unknown) => items } as never,
  );
  const result = await service.publish(1, 1, 1);
  assert.equal(result.shares.length, 1);
  assert.match(result.shares[0].shareUrl, /^https:\/\/tienganhcovy\.com\/play\//);
  assert.match(result.shares[0].qrSvg, /^<svg/);
  assert.equal(verifyAssignmentToken(result.shares[0].accessToken, persistedHash), true);
  assert.equal(JSON.stringify(repository).includes(result.shares[0].accessToken), false);
});

test("draft validation rejects invalid audience, date and image-dependent publish", async () => {
  const service = new AssignmentService(
    { detail: async () => detail({
      items: detail().items.map((item) => ({
        ...item,
        illustration: { kind: "NONE" },
        illustrationSnapshot: { kind: "NONE" },
      })),
    }) } as never,
    "https://tienganhcovy.com",
    { materializeItems: async (items: unknown) => items } as never,
  );
  await assert.rejects(
    service.create({ ...draftInput, audienceType: "CLASS", classId: undefined }, 1),
    (error: unknown) => (error as { code?: string }).code === "INVALID_ASSIGNMENT_AUDIENCE",
  );
  await assert.rejects(
    service.create({
      ...draftInput,
      availableFrom: "2026-08-01T10:00:00Z",
      dueAt: "2026-08-01T09:00:00Z",
    }, 1),
    (error: unknown) => (error as { code?: string }).code === "INVALID_DUE_DATE",
  );
  await assert.rejects(
    service.publish(1, 1, 1),
    (error: unknown) => (error as { code?: string }).code === "ACTIVITY_REQUIRES_IMAGES",
  );
});

test("backend rejects unsupported combinations and publish dry-run blocks zero questions", async () => {
  const service = new AssignmentService(
    { detail: async () => detail({
      activities: [{
        id: 90, displayOrder: 1, mechanic: "BUILD_WORD",
        presentation: "BUILD_SPELLED_WORD", required: true,
      }],
      items: detail().items.map((item) => ({ ...item, word: "a" })),
    }) } as never,
    "https://tienganhcovy.com",
    { materializeItems: async (items: unknown) => items } as never,
  );
  await assert.rejects(
    service.create({
      ...draftInput,
      activities: [{
        displayOrder: 1, mechanic: "ORDER_TOKENS",
        presentation: "FLASHCARD", required: true,
      }],
    }, 1),
    (error: unknown) => (error as Error).message.includes("chưa được hỗ trợ"),
  );
  await assert.rejects(
    service.publish(1, 1, 1),
    (error: unknown) => (error as Error).message.includes("không tạo được câu hỏi"),
  );
});

test("publish rejects one zero-question activity even when flashcards are playable", async () => {
  const service = new AssignmentService(
    { detail: async () => detail({
      activities: [
        { id: 91, displayOrder: 1, mechanic: "EXPLORE_CARD", presentation: "FLASHCARD", required: true },
        { id: 92, displayOrder: 2, mechanic: "BUILD_WORD", presentation: "BUILD_SPELLED_WORD", required: true },
      ],
      items: detail().items.map((item, index) => ({ ...item, word: String.fromCharCode(97 + index) })),
    }) } as never,
    "https://tienganhcovy.com",
    { materializeItems: async (items: unknown) => items } as never,
  );
  await assert.rejects(
    service.publish(1, 1, 1),
    (error: unknown) => (error as Error).message.includes("BUILD_SPELLED_WORD"),
  );
});
