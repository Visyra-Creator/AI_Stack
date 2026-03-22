import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/common/Card';
import { FormInput } from '@/src/components/common/FormInput';
import { MultiSelect } from '@/src/components/common/MultiSelect';
import { Select } from '@/src/components/common/Select';
import { EmptyState } from '@/src/components/common/EmptyState';
import { DoubleTapImage } from '@/src/components/common/DoubleTapImage';
import { aiStackStorage, aiStackCategoryStorage, AIStackItem } from '@/src/services/storage';

const PRICING_OPTIONS = ['free', 'paid', 'freemium'];
const SORT_OPTIONS = [
  { label: 'Recent', value: 'recent' },
  { label: 'Name', value: 'name' },
  { label: 'Pricing', value: 'pricing' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];
type ViewMode = 'normal' | 'gallery';

export default function AIStackScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const galleryColumns = 4;
  const gap = 1; // small gap for edge-to-edge look
  const galleryCardWidth = (windowWidth - (galleryColumns - 1) * gap) / galleryColumns;
  const [items, setItems] = useState<AIStackItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AIStackItem | null>(null);
  const [editingItem, setEditingItem] = useState<AIStackItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
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
    toolName: '',
    url: '',
    categories: [] as string[],
    description: '',
    images: [] as string[],
    files: [] as string[],
    usedFor: '',
    keyFeatures: '',
    pricing: 'free' as 'free' | 'paid' | 'freemium',
    bestFor: '',
    guides: '',
    instructions: '',
  });

  const loadItems = useCallback(async () => {
    const data = await aiStackStorage.getAll();
    setItems(data);
  }, []);

  const loadCategories = useCallback(async () => {
    const data = await aiStackCategoryStorage.getAll();
    setCategories(data);
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
    await aiStackCategoryStorage.saveAll(updatedCategories);
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
    await aiStackCategoryStorage.saveAll(updatedCategories);
    setCategories(updatedCategories);

    const allItems = await aiStackStorage.getAll();
    const affectedItems = allItems.filter(item => item.categories.includes(editingCategory));
    await Promise.all(
      affectedItems.map(item =>
        aiStackStorage.update(item.id, {
          categories: item.categories.map(category =>
            category === editingCategory ? value : category,
          ),
        }),
      ),
    );

    if (activeFilter === editingCategory) {
      setActiveFilter(value);
    }

    setFormData(prev => ({
      ...prev,
      categories: prev.categories.map(category =>
        category === editingCategory ? value : category,
      ),
    }));

    setEditingCategory(null);
    setEditingCategoryName('');
    await loadItems();
  };

  const deleteCategory = (categoryToDelete: string) => {
    Alert.alert(
      'Delete Category',
      `Delete "${categoryToDelete}"? This removes it from existing tools too.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedCategories = categories.filter(category => category !== categoryToDelete);
            await aiStackCategoryStorage.saveAll(updatedCategories);
            setCategories(updatedCategories);

            const allItems = await aiStackStorage.getAll();
            const affectedItems = allItems.filter(item => item.categories.includes(categoryToDelete));
            await Promise.all(
              affectedItems.map(item =>
                aiStackStorage.update(item.id, {
                  categories: item.categories.filter(category => category !== categoryToDelete),
                }),
              ),
            );

            if (activeFilter === categoryToDelete) {
              setActiveFilter('All');
            }

            setFormData(prev => ({
              ...prev,
              categories: prev.categories.filter(category => category !== categoryToDelete),
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
      toolName: '',
      url: '',
      categories: [],
      description: '',
      images: [],
      files: [],
      usedFor: '',
      keyFeatures: '',
      pricing: 'free',
      bestFor: '',
      guides: '',
      instructions: '',
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: AIStackItem) => {
    setEditingItem(item);
    setFormData({
      toolName: item.toolName,
      url: item.url,
      categories: item.categories,
      description: item.description || '',
      images: item.images || [],
      files: item.files || [],
      usedFor: item.usedFor,
      keyFeatures: item.keyFeatures,
      pricing: item.pricing,
      bestFor: item.bestFor,
      guides: item.guides,
      instructions: item.instructions,
    });
    setModalVisible(true);
  };

  const openDetailsModal = (item: AIStackItem) => {
    console.log('AI Stack item:', item);
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
      await aiStackStorage.update(editingItem.id, formData);
    } else {
      await aiStackStorage.add(formData);
    }

    await loadItems();
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (item: AIStackItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.toolName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await aiStackStorage.delete(item.id);
          await loadItems();
        },
      },
    ]);
  };

  const toggleFavorite = async (item: AIStackItem) => {
    const nextFavorite = !(item.isFavorite ?? false);
    await aiStackStorage.update(item.id, { isFavorite: nextFavorite });
    setItems(prev => prev.map(current => (current.id === item.id ? { ...current, isFavorite: nextFavorite } : current)));
  };

  const onFavoritePress = (event: GestureResponderEvent, item: AIStackItem) => {
    event.stopPropagation();
    toggleFavorite(item);
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

  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
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

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
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

  const getImageUri = (imageStr: string) => {
    try {
      const parsed = JSON.parse(imageStr);
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

    try {
      const supported = await Linking.canOpenURL(uri);
      if (!supported) {
        Alert.alert('Unable to open file', 'No app available to open this file type.');
        return;
      }
      await Linking.openURL(uri);
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

  const openFilesPicker = (files: string[]) => {
    if (files.length === 1) {
      openFile(files[0]);
      return;
    }

    Alert.alert(
      'Open attachment',
      'Choose a file to open',
      [
        ...files.slice(0, 8).map(file => ({
          text: getFileName(file),
          onPress: () => openFile(file),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const filteredItems = items.filter(item => {
    const matchesQuery =
      item.toolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.categories.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter =
      activeFilter === 'All' ||
      (activeFilter === 'Favorites' ? (item.isFavorite ?? false) : item.categories.includes(activeFilter));

    return matchesQuery && matchesFilter;
  });

  const displayedItems = [...filteredItems].sort((a, b) => {
    if (activeSort === 'name') {
      return a.toolName.localeCompare(b.toolName);
    }

    if (activeSort === 'pricing') {
      return a.pricing.localeCompare(b.pricing);
    }

    return b.createdAt - a.createdAt;
  });

  const filterOptions = ['All', 'Favorites', ...categories];
  const isFavoritesOnly = activeFilter === 'Favorites';

  const toggleFavoritesOnly = () => {
    setActiveFilter(prev => (prev === 'Favorites' ? 'All' : 'Favorites'));
  };

  const getPricingColor = (pricing: string) => {
    switch (pricing) {
      case 'free': return colors.success;
      case 'paid': return colors.danger;
      case 'freemium': return colors.warning;
      default: return colors.textSecondary;
    }
  };

  const getCardSubtitle = (item: AIStackItem) => {
    const raw = (item.description?.trim() || '').trim();
    if (!raw) return '';
    return raw.split('\n')[0].trim();
  };

  const getPrimaryImageUri = (item: AIStackItem) => {
    if (!item.images || item.images.length === 0) return undefined;
    return getImageUri(item.images[0]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>AI Stack</Text>
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
          icon="layers-outline"
          title="No AI Tools Yet"
          description="Start building your AI stack by adding your favorite tools."
          actionLabel="Add Tool"
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
              title={item.toolName}
              subtitle={getCardSubtitle(item)}
              subtitleLines={1}
              onPress={() => openDetailsModal(item)}
              onFavorite={() => toggleFavorite(item)}
              isFavorite={item.isFavorite ?? false}
              onEdit={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
            >
              <View style={styles.cardFooter}>
                <View style={styles.metaTagsWrap}>
                  {item.categories.map((tag, index) => (
                    <View key={`${tag}-${index}`} style={[styles.metaTag, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.metaTagText, { color: colors.primary }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.pricingBadge, { backgroundColor: getPricingColor(item.pricing) + '20' }]}>
                  <Text style={[styles.pricingText, { color: getPricingColor(item.pricing) }]}>
                    {item.pricing.charAt(0).toUpperCase() + item.pricing.slice(1)}
                  </Text>
                </View>
                {item.files && item.files.length > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.docsBadge,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                    onPress={() => openFilesPicker(item.files || [])}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.docsBadgeText, { color: colors.textSecondary }]}>
                      {item.files.length} doc(s)
                    </Text>
                  </TouchableOpacity>
                )}
                {item.images && item.images.length > 0 && (
                  <View style={[styles.pricingBadge, { backgroundColor: colors.warning + '20' }]}>
                    <Text style={[styles.pricingText, { color: colors.warning }]}>
                      {item.images.length} image(s)
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
                  <Text style={styles.galleryTitle} numberOfLines={1}>{item.toolName}</Text>
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
            <ScrollView
              style={styles.detailsScroll}
              contentContainerStyle={styles.detailsScrollContent}
              showsVerticalScrollIndicator
            >
              <Text style={[styles.detailsTitle, { color: colors.text }]}>{selectedItem.toolName}</Text>

              {selectedItem.categories.length > 0 && (
                <View style={styles.detailsTags}>
                  {selectedItem.categories.map((tag, index) => (
                    <View key={`${tag}-${index}`} style={[styles.detailsTag, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.detailsTagText, { color: colors.primary }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.detailsSection}>
                <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Pricing</Text>
                <Text style={[styles.detailsValue, { color: getPricingColor(selectedItem.pricing) }]}>
                  {selectedItem.pricing.charAt(0).toUpperCase() + selectedItem.pricing.slice(1)}
                </Text>
              </View>

              {!!selectedItem.description?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Description</Text>
                  {renderLinkedText(selectedItem.description)}
                </View>
              )}

              {!!selectedItem.usedFor?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>What It Is Used For</Text>
                  {renderLinkedText(selectedItem.usedFor)}
                </View>
              )}

              {!!selectedItem.keyFeatures?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Key Features</Text>
                  {renderLinkedText(selectedItem.keyFeatures)}
                </View>
              )}

              {!!selectedItem.bestFor?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Best For</Text>
                  {renderLinkedText(selectedItem.bestFor)}
                </View>
              )}

              {!!selectedItem.guides?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Guides/Documents</Text>
                  {renderLinkedText(selectedItem.guides)}
                </View>
              )}

              {!!selectedItem.url?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>URL</Text>
                  <TouchableOpacity onPress={() => openExternalLink(selectedItem.url)}>
                    <Text style={[styles.detailsLink, { color: colors.primary }]} numberOfLines={2}>
                      {selectedItem.url}
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
                      const uri = getImageUri(image);
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

              {!!selectedItem.instructions?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Instructions</Text>
                  {renderLinkedText(selectedItem.instructions)}
                </View>
              )}

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
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <FormInput
              label="Tool Name *"
              placeholder="e.g., ChatGPT, Midjourney"
              value={formData.toolName}
              onChangeText={(text) => setFormData({ ...formData, toolName: text })}
            />
            <FormInput
              label="URL"
              placeholder="https://..."
              value={formData.url}
              onChangeText={(text) => setFormData({ ...formData, url: text })}
              keyboardType="url"
              autoCapitalize="none"
            />
            <MultiSelect
              label="Categories"
              options={categories}
              selected={formData.categories}
              onChange={(categories) => setFormData({ ...formData, categories })}
            />
            <TouchableOpacity
              style={[styles.manageCategoriesButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setCategoriesModalVisible(true)}
            >
              <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.manageCategoriesText, { color: colors.text }]}>Manage Categories</Text>
            </TouchableOpacity>
            <FormInput
              label="Description"
              placeholder="Add a full description of this tool..."
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              style={styles.textArea}
            />
            <FormInput
              label="What's It Used For"
              placeholder="Describe the main use case..."
              value={formData.usedFor}
              onChangeText={(text) => setFormData({ ...formData, usedFor: text })}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
            <FormInput
              label="Key Features"
              placeholder="List the main features..."
              value={formData.keyFeatures}
              onChangeText={(text) => setFormData({ ...formData, keyFeatures: text })}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
            <Select
              label="Pricing"
              options={PRICING_OPTIONS}
              value={formData.pricing}
              onChange={(pricing) => setFormData({ ...formData, pricing: pricing as any })}
            />
            <FormInput
              label="Best For"
              placeholder="Who would benefit most..."
              value={formData.bestFor}
              onChangeText={(text) => setFormData({ ...formData, bestFor: text })}
            />
            <FormInput
              label="Guides/Documents"
              placeholder="Links to guides, documentation..."
              value={formData.guides}
              onChangeText={(text) => setFormData({ ...formData, guides: text })}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
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
                    const uri = getImageUri(image);
                    if (!uri) return null;
                    return (
                      <View key={`${image}-${index}`} style={styles.imageItem}>
                        <Image source={{ uri }} style={styles.imagePreview} resizeMode="contain" />
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
            <FormInput
              label="Instructions"
              placeholder="Personal notes, tips..."
              value={formData.instructions}
              onChangeText={(text) => setFormData({ ...formData, instructions: text })}
              multiline
              style={styles.textArea}
            />
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
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  metaTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metaTagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  pricingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pricingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  docsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  docsBadgeText: {
    fontSize: 11,
    fontWeight: '500',
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
  detailsScroll: {
    flex: 1,
  },
  detailsScrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  detailsTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  detailsTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  detailsTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  detailsTagText: {
    fontSize: 12,
    fontWeight: '600',
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
    marginBottom: 6,
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
  fileList: {
    marginTop: 10,
    gap: 8,
  },
  fileItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
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
  imageGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    backgroundColor: '#0F172A22',
  },
  imageRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 10,
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
