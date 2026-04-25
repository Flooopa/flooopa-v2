-- ============================================================
-- Wave 10 Migration: Multi-AI Orchestrator Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Workspaces & Members
-- ============================================================
CREATE TABLE workspace_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'dev', 'viewer')),
  email text,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_read_own"
  ON workspace_members FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "owners_can_manage_members"
  ON workspace_members FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()::text AND role = 'owner'
    )
  );

-- ============================================================
-- 2. Todos
-- ============================================================
CREATE TABLE todos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('TODO', 'FIXME')),
  text text NOT NULL,
  file text DEFAULT '',
  line integer,
  assignee text DEFAULT '',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'active', 'resolved')),
  "order" integer NOT NULL DEFAULT 0,
  source text DEFAULT 'manual',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- RLS: all workspace members can read
CREATE POLICY "workspace_members_can_read_todos"
  ON todos FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()::text
  ));

-- RLS: dev+ can write
CREATE POLICY "workspace_members_can_write_todos"
  ON todos FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()::text AND role IN ('owner', 'dev')
  ));

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. Feed Posts
-- ============================================================
CREATE TABLE feed_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  author text NOT NULL,
  author_id text,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'manual'
    CHECK (type IN ('manual', 'todo_detected', 'fixme_resolved', 'planning_done', 'ai_event')),
  metadata jsonb DEFAULT '{}',
  reactions jsonb DEFAULT '{}',
  replies jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_can_read_feed"
  ON feed_posts FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "workspace_members_can_write_feed"
  ON feed_posts FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()::text AND role IN ('owner', 'dev')
  ));

CREATE POLICY "workspace_members_can_update_own_feed"
  ON feed_posts FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()::text AND role IN ('owner', 'dev')
  ));

-- ============================================================
-- 4. Memory — Global
-- ============================================================
CREATE TABLE memory_global (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  preferences text[] DEFAULT '{}',
  coding_style text,
  active_systems text[] DEFAULT '{}',
  always_inject text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE memory_global ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_own_global_memory"
  ON memory_global FOR ALL
  USING (user_id = auth.uid()::text);

-- ============================================================
-- 5. Memory — Projects
-- ============================================================
CREATE TABLE memory_projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  game_name text,
  language text,
  stack text,
  decisions jsonb DEFAULT '[]',
  known_bugs jsonb DEFAULT '[]',
  architecture jsonb DEFAULT '[]',
  service_structure text[] DEFAULT '{}',
  remote_names text[] DEFAULT '{}',
  coding_style_prefs text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE memory_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_can_read_projects"
  ON memory_projects FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "workspace_members_can_write_projects"
  ON memory_projects FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()::text AND role IN ('owner', 'dev')
  ));

CREATE TRIGGER update_memory_projects_updated_at
  BEFORE UPDATE ON memory_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. Public Views
-- ============================================================
CREATE TABLE public_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL UNIQUE,
  game_version text DEFAULT '1.0.0',
  roadmap jsonb DEFAULT '[]',
  patch_notes jsonb DEFAULT '[]',
  known_issues jsonb DEFAULT '[]',
  is_public boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public_views ENABLE ROW LEVEL SECURITY;

-- Anyone can read public views
CREATE POLICY "public_views_are_public"
  ON public_views FOR SELECT
  USING (is_public = true);

-- Only owners can update
CREATE POLICY "owners_can_update_public_views"
  ON public_views FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()::text AND role = 'owner'
  ));

-- ============================================================
-- 7. Auto Mode State (per workspace)
-- ============================================================
CREATE TABLE workspace_states (
  workspace_id uuid PRIMARY KEY,
  auto_mode boolean DEFAULT false,
  active_todo_id uuid REFERENCES todos(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workspace_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_can_read_state"
  ON workspace_states FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "workspace_owners_can_write_state"
  ON workspace_states FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()::text AND role = 'owner'
  ));

-- ============================================================
-- 8. Realtime Publication
-- ============================================================
-- Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE todos;
ALTER PUBLICATION supabase_realtime ADD TABLE feed_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE workspace_states;

-- ============================================================
-- 9. Helper Functions
-- ============================================================

-- Function to get workspace stats
CREATE OR REPLACE FUNCTION get_workspace_todo_stats(p_workspace_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'open', COUNT(*) FILTER (WHERE status = 'open'),
    'active', COUNT(*) FILTER (WHERE status = 'active'),
    'resolved', COUNT(*) FILTER (WHERE status = 'resolved'),
    'fixme', COUNT(*) FILTER (WHERE type = 'FIXME'),
    'todo', COUNT(*) FILTER (WHERE type = 'TODO')
  )
  INTO result
  FROM todos
  WHERE workspace_id = p_workspace_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get public view data (auto-populated)
CREATE OR REPLACE FUNCTION get_public_view(p_workspace_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'version', COALESCE((SELECT game_version FROM public_views WHERE workspace_id = p_workspace_id), '1.0.0'),
    'roadmap', COALESCE((SELECT roadmap FROM public_views WHERE workspace_id = p_workspace_id), '[]'),
    'patchNotes', COALESCE((SELECT patch_notes FROM public_views WHERE workspace_id = p_workspace_id), '[]'),
    'knownIssues', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'text', text,
        'type', type,
        'priority', priority,
        'created_at', created_at
      ))
      FROM todos
      WHERE workspace_id = p_workspace_id AND status != 'resolved'
    ),
    'lastUpdated', now()
  )
  INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
