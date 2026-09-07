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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, X, Check, ImagePlus, ChevronDown, Tag, StickyNote, Zap } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, Spacing } from '@/lib/theme';
import { supabase, Subject, Chapter, MistakeType, MISTAKE_TYPES } from '@/lib/supabase';

export default function CaptureScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [selectedMistakeType, setSelectedMistakeType] = useState<MistakeType | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [showSubjectSheet, setShowSubjectSheet] = useState(false);
  const [showChapterSheet, setShowChapterSheet] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    const { data, error } = await supabase.from('subjects').select('*').order('name');
    if (error) {
      Alert.alert('Error', 'Could not load subjects.');
    } else {
      setSubjects(data || []);
    }
    setLoading(false);
  };

  const loadChapters = useCallback(async (subjectId: string) => {
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('subject_id', subjectId)
      .order('name');
    if (error) {
      Alert.alert('Error', 'Could not load chapters.');
    } else {
      setChapters(data || []);
    }
  }, []);

  const handleSubjectSelect = (subject: Subject) => {
    setSelectedSubject(subject);
    setSelectedChapter(null);
    setShowSubjectSheet(false);
    loadChapters(subject.id);
  };

  const handleSave = async () => {
    if (!selectedSubject || !selectedChapter || !selectedMistakeType) {
      Alert.alert('Missing info', 'Please select subject, chapter, and mistake type.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('mistakes').insert({
      photo_url: photoTaken ? 'camera://captured' : null,
      subject_id: selectedSubject.id,
      chapter_id: selectedChapter.id,
      mistake_type: selectedMistakeType,
      question_text: questionText.trim() || null,
      notes: notes.trim() || null,
      status: 'unresolved',
    });

    setSaving(false);

    if (error) {
      Alert.alert('Error', 'Could not save mistake. Please try again.');
      return;
    }

    Alert.alert('Saved!', 'Your mistake has been logged.', [{ text: 'OK' }]);
    resetForm();
  };

  const resetForm = () => {
    setPhotoTaken(false);
    setSelectedSubject(null);
    setSelectedChapter(null);
    setSelectedMistakeType(null);
    setQuestionText('');
    setNotes('');
    setChapters([]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[600]} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Capture"
        subtitle="Snap and tag your mistakes"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo Capture */}
          <TouchableOpacity
            style={styles.photoArea}
            activeOpacity={0.85}
            onPress={() => setPhotoTaken(!photoTaken)}
          >
            {photoTaken ? (
              <View style={styles.photoPreview}>
                <View style={styles.photoPlaceholderImg}>
                  <Camera size={48} color={Colors.neutral[0]} strokeWidth={1.5} />
                </View>
                <View style={styles.photoOverlay}>
                  <TouchableOpacity
                    style={styles.retakeBtn}
                    onPress={() => setPhotoTaken(true)}
                  >
                    <Check size={18} color={Colors.neutral[0]} />
                    <Text style={styles.retakeText}>Photo captured</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => setPhotoTaken(false)}
                  >
                    <X size={16} color={Colors.neutral[0]} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.photoPlaceholder}>
                <ImagePlus size={40} color={Colors.neutral[400]} strokeWidth={1.5} />
                <Text style={styles.photoLabel}>Tap to snap a photo</Text>
                <Text style={styles.photoSubtext}>Capture the question from your test sheet</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Subject Selector */}
          <Text style={styles.sectionLabel}>Subject</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowSubjectSheet(!showSubjectSheet)}
            activeOpacity={0.7}
          >
            {selectedSubject ? (
              <View style={styles.dropdownSelected}>
                <View style={[styles.subjectDot, { backgroundColor: selectedSubject.color }]} />
                <Text style={styles.dropdownText}>{selectedSubject.name}</Text>
              </View>
            ) : (
              <Text style={styles.dropdownPlaceholder}>Select a subject</Text>
            )}
            <ChevronDown size={20} color={Colors.neutral[400]} />
          </TouchableOpacity>

          {showSubjectSheet && (
            <View style={styles.sheet}>
              {subjects.map((subject) => (
                <TouchableOpacity
                  key={subject.id}
                  style={styles.sheetItem}
                  onPress={() => handleSubjectSelect(subject)}
                >
                  <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
                  <Text style={styles.sheetItemText}>{subject.name}</Text>
                  {selectedSubject?.id === subject.id && (
                    <Check size={18} color={Colors.primary[600]} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Chapter Selector */}
          <Text style={styles.sectionLabel}>Chapter</Text>
          <TouchableOpacity
            style={[styles.dropdown, !selectedSubject && styles.dropdownDisabled]}
            disabled={!selectedSubject}
            onPress={() => setShowChapterSheet(!showChapterSheet)}
            activeOpacity={0.7}
          >
            {selectedChapter ? (
              <Text style={styles.dropdownText}>{selectedChapter.name}</Text>
            ) : (
              <Text style={styles.dropdownPlaceholder}>
                {selectedSubject ? 'Select a chapter' : 'Pick a subject first'}
              </Text>
            )}
            <ChevronDown size={20} color={Colors.neutral[400]} />
          </TouchableOpacity>

          {showChapterSheet && selectedSubject && (
            <View style={styles.sheet}>
              {chapters.map((chapter) => (
                <TouchableOpacity
                  key={chapter.id}
                  style={styles.sheetItem}
                  onPress={() => {
                    setSelectedChapter(chapter);
                    setShowChapterSheet(false);
                  }}
                >
                  <Text style={styles.sheetItemText}>{chapter.name}</Text>
                  {selectedChapter?.id === chapter.id && (
                    <Check size={18} color={Colors.primary[600]} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Mistake Type */}
          <Text style={styles.sectionLabel}>Mistake Type</Text>
          <View style={styles.mistakeTypeGrid}>
            {MISTAKE_TYPES.map((mt) => {
              const selected = selectedMistakeType === mt.label;
              return (
                <TouchableOpacity
                  key={mt.label}
                  style={[
                    styles.mistakeTypeCard,
                    selected && { backgroundColor: mt.color, borderColor: mt.color },
                  ]}
                  onPress={() => setSelectedMistakeType(mt.label)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.mistakeTypeIcon, selected && styles.mistakeTypeIconActive]}>
                    <Tag size={18} color={selected ? Colors.neutral[0] : mt.color} strokeWidth={2} />
                  </View>
                  <Text
                    style={[
                      styles.mistakeTypeLabel,
                      selected && styles.mistakeTypeLabelActive,
                    ]}
                    numberOfLines={2}
                  >
                    {mt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Question Text */}
          <Text style={styles.sectionLabel}>Question (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Type or paste the question text..."
            placeholderTextColor={Colors.neutral[400]}
            value={questionText}
            onChangeText={setQuestionText}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Notes */}
          <Text style={styles.sectionLabel}>Notes (optional)</Text>
          <View style={styles.notesWrap}>
            <StickyNote size={18} color={Colors.neutral[400]} style={styles.notesIcon} />
            <TextInput
              style={styles.notesInput}
              placeholder="What went wrong? What's the fix?"
              placeholderTextColor={Colors.neutral[400]}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.neutral[0]} />
            ) : (
              <>
                <Zap size={20} color={Colors.neutral[0]} />
                <Text style={styles.saveBtnText}>Log Mistake</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  photoArea: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  photoPlaceholder: {
    backgroundColor: Colors.neutral[100],
    borderWidth: 2,
    borderColor: Colors.neutral[200],
    borderStyle: 'dashed',
    borderRadius: 20,
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.neutral[600],
    marginTop: Spacing.md,
  },
  photoSubtext: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.neutral[400],
    marginTop: Spacing.xs,
  },
  photoPreview: {
    backgroundColor: Colors.neutral[800],
    borderRadius: 20,
    height: 200,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderImg: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    gap: Spacing.xs,
  },
  retakeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.neutral[0],
  },
  removeBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: Spacing.sm,
    borderRadius: 12,
  },
  sectionLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.neutral[600],
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.neutral[0],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md + 2,
    marginBottom: Spacing.sm,
  },
  dropdownDisabled: {
    opacity: 0.5,
  },
  dropdownSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dropdownText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: Colors.neutral[900],
  },
  dropdownPlaceholder: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: Colors.neutral[400],
  },
  subjectDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  sheet: {
    backgroundColor: Colors.neutral[0],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: 14,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
    gap: Spacing.sm,
  },
  sheetItemText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.neutral[800],
  },
  mistakeTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  mistakeTypeCard: {
    width: '48%',
    backgroundColor: Colors.neutral[0],
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    borderRadius: 14,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  mistakeTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  mistakeTypeIconActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  mistakeTypeLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.neutral[700],
    textAlign: 'center',
  },
  mistakeTypeLabelActive: {
    color: Colors.neutral[0],
  },
  input: {
    backgroundColor: Colors.neutral[0],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.neutral[900],
    minHeight: 80,
    marginBottom: Spacing.sm,
    textAlignVertical: 'top',
  },
  notesWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.neutral[0],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  notesIcon: {
    marginTop: 3,
  },
  notesInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.neutral[900],
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[600],
    borderRadius: 16,
    paddingVertical: Spacing.md + 2,
    gap: Spacing.sm,
    shadowColor: Colors.primary[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.neutral[0],
  },
});
