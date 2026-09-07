import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Library,
  Search,
  Filter,
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  Zap,
  Trophy,
  RotateCcw,
  Target,
  FileText,
  Lightbulb,
  Calendar,
  Layers,
  GraduationCap,
} from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Spacing } from '@/lib/theme';
import {
  supabase,
  PYQQuestion,
  PYQSession,
  Mistake,
  ExamType,
  Difficulty,
  ExamTrack,
  EXAM_OPTIONS,
  DIFFICULTY_OPTIONS,
} from '@/lib/supabase';

type ScreenState = 'browse' | 'quiz' | 'results';
type Source = 'bank' | 'error_based';

export default function PYQScreen() {
  const [allQuestions, setAllQuestions] = useState<PYQQuestion[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<PYQQuestion[]>([]);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [examTrack, setExamTrack] = useState<ExamTrack>('JEE');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');

  const [examFilter, setExamFilter] = useState<ExamType[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<string[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty[]>([]);
  const [sourceMode, setSourceMode] = useState<Source>('bank');

  // Quiz state
  const [screenState, setScreenState] = useState<ScreenState>('browse');
  const [quizQuestions, setQuizQuestions] = useState<PYQQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [pastSessions, setPastSessions] = useState<PYQSession[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [qRes, mRes, sRes, sessionsRes] = await Promise.all([
      supabase.from('pyq_questions').select('*').order('year', { ascending: false }),
      supabase.from('mistakes').select('*, subject:subjects(*), chapter:chapters(*)').order('created_at', { ascending: false }),
      supabase.from('app_settings').select('key, value').eq('key', 'exam_track').maybeSingle(),
      supabase.from('pyq_sessions').select('*').order('created_at', { ascending: false }).limit(5),
    ]);

    if (qRes.data) setAllQuestions(qRes.data);
    if (mRes.data) setMistakes(mRes.data);
    if (sRes.data?.value) setExamTrack(sRes.data.value as ExamTrack);
    if (sessionsRes.data) setPastSessions(sessionsRes.data);
    setLoading(false);
  };

  // Filter questions
  useEffect(() => {
    let filtered = allQuestions;

    if (sourceMode === 'error_based' && mistakes.length > 0) {
      const mistakeChapters = new Set(mistakes.map((m) => m.chapter?.name).filter(Boolean));
      const mistakeSubjects = new Set(mistakes.map((m) => m.subject?.name).filter(Boolean));
      filtered = filtered.filter(
        (q) => mistakeChapters.has(q.chapter) && mistakeSubjects.has(q.subject)
      );
    }

    if (examFilter.length > 0) {
      filtered = filtered.filter((q) => examFilter.includes(q.exam));
    }
    if (subjectFilter.length > 0) {
      filtered = filtered.filter((q) => subjectFilter.includes(q.subject));
    }
    if (difficultyFilter.length > 0) {
      filtered = filtered.filter((q) => difficultyFilter.includes(q.difficulty));
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (q) =>
          q.question_text.toLowerCase().includes(s) ||
          q.chapter.toLowerCase().includes(s) ||
          q.subject.toLowerCase().includes(s)
      );
    }

    setFilteredQuestions(filtered);
  }, [allQuestions, examFilter, subjectFilter, difficultyFilter, search, sourceMode, mistakes]);

  const availableExams = EXAM_OPTIONS.filter((e) =>
    examTrack === 'JEE' ? e.track === 'JEE' : e.track === 'NEET'
  );

  const availableSubjects = examTrack === 'JEE'
    ? ['Physics', 'Chemistry', 'Mathematics']
    : ['Physics', 'Chemistry', 'Biology'];

  const toggleArrayFilter = <T extends string>(arr: T[], value: T, setter: (v: T[]) => void) => {
    setter(arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]);
  };

  const handleStartSession = async (questions: PYQQuestion[], src: Source) => {
    if (questions.length === 0) {
      Alert.alert('No questions', 'No PYQ questions match your filters. Try adjusting them.');
      return;
    }

    setGenerating(true);

    const { data: sessionData, error } = await supabase
      .from('pyq_sessions')
      .insert({
        exam_filter: examFilter,
        subject_filter: subjectFilter,
        chapter_filter: [],
        difficulty_filter: difficultyFilter,
        source: src,
        question_count: questions.length,
        status: 'in_progress',
        question_ids: questions.map((q) => q.id),
        user_answers: {},
      })
      .select()
      .single();

    if (error || !sessionData) {
      setGenerating(false);
      Alert.alert('Error', 'Could not start session.');
      return;
    }

    setQuizQuestions(questions);
    setCurrentQ(0);
    setAnswers({});
    setShowExplanation(false);
    setScore(0);
    setScreenState('quiz');
    setGenerating(false);
  };

  const handleQuickErrorBased = () => {
    const mistakeChapters = new Set(mistakes.map((m) => m.chapter?.name).filter(Boolean));
    const mistakeSubjects = new Set(mistakes.map((m) => m.subject?.name).filter(Boolean));
    const candidates = allQuestions.filter(
      (q) => mistakeChapters.has(q.chapter) && mistakeSubjects.has(q.subject)
    );
    const selected = shuffleArray(candidates).slice(0, Math.min(20, candidates.length));
    handleStartSession(selected, 'error_based');
  };

  const handleAnswer = (option: 'A' | 'B' | 'C' | 'D') => {
    const q = quizQuestions[currentQ];
    if (answers[q.id]) return;
    const isCorrect = option === q.correct_answer;
    setAnswers((prev) => ({ ...prev, [q.id]: option }));
    setShowExplanation(true);
    if (isCorrect) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (currentQ < quizQuestions.length - 1) {
      setCurrentQ((q) => q + 1);
      setShowExplanation(false);
    } else {
      finishSession();
    }
  };

  const finishSession = async () => {
    const finalScore = Object.entries(answers).filter(([qid, ans]) => {
      const q = quizQuestions.find((qq) => qq.id === qid);
      return q && q.correct_answer === ans;
    }).length;

    if (quizQuestions.length > 0) {
      const sessionId = pastSessions[0]?.id;
      // Find the latest session we created - update it
      const { data: latestSession } = await supabase
        .from('pyq_sessions')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestSession) {
        await supabase
          .from('pyq_sessions')
          .update({ status: 'completed', score: finalScore, user_answers: answers })
          .eq('id', latestSession.id);
      }
    }

    setScore(finalScore);
    setScreenState('results');
    loadData();
  };

  const handleRestart = () => {
    setScreenState('browse');
    setQuizQuestions([]);
    setCurrentQ(0);
    setAnswers({});
    setShowExplanation(false);
    setScore(0);
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
      <PYQQuizRunner
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
        onExit={handleRestart}
      />
    );
  }

  if (screenState === 'results') {
    return (
      <PYQResultsScreen
        score={score}
        total={quizQuestions.length}
        onRestart={handleRestart}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="PYQ Bank"
        subtitle={`${filteredQuestions.length} questions available`}
        right={
          <TouchableOpacity
            style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} color={showFilters ? Colors.primary[600] : Colors.neutral[500]} />
          </TouchableOpacity>
        }
      />

      {/* Source Toggle */}
      <View style={styles.sourceToggle}>
        <TouchableOpacity
          style={[styles.sourceTab, sourceMode === 'bank' && styles.sourceTabActive]}
          onPress={() => setSourceMode('bank')}
        >
          <Library size={16} color={sourceMode === 'bank' ? Colors.primary[600] : Colors.neutral[400]} />
          <Text style={[styles.sourceTabText, sourceMode === 'bank' && styles.sourceTabTextActive]}>
            Question Bank
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sourceTab, sourceMode === 'error_based' && styles.sourceTabActive]}
          onPress={() => setSourceMode('error_based')}
        >
          <Target size={16} color={sourceMode === 'error_based' ? Colors.primary[600] : Colors.neutral[400]} />
          <Text style={[styles.sourceTabText, sourceMode === 'error_based' && styles.sourceTabTextActive]}>
            From My Errors
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error-based CTA */}
      {sourceMode === 'error_based' && mistakes.length > 0 && (
        <TouchableOpacity
          style={styles.errorCTA}
          onPress={handleQuickErrorBased}
          disabled={generating}
          activeOpacity={0.85}
        >
          {generating ? (
            <ActivityIndicator size="small" color={Colors.neutral[0]} />
          ) : (
            <>
              <Zap size={22} color={Colors.neutral[0]} />
              <View style={styles.errorCTABody}>
                <Text style={styles.errorCTATitle}>Practice PYQs from your weak chapters</Text>
                <Text style={styles.errorCTASubtitle}>
                  {mistakes.length} mistakes logged · get 20 targeted PYQs
                </Text>
              </View>
              <ChevronRight size={20} color={Colors.neutral[0]} />
            </>
          )}
        </TouchableOpacity>
      )}

      {sourceMode === 'error_based' && mistakes.length === 0 && (
        <View style={styles.errorEmpty}>
          <Target size={36} color={Colors.neutral[300]} />
          <Text style={styles.errorEmptyTitle}>No mistakes logged yet</Text>
          <Text style={styles.errorEmptyText}>
            Log mistakes in the Capture tab, then come back to practice PYQs from those exact chapters.
          </Text>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchWrap}>
        <Search size={18} color={Colors.neutral[400]} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search questions, chapters..."
          placeholderTextColor={Colors.neutral[400]}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={16} color={Colors.neutral[400]} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      {showFilters && (
        <ScrollView style={styles.filtersContainer} showsVerticalScrollIndicator={false}>
          {/* Exam Filter */}
          <Text style={styles.filterLabel}>Exam</Text>
          <View style={styles.filterChips}>
            {availableExams.map((exam) => (
              <FilterChip
                key={exam.label}
                label={exam.label}
                active={examFilter.includes(exam.label)}
                color={exam.color}
                onPress={() => toggleArrayFilter(examFilter, exam.label, setExamFilter)}
              />
            ))}
          </View>

          {/* Subject Filter */}
          <Text style={styles.filterLabel}>Subject</Text>
          <View style={styles.filterChips}>
            {availableSubjects.map((subj) => (
              <FilterChip
                key={subj}
                label={subj}
                active={subjectFilter.includes(subj)}
                color={Colors.primary[500]}
                onPress={() => toggleArrayFilter(subjectFilter, subj, setSubjectFilter)}
              />
            ))}
          </View>

          {/* Difficulty Filter */}
          <Text style={styles.filterLabel}>Difficulty</Text>
          <View style={styles.filterChips}>
            {DIFFICULTY_OPTIONS.map((diff) => (
              <FilterChip
                key={diff.label}
                label={diff.label}
                active={difficultyFilter.includes(diff.label)}
                color={diff.color}
                onPress={() => toggleArrayFilter(difficultyFilter, diff.label, setDifficultyFilter)}
              />
            ))}
          </View>

          {(examFilter.length > 0 || subjectFilter.length > 0 || difficultyFilter.length > 0) && (
            <TouchableOpacity
              style={styles.clearFiltersBtn}
              onPress={() => {
                setExamFilter([]);
                setSubjectFilter([]);
                setDifficultyFilter([]);
              }}
            >
              <Text style={styles.clearFiltersText}>Clear all filters</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Question List / Start Session */}
      {!showFilters && (
        <>
          {sourceMode === 'bank' && filteredQuestions.length > 0 && (
            <TouchableOpacity
              style={styles.startSessionBtn}
              onPress={() => handleStartSession(shuffleArray(filteredQuestions).slice(0, 20), 'bank')}
              disabled={generating}
              activeOpacity={0.85}
            >
              {generating ? (
                <ActivityIndicator size="small" color={Colors.neutral[0]} />
              ) : (
                <>
                  <Zap size={20} color={Colors.neutral[0]} />
                  <Text style={styles.startSessionText}>
                    Start 20-Question Session from {filteredQuestions.length} PYQs
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {filteredQuestions.length === 0 ? (
            <EmptyState
              icon={<Library size={48} color={Colors.neutral[300]} />}
              title="No questions match"
              message="Adjust your filters or search to find PYQ questions."
            />
          ) : (
            <FlatList
              data={filteredQuestions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <QuestionCard question={item} onPress={() => {
                  Alert.alert(
                    `${item.exam} ${item.year} · ${item.difficulty}`,
                    item.question_text,
                    [
                      { text: 'Cancel' },
                      { text: 'Start solo', onPress: () => handleStartSession([item], 'bank') },
                    ]
                  );
                }} />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      {/* Past Sessions */}
      {!showFilters && pastSessions.length > 0 && filteredQuestions.length > 0 && (
        <View style={styles.pastSessionsWrap}>
          <Text style={styles.pastSessionsTitle}>Recent Sessions</Text>
          {pastSessions.map((session) => (
            <View key={session.id} style={styles.pastSessionCard}>
              <View style={styles.pastSessionLeft}>
                <View style={[
                  styles.pastSessionIcon,
                  { backgroundColor: session.source === 'error_based' ? Colors.error[50] : Colors.primary[50] }
                ]}>
                  {session.source === 'error_based' ? (
                    <Target size={16} color={Colors.error[600]} />
                  ) : (
                    <Library size={16} color={Colors.primary[600]} />
                  )}
                </View>
                <View>
                  <Text style={styles.pastSessionTitle}>
                    {session.source === 'error_based' ? 'Error-based PYQ' : 'Bank PYQ'} · {session.question_count} Q
                  </Text>
                  <Text style={styles.pastSessionDate}>
                    {new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              </View>
              {session.status === 'completed' && session.score !== null ? (
                <View style={styles.scoreBadge}>
                  <Trophy size={14} color={Colors.warning[500]} />
                  <Text style={styles.scoreText}>{session.score}/{session.question_count}</Text>
                </View>
              ) : (
                <View style={[styles.scoreBadge, { backgroundColor: Colors.primary[50] }]}>
                  <Text style={[styles.scoreText, { color: Colors.primary[600] }]}>In progress</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

function QuestionCard({ question, onPress }: { question: PYQQuestion; onPress: () => void }) {
  const examColor = EXAM_OPTIONS.find((e) => e.label === question.exam)?.color || Colors.neutral[400];
  const diffColor = DIFFICULTY_OPTIONS.find((d) => d.label === question.difficulty)?.color || Colors.neutral[400];

  return (
    <TouchableOpacity style={styles.qCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.qCardHeader}>
        <View style={[styles.examBadge, { backgroundColor: examColor + '18' }]}>
          <Text style={[styles.examBadgeText, { color: examColor }]}>{question.exam}</Text>
        </View>
        <View style={[styles.diffBadge, { backgroundColor: diffColor + '18' }]}>
          <Text style={[styles.diffBadgeText, { color: diffColor }]}>{question.difficulty}</Text>
        </View>
        <View style={styles.yearBadge}>
          <Calendar size={12} color={Colors.neutral[400]} />
          <Text style={styles.yearText}>{question.year}</Text>
        </View>
      </View>
      <Text style={styles.qText} numberOfLines={3}>{question.question_text}</Text>
      <View style={styles.qFooter}>
        <View style={styles.qMeta}>
          <Layers size={13} color={Colors.neutral[400]} />
          <Text style={styles.qMetaText}>{question.chapter}</Text>
        </View>
        <View style={styles.qMeta}>
          <GraduationCap size={13} color={Colors.neutral[400]} />
          <Text style={styles.qMetaText}>{question.subject}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function FilterChip({ label, active, color, onPress }: { label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PYQQuizRunner({
  questions,
  currentQ,
  answers,
  showExplanation,
  score,
  onAnswer,
  onNext,
  onPrev,
  onExit,
}: {
  questions: PYQQuestion[];
  currentQ: number;
  answers: Record<string, 'A' | 'B' | 'C' | 'D'>;
  showExplanation: boolean;
  score: number;
  onAnswer: (option: 'A' | 'B' | 'C' | 'D') => void;
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
}) {
  const q = questions[currentQ];
  const progress = ((currentQ + 1) / questions.length) * 100;
  const userAnswer = answers[q.id];
  const examColor = EXAM_OPTIONS.find((e) => e.label === q.exam)?.color || Colors.neutral[400];

  const options: { key: 'A' | 'B' | 'C' | 'D'; text: string }[] = [
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.quizHeader}>
        <TouchableOpacity onPress={onExit} style={styles.exitBtn}>
          <X size={20} color={Colors.neutral[600]} />
        </TouchableOpacity>
        <View style={styles.quizHeaderCenter}>
          <Text style={styles.quizExamLabel}>{q.exam} {q.year}</Text>
          <Text style={styles.quizProgress}>Q{currentQ + 1} of {questions.length} · Score: {score}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.quizContent} showsVerticalScrollIndicator={false}>
        <View style={styles.questionCard}>
          <View style={styles.questionBadges}>
            <View style={[styles.examBadge, { backgroundColor: examColor + '18' }]}>
              <Text style={[styles.examBadgeText, { color: examColor }]}>{q.exam}</Text>
            </View>
            <View style={[styles.diffBadge, { backgroundColor: Colors.neutral[100] }]}>
              <Text style={styles.diffBadgeText}>{q.difficulty}</Text>
            </View>
          </View>
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
                <Text style={styles.optionLabelText}>{opt.key}</Text>
              </View>
              <Text style={styles.optionText}>{opt.text}</Text>
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
            <View style={styles.explanationHeader}>
              <Lightbulb size={18} color={Colors.primary[600]} />
              <Text style={styles.explanationLabel}>Explanation</Text>
            </View>
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
              {currentQ < questions.length - 1 ? 'Next Question' : 'Finish Session'}
            </Text>
            <ChevronRight size={18} color={Colors.neutral[0]} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function PYQResultsScreen({ score, total, onRestart }: { score: number; total: number; onRestart: () => void }) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const message =
    percentage >= 80 ? 'Outstanding! You\'re exam-ready.' :
    percentage >= 60 ? 'Good work — keep practicing.' :
    'Review these topics and try again.';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.resultsContainer}>
        <View style={styles.resultsIcon}>
          <Trophy size={56} color={Colors.warning[500]} />
        </View>
        <Text style={styles.resultsTitle}>Session Complete</Text>
        <Text style={styles.resultsScore}>{score} / {total}</Text>
        <View style={styles.percentageBadge}>
          <Text style={styles.percentageText}>{percentage}%</Text>
        </View>
        <Text style={styles.resultsMessage}>{message}</Text>
        <TouchableOpacity style={styles.restartBtn} onPress={onRestart} activeOpacity={0.85}>
          <RotateCcw size={20} color={Colors.neutral[0]} />
          <Text style={styles.restartBtnText}>Back to PYQ Bank</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
  // Source toggle
  sourceToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral[100],
    borderRadius: 14,
    padding: 4,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sourceTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: 11,
  },
  sourceTabActive: {
    backgroundColor: Colors.neutral[0],
    shadowColor: Colors.neutral[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sourceTabText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.neutral[500],
  },
  sourceTabTextActive: {
    color: Colors.primary[600],
  },
  // Error CTA
  errorCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[600],
    borderRadius: 16,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  errorCTABody: {
    flex: 1,
  },
  errorCTATitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.neutral[0],
  },
  errorCTASubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  errorEmpty: {
    alignItems: 'center',
    backgroundColor: Colors.neutral[0],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  errorEmptyTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.neutral[700],
    marginTop: Spacing.sm,
  },
  errorEmptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.neutral[400],
    textAlign: 'center',
    lineHeight: 19,
  },
  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[0],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.neutral[900],
    paddingVertical: Spacing.md,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: Colors.primary[50],
  },
  // Filters
  filtersContainer: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.neutral[0],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: 16,
    padding: Spacing.md,
  },
  filterLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.neutral[600],
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    backgroundColor: Colors.neutral[0],
  },
  chipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.neutral[600],
  },
  chipTextActive: {
    color: Colors.neutral[0],
  },
  clearFiltersBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
  },
  clearFiltersText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.error[600],
  },
  // Start session
  startSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutral[900],
    borderRadius: 16,
    marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  startSessionText: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.neutral[0],
    flex: 1,
    textAlign: 'center',
  },
  // Question cards
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  qCard: {
    backgroundColor: Colors.neutral[0],
    borderWidth: 1,
    borderColor: Colors.neutral[100],
    borderRadius: 16,
    padding: Spacing.md,
  },
  qCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  examBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 8,
  },
  examBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  diffBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 8,
  },
  diffBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: Colors.neutral[700],
  },
  yearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  yearText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.neutral[400],
  },
  qText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.neutral[800],
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  qFooter: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[100],
  },
  qMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qMetaText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.neutral[400],
  },
  // Past sessions
  pastSessionsWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  pastSessionsTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.neutral[900],
    marginBottom: Spacing.md,
  },
  pastSessionCard: {
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
  pastSessionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  pastSessionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastSessionTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.neutral[800],
  },
  pastSessionDate: {
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
    fontSize: 13,
    color: Colors.warning[600],
  },
  // Quiz Runner
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  exitBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizHeaderCenter: {
    alignItems: 'center',
  },
  quizExamLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.neutral[800],
  },
  quizProgress: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
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
  questionBadges: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
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
  optionLabelText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: Colors.neutral[700],
  },
  optionText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.neutral[700],
    lineHeight: 20,
  },
  explanationCard: {
    backgroundColor: Colors.primary[50],
    borderRadius: 14,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary[100],
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  explanationLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: Colors.primary[700],
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
  restartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[600],
    borderRadius: 16,
    paddingVertical: Spacing.md + 2,
    marginTop: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  restartBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.neutral[0],
  },
});
