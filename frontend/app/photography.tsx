import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView, Image, useWindowDimensions, FlatList, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/src/context/ThemeContext';
import { Select } from '@/src/components/common/Select';
import { ImagePicker } from '@/src/components/common/ImagePicker';

type SectionId = 'images' | 'videos';

type SavedImage = {
  id: string;
  uri: string;
  category: string;
  style: string;
  subsection?: string;
};

type SavedVideo = {
  id: string;
  uri: string;
  thumbnailUri?: string;
  category: string;
  style: string;
  subsection?: string;
};

type SubsectionSection = SectionId;

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
const PHOTOGRAPHY_IMAGES_KEY = 'photography_saved_images';
const PHOTOGRAPHY_VIDEOS_KEY = 'photography_saved_videos';
const PHOTOGRAPHY_IMAGES_BACKUP_KEY = 'photography_saved_images_backup_v1';
const PHOTOGRAPHY_VIDEOS_BACKUP_KEY = 'photography_saved_videos_backup_v1';
const PHOTOGRAPHY_MEDIA_MIGRATION_KEY = 'photography_media_migration_v1_done';
const PHOTOGRAPHY_IMAGE_URI_MIGRATION_KEY = 'photography_image_uri_migration_v2_done';
const PHOTOGRAPHY_IMAGE_SUBSECTIONS_KEY = 'photography_image_subsections';
const PHOTOGRAPHY_VIDEO_SUBSECTIONS_KEY = 'photography_video_subsections';

const makeFallbackId = (prefix: 'img' | 'vid', index: number) => `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeTextField = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const normalizeSubsectionValue = (value?: string) => (value || '').trim().toLowerCase();

const parseLegacyUri = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as { uri?: string; url?: string };
      const uri = (parsed?.uri || parsed?.url || '').trim();
      return uri || undefined;
    } catch {
      return undefined;
    }
  }
  return trimmed;
};

const isSupportedImageUri = (uri?: string) => {
  const value = (uri || '').trim().toLowerCase();
  if (!value) return false;
  return (
    value.startsWith('file://') ||
    value.startsWith('content://') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:image/')
  );
};

const PHOTOGRAPHY_MEDIA_DIR_NAME = 'aikeeper-photography';

const getPhotographyMediaDir = () => {
  if (!FileSystem.documentDirectory) return undefined;
  return `${FileSystem.documentDirectory}${PHOTOGRAPHY_MEDIA_DIR_NAME}`;
};

const extensionFromUri = (uri: string, fallback: string) => {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return (match?.[1] || fallback).toLowerCase();
};

const persistImageUri = async (uri: string): Promise<string> => {
  const trimmed = uri.trim();
  if (!trimmed) return trimmed;

  const mediaDir = getPhotographyMediaDir();
  if (!mediaDir) return trimmed;
  if (trimmed.startsWith(mediaDir)) return trimmed;

  try {
    await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true });
  } catch {
    // Directory may already exist; continue.
  }

  try {
    if (trimmed.startsWith('data:image/')) {
      const dataMatch = trimmed.match(/^data:image\/(\w+);base64,(.*)$/);
      if (!dataMatch) return trimmed;
      const ext = (dataMatch[1] || 'jpg').toLowerCase();
      const base64Data = dataMatch[2] || '';
      const destination = `${mediaDir}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      await FileSystem.writeAsStringAsync(destination, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return destination;
    }

    if (trimmed.startsWith('content://') || trimmed.startsWith('file://')) {
      const ext = extensionFromUri(trimmed, 'jpg');
      const destination = `${mediaDir}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      await FileSystem.copyAsync({ from: trimmed, to: destination });
      return destination;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

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
      fullscreenOptions={{ enable: true }}
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
  const [hasHydratedImages, setHasHydratedImages] = useState(false);
  const [videoFormVisible, setVideoFormVisible] = useState(false);
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [hasHydratedVideos, setHasHydratedVideos] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_CATEGORY_OPTIONS);
  const [styleOptions, setStyleOptions] = useState<string[]>(DEFAULT_STYLE_OPTIONS);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewSection, setPreviewSection] = useState<SectionId>('images');
  const [previewImages, setPreviewImages] = useState<SavedImage[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [failedImageIds, setFailedImageIds] = useState<string[]>([]);
  const [failedVideoThumbnailIds, setFailedVideoThumbnailIds] = useState<string[]>([]);
  const [imageFilterCategory, setImageFilterCategory] = useState('All');
  const [imageSortBy, setImageSortBy] = useState('Newest');
  const [imageFilterSubsections, setImageFilterSubsections] = useState<string[]>([]);
  const [videoFilterCategory, setVideoFilterCategory] = useState('All');
  const [videoSortBy, setVideoSortBy] = useState('Newest');
  const [videoFilterSubsections, setVideoFilterSubsections] = useState<string[]>([]);
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
  const [imageSubsections, setImageSubsections] = useState<string[]>([]);
  const [videoSubsections, setVideoSubsections] = useState<string[]>([]);
  const [subsectionModalVisible, setSubsectionModalVisible] = useState(false);
  const [subsectionSection, setSubsectionSection] = useState<SubsectionSection>('images');
  const [newSubsectionName, setNewSubsectionName] = useState('');
  const [editingSubsection, setEditingSubsection] = useState<string | null>(null);
  const [editingSubsectionName, setEditingSubsectionName] = useState('');
  const [imageForm, setImageForm] = useState({
    category: '',
    style: '',
    subsection: '',
    images: [] as string[],
  });
  const [videoForm, setVideoForm] = useState({
    category: '',
    style: '',
    subsection: '',
    videos: [] as string[],
  });
  const [videoFormThumbnails, setVideoFormThumbnails] = useState<(string | undefined)[]>([]);
  const imagePreviewListRef = useRef<FlatList<SavedImage> | null>(null);
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
    const failedIdSet = new Set(failedImageIds);
    const validImages = savedImages.filter((item) => isSupportedImageUri(item.uri) && !failedIdSet.has(item.id));
    const filtered = validImages.filter((item) => {
      if (imageFilterCategory === 'All') return true;
      return item.category === imageFilterCategory;
    });

    const selectedSubsections = new Set(imageFilterSubsections.map((item) => normalizeSubsectionValue(item)));
    const subsectionFiltered = filtered.filter((item) => {
      if (selectedSubsections.size === 0) return true;
      return selectedSubsections.has(normalizeSubsectionValue(item.subsection));
    });

    const sorted = [...subsectionFiltered];
    if (imageSortBy === 'Oldest') {
      sorted.reverse();
    } else if (imageSortBy === 'Category') {
      sorted.sort((a, b) => a.category.localeCompare(b.category));
    } else if (imageSortBy === 'Style') {
      sorted.sort((a, b) => a.style.localeCompare(b.style));
    }

    return sorted;
  }, [savedImages, failedImageIds, imageFilterCategory, imageFilterSubsections, imageSortBy]);

  useEffect(() => {
    const existingImageIds = new Set(savedImages.map((item) => item.id));
    setFailedImageIds((prev) => prev.filter((id) => existingImageIds.has(id)));
  }, [savedImages]);

  const displayedVideos = useMemo(() => {
    const filtered = savedVideos.filter((item) => {
      if (videoFilterCategory === 'All') return true;
      return item.category === videoFilterCategory;
    });

    const selectedSubsections = new Set(videoFilterSubsections.map((item) => normalizeSubsectionValue(item)));
    const subsectionFiltered = filtered.filter((item) => {
      if (selectedSubsections.size === 0) return true;
      return selectedSubsections.has(normalizeSubsectionValue(item.subsection));
    });

    const sorted = [...subsectionFiltered];
    if (videoSortBy === 'Oldest') {
      sorted.reverse();
    } else if (videoSortBy === 'Category') {
      sorted.sort((a, b) => a.category.localeCompare(b.category));
    } else if (videoSortBy === 'Style') {
      sorted.sort((a, b) => a.style.localeCompare(b.style));
    }

    return sorted;
  }, [savedVideos, videoFilterCategory, videoFilterSubsections, videoSortBy]);

  useEffect(() => {
    const existingImageIds = new Set(savedImages.map((item) => item.id));
    setSelectedImageIds((prev) => prev.filter((id) => existingImageIds.has(id)));
  }, [savedImages]);

  useEffect(() => {
    const existingVideoIds = new Set(savedVideos.map((item) => item.id));
    setSelectedVideoIds((prev) => prev.filter((id) => existingVideoIds.has(id)));
    setFailedVideoThumbnailIds((prev) => prev.filter((id) => existingVideoIds.has(id)));
  }, [savedVideos]);

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
      subsection: '',
      images: [],
    });
  };

  const resetVideoForm = () => {
    setVideoForm({
      category: '',
      style: '',
      subsection: '',
      videos: [],
    });
    setVideoFormThumbnails([]);
  };

  useEffect(() => {
    const loadSavedImages = async () => {
      try {
        const [raw, migrationDone, imageUriMigrationDone] = await Promise.all([
          AsyncStorage.getItem(PHOTOGRAPHY_IMAGES_KEY),
          AsyncStorage.getItem(PHOTOGRAPHY_MEDIA_MIGRATION_KEY),
          AsyncStorage.getItem(PHOTOGRAPHY_IMAGE_URI_MIGRATION_KEY),
        ]);
        if (!raw) {
          setHasHydratedImages(true);
          return;
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          setHasHydratedImages(true);
          return;
        }

        let repaired = false;
        const normalizedWithMaybeLegacyUris = parsed
          .map((item, index) => {
            if (!item || typeof item !== 'object') return null;
            const uri = parseLegacyUri((item as any).uri);
            if (!uri) return null;

            const id = typeof (item as any).id === 'string' && (item as any).id.trim().length > 0
              ? (item as any).id.trim()
              : makeFallbackId('img', Math.floor(Math.random() * 10000));
            const category = normalizeTextField((item as any).category, 'Uncategorized');
            const style = normalizeTextField((item as any).style, 'Unstyled');
            const subsection = normalizeTextField((item as any).subsection, '');

            if (
              (item as any).id !== id ||
              (item as any).uri !== uri ||
              (item as any).category !== category ||
              (item as any).style !== style ||
              (item as any).subsection !== subsection
            ) {
              repaired = true;
            }

            return {
              id,
              uri,
              category,
              style,
              subsection,
            } as SavedImage;
          })
          .filter((item): item is SavedImage => !!item);

        let normalized = normalizedWithMaybeLegacyUris;
        if (!imageUriMigrationDone) {
          const migrated = await Promise.all(
            normalizedWithMaybeLegacyUris.map(async (item) => {
              const nextUri = await persistImageUri(item.uri);
              if (nextUri !== item.uri) repaired = true;
              return nextUri === item.uri ? item : { ...item, uri: nextUri };
            }),
          );
          normalized = migrated;
        }

        const validated: SavedImage[] = [];
        for (const item of normalized) {
          const normalizedUri = (item.uri || '').trim();
          if (!isSupportedImageUri(normalizedUri)) {
            repaired = true;
            continue;
          }

          if (normalizedUri.startsWith('file://')) {
            try {
              const info = await FileSystem.getInfoAsync(normalizedUri);
              if (!info.exists) {
                repaired = true;
                continue;
              }
            } catch {
              repaired = true;
              continue;
            }
          }

          validated.push({ ...item, uri: normalizedUri });
        }

        if (validated.length !== normalized.length) {
          repaired = true;
        }
        normalized = validated;

        const hadDrops = normalized.length !== parsed.length;
        if (hadDrops) repaired = true;

        if (!migrationDone && repaired) {
          await AsyncStorage.setItem(PHOTOGRAPHY_IMAGES_BACKUP_KEY, raw);
          await AsyncStorage.setItem(PHOTOGRAPHY_IMAGES_KEY, JSON.stringify(normalized));
        }

        if (!imageUriMigrationDone) {
          await AsyncStorage.setItem(PHOTOGRAPHY_IMAGE_URI_MIGRATION_KEY, '1');
          if (!migrationDone || repaired) {
            await AsyncStorage.setItem(PHOTOGRAPHY_IMAGES_KEY, JSON.stringify(normalized));
          }
        }

        setSavedImages(normalized);
      } catch (error) {
        console.error('Failed to load saved images:', error);
      } finally {
        setHasHydratedImages(true);
      }
    };

    loadSavedImages();
  }, []);

  useEffect(() => {
    if (!hasHydratedImages) return;
    AsyncStorage.setItem(PHOTOGRAPHY_IMAGES_KEY, JSON.stringify(savedImages)).catch((error) => {
      console.error('Failed to save images:', error);
    });
  }, [savedImages, hasHydratedImages]);

  useEffect(() => {
    const loadSavedVideos = async () => {
      try {
        const [raw, migrationDone] = await Promise.all([
          AsyncStorage.getItem(PHOTOGRAPHY_VIDEOS_KEY),
          AsyncStorage.getItem(PHOTOGRAPHY_MEDIA_MIGRATION_KEY),
        ]);
        if (!raw) {
          setHasHydratedVideos(true);
          return;
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          setHasHydratedVideos(true);
          return;
        }

        let repaired = false;
        const normalized = parsed
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const uri = parseLegacyUri((item as any).uri);
            if (!uri) return null;

            const id = typeof (item as any).id === 'string' && (item as any).id.trim().length > 0
              ? (item as any).id.trim()
              : makeFallbackId('vid', Math.floor(Math.random() * 10000));
            const thumbnailUri = parseLegacyUri((item as any).thumbnailUri);
            const category = normalizeTextField((item as any).category, 'Uncategorized');
            const style = normalizeTextField((item as any).style, 'Unstyled');
            const subsection = normalizeTextField((item as any).subsection, '');

            if (
              (item as any).id !== id ||
              (item as any).uri !== uri ||
              (item as any).thumbnailUri !== thumbnailUri ||
              (item as any).category !== category ||
              (item as any).style !== style ||
              (item as any).subsection !== subsection
            ) {
              repaired = true;
            }

            return {
              id,
              uri,
              thumbnailUri,
              category,
              style,
              subsection,
            } as SavedVideo;
          })
          .filter((item): item is SavedVideo => !!item);

        const hadDrops = normalized.length !== parsed.length;
        if (hadDrops) repaired = true;

        if (!migrationDone && repaired) {
          await AsyncStorage.setItem(PHOTOGRAPHY_VIDEOS_BACKUP_KEY, raw);
          await AsyncStorage.setItem(PHOTOGRAPHY_VIDEOS_KEY, JSON.stringify(normalized));
        }

        setSavedVideos(normalized);
      } catch (error) {
        console.error('Failed to load saved videos:', error);
      } finally {
        setHasHydratedVideos(true);
      }
    };

    loadSavedVideos();
  }, []);

  useEffect(() => {
    if (!hasHydratedImages || !hasHydratedVideos) return;
    AsyncStorage.setItem(PHOTOGRAPHY_MEDIA_MIGRATION_KEY, '1').catch((error) => {
      console.error('Failed to mark media migration:', error);
    });
  }, [hasHydratedImages, hasHydratedVideos]);

  useEffect(() => {
    if (!hasHydratedVideos) return;
    AsyncStorage.setItem(PHOTOGRAPHY_VIDEOS_KEY, JSON.stringify(savedVideos)).catch((error) => {
      console.error('Failed to save videos:', error);
    });
  }, [savedVideos, hasHydratedVideos]);

  useEffect(() => {
    const loadSubsections = async () => {
      try {
        const [rawImageSubsections, rawVideoSubsections] = await Promise.all([
          AsyncStorage.getItem(PHOTOGRAPHY_IMAGE_SUBSECTIONS_KEY),
          AsyncStorage.getItem(PHOTOGRAPHY_VIDEO_SUBSECTIONS_KEY),
        ]);

        const parsedImage = rawImageSubsections ? JSON.parse(rawImageSubsections) : [];
        const parsedVideo = rawVideoSubsections ? JSON.parse(rawVideoSubsections) : [];

        if (Array.isArray(parsedImage)) {
          setImageSubsections(parsedImage.filter((item) => typeof item === 'string'));
        }
        if (Array.isArray(parsedVideo)) {
          setVideoSubsections(parsedVideo.filter((item) => typeof item === 'string'));
        }
      } catch (error) {
        console.error('Failed to load photography subsections:', error);
      }
    };

    loadSubsections();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(PHOTOGRAPHY_IMAGE_SUBSECTIONS_KEY, JSON.stringify(imageSubsections)).catch((error) => {
      console.error('Failed to save image subsections:', error);
    });
  }, [imageSubsections]);

  useEffect(() => {
    AsyncStorage.setItem(PHOTOGRAPHY_VIDEO_SUBSECTIONS_KEY, JSON.stringify(videoSubsections)).catch((error) => {
      console.error('Failed to save video subsections:', error);
    });
  }, [videoSubsections]);

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
      subsection: imageForm.subsection.trim(),
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
    const newThumbs = await Promise.all(
      result.assets
        .filter((asset) => !!asset.uri)
        .map((asset) => {
          const durationMs = typeof asset.duration === 'number' && Number.isFinite(asset.duration)
            ? Math.max(0, asset.duration)
            : 0;
          const base = durationMs > 0 ? Math.floor(durationMs * 0.35) : 1400;
          const preferredTimes = [
            Math.max(400, base),
            Math.max(700, base + 500),
            Math.max(900, Math.floor(durationMs * 0.6) || 2000),
            200,
          ];
          return generateVideoThumbnail(asset.uri!, preferredTimes);
        }),
    );
    setVideoForm((prev) => ({ ...prev, videos: [...prev.videos, ...newUris] }));
    setVideoFormThumbnails((prev) => [...prev, ...newThumbs]);
  };

  const generateVideoThumbnail = async (videoUri: string, preferredTimes?: number[]): Promise<string | undefined> => {
    const candidateTimes = preferredTimes && preferredTimes.length > 0
      ? preferredTimes
      : [1400, 2400, 800, 200];

    for (const time of candidateTimes) {
      try {
        const result = await VideoThumbnails.getThumbnailAsync(videoUri, {
          time,
          quality: 0.9,
        });
        if (result?.uri) {
          return result.uri;
        }
      } catch {
        // Try next timestamp.
      }
    }

    return undefined;
  };

  const removeVideoAt = (index: number) => {
    setVideoForm((prev) => ({
      ...prev,
      videos: prev.videos.filter((_, idx) => idx !== index),
    }));
    setVideoFormThumbnails((prev) => prev.filter((_, idx) => idx !== index));
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
      subsection: videoForm.subsection.trim(),
    }));

    setSavedVideos((prev) => [...newSavedVideos, ...prev]);
    Alert.alert('Saved', `${videoForm.videos.length} video(s) added to Videos section.`);
    resetVideoForm();
    setVideoFormVisible(false);
  };

  const handleOpenPreview = (index: number, section: SectionId, items?: SavedImage[]) => {
    if (section === 'images') {
      setPreviewImages(items || displayedImages);
    }
    setPreviewIndex(index);
    setPreviewSection(section);
    setPreviewVisible(true);
  };

  const handleClosePreview = () => {
    setPreviewVisible(false);
    setPreviewImages([]);
  };

  const getCurrentPreviewItems = () => (
    previewSection === 'images' ? previewImages : displayedVideos
  );

  const goToPreviousPreviewItem = () => {
    const nextIndex = Math.max(0, previewIndex - 1);
    if (previewSection === 'images') {
      imagePreviewListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      return;
    }
    setPreviewIndex(nextIndex);
  };

  const goToNextPreviewItem = () => {
    const maxIndex = getCurrentPreviewItems().length - 1;
    const nextIndex = Math.min(maxIndex, previewIndex + 1);
    if (previewSection === 'images') {
      imagePreviewListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      return;
    }
    setPreviewIndex(nextIndex);
  };

  const resetImageFilters = () => {
    setImageFilterCategory('All');
    setImageSortBy('Newest');
    setImageFilterSubsections([]);
  };

  const resetVideoFilters = () => {
    setVideoFilterCategory('All');
    setVideoSortBy('Newest');
    setVideoFilterSubsections([]);
  };

  const displayedImageIdSet = useMemo(() => new Set(displayedImages.map((item) => item.id)), [displayedImages]);
  const displayedVideoIdSet = useMemo(() => new Set(displayedVideos.map((item) => item.id)), [displayedVideos]);
  const isImageSelectionMode = selectedImageIds.some((id) => displayedImageIdSet.has(id));
  const isVideoSelectionMode = selectedVideoIds.some((id) => displayedVideoIdSet.has(id));

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
    handleOpenPreview(index, 'images', displayedImages);
  };

  const handleImageLoadError = (item: SavedImage) => {
    setFailedImageIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));

    // If a local file is gone, prune it from storage to avoid repeated blank tiles.
    if (item.uri.startsWith('file://')) {
      setSavedImages((prev) => prev.filter((img) => img.id !== item.id));
      setSelectedImageIds((prev) => prev.filter((id) => id !== item.id));
    }
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
    const idsToDelete = [...selectedVideoIds];
    Alert.alert(
      'Delete selected videos',
      `Delete ${selectedVideoIds.length} selected video(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSavedVideos((prev) => prev.filter((item) => !idsToDelete.includes(item.id)));
            setSelectedVideoIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
          },
        },
      ],
    );
  };

  const handleDeleteSingleVideo = (videoId: string) => {
    Alert.alert('Delete video', 'Delete this video?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSavedVideos((prev) => prev.filter((item) => item.id !== videoId));
          setSelectedVideoIds((prev) => prev.filter((id) => id !== videoId));
          setFailedVideoThumbnailIds((prev) => prev.filter((id) => id !== videoId));
        },
      },
    ]);
  };

  const handleVideoThumbnailError = (videoId: string) => {
    setFailedVideoThumbnailIds((prev) => (prev.includes(videoId) ? prev : [...prev, videoId]));
  };

  const handleDeletePreviewVideo = () => {
    if (previewSection !== 'videos') return;
    const currentVideo = displayedVideos[previewIndex];
    if (!currentVideo) return;

    Alert.alert('Delete video', 'Delete this video?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSavedVideos((prev) => prev.filter((item) => item.id !== currentVideo.id));
          setSelectedVideoIds((prev) => prev.filter((id) => id !== currentVideo.id));
        },
      },
    ]);
  };

  useEffect(() => {
    if (!previewVisible || previewSection !== 'videos') return;
    if (displayedVideos.length === 0) {
      setPreviewVisible(false);
      setPreviewIndex(0);
      return;
    }
    if (previewIndex > displayedVideos.length - 1) {
      setPreviewIndex(displayedVideos.length - 1);
    }
  }, [previewVisible, previewSection, displayedVideos.length, previewIndex]);

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

  const moveSubsectionOption = (section: SubsectionSection, option: string, direction: 'up' | 'down') => {
    setSubsectionList(section, (prev) => {
      const index = prev.indexOf(option);
      if (index === -1) return prev;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const getSubsectionList = (section: SubsectionSection) => (section === 'images' ? imageSubsections : videoSubsections);
  const setSubsectionList = (section: SubsectionSection, next: string[] | ((prev: string[]) => string[])) => {
    if (section === 'images') {
      setImageSubsections(next as any);
      return;
    }
    setVideoSubsections(next as any);
  };

  const openSubsectionManager = (section: SubsectionSection) => {
    setSubsectionSection(section);
    setEditingSubsection(null);
    setEditingSubsectionName('');
    setNewSubsectionName('');
    setSubsectionModalVisible(true);
  };

  const addSubsectionOption = () => {
    const value = normalizeLabel(newSubsectionName);
    if (!value) {
      Alert.alert('Error', 'Subsection name cannot be empty');
      return;
    }

    const current = getSubsectionList(subsectionSection);
    if (current.some(item => item.toLowerCase() === value.toLowerCase())) {
      Alert.alert('Error', 'Subsection already exists');
      return;
    }

    setSubsectionList(subsectionSection, prev => [...prev, value]);
    setNewSubsectionName('');
  };

  const startEditSubsectionOption = (value: string) => {
    setEditingSubsection(value);
    setEditingSubsectionName(value);
  };

  const saveEditedSubsectionOption = () => {
    if (!editingSubsection) return;

    const value = normalizeLabel(editingSubsectionName);
    if (!value) {
      Alert.alert('Error', 'Subsection name cannot be empty');
      return;
    }

    const current = getSubsectionList(subsectionSection);
    if (current.some(item => item.toLowerCase() === value.toLowerCase() && item.toLowerCase() !== editingSubsection.toLowerCase())) {
      Alert.alert('Error', 'Subsection already exists');
      return;
    }

    setSubsectionList(subsectionSection, prev => prev.map(item => (item === editingSubsection ? value : item)));
    if (subsectionSection === 'images') {
      setSavedImages(prev => prev.map(item => (item.subsection === editingSubsection ? { ...item, subsection: value } : item)));
      setImageForm(prev => ({ ...prev, subsection: prev.subsection === editingSubsection ? value : prev.subsection }));
      setImageFilterSubsections(prev => prev.map(item => (item === editingSubsection ? value : item)));
    } else {
      setSavedVideos(prev => prev.map(item => (item.subsection === editingSubsection ? { ...item, subsection: value } : item)));
      setVideoForm(prev => ({ ...prev, subsection: prev.subsection === editingSubsection ? value : prev.subsection }));
      setVideoFilterSubsections(prev => prev.map(item => (item === editingSubsection ? value : item)));
    }
    setEditingSubsection(null);
    setEditingSubsectionName('');
  };

  const deleteSubsectionOption = (value: string) => {
    Alert.alert(
      'Delete Subsection',
      `Delete "${value}" from ${subsectionSection === 'images' ? 'Images' : 'Videos'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSubsectionList(subsectionSection, prev => prev.filter(item => item !== value));
            if (subsectionSection === 'images') {
              setSavedImages(prev => prev.map(item => (item.subsection === value ? { ...item, subsection: '' } : item)));
              setImageForm(prev => ({ ...prev, subsection: prev.subsection === value ? '' : prev.subsection }));
              setImageFilterSubsections(prev => prev.filter(item => item !== value));
            } else {
              setSavedVideos(prev => prev.map(item => (item.subsection === value ? { ...item, subsection: '' } : item)));
              setVideoForm(prev => ({ ...prev, subsection: prev.subsection === value ? '' : prev.subsection }));
              setVideoFilterSubsections(prev => prev.filter(item => item !== value));
            }
            if (editingSubsection === value) {
              setEditingSubsection(null);
              setEditingSubsectionName('');
            }
          },
        },
      ],
    );
  };

  const renderSubsectionManager = (section: SubsectionSection) => {
    const list = getSubsectionList(section);

    return (
      <View style={styles.subsectionBlock}>
        <View style={styles.subsectionHeaderRow}>
          <Text style={[styles.subsectionLabel, { color: colors.text }]}>Subsections</Text>
          <TouchableOpacity
            style={[styles.subsectionManageButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => openSubsectionManager(section)}
          >
            <Ionicons name="create-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.subsectionManageButtonText, { color: colors.textSecondary }]}>Manage</Text>
          </TouchableOpacity>
        </View>

        {list.length > 0 ? (
          <View style={styles.subsectionChipRow}>
            {list.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => {
                  if (section === 'images') {
                    setImageFilterSubsections((prev) =>
                      prev.includes(item) ? prev.filter((selected) => selected !== item) : [...prev, item],
                    );
                    return;
                  }
                  setVideoFilterSubsections((prev) =>
                    prev.includes(item) ? prev.filter((selected) => selected !== item) : [...prev, item],
                  );
                }}
                style={[
                  styles.subsectionChip,
                  {
                    backgroundColor:
                      (section === 'images' ? imageFilterSubsections : videoFilterSubsections).includes(item)
                        ? colors.primary + '20'
                        : colors.surface,
                    borderColor:
                      (section === 'images' ? imageFilterSubsections : videoFilterSubsections).includes(item)
                        ? colors.primary
                        : colors.border,
                  },
                ]}
              >
                <Text style={[styles.subsectionChipText, { color: colors.text }]} numberOfLines={1}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={[styles.subsectionEmptyText, { color: colors.textSecondary }]}>No subsections yet. Tap Manage to add one.</Text>
        )}
      </View>
    );
  };

  const activePreviewItem =
    previewSection === 'images' ? previewImages[previewIndex] : displayedVideos[previewIndex];

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

          {renderSubsectionManager('images')}

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
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.galleryImage}
                      resizeMode="cover"
                      onError={() => handleImageLoadError(item)}
                    />
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

          {renderSubsectionManager('videos')}

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
                      {!isVideoSelectionMode && (
                        <TouchableOpacity
                          style={[styles.videoDeleteButton, { backgroundColor: colors.background + 'CC' }]}
                          onPress={(event) => {
                            event.stopPropagation();
                            handleDeleteSingleVideo(item.id);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={14} color={colors.danger} />
                        </TouchableOpacity>
                      )}
                      {item.thumbnailUri && !failedVideoThumbnailIds.includes(item.id) ? (
                        <Image
                          source={{ uri: item.thumbnailUri }}
                          style={styles.videoThumbnail}
                          resizeMode="cover"
                          onError={() => handleVideoThumbnailError(item.id)}
                        />
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

            <Select
              label="Subsection"
              options={imageSubsections}
              value={imageForm.subsection}
              onChange={(subsection) => setImageForm(prev => ({ ...prev, subsection }))}
              placeholder={imageSubsections.length > 0 ? 'Select subsection' : 'No subsections yet'}
            />

            <TouchableOpacity
              style={[styles.manageButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => openSubsectionManager('images')}
            >
              <Ionicons name="albums-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.manageButtonText, { color: colors.text }]}>Manage Subsections</Text>
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

            <Select
              label="Subsection"
              options={videoSubsections}
              value={videoForm.subsection}
              onChange={(subsection) => setVideoForm(prev => ({ ...prev, subsection }))}
              placeholder={videoSubsections.length > 0 ? 'Select subsection' : 'No subsections yet'}
            />

            <TouchableOpacity
              style={[styles.manageButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => openSubsectionManager('videos')}
            >
              <Ionicons name="albums-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.manageButtonText, { color: colors.text }]}>Manage Subsections</Text>
            </TouchableOpacity>

            {videoForm.videos.length > 0 ? (
              <View style={styles.videoMultiGrid}>
                {videoForm.videos.map((uri, index) => (
                  <View key={`${uri}-${index}`} style={styles.videoTileContainer}>
                    <View style={[styles.videoTile, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                      {videoFormThumbnails[index] ? (
                        <Image source={{ uri: videoFormThumbnails[index] }} style={styles.videoTileThumb} resizeMode="cover" />
                      ) : (
                        <Ionicons name="videocam" size={22} color={colors.primary} />
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.videoTileRemoveButton, { backgroundColor: colors.danger }]}
                      onPress={() => removeVideoAt(index)}
                    >
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.videoAddMoreTile, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={handlePickVideos}
                >
                  <Ionicons name="add" size={24} color={colors.textSecondary} />
                  <Text style={[styles.videoAddMoreText, { color: colors.textSecondary }]}>Add</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.videoPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handlePickVideos}
              >
                <Ionicons name="videocam-outline" size={32} color={colors.textSecondary} />
                <Text style={[styles.videoPickerText, { color: colors.textSecondary }]}>Tap to select videos</Text>
              </TouchableOpacity>
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

      <Modal visible={subsectionModalVisible} transparent animationType="fade">
        <View style={styles.optionOverlay}>
          <View style={[styles.optionSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>Manage {subsectionSection === 'images' ? 'Image' : 'Video'} Subsections</Text>

            <View style={[styles.manageInputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                value={newSubsectionName}
                onChangeText={setNewSubsectionName}
                placeholder="New subsection"
                placeholderTextColor={colors.textSecondary}
                style={[styles.manageInput, { color: colors.text }]}
              />
              <TouchableOpacity style={[styles.manageActionButton, { backgroundColor: colors.primary }]} onPress={addSubsectionOption}>
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.manageList}>
              {getSubsectionList(subsectionSection).map((option, index, list) => (
                <View key={option} style={[styles.manageRow, { borderBottomColor: colors.border }]}>
                  {editingSubsection === option ? (
                    <TextInput
                      value={editingSubsectionName}
                      onChangeText={setEditingSubsectionName}
                      style={[styles.manageEditInput, { color: colors.text, borderColor: colors.border }]}
                    />
                  ) : (
                    <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                  )}

                  <View style={styles.manageActions}>
                    <TouchableOpacity
                      onPress={() => moveSubsectionOption(subsectionSection, option, 'up')}
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
                      onPress={() => moveSubsectionOption(subsectionSection, option, 'down')}
                      style={styles.manageIconButton}
                      disabled={index === list.length - 1}
                    >
                      <Ionicons
                        name="chevron-down-outline"
                        size={17}
                        color={index === list.length - 1 ? colors.textSecondary + '66' : colors.textSecondary}
                      />
                    </TouchableOpacity>
                    {editingSubsection === option ? (
                      <TouchableOpacity onPress={saveEditedSubsectionOption} style={styles.manageIconButton}>
                        <Ionicons name="checkmark" size={18} color={colors.success} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => startEditSubsectionOption(option)} style={styles.manageIconButton}>
                        <Ionicons name="create-outline" size={17} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => deleteSubsectionOption(option)} style={styles.manageIconButton}>
                      <Ionicons name="trash-outline" size={17} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                setSubsectionModalVisible(false);
                setEditingSubsection(null);
                setEditingSubsectionName('');
                setNewSubsectionName('');
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

            {previewSection === 'videos' && displayedVideos.length > 0 && (
              <TouchableOpacity
                style={[styles.previewDeleteButton, { backgroundColor: colors.background + 'CC' }]}
                onPress={handleDeletePreviewVideo}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
            )}

            {previewSection === 'images' && previewImages.length > 0 && (
              <FlatList
                ref={imagePreviewListRef}
                key={`preview-images-${previewImages.length}-${previewIndex}`}
                data={previewImages}
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
                        {item.thumbnailUri && !failedVideoThumbnailIds.includes(item.id) ? (
                          <Image
                            source={{ uri: item.thumbnailUri }}
                            style={styles.previewVideoThumbnail}
                            resizeMode="cover"
                            onError={() => handleVideoThumbnailError(item.id)}
                          />
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

            {previewSection === 'images' && previewImages.length > 1 && (
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
                  disabled={previewIndex === displayedImages.length - 1}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color={previewIndex === displayedImages.length - 1 ? colors.textSecondary + '66' : colors.text}
                  />
                </TouchableOpacity>
              </>
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

            {activePreviewItem && (
              <View style={styles.previewMetaContainer}>
                <View style={styles.previewMetaPill}>
                  <Text style={styles.previewMetaText}>{activePreviewItem.category || 'Uncategorized'}</Text>
                </View>
                <View style={styles.previewMetaPill}>
                  <Text style={styles.previewMetaText}>{activePreviewItem.style || 'Unstyled'}</Text>
                </View>
                {!!activePreviewItem.subsection?.trim() && (
                  <View style={styles.previewMetaPill}>
                    <Text style={styles.previewMetaText}>{activePreviewItem.subsection.trim()}</Text>
                  </View>
                )}
              </View>
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
  videoDeleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 3,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  subsectionBlock: {
    marginBottom: 12,
  },
  subsectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },
  subsectionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  subsectionManageButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subsectionManageButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subsectionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subsectionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  subsectionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subsectionEmptyText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 2,
  },
  videoList: {
    marginTop: 8,
    gap: 8,
  },
  videoPicker: {
    marginTop: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPickerText: {
    marginTop: 8,
    fontSize: 14,
  },
  videoMultiGrid: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  videoTileContainer: {
    width: 92,
    height: 92,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  videoTile: {
    width: '100%',
    height: '100%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTileThumb: {
    width: '100%',
    height: '100%',
  },
  videoTileRemoveButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoAddMoreTile: {
    width: 92,
    height: 92,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoAddMoreText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
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
    paddingHorizontal: 0,
  },
  previewImage: {
    width: '100%',
    height: '100%',
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
  previewDeleteButton: {
    position: 'absolute',
    top: 56,
    right: 64,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCounter: {
    position: 'absolute',
    bottom: 88,
    fontSize: 13,
    fontWeight: '600',
  },
  previewMetaContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 36,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  previewMetaPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  previewMetaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

