import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '@/src/context/ThemeContext';
import {
  exportAppBackup,
  importAppBackup,
  resetAllAppData,
  resetLocalAppData,
} from '@/src/services/storage';

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, mode, toggleTheme } = useTheme();
  const [resetting, setResetting] = useState(false);
  const [resettingLocal, setResettingLocal] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);

  const handleResetAppData = () => {
    if (resetting) return;

    Alert.alert(
      'Reset app data?',
      'This will permanently delete all local data and PocketBase data for this app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setResetting(true);
              await resetAllAppData();
              Alert.alert('Reset complete', 'All app data has been deleted.');
            } catch (error) {
              console.error('Failed to reset app data:', error);
              Alert.alert('Reset failed', 'Could not delete all app data. Please try again.');
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  };

  const handleResetLocalData = () => {
    if (resettingLocal) return;

    Alert.alert(
      'Reset local data?',
      'This will delete only local app data on this device. PocketBase data remains unchanged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset local',
          style: 'destructive',
          onPress: async () => {
            try {
              setResettingLocal(true);
              await resetLocalAppData();
              Alert.alert('Reset complete', 'Local app data has been deleted.');
            } catch (error) {
              console.error('Failed to reset local data:', error);
              Alert.alert('Reset failed', 'Could not delete local app data.');
            } finally {
              setResettingLocal(false);
            }
          },
        },
      ]
    );
  };

  const handleExportBackup = async () => {
    if (exportingBackup) return;

    try {
      setExportingBackup(true);
      const backupJson = await exportAppBackup();
      const backupUri = `${FileSystem.cacheDirectory}aikeeper-backup-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(backupUri, backupJson, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Share.share({
        title: 'AIKeeper Backup',
        message: 'AIKeeper backup file',
        url: backupUri,
      });
    } catch (error) {
      console.error('Failed to export backup:', error);
      Alert.alert('Export failed', 'Could not export backup. Please try again.');
    } finally {
      setExportingBackup(false);
    }
  };

  const handleImportBackup = async () => {
    if (importingBackup) return;

    try {
      setImportingBackup(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileUri = result.assets[0].uri;
      const backupJson = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const parsed = JSON.parse(backupJson);
      const version = parsed?.version ?? 'Unknown';
      const exportedAt = parsed?.exportedAt
        ? new Date(parsed.exportedAt).toLocaleString()
        : 'Unknown';

      Alert.alert(
        'Import backup?',
        `Version: ${version}\nExported: ${exportedAt}\n\nThis will replace current app data with backup contents (local + PocketBase sync).`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            style: 'destructive',
            onPress: async () => {
              try {
                await importAppBackup(backupJson);
                Alert.alert('Import complete', 'Backup has been restored successfully.');
              } catch (error) {
                console.error('Failed to import backup:', error);
                Alert.alert('Import failed', 'Invalid or unreadable backup file.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to import backup:', error);
      Alert.alert('Import failed', 'Invalid or unreadable backup file.');
    } finally {
      setImportingBackup(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={[styles.settingRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={toggleTheme}
          activeOpacity={0.8}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
              <Ionicons
                name={mode === 'dark' ? 'moon-outline' : 'sunny-outline'}
                size={18}
                color={colors.text}
              />
            </View>
            <View>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Theme</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                Currently {mode === 'dark' ? 'Dark' : 'Light'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleExportBackup}
          activeOpacity={0.8}
          disabled={exportingBackup}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
              <Ionicons name="download-outline" size={18} color={colors.text} />
            </View>
            <View>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Export Backup</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {exportingBackup ? 'Preparing backup...' : 'Save and share backup JSON file'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleImportBackup}
          activeOpacity={0.8}
          disabled={importingBackup}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
              <Ionicons name="cloud-upload-outline" size={18} color={colors.text} />
            </View>
            <View>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Import Backup</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {importingBackup ? 'Importing...' : 'Restore data from backup JSON file'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingRow, styles.warningRow, { backgroundColor: colors.card, borderColor: '#F59E0B' }]}
          onPress={handleResetLocalData}
          activeOpacity={0.8}
          disabled={resettingLocal}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconWrap, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="phone-portrait-outline" size={18} color="#F59E0B" />
            </View>
            <View>
              <Text style={[styles.settingTitle, { color: '#F59E0B' }]}>Reset Local Data</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {resettingLocal ? 'Resetting local data...' : 'Delete local storage only'}
              </Text>
            </View>
          </View>
          <Ionicons name="warning-outline" size={18} color="#F59E0B" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingRow, styles.dangerRow, { backgroundColor: colors.card, borderColor: colors.danger }]}
          onPress={handleResetAppData}
          activeOpacity={0.8}
          disabled={resetting}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconWrap, { backgroundColor: colors.danger + '20' }]}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </View>
            <View>
              <Text style={[styles.settingTitle, { color: colors.danger }]}>Reset App Data</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {resetting ? 'Resetting...' : 'Delete local storage and PocketBase data'}
              </Text>
            </View>
          </View>
          <Ionicons name="warning-outline" size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  settingRow: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dangerRow: {
    borderWidth: 1,
  },
  warningRow: {
    borderWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});

