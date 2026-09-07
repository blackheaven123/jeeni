import { MistakeType } from './supabase';

interface GenerateQuestionParams {
  chapterName: string;
  subjectName: string;
  mistakeType: MistakeType;
}

const QUESTION_TEMPLATES: Record<MistakeType, string[]> = {
  'Silly Calculation': [
    'A body of mass 2 kg moves with velocity {v}. Calculate the kinetic energy. Watch the unit conversion.',
    'Solve for x: 3x² + 7x - 6 = 0. Be careful with signs in the quadratic formula.',
    'Calculate the magnitude of the vector (3, -4, 12). Double-check each squared term.',
    'Find the value of log₂(512) + log₃(27). Ensure correct base identification.',
  ],
  'Formula Gap': [
    'State the formula for rotational kinetic energy and derive it for a solid sphere of radius r.',
    'Write the Nernst equation and calculate E_cell for the given concentrations.',
    'Derive the expression for the time period of a simple pendulum using energy conservation.',
    'State the lens maker\'s formula and apply it to a biconvex lens with R₁ = 20 cm, R₂ = -20 cm.',
  ],
  'Conceptual Flaw': [
    'Explain why a satellite in orbit is weightless despite being under gravitational force.',
    'Why does increasing temperature not always increase the rate of an exothermic reaction?',
    'A charged particle moves parallel to a magnetic field. Describe the force on it and why.',
    'Two identical springs are connected in series vs parallel. Compare effective spring constants.',
  ],
  'Ran Out of Time': [
    'Within 90 seconds: solve the integral ∫(2x + 3)² dx and evaluate from 0 to 1.',
    'In 60 seconds: balance the redox reaction MnO₄⁻ + Fe²⁺ → Mn²⁺ + Fe³⁺ in acidic medium.',
    'Quick: find the determinant of the 3×3 matrix [[1,2,3],[4,5,6],[7,8,10]].',
    'Rapid: calculate the pH of a 0.01 M HCl solution and a 0.01 M CH₃COOH (Ka = 1.8×10⁻⁵).',
  ],
};

const OPTION_SETS: Record<string, { a: string; b: string; c: string; d: string; correct: 'A' | 'B' | 'C' | 'D'; explanation: string }[]> = {
  default: [
    {
      a: 'Option A — common misreading of the problem',
      b: 'Option B — correct application of the concept',
      c: 'Option C — sign error in intermediate step',
      d: 'Option D — used wrong formula entirely',
      correct: 'B',
      explanation: 'The correct approach applies the definition directly without skipping steps. Option A misreads the problem, C has a sign error, D uses the wrong formula.',
    },
    {
      a: 'Option A — applies the standard formula correctly',
      b: 'Option B — forgot to square the radius',
      c: 'Option C — mixed up sin and cos',
      d: 'Option D — unit conversion error',
      correct: 'A',
      explanation: 'Standard formula application is correct. B forgets r², C confuses trig functions, D has a conversion mistake.',
    },
    {
      a: 'Option A — neglects friction force',
      b: 'Option B — correct free-body analysis',
      c: 'Option C — wrong direction of normal force',
      d: 'Option D — ignores mass distribution',
      correct: 'B',
      explanation: 'Proper free-body analysis accounts for all forces. A neglects friction, C has wrong normal direction, D ignores mass distribution.',
    },
  ],
};

export function generateQuizQuestion(params: GenerateQuestionParams) {
  const { chapterName, subjectName, mistakeType } = params;
  const templates = QUESTION_TEMPLATES[mistakeType];
  const template = templates[Math.floor(Math.random() * templates.length)];
  const optionSet = OPTION_SETS.default[Math.floor(Math.random() * OPTION_SETS.default.length)];

  const questionText = `[${subjectName} → ${chapterName}] ${template}`;

  return {
    question_text: questionText,
    option_a: optionSet.a,
    option_b: optionSet.b,
    option_c: optionSet.c,
    option_d: optionSet.d,
    correct_answer: optionSet.correct,
    explanation: optionSet.explanation,
    mistake_type: mistakeType,
  };
}

export function generateQuizQuestions(
  mistakes: { chapter?: { name: string }; subject?: { name: string }; mistake_type: MistakeType }[],
  count: number
) {
  if (mistakes.length === 0) return [];

  const questions: ReturnType<typeof generateQuizQuestion>[] = [];
  const seen = new Set<string>();

  let attempts = 0;
  while (questions.length < count && attempts < count * 10) {
    const mistake = mistakes[Math.floor(Math.random() * mistakes.length)];
    if (!mistake.chapter || !mistake.subject) {
      attempts++;
      continue;
    }
    const q = generateQuizQuestion({
      chapterName: mistake.chapter.name,
      subjectName: mistake.subject.name,
      mistakeType: mistake.mistake_type,
    });
    const key = q.question_text;
    if (!seen.has(key)) {
      seen.add(key);
      questions.push(q);
    }
    attempts++;
  }

  return questions;
}
