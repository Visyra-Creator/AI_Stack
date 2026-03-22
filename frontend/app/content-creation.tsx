import React, { useState, useEffect, useCallback } from 'react';
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
  FlatList,
  useWindowDimensions,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/common/Card';
import { FormInput } from '@/src/components/common/FormInput';
import { MultiSelect } from '@/src/components/common/MultiSelect';
import { EmptyState } from '@/src/components/common/EmptyState';
import { DoubleTapImage } from '@/src/components/common/DoubleTapImage';
import { contentCreationStorage, contentCreationCategoryStorage, ContentCreationItem } from '@/src/services/storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

const SORT_OPTIONS = [
  { label: 'Recent', value: 'recent' },
  { label: 'Name', value: 'name' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];
type ViewMode = 'normal' | 'gallery';

export default function ContentCreationScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [items, setItems] = useState<ContentCreationItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  const { width: windowWidth } = useWindowDimensions();
  const galleryColumns = 4;
  const gap = 1; // small gap for edge-to-edge look
  const galleryCardWidth = (windowWidth - (galleryColumns - 1) * gap) / galleryColumns;
  
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ContentCreationItem | null>(null);
  const [editingItem, setEditingItem] = useState<ContentCreationItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Search, Filter, Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [activeSort, setActiveSort] = useState<SortValue>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  
  // Category Modal state
  const [categoriesModalVisible, setCategoriesModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const [formData, setFormData] = useState({
    toolName: '',
    toolLink: '',
    categories: [] as string[],
    description: '',
    instructions: '',
    videoLink: '',
    images: [] as string[],
    files: [] as string[],
  });

  const loadItems = useCallback(async () => {
    const data = await contentCreationStorage.getAll();
    setItems(data);
  }, []);

  const loadCategories = useCallback(async () => {
    const data = await contentCreationCategoryStorage.getAll();
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
    await contentCreationCategoryStorage.saveAll(updatedCategories);
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
          category.toLowerCase() !== editingCategory.toLowerCase()
      )
    ) {
      Alert.alert('Error', 'Category already exists');
      return;
    }

    const updatedCategories = categories.map(category =>
      category === editingCategory ? value : category
    );
    await contentCreationCategoryStorage.saveAll(updatedCategories);
    setCategories(updatedCategories);

    const allItems = await contentCreationStorage.getAll();
    const affectedItems = allItems.filter(item => item.categories?.includes(editingCategory));
    await Promise.all(
      affectedItems.map(item =>
        contentCreationStorage.update(item.id, {
          categories: (item.categories || []).map(category =>
            category === editingCategory ? value : category
          ),
        })
      )
    );

    if (activeFilter === editingCategory) {
      setActiveFilter(value);
    }

    setFormData(prev => ({
      ...prev,
      categories: prev.categories.map(category =>
        category === editingCategory ? value : category
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
            await contentCreationCategoryStorage.saveAll(updatedCategories);
            setCategories(updatedCategories);

            const allItems = await contentCreationStorage.getAll();
            const affectedItems = allItems.filter(item => item.categories?.includes(categoryToDelete));
            await Promise.all(
              affectedItems.map(item =>
                contentCreationStorage.update(item.id, {
                  categories: (item.categories || []).filter(category => category !== categoryToDelete),
                })
              )
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
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      toolName: '',
      toolLink: '',
      categories: [],
      description: '',
      instructions: '',
      videoLink: '',
      images: [],
      files: [],
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: ContentCreationItem) => {
    setEditingItem(item);
    setFormData({
      toolName: item.toolName,
      toolLink: item.toolLink || '',
      categories: item.categories || [],
      description: item.description || '',
      instructions: item.instructions || '',
      videoLink: item.videoLink || '',
      images: item.images || [],
      files: item.files || [],
    });
    setModalVisible(true);
  };

  const openDetailsModal = (item: ContentCreationItem) => {
    setSelectedItem(item);
    setDetailsVisible(true);
  };

  const openEditFromDetails = () => {
    if (selectedItem) {
      setDetailsVisible(false);
      openEditModal(selectedItem);
    }
  };

  const openExternalLink = async (url: string) => {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this link.');
      }
    } catch (error) {
      console.error(error);
    }
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

      if (!result.canceled) {
        const newImages = result.assets.map(asset => 
          JSON.stringify({
            name: asset.fileName || `Image ${Date.now()}`,
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
          })
        );
        
        // @ts-ignore
        setFormData(prev => ({ ...prev, images: [...(prev.images || []), ...newImages] }));
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const removeImage = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      // @ts-ignore
      images: (prev.images || []).filter((_, index) => index !== indexToRemove),
    }));
  };

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const newFiles = result.assets.map(asset => 
          JSON.stringify({
            name: asset.name,
            uri: asset.uri,
            size: asset.size,
            mimeType: asset.mimeType,
          })
        );
        
        // @ts-ignore
        setFormData(prev => ({ ...prev, files: [...(prev.files || []), ...newFiles] }));
      }
    } catch (error) {
      console.error('Error picking files:', error);
      Alert.alert('Error', 'Failed to pick files');
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      // @ts-ignore
      files: (prev.files || []).filter((_, index) => index !== indexToRemove),
    }));
  };

  const handleSave = async () => {
    if (!formData.toolName.trim()) {
      Alert.alert('Error', 'Tool name is required');
      return;
    }

    if (editingItem) {
      await contentCreationStorage.update(editingItem.id, formData);
    } else {
      await contentCreationStorage.add(formData);
    }

    await loadItems();
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (item: ContentCreationItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.toolName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await contentCreationStorage.delete(item.id);
          await loadItems();
        },
      },
    ]);
  };

  const toggleFavorite = async (item: ContentCreationItem) => {
    const nextFavorite = !(item.isFavorite ?? false);
    await contentCreationStorage.update(item.id, { isFavorite: nextFavorite });
    setItems(prev => prev.map(current => (current.id === item.id ? { ...current, isFavorite: nextFavorite } : current)));
  };

  const filteredItems = items.filter(item => {
    const matchesQuery =
      item.toolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.categories || []).some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter =
      activeFilter === 'All' ||
      (activeFilter === 'Favorites' ? (item.isFavorite ?? false) : (item.categories || []).includes(activeFilter));

    return matchesQuery && matchesFilter;
  });

  const displayedItems = [...filteredItems].sort((a, b) => {
    if (activeSort === 'name') {
      return a.toolName.localeCompare(b.toolName);
    }
    return b.createdAt - a.createdAt;
  });

  const filterOptions = ['All', 'Favorites', ...categories];
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
        <Text style={[styles.title, { color: colors.text }]}>Content Creation</Text>
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
          icon="create-outline"
          title="No Content Tools Found"
          description="Try adjusting your filters or add a new tool."
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
              subtitle={item.description}
              onPress={() => openDetailsModal(item)}
              onFavorite={() => toggleFavorite(item)}
              isFavorite={item.isFavorite ?? false}
              onEdit={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
            >
              <View style={styles.cardFooter}>
                <View style={styles.metaTagsWrap}>
                  {(item.categories || []).map((tag, index) => (
                    <View key={`${tag}-${index}`} style={[styles.metaTag, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.metaTagText, { color: colors.primary }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.badgesWrap}>
                  {item.toolLink && (
                    <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
                      <Ionicons name="link" size={14} color={colors.primary} />
                      <Text style={[styles.badgeText, { color: colors.primary }]}>Link</Text>
                    </View>
                  )}
                  {item.videoLink && (
                    <View style={[styles.badge, { backgroundColor: colors.danger + '20' }]}>
                      <Ionicons name="videocam" size={14} color={colors.danger} />
                      <Text style={[styles.badgeText, { color: colors.danger }]}>Video</Text>
                    </View>
                  )}
                  {item.images && item.images.length > 0 && (
                    <View style={[styles.badge, { backgroundColor: colors.warning + '20' }]}>
                      <Ionicons name="image-outline" size={14} color={colors.warning} />
                      <Text style={[styles.badgeText, { color: colors.warning }]}>{item.images.length} Image(s)</Text>
                    </View>
                  )}
                  {item.files && item.files.length > 0 && (
                    <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
                      <Ionicons name="document-outline" size={14} color={colors.primary} />
                      <Text style={[styles.badgeText, { color: colors.primary }]}>{item.files.length} File(s)</Text>
                    </View>
                  )}
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
            let uri = null;
            if (item.images && item.images.length > 0) {
              try {
                const parsed = typeof item.images[0] === 'string' ? JSON.parse(item.images[0]) : item.images[0];
                uri = parsed.uri;
              } catch {}
            }
            
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
                  onPress={(event) => {
                    event.stopPropagation();
                    toggleFavorite(item);
                  }}
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
                    <Ionicons name="create-outline" size={24} color={colors.textSecondary} />
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
                <Text style={styles.gallerySubtitle} numberOfLines={1}>{item.description}</Text>
              </View>
            </TouchableOpacity>
            );
          }}
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
              placeholder="e.g., Canva, CapCut"
              value={formData.toolName}
              onChangeText={(text) => setFormData({ ...formData, toolName: text })}
            />
            <FormInput
              label="Tool Link"
              placeholder="https://..."
              value={formData.toolLink}
              onChangeText={(text) => setFormData({ ...formData, toolLink: text })}
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
              placeholder="What does this tool do?"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
            <FormInput
              label="Instructions"
              placeholder="How to use for content creation..."
              value={formData.instructions}
              onChangeText={(text) => setFormData({ ...formData, instructions: text })}
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />
              <FormInput
                label="Video Link"
                placeholder="YouTube tutorial, etc."
                value={formData.videoLink}
                onChangeText={(text) => setFormData({ ...formData, videoLink: text })}
                keyboardType="url"
                autoCapitalize="none"
              />

              <View style={styles.imageUploadSection}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Images</Text>
                
                {/* @ts-ignore */}
                {formData.images && formData.images.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewScroll}>
                    {/* @ts-ignore */}
                    {formData.images.map((imageStr, index) => {
                      try {
                        const img = typeof imageStr === 'string' ? JSON.parse(imageStr) : imageStr;
                        return (
                          <View key={index} style={[styles.imagePreviewContainer, { borderColor: colors.border }]}>
                            <Image source={{ uri: img.uri }} style={styles.imagePreview} />
                            <TouchableOpacity
                              style={[styles.removeImageButton, { backgroundColor: colors.danger }]}
                              onPress={() => removeImage(index)}
                            >
                              <Ionicons name="close" size={12} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        );
                      } catch { return null; }
                    })}
                  </ScrollView>
                )}

                <TouchableOpacity
                  style={[styles.attachButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={pickImages}
                >
                  <Ionicons name="images-outline" size={20} color={colors.primary} />
                  <Text style={[styles.attachButtonText, { color: colors.text }]}>Add Images</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.fileUploadSection}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Files</Text>
                
                {/* @ts-ignore */}
                {formData.files && formData.files.length > 0 && (
                  <View style={styles.filePreviewContainer}>
                    {/* @ts-ignore */}
                    {formData.files.map((fileStr, index) => {
                      try {
                        const file = typeof fileStr === 'string' ? JSON.parse(fileStr) : fileStr;
                        return (
                          <View key={index} style={[styles.fileItem, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                            <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                            <Text style={[styles.fileItemText, { color: colors.text }]} numberOfLines={1}>{file.name}</Text>
                            <TouchableOpacity
                              style={styles.removeFileButton}
                              onPress={() => removeFile(index)}
                            >
                              <Ionicons name="close-circle" size={20} color={colors.danger} />
                            </TouchableOpacity>
                          </View>
                        );
                        } catch { return null; }
                    })}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.attachButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={pickFiles}
                >
                  <Ionicons name="document-attach-outline" size={20} color={colors.primary} />
                  <Text style={[styles.attachButtonText, { color: colors.text }]}>Add Files</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.bottomPadding} />
            </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Details Modal */}
      <Modal visible={detailsVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setDetailsVisible(false)}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Content Details</Text>
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

              {selectedItem.categories && selectedItem.categories.length > 0 && (
                <View style={styles.detailsTags}>
                  {selectedItem.categories.map((tag, index) => (
                    <View key={`${tag}-${index}`} style={[styles.detailsTag, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.detailsTagText, { color: colors.primary }]}>{tag}</Text>
                    </View>
                  ))}
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

              {!!selectedItem.toolLink?.trim() && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Tool Link</Text>
                  <TouchableOpacity onPress={() => openExternalLink(selectedItem.toolLink!)}>
                    <Text style={[styles.detailsLink, { color: colors.primary }]} numberOfLines={2}>
                      {selectedItem.toolLink}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

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

              {selectedItem.images && selectedItem.images.length > 0 && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Images</Text>
                  <Text style={[styles.detailsImageHint, { color: colors.textSecondary }]}>Double tap an image to view full screen</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailsImagesRow}>
                    {selectedItem.images.map((imageStr, index) => {
                      try {
                        const parsed = typeof imageStr === 'string' ? JSON.parse(imageStr) : imageStr;
                        if (!parsed.uri) return null;
                        return (
                          <DoubleTapImage
                            key={`${parsed.uri}-${index}`}
                            uri={parsed.uri}
                            style={styles.detailsImagePreview}
                            resizeMode="contain"
                          />
                        );
                      } catch { return null; }
                    })}
                  </ScrollView>
                </View>
              )}

              {selectedItem.files && selectedItem.files.length > 0 && (
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsLabel, { color: colors.textSecondary }]}>Attached Files</Text>
                  <View style={styles.detailsFilesContainer}>
                    {selectedItem.files.map((fileStr, index) => {
                      try {
                        const parsed = typeof fileStr === 'string' ? JSON.parse(fileStr) : fileStr;
                        if (!parsed.uri) return null;
                        return (
                          <TouchableOpacity
                            key={`${parsed.uri}-${index}`}
                            style={[styles.detailsFileItem, { borderColor: colors.border, backgroundColor: colors.surface }]}
                            onPress={() => openExternalLink(parsed.uri)}
                          >
                            <Ionicons name="document-text-outline" size={24} color={colors.primary} />
                            <Text style={[styles.detailsFileItemText, { color: colors.text }]} numberOfLines={1}>{parsed.name || 'Document'}</Text>
                            <Ionicons name="open-outline" size={20} color={colors.textSecondary} />
                          </TouchableOpacity>
                        );
                      } catch { return null; }
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Filter Modal */}
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

      {/* Sort Modal */}
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

      {/* Categories Modal */}
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
    paddingHorizontal: 16,
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
  cardFooter: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 12,
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
  badgesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
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
  detailsScroll: {
    flex: 1,
  },
  detailsScrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  detailsTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  detailsTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  detailsTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  detailsTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 24,
  },
  detailsLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailsImageHint: {
    fontSize: 11,
    marginBottom: 8,
    opacity: 0.75,
  },
  detailsValue: {
    fontSize: 16,
    lineHeight: 24,
  },
  detailsLink: {
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  detailsImagesRow: {
    gap: 12,
    paddingRight: 24,
  },
  detailsImagePreview: {
    width: 200,
    height: 150,
    borderRadius: 8,
    backgroundColor: '#00000010',
  },
  imageUploadSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  imagePreviewScroll: {
    marginBottom: 12,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginRight: 12,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  imagePreview: {
    width: 80,
    height: 80,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    gap: 8,
  },
  attachButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  fileUploadSection: {
    marginBottom: 20,
    marginTop: 8,
  },
  filePreviewContainer: {
    gap: 8,
    marginBottom: 12,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    gap: 12,
  },
  fileItemText: {
    flex: 1,
    fontSize: 14,
  },
  removeFileButton: {
    padding: 2,
  },
  detailsFilesContainer: {
    gap: 8,
  },
  detailsFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    gap: 12,
  },
  detailsFileItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
});
