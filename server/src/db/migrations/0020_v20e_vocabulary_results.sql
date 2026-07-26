ALTER TABLE learning_assignments
  ADD COLUMN review_source_assignment_id BIGINT UNSIGNED NULL AFTER vocabulary_set_id,
  ADD CONSTRAINT fk_learning_assignment_review_source
    FOREIGN KEY (review_source_assignment_id) REFERENCES learning_assignments(id),
  ADD INDEX idx_learning_assignment_review_source (review_source_assignment_id);

ALTER TABLE learning_attempts
  ADD INDEX idx_learning_attempt_results
    (assignment_id,recipient_id,status,last_activity_at);

ALTER TABLE learning_attempt_questions
  ADD INDEX idx_learning_question_results
    (assignment_item_id,graded,attempt_id);
