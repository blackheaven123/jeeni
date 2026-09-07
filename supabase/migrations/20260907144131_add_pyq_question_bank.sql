/*
# PYQ Question Bank & App Settings

Adds tables for a curated PYQ (Previous Year Question) bank sourced from
JEE Main, JEE Advanced, and NEET forums, plus user app settings.

## Tables
1. `pyq_questions` — curated PYQ questions with exam source, year, subject, chapter, difficulty, and MCQ options
2. `pyq_sessions` — a user's PYQ practice session: selected filters, questions answered, score
3. `app_settings` — simple key-value settings for the app (e.g. active exam track)

## Security
- RLS enabled on all tables.
- All tables allow anon + authenticated full CRUD (single-tenant, no auth).
*/

-- PYQ Questions
CREATE TABLE IF NOT EXISTS pyq_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam text NOT NULL CHECK (exam IN ('JEE Main', 'JEE Advanced', 'NEET')),
  year integer NOT NULL,
  subject text NOT NULL CHECK (subject IN ('Physics', 'Chemistry', 'Mathematics', 'Biology')),
  chapter text NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  question_text text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  correct_answer text NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  explanation text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- PYQ Sessions (user practice)
CREATE TABLE IF NOT EXISTS pyq_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_filter text[] DEFAULT '{}',
  subject_filter text[] DEFAULT '{}',
  chapter_filter text[] DEFAULT '{}',
  difficulty_filter text[] DEFAULT '{}',
  source text NOT NULL DEFAULT 'bank' CHECK (source IN ('bank', 'error_based')),
  question_count integer NOT NULL DEFAULT 20,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  score integer,
  question_ids uuid[] DEFAULT '{}',
  user_answers jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- App Settings (key-value)
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pyq_exam ON pyq_questions(exam);
CREATE INDEX IF NOT EXISTS idx_pyq_subject ON pyq_questions(subject);
CREATE INDEX IF NOT EXISTS idx_pyq_chapter ON pyq_questions(chapter);
CREATE INDEX IF NOT EXISTS idx_pyq_difficulty ON pyq_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_pyq_year ON pyq_questions(year);

-- RLS: pyq_questions
ALTER TABLE pyq_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_pyq_questions" ON pyq_questions;
CREATE POLICY "anon_select_pyq_questions" ON pyq_questions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_pyq_questions" ON pyq_questions;
CREATE POLICY "anon_insert_pyq_questions" ON pyq_questions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_pyq_questions" ON pyq_questions;
CREATE POLICY "anon_update_pyq_questions" ON pyq_questions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_pyq_questions" ON pyq_questions;
CREATE POLICY "anon_delete_pyq_questions" ON pyq_questions FOR DELETE TO anon, authenticated USING (true);

-- RLS: pyq_sessions
ALTER TABLE pyq_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_pyq_sessions" ON pyq_sessions;
CREATE POLICY "anon_select_pyq_sessions" ON pyq_sessions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_pyq_sessions" ON pyq_sessions;
CREATE POLICY "anon_insert_pyq_sessions" ON pyq_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_pyq_sessions" ON pyq_sessions;
CREATE POLICY "anon_update_pyq_sessions" ON pyq_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_pyq_sessions" ON pyq_sessions;
CREATE POLICY "anon_delete_pyq_sessions" ON pyq_sessions FOR DELETE TO anon, authenticated USING (true);

-- RLS: app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_app_settings" ON app_settings;
CREATE POLICY "anon_select_app_settings" ON app_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_app_settings" ON app_settings;
CREATE POLICY "anon_insert_app_settings" ON app_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_app_settings" ON app_settings;
CREATE POLICY "anon_update_app_settings" ON app_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_app_settings" ON app_settings;
CREATE POLICY "anon_delete_app_settings" ON app_settings FOR DELETE TO anon, authenticated USING (true);