import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';

interface CardProps {
  title: string;
  subtitle?: string;
  subtitleLines?: number;
  onPress?: () => void;
  onFavorite?: () => void;
  isFavorite?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleteLoading?: boolean;
  children?: React.ReactNode;
  tags?: string[];
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

const CardComponent: React.FC<CardProps> = ({
  title,
  subtitle,
  subtitleLines = 2,
  onPress,
  onFavorite,
  isFavorite,
  onEdit,
  onDelete,
  isDeleteLoading = false,
  children,
  tags,
  accessibilityLabel,
  accessibilityHint,
  testID,
}) => {
  const { colors } = useTheme();
  const cardAccessibilityLabel = accessibilityLabel ?? title;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={cardAccessibilityLabel}
      accessibilityHint={onPress ? accessibilityHint : undefined}
      accessibilityState={{ disabled: !onPress }}
      testID={testID}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={subtitleLines} ellipsizeMode="tail">
              {subtitle}
            </Text>
          )}
        </View>
        <View style={styles.actions}>
          {onFavorite && (
            <TouchableOpacity
              onPress={(event) => {
                event.stopPropagation();
                onFavorite();
              }}
              style={styles.iconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? `Unfavorite ${title}` : `Favorite ${title}`}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={18}
                color={isFavorite ? colors.danger : colors.textSecondary}
              />
            </TouchableOpacity>
          )}
          {onEdit && (
            <TouchableOpacity
              onPress={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              style={styles.iconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${title}`}
            >
              <Ionicons name="pencil" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              onPress={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              style={styles.iconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isDeleteLoading}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${title}`}
              accessibilityState={{ disabled: isDeleteLoading, busy: isDeleteLoading }}
            >
              {isDeleteLoading ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
      {tags && tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {tags.map((tag, index) => (
            <View key={`${tag}-${index}`} style={[styles.tag, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
      {children}
    </TouchableOpacity>
  );
};

CardComponent.displayName = 'Card';

export const Card = React.memo(CardComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
