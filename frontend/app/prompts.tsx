import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Image,
  useWindowDimensions,
  FlatList,
  GestureResponderEvent,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/common/Card';
import { FormInput } from '@/src/components/common/FormInput';
import { MultiSelect } from '@/src/components/common/MultiSelect';
import { Select } from '@/src/components/common/Select';
import { ImagePicker } from '@/src/components/common/ImagePicker';
import { EmptyState } from '@/src/components/common/EmptyState';
import { DoubleTapImage } from '@/src/components/common/DoubleTapImage';
import { promptsStorage, promptsCategoryStorage, PromptItem } from '@/src/services/storage';
import * as DocumentPicker from 'expo-document-picker';
import { openUriExternally } from '@/src/services/fileOpener';
import { useOptimisticSave } from '@/src/hooks/useOptimisticSave';

const PROMPT_TYPES = ['general', 'personal'];
const SORT_OPTIONS = [
  { label: 'Recent', value: 'recent' },
  { label: 'Name', value: 'name' },
  { label: 'Category', value: 'category' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];
type ViewMode = 'normal' | 'gallery';

export default function PromptsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const galleryColumns = 4;
  const gap = 1;
  const galleryCardWidth = (windowWidth - (galleryColumns - 1) * gap) / galleryColumns;
  const [items, setItems] = useState<PromptItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PromptItem | null>(null);
  const [editingItem, setEditingItem] = useState<PromptItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'personal'>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [activeSort, setActiveSort] = useState<SortValue>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesModalVisible, setCategoriesModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [actionToast, setActionToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const actionToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Optimistic save hook
  const { isSaving, executeSave } = useOptimisticSave({
    onSaveError: (error) => {
      Alert.alert('Error', 'Failed to save. Please try again.');
      console.error('Save error:', error);
    },
  });

  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    promptName: '',
    description: '',
    prompt: '',
    inputImage: undefined as string | undefined,
    generatedImage: undefined as string | undefined,
    inputImages: [] as string[],
    generatedImages: [] as string[],
    files: [] as string[],
    aiToolUsed: '',
    categories: [] as string[],
    type: 'general' as 'general' | 'personal',
  });

  const loadItems = useCallback(async () => {
    const data = await promptsStorage.getAll();
    setItems(data);
  }, []);

  const loadCategories = useCallback(async () => {
    const data = await promptsCategoryStorage.getAll();
    const sorted = [...data].sort((a, b) => {
      if (a.toLowerCase() === 'other') return 1;
      if (b.toLowerCase() === 'other') return -1;
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
    setCategories(sorted);
  }, []);

  useEffect(() => {
    loadItems();
    loadCategories();
  }, [loadItems, loadCategories]);

  const showActionToast = useCallback((text: string, type: 'success' | 'error') => {
    if (actionToastTimerRef.current) {
      clearTimeout(actionToastTimerRef.current);
    }
    setActionToast({ text, type });
    actionToastTimerRef.current = setTimeout(() => {
      setActionToast(null);
      actionToastTimerRef.current = null;
    }, 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (actionToastTimerRef.current) {
        clearTimeout(actionToastTimerRef.current);
      }
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadItems(), loadCategories()]);
    setRefreshing(false);
  };

  const getDefaultCategory = (source?: string[]) => {
    const current = source || categories;
    if (current.includes('other')) return 'other';
    if (current.length > 0) return current[0];
    return 'other';
  };

  const normalizeCategory = (value: string) => value.trim();

  const addCategory = async () => {
    const value = normalizeCategory(newCategoryName);
    if (!value) {
      Alert.alert('Error', 'Category name cannot be empty');
      return;
    }

    if (categories.some(category => category.toLowerCase() === value.toLowerCase())) {
      Alert.alert('Error', 'Category already exists');
      return;
    }

    const updatedCategories = [...categories, value];
    await promptsCategoryStorage.saveAll(updatedCategories);
    setCategories(updatedCategories);
    setNewCategoryName('');
  };

  const startEditCategory = (category: string) => {
    setEditingCategory(category);
    setEditingCategoryName(category);
  };

  const saveEditedCategory = async () => {
    if (!editingCategory) return;

    const value = normalizeCategory(editingCategoryName);
    if (!value) {
      Alert.alert('Error', 'Category name cannot be empty');
      return;
    }

    if (
      categories.some(
        category =>
          category.toLowerCase() === value.toLowerCase() &&
          category.toLowerCase() !== editingCategory.toLowerCase(),
      )
    ) {
      Alert.alert('Error', 'Category already exists');
      return;
    }

    const updatedCategories = categories.map(category =>
      category === editingCategory ? value : category,
    );
    await promptsCategoryStorage.saveAll(updatedCategories);
    setCategories(updatedCategories);

    const allItems = await promptsStorage.getAll();
    const affectedItems = allItems.filter(item => item.categories?.includes(editingCategory));
    await Promise.all(
      affectedItems.map(item =>
        promptsStorage.update(item.id, {
          categories: (item.categories || []).map(category =>
            category === editingCategory ? value : category,
          ),
        }),
      ),
    );

    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(editingCategory) ? updatedCategories : prev.categories,
    }));

    setEditingCategory(null);
    setEditingCategoryName('');
    await loadItems();
  };

  const deleteCategory = (categoryToDelete: string) => {
    Alert.alert(
      'Delete Category',
      `Delete "${categoryToDelete}"? Existing prompts will be moved to a fallback category.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedCategories = categories.filter(category => category !== categoryToDelete);
            const fallbackCategory = getDefaultCategory(updatedCategories);

            await promptsCategoryStorage.saveAll(updatedCategories);
            setCategories(updatedCategories);

            const allItems = await promptsStorage.getAll();
            const affectedItems = allItems.filter(item => item.categories?.includes(categoryToDelete));
            await Promise.all(
              affectedItems.map(item => {
                const nextCategories = (item.categories || []).filter(category => category !== categoryToDelete);
                return promptsStorage.update(item.id, {
                  categories: nextCategories.length > 0 ? nextCategories : [fallbackCategory],
                });
              }),
            );

            setFormData(prev => ({
              ...prev,
              categories: prev.categories.includes(categoryToDelete) ? [fallbackCategory] : prev.categories,
            }));

            if (editingCategory === categoryToDelete) {
              setEditingCategory(null);
              setEditingCategoryName('');
            }

            await loadItems();
          },
        },
      ],
    );
  };

  const resetForm = () => {
    setFormData({
      promptName: '',
      description: '',
      prompt: '',
      inputImage: undefined,
      generatedImage: undefined,
      inputImages: [],
      generatedImages: [],
      files: [],
      aiToolUsed: '',
      categories: [],
      type: activeTab,
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: PromptItem) => {
    setEditingItem(item);
    setFormData({
      promptName: item.promptName,
      description: item.description || '',
      prompt: item.prompt,
      inputImage: item.inputImage,
      generatedImage: item.generatedImage,
      inputImages: item.inputImages || [],
      generatedImages: item.generatedImages || [],
      files: item.files || [],
      aiToolUsed: item.aiToolUsed,
      categories: item.categories || (item.category ? [item.category] : []),
      type: item.type,
    });
    setModalVisible(true);
  };

  const openDetailsModal = (item: PromptItem) => {
    setSelectedItem(item);
    setDetailsVisible(true);
  };

  const handleSave = async () => {
    if (!formData.promptName.trim()) {
      Alert.alert('Error', 'Prompt name is required');
      return;
    }

    if (!formData.prompt.trim()) {
      Alert.alert('Error', 'Prompt text is required');
      return;
    }

    const payload = {
      ...formData,
      inputImage: formData.inputImages[0],
      generatedImage: formData.generatedImages[0],
    };

    // Optimistic: Close modal immediately
    setModalVisible(false);

    // Save in background (non-blocking)
    await executeSave(async () => {
      if (editingItem) {
        await promptsStorage.update(editingItem.id, payload);
        const updatedItem: PromptItem = {
          ...editingItem,
          ...payload,
          updatedAt: Date.now(),
        };
        setItems((prev) => prev.map((item) => (item.id === editingItem.id ? updatedItem : item)));
        if (selectedItem?.id === editingItem.id) {
          setSelectedItem(updatedItem);
        }
      } else {
        const createdItem = await promptsStorage.add(payload);
        setItems((prev) => [createdItem, ...prev]);
      }
    });

    resetForm();
  };

  const handleDelete = (item: PromptItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.promptName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(item.id);
          try {
            await promptsStorage.delete(item.id);
            setItems(prev => prev.filter(current => current.id !== item.id));
            if (selectedItem?.id === item.id) {
              setSelectedItem(null);
              setDetailsVisible(false);
            }
            showActionToast('Prompt deleted', 'success');
          } catch {
            showActionToast('Delete failed', 'error');
          } finally {
            setIsDeleting(null);
          }
        },
      },
    ]);
  };

  const toggleFavorite = async (item: PromptItem) => {
    const nextFavorite = !(item.isFavorite ?? false);
    await promptsStorage.update(item.id, { isFavorite: nextFavorite });
    setItems(prev => prev.map(current => (current.id === item.id ? { ...current, isFavorite: nextFavorite } : current)));
  };

  const onFavoritePress = (event: GestureResponderEvent, item: PromptItem) => {
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
        const newFiles = result.assets
          .map((asset) => JSON.stringify({ name: asset.name, uri: asset.uri, size: asset.size, mimeType: asset.mimeType }))
          .filter(Boolean);
        if (newFiles.length === 0) return;
        setFormData((prev) => ({ ...prev, files: [...prev.files, ...newFiles] }));
      }
    } catch {
      Alert.alert('Unable to pick files', 'Something went wrong while selecting files.');
    }
  };

  const removeFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
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

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return items.filter(item => {
      if (item.type !== activeTab) return false;

      const matchesSearch =
        !query ||
        item.promptName.toLowerCase().includes(query) ||
        (item.description || '').toLowerCase().includes(query) ||
        item.prompt.toLowerCase().includes(query) ||
        item.aiToolUsed.toLowerCase().includes(query);

      const matchesFilter =
        activeFilter === 'All' ||
        (activeFilter === 'Favorites' ? (item.isFavorite ?? false) : (item.categories || (item.category ? [item.category] : [])).includes(activeFilter));

      return matchesSearch && matchesFilter;
    });
  }, [items, searchQuery, activeFilter, activeTab]);

  const displayedItems = [...filteredItems].sort((a, b) => {
    if (activeSort === 'name') {
      return a.promptName.localeCompare(b.promptName);
    }
    if (activeSort === 'category') {
      return a.category.localeCompare(b.category);
    }
    return b.createdAt - a.createdAt;
  });

  const filterOptions = ['All', 'Favorites', ...categories];
  const isFavoritesOnly = activeFilter === 'Favorites';

  const toggleFavoritesOnly = () => {
    setActiveFilter(prev => (prev === 'Favorites' ? 'All' : 'Favorites'));
  };

  const resetFilters = () => {
    setSearchQuery('');
    setActiveFilter('All');
    setActiveSort('recent');
    setViewMode('normal');
  };

  const getCategoryFieldConfig = (category?: string) => {
    const normalized = (category || '').trim().toLowerCase();

    if (normalized === 'image') {
      return {
        sectionTitle: 'Image Prompt Fields',
        promptPlaceholder: 'Describe the image you want to generate...',
        showInputImage: true,
        showGeneratedImage: true,
      };
    }

    if (normalized === 'video') {
      return {
        sectionTitle: 'Video Prompt Fields',
        promptPlaceholder: 'Describe the video scene, motion, and style...',
        showInputImage: true,
        showGeneratedImage: false,
      };
    }

    if (normalized === 'audio') {
      return {
        sectionTitle: 'Audio Prompt Fields',
        promptPlaceholder: 'Describe the voice, tone, pacing, and audio style...',
        showInputImage: false,
        showGeneratedImage: false,
      };
    }

    if (normalized === 'text') {
      return {
        sectionTitle: 'Text Prompt Fields',
        promptPlaceholder: 'Enter the text prompt/instruction you want to reuse...',
        showInputImage: false,
        showGeneratedImage: false,
      };
    }

    return {
      sectionTitle: 'Category Fields',
      promptPlaceholder: 'Enter your full prompt for this category...',
      showInputImage: false,
      showGeneratedImage: false,
    };
  };

  const categoryConfig = getCategoryFieldConfig(formData.categories?.[0] || getDefaultCategory());


  const getPromptPreviewLine = (item: PromptItem) => {
    const raw = (item.description?.trim() || item.prompt?.trim() || '').trim();
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

  const getPrimaryPromptImage = (item: PromptItem) => {
    return (
      item.generatedImages?.[0] ||
      item.inputImages?.[0] ||
      item.generatedImage ||
      item.inputImage
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
          <Ionicons name="home-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Prompts</Text>
        <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'general' && { backgroundColor: colors.primary },
            { borderColor: colors.border },
          ]}
          onPress={() => setActiveTab('general')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'general' ? '#FFFFFF' : colors.text }]}>
            General
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'personal' && { backgroundColor: colors.primary },
            { borderColor: colors.border },
          ]}
          onPress={() => setActiveTab('personal')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'personal' ? '#FFFFFF' : colors.text }]}>
            Personal
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              placeholder="Search prompts..."
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
            <Text style={[styles.controlButtonText, { color: colors.text }]} numberOfLines={1}>{activeFilter}</Text>
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
          <TouchableOpacity
            style={[styles.favoriteFilterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={resetFilters}
          >
            <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {displayedItems.length === 0 ? (
        <EmptyState
          icon="chatbubble-outline"
          title={`No ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Prompts Found`}
          description="Save your best prompts for easy access and reuse."
          actionLabel="Add Prompt"
          onAction={openAddModal}
        />
      ) : viewMode === 'normal' ? (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {displayedItems.map(item => (
            <Card
              key={item.id}
              title={item.promptName}
              subtitle={item.description || item.prompt}
              subtitleLines={1}
              onPress={() => openDetailsModal(item)}
              onFavorite={() => toggleFavorite(item)}
              isFavorite={item.isFavorite ?? false}
              onEdit={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
              isDeleteLoading={isDeleting === item.id}
            >
              <View style={styles.cardFooter}>
                <View style={styles.metaTagsWrap}>
                  {(item.categories || (item.category ? [item.category] : [])).map((tag, index) => (
                    <View key={`${tag}-${index}`} style={[styles.metaTag, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.metaTagText, { color: colors.primary }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.badgeText, { color: colors.primary }]}>
                    {item.aiToolUsed}
                  </Text>
                </View>
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
          renderItem={({ item }) => {
            const uri = getPrimaryPromptImage(item);
            return (
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
                {uri ? (
                  <Image source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.galleryPlaceholder, { backgroundColor: colors.surface }]}>
                    <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
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
                  <Text style={styles.galleryTitle} numberOfLines={1}>{item.promptName}</Text>
                  <Text style={styles.gallerySubtitle} numberOfLines={1}>{getPromptPreviewLine(item)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={detailsVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setDetailsVisible(false)}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Prompt Details</Text>
            <TouchableOpacity
              onPress={() => {
                if (!selectedItem) return;
                setDetailsVisible(false);
                openEditModal(selectedItem);
              }}
            >
              <Text style={[styles.saveText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
          </View>

          {selectedItem && (
            <ScrollView style={styles.detailsContent} showsVerticalScrollIndicator={false}>
              <Text style={[styles.detailsName, { color: colors.text }]}>{selectedItem.promptName}</Text>

              <View style={styles.metaTagsWrap}>
                {(selectedItem.categories || (selectedItem.category ? [selectedItem.category] : [])).map((tag, index) => (
                  <View key={`${tag}-${index}`} style={[styles.metaTag, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.metaTagText, { color: colors.primary }]}>{tag}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.detailsSection}>
                <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>AI Tool Used</Text>
                <Text style={[styles.detailsValue, { color: colors.text }]}>{selectedItem.aiToolUsed}</Text>
              </View>

              {!!selectedItem.description?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>What It Does</Text>
                  {renderLinkedText(selectedItem.description)}
                </View>
              )}

              <View style={styles.detailsSection}>
                <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Prompt</Text>
                {renderLinkedText(selectedItem.prompt)}
              </View>

              {((selectedItem.inputImages && selectedItem.inputImages.length > 0) ||
                (selectedItem.generatedImages && selectedItem.generatedImages.length > 0) ||
                selectedItem.inputImage ||
                selectedItem.generatedImage) && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Images</Text>
                  <Text style={[styles.detailsImageHint, { color: colors.textSecondary }]}>Double tap an image to view full screen</Text>
                  <View style={styles.detailsImagesRow}>
                    {(selectedItem.inputImages || (selectedItem.inputImage ? [selectedItem.inputImage] : [])).map((img, idx) => (
                      <DoubleTapImage key={`input-${idx}`} uri={img} style={styles.detailsImage} resizeMode="cover" />
                    ))}
                    {(selectedItem.generatedImages || (selectedItem.generatedImage ? [selectedItem.generatedImage] : [])).map((img, idx) => (
                      <DoubleTapImage key={`generated-${idx}`} uri={img} style={styles.detailsImage} resizeMode="cover" />
                    ))}
                  </View>
                </View>
              )}

              {selectedItem.files && selectedItem.files.length > 0 && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Documents</Text>
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

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }} disabled={isSaving}>
              <Text style={[styles.cancelText, { color: isSaving ? colors.textSecondary + '80' : colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingItem ? 'Edit Prompt' : 'Add Prompt'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isSaving && <ActivityIndicator size="small" color={colors.primary} />}
              <Text style={[styles.saveText, { color: isSaving ? colors.primary + '80' : colors.primary }]}>
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
            <FormInput
              label="Prompt Name *"
              placeholder="Give your prompt a name"
              value={formData.promptName}
              onChangeText={(text) => setFormData({ ...formData, promptName: text })}
            />
            <FormInput
              label="What does it do / Description"
              placeholder="Explain what this prompt does and when to use it"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={3}
              style={styles.shortTextArea}
            />
            <Select
              label="Type"
              options={PROMPT_TYPES}
              value={formData.type}
              onChange={(type) => setFormData({ ...formData, type: type as any })}
            />
            <MultiSelect
              label="Categories"
              options={categories}
              selectedValues={formData.categories}
              onSelect={(categories) => setFormData({ ...formData, categories })}
            />
            <TouchableOpacity
              style={[styles.manageCategoriesButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setCategoriesModalVisible(true)}
            >
              <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.manageCategoriesText, { color: colors.text }]}>Manage Categories</Text>
            </TouchableOpacity>

            <View style={styles.categorySectionHeader}>
              <Text style={[styles.categorySectionTitle, { color: colors.text }]}>{categoryConfig.sectionTitle}</Text>
            </View>

            <FormInput
              label="AI Tool Used *"
              placeholder="e.g., Midjourney, ChatGPT"
              value={formData.aiToolUsed}
              onChangeText={(text) => setFormData({ ...formData, aiToolUsed: text })}
            />

            <FormInput
              label="Prompt *"
              placeholder={categoryConfig.promptPlaceholder}
              value={formData.prompt}
              onChangeText={(text) => setFormData({ ...formData, prompt: text })}
              multiline
              style={styles.textArea}
            />


            <View style={styles.imageSection}>
              {categoryConfig.showInputImage && (
                <ImagePicker
                  label="Input/Reference Image"
                  multiple
                  values={formData.inputImages}
                  onChange={() => undefined}
                  onChangeValues={(imgs) =>
                    setFormData({
                      ...formData,
                      inputImages: imgs,
                      inputImage: imgs[0],
                    })
                  }
                />
              )}

              {categoryConfig.showGeneratedImage && (
                <ImagePicker
                  label="Generated Image"
                  multiple
                  values={formData.generatedImages}
                  onChange={() => undefined}
                  onChangeValues={(imgs) =>
                    setFormData({
                      ...formData,
                      generatedImages: imgs,
                      generatedImage: imgs[0],
                    })
                  }
                />
              )}
            </View>
            <View style={styles.filesSection}>
              <Text style={[styles.uploadLabel, { color: colors.textSecondary }]}>Upload Documents</Text>
              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={pickFiles}
              >
                <Ionicons name="document-attach-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.uploadButtonText, { color: colors.text }]}>Add Documents</Text>
              </TouchableOpacity>
              {formData.files.map((file, index) => (
                <View key={`${file}-${index}`} style={[styles.fileItem, { backgroundColor: colors.surface, borderColor: colors.border }] }>
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

      <Modal visible={filterModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Filter by Category</Text>
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
            <Text style={[styles.optionTitle, { color: colors.text }]}>Sort by</Text>
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

      <Modal visible={categoriesModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Manage Categories</Text>

            <View style={[styles.categoryInputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="New category"
                placeholderTextColor={colors.textSecondary}
                style={[styles.categoryInput, { color: colors.text }]}
              />
              <TouchableOpacity
                style={[styles.categoryActionButton, { backgroundColor: colors.primary }]}
                onPress={addCategory}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.categoriesList}>
              {categories.map(category => (
                <View key={category} style={[styles.categoryRow, { borderBottomColor: colors.border }]}>
                  {editingCategory === category ? (
                    <TextInput
                      value={editingCategoryName}
                      onChangeText={setEditingCategoryName}
                      style={[styles.categoryEditInput, { color: colors.text, borderColor: colors.border }]}
                    />
                  ) : (
                    <Text style={[styles.optionText, { color: colors.text }]}>{category}</Text>
                  )}

                  <View style={styles.categoryActions}>
                    {editingCategory === category ? (
                      <TouchableOpacity onPress={saveEditedCategory} style={styles.categoryIconButton}>
                        <Ionicons name="checkmark" size={18} color={colors.success} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => startEditCategory(category)} style={styles.categoryIconButton}>
                        <Ionicons name="create-outline" size={17} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => deleteCategory(category)} style={styles.categoryIconButton}>
                      <Ionicons name="trash-outline" size={17} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                setCategoriesModalVisible(false);
                setEditingCategory(null);
                setEditingCategoryName('');
                setNewCategoryName('');
              }}
              style={styles.optionClose}
            >
              <Text style={[styles.optionCloseText, { color: colors.textSecondary }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {actionToast && (
        <View
          style={[
            styles.actionToast,
            { backgroundColor: actionToast.type === 'success' ? '#16A34A' : colors.danger },
          ]}
        >
          <Text style={styles.actionToastText}>{actionToast.text}</Text>
        </View>
      )}
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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
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
  galleryImage: {
    width: '100%',
    height: '100%',
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
  cardFooter: {
    marginTop: 12,
  },
  metaTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  metaTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FF6B6B',
  },
  cardContent: {
    marginTop: 12,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  toolText: {
    fontSize: 12,
  },
  imagesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
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
  formContent: {
    flexGrow: 1,
  },
  textArea: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
  shortTextArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  detailsName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  detailsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
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
  detailsImagesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  detailsImage: {
    width: 110,
    height: 110,
    borderRadius: 10,
  },
  detailsFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  detailsFileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  filesSection: {
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  uploadLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  uploadButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  fileItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  categorySectionHeader: {
    marginBottom: 10,
  },
  categorySectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  manageCategoriesButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  manageCategoriesText: {
    fontSize: 13,
    fontWeight: '500',
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
  categoryInputRow: {
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  categoryInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
  },
  categoryActionButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriesList: {
    maxHeight: 240,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIconButton: {
    padding: 4,
  },
  categoryEditInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 8,
  },
  actionToast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    zIndex: 20,
  },
  actionToastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomPadding: {
    height: 40,
  },
});
