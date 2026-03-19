import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface QuickActionCardProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  onPress: () => void;
}

export function QuickActionCard({ title, icon, accent, onPress }: QuickActionCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.iconContainer, { backgroundColor: accent }]}>
        <Ionicons name={icon} size={18} color="#FFFFFF" />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color="#B6C0D2" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderColor: '#242B38',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 5,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

