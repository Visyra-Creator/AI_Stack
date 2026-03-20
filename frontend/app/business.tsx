import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/common/Card';
import { FormInput } from '@/src/components/common/FormInput';
import { Select } from '@/src/components/common/Select';
import { EmptyState } from '@/src/components/common/EmptyState';
import { businessStorage, BusinessItem } from '@/src/services/storage';

export default function BusinessScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [items, setItems] = useState<BusinessItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<BusinessItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sections, setSections] = useState<string[]>(['General']);
  const [activeSection, setActiveSection] = useState('All');
  const [newSection, setNewSection] = useState('');
  const [sectionModalVisible, setSectionModalVisible] = useState(false);

  const [formData, setFormData] = useState({
    sectionName: 'General',
    name: '',
    description: '',
    link: '',
    instructions: '',
  });

  const loadItems = useCallback(async () => {
    const data = await businessStorage.getAll();
    setItems(data);
    // Extract unique sections
    const uniqueSections = [...new Set(data.map(item => item.sectionName))];
    if (uniqueSections.length > 0) {
      setSections(prev => [...new Set([...prev, ...uniqueSections])]);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  const resetForm = () => {
    setFormData({
      sectionName: sections[0] || 'General',
      name: '',
      description: '',
      link: '',
      instructions: '',
    });
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (item: BusinessItem) => {
    setEditingItem(item);
    setFormData({
      sectionName: item.sectionName,
      name: item.name,
      description: item.description,
      link: item.link,
      instructions: item.instructions,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    if (editingItem) {
      await businessStorage.update(editingItem.id, formData);
    } else {
      await businessStorage.add(formData);
    }

    await loadItems();
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (item: BusinessItem) => {
    Alert.alert('Delete', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await businessStorage.delete(item.id);
          await loadItems();
        },
      },
    ]);
  };

  const addSection = () => {
    if (newSection.trim() && !sections.includes(newSection.trim())) {
      setSections([...sections, newSection.trim()]);
      setNewSection('');
      setSectionModalVisible(false);
    }
  };

  const filteredItems = activeSection === 'All'
    ? items
    : items.filter(item => item.sectionName === activeSection);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Business</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setSectionModalVisible(true)} style={styles.sectionButton}>
            <Ionicons name="folder-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeSection === 'All' && { backgroundColor: colors.primary },
            { borderColor: colors.border },
          ]}
          onPress={() => setActiveSection('All')}
        >
          <Text style={[styles.tabText, { color: activeSection === 'All' ? '#FFFFFF' : colors.text }]}>
            All
          </Text>
        </TouchableOpacity>
        {sections.map(section => (
          <TouchableOpacity
            key={section}
            style={[
              styles.tab,
              activeSection === section && { backgroundColor: colors.primary },
              { borderColor: colors.border },
            ]}
            onPress={() => setActiveSection(section)}
          >
            <Text style={[styles.tabText, { color: activeSection === section ? '#FFFFFF' : colors.text }]}>
              {section}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filteredItems.length === 0 ? (
        <EmptyState
          icon="briefcase-outline"
          title="No Business Items"
          description="Add business tools, resources, and notes."
          actionLabel="Add Item"
          onAction={openAddModal}
        />
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredItems.map(item => (
            <Card
              key={item.id}
              title={item.name}
              subtitle={item.description}
              tags={[item.sectionName]}
              onEdit={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
            >
              {item.link && (
                <Text style={[styles.link, { color: colors.primary }]} numberOfLines={1}>
                  {item.link}
                </Text>
              )}
            </Card>
          ))}
        </ScrollView>
      )}

      {/* Add/Edit Item Modal */}
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
              {editingItem ? 'Edit Item' : 'Add Item'}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <Select
              label="Section"
              options={sections}
              value={formData.sectionName}
              onChange={(sectionName) => setFormData({ ...formData, sectionName })}
            />
            <FormInput
              label="Name *"
              placeholder="e.g., CRM Tool"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
            <FormInput
              label="Description"
              placeholder="What is this for?"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
            <FormInput
              label="Link"
              placeholder="https://..."
              value={formData.link}
              onChangeText={(text) => setFormData({ ...formData, link: text })}
              keyboardType="url"
              autoCapitalize="none"
            />
            <FormInput
              label="Instructions"
              placeholder="Notes, how to use..."
              value={formData.instructions}
              onChangeText={(text) => setFormData({ ...formData, instructions: text })}
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />
            <View style={styles.bottomPadding} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Section Modal */}
      <Modal visible={sectionModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.sectionModalOverlay}
          activeOpacity={1}
          onPress={() => setSectionModalVisible(false)}
        >
          <View style={[styles.sectionModalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionModalTitle, { color: colors.text }]}>Add New Section</Text>
            <FormInput
              label="Section Name"
              placeholder="e.g., Marketing, Finance"
              value={newSection}
              onChangeText={setNewSection}
            />
            <TouchableOpacity
              style={[styles.addSectionButton, { backgroundColor: colors.primary }]}
              onPress={addSection}
            >
              <Text style={styles.addSectionButtonText}>Add Section</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionButton: {
    padding: 8,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    maxHeight: 44,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  link: {
    fontSize: 12,
    marginTop: 8,
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
  bottomPadding: {
    height: 40,
  },
  sectionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  sectionModalContent: {
    borderRadius: 16,
    padding: 20,
  },
  sectionModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  addSectionButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  addSectionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
