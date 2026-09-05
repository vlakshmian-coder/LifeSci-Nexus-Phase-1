import { createInsertSchema } from "drizzle-zod";
import {
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const projectsTable = pgTable("lifesci_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  productName: text("product_name").notNull(),
  intendedUse: text("intended_use").notNull(),
  projectPhase: text("project_phase").notNull(),
  assessmentFramework: text("assessment_framework").notNull(),
  jurisdictionContext: text("jurisdiction_context"),
  scopeNotes: text("scope_notes"),
  workflowState: text("workflow_state").notNull().default("CREATED"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const runsTable = pgTable("lifesci_runs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  state: text("state").notNull().default("CREATED"),
  label: text("label").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const findingsTable = pgTable("lifesci_findings", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  status: text("status").notNull(),
  confidence: text("confidence").notNull(),
  provenance: jsonb("provenance").$type<
    Array<{
      sourceType:
        | "EXTERNAL_EVIDENCE"
        | "PROJECT_MEMORY"
        | "PROJECT_DOCUMENT"
        | "HUMAN_DECISION";
      label: string;
      locator?: string | null;
    }>
  >().notNull(),
  reviewerDecision: text("reviewer_decision"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const reviewItemsTable = pgTable("lifesci_review_items", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  reason: text("reason").notNull(),
  priority: text("priority").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const reportsTable = pgTable("lifesci_reports", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  findingCount: text("finding_count").notNull().default("0"),
});

export const auditEventsTable = pgTable("lifesci_audit_events", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  actor: text("actor").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const memoryRecordsTable = pgTable("lifesci_memory_records", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  memoryType: text("memory_type").notNull(),
  content: jsonb("content").$type<Record<string, unknown>>().notNull(),
  source: text("source").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  confidence: text("confidence"),
  version: text("version").notNull().default("1"),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertRunSchema = createInsertSchema(runsTable).omit({
  startedAt: true,
  updatedAt: true,
});
export const insertFindingSchema = createInsertSchema(findingsTable).omit({
  updatedAt: true,
});
export const insertReviewItemSchema = createInsertSchema(reviewItemsTable).omit({
  createdAt: true,
});
export const insertReportSchema = createInsertSchema(reportsTable).omit({
  generatedAt: true,
});
export const insertAuditEventSchema = createInsertSchema(auditEventsTable).omit({
  createdAt: true,
});
export const insertMemoryRecordSchema = createInsertSchema(memoryRecordsTable).omit({
  createdAt: true,
  supersededAt: true,
});

export type Project = typeof projectsTable.$inferSelect;
export type Run = typeof runsTable.$inferSelect;
export type Finding = typeof findingsTable.$inferSelect;
export type ReviewItem = typeof reviewItemsTable.$inferSelect;
export type Report = typeof reportsTable.$inferSelect;
export type AuditEvent = typeof auditEventsTable.$inferSelect;
export type MemoryRecord = typeof memoryRecordsTable.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertRun = z.infer<typeof insertRunSchema>;
export type InsertFinding = z.infer<typeof insertFindingSchema>;
export type InsertReviewItem = z.infer<typeof insertReviewItemSchema>;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type InsertMemoryRecord = z.infer<typeof insertMemoryRecordSchema>;