import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ClipboardList, ChevronRight, CircleAlert as AlertCircle, Filter, X } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Spacing } from '@/lib/theme';
import { supabase, Mistake, MistakeType, MISTAKE_TYPES } from '@/lib/supabase';

export default function MistakesScreen() {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<MistakeType | 'All'>('All');
  const [showFilters, setShowFilters] = useState(false);

  const loadMistakes = useCallback(async () => {
    let query = supabase
      .from('mistakes')
      .select(`
        *,
        subject:subjects(*),
        chapter:chapters(*)
      `)
      .order('created_at', { ascending: false });

    if (activeFilter !== 'All') {
      query = query.eq('mistake_type', activeFilter);
    }

    const { data, error } = await query;

    if (error) {
      Alert.alert('Error', 'Could not load mistakes.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    let filtered = data || [];
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.question_text?.toLowerCase().includes(q) ||
          m.notes?.toLowerCase().includes(q) ||
          m.chapter?.name?.toLowerCase().includes(q) ||
          m.subject?.name?.toLowerCase().includes(q)
      );
    }

    setMistakes(filtered);
    setLoading(false);
    setRefreshing(false);
  }, [activeFilter, search]);

  useEffect(() => {
    loadMistakes();
  }, [loadMistakes]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMistakes();
  };

  const handleStatusChange = async (mistake: Mistake) => {
    const nextStatus = mistake.status === 'unresolved' ? 'reviewed' : mistake.status === 'reviewed' ? 'mastered' : 'unresolved';
    const { error } = await supabase.from('mistakes').update({ status: nextStatus }).eq('id', mistake.id);
    if (error) {
      Alert.alert('Error', 'Could not update status.');
      return;
    }
    loadMistakes();
  };

  const handleDelete = (mistake: Mistake) => {
    Alert.alert('Delete mistake?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('mistakes').delete().eq('id', mistake.id);
          if (error) {
            Alert.alert('Error', 'Could not delete.');
            return;
          }
          loadMistakes();
        },
      },
    ]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffHrs = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
    if (diffHrs < 1) return 'Just now';
    if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
    if (diffHrs < 168) return `${Math.floor(diffHrs / 24)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getMistakeColor = (type: MistakeType) => {
    return MISTAKE_TYPES.find((m) => m.label === type)?.color || Colors.neutral[400];
  };

  const getStatusColor = (status: string) => {
    if (status === 'mastered') return Colors.success[500];
    if (status === 'reviewed') return Colors.warning[500];
    return Colors.neutral[400];
  };

  const renderMistake = ({ item }: { item: Mistake }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onLongPress={() => handleDelete(item)}
      delayLongPress={500}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.typeBar, { backgroundColor: getMistakeColor(item.mistake_type) }]} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTags}>
            <View style={[styles.subjectTag, { backgroundColor: (item.subject?.color || Colors.neutral[400]) + '20' }]}>
              <View style={[styles.subjectDot, { backgroundColor: item.subject?.color || Colors.neutral[400] }]} />
              <Text style={styles.subjectTagText}>{item.subject?.name}</Text>
            </View>
            <Text style={styles.chapterText}>{item.chapter?.name}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        </View>

        <View style={[styles.mistakeTypeBadge, { backgroundColor: getMistakeColor(item.mistake_type) + '18' }]}>
          <Text style={[styles.mistakeTypeText, { color: getMistakeColor(item.mistake_type) }]}>
            {item.mistake_type}
          </Text>
        </View>

        {item.question_text ? (
          <Text style={styles.questionText} numberOfLines={2}>{item.question_text}</Text>
        ) : null}

        {item.notes ? (
          <Text style={styles.notesText} numberOfLines={2}>{item.notes}</Text>
        ) : null}

        <TouchableOpacity
          style={styles.statusRow}
          onPress={() => handleStatusChange(item)}
          activeOpacity={0.6}
        >
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status === 'unresolved' ? 'Unresolved' : item.status === 'reviewed' ? 'Reviewed' : 'Mastered'}
          </Text>
          <Text style={styles.tapHint}>  · tap to cycle</Text>
        </TouchableOpacity>
      </View>
      <ChevronRight size={18} color={Colors.neutral[300]} style={styles.chevron} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Mistakes"
        subtitle={`${mistakes.length} logged`}
        right={
          <TouchableOpacity
            style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} color={showFilters ? Colors.primary[600] : Colors.neutral[500]} />
          </TouchableOpacity>
        }
      />

      {/* Search */}
      <View style={styles.searchWrap}>
        <Search size={18} color={Colors.neutral[400]} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by chapter, notes, question..."
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

      {/* Filter Chips */}
      {showFilters && (
        <View style={styles.filterRow}>
          <ScrollView showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
            <FilterChip label="All" active={activeFilter === 'All'} onPress={() => setActiveFilter('All')} color={Colors.neutral[700]} />
            {MISTAKE_TYPES.map((mt) => (
              <FilterChip
                key={mt.label}
                label={mt.label}
                active={activeFilter === mt.label}
                onPress={() => setActiveFilter(mt.label)}
                color={mt.color}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[600]} />
        </View>
      ) : mistakes.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={48} color={Colors.neutral[300]} />}
          title="No mistakes logged yet"
          message="Head to the Capture tab to snap a photo and log your first mistake."
        />
      ) : (
        <FlatList
          data={mistakes}
          keyExtractor={(item) => item.id}
          renderItem={renderMistake}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary[600]} />}
        />
      )}
    </SafeAreaView>
  );
}

function FilterChip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color: string }) {
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

import { ScrollView } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  filterRow: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  filterScrollContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    backgroundColor: Colors.neutral[0],
    marginRight: Spacing.sm,
  },
  chipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.neutral[600],
  },
  chipTextActive: {
    color: Colors.neutral[0],
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral[0],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[100],
    overflow: 'hidden',
    shadowColor: Colors.neutral[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLeft: {
    width: 4,
  },
  typeBar: {
    flex: 1,
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  cardTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  subjectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 5,
  },
  subjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subjectTagText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.neutral[700],
  },
  chapterText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.neutral[500],
    flex: 1,
  },
  dateText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.neutral[400],
  },
  mistakeTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  mistakeTypeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  questionText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.neutral[800],
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  notesText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.neutral[500],
    lineHeight: 18,
    fontStyle: 'italic',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[100],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    marginLeft: Spacing.xs,
  },
  tapHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.neutral[300],
  },
  chevron: {
    alignSelf: 'center',
    marginRight: Spacing.md,
  },
});
