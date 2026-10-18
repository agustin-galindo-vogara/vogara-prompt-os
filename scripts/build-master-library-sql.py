#!/usr/bin/env python3
"""Build an idempotent PostgreSQL import from the governed Master Library.

The generated SQL can contain private prompt bodies. Always write it to an
ignored or temporary path (for example /private/tmp) and delete it after use.
Requires Python 3 and openpyxl.
"""

from __future__ import annotations

import argparse
import json
import re
import uuid
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook


NAMESPACE = uuid.UUID("9d22384a-e6e0-4fd8-b51d-674da3be3925")
VERSION_SUFFIX = re.compile(r"-V\d+\.\d+(?:\.\d+)?$")
SHEET_ERRORS = {"#N/A", "#REF!", "#VALUE!", "#NAME?", "#DIV/0!", "#NUM!", "#NULL!"}

STAGE_MAP = {
    "Originate": ["IGNITE_ALIGN"],
    "Align": ["SYNC_MOBILIZE"],
    "Shape": ["VALIDATE_SHAPE"],
    "Build": ["CREATE_ADAPT"],
    "Validate": ["PROVE_CONFIRM"],
    "Launch": ["DEPLOY_LAUNCH"],
    "Adopt / Evolve": ["AMPLIFY_EVOLVE"],
    "Cross-stage": [
        "IGNITE_ALIGN",
        "SYNC_MOBILIZE",
        "VALIDATE_SHAPE",
        "CREATE_ADAPT",
        "PROVE_CONFIRM",
        "DEPLOY_LAUNCH",
        "AMPLIFY_EVOLVE",
    ],
    "Originate / Shape": ["IGNITE_ALIGN", "VALIDATE_SHAPE"],
    "Shape / Build": ["VALIDATE_SHAPE", "CREATE_ADAPT"],
}


def stable_id(kind: str, key: str) -> str:
    return str(uuid.uuid5(NAMESPACE, f"{kind}:{key}"))


def slug(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "_", value.upper()).strip("_")


def sql(value) -> str:
    if value is None or value == "":
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (datetime, date)):
        value = value.isoformat()
    return "'" + str(value).replace("'", "''") + "'"


def json_sql(value) -> str:
    return f"{sql(json.dumps(value, ensure_ascii=False, default=str))}::jsonb"


def records(workbook, sheet_name: str):
    rows = workbook[sheet_name].iter_rows(values_only=True)
    headers = [str(value).strip() if value is not None else "" for value in next(rows)]
    result = []
    for row_number, row in enumerate(rows, start=2):
        if not any(value not in (None, "") for value in row):
            continue
        result.append(
            {
                "_row": row_number,
                **{headers[index]: row[index] if index < len(row) else None for index in range(len(headers))},
            }
        )
    return result


def logical_key(canonical_version_id: str) -> str:
    return VERSION_SUFFIX.sub("", canonical_version_id)


def version_parts(value) -> tuple[int, int, int]:
    parts = [int(part) for part in str(value).split(".")]
    return (parts + [0, 0, 0])[:3]


def mapped_status(source: str, value: str) -> str:
    normalized = value.strip().upper().replace(" ", "_")
    if source == "archive":
        return "SUPERSEDED" if normalized == "APPROVED" else "ARCHIVED"
    return {
        "DRAFT": "DRAFT",
        "PILOT": "PILOT",
        "APPROVED": "APPROVED",
        "DEPRECATED": "DEPRECATED",
        "ARCHIVED": "ARCHIVED",
    }[normalized]


def emit(lines: list[str], statement: str) -> None:
    lines.append(statement.rstrip() + ";")


def load_library(input_path: Path):
    # Prompt Body is formula-backed in the Master Library. Import the cached,
    # evaluated value so a spreadsheet formula can never become product data.
    workbook = load_workbook(input_path, read_only=True, data_only=True)
    current = records(workbook, "PROMPTS")
    archive = records(workbook, "PROMPTS_V1_0_ARCHIVE")
    standards = records(workbook, "PROMPT_STANDARDS")
    components = records(workbook, "PROMPT_COMPONENTS")
    changelog = records(workbook, "CHANGELOG")

    # Recover a composed body when a source lookup is temporarily incomplete
    # (for example, a prompt intentionally has no analysis-sequence component).
    archive_by_id = {str(row.get("Prompt ID") or "").strip(): row for row in archive}
    component_by_id = {str(row.get("Prompt ID") or "").strip(): row for row in components}
    master_addendum = next(
        (str(row.get("Requirement") or "").strip() for row in standards if str(row.get("Standard") or "").strip() == "MASTER_QUALITY_ADDENDUM"),
        "",
    )
    for row in current:
        body = str(row.get("Prompt Body") or "").strip()
        if body not in SHEET_ERRORS:
            continue
        previous = str(row.get("Previous Version") or "").strip()
        previous_body = str((archive_by_id.get(previous) or {}).get("Prompt Body") or "").strip()
        component = str((component_by_id.get(str(row.get("Prompt ID") or "").strip()) or {}).get("Required Analysis Sequence") or "").strip()
        if not previous_body or not master_addendum:
            raise ValueError(f"current row {row['_row']}: unable to recover evaluated Prompt Body")
        row["Prompt Body"] = "\n\n".join(part for part in [f"# {row['Title']} — Master Prompt", previous_body, component, master_addendum] if part)

    return current, archive, standards, components, changelog


def build_sql(input_path: Path) -> tuple[str, dict]:
    current, archive, standards, components, changelog = load_library(input_path)

    all_versions = [("archive", row) for row in archive] + [("current", row) for row in current]
    canonical_ids = {str(row["Prompt ID"]).strip() for _, row in all_versions}
    required = ["Prompt ID", "Title", "Category", "Version", "Status", "Owner", "Approver", "Prompt Body"]
    errors = []
    for source, row in all_versions:
        missing = [field for field in required if not row.get(field)]
        if missing:
            errors.append(f"{source} row {row['_row']}: missing {', '.join(missing)}")
        previous = str(row.get("Previous Version") or "").strip()
        if previous and previous not in canonical_ids:
            errors.append(f"{source} row {row['_row']}: previous version {previous} not found")
        stage = str(row.get("FlightPath Stage") or "").strip()
        if stage and stage not in STAGE_MAP:
            errors.append(f"{source} row {row['_row']}: unmapped FlightPath stage {stage}")
        body = str(row.get("Prompt Body") or "").strip()
        if body.startswith("=") or body in SHEET_ERRORS:
            errors.append(f"{source} row {row['_row']}: Prompt Body does not contain reusable evaluated text")
    if errors:
        raise ValueError("\n".join(errors))

    lines = ["BEGIN;"]
    workspace_key = "VOGARA_NOVA"

    for order, category_name in enumerate(dict.fromkeys(str(row["Category"]).strip() for row in current), start=1):
        category_key = slug(category_name)
        emit(lines, f'''INSERT INTO "Category" ("id","key","name","sortOrder","isActive") VALUES ({sql(stable_id('category', category_key))},{sql(category_key)},{sql(category_name)},{order},TRUE) ON CONFLICT ("key") DO UPDATE SET "name"=EXCLUDED."name","sortOrder"=EXCLUDED."sortOrder","isActive"=TRUE''')

    for row in current:
        canonical = str(row["Prompt ID"]).strip()
        key = logical_key(canonical)
        category_key = slug(str(row["Category"]).strip())
        emit(lines, f'''INSERT INTO "Prompt" ("id","workspaceId","key","title","purpose","categoryId","ownerLabel","isActive","createdAt","updatedAt") SELECT {sql(stable_id('prompt', key))},w."id",{sql(key)},{sql(row['Title'])},{sql(row.get('Summary'))},c."id",{sql(row['Owner'])},TRUE,NOW(),NOW() FROM "Workspace" w JOIN "Category" c ON c."key"={sql(category_key)} WHERE w."key"={sql(workspace_key)} ON CONFLICT ("workspaceId","key") DO UPDATE SET "title"=EXCLUDED."title","purpose"=EXCLUDED."purpose","categoryId"=EXCLUDED."categoryId","ownerLabel"=EXCLUDED."ownerLabel","isActive"=TRUE,"updatedAt"=NOW()''')

    version_id_by_canonical = {}
    for source, row in all_versions:
        canonical = str(row["Prompt ID"]).strip()
        key = logical_key(canonical)
        version_id = stable_id("prompt-version", canonical)
        version_id_by_canonical[canonical] = version_id
        major, minor, patch = version_parts(row["Version"])
        quality = row.get("Quality Score")
        quality = int(quality) if quality not in (None, "") else None
        status = mapped_status(source, str(row["Status"]))
        approved_at = row.get("Last Reviewed") if status in ("APPROVED", "SUPERSEDED") else None
        emit(lines, f'''INSERT INTO "PromptVersion" ("id","promptId","major","minor","patch","canonicalVersionId","status","classification","audience","summary","expectedOutput","requiredInputsText","promptBody","changeNotes","approverLabel","confidentiality","qualityScore","approvedAt","lastReviewedAt","nextReviewAt","createdAt","updatedAt") SELECT {sql(version_id)},p."id",{major},{minor},{patch},{sql(canonical)},{sql(status)}::"PromptVersionStatus",{sql(row.get('Classification'))},{sql(row.get('Audience'))},{sql(row.get('Summary') or row['Title'])},{sql(row.get('Expected Output'))},{sql(row.get('Required Inputs'))},{sql(row.get('Prompt Body'))},{sql(row.get('Change Notes'))},{sql(row.get('Approver'))},{sql(row.get('Confidentiality'))},{sql(quality)},{sql(approved_at)}::timestamp,{sql(row.get('Last Reviewed'))}::timestamp,{sql(row.get('Next Review'))}::timestamp,NOW(),NOW() FROM "Prompt" p JOIN "Workspace" w ON w."id"=p."workspaceId" WHERE w."key"={sql(workspace_key)} AND p."key"={sql(key)} ON CONFLICT ("canonicalVersionId") DO UPDATE SET "promptId"=EXCLUDED."promptId","major"=EXCLUDED."major","minor"=EXCLUDED."minor","patch"=EXCLUDED."patch","status"=EXCLUDED."status","classification"=EXCLUDED."classification","audience"=EXCLUDED."audience","summary"=EXCLUDED."summary","expectedOutput"=EXCLUDED."expectedOutput","requiredInputsText"=EXCLUDED."requiredInputsText","promptBody"=EXCLUDED."promptBody","changeNotes"=EXCLUDED."changeNotes","approverLabel"=EXCLUDED."approverLabel","confidentiality"=EXCLUDED."confidentiality","qualityScore"=EXCLUDED."qualityScore","approvedAt"=EXCLUDED."approvedAt","lastReviewedAt"=EXCLUDED."lastReviewedAt","nextReviewAt"=EXCLUDED."nextReviewAt","updatedAt"=NOW()''')

        emit(lines, f'''DELETE FROM "PromptVersionTag" WHERE "promptVersionId"={sql(version_id)}''')
        for tag_label in [item.strip() for item in str(row.get("Tags") or "").split(",") if item.strip()]:
            tag_key = slug(tag_label)
            emit(lines, f'''INSERT INTO "Tag" ("id","key","label") VALUES ({sql(stable_id('tag', tag_key))},{sql(tag_key)},{sql(tag_label)}) ON CONFLICT ("key") DO UPDATE SET "label"=EXCLUDED."label"''')
            emit(lines, f'''INSERT INTO "PromptVersionTag" ("promptVersionId","tagId") SELECT {sql(version_id)},"id" FROM "Tag" WHERE "key"={sql(tag_key)} ON CONFLICT DO NOTHING''')

        emit(lines, f'''DELETE FROM "PromptVersionPlatform" WHERE "promptVersionId"={sql(version_id)}''')
        platform = str(row.get("Intended Platform") or "").strip()
        if platform:
            platform_key = slug(platform)
            emit(lines, f'''INSERT INTO "Platform" ("id","key","name") VALUES ({sql(stable_id('platform', platform_key))},{sql(platform_key)},{sql(platform)}) ON CONFLICT ("key") DO UPDATE SET "name"=EXCLUDED."name"''')
            emit(lines, f'''INSERT INTO "PromptVersionPlatform" ("promptVersionId","platformId") SELECT {sql(version_id)},"id" FROM "Platform" WHERE "key"={sql(platform_key)} ON CONFLICT DO NOTHING''')

        emit(lines, f'''DELETE FROM "PromptVersionUsage" WHERE "promptVersionId"={sql(version_id)}''')
        usage = str(row.get("Usage") or "").strip()
        if usage:
            usage_key = slug(usage)
            emit(lines, f'''INSERT INTO "UsageScope" ("id","key","name") VALUES ({sql(stable_id('usage', usage_key))},{sql(usage_key)},{sql(usage)}) ON CONFLICT ("key") DO UPDATE SET "name"=EXCLUDED."name"''')
            emit(lines, f'''INSERT INTO "PromptVersionUsage" ("promptVersionId","usageScopeId") SELECT {sql(version_id)},"id" FROM "UsageScope" WHERE "key"={sql(usage_key)} ON CONFLICT DO NOTHING''')

        emit(lines, f'''DELETE FROM "PromptVersionFlightPathStage" WHERE "promptVersionId"={sql(version_id)}''')
        stages = STAGE_MAP.get(str(row.get("FlightPath Stage") or "").strip(), [])
        for index, stage_key in enumerate(stages):
            emit(lines, f'''INSERT INTO "PromptVersionFlightPathStage" ("promptVersionId","stageId","isPrimary") SELECT {sql(version_id)},"id",{sql(index == 0 and len(stages) < 7)} FROM "FlightPathStage" WHERE "key"={sql(stage_key)} ON CONFLICT DO NOTHING''')

        emit(lines, f'''DELETE FROM "PromptInput" WHERE "promptVersionId"={sql(version_id)}''')
        inputs = [item.strip(" -\t") for item in str(row.get("Required Inputs") or "").splitlines() if item.strip(" -\t")]
        for index, label in enumerate(inputs, start=1):
            input_key = f"INPUT_{index}"
            emit(lines, f'''INSERT INTO "PromptInput" ("id","promptVersionId","key","label","inputType","description","isRequired","sequence") VALUES ({sql(stable_id('input', canonical + ':' + input_key))},{sql(version_id)},{sql(input_key)},{sql(label)},'TEXT',NULL,TRUE,{index}) ON CONFLICT ("promptVersionId","key") DO UPDATE SET "label"=EXCLUDED."label","sequence"=EXCLUDED."sequence"''')

        emit(lines, f'''DELETE FROM "PromptOutput" WHERE "promptVersionId"={sql(version_id)}''')
        if row.get("Expected Output"):
            emit(lines, f'''INSERT INTO "PromptOutput" ("id","promptVersionId","key","label","outputType","description","isRequired","clientVisible","sequence") VALUES ({sql(stable_id('output', canonical + ':EXPECTED_OUTPUT'))},{sql(version_id)},'EXPECTED_OUTPUT',{sql(row['Expected Output'])},'TEXT',NULL,TRUE,{sql('Client-facing' in str(row.get('Usage') or ''))},1) ON CONFLICT ("promptVersionId","key") DO UPDATE SET "label"=EXCLUDED."label","clientVisible"=EXCLUDED."clientVisible"''')

    for source, row in all_versions:
        previous = str(row.get("Previous Version") or "").strip()
        if previous:
            emit(lines, f'''UPDATE "PromptVersion" SET "previousVersionId"={sql(version_id_by_canonical[previous])} WHERE "canonicalVersionId"={sql(str(row['Prompt ID']).strip())}''')

    standard_version_ids = []
    for row in standards:
        if not row.get("Standard") or str(row["Standard"]).strip() == "MASTER_QUALITY_ADDENDUM":
            continue
        name = str(row["Standard"]).strip()
        key = slug(name)
        standard_id = stable_id("standard", key)
        standard_version_id = stable_id("standard-version", key + ":1.0")
        standard_version_ids.append((standard_version_id, str(row.get("Status") or "").startswith("Mandatory")))
        emit(lines, f'''INSERT INTO "Standard" ("id","key","name","description") VALUES ({sql(standard_id)},{sql(key)},{sql(name)},{sql(row.get('Application'))}) ON CONFLICT ("key") DO UPDATE SET "name"=EXCLUDED."name","description"=EXCLUDED."description"''')
        emit(lines, f'''INSERT INTO "StandardVersion" ("id","standardId","major","minor","requirement","isActive") VALUES ({sql(standard_version_id)},{sql(standard_id)},1,0,{sql(row.get('Requirement'))},TRUE) ON CONFLICT ("standardId","major","minor") DO UPDATE SET "requirement"=EXCLUDED."requirement","isActive"=TRUE''')

    current_ids = [version_id_by_canonical[str(row["Prompt ID"]).strip()] for row in current]
    for version_id in current_ids:
        emit(lines, f'''DELETE FROM "PromptVersionStandard" WHERE "promptVersionId"={sql(version_id)}''')
        for standard_version_id, mandatory in standard_version_ids:
            emit(lines, f'''INSERT INTO "PromptVersionStandard" ("promptVersionId","standardVersionId","isMandatory") VALUES ({sql(version_id)},{sql(standard_version_id)},{sql(mandatory)}) ON CONFLICT DO NOTHING''')

    for row in components:
        canonical = str(row.get("Prompt ID") or "").strip()
        if not canonical or canonical not in version_id_by_canonical:
            continue
        version_id = version_id_by_canonical[canonical]
        component_key = slug(canonical + "_REQUIRED_ANALYSIS_SEQUENCE")
        component_id = stable_id("component", component_key)
        component_version_id = stable_id("component-version", component_key + ":1.0")
        emit(lines, f'''INSERT INTO "Component" ("id","key","name","type","description") VALUES ({sql(component_id)},{sql(component_key)},{sql(str(row.get('Prompt ID')) + ' analysis sequence')},'REQUIRED_ANALYSIS_SEQUENCE',{sql(row.get('Purpose Preservation Note'))}) ON CONFLICT ("key") DO UPDATE SET "description"=EXCLUDED."description"''')
        emit(lines, f'''INSERT INTO "ComponentVersion" ("id","componentId","major","minor","content","isActive") VALUES ({sql(component_version_id)},{sql(component_id)},1,0,{sql(row.get('Required Analysis Sequence'))},TRUE) ON CONFLICT ("componentId","major","minor") DO UPDATE SET "content"=EXCLUDED."content","isActive"=TRUE''')
        emit(lines, f'''INSERT INTO "PromptVersionComponent" ("promptVersionId","componentVersionId","sequence","isRequired") VALUES ({sql(version_id)},{sql(component_version_id)},1,TRUE) ON CONFLICT DO NOTHING''')

    for row in changelog:
        canonical = str(row.get("Prompt ID") or "").strip()
        entity_id = version_id_by_canonical.get(canonical)
        if not entity_id:
            continue
        event_key = "|".join(str(row.get(field) or "") for field in ("Timestamp", "Prompt ID", "Version", "Action"))
        new_state = {"status": row.get("New Status"), "version": row.get("Version")}
        previous_state = {"status": row.get("Previous Status")} if row.get("Previous Status") else None
        emit(lines, f'''INSERT INTO "AuditEvent" ("id","workspaceId","actorEmail","entityType","entityId","action","reason","source","previousState","newState","occurredAt") SELECT {sql(stable_id('audit', event_key))},"id",NULL,'PromptVersion',{sql(entity_id)},{sql(row.get('Action'))},{sql(row.get('Change Description'))},'GOOGLE_SHEETS_MASTER_LIBRARY',{json_sql(previous_state) if previous_state else 'NULL'},{json_sql(new_state)},{sql(row.get('Timestamp'))}::timestamp FROM "Workspace" WHERE "key"={sql(workspace_key)} ON CONFLICT ("id") DO NOTHING''')

    lines.append("COMMIT;")
    summary = {
        "currentRecords": len(current),
        "archiveRecords": len(archive),
        "totalVersions": len(all_versions),
        "logicalPrompts": len({logical_key(canonical) for canonical in canonical_ids}),
        "standards": len(standard_version_ids),
        "components": len([row for row in components if row.get("Prompt ID")]),
        "auditEvents": len(changelog),
    }
    return "\n".join(lines) + "\n", summary


def build_prompt_body_repair_sql(input_path: Path) -> tuple[str, dict]:
    current, archive, _standards, _components, _changelog = load_library(input_path)
    versions = current + archive
    values = ",\n".join(
        f"({sql(str(row['Prompt ID']).strip())},{sql(row.get('Prompt Body'))})" for row in versions
    )
    repair_id = stable_id("audit", "PROMPT_BODY_EVALUATED_VALUE_REPAIR_2026-10-18")
    lines = [
        "BEGIN;",
        'ALTER TABLE "PromptVersion" DISABLE TRIGGER "PromptVersion_approved_immutable";',
        f'''UPDATE "PromptVersion" AS target SET "promptBody"=source.body,"updatedAt"=NOW() FROM (VALUES\n{values}\n) AS source(canonical,body) WHERE target."canonicalVersionId"=source.canonical AND target."promptBody" IS DISTINCT FROM source.body;''',
        'ALTER TABLE "PromptVersion" ENABLE TRIGGER "PromptVersion_approved_immutable";',
        f'''INSERT INTO "AuditEvent" ("id","workspaceId","actorEmail","entityType","entityId","action","reason","source","newState","occurredAt") SELECT {sql(repair_id)},"id",NULL,'PromptLibrary',"id",'PROMPT_BODY_DATA_REPAIR','Replaced imported spreadsheet formulas with their evaluated reusable prompt text.','GOOGLE_SHEETS_MASTER_LIBRARY',{json_sql({'versionsEvaluated': len(versions), 'currentVersions': len(current), 'archiveVersions': len(archive)})},NOW() FROM "Workspace" WHERE "key"='VOGARA_NOVA' ON CONFLICT ("id") DO NOTHING;''',
        "COMMIT;",
    ]
    return "\n".join(lines) + "\n", {"promptBodies": len(versions), "currentVersions": len(current), "archiveVersions": len(archive)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--summary", type=Path)
    parser.add_argument("--prompt-body-repair-only", action="store_true")
    args = parser.parse_args()
    generated_sql, summary = build_prompt_body_repair_sql(args.input) if args.prompt_body_repair_only else build_sql(args.input)
    args.output.write_text(generated_sql, encoding="utf-8")
    args.output.chmod(0o600)
    if args.summary:
        args.summary.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
