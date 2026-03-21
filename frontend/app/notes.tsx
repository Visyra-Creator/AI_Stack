import React, { useState, useCallback } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Note {
  id: string;
  content: string;
  sectionId: string;
  createdAt: number;
  updatedAt: number;
}

interface Section {
  id: string;
  name: string;
  createdAt: number;
}

export default function NotesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [notes, setNotes] = useState<Note[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [newSectionName, setNewSectionName] = useState('');
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [editorModalVisible, setEditorModalVisible] = useState(false);

  const loadNotes = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('notes');
      if (!data) {
        setNotes([]);
        return;
      }
      const notesArray = JSON.parse(data);
      if (!Array.isArray(notesArray)) {
        console.error('Notes data is not an array, clearing...');
        await AsyncStorage.removeItem('notes');
        setNotes([]);
        return;
      }
      const sorted = notesArray.sort((a: Note, b: Note) => b.updatedAt - a.updatedAt);
      setNotes(sorted);
    } catch (error) {
      console.error('Error loading notes:', error);
      // Clear corrupted data
      try {
        await AsyncStorage.removeItem('notes');
      } catch (e) {
        console.error('Error clearing notes:', e);
      }
      setNotes([]);
    }
  }, []);

  const loadSections = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('noteSections');
      if (!data) {
        setSections([]);
        return;
      }
      const sectionsArray = JSON.parse(data);
      if (!Array.isArray(sectionsArray)) {
        console.error('Sections data is not an array, clearing...');
        await AsyncStorage.removeItem('noteSections');
        setSections([]);
        return;
      }
      setSections(sectionsArray);
    } catch (error) {
      console.error('Error loading sections:', error);
      // Clear corrupted data
      try {
        await AsyncStorage.removeItem('noteSections');
      } catch (e) {
        console.error('Error clearing sections:', e);
      }
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
      const data = await AsyncStorage.getItem('notes');
      let notesArray: Note[] = [];

      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            notesArray = parsed;
          } else {
            console.warn('Stored notes data is not an array, starting fresh');
            notesArray = [];
          }
        } catch {
          console.warn('Failed to parse stored notes, starting fresh');
          notesArray = [];
        }
      }

      if (editingNoteId) {
        // Update existing note
        notesArray = notesArray.map((note: Note) =>
          note.id === editingNoteId
            ? { ...note, content: noteContent.trim(), updatedAt: Date.now() }
            : note
        );
      } else {
        // Create new note
        const newNote: Note = {
          id: Date.now().toString(),
          content: noteContent.trim(),
          sectionId: selectedSectionId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        notesArray.push(newNote);
      }

      await AsyncStorage.setItem('notes', JSON.stringify(notesArray));
      setNoteContent('');
      setEditingNoteId(null);
      setEditorModalVisible(false);
      await loadNotes();
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note.');
    }
  }, [noteContent, selectedSectionId, editingNoteId, loadNotes]);

  const deleteNote = useCallback(
    async (noteId: string) => {
      Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const data = await AsyncStorage.getItem('notes');
              let notesArray: Note[] = [];

              if (data) {
                try {
                  const parsed = JSON.parse(data);
                  if (Array.isArray(parsed)) {
                    notesArray = parsed;
                  }
                } catch {
                  console.warn('Failed to parse notes');
                }
              }

              const filtered = notesArray.filter((note: Note) => note.id !== noteId);
              await AsyncStorage.setItem('notes', JSON.stringify(filtered));
              await loadNotes();
            } catch (error) {
              console.error('Error deleting note:', error);
              Alert.alert('Error', 'Failed to delete note.');
            }
          },
        },
      ]);
    },
    [loadNotes]
  );

  const createSection = useCallback(async () => {
    if (!newSectionName.trim()) {
      Alert.alert('Empty Section', 'Please enter a section name.');
      return;
    }

    try {
      const data = await AsyncStorage.getItem('noteSections');
      let sectionsArray: Section[] = [];

      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            sectionsArray = parsed;
          } else {
            console.warn('Stored sections data is not an array');
            sectionsArray = [];
          }
        } catch {
          console.warn('Failed to parse stored sections');
          sectionsArray = [];
        }
      }

      const newSection: Section = {
        id: Date.now().toString(),
        name: newSectionName.trim(),
        createdAt: Date.now(),
      };

      sectionsArray.push(newSection);
      await AsyncStorage.setItem('noteSections', JSON.stringify(sectionsArray));

      setNewSectionName('');
      setShowSectionModal(false);
      setSelectedSectionId(newSection.id);
      await loadSections();
    } catch (error) {
      console.error('Error creating section:', error);
      Alert.alert('Error', 'Failed to create section.');
    }
  }, [newSectionName, loadSections]);

  const deleteSection = useCallback(
    async (sectionId: string) => {
      Alert.alert('Delete Section', 'This will delete the section and all its notes. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete section
              const sectionsData = await AsyncStorage.getItem('noteSections');
              let sectionsArray: Section[] = [];

              if (sectionsData) {
                try {
                  const parsed = JSON.parse(sectionsData);
                  if (Array.isArray(parsed)) {
                    sectionsArray = parsed;
                  }
                } catch {
                  console.warn('Failed to parse sections');
                }
              }

              const filteredSections = sectionsArray.filter((sec: Section) => sec.id !== sectionId);
              await AsyncStorage.setItem('noteSections', JSON.stringify(filteredSections));

              // Delete notes in this section
              const notesData = await AsyncStorage.getItem('notes');
              let notesArray: Note[] = [];

              if (notesData) {
                try {
                  const parsed = JSON.parse(notesData);
                  if (Array.isArray(parsed)) {
                    notesArray = parsed;
                  }
                } catch {
                  console.warn('Failed to parse notes');
                }
              }

              const filteredNotes = notesArray.filter((note: Note) => note.sectionId !== sectionId);
              await AsyncStorage.setItem('notes', JSON.stringify(filteredNotes));

              if (selectedSectionId === sectionId && filteredSections.length > 0) {
                setSelectedSectionId(filteredSections[0].id);
              } else if (selectedSectionId === sectionId) {
                setSelectedSectionId('');
              }

              await loadSections();
              await loadNotes();
            } catch (error) {
              console.error('Error deleting section:', error);
              Alert.alert('Error', 'Failed to delete section.');
            }
          },
        },
      ]);
    },
    [selectedSectionId, loadSections, loadNotes]
  );

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
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notes</Text>
        <View style={{ width: 28 }} />
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

