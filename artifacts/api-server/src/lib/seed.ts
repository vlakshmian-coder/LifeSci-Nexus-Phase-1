import { desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  auditEventsTable,
  findingsTable,
  projectsTable,
  reportsTable,
  reviewItemsTable,
  runsTable,
} from "@workspace/db";
import { logger } from "./logger";

export async function seedLifeSciData(): Promise<void> {
  const [existing] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .limit(1);
  if (existing) {
    return;
  }

  const projectId = "project-arcadia-dx";
  const runId = "run-arcadia-baseline";
  const now = new Date();

  await db.insert(projectsTable).values({
    id: projectId,
    name: "Arcadia Point-of-Care Diagnostic",
    status: "ACTIVE",
    productName: "Arcadia Dx Cartridge System",
    intendedUse:
      "Point-of-care diagnostic workflow for preliminary demonstration only",
    projectPhase: "Clinical validation preparation",
    assessmentFramework: "Clinical-validation readiness checklist",
    jurisdictionContext: "Multi-region context — applicability requires review",
    scopeNotes:
      "Fictional portfolio project seeded to demonstrate traceability and uncertainty handling.",
    workflowState: "HUMAN_REVIEW",
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 9),
    updatedAt: new Date(now.getTime() - 1000 * 60 * 8),
  });

  await db.insert(runsTable).values({
    id: runId,
    projectId,
    state: "HUMAN_REVIEW",
    label: "Baseline readiness review",
    startedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24),
    updatedAt: new Date(now.getTime() - 1000 * 60 * 8),
  });

  await db.insert(findingsTable).values([
    {
      id: "finding-evidence-map",
      projectId,
      title: "Clinical evidence map needs a reviewer-confirmed endpoint",
      summary:
        "The submitted project material references an evidence map, but the endpoint definition is not explicit enough to assess from the available context.",
      status: "REQUIRES_HUMAN_REVIEW",
      confidence: "MEDIUM",
      provenance: [
        {
          sourceType: "PROJECT_DOCUMENT",
          label: "Clinical validation outline",
          locator: "Section 4.1",
        },
        {
          sourceType: "PROJECT_MEMORY",
          label: "Prior reviewer note",
          locator: "Run baseline / comment 02",
        },
      ],
      reviewerDecision: null,
      updatedAt: new Date(now.getTime() - 1000 * 60 * 14),
    },
    {
      id: "finding-device-description",
      projectId,
      title: "Device description is present but version alignment is partial",
      summary:
        "The technical summary and validation outline describe the same device family, but their revision identifiers require reconciliation.",
      status: "PARTIALLY_SUPPORTED",
      confidence: "HIGH",
      provenance: [
        {
          sourceType: "PROJECT_DOCUMENT",
          label: "Technical summary",
          locator: "Page 8",
        },
        {
          sourceType: "PROJECT_DOCUMENT",
          label: "Validation outline",
          locator: "Page 3",
        },
      ],
      reviewerDecision: null,
      updatedAt: new Date(now.getTime() - 1000 * 60 * 60),
    },
    {
      id: "finding-performance-evidence",
      projectId,
      title: "Performance evidence is not assessable from submitted material",
      summary:
        "No performance evidence packet was available in this run. The system is intentionally not inferring a conclusion.",
      status: "NOT_ASSESSABLE",
      confidence: "HIGH",
      provenance: [
        {
          sourceType: "PROJECT_DOCUMENT",
          label: "Submission inventory",
          locator: "Missing item register",
        },
      ],
      reviewerDecision: null,
      updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 4),
    },
  ]);

  await db.insert(reviewItemsTable).values([
    {
      id: "review-item-endpoint",
      projectId,
      title: "Confirm the intended clinical endpoint",
      reason:
        "The available project context does not establish whether the endpoint is applicable to this assessment.",
      priority: "HIGH",
      createdAt: new Date(now.getTime() - 1000 * 60 * 14),
    },
    {
      id: "review-item-revision",
      projectId,
      title: "Resolve document revision mismatch",
      reason:
        "Two project documents describe the device with different revision identifiers.",
      priority: "MEDIUM",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60),
    },
  ]);

  await db.insert(reportsTable).values({
    id: "report-arcadia-draft",
    projectId,
    title: "Arcadia Dx preliminary readiness report",
    status: "HUMAN_REVIEW",
    generatedAt: new Date(now.getTime() - 1000 * 60 * 6),
    findingCount: "3",
  });

  await db.insert(auditEventsTable).values([
    {
      id: "audit-project-created",
      projectId,
      eventType: "PROJECT_CREATED",
      actor: "Workspace user",
      description: "Created the fictional Arcadia Dx project workspace",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 9),
    },
    {
      id: "audit-documents-analyzed",
      projectId,
      eventType: "DOCUMENTS_ANALYZED",
      actor: "Document Intelligence Agent",
      description: "Analyzed 3 submitted project documents and preserved section anchors",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 20),
    },
    {
      id: "audit-evidence-retrieved",
      projectId,
      eventType: "EVIDENCE_RETRIEVED",
      actor: "Regulatory Evidence Agent",
      description: "Retrieved 6 source-backed evidence packets from the curated corpus",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 12),
    },
    {
      id: "audit-gaps-identified",
      projectId,
      eventType: "GAPS_IDENTIFIED",
      actor: "Gap Analysis Agent",
      description: "Created 3 traceable findings, including one not-assessable item",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 4),
    },
    {
      id: "audit-human-review",
      projectId,
      eventType: "HUMAN_REVIEW",
      actor: "Supervisor",
      description: "Paused the workflow at the qualified human review gate",
      createdAt: new Date(now.getTime() - 1000 * 60 * 8),
    },
  ]);

  logger.info({ projectId }, "Seeded LifeSci Nexus demo workspace");
}