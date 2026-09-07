/*
# Mistake Tracker Schema — Single-tenant (no auth)

This app is a personal study tool for a student preparing for mock tests.
No sign-in screen, so all policies use `TO anon, authenticated` and data
is intentionally shared/public within the app.

## Tables
1. `subjects` — e.g. Physics, Chemistry, Maths
2. `chapters` — chapters under each subject (e.g. Rotational Motion)
3. `mistakes` — a logged mistake: photo URL, subject, chapter, mistake type, notes, created_at
4. `quiz_questions` — generated quiz questions tied to a chapter/mistake type
5. `quizzes` — a generated quiz session (collection of questions)

## Mistake Types
Enforced via CHECK constraint: 'Silly Calculation', 'Formula Gap', 'Conceptual Flaw', 'Ran Out of Time'

## Security
- RLS enabled on all tables.
- All tables allow anon + authenticated full CRUD (single-tenant, no auth).
*/

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#3B82F6',
  icon text NOT NULL DEFAULT 'BookOpen',
  created_at timestamptz DEFAULT now()
);

-- Chapters
CREATE TABLE IF NOT EXISTS chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(subject_id, name)
);

-- Mistakes
CREATE TABLE IF NOT EXISTS mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url text,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  mistake_type text NOT NULL CHECK (
    mistake_type IN ('Silly Calculation', 'Formula Gap', 'Conceptual Flaw', 'Ran Out of Time')
  ),
  question_text text,
  notes text,
  status text NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'reviewed', 'mastered')),
  created_at timestamptz DEFAULT now()
);

-- Quizzes (a generated quiz session)
CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subject_filter text[],
  chapter_filter uuid[],
  mistake_type_filter text[],
  question_count integer NOT NULL DEFAULT 20,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  score integer,
  created_at timestamptz DEFAULT now()
);

-- Quiz Questions (questions within a quiz)
CREATE TABLE IF NOT EXISTS quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_answer text NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  explanation text,
  chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL,
  mistake_type text,
  user_answer text CHECK (user_answer IS NULL OR user_answer IN ('A', 'B', 'C', 'D')),
  is_correct boolean,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chapters_subject ON chapters(subject_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_subject ON mistakes(subject_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_chapter ON mistakes(chapter_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_type ON mistakes(mistake_type);
CREATE INDEX IF NOT EXISTS idx_mistakes_created ON mistakes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);

-- RLS: subjects
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_subjects" ON subjects;
CREATE POLICY "anon_select_subjects" ON subjects FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_subjects" ON subjects;
CREATE POLICY "anon_insert_subjects" ON subjects FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_subjects" ON subjects;
CREATE POLICY "anon_update_subjects" ON subjects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_subjects" ON subjects;
CREATE POLICY "anon_delete_subjects" ON subjects FOR DELETE TO anon, authenticated USING (true);

-- RLS: chapters
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_chapters" ON chapters;
CREATE POLICY "anon_select_chapters" ON chapters FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_chapters" ON chapters;
CREATE POLICY "anon_insert_chapters" ON chapters FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_chapters" ON chapters;
CREATE POLICY "anon_update_chapters" ON chapters FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_chapters" ON chapters;
CREATE POLICY "anon_delete_chapters" ON chapters FOR DELETE TO anon, authenticated USING (true);

-- RLS: mistakes
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_mistakes" ON mistakes;
CREATE POLICY "anon_select_mistakes" ON mistakes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_mistakes" ON mistakes;
CREATE POLICY "anon_insert_mistakes" ON mistakes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_mistakes" ON mistakes;
CREATE POLICY "anon_update_mistakes" ON mistakes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_mistakes" ON mistakes;
CREATE POLICY "anon_delete_mistakes" ON mistakes FOR DELETE TO anon, authenticated USING (true);

-- RLS: quizzes
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_quizzes" ON quizzes;
CREATE POLICY "anon_select_quizzes" ON quizzes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_quizzes" ON quizzes;
CREATE POLICY "anon_insert_quizzes" ON quizzes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_quizzes" ON quizzes;
CREATE POLICY "anon_update_quizzes" ON quizzes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_quizzes" ON quizzes;
CREATE POLICY "anon_delete_quizzes" ON quizzes FOR DELETE TO anon, authenticated USING (true);

-- RLS: quiz_questions
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_quiz_questions" ON quiz_questions;
CREATE POLICY "anon_select_quiz_questions" ON quiz_questions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_quiz_questions" ON quiz_questions;
CREATE POLICY "anon_insert_quiz_questions" ON quiz_questions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_quiz_questions" ON quiz_questions;
CREATE POLICY "anon_update_quiz_questions" ON quiz_questions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_quiz_questions" ON quiz_questions;
CREATE POLICY "anon_delete_quiz_questions" ON quiz_questions FOR DELETE TO anon, authenticated USING (true);