import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Camera,
  ClipboardList,
  FileQuestion,
  BarChart3,
  Library,
  Zap,
  TrendingUp,
  Target,
  ChevronRight,
  Sparkles,
  GraduationCap,
} from 'lucide-react-native';
import { Colors, Spacing } from '@/lib/theme';
import { supabase, Mistake, ExamTrack, PYQQuestion } from '@/lib/supabase';

export default function DashboardScreen() {
  const router = useRouter();
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [pyqCount, setPyqCount] = useState(0);
  const [examTrack, setExamTrack] = useState<ExamTrack>('JEE');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [mistakesRes, pyqRes, settingsRes] = await Promise.all([
      supabase.from('mistakes').select('*, subject:subjects(*), chapter:chapters(*)').order('created_at', { ascending: false }),
      supabase.from('pyq_questions').select('id', { count: 'exact', head: true }),
      supabase.from('app_settings').select('key, value').eq('key', 'exam_track').maybeSingle(),
    ]);

    if (mistakesRes.data) setMistakes(mistakesRes.data);
    if (pyqRes.count !== null) setPyqCount(pyqRes.count);
    if (settingsRes.data?.value) setExamTrack(settingsRes.data.value as ExamTrack);
    setLoading(false);
  };

  const unresolvedCount = mistakes.filter((m) => m.status === 'unresolved').length;
  const masteredCount = mistakes.filter((m) => m.status === 'mastered').length;
  const recentMistakes = mistakes.slice(0, 5);
  const masteryRate = mistakes.length > 0 ? Math.round((masteredCount / mistakes.length) * 100) : 0;

  const toggleExamTrack = async () => {
    const newTrack: ExamTrack = examTrack === 'JEE' ? 'NEET' : 'JEE';
    setExamTrack(newTrack);
    await supabase.from('app_settings').upsert({ key: 'exam_track', value: newTrack });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[600]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero Header */}
        <LinearGradient
          colors={['#1E3A8A', '#2563EB', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroBrand}>
              <View style={styles.logoWrap}>
                <GraduationCap size={22} color={Colors.neutral[0]} />
              </View>
              <Text style={styles.brandName}>MistakeDeck</Text>
            </View>
            <TouchableOpacity style={styles.trackBadge} onPress={toggleExamTrack} activeOpacity={0.7}>
              <Sparkles size={14} color={Colors.neutral[0]} />
              <Text style={styles.trackText}>{examTrack}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.heroGreeting}>Let's fix your mistakes</Text>
          <Text style={styles.heroSubtitle}>
            {mistakes.length > 0
              ? `${mistakes.length} mistakes logged · ${unresolvedCount} to review`
              : 'Start by capturing your first mistake'}
          </Text>

          {/* Quick Stats Row */}
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Target size={18} color="rgba(255,255,255,0.8)" />
              <Text style={styles.heroStatValue}>{mistakes.length}</Text>
              <Text style={styles.heroStatLabel}>Total</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <TrendingUp size={18} color="rgba(255,255,255,0.8)" />
              <Text style={styles.heroStatValue}>{masteryRate}%</Text>
              <Text style={styles.heroStatLabel}>Mastery</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Library size={18} color="rgba(255,255,255,0.8)" />
              <Text style={styles.heroStatValue}>{pyqCount}</Text>
              <Text style={styles.heroStatLabel}>PYQs</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Feature Cards */}
        <Text style={styles.sectionTitle}>Features</Text>
        <View style={styles.featureGrid}>
          <FeatureCard
            icon={<Camera size={24} color={Colors.neutral[0]} />}
            iconBg="#3B82F6"
            title="Capture"
            desc="Snap & tag mistakes"
            onPress={() => router.push('/(tabs)/capture')}
          />
          <FeatureCard
            icon={<ClipboardList size={24} color={Colors.neutral[0]} />}
            iconBg="#10B981"
            title="Mistakes"
            desc={`${unresolvedCount} unresolved`}
            onPress={() => router.push('/(tabs)/mistakes')}
          />
          <FeatureCard
            icon={<Library size={24} color={Colors.neutral[0]} />}
            iconBg="#F59E0B"
            title="PYQ Bank"
            desc={`${pyqCount} questions`}
            onPress={() => router.push('/(tabs)/pyq')}
          />
          <FeatureCard
            icon={<Zap size={24} color={Colors.neutral[0]} />}
            iconBg="#EF4444"
            title="Re-Test"
            desc="From your errors"
            onPress={() => router.push('/(tabs)/quiz')}
          />
          <FeatureCard
            icon={<BarChart3 size={24} color={Colors.neutral[0]} />}
            iconBg="#8B5CF6"
            title="Insights"
            desc="Analytics"
            onPress={() => router.push('/(tabs)/insights')}
          />
          <FeatureCard
            icon={<FileQuestion size={24} color={Colors.neutral[0]} />}
            iconBg="#06B6D4"
            title="Quiz Gen"
            desc="Build a quiz"
            onPress={() => router.push('/(tabs)/quiz')}
          />
        </View>

        {/* Pre-Exam CTA */}
        {mistakes.length > 0 && (
          <TouchableOpacity
            style={styles.ctaCard}
            onPress={() => router.push('/(tabs)/quiz')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#F97316', '#EA580C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0}}
              style={styles.ctaGradient}
            >
              <View style={styles.ctaLeft}>
                <Zap size={28} color={Colors.neutral[0]} />
                <View>
                  <Text style={styles.ctaTitle}>Pre-Exam Re-Test</Text>
                  <Text style={styles.ctaSubtitle}>Generate 20 questions from your past mistakes</Text>
                </View>
              </View>
              <ChevronRight size={22} color={Colors.neutral[0]} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Recent Mistakes */}
        {recentMistakes.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Mistakes</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/mistakes')}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            {recentMistakes.map((m) => (
              <View key={m.id} style={styles.recentCard}>
                <View style={[styles.recentBar, { backgroundColor: m.subject?.color || Colors.neutral[300] }]} />
                <View style={styles.recentBody}>
                  <View style={styles.recentHeader}>
                    <Text style={styles.recentChapter}>{m.chapter?.name || 'Unknown'}</Text>
                    <Text style={styles.recentSubject}>{m.subject?.name}</Text>
                  </View>
                  <Text style={styles.recentType}>{m.mistake_type}</Text>
                </View>
                <View style={[styles.statusDot, {
                  backgroundColor: m.status === 'mastered' ? Colors.success[500] :
                    m.status === 'reviewed' ? Colors.warning[500] : Colors.neutral[400]
                }]} />
              </View>
            ))}
          </>
        )}

        {/* Empty State */}
        {mistakes.length === 0 && (
          <View style={styles.emptyCard}>
            <Camera size={40} color={Colors.neutral[300]} />
            <Text style={styles.emptyTitle}>No mistakes yet</Text>
            <Text style={styles.emptyMessage}>
              Capture your first mistake from a test sheet to get started
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/(tabs)/capture')}
              activeOpacity={0.85}
            >
              <Camera size={18} color={Colors.neutral[0]} />
              <Text style={styles.emptyBtnText}>Capture a mistake</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

function FeatureCard({
  icon,
  iconBg,
  title,
  desc,
  onPress,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.featureCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.featureIcon, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDesc}>{desc}</Text>
    </TouchableOpacity>
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
    paddingBottom: Spacing.xxl,
  },
  // Hero
  hero: {
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  heroBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.neutral[0],
  },
  trackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
    borderRadius: 20,
    gap: Spacing.xs,
  },
  trackText: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    color: Colors.neutral[0],
  },
  heroGreeting: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: Colors.neutral[0],
    lineHeight: 34,
  },
  heroSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: Spacing.md,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  heroStatValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.neutral[0],
  },
  heroStatLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // Features
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.neutral[900],
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  featureCard: {
    width: '47.5%',
    backgroundColor: Colors.neutral[0],
    borderRadius: 18,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral[100],
    shadowColor: Colors.neutral[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  featureTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.neutral[900],
  },
  featureDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.neutral[400],
    marginTop: 2,
  },
  // CTA
  ctaCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: 18,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  ctaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  ctaTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.neutral[0],
  },
  ctaSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  seeAllText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.primary[600],
  },
  // Recent
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[0],
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.neutral[100],
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  recentBar: {
    width: 4,
    height: '100%',
  },
  recentBody: {
    flex: 1,
    padding: Spacing.md,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentChapter: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.neutral[800],
  },
  recentSubject: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.neutral[400],
  },
  recentType: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.md,
  },
  // Empty
  emptyCard: {
    alignItems: 'center',
    backgroundColor: Colors.neutral[0],
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.neutral[700],
    marginTop: Spacing.sm,
  },
  emptyMessage: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.neutral[400],
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[600],
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 14,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  emptyBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.neutral[0],
  },
});
