CREATE UNIQUE INDEX "PromptVersion_one_open_version_per_prompt_idx"
ON "PromptVersion" ("promptId")
WHERE "status" IN ('DRAFT', 'PILOT');

CREATE OR REPLACE FUNCTION prevent_approved_prompt_version_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" = 'APPROVED' THEN
    RAISE EXCEPTION 'Approved prompt versions cannot be deleted';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" = 'APPROVED' AND (
    NEW."promptId" IS DISTINCT FROM OLD."promptId" OR
    NEW."major" IS DISTINCT FROM OLD."major" OR
    NEW."minor" IS DISTINCT FROM OLD."minor" OR
    NEW."patch" IS DISTINCT FROM OLD."patch" OR
    NEW."canonicalVersionId" IS DISTINCT FROM OLD."canonicalVersionId" OR
    NEW."classification" IS DISTINCT FROM OLD."classification" OR
    NEW."audience" IS DISTINCT FROM OLD."audience" OR
    NEW."summary" IS DISTINCT FROM OLD."summary" OR
    NEW."expectedOutput" IS DISTINCT FROM OLD."expectedOutput" OR
    NEW."requiredInputsText" IS DISTINCT FROM OLD."requiredInputsText" OR
    NEW."promptBody" IS DISTINCT FROM OLD."promptBody" OR
    NEW."changeNotes" IS DISTINCT FROM OLD."changeNotes" OR
    NEW."previousVersionId" IS DISTINCT FROM OLD."previousVersionId" OR
    NEW."approverLabel" IS DISTINCT FROM OLD."approverLabel" OR
    NEW."confidentiality" IS DISTINCT FROM OLD."confidentiality" OR
    NEW."qualityScore" IS DISTINCT FROM OLD."qualityScore" OR
    NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt" OR
    NEW."createdById" IS DISTINCT FROM OLD."createdById" OR
    NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Approved prompt version content is immutable';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PromptVersion_approved_immutable"
BEFORE UPDATE OR DELETE ON "PromptVersion"
FOR EACH ROW EXECUTE FUNCTION prevent_approved_prompt_version_mutation();
