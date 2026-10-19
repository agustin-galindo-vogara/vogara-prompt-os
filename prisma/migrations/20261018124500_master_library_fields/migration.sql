ALTER TABLE "PromptVersion"
ADD COLUMN "classification" TEXT,
ADD COLUMN "qualityScore" INTEGER;

ALTER TABLE "PromptVersion"
ADD CONSTRAINT "PromptVersion_qualityScore_check"
CHECK ("qualityScore" IS NULL OR ("qualityScore" >= 0 AND "qualityScore" <= 100));
