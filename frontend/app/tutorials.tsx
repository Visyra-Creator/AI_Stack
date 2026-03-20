import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  TextInput,
  FlatList,
  useWindowDimensions,
  GestureResponderEvent,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/common/Card';
import { FormInput } from '@/src/components/common/FormInput';
import { Button } from '@/src/components/common/Button';
import { EmptyState } from '@/src/components/common/EmptyState';
import { tutorialsStorage, TutorialItem } from '@/src/services/storage';

const SORT_OPTIONS = [
  { label: 'Recent', value: 'recent' },
  { label: 'Name', value: 'name' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];
type ViewMode = 'normal' | 'gallery';

export default function TutorialsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const galleryColumns = windowWidth > windowHeight ? 4 : 3;
  const galleryCardWidth = (windowWidth - 32 - (galleryColumns - 1) * 8) / galleryColumns;

  const [items, setItems] = useState<TutorialItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TutorialItem | null>(null);
  const [editingItem, setEditingItem] = useState<TutorialItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [activeSort, setActiveSort] = useState<SortValue>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const [formData, setFormData] = useState({
    tutorialName: '',
    description: '',
    instructions: '',
    videoLink: '',
    files: [] as string[],
  });

  const loadItems = useCallback(async () => {
    const data = await tutorialsStorage.getAll();
    setItems(data);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  const resetForm = () => {
    setFormData({
      tutorialName: '',
      description: '',
      instructions: '',
      videoLink: '',
      files: [],
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: TutorialItem) => {
    setEditingItem(item);
    setFormData({
      tutorialName: item.tutorialName,
      description: item.description,
      instructions: item.instructions,
      videoLink: item.videoLink || '',
      files: item.files || [],
    });
    setModalVisible(true);
  };

  const openDetailsModal = (item: TutorialItem) => {
    setSelectedItem(item);
    setDetailsVisible(true);
  };

  const openEditFromDetails = () => {
    if (!selectedItem) return;
    setDetailsVisible(false);
    openEditModal(selectedItem);
  };

  const handleSave = async () => {
    if (!formData.tutorialName.trim()) {
      Alert.alert('Error', 'Tutorial name is required');
      return;
    }

    if (editingItem) {
      await tutorialsStorage.update(editingItem.id, formData);
    } else {
      await tutorialsStorage.add(formData);
    }

    await loadItems();
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (item: TutorialItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.tutorialName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await tutorialsStorage.delete(item.id);
          await loadItems();
        },
      },
    ]);
  };

  const toggleFavorite = async (item: TutorialItem) => {
    const nextFavorite = !(item.isFavorite ?? false);
    await tutorialsStorage.update(item.id, { isFavorite: nextFavorite });
    setItems(prev => prev.map(current => (current.id === item.id ? { ...current, isFavorite: nextFavorite } : current)));
  };

  const onFavoritePress = (event: GestureResponderEvent, item: TutorialItem) => {
    event.stopPropagation();
    toggleFavorite(item);
  };

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        const newFiles: string[] = [];
        for (const asset of result.assets) {
          newFiles.push(JSON.stringify({ name: asset.name, uri: asset.uri, size: asset.size }));
        }
        setFormData({ ...formData, files: [...formData.files, ...newFiles] });
      }
    } catch (error) {
      console.log('Error picking files:', error);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = formData.files.filter((_, i) => i !== index);
    setFormData({ ...formData, files: newFiles });
  };

  const getFileName = (fileStr: string): string => {
    try {
      const parsed = JSON.parse(fileStr);
      return parsed.name || 'File';
    } catch {
      return 'File';
    }
  };

  const getFileUri = (fileStr: string): string | undefined => {
    try {
      const parsed = JSON.parse(fileStr);
      return parsed.uri as string | undefined;
    } catch {
      return undefined;
    }
  };

  const openExternalLink = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Unable to open link', 'No app is available to open this link.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open link', 'Something went wrong while opening this link.');
    }
  };

  const openFile = async (fileStr: string) => {
    const uri = getFileUri(fileStr);
    if (!uri) {
      Alert.alert('Unable to open file', 'This attachment is missing a valid file path.');
      return;
    }
    await openExternalLink(uri);
  };

  const getTutorialPreviewLine = (item: TutorialItem) => {
    const raw = (item.description?.trim() || item.instructions?.trim() || '').trim();
    if (!raw) return '';
    return raw.split('\n')[0].trim();
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return items.filter(item => {
      const matchesSearch =
        !query ||
        item.tutorialName.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.instructions.toLowerCase().includes(query) ||
        (item.videoLink || '').toLowerCase().includes(query);

      const matchesFilter =
        activeFilter === 'All' ||
        (activeFilter === 'Favorites' ? (item.isFavorite ?? false) : true);

      return matchesSearch && matchesFilter;
    });
  }, [items, searchQuery, activeFilter]);

  const displayedItems = useMemo(() => {
    const sorted = [...filteredItems];

    if (activeSort === 'name') {
      sorted.sort((a, b) => a.tutorialName.localeCompare(b.tutorialName));
      return sorted;
    }

    sorted.sort((a, b) => b.createdAt - a.createdAt);
    return sorted;
  }, [filteredItems, activeSort]);

  const filterOptions = ['All', 'Favorites'];
  const isFavoritesOnly = activeFilter === 'Favorites';

  const toggleFavoritesOnly = () => {
    setActiveFilter(prev => (prev === 'Favorites' ? 'All' : 'Favorites'));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Tutorials</Text>
        <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              placeholder="Search tutorials..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: colors.text }]}
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons name="funnel-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.controlButtonText, { color: colors.text }]} numberOfLines={1}>
              {activeFilter}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.favoriteFilterButton,
              {
                backgroundColor: isFavoritesOnly ? colors.primary + '20' : colors.surface,
                borderColor: isFavoritesOnly ? colors.primary : colors.border,
              },
            ]}
            onPress={toggleFavoritesOnly}
          >
            <Ionicons
              name={isFavoritesOnly ? 'heart' : 'heart-outline'}
              size={16}
              color={isFavoritesOnly ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setSortModalVisible(true)}
          >
            <Ionicons name="swap-vertical-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.controlButtonText, { color: colors.text }]} numberOfLines={1}>
              {SORT_OPTIONS.find(option => option.value === activeSort)?.label}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setViewMode(prev => (prev === 'normal' ? 'gallery' : 'normal'))}
          >
            <Ionicons name={viewMode === 'normal' ? 'grid-outline' : 'list-outline'} size={16} color={colors.textSecondary} />
            <Text style={[styles.controlButtonText, { color: colors.text }]} numberOfLines={1}>
              {viewMode === 'normal' ? 'Gallery' : 'List'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {displayedItems.length === 0 ? (
        <EmptyState
          icon="play-circle-outline"
          title="No Tutorials Yet"
          description="Save tutorials, guides, and learning resources here."
          actionLabel="Add Tutorial"
          onAction={openAddModal}
        />
      ) : viewMode === 'normal' ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.normalListContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {displayedItems.map(item => (
            <Card
              key={item.id}
              title={item.tutorialName}
              subtitle={getTutorialPreviewLine(item)}
              subtitleLines={1}
              onPress={() => openDetailsModal(item)}
              onFavorite={() => toggleFavorite(item)}
              isFavorite={item.isFavorite ?? false}
              onEdit={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
            >
              <View style={styles.cardFooter}>
                {item.videoLink && (
                  <View style={[styles.badge, { backgroundColor: colors.danger + '20' }]}>
                    <Ionicons name="videocam" size={14} color={colors.danger} />
                    <Text style={[styles.badgeText, { color: colors.danger }]}>Video</Text>
                  </View>
                )}
                {item.files && item.files.length > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="document" size={14} color={colors.primary} />
                    <Text style={[styles.badgeText, { color: colors.primary }]}>
                      {item.files.length} file(s)
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          key={`gallery-${galleryColumns}`}
          style={styles.list}
          data={displayedItems}
          keyExtractor={(item) => item.id}
          numColumns={galleryColumns}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.galleryListContent}
          columnWrapperStyle={styles.galleryColumnWrapper}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.galleryCard,
                { width: galleryCardWidth, backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => openDetailsModal(item)}
              activeOpacity={0.85}
            >
              <TouchableOpacity
                style={[styles.galleryFavoriteButton, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
                onPress={(event) => onFavoritePress(event, item)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={(item.isFavorite ?? false) ? 'heart' : 'heart-outline'}
                  size={16}
                  color={(item.isFavorite ?? false) ? '#FF6B6B' : '#FFFFFF'}
                />
              </TouchableOpacity>
              <View style={[styles.galleryPlaceholder, { backgroundColor: colors.surface }]}>
                <Ionicons name="play-circle-outline" size={24} color={colors.textSecondary} />
              </View>
              <View style={styles.galleryOverlay}>
                <Text style={styles.galleryTitle} numberOfLines={1}>{item.tutorialName}</Text>
                <Text style={styles.gallerySubtitle} numberOfLines={1}>{getTutorialPreviewLine(item)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingItem ? 'Edit Tutorial' : 'Add Tutorial'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <FormInput
              label="Tutorial Name *"
              placeholder="e.g., Midjourney Basics"
              value={formData.tutorialName}
              onChangeText={(text) => setFormData({ ...formData, tutorialName: text })}
            />
            <FormInput
              label="Description"
              placeholder="What will you learn?"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
            <FormInput
              label="Instructions"
              placeholder="Step-by-step instructions..."
              value={formData.instructions}
              onChangeText={(text) => setFormData({ ...formData, instructions: text })}
              multiline
              numberOfLines={5}
              style={styles.textArea}
            />
            <FormInput
              label="Video Link"
              placeholder="YouTube, Vimeo, or other video URL"
              value={formData.videoLink}
              onChangeText={(text) => setFormData({ ...formData, videoLink: text })}
              keyboardType="url"
              autoCapitalize="none"
            />

            <View style={styles.filesSection}>
              <Text style={[styles.filesLabel, { color: colors.textSecondary }]}>Files</Text>
              <Button title="Add Files" onPress={pickFiles} variant="outline" />
              {formData.files.map((file, index) => (
                <View key={index} style={[styles.fileItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="document-outline" size={20} color={colors.primary} />
                  <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                    {getFileName(file)}
                  </Text>
                  <TouchableOpacity onPress={() => removeFile(index)}>
                    <Ionicons name="close-circle" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={detailsVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setDetailsVisible(false)}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Tutorial Details</Text>
            <TouchableOpacity onPress={openEditFromDetails}>
              <Text style={[styles.saveText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
          </View>

          {selectedItem && (
            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <Text style={[styles.detailsTitle, { color: colors.text }]}>{selectedItem.tutorialName}</Text>

              {!!selectedItem.videoLink?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Video Link</Text>
                  <TouchableOpacity onPress={() => openExternalLink(selectedItem.videoLink!)}>
                    <Text style={[styles.detailsLink, { color: colors.primary }]} numberOfLines={2}>
                      {selectedItem.videoLink}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {!!selectedItem.description?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Description</Text>
                  <Text style={[styles.detailsValue, { color: colors.text }]}>{selectedItem.description}</Text>
                </View>
              )}

              {!!selectedItem.instructions?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Instructions</Text>
                  <Text style={[styles.detailsValue, { color: colors.text }]}>{selectedItem.instructions}</Text>
                </View>
              )}

              {selectedItem.files && selectedItem.files.length > 0 && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Files</Text>
                  {selectedItem.files.map((file, index) => (
                    <TouchableOpacity
                      key={`${file}-${index}`}
                      style={[styles.detailsFileRow, { borderColor: colors.border }]}
                      onPress={() => openFile(file)}
                    >
                      <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                      <Text style={[styles.detailsFileName, { color: colors.text }]} numberOfLines={1}>
                        {getFileName(file)}
                      </Text>
                      <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.bottomPadding} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <Modal visible={filterModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Filter tutorials</Text>
            {filterOptions.map(option => (
              <TouchableOpacity
                key={option}
                style={styles.optionRow}
                onPress={() => {
                  setActiveFilter(option);
                  setFilterModalVisible(false);
                }}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                {activeFilter === option && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setFilterModalVisible(false)} style={styles.optionClose}>
              <Text style={[styles.optionCloseText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={sortModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Sort tutorials</Text>
            {SORT_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={styles.optionRow}
                onPress={() => {
                  setActiveSort(option.value);
                  setSortModalVisible(false);
                }}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{option.label}</Text>
                {activeSort === option.value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setSortModalVisible(false)} style={styles.optionClose}>
              <Text style={[styles.optionCloseText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    height: 40,
    paddingLeft: 10,
    flex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  controlButton: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 104,
  },
  favoriteFilterButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonText: {
    fontSize: 11,
    fontWeight: '500',
    maxWidth: 66,
  },
  list: {
    flex: 1,
  },
  normalListContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  galleryListContent: {
    paddingBottom: 16,
    paddingHorizontal: 0,
  },
  galleryColumnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  galleryCard: {
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  galleryPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  galleryFavoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  galleryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  gallerySubtitle: {
    fontSize: 11,
    color: '#E5E7EB',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  cancelText: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    flex: 1,
    padding: 16,
  },
  detailsTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  detailsSection: {
    marginBottom: 14,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailsValue: {
    fontSize: 14,
    lineHeight: 21,
  },
  detailsLink: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailsFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    gap: 8,
  },
  detailsFileName: {
    flex: 1,
    fontSize: 14,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  filesSection: {
    marginBottom: 16,
  },
  filesLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  optionSheet: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  optionText: {
    fontSize: 15,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  optionClose: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 6,
  },
  optionCloseText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomPadding: {
    height: 40,
  },
});
