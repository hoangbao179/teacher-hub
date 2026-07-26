import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { PublicLearningAttempt, SubmitLearningAnswerResult } from "@teacher/shared";
import { createApp } from "../app";
import { pool } from "../db/pool";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;
test.after(async () => { if (enabled) await pool.end(); });

async function clean() {
  await pool.query("SET FOREIGN_KEY_CHECKS=0");
  for (const table of [
    "learning_attempt_answers",
    "learning_attempt_questions",
    "learning_attempts",
    "learning_access_sessions",
    "learning_assignment_recipients",
    "learning_assignment_audience_students",
    "learning_assignment_activities",
    "learning_assignment_items",
    "learning_assignments",
    "audit_logs",
    "users",
  ]) await pool.query(`TRUNCATE TABLE ${table}`);
  await pool.query("SET FOREIGN_KEY_CHECKS=1");
}

async function fixture() {
  await clean();
  const [user] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users(username,email,password_hash,display_name)
     VALUES ('v20d','v20d@example.com','hash','V20D')`,
  );
  const accessToken = randomBytes(32).toString("base64url");
  const accessHash = createHash("sha256").update(accessToken).digest("hex");
  const [assignment] = await pool.execute<ResultSetHeader>(
    `INSERT INTO learning_assignments
      (teacher_user_id,title,audience_type,public_code,open_access_token_hash,
       status,template_code,age_band,max_attempts,answer_feedback_mode,published_at)
     VALUES (?,'Animal game','OPEN_LINK','VTDGAME2',?,'PUBLISHED',
       'CUSTOM','G4_G5',1,'IMMEDIATE',UTC_TIMESTAMP())`,
    [user.insertId, accessHash],
  );
  const values = [
    ["cat", "con mÃ¨o", "ðŸ±"],
    ["dog", "con chÃ³", "ðŸ¶"],
    ["bird", "con chim", "ðŸ¦"],
    ["fish", "con cÃ¡", "ðŸŸ"],
  ];
  const itemIds: number[] = [];
  for (const [index, [word, meaning, emoji]] of values.entries()) {
    const [item] = await pool.execute<ResultSetHeader>(
      `INSERT INTO learning_assignment_items
        (assignment_id,display_order,word,normalized_word,meaning_vi,speech_text,
         tier,illustration_snapshot_json,supports_image_game)
       VALUES (?,?,?,?,?,?,'CORE',?,TRUE)`,
      [
        assignment.insertId,
        index + 1,
        word,
        word,
        meaning,
        word,
        JSON.stringify({ kind: "EMOJI", value: emoji }),
      ],
    );
    itemIds.push(item.insertId);
  }
  await pool.execute(
    `INSERT INTO learning_assignment_activities
      (assignment_id,display_order,mechanic,presentation,required,config_json)
     VALUES (?,1,'SELECT_ONE','LISTEN_PICK_IMAGE',TRUE,JSON_OBJECT())`,
    [assignment.insertId],
  );
  return { assignmentId: assignment.insertId, accessToken, rawWords: values.map(([word]) => word) };
}

async function request<T>(
  base: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; data?: T; error?: { code: string }; headers: Headers }> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => ({})) as {
    data?: T;
    error?: { code: string };
  };
  return { status: response.status, ...body, headers: response.headers };
}

integration("V20D public lifecycle snapshots queue, resumes and grades idempotently", async () => {
  const data = await fixture();
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const summary = await request<{ title: string }>(
      base,
      "/api/public/learning-assignments/VTDGAME2",
    );
    assert.equal(summary.status, 200);
    assert.equal(summary.data?.title, "Animal game");

    const access = await request<{ sessionToken: string }>(
      base,
      "/api/public/learning-assignments/VTDGAME2/access",
      { method: "POST", body: JSON.stringify({ accessToken: data.accessToken, guestName: "BÃ© An" }) },
    );
    assert.equal(access.status, 201);
    const sessionToken = access.data!.sessionToken;
    assert.ok(Buffer.from(sessionToken, "base64url").byteLength >= 32);

    const [sessions] = await pool.query<Array<RowDataPacket & { session_token_hash: string }>>(
      "SELECT session_token_hash FROM learning_access_sessions",
    );
    assert.equal(sessions.length, 1);
    assert.notEqual(sessions[0].session_token_hash, sessionToken);
    assert.equal(sessions[0].session_token_hash, createHash("sha256").update(sessionToken).digest("hex"));

    const started = await request<PublicLearningAttempt>(
      base,
      "/api/public/learning-assignments/VTDGAME2/attempts",
      { method: "POST", body: JSON.stringify({ sessionToken }) },
    );
    assert.equal(started.status, 201);
    assert.ok(started.data?.currentQuestion);
    const initialQuestionId = started.data!.currentQuestion!.id;

    const resumed = await request<PublicLearningAttempt>(
      base,
      `/api/public/learning-attempts/${sessionToken}`,
    );
    assert.equal(resumed.data?.currentQuestion?.id, initialQuestionId);

    const [initialAnswers] = await pool.query<Array<RowDataPacket & {
      correct_answer_snapshot_json: unknown;
    }>>(
      "SELECT correct_answer_snapshot_json FROM learning_attempt_questions WHERE id=?",
      [initialQuestionId],
    );
    const initialCorrect = typeof initialAnswers[0].correct_answer_snapshot_json === "string"
      ? JSON.parse(initialAnswers[0].correct_answer_snapshot_json) as { optionId: string }
      : initialAnswers[0].correct_answer_snapshot_json as { optionId: string };
    const wrongId = started.data!.currentQuestion!.options
      .find((option) => option.id !== initialCorrect.optionId)!.id;
    const answerId = randomUUID();
    const wrongBody = {
      questionId: initialQuestionId,
      clientAnswerId: answerId,
      answerSequence: 1,
      submittedAnswer: { optionId: wrongId },
    };
    const wrong = await request<SubmitLearningAnswerResult>(
      base,
      `/api/public/learning-attempts/${sessionToken}/answers`,
      { method: "POST", body: JSON.stringify(wrongBody) },
    );
    assert.equal(wrong.status, 200);
    assert.equal(wrong.data?.isCorrect, false);
    assert.equal(wrong.data?.shouldRetry, true);
    const replay = await request<SubmitLearningAnswerResult>(
      base,
      `/api/public/learning-attempts/${sessionToken}/answers`,
      { method: "POST", body: JSON.stringify(wrongBody) },
    );
    assert.equal(replay.data?.idempotent, true);
    assert.equal(replay.data?.questionId, wrong.data?.questionId);

    let current = replay.data!.attempt;
    while (current.currentQuestion) {
      const question = current.currentQuestion;
      const [answers] = await pool.query<Array<RowDataPacket & { correct_answer_snapshot_json: unknown }>>(
        "SELECT correct_answer_snapshot_json FROM learning_attempt_questions WHERE id=?",
        [question.id],
      );
      const submittedAnswer = typeof answers[0].correct_answer_snapshot_json === "string"
        ? JSON.parse(answers[0].correct_answer_snapshot_json)
        : answers[0].correct_answer_snapshot_json;
      const response = await request<SubmitLearningAnswerResult>(
        base,
        `/api/public/learning-attempts/${sessionToken}/answers`,
        {
          method: "POST",
          body: JSON.stringify({
            questionId: question.id,
            clientAnswerId: randomUUID(),
            answerSequence: question.answerSequence,
            submittedAnswer,
          }),
        },
      );
      assert.equal(response.status, 200);
      current = response.data!.attempt;
    }
    const completed = await request<{ status: string; stars: number }>(
      base,
      `/api/public/learning-attempts/${sessionToken}/complete`,
      { method: "POST", body: "{}" },
    );
    assert.equal(completed.data?.status, "COMPLETED");
    assert.ok((completed.data?.stars ?? 0) >= 1);

    const guestReplayAccess = await request<{ sessionToken: string }>(
      base,
      "/api/public/learning-assignments/VTDGAME2/access",
      { method: "POST", body: JSON.stringify({ accessToken: data.accessToken }) },
    );
    const guestReplayStart = await request(
      base,
      "/api/public/learning-assignments/VTDGAME2/attempts",
      {
        method: "POST",
        body: JSON.stringify({ sessionToken: guestReplayAccess.data!.sessionToken }),
      },
    );
    assert.equal(guestReplayStart.status, 201, "OPEN_LINK must not enforce recipient maxAttempts");

    let limited;
    for (let index = 0; index < 61; index += 1)
      limited = await request(base, "/api/public/learning-assignments/ABCDEFGH");
    assert.equal(limited!.status, 429);
    assert.ok(Number(limited!.headers.get("Retry-After")) >= 1);

    await pool.execute(
      `UPDATE learning_assignments
       SET open_access_version=open_access_version+1,open_access_revoked_at=UTC_TIMESTAMP()
       WHERE id=?`,
      [data.assignmentId],
    );
    const revoked = await request(
      base,
      `/api/public/learning-attempts/${sessionToken}`,
    );
    assert.equal(revoked.status, 401);
    assert.equal(revoked.error?.code, "PUBLIC_SESSION_EXPIRED");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  }
});
