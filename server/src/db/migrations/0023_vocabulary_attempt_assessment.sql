ALTER TABLE learning_attempt_answers
  ADD COLUMN self_assessment ENUM('REMEMBERED','REVIEW') NULL AFTER is_correct;

CREATE INDEX idx_learning_answers_self_assessment
  ON learning_attempt_answers (attempt_id, self_assessment);
