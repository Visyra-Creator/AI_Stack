import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView, Image, useWindowDimensions, FlatList, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTheme } from '@/src/context/ThemeContext';
import { Select } from '@/src/components/common/Select';
import { ImagePicker } from '@/src/components/common/ImagePicker';

type SectionId = 'images' | 'videos';

type SavedImage = {
  id: string;
  uri: string;
  category: string;
  style: string;
};

type SavedVideo = {
  id: string;
  uri: string;
  thumbnailUri?: string;
  category: string;
  style: string;
};

const DEFAULT_CATEGORY_OPTIONS = [
  'Weddings',
  'Portraits',
  'Fashion',
  'Events',
  'Commercial',
  'Product',
  'Travel',
  'Lifestyle',
  'Architecture',
  'Nature',
];

const DEFAULT_STYLE_OPTIONS = [
  'Cinematic',
  'Documentary',
  'Editorial',
  'Fine Art',
  'High Contrast',
  'Soft Light',
];

const IMAGE_SORT_OPTIONS = ['Newest', 'Oldest', 'Category', 'Style'];

type PreviewVideoPlayerProps = {
  uri: string;
  shouldPlay: boolean;
};

function PreviewVideoPlayer({ uri, shouldPlay }: PreviewVideoPlayerProps) {
  const player = useVideoPlayer(uri, (createdPlayer) => {
    createdPlayer.loop = false;
  });

  useEffect(() => {
    if (shouldPlay) {
      player.play();
      return;
    }
    player.pause();
  }, [player, shouldPlay]);

  return (
    <VideoView
      player={player}
      style={styles.previewVideoPlayer}
      contentFit="contain"
      nativeControls
      allowsFullscreen
      allowsPictureInPicture={false}
    />
  );
}

export default function PhotographyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const [activeSection, setActiveSection] = useState<SectionId>('images');
  const [imageFormVisible, setImageFormVisible] = useState(false);
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [videoFormVisible, setVideoFormVisible] = useState(false);
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_CATEGORY_OPTIONS);
  const [styleOptions, setStyleOptions] = useState<string[]>(DEFAULT_STYLE_OPTIONS);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewSection, setPreviewSection] = useState<SectionId>('images');
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [imageFilterCategory, setImageFilterCategory] = useState('All');
  const [imageSortBy, setImageSortBy] = useState('Newest');
  const [videoFilterCategory, setVideoFilterCategory] = useState('All');
  const [videoSortBy, setVideoSortBy] = useState('Newest');
  const [imageFilterModalVisible, setImageFilterModalVisible] = useState(false);
  const [imageSortModalVisible, setImageSortModalVisible] = useState(false);
  const [videoFilterModalVisible, setVideoFilterModalVisible] = useState(false);
  const [videoSortModalVisible, setVideoSortModalVisible] = useState(false);
  const [manageCategoryModalVisible, setManageCategoryModalVisible] = useState(false);
  const [manageStyleModalVisible, setManageStyleModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newStyleName, setNewStyleName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingStyle, setEditingStyle] = useState<string | null>(null);
  const [editingStyleName, setEditingStyleName] = useState('');
  const [imageForm, setImageForm] = useState({
    category: '',
    style: '',
    images: [] as string[],
  });
  const [videoForm, setVideoForm] = useState({
    category: '',
    style: '',
    videos: [] as string[],
  });
  const sections: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { label: 'Images', icon: 'images-outline' },
    { label: 'Videos', icon: 'videocam-outline' },
  ];
  const galleryColumns = viewportWidth >= 420 ? 5 : 4;
  const galleryGap = 8;
  const galleryHorizontalPadding = 24;
  const galleryAvailableWidth = Math.max(240, viewportWidth - (galleryHorizontalPadding * 2));
  const thumbnailSize = Math.floor((galleryAvailableWidth - (galleryGap * (galleryColumns - 1))) / galleryColumns);
  const isDesktopLike = viewportWidth >= 900;
  const contentBottomPadding = isDesktopLike
    ? Math.max(insets.bottom, 80)
    : Math.max(insets.bottom, 28);
  const filterCategoryOptions = useMemo(() => {
    const fromImages = savedImages.map(item => item.category).filter(Boolean);
    const fromVideos = savedVideos.map(item => item.category).filter(Boolean);
    const merged = [...categoryOptions, ...fromImages, ...fromVideos];
    const unique = Array.from(new Set(merged));
    return ['All', ...unique];
  }, [categoryOptions, savedImages, savedVideos]);

  const displayedImages = useMemo(() => {
    const filtered = savedImages.filter((item) => {
      if (imageFilterCategory === 'All') return true;
      return item.category === imageFilterCategory;
    });

    const sorted = [...filtered];
    if (imageSortBy === 'Oldest') {
      sorted.reverse();
    } else if (imageSortBy === 'Category') {
      sorted.sort((a, b) => a.category.localeCompare(b.category));
    } else if (imageSortBy === 'Style') {
      sorted.sort((a, b) => a.style.localeCompare(b.style));
    }

    return sorted;
  }, [savedImages, imageFilterCategory, imageSortBy]);

  const displayedVideos = useMemo(() => {
    const filtered = savedVideos.filter((item) => {
      if (videoFilterCategory === 'All') return true;
      return item.category === videoFilterCategory;
    });

    const sorted = [...filtered];
    if (videoSortBy === 'Oldest') {
      sorted.reverse();
    } else if (videoSortBy === 'Category') {
      sorted.sort((a, b) => a.category.localeCompare(b.category));
    } else if (videoSortBy === 'Style') {
      sorted.sort((a, b) => a.style.localeCompare(b.style));
    }

    return sorted;
  }, [savedVideos, videoFilterCategory, videoSortBy]);

  const handleUploadPress = (section: SectionId) => {
    if (section === 'images') {
      setImageFormVisible(true);
      return;
    }
    setVideoFormVisible(true);
  };

  const handleCloseForm = () => {
    setImageFormVisible(false);
  };

  const handleCloseVideoForm = () => {
    setVideoFormVisible(false);
  };

  const resetImageForm = () => {
    setImageForm({
      category: '',
      style: '',
      images: [],
    });
  };

  const resetVideoForm = () => {
    setVideoForm({
      category: '',
      style: '',
      videos: [],
    });
  };

  const handleSaveForm = () => {
    if (!imageForm.category || !imageForm.style) {
      Alert.alert('Missing details', 'Please select both category and style.');
      return;
    }
    if (imageForm.images.length === 0) {
      Alert.alert('No images', 'Please upload at least one image.');
      return;
    }

    const timestamp = Date.now();
    const newSavedImages = imageForm.images.map((uri, index) => ({
      id: `${timestamp}-${index}`,
      uri,
      category: imageForm.category,
      style: imageForm.style,
    }));

    setSavedImages(prev => [...newSavedImages, ...prev]);
    Alert.alert('Saved', `${imageForm.images.length} image(s) added to Images section.`);
    resetImageForm();
    setImageFormVisible(false);
  };

  const handlePickVideos = async () => {
    const permission = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow gallery access to upload videos.');
      return;
    }

    const result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (result.canceled || !result.assets?.length) return;

    const newUris = result.assets.map((asset) => asset.uri).filter(Boolean);
    setVideoForm((prev) => ({ ...prev, videos: [...prev.videos, ...newUris] }));
  };

  const generateVideoThumbnail = async (videoUri: string): Promise<string | undefined> => {
    try {
      const result = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 1000 });
      return result?.uri;
    } catch {
      return undefined;
    }
  };

  const removeVideoAt = (index: number) => {
    setVideoForm((prev) => ({
      ...prev,
      videos: prev.videos.filter((_, idx) => idx !== index),
    }));
  };

  const handleSaveVideoForm = async () => {
    if (!videoForm.category || !videoForm.style) {
      Alert.alert('Missing details', 'Please select both category and style.');
      return;
    }
    if (videoForm.videos.length === 0) {
      Alert.alert('No videos', 'Please upload at least one video.');
      return;
    }

    const timestamp = Date.now();
    const thumbnailResults = await Promise.all(videoForm.videos.map((uri) => generateVideoThumbnail(uri)));

    const newSavedVideos = videoForm.videos.map((uri, index) => ({
      id: `${timestamp}-${index}`,
      uri,
      thumbnailUri: thumbnailResults[index],
      category: videoForm.category,
      style: videoForm.style,
    }));

    setSavedVideos((prev) => [...newSavedVideos, ...prev]);
    Alert.alert('Saved', `${videoForm.videos.length} video(s) added to Videos section.`);
    resetVideoForm();
    setVideoFormVisible(false);
  };

  const handleOpenPreview = (index: number, section: SectionId) => {
    setPreviewIndex(index);
    setPreviewSection(section);
    setPreviewVisible(true);
  };

  const handleClosePreview = () => {
    setPreviewVisible(false);
  };

  const getCurrentPreviewItems = () => (
    previewSection === 'images' ? displayedImages : displayedVideos
  );

  const goToPreviousPreviewItem = () => {
    setPreviewIndex((prev) => Math.max(0, prev - 1));
  };

  const goToNextPreviewItem = () => {
    const maxIndex = getCurrentPreviewItems().length - 1;
    setPreviewIndex((prev) => Math.min(maxIndex, prev + 1));
  };

  const resetImageFilters = () => {
    setImageFilterCategory('All');
    setImageSortBy('Newest');
  };

  const resetVideoFilters = () => {
    setVideoFilterCategory('All');
    setVideoSortBy('Newest');
  };

  const isImageSelectionMode = selectedImageIds.length > 0;
  const isVideoSelectionMode = selectedVideoIds.length > 0;

  const toggleImageSelection = (id: string) => {
    setSelectedImageIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  };

  const handleImagePress = (index: number, id: string) => {
    if (isImageSelectionMode) {
      toggleImageSelection(id);
      return;
    }
    handleOpenPreview(index, 'images');
  };

  const toggleVideoSelection = (id: string) => {
    setSelectedVideoIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  };

  const handleVideoPress = (index: number, id: string) => {
    if (isVideoSelectionMode) {
      toggleVideoSelection(id);
      return;
    }
    handleOpenPreview(index, 'videos');
  };

  const handleDeleteSelectedImages = () => {
    if (selectedImageIds.length === 0) return;
    Alert.alert(
      'Delete selected images',
      `Delete ${selectedImageIds.length} selected image(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSavedImages((prev) => prev.filter((item) => !selectedImageIds.includes(item.id)));
            setSelectedImageIds([]);
          },
        },
      ],
    );
  };

  const handleDeleteSelectedVideos = () => {
    if (selectedVideoIds.length === 0) return;
    Alert.alert(
      'Delete selected videos',
      `Delete ${selectedVideoIds.length} selected video(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSavedVideos((prev) => prev.filter((item) => !selectedVideoIds.includes(item.id)));
            setSelectedVideoIds([]);
          },
        },
      ],
    );
  };

  const normalizeLabel = (value: string) => value.trim();

  const addCategoryOption = () => {
    const value = normalizeLabel(newCategoryName);
    if (!value) {
      Alert.alert('Error', 'Category name cannot be empty');
      return;
    }
    if (categoryOptions.some(item => item.toLowerCase() === value.toLowerCase())) {
      Alert.alert('Error', 'Category already exists');
      return;
    }
    setCategoryOptions(prev => [...prev, value]);
    setNewCategoryName('');
  };

  const startEditCategoryOption = (value: string) => {
    setEditingCategory(value);
    setEditingCategoryName(value);
  };

  const saveEditedCategoryOption = () => {
    if (!editingCategory) return;
    const value = normalizeLabel(editingCategoryName);
    if (!value) {
      Alert.alert('Error', 'Category name cannot be empty');
      return;
    }
    if (
      categoryOptions.some(
        item => item.toLowerCase() === value.toLowerCase() && item.toLowerCase() !== editingCategory.toLowerCase(),
      )
    ) {
      Alert.alert('Error', 'Category already exists');
      return;
    }

    setCategoryOptions(prev => prev.map(item => (item === editingCategory ? value : item)));
    setSavedImages(prev => prev.map(item => (item.category === editingCategory ? { ...item, category: value } : item)));
    setSavedVideos(prev => prev.map(item => (item.category === editingCategory ? { ...item, category: value } : item)));
    setImageForm(prev => ({ ...prev, category: prev.category === editingCategory ? value : prev.category }));
    setVideoForm(prev => ({ ...prev, category: prev.category === editingCategory ? value : prev.category }));
    if (imageFilterCategory === editingCategory) {
      setImageFilterCategory(value);
    }
    if (videoFilterCategory === editingCategory) {
      setVideoFilterCategory(value);
    }

    setEditingCategory(null);
    setEditingCategoryName('');
  };

  const deleteCategoryOption = (value: string) => {
    Alert.alert(
      'Delete Category',
      `Delete "${value}"? Existing images using this category will be moved to Uncategorized.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setCategoryOptions(prev => prev.filter(item => item !== value));
            setSavedImages(prev => prev.map(item => (item.category === value ? { ...item, category: 'Uncategorized' } : item)));
            setSavedVideos(prev => prev.map(item => (item.category === value ? { ...item, category: 'Uncategorized' } : item)));
            setImageForm(prev => ({ ...prev, category: prev.category === value ? '' : prev.category }));
            setVideoForm(prev => ({ ...prev, category: prev.category === value ? '' : prev.category }));
            if (imageFilterCategory === value) {
              setImageFilterCategory('All');
            }
            if (videoFilterCategory === value) {
              setVideoFilterCategory('All');
            }
            if (editingCategory === value) {
              setEditingCategory(null);
              setEditingCategoryName('');
            }
          },
        },
      ],
    );
  };

  const addStyleOption = () => {
    const value = normalizeLabel(newStyleName);
    if (!value) {
      Alert.alert('Error', 'Style name cannot be empty');
      return;
    }
    if (styleOptions.some(item => item.toLowerCase() === value.toLowerCase())) {
      Alert.alert('Error', 'Style already exists');
      return;
    }
    setStyleOptions(prev => [...prev, value]);
    setNewStyleName('');
  };

  const startEditStyleOption = (value: string) => {
    setEditingStyle(value);
    setEditingStyleName(value);
  };

  const saveEditedStyleOption = () => {
    if (!editingStyle) return;
    const value = normalizeLabel(editingStyleName);
    if (!value) {
      Alert.alert('Error', 'Style name cannot be empty');
      return;
    }
    if (
      styleOptions.some(
        item => item.toLowerCase() === value.toLowerCase() && item.toLowerCase() !== editingStyle.toLowerCase(),
      )
    ) {
      Alert.alert('Error', 'Style already exists');
      return;
    }

    setStyleOptions(prev => prev.map(item => (item === editingStyle ? value : item)));
    setSavedImages(prev => prev.map(item => (item.style === editingStyle ? { ...item, style: value } : item)));
    setSavedVideos(prev => prev.map(item => (item.style === editingStyle ? { ...item, style: value } : item)));
    setImageForm(prev => ({ ...prev, style: prev.style === editingStyle ? value : prev.style }));
    setVideoForm(prev => ({ ...prev, style: prev.style === editingStyle ? value : prev.style }));

    setEditingStyle(null);
    setEditingStyleName('');
  };

  const deleteStyleOption = (value: string) => {
    Alert.alert(
      'Delete Style',
      `Delete "${value}"? Existing images using this style will be moved to Unstyled.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setStyleOptions(prev => prev.filter(item => item !== value));
            setSavedImages(prev => prev.map(item => (item.style === value ? { ...item, style: 'Unstyled' } : item)));
            setSavedVideos(prev => prev.map(item => (item.style === value ? { ...item, style: 'Unstyled' } : item)));
            setImageForm(prev => ({ ...prev, style: prev.style === value ? '' : prev.style }));
            setVideoForm(prev => ({ ...prev, style: prev.style === value ? '' : prev.style }));
            if (editingStyle === value) {
              setEditingStyle(null);
              setEditingStyleName('');
            }
          },
        },
      ],
    );
  };

  const moveCategoryOption = (option: string, direction: 'up' | 'down') => {
    setCategoryOptions((prev) => {
      const index = prev.indexOf(option);
      if (index === -1) return prev;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const moveStyleOption = (option: string, direction: 'up' | 'down') => {
    setStyleOptions((prev) => {
      const index = prev.indexOf(option);
      if (index === -1) return prev;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.replace('/')} style={styles.iconButton}>
              <Ionicons name="home-outline" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Photography</Text>
          </View>

          <TouchableOpacity
            style={[styles.headerUploadButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleUploadPress(activeSection)}
          >
            <Ionicons name="cloud-upload-outline" size={15} color={colors.primary} />
            <Text style={[styles.headerUploadButtonText, { color: colors.text }]}>Upload</Text>
          </TouchableOpacity>

          <View style={styles.headerSectionsRow}>
            {sections.map((section, index) => {
              const sectionId: SectionId = index === 0 ? 'images' : 'videos';
              const isActive = activeSection === sectionId;
              return (
              <TouchableOpacity
                key={section.label}
                onPress={() => setActiveSection(sectionId)}
                style={[
                  styles.headerSectionChip,
                  {
                    backgroundColor: isActive ? colors.primary + '20' : colors.surface,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
              >
                <Ionicons name={section.icon} size={16} color={isActive ? colors.primary : colors.textSecondary} />
                <Text style={[styles.headerSectionLabel, { color: colors.text }]}>{section.label}</Text>
              </TouchableOpacity>
            );})}
          </View>
        </View>
      </View>

      {activeSection === 'images' ? (
        <ScrollView
          style={styles.imagesScroll}
          contentContainerStyle={[styles.imagesContent, { paddingBottom: contentBottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.filterSortRow}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setImageFilterModalVisible(true)}
            >
              <Ionicons name="funnel-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.controlButtonText, { color: colors.text }]} numberOfLines={1}>{imageFilterCategory}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setImageSortModalVisible(true)}
            >
              <Ionicons name="swap-vertical-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.controlButtonText, { color: colors.text }]} numberOfLines={1}>{imageSortBy}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconControlButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={resetImageFilters}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            {isImageSelectionMode && (
              <TouchableOpacity
                style={[styles.iconControlButton, { backgroundColor: colors.surface, borderColor: colors.danger }]}
                onPress={handleDeleteSelectedImages}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>

          {isImageSelectionMode && (
            <Text style={[styles.selectionText, { color: colors.textSecondary }]}>
              {selectedImageIds.length} selected
            </Text>
          )}

          {savedImages.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No uploaded images yet.</Text>
          ) : displayedImages.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No images match this filter.</Text>
          ) : (
            <View style={[styles.galleryGrid, { gap: galleryGap }]}>
              {displayedImages.map((item, index) => (
                (() => {
                  const isSelected = selectedImageIds.includes(item.id);
                  return (
                <View
                  key={item.id}
                  style={[
                    styles.galleryCard,
                    {
                      width: thumbnailSize,
                      height: thumbnailSize,
                      backgroundColor: colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => handleImagePress(index, item.id)}
                    onLongPress={() => toggleImageSelection(item.id)}
                    delayLongPress={220}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: item.uri }} style={styles.galleryImage} resizeMode="cover" />
                    {isSelected && (
                      <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
                );
                })()
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.imagesScroll}
          contentContainerStyle={[styles.imagesContent, { paddingBottom: contentBottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.filterSortRow}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setVideoFilterModalVisible(true)}
            >
              <Ionicons name="funnel-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.controlButtonText, { color: colors.text }]} numberOfLines={1}>{videoFilterCategory}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setVideoSortModalVisible(true)}
            >
              <Ionicons name="swap-vertical-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.controlButtonText, { color: colors.text }]} numberOfLines={1}>{videoSortBy}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconControlButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={resetVideoFilters}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            {isVideoSelectionMode && (
              <TouchableOpacity
                style={[styles.iconControlButton, { backgroundColor: colors.surface, borderColor: colors.danger }]}
                onPress={handleDeleteSelectedVideos}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>

          {isVideoSelectionMode && (
            <Text style={[styles.selectionText, { color: colors.textSecondary }]}>
              {selectedVideoIds.length} selected
            </Text>
          )}

          {savedVideos.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No uploaded videos yet.</Text>
          ) : displayedVideos.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No videos match this filter.</Text>
          ) : (
            <View style={[styles.galleryGrid, { gap: galleryGap }]}>
              {displayedVideos.map((item, index) => {
                const isSelected = selectedVideoIds.includes(item.id);
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.galleryCard,
                      {
                        width: thumbnailSize,
                        height: thumbnailSize,
                        backgroundColor: colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => handleVideoPress(index, item.id)}
                      onLongPress={() => toggleVideoSelection(item.id)}
                      delayLongPress={220}
                      activeOpacity={0.85}
                      style={[styles.videoCard, { backgroundColor: colors.surface }]}
                    >
                      {item.thumbnailUri ? (
                        <Image source={{ uri: item.thumbnailUri }} style={styles.videoThumbnail} resizeMode="cover" />
                      ) : (
                        <>
                          <Ionicons name="videocam" size={22} color={colors.primary} />
                          <Text style={[styles.videoCardText, { color: colors.textSecondary }]} numberOfLines={1}>Video</Text>
                        </>
                      )}
                      {isSelected && (
                        <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={imageFormVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={handleCloseForm}>
              <Text style={[styles.modalActionText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Upload Images</Text>
            <TouchableOpacity onPress={handleSaveForm}>
              <Text style={[styles.modalActionText, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Select
              label="Category"
              options={categoryOptions}
              value={imageForm.category}
              onChange={(category) => setImageForm(prev => ({ ...prev, category }))}
              placeholder="Select category"
            />

            <TouchableOpacity
              style={[styles.manageButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setManageCategoryModalVisible(true)}
            >
              <Ionicons name="settings-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.manageButtonText, { color: colors.text }]}>Manage Categories</Text>
            </TouchableOpacity>

            <Select
              label="Style"
              options={styleOptions}
              value={imageForm.style}
              onChange={(style) => setImageForm(prev => ({ ...prev, style }))}
              placeholder="Select style"
            />

            <TouchableOpacity
              style={[styles.manageButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setManageStyleModalVisible(true)}
            >
              <Ionicons name="settings-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.manageButtonText, { color: colors.text }]}>Manage Styles</Text>
            </TouchableOpacity>

            <ImagePicker
              label="Upload Images"
              multiple={true}
              values={imageForm.images}
              maxSelection={20}
              onChange={() => {}}
              onChangeValues={(images) => setImageForm(prev => ({ ...prev, images }))}
            />

            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={videoFormVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={handleCloseVideoForm}>
              <Text style={[styles.modalActionText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Upload Videos</Text>
            <TouchableOpacity onPress={handleSaveVideoForm}>
              <Text style={[styles.modalActionText, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Select
              label="Category"
              options={categoryOptions}
              value={videoForm.category}
              onChange={(category) => setVideoForm(prev => ({ ...prev, category }))}
              placeholder="Select category"
            />

            <TouchableOpacity
              style={[styles.manageButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setManageCategoryModalVisible(true)}
            >
              <Ionicons name="settings-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.manageButtonText, { color: colors.text }]}>Manage Categories</Text>
            </TouchableOpacity>

            <Select
              label="Style"
              options={styleOptions}
              value={videoForm.style}
              onChange={(style) => setVideoForm(prev => ({ ...prev, style }))}
              placeholder="Select style"
            />

            <TouchableOpacity
              style={[styles.manageButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setManageStyleModalVisible(true)}
            >
              <Ionicons name="settings-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.manageButtonText, { color: colors.text }]}>Manage Styles</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.uploadButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handlePickVideos}
            >
              <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} />
              <Text style={[styles.uploadButtonText, { color: colors.text }]}>Select Videos</Text>
            </TouchableOpacity>

            {videoForm.videos.length > 0 && (
              <View style={styles.videoList}>
                {videoForm.videos.map((uri, index) => (
                  <View key={`${uri}-${index}`} style={[styles.videoListRow, { borderColor: colors.border }]}>
                    <View style={styles.videoListInfo}>
                      <Ionicons name="videocam-outline" size={16} color={colors.primary} />
                      <Text style={[styles.videoListText, { color: colors.text }]} numberOfLines={1}>
                        Video {index + 1}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeVideoAt(index)}>
                      <Ionicons name="close-circle" size={20} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={manageCategoryModalVisible} transparent animationType="fade">
        <View style={styles.optionOverlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Manage Categories</Text>

            <View style={[styles.manageInputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="New category"
                placeholderTextColor={colors.textSecondary}
                style={[styles.manageInput, { color: colors.text }]}
              />
              <TouchableOpacity style={[styles.manageActionButton, { backgroundColor: colors.primary }]} onPress={addCategoryOption}>
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.manageList}>
              {categoryOptions.map((option, index) => (
                <View key={option} style={[styles.manageRow, { borderBottomColor: colors.border }]}>
                  {editingCategory === option ? (
                    <TextInput
                      value={editingCategoryName}
                      onChangeText={setEditingCategoryName}
                      style={[styles.manageEditInput, { color: colors.text, borderColor: colors.border }]}
                    />
                  ) : (
                    <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                  )}

                  <View style={styles.manageActions}>
                    <TouchableOpacity
                      onPress={() => moveCategoryOption(option, 'up')}
                      style={styles.manageIconButton}
                      disabled={index === 0}
                    >
                      <Ionicons
                        name="chevron-up-outline"
                        size={17}
                        color={index === 0 ? colors.textSecondary + '66' : colors.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveCategoryOption(option, 'down')}
                      style={styles.manageIconButton}
                      disabled={index === categoryOptions.length - 1}
                    >
                      <Ionicons
                        name="chevron-down-outline"
                        size={17}
                        color={index === categoryOptions.length - 1 ? colors.textSecondary + '66' : colors.textSecondary}
                      />
                    </TouchableOpacity>
                    {editingCategory === option ? (
                      <TouchableOpacity onPress={saveEditedCategoryOption} style={styles.manageIconButton}>
                        <Ionicons name="checkmark" size={18} color={colors.success} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => startEditCategoryOption(option)} style={styles.manageIconButton}>
                        <Ionicons name="create-outline" size={17} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => deleteCategoryOption(option)} style={styles.manageIconButton}>
                      <Ionicons name="trash-outline" size={17} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                setManageCategoryModalVisible(false);
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

      <Modal visible={manageStyleModalVisible} transparent animationType="fade">
        <View style={styles.optionOverlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Manage Styles</Text>

            <View style={[styles.manageInputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                value={newStyleName}
                onChangeText={setNewStyleName}
                placeholder="New style"
                placeholderTextColor={colors.textSecondary}
                style={[styles.manageInput, { color: colors.text }]}
              />
              <TouchableOpacity style={[styles.manageActionButton, { backgroundColor: colors.primary }]} onPress={addStyleOption}>
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.manageList}>
              {styleOptions.map((option, index) => (
                <View key={option} style={[styles.manageRow, { borderBottomColor: colors.border }]}>
                  {editingStyle === option ? (
                    <TextInput
                      value={editingStyleName}
                      onChangeText={setEditingStyleName}
                      style={[styles.manageEditInput, { color: colors.text, borderColor: colors.border }]}
                    />
                  ) : (
                    <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                  )}

                  <View style={styles.manageActions}>
                    <TouchableOpacity
                      onPress={() => moveStyleOption(option, 'up')}
                      style={styles.manageIconButton}
                      disabled={index === 0}
                    >
                      <Ionicons
                        name="chevron-up-outline"
                        size={17}
                        color={index === 0 ? colors.textSecondary + '66' : colors.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveStyleOption(option, 'down')}
                      style={styles.manageIconButton}
                      disabled={index === styleOptions.length - 1}
                    >
                      <Ionicons
                        name="chevron-down-outline"
                        size={17}
                        color={index === styleOptions.length - 1 ? colors.textSecondary + '66' : colors.textSecondary}
                      />
                    </TouchableOpacity>
                    {editingStyle === option ? (
                      <TouchableOpacity onPress={saveEditedStyleOption} style={styles.manageIconButton}>
                        <Ionicons name="checkmark" size={18} color={colors.success} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => startEditStyleOption(option)} style={styles.manageIconButton}>
                        <Ionicons name="create-outline" size={17} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => deleteStyleOption(option)} style={styles.manageIconButton}>
                      <Ionicons name="trash-outline" size={17} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                setManageStyleModalVisible(false);
                setEditingStyle(null);
                setEditingStyleName('');
                setNewStyleName('');
              }}
              style={styles.optionClose}
            >
              <Text style={[styles.optionCloseText, { color: colors.textSecondary }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={imageFilterModalVisible} transparent animationType="fade">
        <View style={styles.optionOverlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Filter by Category</Text>
            {filterCategoryOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.optionRow}
                onPress={() => {
                  setImageFilterCategory(option);
                  setImageFilterModalVisible(false);
                }}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                {imageFilterCategory === option && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setImageFilterModalVisible(false)} style={styles.optionClose}>
              <Text style={[styles.optionCloseText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={imageSortModalVisible} transparent animationType="fade">
        <View style={styles.optionOverlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Sort Images</Text>
            {IMAGE_SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.optionRow}
                onPress={() => {
                  setImageSortBy(option);
                  setImageSortModalVisible(false);
                }}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                {imageSortBy === option && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setImageSortModalVisible(false)} style={styles.optionClose}>
              <Text style={[styles.optionCloseText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={videoFilterModalVisible} transparent animationType="fade">
        <View style={styles.optionOverlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Filter by Category</Text>
            {filterCategoryOptions.map((option) => (
              <TouchableOpacity
                key={`video-filter-${option}`}
                style={styles.optionRow}
                onPress={() => {
                  setVideoFilterCategory(option);
                  setVideoFilterModalVisible(false);
                }}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                {videoFilterCategory === option && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setVideoFilterModalVisible(false)} style={styles.optionClose}>
              <Text style={[styles.optionCloseText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={videoSortModalVisible} transparent animationType="fade">
        <View style={styles.optionOverlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Sort Videos</Text>
            {IMAGE_SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={`video-sort-${option}`}
                style={styles.optionRow}
                onPress={() => {
                  setVideoSortBy(option);
                  setVideoSortModalVisible(false);
                }}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                {videoSortBy === option && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setVideoSortModalVisible(false)} style={styles.optionClose}>
              <Text style={[styles.optionCloseText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={handleClosePreview}>
        <View style={styles.previewOverlay}>
          <View style={styles.previewContent}>
            <TouchableOpacity
              style={[styles.previewCloseButton, { backgroundColor: colors.background + 'CC' }]}
              onPress={handleClosePreview}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>

            {previewSection === 'images' && displayedImages.length > 0 && (
              <FlatList
                key={`preview-${previewSection}-${previewIndex}-${(previewSection === 'images' ? displayedImages : displayedVideos).length}`}
                data={previewSection === 'images' ? displayedImages : displayedVideos}
                horizontal
                pagingEnabled
                initialScrollIndex={previewIndex}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, index) => ({ length: viewportWidth, offset: viewportWidth * index, index })}
                onMomentumScrollEnd={(event) => {
                  const nextIndex = Math.round(event.nativeEvent.contentOffset.x / viewportWidth);
                  setPreviewIndex(nextIndex);
                }}
                renderItem={({ item, index }) => (
                  <View style={[styles.previewPage, { width: viewportWidth }]}>
                    {previewSection === 'images' ? (
                      <Image source={{ uri: item.uri }} style={styles.previewImage} resizeMode="contain" />
                    ) : (
                      <View style={[styles.previewVideoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        {item.thumbnailUri ? (
                          <Image source={{ uri: item.thumbnailUri }} style={styles.previewVideoThumbnail} resizeMode="cover" />
                        ) : null}
                        <Ionicons name="videocam" size={42} color={colors.primary} />
                        <Text style={[styles.previewVideoText, { color: colors.text }]}>Video / Reel</Text>
                        <PreviewVideoPlayer uri={item.uri} shouldPlay={index === previewIndex} />
                      </View>
                    )}
                  </View>
                )}
              />
            )}

            {previewSection === 'videos' && displayedVideos.length > 0 && (() => {
              const currentVideo = displayedVideos[previewIndex];
              if (!currentVideo) return null;

              return (
                <View style={[styles.previewPage, { width: viewportWidth }]}>
                  <View
                    style={[
                      styles.previewVideoCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        width: '100%',
                        maxWidth: 560,
                      },
                    ]}
                  >
                    <PreviewVideoPlayer uri={currentVideo.uri} shouldPlay />

                  {displayedVideos.length > 1 && (
                    <>
                      <TouchableOpacity
                        style={[styles.previewArrowButton, styles.previewArrowLeft, { backgroundColor: colors.background + 'CC' }]}
                        onPress={goToPreviousPreviewItem}
                        disabled={previewIndex === 0}
                      >
                        <Ionicons
                          name="chevron-back"
                          size={22}
                          color={previewIndex === 0 ? colors.textSecondary + '66' : colors.text}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.previewArrowButton, styles.previewArrowRight, { backgroundColor: colors.background + 'CC' }]}
                        onPress={goToNextPreviewItem}
                        disabled={previewIndex === displayedVideos.length - 1}
                      >
                        <Ionicons
                          name="chevron-forward"
                          size={22}
                          color={previewIndex === displayedVideos.length - 1 ? colors.textSecondary + '66' : colors.text}
                        />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
                </View>
              );
            })()}

            {(previewSection === 'images' ? displayedImages : displayedVideos).length > 0 && (
              <Text style={[styles.previewCounter, { color: colors.textSecondary }]}>
                {previewIndex + 1} / {(previewSection === 'images' ? displayedImages : displayedVideos).length}
              </Text>
            )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },
  headerUploadButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  headerUploadButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  headerSectionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  headerSectionChip: {
    minWidth: 88,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  headerSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  uploadButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uploadButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  manageButton: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  manageButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  imagesScroll: {
    flex: 1,
  },
  imagesContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  filterSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  controlButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconControlButton: {
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
    flex: 1,
  },
  emptyText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  selectionText: {
    fontSize: 12,
    marginBottom: 8,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  galleryCard: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  videoCard: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  videoCardText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  bottomPadding: {
    height: 40,
  },
  optionOverlay: {
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
  manageInputRow: {
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  manageInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
  },
  manageActionButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageList: {
    maxHeight: 240,
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  manageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manageIconButton: {
    padding: 4,
  },
  manageEditInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 8,
  },
  videoList: {
    marginTop: 8,
    gap: 8,
  },
  videoListRow: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 40,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  videoListInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  videoListText: {
    flex: 1,
    fontSize: 13,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  previewPage: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  previewImage: {
    width: '100%',
    height: '82%',
  },
  previewVideoCard: {
    width: '100%',
    maxWidth: 560,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewVideoThumbnail: {
    width: '100%',
    height: 220,
    borderRadius: 10,
  },
  previewVideoText: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewVideoPlayer: {
    width: '100%',
    height: 320,
    borderRadius: 10,
  },
  previewArrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewArrowLeft: {
    left: 18,
  },
  previewArrowRight: {
    right: 18,
  },
  previewCloseButton: {
    position: 'absolute',
    top: 56,
    right: 22,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCounter: {
    position: 'absolute',
    bottom: 42,
    fontSize: 13,
    fontWeight: '600',
  },
});

