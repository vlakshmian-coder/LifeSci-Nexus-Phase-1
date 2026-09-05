import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  CreateProjectBody,
  CreateProjectRunBody,
  CreateProjectRunParams,
  CreateProjectRunResponse,
  CreateProjectResponse,
  GetDashboardResponse,
  GetProjectParams,
  GetProjectResponse,
  ListProjectAuditEventsParams,
  ListProjectAuditEventsResponse,
  ListProjectFindingsParams,
  ListProjectFindingsResponse,
  ListProjectReportsParams,
  ListProjectReportsResponse,
  ListProjectRunsParams,
  ListProjectRunsResponse,
  ListProjectsQueryParams,
  ListProjectsResponse,
  ListReviewQueueResponse,
  UpdateProjectBody,
  UpdateProjectParams,
  UpdateProjectResponse,
} from "@workspace/api-zod";
import {
  auditEventsTable,
  db,
  findingsTable,
  projectsTable,
  reportsTable,
  reviewItemsTable,
  runsTable,
} from "@workspace/db";

const router: IRouter = Router();

const getProjectId = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

const toScope = (project: typeof projectsTable.$inferSelect) => ({
  productName: project.productName,
  intendedUse: project.intendedUse,
  projectPhase: project.projectPhase,
  assessmentFramework: project.assessmentFramework,
  jurisdictionContext: project.jurisdictionContext,
  scopeNotes: project.scopeNotes,
});

const toRun = (run: typeof runsTable.$inferSelect) => ({
  id: run.id,
  projectId: run.projectId,
  state: run.state,
  label: run.label,
  startedAt: run.startedAt,
  updatedAt: run.updatedAt,
});

const toFinding = (finding: typeof findingsTable.$inferSelect) => ({
  id: finding.id,
  projectId: finding.projectId,
  title: finding.title,
  summary: finding.summary,
  status: finding.status,
  confidence: finding.confidence,
  provenance: finding.provenance,
  reviewerDecision: finding.reviewerDecision,
  updatedAt: finding.updatedAt,
});

const toReport = (report: typeof reportsTable.$inferSelect) => ({
  id: report.id,
  projectId: report.projectId,
  title: report.title,
  status: report.status,
  generatedAt: report.generatedAt,
  findingCount: Number(report.findingCount),
});

const toAuditEvent = (event: typeof auditEventsTable.$inferSelect) => ({
  id: event.id,
  projectId: event.projectId,
  eventType: event.eventType,
  actor: event.actor,
  description: event.description,
  createdAt: event.createdAt,
});

async function countFindings(projectId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(findingsTable)
    .where(eq(findingsTable.projectId, projectId));
  return Number(result?.count ?? 0);
}

async function toProject(project: typeof projectsTable.$inferSelect) {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    scope: toScope(project),
    workflowState: project.workflowState,
    findingCount: await countFindings(project.id),
    updatedAt: project.updatedAt,
  };
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  const [activeProjects, reviewQueueCount, verifiedFindingCount, recentActivity] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(projectsTable)
        .where(eq(projectsTable.status, "ACTIVE")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviewItemsTable),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(findingsTable)
        .where(eq(findingsTable.status, "SUPPORTED")),
      db
        .select()
        .from(auditEventsTable)
        .orderBy(desc(auditEventsTable.createdAt))
        .limit(6),
    ]);

  res.json(
    GetDashboardResponse.parse({
      activeProjects: Number(activeProjects[0]?.count ?? 0),
      reviewQueueCount: Number(reviewQueueCount[0]?.count ?? 0),
      verifiedFindingCount: Number(verifiedFindingCount[0]?.count ?? 0),
      recentActivity: recentActivity.map(toAuditEvent),
    }),
  );
});

router.get("/projects", async (req, res): Promise<void> => {
  const parsedQuery = ListProjectsQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.message });
    return;
  }

  const projects = await db
    .select()
    .from(projectsTable)
    .where(
      parsedQuery.data.status
        ? eq(projectsTable.status, parsedQuery.data.status)
        : undefined,
    )
    .orderBy(desc(projectsTable.updatedAt));

  res.json(ListProjectsResponse.parse(await Promise.all(projects.map(toProject))));
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date();
  const projectId = crypto.randomUUID();
  const [project] = await db
    .insert(projectsTable)
    .values({
      id: projectId,
      name: parsed.data.name,
      productName: parsed.data.scope.productName,
      intendedUse: parsed.data.scope.intendedUse,
      projectPhase: parsed.data.scope.projectPhase,
      assessmentFramework: parsed.data.scope.assessmentFramework,
      jurisdictionContext: parsed.data.scope.jurisdictionContext ?? null,
      scopeNotes: parsed.data.scope.scopeNotes ?? null,
      status: "ACTIVE",
      workflowState: "SCOPED",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db.insert(auditEventsTable).values({
    id: crypto.randomUUID(),
    projectId,
    eventType: "PROJECT_CREATED",
    actor: "Workspace user",
    description: `Created project ${parsed.data.name}`,
    createdAt: now,
  });

  res.status(201).json(
    CreateProjectResponse.parse(await toProject(project)),
  );
});

router.get("/projects/:projectId", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse({
    projectId: getProjectId(req.params.projectId),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [runs, findings, reports, recentAuditEvents] = await Promise.all([
    db
      .select()
      .from(runsTable)
      .where(eq(runsTable.projectId, project.id))
      .orderBy(desc(runsTable.updatedAt)),
    db
      .select()
      .from(findingsTable)
      .where(eq(findingsTable.projectId, project.id))
      .orderBy(desc(findingsTable.updatedAt)),
    db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.projectId, project.id))
      .orderBy(desc(reportsTable.generatedAt)),
    db
      .select()
      .from(auditEventsTable)
      .where(eq(auditEventsTable.projectId, project.id))
      .orderBy(desc(auditEventsTable.createdAt))
      .limit(10),
  ]);

  res.json(
    GetProjectResponse.parse({
      project: await toProject(project),
      runs: runs.map(toRun),
      findings: findings.map(toFinding),
      reports: reports.map(toReport),
      recentAuditEvents: recentAuditEvents.map(toAuditEvent),
    }),
  );
});

router.patch("/projects/:projectId", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse({
    projectId: getProjectId(req.params.projectId),
  });
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.projectId));
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [project] = await db
    .update(projectsTable)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.status !== undefined
        ? { status: parsed.data.status }
        : {}),
      ...(parsed.data.scope
        ? {
            productName: parsed.data.scope.productName,
            intendedUse: parsed.data.scope.intendedUse,
            projectPhase: parsed.data.scope.projectPhase,
            assessmentFramework: parsed.data.scope.assessmentFramework,
            jurisdictionContext:
              parsed.data.scope.jurisdictionContext ?? null,
            scopeNotes: parsed.data.scope.scopeNotes ?? null,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(projectsTable.id, params.data.projectId))
    .returning();

  await db.insert(auditEventsTable).values({
    id: crypto.randomUUID(),
    projectId: existing.id,
    eventType: "PROJECT_UPDATED",
    actor: "Workspace user",
    description: "Updated project scope or status",
    createdAt: new Date(),
  });

  res.json(UpdateProjectResponse.parse(await toProject(project)));
});

router.get("/projects/:projectId/runs", async (req, res): Promise<void> => {
  const params = ListProjectRunsParams.safeParse({
    projectId: getProjectId(req.params.projectId),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const runs = await db
    .select()
    .from(runsTable)
    .where(eq(runsTable.projectId, params.data.projectId))
    .orderBy(desc(runsTable.updatedAt));
  res.json(ListProjectRunsResponse.parse(runs.map(toRun)));
});

router.post("/projects/:projectId/runs", async (req, res): Promise<void> => {
  const params = CreateProjectRunParams.safeParse({
    projectId: getProjectId(req.params.projectId),
  });
  const parsedBody = CreateProjectRunBody.safeParse(req.body ?? {});
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.projectId));
  if (!project) {
    res.status(409).json({ error: "Project not found" });
    return;
  }

  const now = new Date();
  const [run] = await db
    .insert(runsTable)
    .values({
      id: crypto.randomUUID(),
      projectId: project.id,
      state: "CREATED",
      label: parsedBody.data.label ?? "Readiness review run",
      startedAt: now,
      updatedAt: now,
    })
    .returning();

  await db
    .update(projectsTable)
    .set({ workflowState: "CREATED", updatedAt: now })
    .where(eq(projectsTable.id, project.id));
  await db.insert(auditEventsTable).values({
    id: crypto.randomUUID(),
    projectId: project.id,
    eventType: "RUN_CREATED",
    actor: "Supervisor",
    description: `Created controlled workflow run ${run.label}`,
    createdAt: now,
  });

  res.status(201).json(CreateProjectRunResponse.parse(toRun(run)));
});

router.get("/projects/:projectId/findings", async (req, res): Promise<void> => {
  const params = ListProjectFindingsParams.safeParse({
    projectId: getProjectId(req.params.projectId),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const findings = await db
    .select()
    .from(findingsTable)
    .where(eq(findingsTable.projectId, params.data.projectId))
    .orderBy(desc(findingsTable.updatedAt));
  res.json(ListProjectFindingsResponse.parse(findings.map(toFinding)));
});

router.get("/review-queue", async (_req, res): Promise<void> => {
  const items = await db
    .select()
    .from(reviewItemsTable)
    .orderBy(desc(reviewItemsTable.createdAt));
  res.json(
    ListReviewQueueResponse.parse(
      items.map((item) => ({
        id: item.id,
        projectId: item.projectId,
        title: item.title,
        reason: item.reason,
        priority: item.priority,
        createdAt: item.createdAt,
      })),
    ),
  );
});

router.get("/projects/:projectId/reports", async (req, res): Promise<void> => {
  const params = ListProjectReportsParams.safeParse({
    projectId: getProjectId(req.params.projectId),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const reports = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.projectId, params.data.projectId))
    .orderBy(desc(reportsTable.generatedAt));
  res.json(ListProjectReportsResponse.parse(reports.map(toReport)));
});

router.get(
  "/projects/:projectId/audit-events",
  async (req, res): Promise<void> => {
    const params = ListProjectAuditEventsParams.safeParse({
      projectId: getProjectId(req.params.projectId),
    });
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const events = await db
      .select()
      .from(auditEventsTable)
      .where(eq(auditEventsTable.projectId, params.data.projectId))
      .orderBy(desc(auditEventsTable.createdAt));
    res.json(ListProjectAuditEventsResponse.parse(events.map(toAuditEvent)));
  },
);

export default router;