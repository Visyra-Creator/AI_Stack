import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InputField } from '../../components/InputField';
import { ImageUpload } from '../../components/ImageUpload';
import { FileUpload, UploadFileValue } from '../../components/FileUpload';
import {
  AddContentCategory,
  categorySubcategoryOptions,
  isAddContentCategory,
  parseAddContentMeta,
  serializeAddContentMeta,
} from '../../data/add-content';
import { getItemById, updateItem } from '../../services/api';

type LearningReturnRoute = '/learning' | '/learning/tutorials' | '/learning/guides' | '/learning/miscellaneous';

interface Item {
  id: string;
  category: string;
  title: string;
  description: string;
  notes?: string;
  image?: string;
  url?: string;
}

export default function EditItemScreen() {
  const { id, category, returnTo } = useLocalSearchParams<{
    id: string;
    category: string;
    returnTo?: string;
  }>();
  const router = useRouter();
  const normalizedReturnTo: LearningReturnRoute | undefined =
    returnTo === '/learning' || returnTo === '/learning/tutorials' || returnTo === '/learning/guides' || returnTo === '/learning/miscellaneous'
      ? returnTo
      : undefined;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(category ?? '');
  const [heading, setHeading] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [description, setDescription] = useState('');
  const [legacyNotes, setLegacyNotes] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [websiteLink, setWebsiteLink] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [uploadedFile, setUploadedFile] = useState<UploadFileValue | null>(null);

  const parsedCategory = isAddContentCategory(currentCategory)
    ? (currentCategory as AddContentCategory)
    : null;

  useEffect(() => {
    fetchItem();
  }, [id]);

  const fetchItem = async () => {
    try {
      const data: Item = await getItemById(id);

      const normalizedCategory = data.category || category || '';
      const configCategory = isAddContentCategory(normalizedCategory)
        ? (normalizedCategory as AddContentCategory)
        : null;
      const parsedMeta = parseAddContentMeta(data.notes);

      setCurrentCategory(normalizedCategory);
      setHeading(data.title);
      setDescription(data.description || '');
      setWebsiteLink(data.url || '');
      setImageUri(parsedMeta?.imageUri || data.image || '');
      setExternalLink(parsedMeta?.externalLink || '');
      setIsFavorite(Boolean(parsedMeta?.isFavorite));

      if (parsedMeta?.fileUri) {
        setUploadedFile({
          name: parsedMeta.fileName || 'Document',
          uri: parsedMeta.fileUri,
          mimeType: parsedMeta.fileMimeType,
        });
      }

      if (parsedMeta?.subcategory) {
        setSubcategory(parsedMeta.subcategory);
      } else if (configCategory) {
        setSubcategory(categorySubcategoryOptions[configCategory][0]);
      }

      if (!parsedMeta && data.notes) {
        setLegacyNotes(data.notes);
      }
    } catch (error) {
      console.error('Error fetching item:', error);
      Alert.alert('Error', 'Failed to load item');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const openLink = async (rawLink: string) => {
    const trimmedLink = rawLink.trim();
    if (!trimmedLink) {
      return;
    }

    const normalizedLink = /^https?:\/\//i.test(trimmedLink) ? trimmedLink : `https://${trimmedLink}`;

    try {
      const supported = await Linking.canOpenURL(normalizedLink);
      if (!supported) {
        Alert.alert('Invalid link', 'Unable to open this URL.');
        return;
      }

      await Linking.openURL(normalizedLink);
    } catch (error) {
      console.error('Open link error:', error);
      Alert.alert('Error', 'Failed to open the link.');
    }
  };

  const handleClose = () => {
    if (normalizedReturnTo) {
      router.replace(normalizedReturnTo);
      return;
    }

    router.back();
  };

  const handleSave = async () => {
    if (!heading.trim()) {
      Alert.alert('Error', 'Heading is required.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Description is required.');
      return;
    }

    const metadata = serializeAddContentMeta({
      subcategory,
      isFavorite,
      externalLink: externalLink.trim() || undefined,
      imageUri: imageUri || undefined,
      fileName: uploadedFile?.name,
      fileUri: uploadedFile?.uri,
      fileMimeType: uploadedFile?.mimeType,
    });

    const finalNotes = metadata ?? (legacyNotes.trim() || null);

    setSaving(true);
    try {
      await updateItem(id, {
        category: currentCategory,
        title: heading.trim(),
        description: description.trim(),
        notes: finalNotes,
        image: imageUri || null,
        url: websiteLink.trim() || null,
      });

      if (normalizedReturnTo) {
        router.replace(normalizedReturnTo);
        return;
      }

      router.back();
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Content</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={styles.saveButton}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#4ECDC4" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Form */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.groupTitle}>Basic Info</Text>

          <View style={styles.section}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{currentCategory}</Text>
            </View>
          </View>

          {parsedCategory ? (
            <View style={styles.section}>
              <Text style={styles.label}>Subcategory / Type</Text>
              <View style={styles.optionWrap}>
                {categorySubcategoryOptions[parsedCategory].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.optionChip, subcategory === option && styles.optionChipActive]}
                    onPress={() => setSubcategory(option)}
                  >
                    <Text style={[styles.optionText, subcategory === option && styles.optionTextActive]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          <InputField
            label="Heading"
            value={heading}
            onChangeText={setHeading}
            placeholder="Enter heading"
            required
          />

          <InputField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Summarize the content"
            required
            multiline
          />

          <View style={styles.section}>
            <Text style={styles.label}>Favorite</Text>
            <View style={styles.optionWrap}>
              <TouchableOpacity
                style={[styles.optionChip, !isFavorite && styles.optionChipActive]}
                onPress={() => setIsFavorite(false)}
              >
                <Text style={[styles.optionText, !isFavorite && styles.optionTextActive]}>Normal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionChip, isFavorite && styles.optionChipActive]}
                onPress={() => setIsFavorite(true)}
              >
                <Text style={[styles.optionText, isFavorite && styles.optionTextActive]}>Favorite</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.groupTitle}>Media</Text>
          <ImageUpload imageUri={imageUri} onChange={setImageUri} />
          <FileUpload file={uploadedFile} onChange={setUploadedFile} />

          <Text style={styles.groupTitle}>Links</Text>
          <InputField
            label="External Link"
            value={externalLink}
            onChangeText={setExternalLink}
            placeholder="YouTube / Instagram / app link"
            keyboardType="url"
          />

          <InputField
            label="Website Link"
            value={websiteLink}
            onChangeText={setWebsiteLink}
            placeholder="https://example.com"
            keyboardType="url"
          />

          <View style={styles.linkActionsRow}>
            <TouchableOpacity
              style={styles.linkActionButton}
              onPress={() => openLink(externalLink)}
              activeOpacity={0.86}
            >
              <Text style={styles.linkActionText}>Open External Link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkActionButton}
              onPress={() => openLink(websiteLink)}
              activeOpacity={0.86}
            >
              <Text style={styles.linkActionText}>Open Website Link</Text>
            </TouchableOpacity>
          </View>

          {!parsedCategory ? (
            <InputField
              label="Notes"
              value={legacyNotes}
              onChangeText={setLegacyNotes}
              placeholder="Additional notes"
              multiline
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
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
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  groupTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
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
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A3241',
    backgroundColor: '#151A22',
  },
  optionChipActive: {
    borderColor: '#3A7AFE',
    backgroundColor: '#1A2440',
  },
  optionText: {
    color: '#9BA5B8',
    fontSize: 12,
    fontWeight: '600',
  },
  optionTextActive: {
    color: '#D7E3FF',
  },
  linkActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  linkActionButton: {
    flex: 1,
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderColor: '#242B38',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkActionText: {
    color: '#D6DEED',
    fontSize: 12,
    fontWeight: '600',
  },
});
