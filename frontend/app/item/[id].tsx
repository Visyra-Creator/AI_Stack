import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseAddContentMeta } from '../../data/add-content';
import { deleteItem, getItemById, updateItem } from '../../services/api';

interface Item {
  id: string;
  category: string;
  title: string;
  description: string;
  notes?: string;
  image?: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
}

type LearningReturnRoute = '/learning' | '/learning/tutorials' | '/learning/guides' | '/learning/miscellaneous';
const inflightItemRequests = new Map<string, Promise<Item>>();

export default function ItemDetailScreen() {
  const { id, category, returnTo } = useLocalSearchParams<{
    id: string;
    category: string;
    returnTo?: string;
  }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingFavorite, setUpdatingFavorite] = useState(false);
  const lastRequestedIdRef = useRef<string | null>(null);

  const normalizedReturnTo: LearningReturnRoute | undefined =
    returnTo === '/learning' || returnTo === '/learning/tutorials' || returnTo === '/learning/guides' || returnTo === '/learning/miscellaneous'
      ? returnTo
      : undefined;

  const metadata = parseAddContentMeta(item?.notes);
  const isFavorite = Boolean(metadata?.isFavorite);

  useEffect(() => {
    if (!id) {
      return;
    }

    const itemId = String(id);
    if (lastRequestedIdRef.current === itemId) {
      return;
    }

    lastRequestedIdRef.current = itemId;
    fetchItem();
  }, [id]);

  const fetchItem = async () => {
    try {
      const itemId = String(id);
      let request = inflightItemRequests.get(itemId);

      if (!request) {
        request = getItemById(itemId) as Promise<Item>;
        inflightItemRequests.set(itemId, request);
      }

      const data = await request;
      setItem(data);
    } catch (error) {
      console.error('Error fetching item:', error);
      Alert.alert('Error', 'Failed to load item');
      router.back();
    } finally {
      inflightItemRequests.delete(String(id));
      setLoading(false);
    }
  };

  const handleEdit = () => {
    const nextReturnTo: LearningReturnRoute | undefined =
      normalizedReturnTo
        ? normalizedReturnTo
        : category === 'Learning'
          ? '/learning'
          : undefined;

    router.navigate({
      pathname: '/item/edit',
      params: { 
        id: item?.id,
        category: category,
        returnTo: nextReturnTo,
      }
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem(id);
              if (normalizedReturnTo) {
                router.back();
                return;
              }
              router.back();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    if (normalizedReturnTo) {
      router.back();
      return;
    }

    router.back();
  };

  const handleOpenLink = async (rawLink: string) => {
    const normalizedLink = /^https?:\/\//i.test(rawLink) ? rawLink : `https://${rawLink}`;

    try {
      const supported = await Linking.canOpenURL(normalizedLink);
      if (!supported) {
        Alert.alert('Invalid link', 'Unable to open this link.');
        return;
      }

      await Linking.openURL(normalizedLink);
    } catch (error) {
      console.error('Error opening link:', error);
      Alert.alert('Error', 'Failed to open link.');
    }
  };

  const handleOpenFile = () => {
    if (!metadata?.fileUri) {
      return;
    }

    router.navigate({
      pathname: '/item/file-viewer',
      params: {
        uri: encodeURIComponent(metadata.fileUri),
        name: encodeURIComponent(metadata.fileName ?? 'Document'),
        mimeType: encodeURIComponent(metadata.fileMimeType ?? ''),
      },
    });
  };

  const handleToggleFavorite = async () => {
    if (!item || updatingFavorite) {
      return;
    }

    const nextFavorite = !isFavorite;

    if (!metadata && item.notes) {
      Alert.alert('Unavailable', 'Favorite toggle is supported for structured content only.');
      return;
    }

    const nextMeta = metadata
      ? { ...metadata, isFavorite: nextFavorite }
      : { subcategory: 'General', isFavorite: nextFavorite };

    if (!nextFavorite) {
      delete (nextMeta as { isFavorite?: boolean }).isFavorite;
    }

    const nextNotes = JSON.stringify(nextMeta);

    setUpdatingFavorite(true);
    try {
      await updateItem(item.id, {
        category: item.category,
        title: item.title,
        description: item.description || '',
        notes: nextNotes,
        image: item.image || null,
        url: item.url || null,
      });

      setItem((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          notes: nextNotes,
          updatedAt: new Date().toISOString(),
        };
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status.');
    } finally {
      setUpdatingFavorite(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  if (!item) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleToggleFavorite} style={styles.headerButton} disabled={updatingFavorite}>
            {updatingFavorite ? (
              <ActivityIndicator size="small" color="#FEC84B" />
            ) : (
              <Ionicons
                name={isFavorite ? 'star' : 'star-outline'}
                size={22}
                color={isFavorite ? '#FEC84B' : '#FFFFFF'}
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleEdit} style={styles.headerButton}>
            <Ionicons name="create-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
            <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Title</Text>
          <Text style={styles.value}>{item.title}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Favorite</Text>
          <TouchableOpacity
            style={[styles.favoriteBadge, updatingFavorite && styles.favoriteBadgeDisabled]}
            onPress={handleToggleFavorite}
            activeOpacity={0.85}
            disabled={updatingFavorite}
          >
            {updatingFavorite ? (
              <ActivityIndicator size="small" color="#FEC84B" />
            ) : (
              <Ionicons name={isFavorite ? 'star' : 'star-outline'} size={14} color={isFavorite ? '#FEC84B' : '#9BA5B8'} />
            )}
            <Text style={styles.favoriteText}>{isFavorite ? 'Favorite' : 'Normal'}</Text>
          </TouchableOpacity>
        </View>

        {item.description ? (
          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.value}>{item.description}</Text>
          </View>
        ) : null}

        {metadata?.subcategory ? (
          <View style={styles.section}>
            <Text style={styles.label}>Subcategory / Type</Text>
            <Text style={styles.value}>{metadata.subcategory}</Text>
          </View>
        ) : null}

        {item.image || metadata?.imageUri ? (
          <View style={styles.section}>
            <Text style={styles.label}>Image</Text>
            <Image
              source={{ uri: item.image || metadata?.imageUri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {item.notes ? (
          <View style={styles.section}>
            <Text style={styles.label}>Notes</Text>
            <Text style={styles.value}>{metadata ? 'Structured add-content metadata saved.' : item.notes}</Text>
          </View>
        ) : null}

        {metadata?.externalLink ? (
          <View style={styles.section}>
            <Text style={styles.label}>External Link</Text>
            <TouchableOpacity onPress={() => handleOpenLink(metadata.externalLink ?? '')}>
              <Text style={[styles.value, styles.urlText]}>{metadata.externalLink}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {item.url ? (
          <View style={styles.section}>
            <Text style={styles.label}>Website Link</Text>
            <TouchableOpacity onPress={() => handleOpenLink(item.url ?? '')}>
              <Text style={[styles.value, styles.urlText]}>{item.url}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {metadata?.fileUri ? (
          <View style={styles.section}>
            <Text style={styles.label}>Attached File</Text>
            <TouchableOpacity style={styles.fileButton} onPress={handleOpenFile}>
              <Ionicons name="document-outline" size={18} color="#D6DEED" />
              <Text style={styles.fileButtonText}>{metadata.fileName ?? 'Open file'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.metaSection}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Created</Text>
            <Text style={styles.metaValue}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Updated</Text>
            <Text style={styles.metaValue}>
              {new Date(item.updatedAt).toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  categoryBadge: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  urlText: {
    color: '#4ECDC4',
  },
  previewImage: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    backgroundColor: '#151A22',
  },
  favoriteBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#2A3241',
    backgroundColor: '#151A22',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  favoriteBadgeDisabled: {
    opacity: 0.7,
  },
  favoriteText: {
    color: '#D6DEED',
    fontSize: 12,
    fontWeight: '700',
  },
  fileButton: {
    borderWidth: 1,
    borderColor: '#242B38',
    borderRadius: 10,
    backgroundColor: '#151A22',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  fileButtonText: {
    color: '#D6DEED',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 240,
  },
  metaSection: {
    marginTop: 16,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  metaItem: {
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    color: '#888888',
  },
});
