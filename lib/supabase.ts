import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export type MistakeType = 'Silly Calculation' | 'Formula Gap' | 'Conceptual Flaw' | 'Ran Out of Time';
export type MistakeStatus = 'unresolved' | 'reviewed' | 'mastered';

export interface Subject {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface Chapter {
  id: string;
  subject_id: string;
  name: string;
}

export interface Mistake {
  id: string;
  photo_url: string | null;
  subject_id: string;
  chapter_id: string;
  mistake_type: MistakeType;
  question_text: string | null;
  notes: string | null;
  status: MistakeStatus;
  created_at: string;
  subject?: Subject;
  chapter?: Chapter;
}

export interface Quiz {
  id: string;
  title: string;
  subject_filter: string[] | null;
  chapter_filter: string[] | null;
  mistake_type_filter: string[] | null;
  question_count: number;
  status: 'pending' | 'in_progress' | 'completed';
  score: number | null;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation: string | null;
  chapter_id: string | null;
  mistake_type: string | null;
  user_answer: 'A' | 'B' | 'C' | 'D' | null;
  is_correct: boolean | null;
}

export type ExamType = 'JEE Main' | 'JEE Advanced' | 'NEET';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type ExamTrack = 'JEE' | 'NEET';

export interface PYQQuestion {
  id: string;
  exam: ExamType;
  year: number;
  subject: string;
  chapter: string;
  difficulty: Difficulty;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation: string | null;
  tags: string[];
}

export interface PYQSession {
  id: string;
  exam_filter: string[];
  subject_filter: string[];
  chapter_filter: string[];
  difficulty_filter: string[];
  source: 'bank' | 'error_based';
  question_count: number;
  status: 'in_progress' | 'completed';
  score: number | null;
  question_ids: string[];
  user_answers: Record<string, 'A' | 'B' | 'C' | 'D'>;
  created_at: string;
}

export const MISTAKE_TYPES: { label: MistakeType; color: string; icon: string }[] = [
  { label: 'Silly Calculation', color: '#F59E0B', icon: 'Calculator' },
  { label: 'Formula Gap', color: '#EF4444', icon: 'FileQuestion' },
  { label: 'Conceptual Flaw', color: '#8B5CF6', icon: 'Brain' },
  { label: 'Ran Out of Time', color: '#3B82F6', icon: 'Clock' },
];

export const EXAM_OPTIONS: { label: ExamType; track: ExamTrack; color: string }[] = [
  { label: 'JEE Main', track: 'JEE', color: '#3B82F6' },
  { label: 'JEE Advanced', track: 'JEE', color: '#8B5CF6' },
  { label: 'NEET', track: 'NEET', color: '#10B981' },
];

export const DIFFICULTY_OPTIONS: { label: Difficulty; color: string }[] = [
  { label: 'Easy', color: '#10B981' },
  { label: 'Medium', color: '#F59E0B' },
  { label: 'Hard', color: '#EF4444' },
];
