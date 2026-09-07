import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart3, TrendingUp, Target, AlertTriangle, Award, Layers } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Spacing } from '@/lib/theme';
import { supabase, Mistake, MISTAKE_TYPES, MistakeType } from '@/lib/supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.lg * 2 - Spacing.md) / 2;

export default function InsightsScreen() {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMistakes();
  }, []);

  const loadMistakes = async () => {
    const { data, error } = await supabase
      .from('mistakes')
      .select('*, subject:subjects(*), chapter:chapters(*)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMistakes(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color={Colors.primary[600]} />
      </SafeAreaView>
    );
  }

  if (mistakes.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Insights" subtitle="Your mistake analytics" />
        <EmptyState
          icon={<BarChart3 size={48} color={Colors.neutral[300]} />}
          title="No data to analyze yet"
          message="Log your mistakes in the Capture tab to see analytics here — breakdowns by type, chapter, and progress over time."
        />
      </SafeAreaView>
    );
  }

  // Analytics
  const byType: Record<string, number> = {};
  const bySubject: Record<string, { count: number; color: string; name: string }> = {};
  const byChapter: Record<string, { count: number; name: string; subject: string }> = {};
  const byStatus = { unresolved: 0, reviewed: 0, mastered: 0 };
  const last7Days: Record<string, number> = {};

  MISTAKE_TYPES.forEach((mt) => { byType[mt.label] = 0; });

  const dayLabels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    dayLabels.push(label);
    last7Days[label] = 0;
  }

  mistakes.forEach((m) => {
    byType[m.mistake_type] = (byType[m.mistake_type] || 0) + 1;
    byStatus[m.status]++;

    if (m.subject) {
      if (!bySubject[m.subject_id]) {
        bySubject[m.subject_id] = { count: 0, color: m.subject.color, name: m.subject.name };
      }
      bySubject[m.subject_id].count++;
    }

    if (m.chapter) {
      const key = m.chapter_id;
      if (!byChapter[key]) {
        byChapter[key] = { count: 0, name: m.chapter.name, subject: m.subject?.name || '' };
      }
      byChapter[key].count++;
    }

    const d = new Date(m.created_at);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    if (last7Days[label] !== undefined) {
      last7Days[label]++;
    }
  });

  const maxTypeCount = Math.max(...Object.values(byType), 1);
  const maxChapterCount = Math.max(...Object.values(byChapter).map((c) => c.count), 1);
  const maxDayCount = Math.max(...Object.values(last7Days), 1);
  const totalSubjectCount = Object.values(bySubject).reduce((a, s) => a + s.count, 0);

  const topChapters = Object.entries(byChapter)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5);

  const masteryRate = Math.round((byStatus.mastered / mistakes.length) * 100);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Insights" subtitle="Your mistake analytics" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Stat Cards */}
        <View style={styles.statRow}>
          <StatCard
            icon={<Target size={20} color={Colors.primary[600]} />}
            label="Total Mistakes"
            value={mistakes.length.toString()}
            color={Colors.primary[50]}
          />
          <StatCard
            icon={<Award size={20} color={Colors.success[600]} />}
            label="Mastery Rate"
            value={`${masteryRate}%`}
            color={Colors.success[50]}
          />
        </View>
        <View style={styles.statRow}>
          <StatCard
            icon={<AlertTriangle size={20} color={Colors.warning[600]} />}
            label="Unresolved"
            value={byStatus.unresolved.toString()}
            color={Colors.warning[50]}
          />
          <StatCard
            icon={<TrendingUp size={20} color={Colors.neutral[700]} />}
            label="Reviewed"
            value={byStatus.reviewed.toString()}
            color={Colors.neutral[100]}
          />
        </View>

        {/* 7-Day Activity */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last 7 Days</Text>
          <View style={styles.barChartRow}>
            {dayLabels.map((label) => {
              const count = last7Days[label];
              const height = count > 0 ? (count / maxDayCount) * 100 : 2;
              return (
                <View key={label} style={styles.barCol}>
                  <Text style={styles.barValue}>{count}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: `${height}%` }]} />
                  </View>
                  <Text style={styles.barLabel}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* By Mistake Type */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mistake Types Breakdown</Text>
          {MISTAKE_TYPES.map((mt) => {
            const count = byType[mt.label] || 0;
            const pct = maxTypeCount > 0 ? (count / maxTypeCount) * 100 : 0;
            return (
              <View key={mt.label} style={styles.typeRow}>
                <View style={styles.typeRowHeader}>
                  <View style={[styles.typeDot, { backgroundColor: mt.color }]} />
                  <Text style={styles.typeLabel}>{mt.label}</Text>
                  <Text style={styles.typeCount}>{count}</Text>
                </View>
                <View style={styles.typeBarTrack}>
                  <View style={[styles.typeBarFill, { width: `${pct}%`, backgroundColor: mt.color }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* By Subject */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>By Subject</Text>
          <View style={styles.donutWrap}>
            {Object.values(bySubject).map((s) => {
              const pct = Math.round((s.count / totalSubjectCount) * 100);
              return (
                <View key={s.name} style={styles.subjectRow}>
                  <View style={styles.subjectRowLeft}>
                    <View style={[styles.subjectDot, { backgroundColor: s.color }]} />
                    <Text style={styles.subjectName}>{s.name}</Text>
                  </View>
                  <View style={styles.subjectRowRight}>
                    <Text style={styles.subjectPct}>{pct}%</Text>
                    <Text style={styles.subjectCount}>{s.count}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Top Weak Chapters */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weakest Chapters</Text>
          {topChapters.map(([id, info]) => {
            const pct = (info.count / maxChapterCount) * 100;
            return (
              <View key={id} style={styles.chapterRow}>
                <View style={styles.chapterRowHeader}>
                  <Layers size={16} color={Colors.neutral[500]} />
                  <Text style={styles.chapterName} numberOfLines={1}>{info.name}</Text>
                  <Text style={styles.chapterSubject}>{info.subject}</Text>
                  <Text style={styles.chapterCount}>{info.count}</Text>
                </View>
                <View style={styles.chapterBarTrack}>
                  <View style={[styles.chapterBarFill, { width: `${pct}%` }]} />
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: color }]}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  statRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  statValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: Colors.neutral[900],
  },
  statLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.neutral[600],
  },
  card: {
    backgroundColor: Colors.neutral[0],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: 18,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.neutral[900],
    marginBottom: Spacing.lg,
  },
  // 7-Day Activity
  barChartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barValue: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: Colors.neutral[600],
  },
  barTrack: {
    flex: 1,
    width: 24,
    backgroundColor: Colors.neutral[100],
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: Colors.primary[500],
    borderRadius: 6,
    minHeight: 2,
  },
  barLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: Colors.neutral[400],
  },
  // By Type
  typeRow: {
    marginBottom: Spacing.md,
  },
  typeRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: Spacing.sm,
  },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  typeLabel: {
    flex: 1,
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.neutral[700],
  },
  typeCount: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: Colors.neutral[900],
  },
  typeBarTrack: {
    height: 8,
    backgroundColor: Colors.neutral[100],
    borderRadius: 4,
    overflow: 'hidden',
  },
  typeBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  // By Subject
  donutWrap: {
    gap: Spacing.md,
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  subjectDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  subjectName: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.neutral[800],
  },
  subjectRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  subjectPct: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: Colors.neutral[900],
  },
  subjectCount: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.neutral[400],
    minWidth: 24,
    textAlign: 'right',
  },
  // Weak Chapters
  chapterRow: {
    marginBottom: Spacing.md,
  },
  chapterRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: Spacing.sm,
  },
  chapterName: {
    flex: 1,
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.neutral[800],
  },
  chapterSubject: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.neutral[400],
  },
  chapterCount: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    color: Colors.neutral[900],
    minWidth: 20,
    textAlign: 'right',
  },
  chapterBarTrack: {
    height: 6,
    backgroundColor: Colors.neutral[100],
    borderRadius: 3,
    overflow: 'hidden',
  },
  chapterBarFill: {
    height: '100%',
    backgroundColor: Colors.error[400],
    borderRadius: 3,
  },
});
