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
  Image,
  TextInput,
  FlatList,
  useWindowDimensions,
  GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/common/Card';
import { FormInput } from '@/src/components/common/FormInput';
import { Select } from '@/src/components/common/Select';
import { Button } from '@/src/components/common/Button';
import { EmptyState } from '@/src/components/common/EmptyState';
import { marketingStorage, marketingCategoryStorage, MarketingItem } from '@/src/services/storage';

const SORT_OPTIONS = [
  { label: 'Recent', value: 'recent' },
  { label: 'Name', value: 'name' },
  { label: 'Category', value: 'category' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];
type ViewMode = 'normal' | 'gallery';

export default function MarketingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const galleryColumns = 4;
  const gap = 1;
  const galleryCardWidth = (windowWidth - (galleryColumns - 1) * gap) / galleryColumns;
  const [items, setItems] = useState<MarketingItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MarketingItem | null>(null);
  const [editingItem, setEditingItem] = useState<MarketingItem | null>(null);
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

  const [formData, setFormData] = useState({
    name: '',
    toolLink: '',
    description: '',
    category: '',
    categories: [] as string[],
    instructions: '',
    link: '',
    image: undefined as string | undefined,
    file: undefined as string | undefined,
    images: [] as string[],
    files: [] as string[],
  });

  const loadItems = useCallback(async () => {
    const data = await marketingStorage.getAll();
    setItems(data);
  }, []);

  const loadCategories = useCallback(async () => {
    const data = await marketingCategoryStorage.getAll();
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

  const getDefaultCategory = (source?: string[]) => {
    const current = source || categories;
    if (current.includes('Other')) return 'Other';
    if (current.includes('other')) return 'other';
    if (current.length > 0) return current[0];
    return 'other';
  };

  const normalizeCategory = (value: string) => value.trim();


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

    const updatedCategories = categories.map((category) =>
      category === editingCategory ? value : category,
    );
    await marketingCategoryStorage.saveAll(updatedCategories);
    setCategories(updatedCategories);
    setFormData((prev) => ({
      ...prev,
      category: prev.category === editingCategory ? value : prev.category,
      categories: prev.categories.map((category) => (category === editingCategory ? value : category)),
    }));
    setEditingCategory(null);
    setEditingCategoryName('');
  };

  const deleteCategory = (categoryToDelete: string) => {
    Alert.alert('Delete Category', `Delete "${categoryToDelete}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updatedCategories = categories.filter((category) => category !== categoryToDelete);
          const fallback = getDefaultCategory(updatedCategories);
          await marketingCategoryStorage.saveAll(updatedCategories);
          setCategories(updatedCategories);
          setFormData((prev) => ({
            ...prev,
            category: prev.category === categoryToDelete ? fallback : prev.category,
            categories: prev.categories.filter((category) => category !== categoryToDelete),
          }));
          if (editingCategory === categoryToDelete) {
            setEditingCategory(null);
            setEditingCategoryName('');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      toolLink: '',
      description: '',
      category: '',
      categories: [],
      instructions: '',
      link: '',
      image: undefined,
      file: undefined,
      images: [],
      files: [],
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: MarketingItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      toolLink: item.toolLink,
      description: item.description,
      category: item.category || (item.categories && item.categories.length > 0 ? item.categories[0] : ''),
      categories: item.categories || (item.category ? [item.category] : []),
      instructions: item.instructions,
      link: item.link,
      image: item.image,
      file: item.file,
      images: item.images || [],
      files: item.files || [],
    });
    setModalVisible(true);
  };

  const openDetailsModal = (item: MarketingItem) => {
    setSelectedItem(item);
    setDetailsVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    const payload = {
      ...formData,
      category: formData.category || formData.categories[0] || getDefaultCategory(),
      image: formData.images[0],
      file: formData.files[0],
    };

    if (editingItem) {
      await marketingStorage.update(editingItem.id, payload);
    } else {
      await marketingStorage.add(payload);
    }

    await loadItems();
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (item: MarketingItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await marketingStorage.delete(item.id);
          await loadItems();
        },
      },
    ]);
  };

  const toggleFavorite = async (item: MarketingItem) => {
    const nextFavorite = !(item.isFavorite ?? false);

    // Optimistic update so favorites feel instant in list and gallery.
    setItems(prev =>
      prev.map(existing =>
        existing.id === item.id
          ? {
              ...existing,
              isFavorite: nextFavorite,
              favoritedAt: nextFavorite ? Date.now() : undefined,
            }
          : existing,
      ),
    );

    try {
      await marketingStorage.update(item.id, {
        isFavorite: nextFavorite,
        favoritedAt: nextFavorite ? Date.now() : undefined,
      });
    } catch {
      // Revert if persistence fails.
      setItems(prev =>
        prev.map(existing =>
          existing.id === item.id
            ? {
                ...existing,
                isFavorite: item.isFavorite ?? false,
                favoritedAt: item.favoritedAt,
              }
            : existing,
        ),
      );
    }
  };

  const onFavoritePress = (event: GestureResponderEvent, item: MarketingItem) => {
    event.stopPropagation();
    toggleFavorite(item);
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const nextFiles = result.assets.map((asset) =>
          JSON.stringify({ name: asset.name, uri: asset.uri, size: asset.size })
        );
        const merged = [...formData.files, ...nextFiles];
        setFormData({
          ...formData,
          files: merged,
          file: merged[0],
        });
      }
    } catch (error) {
      console.log('Error picking file:', error);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets.length > 0) {
        const nextImages = result.assets.map((asset) =>
          JSON.stringify({
            name: asset.fileName || `image-${Date.now()}`,
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
          })
        );
        const merged = [...formData.images, ...nextImages].slice(0, 10);
        setFormData({
          ...formData,
          images: merged,
          image: merged[0],
        });
      }
    } catch (error) {
      console.log('Error picking image:', error);
    }
  };

  const getFileName = (fileStr?: string): string | null => {
    if (!fileStr) return null;
    try {
      const parsed = JSON.parse(fileStr);
      return parsed.name || 'File';
    } catch {
      return null;
    }
  };

  const getImageUri = (imageStr?: string): string | null => {
    if (!imageStr) return null;
    try {
      const parsed = JSON.parse(imageStr);
      return parsed.uri || null;
    } catch {
      return null;
    }
  };

  const getCardSubtitle = (item: MarketingItem) => {
    const raw = (item.description?.trim() || '').trim();
    if (!raw) return '';
    return raw.split('\n')[0].trim();
  };

  const getFirstImage = (item: MarketingItem) => item.images?.[0] || item.image;

  const getPrimaryCategory = (item: MarketingItem) => {
    if (item.category && item.category.trim()) return item.category;
    if (Array.isArray(item.categories) && item.categories.length > 0) return item.categories[0];
    return '';
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return items.filter(item => {
      const matchesSearch =
        !query ||
        (item.name || '').toLowerCase().includes(query) ||
        (item.description || '').toLowerCase().includes(query) ||
        (item.instructions || '').toLowerCase().includes(query) ||
        (item.toolLink || '').toLowerCase().includes(query);

      const matchesFilter =
        activeFilter === 'All' ||
        (activeFilter === 'Favorites' ? (item.isFavorite ?? false) : (item.categories || (item.category ? [item.category] : [])).includes(activeFilter));

      return matchesSearch && matchesFilter;
    });
  }, [items, searchQuery, activeFilter]);

  const displayedItems = useMemo(() => {
    const sorted = [...filteredItems];
    if (activeSort === 'name') {
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (activeSort === 'category') {
      sorted.sort((a, b) => getPrimaryCategory(a).localeCompare(getPrimaryCategory(b)));
    } else {
      sorted.sort((a, b) => b.createdAt - a.createdAt);
    }
    return sorted;
  }, [filteredItems, activeSort]);

  const uniqueCategories = [
    'All',
    'Favorites',
    ...new Set([...categories, ...items.map((item) => getPrimaryCategory(item)).filter(Boolean)]),
  ];
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
          <Ionicons name="home-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Marketing</Text>
        <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              placeholder="Search marketing..."
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
          icon="megaphone-outline"
          title="No Marketing Tools"
          description="Track your marketing tools, strategies, and resources."
          actionLabel="Add Tool"
          onAction={openAddModal}
        />
      ) : viewMode === 'gallery' ? (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.galleryListContent}
          data={displayedItems}
          key={`gallery-${galleryColumns}`}
          numColumns={galleryColumns}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
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
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={(item.isFavorite ?? false) ? 'heart' : 'heart-outline'}
                  size={16}
                  color={(item.isFavorite ?? false) ? '#FF6B6B' : '#FFFFFF'}
                />
              </TouchableOpacity>
              {getImageUri(getFirstImage(item)) ? (
                <Image source={{ uri: getImageUri(getFirstImage(item)) as string }} style={styles.galleryImage} resizeMode="contain" />
              ) : (
                <View style={[styles.galleryPlaceholder, { backgroundColor: colors.surface }]}>
                  <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
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
          )}
        />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
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
      )}

      <Modal visible={detailsVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setDetailsVisible(false)}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Marketing Details</Text>
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
            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <Text style={[styles.detailsTitleText, { color: colors.text }]}>{selectedItem.name}</Text>

              {!!getImageUri(getFirstImage(selectedItem)) && (
                <Image
                  source={{ uri: getImageUri(getFirstImage(selectedItem)) as string }}
                  style={[styles.detailsImage, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  resizeMode="contain"
                />
              )}

              <View style={styles.metaTagsWrap}>
                {(selectedItem.categories || (selectedItem.category ? [selectedItem.category] : [])).map((tag, index) => (
                  <View key={`${tag}-${index}`} style={[styles.metaTag, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.metaTagText, { color: colors.primary }]}>{tag}</Text>
                  </View>
                ))}
              </View>

              {!!selectedItem.description?.trim() && (
                <>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Description</Text>
                  <Text style={[styles.detailsBodyText, { color: colors.text }]}>{selectedItem.description}</Text>
                </>
              )}

              {!!selectedItem.instructions?.trim() && (
                <>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Instructions</Text>
                  <Text style={[styles.detailsBodyText, { color: colors.text }]}>{selectedItem.instructions}</Text>
                </>
              )}

              {!!selectedItem.toolLink?.trim() && (
                <>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Tool Link</Text>
                  <Text style={[styles.detailsBodyText, { color: colors.primary }]}>{selectedItem.toolLink}</Text>
                </>
              )}

              <View style={styles.bottomPadding} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <Modal visible={filterModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Filter by Category</Text>
            {uniqueCategories.map(option => (
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
              label="Name *"
              placeholder="e.g., Mailchimp, HubSpot"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
            <FormInput
              label="Tool Link"
              placeholder="https://..."
              value={formData.toolLink}
              onChangeText={(text) => setFormData({ ...formData, toolLink: text })}
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
            <Select
              label="Category"
              options={categories}
              value={formData.category}
              onChange={(category) =>
                setFormData({
                  ...formData,
                  category,
                  categories: formData.categories.includes(category)
                    ? formData.categories
                    : [category, ...formData.categories],
                })
              }
            />
            <TouchableOpacity
              style={[styles.manageCategoriesButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setCategoriesModalVisible(true)}
            >
              <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.manageCategoriesText, { color: colors.text }]}>Manage Categories</Text>
            </TouchableOpacity>
            <FormInput
              label="Instructions"
              placeholder="How to use this resource..."
              value={formData.instructions}
              onChangeText={(text) => setFormData({ ...formData, instructions: text })}
              multiline
              numberOfLines={5}
              style={styles.textArea}
            />


            <View style={styles.imageSection}>
              <Text style={[styles.uploadLabel, { color: colors.textSecondary }]}>Upload Image</Text>
              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={pickImage}
              >
                <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.uploadButtonText, { color: colors.text }]}>Select Images</Text>
              </TouchableOpacity>

              {formData.images.length > 0 && (
                <View style={styles.previewListWrap}>
                  {formData.images.map((imageStr, index) => (
                    <View key={`${imageStr.slice(0, 24)}-${index}`} style={styles.imagePreviewWrap}>
                      <Image source={{ uri: getImageUri(imageStr) as string }} style={styles.imagePreview} resizeMode="cover" />
                      <TouchableOpacity
                        style={[styles.imageRemoveButton, { backgroundColor: colors.background }]}
                        onPress={() => {
                          const next = formData.images.filter((_, i) => i !== index);
                          setFormData({ ...formData, images: next, image: next[0] });
                        }}
                      >
                        <Ionicons name="close-circle" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.fileSection}>
              <Text style={[styles.fileLabel, { color: colors.textSecondary }]}>File Upload</Text>
              <Button title="Select Files" onPress={pickFile} variant="outline" />
              {formData.files.length > 0 && (
                <View style={styles.fileListWrap}>
                  {formData.files.map((fileStr, index) => (
                    <View key={`${fileStr.slice(0, 24)}-${index}`} style={[styles.fileItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Ionicons name="document-outline" size={20} color={colors.primary} />
                      <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                        {getFileName(fileStr)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          const next = formData.files.filter((_, i) => i !== index);
                          setFormData({ ...formData, files: next, file: next[0] });
                        }}
                      >
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
                onPress={async () => {
                  const value = normalizeCategory(newCategoryName);
                  if (!value) {
                    Alert.alert('Error', 'Category name cannot be empty');
                    return;
                  }
                  if (categories.some((category) => category.toLowerCase() === value.toLowerCase())) {
                    Alert.alert('Error', 'Category already exists');
                    return;
                  }

                  const updatedCategories = [...categories, value].sort((a, b) => {
                    if (a.toLowerCase() === 'other') return 1;
                    if (b.toLowerCase() === 'other') return -1;
                    return a.localeCompare(b, undefined, { sensitivity: 'base' });
                  });
                  await marketingCategoryStorage.saveAll(updatedCategories);
                  setCategories(updatedCategories);
                  setNewCategoryName('');
                }}
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
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 9,
    paddingLeft: 8,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  favoriteFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 62,
  },
  manageCategoriesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  manageCategoriesText: {
    fontSize: 13,
    fontWeight: '500',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  galleryListContent: {
    paddingBottom: 12,
  },
  galleryColumnWrapper: {
    gap: 1,
  },
  galleryCard: {
    aspectRatio: 1,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 1,
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
  galleryFavoriteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  galleryOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  galleryTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  gallerySubtitle: {
    color: '#D1D5DB',
    fontSize: 10,
    marginTop: 2,
  },
  cardImage: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  imagePreviewWrap: {
    marginTop: 10,
    width: 120,
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewListWrap: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageRemoveButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 12,
  },
  fileSection: {
    marginBottom: 16,
  },
  fileLabel: {
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
  fileListWrap: {
    marginTop: 2,
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  optionSheet: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    maxHeight: '75%',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  optionText: {
    fontSize: 14,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  optionClose: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  optionCloseText: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 10,
    marginBottom: 10,
  },
  categoryInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
    paddingRight: 8,
  },
  categoryActionButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  categoriesList: {
    maxHeight: 260,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  categoryEditInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    marginRight: 10,
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIconButton: {
    padding: 4,
  },
  bottomPadding: {
    height: 40,
  },
  detailsTitleText: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 4,
  },
  detailsBodyText: {
    fontSize: 14,
    lineHeight: 21,
  },
  detailsImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
});
