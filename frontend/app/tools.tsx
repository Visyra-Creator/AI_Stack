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
  Image,
  useWindowDimensions,
  GestureResponderEvent,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/common/Card';
import { FormInput } from '@/src/components/common/FormInput';
import { ImagePicker } from '@/src/components/common/ImagePicker';
import { EmptyState } from '@/src/components/common/EmptyState';
import { DoubleTapImage } from '@/src/components/common/DoubleTapImage';
import { toolsStorage, ToolItem } from '@/src/services/storage';

const SORT_OPTIONS = [
  { label: 'Recent', value: 'recent' },
  { label: 'Name', value: 'name' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];
type ViewMode = 'normal' | 'gallery';

export default function ToolsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const galleryColumns = 4;
  const gap = 1;
  const galleryCardWidth = (windowWidth - (galleryColumns - 1) * gap) / galleryColumns;

  const [items, setItems] = useState<ToolItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ToolItem | null>(null);
  const [editingItem, setEditingItem] = useState<ToolItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [activeSort, setActiveSort] = useState<SortValue>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const [formData, setFormData] = useState({
    toolName: '',
    link: '',
    description: '',
    instructions: '',
    image: undefined as string | undefined,
    images: [] as string[],
  });

  const loadItems = useCallback(async () => {
    const data = await toolsStorage.getAll();
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
      toolName: '',
      link: '',
      description: '',
      instructions: '',
      image: undefined,
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: ToolItem) => {
    setEditingItem(item);
    setFormData({
      toolName: item.toolName,
      link: item.link,
      description: item.description,
      instructions: item.instructions,
      image: item.image,
    });
    setModalVisible(true);
  };

  const openDetailsModal = (item: ToolItem) => {
    setSelectedItem(item);
    setDetailsVisible(true);
  };

  const openEditFromDetails = () => {
    if (!selectedItem) return;
    setDetailsVisible(false);
    openEditModal(selectedItem);
  };

  const handleSave = async () => {
    if (!formData.toolName.trim()) {
      Alert.alert('Error', 'Tool name is required');
      return;
    }

    if (editingItem) {
      await toolsStorage.update(editingItem.id, formData);
    } else {
      await toolsStorage.add(formData);
    }

    await loadItems();
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (item: ToolItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.toolName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await toolsStorage.delete(item.id);
          await loadItems();
        },
      },
    ]);
  };

  const toggleFavorite = async (item: ToolItem) => {
    const nextFavorite = !(item.isFavorite ?? false);
    await toolsStorage.update(item.id, { isFavorite: nextFavorite });
    setItems(prev => prev.map(current => (current.id === item.id ? { ...current, isFavorite: nextFavorite } : current)));
  };

  const onFavoritePress = (event: GestureResponderEvent, item: ToolItem) => {
    event.stopPropagation();
    toggleFavorite(item);
  };

  const getToolPreviewLine = (item: ToolItem) => {
    const raw = (item.description?.trim() || item.instructions?.trim() || '').trim();
    if (!raw) return '';
    return raw.split('\n')[0].trim();
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

  const renderLinkedText = (value: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return (
      <Text style={[styles.detailsValue, { color: colors.text }]}>
        {value.split(urlRegex).map((part, index) => (
          /^https?:\/\/[^\s]+$/i.test(part) ? (
            <Text
              key={`${part}-${index}`}
              style={[styles.detailsValue, { color: colors.primary, textDecorationLine: 'underline' }]}
              onPress={() => openExternalLink(part)}
            >
              {part}
            </Text>
          ) : (
            <Text key={`${part}-${index}`}>{part}</Text>
          )
        ))}
      </Text>
    );
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return items.filter(item => {
      const matchesSearch =
        !query ||
        item.toolName.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.instructions.toLowerCase().includes(query) ||
        item.link.toLowerCase().includes(query);

      const matchesFilter =
        activeFilter === 'All' ||
        (activeFilter === 'Favorites' ? (item.isFavorite ?? false) : true);

      return matchesSearch && matchesFilter;
    });
  }, [items, searchQuery, activeFilter]);

  const displayedItems = useMemo(() => {
    const sorted = [...filteredItems];
    if (activeSort === 'name') {
      sorted.sort((a, b) => a.toolName.localeCompare(b.toolName));
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
        <Text style={[styles.title, { color: colors.text }]}>Tools</Text>
        <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              placeholder="Search tools..."
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
          icon="construct-outline"
          title="No Tools Yet"
          description="Store your prompting tools and utilities here."
          actionLabel="Add Tool"
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
              title={item.toolName}
              subtitle={getToolPreviewLine(item)}
              subtitleLines={1}
              onPress={() => openDetailsModal(item)}
              onFavorite={() => toggleFavorite(item)}
              isFavorite={item.isFavorite ?? false}
              onEdit={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
            >
              {item.link && (
                <Text style={[styles.link, { color: colors.primary }]} numberOfLines={1}>
                  {item.link}
                </Text>
              )}
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
              {(item.images?.[0] || item.image) ? (
                <Image source={{ uri: item.images?.[0] || item.image }} style={styles.galleryImage} resizeMode="cover" />
              ) : (
                <View style={[styles.galleryPlaceholder, { backgroundColor: colors.surface }]}>
                  <Ionicons name="construct-outline" size={24} color={colors.textSecondary} />
                  <Text style={[styles.galleryPlaceholderText, { color: colors.textSecondary }]}>No image</Text>
                  <TouchableOpacity
                    style={[styles.galleryAddImageCta, { backgroundColor: colors.background + 'D9' }]}
                    onPress={(event) => {
                      event.stopPropagation();
                      openEditModal(item);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.galleryAddImageCtaText, { color: colors.text }]}>Add image</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.galleryOverlay}>
                <Text style={styles.galleryTitle} numberOfLines={1}>{item.toolName}</Text>
                <Text style={styles.gallerySubtitle} numberOfLines={1}>{getToolPreviewLine(item)}</Text>
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
              {editingItem ? 'Edit Tool' : 'Add Tool'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <FormInput
              label="Tool Name *"
              placeholder="e.g., Prompt Generator"
              value={formData.toolName}
              onChangeText={(text) => setFormData({ ...formData, toolName: text })}
            />
            <FormInput
              label="Link"
              placeholder="https://..."
              value={formData.link}
              onChangeText={(text) => setFormData({ ...formData, link: text })}
              keyboardType="url"
              autoCapitalize="none"
            />
            <FormInput
              label="Description"
              placeholder="What does this tool do?"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
            <FormInput
              label="Instructions"
              placeholder="How to use this tool..."
              value={formData.instructions}
              onChangeText={(text) => setFormData({ ...formData, instructions: text })}
              multiline
              numberOfLines={5}
              style={styles.textArea}
            />
            <ImagePicker
              label="Tool Image"
              multiple
              values={formData.images}
              onChange={() => undefined}
              onChangeValues={(images) => setFormData({ ...formData, images, image: images[0] })}
            />
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>Tool Details</Text>
            <TouchableOpacity onPress={openEditFromDetails}>
              <Text style={[styles.saveText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
          </View>

          {selectedItem && (
            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <Text style={[styles.detailsTitle, { color: colors.text }]}>{selectedItem.toolName}</Text>

              {!!selectedItem.link?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Link</Text>
                  <TouchableOpacity onPress={() => openExternalLink(selectedItem.link)}>
                    <Text style={[styles.detailsLink, { color: colors.primary }]} numberOfLines={2}>
                      {selectedItem.link}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {!!selectedItem.description?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Description</Text>
                  {renderLinkedText(selectedItem.description)}
                </View>
              )}

              {!!(selectedItem.images?.[0] || selectedItem.image) && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Image</Text>
                  <Text style={[styles.detailsImageHint, { color: colors.textSecondary }]}>Double tap the image to view full screen</Text>
                  <DoubleTapImage
                    uri={selectedItem.images?.[0] || selectedItem.image || ''}
                    style={styles.detailsImage}
                    resizeMode="cover"
                  />
                </View>
              )}

              {!!selectedItem.instructions?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Instructions</Text>
                  {renderLinkedText(selectedItem.instructions)}
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
            <Text style={[styles.optionTitle, { color: colors.text }]}>Filter tools</Text>
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
            <Text style={[styles.optionTitle, { color: colors.text }]}>Sort tools</Text>
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
  link: {
    fontSize: 12,
    marginTop: 8,
  },
  galleryListContent: {
    paddingBottom: 16,
    paddingHorizontal: 0,
  },
  galleryColumnWrapper: {
    justifyContent: 'flex-start',
    marginBottom: 1,
    paddingHorizontal: 0,
    gap: 1,
  },
  galleryCard: {
    aspectRatio: 1,
    overflow: 'hidden',
  },
  galleryPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryPlaceholderText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
    opacity: 0.85,
  },
  galleryAddImageCta: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  galleryAddImageCtaText: {
    fontSize: 10,
    fontWeight: '700',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
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
  detailsImageHint: {
    fontSize: 11,
    marginBottom: 8,
    opacity: 0.75,
  },
  detailsValue: {
    fontSize: 14,
    lineHeight: 21,
  },
  detailsLink: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailsImage: {
    width: 160,
    aspectRatio: 1,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
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
