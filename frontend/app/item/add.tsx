import React, { useEffect, useState } from 'react';
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
import { DropdownField } from '../../components/DropdownField';
import { ImageUpload } from '../../components/ImageUpload';
import { FileUpload, UploadFileValue } from '../../components/FileUpload';
import {
  AddContentCategory,
  categorySubcategoryOptions,
  isAddContentCategory,
  serializeAddContentMeta,
} from '../../data/add-content';
import { createItem } from '../../services/api';

export default function AddContentFormScreen() {
  const { category, subcategory: incomingSubcategory } = useLocalSearchParams<{
    category: string;
    subcategory?: string;
  }>();
  const router = useRouter();
  const [heading, setHeading] = useState('');
  const selectedCategory = (category ?? '').trim();
  const parsedCategory = isAddContentCategory(selectedCategory)
    ? (selectedCategory as AddContentCategory)
    : null;
  const fallbackSubcategories = parsedCategory ? categorySubcategoryOptions[parsedCategory] : ['General'];

  const initialSubcategory =
    parsedCategory && incomingSubcategory && categorySubcategoryOptions[parsedCategory].includes(incomingSubcategory)
      ? incomingSubcategory
      : incomingSubcategory && !parsedCategory
        ? incomingSubcategory
        : fallbackSubcategories[0] ?? '';
  const [subcategoryOptions, setSubcategoryOptions] = useState<string[]>(fallbackSubcategories);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(
    initialSubcategory ? [initialSubcategory] : []
  );
  const [description, setDescription] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [websiteLink, setWebsiteLink] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [uploadedFile, setUploadedFile] = useState<UploadFileValue | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedSubcategory = selectedSubcategories[0] ?? '';

  useEffect(() => {
    if (!selectedCategory) {
      router.replace('/item/select-category');
    }
  }, [selectedCategory, router]);

  useEffect(() => {
    const baseOptions = parsedCategory ? categorySubcategoryOptions[parsedCategory] : ['General'];
    setSubcategoryOptions(baseOptions);
    setSelectedSubcategories((current) => {
      const validCurrent = current.filter((item) => baseOptions.includes(item));
      if (validCurrent.length > 0) {
        return validCurrent;
      }
      return [baseOptions[0] ?? 'General'];
    });
  }, [parsedCategory]);

  useEffect(() => {
    if (!selectedCategory) {
      setSelectedSubcategories([]);
      return;
    }

    if (selectedSubcategories.length === 0 && subcategoryOptions.length > 0) {
      setSelectedSubcategories([subcategoryOptions[0]]);
    }
  }, [selectedCategory, selectedSubcategories.length, subcategoryOptions]);

  const isFormReady = Boolean(selectedCategory && heading.trim() && description.trim());

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

  const handleSave = async () => {
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category first.');
      router.replace('/item/select-category');
      return;
    }

    if (!heading.trim()) {
      Alert.alert('Error', 'Heading is required.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Description is required.');
      return;
    }

    const metadata = serializeAddContentMeta({
      subcategory: selectedSubcategory,
      subcategories: selectedSubcategories,
      externalLink: externalLink.trim() || undefined,
      imageUri: imageUri || undefined,
      fileName: uploadedFile?.name,
      fileUri: uploadedFile?.uri,
      fileMimeType: uploadedFile?.mimeType,
    });

    const payload = {
      category: selectedCategory,
      title: heading.trim(),
      description: description.trim(),
      notes: metadata,
      image: imageUri || null,
      url: websiteLink.trim() || null,
    };

    setSaving(true);
    try {
      await createItem(payload);

      const shouldOpenTutorials =
        selectedCategory === 'Learning' &&
        selectedSubcategories.some((item) => item.toLowerCase().includes('tutorial'));

      if (shouldOpenTutorials) {
        router.replace('/learning/tutorials');
        return;
      }

      router.replace({
        pathname: '/category/[name]',
        params: { name: selectedCategory },
      });
    } catch (error) {
      console.error('Error creating item:', error);
      const message = error instanceof Error ? error.message : 'Failed to save item. Check API URL and backend status.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Content</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveButton, !isFormReady && styles.saveButtonDisabled]}
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
          <Text style={styles.groupTitle}>New Content</Text>

          <View style={styles.section}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{selectedCategory || 'Select category'}</Text>
            </View>
          </View>

          <DropdownField
            label="Subcategory / Type"
            value={selectedSubcategory}
            options={subcategoryOptions}
            onChange={(nextSubcategory) => setSelectedSubcategories([nextSubcategory])}
            multiSelect
            selectedValues={selectedSubcategories}
            onChangeValues={setSelectedSubcategories}
            allowOptionManagement
            onOptionsChange={setSubcategoryOptions}
            placeholder="Select subcategory"
            disabled={!selectedCategory}
          />

          {selectedSubcategories.length > 0 ? (
            <View style={styles.selectedWrap}>
              {selectedSubcategories.map((item) => (
                <View key={item} style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>{item}</Text>
                  <TouchableOpacity
                    style={styles.selectedBadgeClose}
                    onPress={() => {
                      if (selectedSubcategories.length === 1) {
                        return;
                      }

                      setSelectedSubcategories((current) =>
                        current.filter((value) => value !== item)
                      );
                    }}
                    activeOpacity={0.86}
                  >
                    <Ionicons name="close" size={12} color="#D7E3FF" />
                  </TouchableOpacity>
                </View>
              ))}
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

          <Text style={styles.groupTitle}>Media</Text>
          <ImageUpload imageUri={imageUri} onChange={setImageUri} />

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

          <Text style={styles.groupTitle}>Files</Text>
          <FileUpload file={uploadedFile} onChange={setUploadedFile} />
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
  saveButtonDisabled: {
    opacity: 0.45,
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
    marginBottom: 18,
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
  selectedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -6,
    marginBottom: 12,
  },
  selectedBadge: {
    backgroundColor: '#1A2440',
    borderWidth: 1,
    borderColor: '#3A7AFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedBadgeText: {
    color: '#D7E3FF',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedBadgeClose: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#243764',
  },
  linkActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
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
