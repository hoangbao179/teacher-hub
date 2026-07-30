ALTER TABLE classes
  DROP CHECK chk_classes_positive_package_price,
  ADD CONSTRAINT chk_classes_nonnegative_package_price CHECK (default_package_price >= 0);

ALTER TABLE class_tuition_policies
  DROP CHECK chk_class_policy_price,
  ADD CONSTRAINT chk_class_policy_nonnegative_price CHECK (package_price >= 0);
