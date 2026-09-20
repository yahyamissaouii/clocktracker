import { pgTable, pgSchema, uuid, text, timestamp, numeric, integer, pgEnum, jsonb, unique, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Reference to Supabase auth.users
export const authSchema = pgSchema('auth');
export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
});

// Enums
export const memberRoleEnum = pgEnum('member_role', ['employee', 'manager', 'admin']);
export const memberStatusEnum = pgEnum('member_status', ['active', 'inactive', 'invited']);
export const sessionStatusEnum = pgEnum('session_status', ['active', 'completed', 'missing_clock_out']);
export const sessionSourceEnum = pgEnum('session_source', ['clock', 'manual', 'correction']);
export const correctionStatusEnum = pgEnum('correction_status', ['pending', 'approved', 'rejected']);
export const taskStatusEnum = pgEnum('task_status', ['open', 'in_progress', 'completed']);
export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'rejected']);

// 1. organizations
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  defaultTimezone: text('default_timezone').default('Europe/Berlin'),
  defaultWeeklyHours: numeric('default_weekly_hours').default('40'),
  timesheetFooter: text('timesheet_footer'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. organizationMembers
export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  role: memberRoleEnum('role').default('employee'),
  status: memberStatusEnum('status').default('active'),
  weeklyTargetHours: numeric('weekly_target_hours').default('40'),
  startDate: date('start_date'),
  department: text('department'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  unq: unique().on(t.organizationId, t.userId),
}));

// 4. workSessions
export const workSessions = pgTable('work_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  employeeId: uuid('employee_id').references(() => users.id).notNull(),
  clockInAt: timestamp('clock_in_at', { withTimezone: true }).notNull(),
  clockOutAt: timestamp('clock_out_at', { withTimezone: true }),
  status: sessionStatusEnum('status').default('active'),
  note: text('note'),
  source: sessionSourceEnum('source').default('clock'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 5. breaks
export const breaks = pgTable('breaks', {
  id: uuid('id').primaryKey().defaultRandom(),
  workSessionId: uuid('work_session_id').references(() => workSessions.id).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 6. correctionRequests
export const correctionRequests = pgTable('correction_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  employeeId: uuid('employee_id').references(() => users.id).notNull(),
  workSessionId: uuid('work_session_id').references(() => workSessions.id).notNull(),
  requestedClockIn: timestamp('requested_clock_in', { withTimezone: true }),
  requestedClockOut: timestamp('requested_clock_out', { withTimezone: true }),
  requestedNote: text('requested_note'),
  reason: text('reason').notNull(),
  status: correctionStatusEnum('status').default('pending'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewerNote: text('reviewer_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 7. auditLogs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  actorId: uuid('actor_id').references(() => users.id).notNull(),
  affectedEmployeeId: uuid('affected_employee_id').references(() => users.id),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  action: text('action').notNull(),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 8. workTasks
// A task belongs to the employee who created it. Time is recorded in taskTimeEntries
// so an employee can pause/resume tracking without losing the original work session.
export const workTasks = pgTable('work_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  employeeId: uuid('employee_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: taskStatusEnum('status').default('open').notNull(),
  totalMinutes: integer('total_minutes').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 9. taskTimeEntries
export const taskTimeEntries = pgTable('task_time_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => workTasks.id, { onDelete: 'cascade' }).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  employeeId: uuid('employee_id').references(() => users.id).notNull(),
  workSessionId: uuid('work_session_id').references(() => workSessions.id),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationMinutes: integer('duration_minutes').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 10. taskEditRequests
export const taskEditRequests = pgTable('task_edit_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  taskId: uuid('task_id').references(() => workTasks.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => users.id).notNull(),
  requestedTitle: text('requested_title').notNull(),
  requestedDescription: text('requested_description'),
  status: approvalStatusEnum('status').default('pending').notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewerNote: text('reviewer_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 11. shiftRequests
// Approved requests are the employee's custom shift records. Keeping them as
// requests makes the approval history auditable and avoids silently changing hours.
export const shiftRequests = pgTable('shift_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  employeeId: uuid('employee_id').references(() => users.id).notNull(),
  shiftDate: date('shift_date').notNull(),
  title: text('title').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  breakMinutes: integer('break_minutes').default(0).notNull(),
  notes: text('notes'),
  status: approvalStatusEnum('status').default('pending').notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewerNote: text('reviewer_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  workSessions: many(workSessions),
  correctionRequests: many(correctionRequests),
  auditLogs: many(auditLogs),
  workTasks: many(workTasks),
  taskTimeEntries: many(taskTimeEntries),
  taskEditRequests: many(taskEditRequests, { relationName: 'task_edit_employee' }),
  reviewedTaskEdits: many(taskEditRequests, { relationName: 'task_edit_reviewer' }),
  shiftRequests: many(shiftRequests, { relationName: 'shift_employee' }),
  reviewedShiftRequests: many(shiftRequests, { relationName: 'shift_reviewer' }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
  workSessions: many(workSessions),
  correctionRequests: many(correctionRequests, { relationName: 'employee' }),
  reviewedCorrections: many(correctionRequests, { relationName: 'reviewer' }),
  actionsAsActor: many(auditLogs, { relationName: 'actor' }),
  actionsAsAffected: many(auditLogs, { relationName: 'affectedEmployee' }),
  workTasks: many(workTasks),
  taskTimeEntries: many(taskTimeEntries),
  taskEditRequests: many(taskEditRequests),
  shiftRequests: many(shiftRequests),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const workSessionsRelations = relations(workSessions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workSessions.organizationId],
    references: [organizations.id],
  }),
  employee: one(users, {
    fields: [workSessions.employeeId],
    references: [users.id],
  }),
  breaks: many(breaks),
  correctionRequests: many(correctionRequests),
  taskTimeEntries: many(taskTimeEntries),
}));

export const breaksRelations = relations(breaks, ({ one }) => ({
  workSession: one(workSessions, {
    fields: [breaks.workSessionId],
    references: [workSessions.id],
  }),
}));

export const correctionRequestsRelations = relations(correctionRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [correctionRequests.organizationId],
    references: [organizations.id],
  }),
  employee: one(users, {
    fields: [correctionRequests.employeeId],
    references: [users.id],
    relationName: 'employee',
  }),
  workSession: one(workSessions, {
    fields: [correctionRequests.workSessionId],
    references: [workSessions.id],
  }),
  reviewer: one(users, {
    fields: [correctionRequests.reviewedBy],
    references: [users.id],
    relationName: 'reviewer',
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
    relationName: 'actor',
  }),
  affectedEmployee: one(users, {
    fields: [auditLogs.affectedEmployeeId],
    references: [users.id],
    relationName: 'affectedEmployee',
  }),
}));

export const workTasksRelations = relations(workTasks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workTasks.organizationId],
    references: [organizations.id],
  }),
  employee: one(users, {
    fields: [workTasks.employeeId],
    references: [users.id],
  }),
  timeEntries: many(taskTimeEntries),
  editRequests: many(taskEditRequests),
}));

export const taskTimeEntriesRelations = relations(taskTimeEntries, ({ one }) => ({
  task: one(workTasks, {
    fields: [taskTimeEntries.taskId],
    references: [workTasks.id],
  }),
  organization: one(organizations, {
    fields: [taskTimeEntries.organizationId],
    references: [organizations.id],
  }),
  employee: one(users, {
    fields: [taskTimeEntries.employeeId],
    references: [users.id],
  }),
  workSession: one(workSessions, {
    fields: [taskTimeEntries.workSessionId],
    references: [workSessions.id],
  }),
}));

export const taskEditRequestsRelations = relations(taskEditRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [taskEditRequests.organizationId],
    references: [organizations.id],
  }),
  task: one(workTasks, {
    fields: [taskEditRequests.taskId],
    references: [workTasks.id],
  }),
  employee: one(users, {
    fields: [taskEditRequests.employeeId],
    references: [users.id],
    relationName: 'task_edit_employee',
  }),
  reviewer: one(users, {
    fields: [taskEditRequests.reviewedBy],
    references: [users.id],
    relationName: 'task_edit_reviewer',
  }),
}));

export const shiftRequestsRelations = relations(shiftRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [shiftRequests.organizationId],
    references: [organizations.id],
  }),
  employee: one(users, {
    fields: [shiftRequests.employeeId],
    references: [users.id],
    relationName: 'shift_employee',
  }),
  reviewer: one(users, {
    fields: [shiftRequests.reviewedBy],
    references: [users.id],
    relationName: 'shift_reviewer',
  }),
}));

// Types
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;

export type WorkSession = typeof workSessions.$inferSelect;
export type NewWorkSession = typeof workSessions.$inferInsert;

export type Break = typeof breaks.$inferSelect;
export type NewBreak = typeof breaks.$inferInsert;

export type CorrectionRequest = typeof correctionRequests.$inferSelect;
export type NewCorrectionRequest = typeof correctionRequests.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type WorkTask = typeof workTasks.$inferSelect;
export type NewWorkTask = typeof workTasks.$inferInsert;
export type TaskTimeEntry = typeof taskTimeEntries.$inferSelect;
export type NewTaskTimeEntry = typeof taskTimeEntries.$inferInsert;
export type TaskEditRequest = typeof taskEditRequests.$inferSelect;
export type NewTaskEditRequest = typeof taskEditRequests.$inferInsert;
export type ShiftRequest = typeof shiftRequests.$inferSelect;
export type NewShiftRequest = typeof shiftRequests.$inferInsert;
