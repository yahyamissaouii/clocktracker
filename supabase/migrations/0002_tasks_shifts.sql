-- ClockTrack task time tracking and admin-approved custom shifts.
-- Apply with `npm run db:push` or run this migration in Supabase SQL editor.

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('open', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS work_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  description text,
  status task_status NOT NULL DEFAULT 'open',
  total_minutes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL REFERENCES users(id),
  work_session_id uuid REFERENCES work_sessions(id),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_minutes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_edit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  task_id uuid NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES users(id),
  requested_title text NOT NULL,
  requested_description text,
  status approval_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shift_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL REFERENCES users(id),
  shift_date date NOT NULL,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  break_minutes integer NOT NULL DEFAULT 0,
  notes text,
  status approval_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_tasks_employee_idx ON work_tasks (organization_id, employee_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS task_time_entries_open_idx ON task_time_entries (task_id, employee_id, ended_at);
CREATE INDEX IF NOT EXISTS task_edit_requests_pending_idx ON task_edit_requests (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS shift_requests_pending_idx ON shift_requests (organization_id, status, created_at DESC);
