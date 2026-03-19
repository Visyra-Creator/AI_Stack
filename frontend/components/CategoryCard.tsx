import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CategoryCardProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  onPress: () => void;
}

export function CategoryCard({ title, description, icon, accent, onPress }: CategoryCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.iconContainer, { backgroundColor: accent }]}>
        <Ionicons name={icon} size={20} color="#F8FAFC" />
      </View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <Text style={styles.description} numberOfLines={2}>{description}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: '#151A22',
    borderWidth: 1,
    borderColor: '#242B38',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 154,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 7,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    color: '#8D95A3',
    fontSize: 13,
    lineHeight: 18,
  },
});

