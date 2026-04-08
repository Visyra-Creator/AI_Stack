import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  FlatList,
  useWindowDimensions,
  GestureResponderEvent,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/common/Card';
import { FormInput } from '@/src/components/common/FormInput';
import { EmptyState } from '@/src/components/common/EmptyState';
import { DoubleTapImage } from '@/src/components/common/DoubleTapImage';
import { leadGenerationStorage, leadGenerationCategoryStorage, LeadGenerationItem } from '@/src/services/storage';
import { MultiSelect } from '@/src/components/common/MultiSelect';
import { useOptimisticSave } from '@/src/hooks/useOptimisticSave';
import { openUriExternally } from '@/src/services/fileOpener';
import { resolveImageUri, getPrimaryImageUri as getResolvedPrimaryImageUri } from '@/src/services/imageResolver';

const SORT_OPTIONS = [
  { label: 'Recent', value: 'recent' },
  { label: 'Name', value: 'name' },
  { label: 'Category', value: 'category' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];
type ViewMode = 'normal' | 'gallery';

export default function LeadGenerationScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const galleryColumns = 4;
  const gap = 1;
  const galleryCardWidth = (windowWidth - (galleryColumns - 1) * gap) / galleryColumns;

  const [items, setItems] = useState<LeadGenerationItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LeadGenerationItem | null>(null);
  const [editingItem, setEditingItem] = useState<LeadGenerationItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [activeSort, setActiveSort] = useState<SortValue>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [categoriesModalVisible, setCategoriesModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  // Optimistic save hook
  const { isSaving, executeSave } = useOptimisticSave({
    onSaveSuccess: () => {
      loadItems();
    },
    onSaveError: (error) => {
      Alert.alert('Error', 'Failed to save. Please try again.');
      console.error('Save error:', error);
    },
  });

  // Loading states for other operations
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    instructions: '',
    link: '',
    videoLink: '',
    categories: [] as string[],
    images: [] as string[],
    files: [] as string[],
  });

  const loadItems = useCallback(async () => {
    const data = await leadGenerationStorage.getAll();
    setItems(data);
  }, []);

  const loadCategories = useCallback(async () => {
    const data = await leadGenerationCategoryStorage.getAll();
    const sorted = [...data].sort((a, b) => {
      if (a.toLowerCase() === 'other') return 1;
      if (b.toLowerCase() === 'other') return -1;
      return a.localeCompare(b);
    });
    setCategories(sorted);
  }, []);

  useEffect(() => {
    loadItems();
    loadCategories();
  }, [loadItems, loadCategories]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadItems(), loadCategories()]);
    setRefreshing(false);
  };

  const normalizeCategory = (value: string) => value.trim();

  const getDefaultCategory = (source?: string[]) => {
    const current = source || categories;
    if (current.includes('Other')) return 'Other';
    if (current.includes('other')) return 'other';
    if (current.length > 0) return current[0];
    return 'other';
  };

  const addCategory = async () => {
    const value = normalizeCategory(newCategoryName);
    if (!value) {
      Alert.alert('Error', 'Category name cannot be empty');
      return;
    }
    if (categories.some((category) => category.toLowerCase() === value.toLowerCase())) {
      Alert.alert('Error', 'Category already exists');
      return;
    }

    const previousCategories = categories;
    const updatedCategories = [...categories, value].sort((a, b) => {
      if (a.toLowerCase() === 'other') return 1;
      if (b.toLowerCase() === 'other') return -1;
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });

    setCategories(updatedCategories);
    setNewCategoryName('');
    setIsAddingCategory(true);

    try {
      await leadGenerationCategoryStorage.saveAll(updatedCategories);
    } catch {
      setCategories(previousCategories);
      setNewCategoryName(value);
      Alert.alert('Error', 'Failed to add category. Please try again.');
    } finally {
      setIsAddingCategory(false);
    }
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
        (category) =>
          category.toLowerCase() === value.toLowerCase() &&
          category.toLowerCase() !== editingCategory.toLowerCase(),
      )
    ) {
      Alert.alert('Error', 'Category already exists');
      return;
    }

    const previousCategories = categories;
    const previousEditingCategory = editingCategory;
    const previousEditingCategoryName = editingCategoryName;
    const updatedCategories = categories.map((category) =>
      category === editingCategory ? value : category,
    );
    setCategories(updatedCategories);
    setEditingCategory(null);
    setEditingCategoryName('');

    try {
      await leadGenerationCategoryStorage.saveAll(updatedCategories);
    } catch {
      setCategories(previousCategories);
      setEditingCategory(previousEditingCategory);
      setEditingCategoryName(previousEditingCategoryName);
      Alert.alert('Error', 'Failed to update category. Please try again.');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.map((category) => (category === editingCategory ? value : category)),
    }));
    if (activeFilter === editingCategory) {
      setActiveFilter(value);
    }
  };

  const deleteCategory = (categoryToDelete: string) => {
    Alert.alert('Delete Category', `Delete "${categoryToDelete}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const previousCategories = categories;
          const previousActiveFilter = activeFilter;
          const updatedCategories = categories.filter((category) => category !== categoryToDelete);
          setCategories(updatedCategories);
          if (activeFilter === categoryToDelete) {
            setActiveFilter('All');
          }

          try {
            await leadGenerationCategoryStorage.saveAll(updatedCategories);

            setFormData((prev) => {
              const nextCategories = prev.categories.filter((category) => category !== categoryToDelete);
              return {
                ...prev,
                categories: nextCategories.length > 0 ? nextCategories : [getDefaultCategory(updatedCategories)],
              };
            });
            if (editingCategory === categoryToDelete) {
              setEditingCategory(null);
              setEditingCategoryName('');
            }
          } catch {
            setCategories(previousCategories);
            setActiveFilter(previousActiveFilter);
            Alert.alert('Error', 'Failed to delete category. Please try again.');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      instructions: '',
      link: '',
      videoLink: '',
      categories: [],
      images: [],
      files: [],
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: LeadGenerationItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      instructions: item.instructions,
      link: item.link,
      videoLink: item.videoLink || '',
      categories: item.categories || (item.category ? [item.category] : []),
      images: item.images || [],
      files: item.files || [],
    });
    setModalVisible(true);
  };

  const openDetailsModal = (item: LeadGenerationItem) => {
    setSelectedItem(item);
    setDetailsVisible(true);
  };

  const openEditFromDetails = () => {
    if (!selectedItem) return;
    setDetailsVisible(false);
    openEditModal(selectedItem);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setModalVisible(false);

    await executeSave(async () => {
      if (editingItem) {
        await leadGenerationStorage.update(editingItem.id, formData);
      } else {
        await leadGenerationStorage.add(formData);
      }
    });

    resetForm();
  };

  const handleDelete = (item: LeadGenerationItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setItems(prev => prev.filter(current => current.id !== item.id));
          setIsDeleting(item.id);
          try {
            await leadGenerationStorage.delete(item.id);
          } catch {
            await loadItems();
            Alert.alert('Error', 'Failed to delete. Please try again.');
          } finally {
            setIsDeleting(null);
          }
        },
      },
    ]);
  };

  const toggleFavorite = async (item: LeadGenerationItem) => {
    const nextFavorite = !(item.isFavorite ?? false);
    await leadGenerationStorage.update(item.id, { isFavorite: nextFavorite });
    setItems(prev => prev.map(current => (current.id === item.id ? { ...current, isFavorite: nextFavorite } : current)));
  };

  const onFavoritePress = (event: GestureResponderEvent, item: LeadGenerationItem) => {
    event.stopPropagation();
    toggleFavorite(item);
  };

  const pickImages = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow photo library access to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset =>
          JSON.stringify({
            name: asset.fileName || `Image ${Date.now()}`,
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
          }),
        );
        setFormData(prev => ({ ...prev, images: [...prev.images, ...newImages] }));
      }
    } catch (error) {
      console.log('Error picking images:', error);
    }
  };

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        const newFiles = result.assets.map(asset =>
          JSON.stringify({
            name: asset.name,
            uri: asset.uri,
            size: asset.size,
            mimeType: asset.mimeType,
          }),
        );
        setFormData(prev => ({ ...prev, files: [...prev.files, ...newFiles] }));
      }
    } catch (error) {
      console.log('Error picking files:', error);
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  const getFileName = (fileStr: string) => {
    try {
      const parsed = JSON.parse(fileStr);
      return parsed.name || 'Document';
    } catch {
      return 'Document';
    }
  };

  const getFileUri = (fileStr: string) => {
    try {
      const parsed = JSON.parse(fileStr);
      return parsed.uri as string | undefined;
    } catch {
      return undefined;
    }
  };

  const openFile = async (fileStr: string) => {
    const uri = getFileUri(fileStr);
    const fileName = getFileName(fileStr);
    if (!uri) {
      Alert.alert('Unable to open file', 'This attachment is missing a valid file path.');
      return;
    }
    try {
      const isPdf = fileName.toLowerCase().endsWith('.pdf') || uri.toLowerCase().includes('pdf');
      if (isPdf) {
        const result = await openUriExternally(fileStr);
        if (!result.success) {
          Alert.alert('Unable to open PDF', result.reason || 'No app available to open this file.');
        }
      } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
        await openExternalLink(uri);
      } else {
        const result = await openUriExternally(fileStr);
        if (!result.success) {
          Alert.alert('Unable to open file', 'No app available to open this file.');
        }
      }
    } catch {
      Alert.alert('Unable to open file', 'Something went wrong while opening this attachment.');
    }
  };

  const openExternalLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Unable to open link', 'No app available to open this link.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open link', 'Something went wrong while opening this link.');
    }
  };

  const renderLinkedText = (value: string) => {
    if (!value) return null;
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
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.instructions.toLowerCase().includes(query) ||
        item.link.toLowerCase().includes(query);

      const matchesFilter =
        activeFilter === 'All' ||
        (activeFilter === 'Favorites' ? (item.isFavorite ?? false) : (item.categories || (item.category ? [item.category] : [])).includes(activeFilter));

      return matchesSearch && matchesFilter;
    });
  }, [items, searchQuery, activeFilter]);

  const displayedItems = useMemo(() => {
    const sorted = [...filteredItems];
    if (activeSort === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (activeSort === 'category') {
      sorted.sort((a, b) => a.category.localeCompare(b.category));
    } else {
      sorted.sort((a, b) => b.createdAt - a.createdAt);
    }
    return sorted;
  }, [filteredItems, activeSort]);

  const filterOptions = ['All', 'Favorites', ...categories];
  const isFavoritesOnly = activeFilter === 'Favorites';

  const toggleFavoritesOnly = () => {
    setActiveFilter(prev => (prev === 'Favorites' ? 'All' : 'Favorites'));
  };

  const getCardSubtitle = (item: LeadGenerationItem) => {
    const raw = (item.description?.trim() || '').trim();
    if (!raw) return '';
    return raw.split('\n')[0].trim();
  };

  const getPrimaryImageUri = (item: LeadGenerationItem) => {
    return getResolvedPrimaryImageUri(item);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Lead Generation</Text>
        <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
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
            <Ionicons
              name={viewMode === 'normal' ? 'grid-outline' : 'list-outline'}
              size={16}
              color={colors.textSecondary}
            />
            <Text style={[styles.controlButtonText, { color: colors.text }]} numberOfLines={1}>
              {viewMode === 'normal' ? 'Gallery' : 'List'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {displayedItems.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No Lead Gen Tools"
          description="Track your lead generation tools and strategies here."
          actionLabel="Add Tool"
          onAction={openAddModal}
          buttonStyle={{ paddingVertical: 18, paddingHorizontal: 36, minHeight: 60 }}
          buttonTextStyle={{ fontSize: 18 }}
        />
      ) : viewMode === 'normal' ? (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {displayedItems.map(item => (
            <Card
              key={item.id}
              title={item.name}
              subtitle={item.description}
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
            const uri = getPrimaryImageUri(item);
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
                    <Ionicons name="people-outline" size={24} color={colors.textSecondary} />
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
                  <Text style={styles.galleryTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.gallerySubtitle} numberOfLines={1}>{getCardSubtitle(item)}</Text>
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>Tool Details</Text>
            <TouchableOpacity onPress={openEditFromDetails}>
              <Text style={[styles.saveText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
          </View>

          {selectedItem && (
            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <View style={styles.detailsContent}>
                <Text style={[styles.detailsName, { color: colors.text }]}>{selectedItem.name}</Text>

                <View style={styles.metaTagsWrap}>
                  {(selectedItem.categories || (selectedItem.category ? [selectedItem.category] : [])).map((tag, index) => (
                    <View key={`${tag}-${index}`} style={[styles.metaTag, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.metaTagText, { color: colors.primary }]}>{tag}</Text>
                    </View>
                  ))}
                </View>

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

                {!!selectedItem.instructions?.trim() && (
                  <View style={styles.detailsSection}>
                    <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Instructions</Text>
                    {renderLinkedText(selectedItem.instructions)}
                  </View>
                )}

                {!!selectedItem.videoLink?.trim() && (
                  <View style={styles.detailsSection}>
                    <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Video Link</Text>
                    <TouchableOpacity onPress={() => openExternalLink(selectedItem.videoLink!)}>
                      <Text style={[styles.detailsLink, { color: colors.danger }]} numberOfLines={2}>
                        {selectedItem.videoLink}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selectedItem.files && selectedItem.files.length > 0 && (
                  <View style={styles.detailsSection}>
                    <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Attachments</Text>
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

                {selectedItem.images && selectedItem.images.length > 0 && (
                  <View style={styles.detailsSection}>
                    <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Images</Text>
                    <Text style={[styles.detailsImageHint, { color: colors.textSecondary }]}>Double tap an image to view full screen</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailsImagesRow}>
                      {selectedItem.images.map((image, index) => {
                        const uri = resolveImageUri(image);
                        if (!uri) return null;
                        return (
                          <DoubleTapImage
                            key={`${image}-${index}`}
                            uri={uri}
                            style={styles.detailsImagePreview}
                            resizeMode="contain"
                          />
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
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
            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingItem ? 'Edit Tool' : 'Add Tool'}
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
              label="Name *"
              placeholder="e.g., LinkedIn Sales Navigator"
              value={formData.name}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, name: text }))}
            />
            <FormInput
              label="Description"
              placeholder="What does this tool do?"
              value={formData.description}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, description: text }))}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
            <FormInput
              label="Instructions"
              placeholder="How to use for lead generation..."
              value={formData.instructions}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, instructions: text }))}
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />
            <FormInput
              label="Link"
              placeholder="https://..."
              value={formData.link}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, link: text }))}
              keyboardType="url"
              autoCapitalize="none"
            />
            <FormInput
              label="Video Link"
              placeholder="https://..."
              value={formData.videoLink}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, videoLink: text }))}
              keyboardType="url"
              autoCapitalize="none"
            />

            <MultiSelect
              label="Categories"
              options={categories}
              selectedValues={formData.categories}
              onSelect={(categories) => setFormData((prev) => ({ ...prev, categories }))}
            />

            <TouchableOpacity
              style={[styles.manageCategoriesButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setCategoriesModalVisible(true)}
            >
              <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.manageCategoriesText, { color: colors.text }]}>Manage Categories</Text>
            </TouchableOpacity>

            <View style={styles.uploadSection}>
              <Text style={[styles.uploadLabel, { color: colors.textSecondary }]}>Upload Images</Text>
              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={pickImages}
              >
                <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.uploadButtonText, { color: colors.text }]}>Add Images</Text>
              </TouchableOpacity>

              {formData.images.length > 0 && (
                <View style={styles.imageGrid}>
                  {formData.images.map((image, index) => {
                    const uri = resolveImageUri(image);
                    if (!uri) return null;
                    return (
                      <View key={`${image}-${index}`} style={styles.imageItem}>
                        <Image source={{ uri }} style={styles.imagePreview} resizeMode="cover" />
                        <TouchableOpacity
                          style={[styles.imageRemoveButton, { backgroundColor: colors.background }]}
                          onPress={() => removeImage(index)}
                        >
                          <Ionicons name="close-circle" size={18} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.uploadSection}>
              <Text style={[styles.uploadLabel, { color: colors.textSecondary }]}>Upload Docs/PDFs</Text>
              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={pickFiles}
              >
                <Ionicons name="document-attach-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.uploadButtonText, { color: colors.text }]}>Add Files</Text>
              </TouchableOpacity>

              {formData.files.length > 0 && (
                <View style={styles.fileList}>
                  {formData.files.map((file, index) => (
                    <View key={`${file}-${index}`} style={[styles.fileItem, { borderColor: colors.border }]}>
                      <TouchableOpacity
                        style={styles.fileInfo}
                        onPress={() => openFile(file)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                        <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                          {getFileName(file)}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeFile(index)}>
                        <Ionicons name="close-circle" size={20} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
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
                style={[styles.categoryActionButton, { backgroundColor: colors.primary, opacity: isAddingCategory ? 0.6 : 1 }]}
                onPress={addCategory}
                disabled={isAddingCategory}
              >
                {isAddingCategory ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                )}
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
    marginBottom: 8,
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
    paddingLeft: 12,
    flex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  controlButton: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 112,
  },
  favoriteFilterButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 74,
  },
  list: {
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
  detailsContent: {
    padding: 16,
    paddingBottom: 36,
  },
  detailsName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  detailsSection: {
    marginBottom: 16,
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
    fontSize: 15,
    lineHeight: 22,
  },
  detailsLink: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  detailsFileRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  detailsFileName: {
    flex: 1,
    fontSize: 13,
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
  uploadSection: {
    marginBottom: 16,
  },
  uploadLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  uploadButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  imageItem: {
    width: 84,
    height: 84,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 10,
  },
  fileList: {
    marginTop: 8,
    gap: 8,
  },
  fileItem: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 40,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
  },
  detailsImagesRow: {
    gap: 8,
    paddingRight: 8,
  },
  detailsImagePreview: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: '#0F172A22',
  },
  bottomPadding: {
    height: 40,
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 15,
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
});
