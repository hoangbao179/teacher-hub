/* global console */
import { learningLevels, learningUnits } from "../src/features/learning/content/vocabularyCatalog.ts";
import { assertValidLearningCatalog } from "../src/features/learning/content/validateCatalog.ts";

assertValidLearningCatalog(learningLevels, learningUnits);
console.log(`Learning catalog hợp lệ: ${learningLevels.length} level, ${learningUnits.length} Unit.`);
