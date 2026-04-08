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
import { notesStorage, noteSectionsStorage, NoteItem as Note, NoteSection as Section, migrateNotesToRichTextFormat } from '@/src/services/storage';
import { CLOUD_SYNC_ENABLED } from '@/src/config/runtime';
import AdvancedRichTextEditor from '@/src/components/AdvancedRichTextEditor';
import * as DocumentPicker from 'expo-document-picker';
import { openUriExternally } from '@/src/services/fileOpener';

type NoteAttachmentMeta = {
  name?: string;
  uri?: string;
  size?: number;
  mimeType?: string;
  kind?: 'document' | 'website';
};

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
  const [showManageSectionsModal, setShowManageSectionsModal] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteStructuredContent, setNoteStructuredContent] = useState('');
  const [noteFiles, setNoteFiles] = useState<string[]>([]);
  const [noteAttachmentMenuVisible, setNoteAttachmentMenuVisible] = useState(false);
  const [noteUrlModalVisible, setNoteUrlModalVisible] = useState(false);
  const [noteUrlMode, setNoteUrlMode] = useState<'document' | 'website'>('website');
  const [noteUrlName, setNoteUrlName] = useState('');
  const [noteUrlValue, setNoteUrlValue] = useState('');
  const [editorModalVisible, setEditorModalVisible] = useState(false);
  const [noteDetailsModalVisible, setNoteDetailsModalVisible] = useState(false);
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
      // Run migration on first load
      await migrateNotesToRichTextFormat();

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
     if (!noteTitle.trim()) {
       Alert.alert('Missing Title', 'Please enter a note title.');
       return;
     }

     if (!noteContent.trim()) {
       Alert.alert('Empty Note', 'Please enter some content for the note.');
       return;
     }

     if (!selectedSectionId) {
       Alert.alert('No Section', 'Please select or create a section first.');
       return;
     }

     try {
       const contentToSave = noteContent.trim();

       if (editingNoteId) {
         await notesStorage.update(editingNoteId, {
            title: noteTitle.trim(),
           content: contentToSave,
            richContent: noteStructuredContent,
            contentVersion: 3,
            files: noteFiles,
            sectionId: selectedSectionId,
         });
       } else {
         await notesStorage.add({
            title: noteTitle.trim(),
           content: contentToSave,
            richContent: noteStructuredContent,
            contentVersion: 3,
            files: noteFiles,
            sectionId: selectedSectionId,
            updatedAt: Date.now(),
         });
       }

       setNoteTitle('');
       setNoteContent('');
       setNoteStructuredContent('');
       setNoteFiles([]);
       setNoteAttachmentMenuVisible(false);
       setNoteUrlValue('');
       setNoteUrlModalVisible(false);
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
   }, [noteTitle, noteContent, noteStructuredContent, noteFiles, selectedSectionId, editingNoteId, loadNotes, cloudSyncEnabled]);

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
      const normalizedName = newSectionName.trim();
      const duplicate = sections.some(
        (section) =>
          section.name.toLowerCase() === normalizedName.toLowerCase() && section.id !== editingSectionId,
      );

      if (duplicate) {
        Alert.alert('Duplicate Section', 'A section with this name already exists.');
        return;
      }

      if (editingSectionId) {
        await noteSectionsStorage.update(editingSectionId, {
          name: normalizedName,
          updatedAt: Date.now(),
        });
      } else {
        const newSection = await noteSectionsStorage.add({
          name: normalizedName,
          updatedAt: Date.now(),
        });
        setSelectedSectionId(newSection.id);
      }

      setNewSectionName('');
      setEditingSectionId(null);
      setShowSectionModal(false);
      await loadSections();
      if (cloudSyncEnabled) {
        setLastSyncedAt(Date.now());
      }
    } catch (error) {
      console.error('Error creating section:', error);
      Alert.alert('Error', 'Failed to create section.');
    }
  }, [newSectionName, sections, editingSectionId, loadSections, cloudSyncEnabled]);

  const startEditSection = useCallback((section: Section) => {
    setEditingSectionId(section.id);
    setNewSectionName(section.name);
    setShowSectionModal(true);
    setShowManageSectionsModal(false);
  }, []);

  const moveSection = useCallback(
    async (sectionId: string, direction: 'up' | 'down') => {
      const index = sections.findIndex((s) => s.id === sectionId);
      if (index === -1) return;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= sections.length) return;

      try {
        const reordered = [...sections];
        [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
        await noteSectionsStorage.saveAll(reordered);
        setSections(reordered);
        if (cloudSyncEnabled) {
          setLastSyncedAt(Date.now());
        }
      } catch (error) {
        console.error('Error reordering sections:', error);
        Alert.alert('Error', 'Failed to reorder sections.');
      }
    },
    [sections, cloudSyncEnabled],
  );

  const deleteSection = useCallback(
    async (sectionId: string) => {
      Alert.alert('Delete Section', 'This will delete the section and all its notes. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const filteredSections = sections.filter((sec: Section) => sec.id !== sectionId);
              const filteredNotes = notes.filter((note: Note) => note.sectionId !== sectionId);

              // Update UI immediately so deleted sections disappear without waiting for async sync.
              setSections(filteredSections);
              setNotes(filteredNotes);
              setShowManageSectionsModal(false);

              await noteSectionsStorage.saveAll(filteredSections);
              await notesStorage.saveAll(filteredNotes);

              if (selectedSectionId === sectionId && filteredSections.length > 0) {
                setSelectedSectionId(filteredSections[0].id);
              } else if (selectedSectionId === sectionId) {
                setSelectedSectionId('');
              }

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
    [sections, notes, selectedSectionId, cloudSyncEnabled]
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

  const getSectionName = (sectionId: string) => {
    return sections.find((section) => section.id === sectionId)?.name || 'Unknown section';
  };

  const getNoteTitle = (note: Note) => {
    const rawTitle = (note as any)?.title;
    if (typeof rawTitle === 'string' && rawTitle.trim().length > 0) {
      return rawTitle.trim();
    }
    const fallback = (note.content || '').trim().split('\n')[0]?.trim();
    return fallback || 'Untitled note';
  };

  const openNoteDetails = (note: Note) => {
    setSelectedNote(note);
    setNoteDetailsModalVisible(true);
  };

  const editNote = (note: Note) => {
    setEditingNoteId(note.id);
    setNoteTitle(getNoteTitle(note));
    setNoteContent(note.content);
    setNoteStructuredContent(note.richContent || '');
    setNoteFiles(note.files || []);
    setNoteUrlValue('');
    setEditorModalVisible(true);
  };

  const createNewNote = () => {
    if (!selectedSectionId) {
      Alert.alert('No Section', 'Please select a section first.');
      return;
    }
    setEditingNoteId(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteStructuredContent('');
    setNoteFiles([]);
    setNoteAttachmentMenuVisible(false);
    setNoteUrlMode('website');
    setNoteUrlName('');
    setNoteUrlValue('');
    setNoteUrlModalVisible(false);
    setEditorModalVisible(true);
  };

  const closeEditor = () => {
    setNoteTitle('');
    setNoteContent('');
    setNoteStructuredContent('');
    setNoteFiles([]);
    setNoteAttachmentMenuVisible(false);
    setNoteUrlMode('website');
    setNoteUrlName('');
    setNoteUrlValue('');
    setNoteUrlModalVisible(false);
    setEditingNoteId(null);
    setEditorModalVisible(false);
  };

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        const newFiles = result.assets
          .map((asset) => JSON.stringify({ name: asset.name, uri: asset.uri, size: asset.size, mimeType: asset.mimeType }))
          .filter(Boolean);
        if (newFiles.length === 0) return;
        setNoteFiles((prev) => [...prev, ...newFiles]);
      }
    } catch {
      Alert.alert('Unable to pick files', 'Something went wrong while selecting files.');
    }
  };

  const removeFile = (index: number) => {
    setNoteFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const parseAttachment = (fileStr: string): NoteAttachmentMeta | undefined => {
    const trimmed = (fileStr || '').trim();
    if (!trimmed) return undefined;

    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('file://') || trimmed.startsWith('content://')) {
      return { uri: trimmed };
    }

    try {
      const parsed = JSON.parse(trimmed) as NoteAttachmentMeta;
      return {
        name: typeof parsed?.name === 'string' ? parsed.name : undefined,
        uri: typeof parsed?.uri === 'string' ? parsed.uri : undefined,
        size: parsed?.size,
        mimeType: typeof parsed?.mimeType === 'string' ? parsed.mimeType : undefined,
        kind: parsed?.kind === 'website' ? 'website' : parsed?.kind === 'document' ? 'document' : undefined,
      };
    } catch {
      return undefined;
    }
  };

  const isDocumentLikeUri = (uri?: string, name?: string, mimeType?: string) => {
    const lowerUri = (uri || '').toLowerCase();
    const lowerName = (name || '').toLowerCase();
    const lowerMime = (mimeType || '').toLowerCase();
    if (lowerMime.startsWith('application/')) return true;
    if (lowerMime.startsWith('text/')) return true;

    const value = `${lowerName} ${lowerUri}`;
    return /(\.pdf|\.docx?|\.xlsx?|\.pptx?|\.txt|\.rtf|\.csv|\.zip|\.rar)(\?|#|$)/.test(value);
  };

  const isWebsiteAttachment = (fileStr: string) => {
    const meta = parseAttachment(fileStr);
    if (meta?.kind === 'website') return true;
    if (meta?.kind === 'document') return false;

    const uri = (meta?.uri || '').trim();
    if (!/^https?:\/\//i.test(uri)) return false;
    return !isDocumentLikeUri(uri, meta?.name, meta?.mimeType);
  };

  const getFileName = (fileStr: string): string => {
    const directUri = (fileStr || '').trim();
    if (/^https?:\/\//i.test(directUri)) {
      return deriveFileNameFromUrl(directUri);
    }

    try {
      const parsed = JSON.parse(fileStr);
      return parsed.name || 'File';
    } catch {
      return 'File';
    }
  };

  const getFileUri = (fileStr: string): string | undefined => {
    const directUri = (fileStr || '').trim();
    if (
      /^https?:\/\//i.test(directUri) ||
      directUri.startsWith('file://') ||
      directUri.startsWith('content://')
    ) {
      return directUri;
    }

    try {
      const parsed = JSON.parse(fileStr);
      return parsed.uri as string | undefined;
    } catch {
      return undefined;
    }
  };

  const openFile = async (fileStr: string) => {
    const uri = getFileUri(fileStr);
    if (!uri) {
      Alert.alert('Unable to open file', 'This attachment is missing a valid file path.');
      return;
    }
    const result = await openUriExternally(fileStr);
    if (!result.success) {
      Alert.alert('Unable to open file', result.reason || 'No app is available to open this file type.');
    }
  };

  const deriveFileNameFromUrl = (value: string) => {
    try {
      const parsed = new URL(value);
      const parts = parsed.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || parsed.hostname || 'Web file';
    } catch {
      return 'Web file';
    }
  };

  const addUrlAttachment = () => {
    const value = noteUrlValue.trim();
    if (!value) {
      Alert.alert(
        'Invalid URL',
        noteUrlMode === 'document' ? 'Please enter a document link.' : 'Please enter a website URL.',
      );
      return;
    }
    if (!/^https?:\/\//i.test(value)) {
      Alert.alert(
        'Invalid URL',
        noteUrlMode === 'document'
          ? 'Please enter a valid document link (http:// or https://).'
          : 'Please enter a valid website URL (http:// or https://).',
      );
      return;
    }

    const nextAttachment = JSON.stringify({
      name: noteUrlName.trim() || deriveFileNameFromUrl(value),
      uri: value,
      size: 0,
      kind: noteUrlMode === 'document' ? 'document' : 'website',
    });

    setNoteFiles((prev) => [...prev, nextAttachment]);
    setNoteUrlName('');
    setNoteUrlValue('');
    setNoteUrlModalVisible(false);
  };

  const openAttachmentMenu = () => {
    setNoteAttachmentMenuVisible(true);
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
              { marginRight: 52 },
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
            onPress={() => {
              setEditingSectionId(null);
              setNewSectionName('');
              setShowSectionModal(true);
            }}
            style={[
              styles.sectionTab,
              { backgroundColor: 'transparent' },
            ]}
          >
            <Ionicons name="add" size={20} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowManageSectionsModal(true)}
            style={[
              styles.sectionTab,
              { backgroundColor: 'transparent' },
            ]}
          >
            <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
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
                onPress={() => openNoteDetails(note)}
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
                    {getNoteTitle(note)}
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

      {/* Note Details Modal */}
      <Modal
        visible={noteDetailsModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setNoteDetailsModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setNoteDetailsModalVisible(false)}>
              <Text style={[styles.modalHeaderButton, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Note Details</Text>
            <View style={styles.noteDetailsActions}>
              <TouchableOpacity
                onPress={() => {
                  if (!selectedNote) return;
                  setNoteDetailsModalVisible(false);
                  editNote(selectedNote);
                }}
                style={styles.noteDetailsIconButton}
              >
                <Ionicons name="create-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!selectedNote) return;
                  const noteId = selectedNote.id;
                  setNoteDetailsModalVisible(false);
                  setSelectedNote(null);
                  deleteNote(noteId);
                }}
                style={styles.noteDetailsIconButton}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.noteDetailsContent}>
            {selectedNote && (
              <Text style={[styles.noteDetailsTitleText, { color: colors.text }]}>
                {getNoteTitle(selectedNote)}
              </Text>
            )}
            <View style={styles.noteDetailsMetaRow}>
              <View style={[styles.noteDetailsMetaPill, { backgroundColor: colors.surface }]}>
                <Text style={[styles.noteDetailsMetaText, { color: colors.textSecondary }]}>
                  {selectedNote ? getSectionName(selectedNote.sectionId) : ''}
                </Text>
              </View>
              <View style={[styles.noteDetailsMetaPill, { backgroundColor: colors.surface }]}>
                <Text style={[styles.noteDetailsMetaText, { color: colors.textSecondary }]}>
                  {selectedNote ? formatDateTime(selectedNote.updatedAt) : ''}
                </Text>
              </View>
            </View>
            <View style={styles.noteDetailsEditorContainer}>
              <AdvancedRichTextEditor
                key={`details-${selectedNote?.id || 'none'}-${selectedNote?.updatedAt || 0}`}
                value={selectedNote?.content || ''}
                initialStructuredContent={selectedNote?.richContent || ''}
                onChange={() => {}}
                editable={false}
              />
            </View>
            {selectedNote?.files && selectedNote.files.length > 0 && (
              <>
                {selectedNote.files.filter((file) => !isWebsiteAttachment(file)).length > 0 && (
                  <View style={styles.noteFilesSection}>
                    <Text style={[styles.noteFilesLabel, { color: colors.textSecondary }]}>Documents</Text>
                    {selectedNote.files
                      .filter((file) => !isWebsiteAttachment(file))
                      .map((file, index) => (
                        <TouchableOpacity
                          key={`doc-${file}-${index}`}
                          style={[styles.noteFileRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
                          onPress={() => openFile(file)}
                        >
                          <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                          <Text style={[styles.noteFileName, { color: colors.text }]} numberOfLines={1}>
                            {getFileName(file)}
                          </Text>
                          <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                      ))}
                  </View>
                )}

                {selectedNote.files.filter((file) => isWebsiteAttachment(file)).length > 0 && (
                  <View style={styles.noteFilesSection}>
                    <Text style={[styles.noteFilesLabel, { color: colors.textSecondary }]}>Website Links</Text>
                    {selectedNote.files
                      .filter((file) => isWebsiteAttachment(file))
                      .map((file, index) => (
                        <TouchableOpacity
                          key={`url-${file}-${index}`}
                          style={[styles.noteFileRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
                          onPress={() => openFile(file)}
                        >
                          <Ionicons name="globe-outline" size={16} color={colors.primary} />
                          <Text style={[styles.noteFileName, { color: colors.text }]} numberOfLines={1}>
                            {getFileName(file)}
                          </Text>
                          <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
              </>
            )}
           </ScrollView>
         </SafeAreaView>
       </Modal>

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
              <View style={styles.editorHeaderActions}>
                <TouchableOpacity onPress={saveNote} style={styles.editorHeaderSaveButton}>
                  <Text style={[styles.modalHeaderButton, { color: colors.primary }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.noteTitleInputWrap}>
              <TextInput
                style={[styles.noteTitleInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="Note title"
                placeholderTextColor={colors.textSecondary}
                value={noteTitle}
                onChangeText={setNoteTitle}
                maxLength={120}
              />
            </View>

            {/* Advanced Rich Text Editor */}
            <AdvancedRichTextEditor
              key={`edit-${editingNoteId || 'new'}`}
              value={noteContent}
              initialStructuredContent={noteStructuredContent}
              onChange={setNoteContent}
              onChangeStructured={setNoteStructuredContent}
              placeholder="Write your note here..."
              editable={true}
              onPressAttachment={openAttachmentMenu}
              onPressLink={() => {
                setNoteUrlMode('website');
                setNoteUrlModalVisible(true);
              }}
            />

            {noteFiles.length > 0 && (
              <View style={[styles.noteFilesSection, { marginHorizontal: 24, marginTop: 10 }]}>
                <Text style={[styles.noteFilesLabel, { color: colors.textSecondary }]}>Attachments</Text>
                {noteFiles.map((file, index) => (
                  <View
                    key={`${file}-${index}`}
                    style={[styles.noteFileRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  >
                    <Ionicons name="document-outline" size={18} color={colors.primary} />
                    <Text style={[styles.noteFileName, { color: colors.text }]} numberOfLines={1}>
                      {getFileName(file)}
                    </Text>
                    <TouchableOpacity onPress={() => removeFile(index)}>
                      <Ionicons name="close-circle" size={20} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

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

      <Modal
        visible={noteAttachmentMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteAttachmentMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            nativeID="note-attachment-section"
            style={[styles.sectionModalContent, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.sectionModalTitle, { color: colors.text }]}>Add Attachment</Text>

            <TouchableOpacity
              onPress={() => {
                setNoteAttachmentMenuVisible(false);
                pickFiles();
              }}
              nativeID="note-upload-documents-button"
              style={[styles.attachmentMenuItem, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Ionicons name="document-attach-outline" size={18} color={colors.primary} />
              <Text style={[styles.attachmentMenuText, { color: colors.text }]}>Upload Documents</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setNoteAttachmentMenuVisible(false);
                setNoteUrlMode('document');
                setNoteUrlModalVisible(true);
              }}
              nativeID="note-add-url-button"
              style={[styles.attachmentMenuItem, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Ionicons name="link-outline" size={18} color={colors.primary} />
              <Text style={[styles.attachmentMenuText, { color: colors.text }]}>Add Document Link</Text>
            </TouchableOpacity>

            <View style={styles.sectionModalButtons}>
              <TouchableOpacity
                onPress={() => setNoteAttachmentMenuVisible(false)}
                style={[styles.sectionModalButton, { backgroundColor: colors.surface }]}
              >
                <Text style={[styles.sectionModalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setNoteAttachmentMenuVisible(false);
                  pickFiles();
                }}
                style={[styles.sectionModalButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.sectionModalButtonText, { color: colors.surface }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={noteUrlModalVisible} transparent animationType="fade" onRequestClose={() => setNoteUrlModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View
            nativeID="note-url-section"
            style={[styles.sectionModalContent, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.sectionModalTitle, { color: colors.text }]}>
              {noteUrlMode === 'document' ? 'Add Document Link' : 'Add Website URL'}
            </Text>
            <Text style={[styles.sectionModalHint, { color: colors.textSecondary }]}>
              {noteUrlMode === 'document'
                ? 'Mode: Document link'
                : 'Mode: Website URL'}
            </Text>
            <TextInput
              style={[styles.sectionModalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder={noteUrlMode === 'document' ? 'Document name' : 'Website name (optional)'}
              placeholderTextColor={colors.textSecondary}
              value={noteUrlName}
              onChangeText={setNoteUrlName}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <TextInput
              style={[styles.sectionModalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder={noteUrlMode === 'document' ? 'https://example.com/document' : 'https://example.com'}
              placeholderTextColor={colors.textSecondary}
              value={noteUrlValue}
              onChangeText={setNoteUrlValue}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <View style={styles.sectionModalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setNoteUrlName('');
                  setNoteUrlValue('');
                  setNoteUrlModalVisible(false);
                }}
                nativeID="note-url-cancel-button"
                style={[styles.sectionModalButton, { backgroundColor: colors.surface }]}
              >
                <Text style={[styles.sectionModalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={addUrlAttachment}
                nativeID="note-url-add-button"
                style={[styles.sectionModalButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.sectionModalButtonText, { color: colors.surface }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
              {editingSectionId ? 'Edit Section' : 'New Section'}
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
                  setEditingSectionId(null);
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
                  {editingSectionId ? 'Save' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manage Sections Modal */}
      <Modal
        visible={showManageSectionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManageSectionsModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.sectionModalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionModalTitle, { color: colors.text }]}>Manage Sections</Text>
            <ScrollView style={styles.manageSectionsList}>
              {sections.map((section, index) => {
                const noteCount = notes.filter((note) => note.sectionId === section.id).length;
                return (
                  <View key={section.id} style={[styles.manageSectionRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.manageSectionName, { color: colors.text }]} numberOfLines={1}>
                      {section.name} ({noteCount})
                    </Text>
                    <View style={styles.manageSectionActions}>
                      <TouchableOpacity
                        onPress={() => moveSection(section.id, 'up')}
                        disabled={index === 0}
                        style={styles.manageSectionActionBtn}
                      >
                        <Ionicons
                          name="chevron-up-outline"
                          size={18}
                          color={index === 0 ? colors.textSecondary + '66' : colors.textSecondary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => moveSection(section.id, 'down')}
                        disabled={index === sections.length - 1}
                        style={styles.manageSectionActionBtn}
                      >
                        <Ionicons
                          name="chevron-down-outline"
                          size={18}
                          color={index === sections.length - 1 ? colors.textSecondary + '66' : colors.textSecondary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => startEditSection(section)} style={styles.manageSectionActionBtn}>
                        <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          // Close modal first so confirm alert is always tappable.
                          setShowManageSectionsModal(false);
                          requestAnimationFrame(() => {
                            deleteSection(section.id);
                          });
                        }}
                        style={styles.manageSectionActionBtn}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowManageSectionsModal(false)}
              style={[styles.sectionModalButton, { backgroundColor: colors.surface, marginTop: 12 }]}
            >
              <Text style={[styles.sectionModalButtonText, { color: colors.text }]}>Done</Text>
            </TouchableOpacity>
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
  editorHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editorHeaderIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorHeaderSaveButton: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  attachmentMenuItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  attachmentMenuText: {
    fontSize: 14,
    fontWeight: '500',
  },
  noteDetailsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noteDetailsIconButton: {
    padding: 4,
  },
  noteDetailsContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 10,
  },
  noteDetailsTitleText: {
    fontSize: 22,
    fontWeight: '700',
  },
  noteDetailsMetaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  noteDetailsMetaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  noteDetailsMetaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noteDetailsDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  noteDetailsText: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '400',
  },
  noteDetailsEditorContainer: {
    flex: 1,
    minHeight: 300,
  },
  noteFilesSection: {
    marginTop: 10,
    gap: 8,
  },
  noteFilesLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  noteUploadButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteUploadText: {
    fontSize: 14,
    fontWeight: '500',
  },
  noteFileRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteFileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  noteHeaderTitleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  noteHeaderTitleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 0,
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
     marginHorizontal: 24,
     marginVertical: 16,
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
    marginBottom: 6,
  },
  sectionModalHint: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 14,
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
  manageSectionsList: {
    maxHeight: 280,
  },
  manageSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  manageSectionName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  manageSectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  manageSectionActionBtn: {
    padding: 4,
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
