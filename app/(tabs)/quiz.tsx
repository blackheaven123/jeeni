import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FileQuestion,
  Zap,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Trophy,
  RotateCcw,
  Calendar,
  Layers,
} from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Spacing } from '@/lib/theme';
import {
  supabase,
  Subject,
  Chapter,
  Mistake,
  MistakeType,
  Quiz,
  QuizQuestion,
  MISTAKE_TYPES,
} from '@/lib/supabase';
import { generateQuizQuestions } from '@/lib/quiz-generator';

type ScreenState = 'setup' | 'quiz' | 'results';

export default function QuizScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [allMistakes, setAllMistakes] = useState<Mistake[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [selectedMistakeTypes, setSelectedMistakeTypes] = useState<MistakeType[]>([]);
  const [questionCount, setQuestionCount] = useState(20);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [screenState, setScreenState] = useState<ScreenState>('setup');
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [pastQuizzes, setPastQuizzes] = useState<Quiz[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [subjectsRes, mistakesRes, quizzesRes] = await Promise.all([
      supabase.from('subjects').select('*').order('name'),
      supabase.from('mistakes').select('*, subject:subjects(*), chapter:chapters(*)').order('created_at', { ascending: false }),
      supabase.from('quizzes').select('*').order('created_at', { ascending: false }).limit(5),
    ]);

    if (subjectsRes.data) setSubjects(subjectsRes.data);
    if (mistakesRes.data) {
      setAllMistakes(mistakesRes.data);
      const uniqueChapters = Array.from(
        new Map(mistakesRes.data.map((m) => [m.chapter_id, m.chapter])).values() as IterableIterator<Chapter>
      );
      setChapters(uniqueChapters.filter(Boolean));
    }
    if (quizzesRes.data) setPastQuizzes(quizzesRes.data);
    setLoading(false);
  };

  const toggleChapter = (id: string) => {
    setSelectedChapters((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleMistakeType = (type: MistakeType) => {
    setSelectedMistakeTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleGenerate = async () => {
    if (selectedChapters.length === 0) {
      Alert.alert('Select chapters', 'Pick at least one chapter to generate a quiz from.');
      return;
    }
    if (allMistakes.length === 0) {
      Alert.alert('No mistakes yet', 'Log some mistakes first — quizzes are generated from your past errors.');
      return;
    }

    setGenerating(true);

    let filteredMistakes = allMistakes.filter(
      (m) => m.chapter && selectedChapters.includes(m.chapter_id)
    );

    if (selectedMistakeTypes.length > 0) {
      filteredMistakes = filteredMistakes.filter((m) =>
        selectedMistakeTypes.includes(m.mistake_type)
      );
    }

    if (filteredMistakes.length === 0) {
      setGenerating(false);
      Alert.alert('No matching mistakes', 'No mistakes found for the selected chapters and types. Try widening your filters.');
      return;
    }

    const generatedQuestions = generateQuizQuestions(
      filteredMistakes as { chapter?: { name: string }; subject?: { name: string }; mistake_type: MistakeType }[],
      questionCount
    );

    const subjectNames = subjects
      .filter((s) => filteredMistakes.some((m) => m.subject_id === s.id))
      .map((s) => s.name);

    const quizTitle = `${questionCount}Q · ${selectedChapters.length} chapter${selectedChapters.length > 1 ? 's' : ''}`;

    const { data: quizData, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        title: quizTitle,
        subject_filter: subjectNames,
        chapter_filter: selectedChapters,
        mistake_type_filter: selectedMistakeTypes,
        question_count: generatedQuestions.length,
        status: 'in_progress',
      })
      .select()
      .single();

    if (quizError || !quizData) {
      setGenerating(false);
      Alert.alert('Error', 'Could not create quiz.');
      return;
    }

    const questionsToInsert = generatedQuestions.map((q) => ({
      ...q,
      quiz_id: quizData.id,
    }));

    const { data: insertedQuestions, error: qError } = await supabase
      .from('quiz_questions')
      .insert(questionsToInsert)
      .select();

    if (qError || !insertedQuestions) {
      setGenerating(false);
      Alert.alert('Error', 'Could not create questions.');
      return;
    }

    setActiveQuiz(quizData);
    setQuizQuestions(insertedQuestions);
    setCurrentQ(0);
    setAnswers({});
    setShowExplanation(false);
    setScore(0);
    setScreenState('quiz');
    setGenerating(false);
  };

  const handleAnswer = async (option: 'A' | 'B' | 'C' | 'D') => {
    if (answers[quizQuestions[currentQ].id]) return;

    const question = quizQuestions[currentQ];
    const isCorrect = option === question.correct_answer;
    const newAnswers = { ...answers, [question.id]: option };
    setAnswers(newAnswers);
    setShowExplanation(true);

    if (isCorrect) setScore((s) => s + 1);

    await supabase
      .from('quiz_questions')
      .update({ user_answer: option, is_correct: isCorrect })
      .eq('id', question.id);
  };

  const handleNext = () => {
    if (currentQ < quizQuestions.length - 1) {
      setCurrentQ((q) => q + 1);
      setShowExplanation(false);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    if (!activeQuiz) return;
    const finalScore = Object.entries(answers).filter(([qid, ans]) => {
      const q = quizQuestions.find((qq) => qq.id === qid);
      return q && q.correct_answer === ans;
    }).length;

    await supabase
      .from('quizzes')
      .update({ status: 'completed', score: finalScore })
      .eq('id', activeQuiz.id);

    setScore(finalScore);
    setScreenState('results');
    loadData();
  };

  const handleRestart = () => {
    setScreenState('setup');
    setActiveQuiz(null);
    setQuizQuestions([]);
    setCurrentQ(0);
    setAnswers({});
    setShowExplanation(false);
    setScore(0);
    setSelectedChapters([]);
    setSelectedMistakeTypes([]);
  };

  const quickGenerate = async () => {
    setSelectedChapters(chapters.map((c) => c.id));
    setQuestionCount(20);
    setTimeout(() => handleGenerate(), 100);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color={Colors.primary[600]} />
      </SafeAreaView>
    );
  }

  if (screenState === 'quiz' && quizQuestions.length > 0) {
    return (
      <QuizRunner
        questions={quizQuestions}
        currentQ={currentQ}
        answers={answers}
        showExplanation={showExplanation}
        score={score}
        onAnswer={handleAnswer}
        onNext={handleNext}
        onPrev={() => {
          if (currentQ > 0) {
            setCurrentQ((q) => q - 1);
            setShowExplanation(!!answers[quizQuestions[currentQ - 1].id]);
          }
        }}
        quizTitle={activeQuiz?.title || 'Quiz'}
      />
    );
  }

  if (screenState === 'results') {
    return (
      <ResultsScreen
        score={score}
        total={quizQuestions.length}
        onRestart={handleRestart}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Quiz Generator" subtitle="Retest your past mistakes" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {allMistakes.length === 0 ? (
          <EmptyState
            icon={<FileQuestion size={48} color={Colors.neutral[300]} />}
            title="No mistakes to quiz from yet"
            message="Log mistakes in the Capture tab — then generate a re-test quiz from them here."
          />
        ) : (
          <>
            {/* Quick Generate CTA */}
            <TouchableOpacity style={styles.quickCTA} onPress={quickGenerate} activeOpacity={0.85}>
              <View style={styles.quickIcon}>
                <Zap size={24} color={Colors.neutral[0]} />
              </View>
              <View style={styles.quickContent}>
                <Text style={styles.quickTitle}>Pre-Exam Re-Test</Text>
                <Text style={styles.quickSubtitle}>
                  Generate 20 questions from all your past mistakes
                </Text>
              </View>
              <ChevronRight size={20} color={Colors.neutral[0]} />
            </TouchableOpacity>

            {/* Chapter Selection */}
            <Text style={styles.sectionLabel}>
              <Layers size={14} color={Colors.neutral[600]} />  Select Chapters ({selectedChapters.length} chosen)
            </Text>
            <View style={styles.chapterList}>
              {chapters.map((chapter) => {
                const selected = selectedChapters.includes(chapter.id);
                const subject = subjects.find((s) => s.id === (allMistakes.find((m) => m.chapter_id === chapter.id)?.subject_id));
                const mistakeCount = allMistakes.filter((m) => m.chapter_id === chapter.id).length;
                return (
                  <TouchableOpacity
                    key={chapter.id}
                    style={[styles.chapterChip, selected && styles.chapterChipActive]}
                    onPress={() => toggleChapter(chapter.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.chapterCheck, selected && styles.chapterCheckActive]}>
                      {selected && <Check size={14} color={Colors.neutral[0]} />}
                    </View>
                    <View style={styles.chapterInfo}>
                      <Text
                        style={[styles.chapterName, selected && styles.chapterNameActive]}
                        numberOfLines={1}
                      >
                        {chapter.name}
                      </Text>
                      <Text style={styles.chapterMeta}>
                        {subject?.name} · {mistakeCount} mistake{mistakeCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Mistake Type Filter */}
            <Text style={styles.sectionLabel}>Mistake Types (optional)</Text>
            <View style={styles.mistakeTypeRow}>
              {MISTAKE_TYPES.map((mt) => {
                const selected = selectedMistakeTypes.includes(mt.label);
                return (
                  <TouchableOpacity
                    key={mt.label}
                    style={[
                      styles.mtChip,
                      selected && { backgroundColor: mt.color, borderColor: mt.color },
                    ]}
                    onPress={() => toggleMistakeType(mt.label)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.mtChipText, selected && styles.mtChipTextActive]}>
                      {mt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Question Count */}
            <Text style={styles.sectionLabel}>Number of Questions</Text>
            <View style={styles.countRow}>
              {[10, 15, 20, 30].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.countBtn, questionCount === n && styles.countBtnActive]}
                  onPress={() => setQuestionCount(n)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.countBtnText, questionCount === n && styles.countBtnTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Generate Button */}
            <TouchableOpacity
              style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
              onPress={handleGenerate}
              disabled={generating}
              activeOpacity={0.85}
            >
              {generating ? (
                <ActivityIndicator size="small" color={Colors.neutral[0]} />
              ) : (
                <>
                  <Zap size={20} color={Colors.neutral[0]} />
                  <Text style={styles.generateBtnText}>Generate Quiz</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Past Quizzes */}
            {pastQuizzes.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Recent Quizzes</Text>
                {pastQuizzes.map((quiz) => (
                  <View key={quiz.id} style={styles.pastQuizCard}>
                    <View style={styles.pastQuizInfo}>
                      <Text style={styles.pastQuizTitle}>{quiz.title}</Text>
                      <Text style={styles.pastQuizDate}>
                        {new Date(quiz.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    {quiz.status === 'completed' && quiz.score !== null ? (
                      <View style={styles.scoreBadge}>
                        <Trophy size={16} color={Colors.warning[500]} />
                        <Text style={styles.scoreText}>
                          {quiz.score}/{quiz.question_count}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.scoreBadge, { backgroundColor: Colors.primary[50] }]}>
                        <Text style={[styles.scoreText, { color: Colors.primary[600] }]}>In progress</Text>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}

            <View style={{ height: Spacing.xxl }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuizRunner({
  questions,
  currentQ,
  answers,
  showExplanation,
  score,
  onAnswer,
  onNext,
  onPrev,
  quizTitle,
}: {
  questions: QuizQuestion[];
  currentQ: number;
  answers: Record<string, 'A' | 'B' | 'C' | 'D'>;
  showExplanation: boolean;
  score: number;
  onAnswer: (option: 'A' | 'B' | 'C' | 'D') => void;
  onNext: () => void;
  onPrev: () => void;
  quizTitle: string;
}) {
  const q = questions[currentQ];
  const progress = ((currentQ + 1) / questions.length) * 100;
  const userAnswer = answers[q.id];

  const options: { key: 'A' | 'B' | 'C' | 'D'; text: string | null }[] = [
    { key: 'A', text: q.option_a },
    { key: 'B', text: q.option_b },
    { key: 'C', text: q.option_c },
    { key: 'D', text: q.option_d },
  ];

  const getOptionStyle = (key: 'A' | 'B' | 'C' | 'D') => {
    if (!userAnswer) return styles.option;
    if (key === q.correct_answer) return [styles.option, styles.optionCorrect];
    if (key === userAnswer) return [styles.option, styles.optionWrong];
    return [styles.option, styles.optionDim];
  };

  const getOptionTextStyle = (key: 'A' | 'B' | 'C' | 'D') => {
    if (!userAnswer) return styles.optionText;
    if (key === q.correct_answer) return [styles.optionText, styles.optionTextCorrect];
    if (key === userAnswer) return [styles.optionText, styles.optionTextWrong];
    return styles.optionText;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.quizHeader}>
        <Text style={styles.quizTitle}>{quizTitle}</Text>
        <Text style={styles.quizProgress}>
          Q{currentQ + 1} of {questions.length} · Score: {score}
        </Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.quizContent} showsVerticalScrollIndicator={false}>
        <View style={styles.questionCard}>
          {q.mistake_type && (
            <View style={styles.questionBadge}>
              <Text style={styles.questionBadgeText}>{q.mistake_type}</Text>
            </View>
          )}
          <Text style={styles.questionText}>{q.question_text}</Text>
        </View>

        <View style={styles.optionsWrap}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={getOptionStyle(opt.key)}
              onPress={() => onAnswer(opt.key)}
              disabled={!!userAnswer}
              activeOpacity={0.7}
            >
              <View style={styles.optionLabel}>
                <Text style={getOptionTextStyle(opt.key) as any}>
                  {opt.key}
                </Text>
              </View>
              <Text style={[getOptionTextStyle(opt.key) as any, { flex: 1 }]}>
                {opt.text}
              </Text>
              {userAnswer && opt.key === q.correct_answer && (
                <Check size={20} color={Colors.success[600]} />
              )}
              {userAnswer && opt.key === userAnswer && opt.key !== q.correct_answer && (
                <X size={20} color={Colors.error[600]} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {showExplanation && q.explanation && (
          <View style={styles.explanationCard}>
            <Text style={styles.explanationLabel}>Explanation</Text>
            <Text style={styles.explanationText}>{q.explanation}</Text>
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {showExplanation && (
        <View style={styles.quizNav}>
          {currentQ > 0 && (
            <TouchableOpacity style={styles.navBtnSecondary} onPress={onPrev}>
              <ChevronLeft size={18} color={Colors.neutral[600]} />
              <Text style={styles.navBtnSecondaryText}>Prev</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.navBtnPrimary} onPress={onNext}>
            <Text style={styles.navBtnPrimaryText}>
              {currentQ < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
            </Text>
            <ChevronRight size={18} color={Colors.neutral[0]} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function ResultsScreen({
  score,
  total,
  onRestart,
}: {
  score: number;
  total: number;
  onRestart: () => void;
}) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const message =
    percentage >= 80 ? 'Excellent work!' : percentage >= 60 ? 'Good effort — keep pushing.' : 'Review your mistakes and try again.';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.resultsContainer}>
        <View style={styles.resultsIcon}>
          <Trophy size={56} color={Colors.warning[500]} />
        </View>
        <Text style={styles.resultsTitle}>Quiz Complete</Text>
        <Text style={styles.resultsScore}>
          {score} / {total}
        </Text>
        <View style={styles.percentageBadge}>
          <Text style={styles.percentageText}>{percentage}%</Text>
        </View>
        <Text style={styles.resultsMessage}>{message}</Text>

        <View style={styles.resultsActions}>
          <TouchableOpacity style={styles.restartBtn} onPress={onRestart} activeOpacity={0.85}>
            <RotateCcw size={20} color={Colors.neutral[0]} />
            <Text style={styles.restartBtnText}>New Quiz</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral[50],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  quickCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[600],
    borderRadius: 18,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    shadowColor: Colors.primary[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickContent: {
    flex: 1,
  },
  quickTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.neutral[0],
  },
  quickSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.neutral[600],
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  chapterList: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  chapterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[0],
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    borderRadius: 14,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  chapterChipActive: {
    borderColor: Colors.primary[500],
    backgroundColor: Colors.primary[50],
  },
  chapterCheck: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterCheckActive: {
    backgroundColor: Colors.primary[600],
    borderColor: Colors.primary[600],
  },
  chapterInfo: {
    flex: 1,
  },
  chapterName: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: Colors.neutral[800],
  },
  chapterNameActive: {
    color: Colors.primary[700],
  },
  chapterMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.neutral[400],
    marginTop: 2,
  },
  mistakeTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  mtChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    backgroundColor: Colors.neutral[0],
  },
  mtChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.neutral[600],
  },
  mtChipTextActive: {
    color: Colors.neutral[0],
  },
  countRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  countBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    backgroundColor: Colors.neutral[0],
    alignItems: 'center',
  },
  countBtnActive: {
    borderColor: Colors.primary[600],
    backgroundColor: Colors.primary[600],
  },
  countBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.neutral[600],
  },
  countBtnTextActive: {
    color: Colors.neutral[0],
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutral[900],
    borderRadius: 16,
    paddingVertical: Spacing.md + 2,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.neutral[0],
  },
  pastQuizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.neutral[0],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  pastQuizInfo: {
    flex: 1,
  },
  pastQuizTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: Colors.neutral[800],
  },
  pastQuizDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.neutral[400],
    marginTop: 2,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning[50],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    gap: Spacing.xs,
  },
  scoreText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: Colors.warning[600],
  },
  // Quiz Runner
  quizHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  quizTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.neutral[900],
  },
  quizProgress: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.neutral[500],
    marginTop: 2,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.neutral[200],
    marginHorizontal: Spacing.lg,
    borderRadius: 2,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary[600],
    borderRadius: 2,
  },
  quizContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  questionCard: {
    backgroundColor: Colors.neutral[0],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: 18,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  questionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary[50],
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: Spacing.md,
  },
  questionBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.primary[700],
  },
  questionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 17,
    color: Colors.neutral[900],
    lineHeight: 24,
  },
  optionsWrap: {
    gap: Spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[0],
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    borderRadius: 14,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  optionCorrect: {
    borderColor: Colors.success[500],
    backgroundColor: Colors.success[50],
  },
  optionWrong: {
    borderColor: Colors.error[500],
    backgroundColor: Colors.error[50],
  },
  optionDim: {
    opacity: 0.5,
  },
  optionLabel: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.neutral[700],
    lineHeight: 20,
  },
  optionTextCorrect: {
    color: Colors.success[700],
    fontFamily: 'Inter-Medium',
  },
  optionTextWrong: {
    color: Colors.error[700],
    fontFamily: 'Inter-Medium',
  },
  explanationCard: {
    backgroundColor: Colors.primary[50],
    borderRadius: 14,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary[100],
  },
  explanationLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: Colors.primary[700],
    marginBottom: Spacing.xs,
  },
  explanationText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.neutral[700],
    lineHeight: 21,
  },
  quizNav: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
    gap: Spacing.sm,
  },
  navBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: 12,
    gap: Spacing.xs,
  },
  navBtnSecondaryText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: Colors.neutral[600],
  },
  navBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[600],
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: 12,
    gap: Spacing.xs,
  },
  navBtnPrimaryText: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.neutral[0],
  },
  // Results
  resultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  resultsIcon: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: Colors.warning[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  resultsTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 26,
    color: Colors.neutral[900],
  },
  resultsScore: {
    fontFamily: 'Inter-Bold',
    fontSize: 48,
    color: Colors.primary[600],
    marginTop: Spacing.sm,
  },
  percentageBadge: {
    backgroundColor: Colors.primary[50],
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 16,
    marginTop: Spacing.sm,
  },
  percentageText: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: Colors.primary[700],
  },
  resultsMessage: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.neutral[500],
    textAlign: 'center',
    marginTop: Spacing.lg,
    lineHeight: 22,
  },
  resultsActions: {
    marginTop: Spacing.xxl,
    width: '100%',
  },
  restartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[600],
    borderRadius: 16,
    paddingVertical: Spacing.md + 2,
    gap: Spacing.sm,
  },
  restartBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.neutral[0],
  },
});
