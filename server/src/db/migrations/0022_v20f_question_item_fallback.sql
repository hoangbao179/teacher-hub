DROP TRIGGER trg_learning_question_item_fallback;

ALTER TABLE vocabulary_items
  MODIFY image_search_terms_json JSON NULL;

ALTER TABLE learning_assignment_items
  MODIFY image_search_terms_json JSON NULL;

CREATE TRIGGER trg_learning_question_item_fallback
AFTER INSERT ON learning_attempt_questions
FOR EACH ROW
INSERT INTO learning_attempt_question_items
  (question_id,assignment_item_id,display_order,first_attempt_correct,
   final_correct,retry_count)
VALUES (
  NEW.id,
  NEW.assignment_item_id,
  1,
  NEW.first_attempt_correct,
  NEW.final_correct,
  NEW.retry_count
);
