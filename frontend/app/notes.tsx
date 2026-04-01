import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { notesStorage, noteSectionsStorage, NoteItem as Note, NoteSection as Section } from '@/src/services/storage';
import { CLOUD_SYNC_ENABLED } from '@/src/config/runtime';

export default function NotesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const cloudSyncEnabled = CLOUD_SYNC_ENABLED;
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [newSectionName, setNewSectionName] = useState('');
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [editorModalVisible, setEditorModalVisible] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const syncToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSyncToast = useCallback((text: string, type: 'success' | 'error') => {
    if (syncToastTimerRef.current) {
      clearTimeout(syncToastTimerRef.current);
    }
    setSyncToast({ text, type });
    syncToastTimerRef.current = setTimeout(() => {
      setSyncToast(null);
      syncToastTimerRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (syncToastTimerRef.current) {
        clearTimeout(syncToastTimerRef.current);
      }
    };
  }, []);

  const loadNotes = useCallback(async () => {
    try {
      const notesArray = await notesStorage.getAll();
      const sorted = [...notesArray].sort((a: Note, b: Note) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
      setNotes(sorted);
      if (cloudSyncEnabled) {
        setLastSyncedAt(Date.now());
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      setNotes([]);
    }
  }, [cloudSyncEnabled]);

  const loadSections = useCallback(async () => {
    try {
      const sectionsArray = await noteSectionsStorage.getAll();
      setSections(sectionsArray);
    } catch (error) {
      console.error('Error loading sections:', error);
      setSections([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSections();
      loadNotes();
    }, [loadSections, loadNotes])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotes();
    setRefreshing(false);
  }, [loadNotes]);

  const handleManualSync = useCallback(async () => {
    if (!cloudSyncEnabled || isManualSyncing) return;
    setIsManualSyncing(true);
    try {
      await Promise.all([loadSections(), loadNotes()]);
      setLastSyncedAt(Date.now());
      showSyncToast('Synced successfully', 'success');
    } catch (error) {
      console.error('Manual sync failed:', error);
      showSyncToast('Sync failed', 'error');
    } finally {
      setIsManualSyncing(false);
    }
  }, [cloudSyncEnabled, isManualSyncing, loadSections, loadNotes, showSyncToast]);

  const saveNote = useCallback(async () => {
    if (!noteContent.trim()) {
      Alert.alert('Empty Note', 'Please enter some content for the note.');
      return;
    }

    if (!selectedSectionId) {
      Alert.alert('No Section', 'Please select or create a section first.');
      return;
    }

    try {
      if (editingNoteId) {
        await notesStorage.update(editingNoteId, {
          content: noteContent.trim(),
          sectionId: selectedSectionId,
        });
      } else {
        await notesStorage.add({
          content: noteContent.trim(),
          sectionId: selectedSectionId,
          updatedAt: Date.now(),
        });
      }

      setNoteContent('');
      setEditingNoteId(null);
      setEditorModalVisible(false);
      await loadNotes();
      if (cloudSyncEnabled) {
        setLastSyncedAt(Date.now());
      }
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note.');
    }
  }, [noteContent, selectedSectionId, editingNoteId, loadNotes, cloudSyncEnabled]);

  const deleteNote = useCallback(
    async (noteId: string) => {
      Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await notesStorage.delete(noteId);
              await loadNotes();
              if (cloudSyncEnabled) {
                setLastSyncedAt(Date.now());
              }
            } catch (error) {
              console.error('Error deleting note:', error);
              Alert.alert('Error', 'Failed to delete note.');
            }
          },
        },
      ]);
    },
    [loadNotes, cloudSyncEnabled]
  );

  const createSection = useCallback(async () => {
    if (!newSectionName.trim()) {
      Alert.alert('Empty Section', 'Please enter a section name.');
      return;
    }

    try {
      const newSection = await noteSectionsStorage.add({
        name: newSectionName.trim(),
        updatedAt: Date.now(),
      });

      setNewSectionName('');
      setShowSectionModal(false);
      setSelectedSectionId(newSection.id);
      await loadSections();
      if (cloudSyncEnabled) {
        setLastSyncedAt(Date.now());
      }
    } catch (error) {
      console.error('Error creating section:', error);
      Alert.alert('Error', 'Failed to create section.');
    }
  }, [newSectionName, loadSections, cloudSyncEnabled]);

  const deleteSection = useCallback(
    async (sectionId: string) => {
      Alert.alert('Delete Section', 'This will delete the section and all its notes. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const sectionsArray = await noteSectionsStorage.getAll();
              const filteredSections = sectionsArray.filter((sec: Section) => sec.id !== sectionId);
              await noteSectionsStorage.saveAll(filteredSections);

              const notesArray = await notesStorage.getAll();
              const filteredNotes = notesArray.filter((note: Note) => note.sectionId !== sectionId);
              await notesStorage.saveAll(filteredNotes);

              if (selectedSectionId === sectionId && filteredSections.length > 0) {
                setSelectedSectionId(filteredSections[0].id);
              } else if (selectedSectionId === sectionId) {
                setSelectedSectionId('');
              }

              await loadSections();
              await loadNotes();
              if (cloudSyncEnabled) {
                setLastSyncedAt(Date.now());
              }
            } catch (error) {
              console.error('Error deleting section:', error);
              Alert.alert('Error', 'Failed to delete section.');
            }
          },
        },
      ]);
    },
    [selectedSectionId, loadSections, loadNotes, cloudSyncEnabled]
  );

  const formatRelativeSync = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    return date.toLocaleDateString('en-US', options);
  };


  const getNotesForSection = (sectionId: string) => {
    return notes.filter((note) => note.sectionId === sectionId);
  };

  const editNote = (note: Note) => {
    setEditingNoteId(note.id);
    setNoteContent(note.content);
    setEditorModalVisible(true);
  };

  const createNewNote = () => {
    if (!selectedSectionId) {
      Alert.alert('No Section', 'Please select a section first.');
      return;
    }
    setEditingNoteId(null);
    setNoteContent('');
    setEditorModalVisible(true);
  };

  const closeEditor = () => {
    setNoteContent('');
    setEditingNoteId(null);
    setEditorModalVisible(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notes</Text>
          <Text style={[styles.syncStatusText, { color: colors.textSecondary }]}>
            {cloudSyncEnabled ? 'Offline + Cloud sync' : 'Offline only'}
          </Text>
          {cloudSyncEnabled && (
            <Text style={[styles.syncMetaText, { color: colors.textSecondary }]}>
              {lastSyncedAt ? `Last sync: ${formatRelativeSync(lastSyncedAt)}` : 'Last sync: pending'}
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {cloudSyncEnabled && (
            <TouchableOpacity
              onPress={handleManualSync}
              disabled={isManualSyncing}
              style={[
                styles.syncButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name={isManualSyncing ? 'sync' : 'sync-outline'}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push('/')}
            style={[
              styles.syncButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="home-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sections Tabs */}
      <View style={[styles.sectionsTabsContainer, { borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionsTabsContent}
        >
          {sections.map((section) => (
            <TouchableOpacity
              key={section.id}
              onPress={() => setSelectedSectionId(section.id)}
              onLongPress={() => deleteSection(section.id)}
              style={[
                styles.sectionTab,
                {
                  backgroundColor:
                    selectedSectionId === section.id ? colors.primary : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.sectionTabText,
                  {
                    color:
                      selectedSectionId === section.id
                        ? colors.surface
                        : colors.text,
                    fontWeight:
                      selectedSectionId === section.id ? '700' : '500',
                  },
                ]}
              >
                {section.name}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Add Section Button */}
          <TouchableOpacity
            onPress={() => setShowSectionModal(true)}
            style={[
              styles.sectionTab,
              { backgroundColor: 'transparent' },
            ]}
          >
            <Ionicons name="add" size={20} color={colors.primary} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Notes List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.notesListContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {selectedSectionId && getNotesForSection(selectedSectionId).length > 0 ? (
          <View style={styles.notesList}>
            {getNotesForSection(selectedSectionId).map((note) => (
              <TouchableOpacity
                key={note.id}
                onPress={() => editNote(note)}
                style={[
                  styles.noteCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.noteCardHeader}>
                  <Text
                    style={[styles.noteCardTitle, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {note.content}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>
                <Text
                  style={[styles.noteCardDate, { color: colors.textSecondary }]}
                >
                  {formatDateTime(note.updatedAt)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : selectedSectionId ? (
          <View
            style={[
              styles.emptyStateContainer,
              { backgroundColor: colors.surface },
            ]}
          >
            <Ionicons
              name="document-text-outline"
              size={48}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
              No notes yet
            </Text>
            <Text
              style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}
            >
              Tap the + button to create your first note
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.emptyStateContainer,
              { backgroundColor: colors.surface },
            ]}
          >
            <Ionicons
              name="folder-outline"
              size={48}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
              No sections yet
            </Text>
            <Text
              style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}
            >
              Create a section to get started
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Editor Modal */}
      <Modal
        visible={editorModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeEditor}
      >
        <SafeAreaView
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            {/* Modal Header */}
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: colors.border },
              ]}
            >
              <TouchableOpacity onPress={closeEditor}>
                <Text style={[styles.modalHeaderButton, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingNoteId ? 'Edit Note' : 'New Note'}
              </Text>
              <TouchableOpacity onPress={saveNote}>
                <Text style={[styles.modalHeaderButton, { color: colors.primary }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>

            {/* Editor Content */}
            <View style={styles.editorContent}>
              <TextInput
                style={[
                  styles.noteTextInput,
                  {
                    backgroundColor: colors.card,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Write your note here..."
                placeholderTextColor={colors.textSecondary}
                multiline
                textAlignVertical="top"
                value={noteContent}
                onChangeText={setNoteContent}
              />
            </View>

            {/* Delete Button */}
            {editingNoteId && (
              <TouchableOpacity
                onPress={() => deleteNote(editingNoteId)}
                style={[
                  styles.deleteNoteButton,
                  { backgroundColor: colors.danger + '15' },
                ]}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                <Text style={[styles.deleteNoteButtonText, { color: colors.danger }]}>
                  Delete Note
                </Text>
              </TouchableOpacity>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Add Section Modal */}
      <Modal
        visible={showSectionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSectionModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.sectionModalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionModalTitle, { color: colors.text }]}>
              New Section
            </Text>
            <TextInput
              style={[
                styles.sectionModalInput,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Section name"
              placeholderTextColor={colors.textSecondary}
              value={newSectionName}
              onChangeText={setNewSectionName}
              autoFocus
            />
            <View style={styles.sectionModalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setNewSectionName('');
                  setShowSectionModal(false);
                }}
                style={[
                  styles.sectionModalButton,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Text style={[styles.sectionModalButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={createSection}
                style={[
                  styles.sectionModalButton,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.sectionModalButtonText,
                    { color: colors.surface },
                  ]}
                >
                  Create
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Action Button */}
      {syncToast && (
        <View
          style={[
            styles.syncToast,
            { backgroundColor: syncToast.type === 'success' ? '#16A34A' : colors.danger },
          ]}
        >
          <Text style={styles.syncToastText}>{syncToast.text}</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={createNewNote}
        style={[styles.fab, { backgroundColor: colors.primary }]}
      >
        <Ionicons name="add" size={56} color={colors.surface} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerBackButton: {
    width: 80,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  syncStatusText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.85,
  },
  syncMetaText: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.7,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 80,
    justifyContent: 'flex-end',
  },
  syncButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncToast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 120,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    zIndex: 10,
  },
  syncToastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // Sections Tabs
  sectionsTabsContainer: {
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  sectionsTabsContent: {
    paddingHorizontal: 24,
    gap: 12,
  },
  sectionTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Notes List
  notesListContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 12,
  },
  notesList: {
    gap: 12,
  },
  noteCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  noteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  noteCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    flex: 1,
  },
  noteCardDate: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    opacity: 0.7,
  },
  // Empty State
  emptyStateContainer: {
    marginTop: 60,
    paddingHorizontal: 40,
    paddingVertical: 60,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Editor Modal
  modalContainer: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalHeaderButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  editorContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  noteTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    textAlignVertical: 'top',
  },
  deleteNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 12,
    gap: 8,
  },
  deleteNoteButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Section Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionModalContent: {
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 24,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  sectionModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  sectionModalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 20,
  },
  sectionModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionModalButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
});

