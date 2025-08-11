import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CYBERPUNK_COLORS } from '@constants/index';

interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
  onPress?: () => void;
  variant?: 'default' | 'card' | 'minimal';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  showChevron?: boolean;
  status?: 'active' | 'inactive' | 'coming_soon';
  badge?: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({
  icon,
  title,
  description,
  onPress,
  variant = 'default',
  size = 'medium',
  style,
  showChevron = false,
  status = 'active',
  badge,
}) => {
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          iconSize: 32,
          iconFontSize: 16,
          titleFontSize: 14,
          descriptionFontSize: 12,
          padding: 12,
        };
      case 'medium':
        return {
          iconSize: 40,
          iconFontSize: 20,
          titleFontSize: 16,
          descriptionFontSize: 14,
          padding: 16,
        };
      case 'large':
        return {
          iconSize: 48,
          iconFontSize: 24,
          titleFontSize: 18,
          descriptionFontSize: 16,
          padding: 20,
        };
      default:
        return {
          iconSize: 40,
          iconFontSize: 20,
          titleFontSize: 16,
          descriptionFontSize: 14,
          padding: 16,
        };
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'card':
        return {
          backgroundColor: CYBERPUNK_COLORS.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: CYBERPUNK_COLORS.border,
        };
      case 'minimal':
        return {
          backgroundColor: 'transparent',
        };
      default:
        return {
          backgroundColor: CYBERPUNK_COLORS.surface,
          borderRadius: 8,
        };
    }
  };

  const getStatusStyles = () => {
    switch (status) {
      case 'inactive':
        return {
          opacity: 0.5,
        };
      case 'coming_soon':
        return {
          opacity: 0.7,
        };
      default:
        return {};
    }
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();
  const statusStyles = getStatusStyles();

  const renderIcon = () => (
    <View
      style={[
        styles.iconContainer,
        {
          width: sizeStyles.iconSize,
          height: sizeStyles.iconSize,
          borderRadius: sizeStyles.iconSize / 2,
        },
        status === 'active' && styles.activeIconContainer,
      ]}
    >
      {status === 'active' ? (
        <LinearGradient
          colors={[CYBERPUNK_COLORS.primary + '20', CYBERPUNK_COLORS.accent + '20']}
          style={[
            styles.iconGradient,
            {
              width: sizeStyles.iconSize,
              height: sizeStyles.iconSize,
              borderRadius: sizeStyles.iconSize / 2,
            },
          ]}
        >
          <Text style={[styles.icon, { fontSize: sizeStyles.iconFontSize }]}>
            {icon}
          </Text>
        </LinearGradient>
      ) : (
        <Text style={[styles.icon, { fontSize: sizeStyles.iconFontSize }]}>
          {icon}
        </Text>
      )}
    </View>
  );

  const renderContent = () => (
    <View style={styles.content}>
      <View style={styles.titleRow}>
        <Text
          style={[
            styles.title,
            { fontSize: sizeStyles.titleFontSize },
            statusStyles,
          ]}
        >
          {title}
        </Text>
        
        {badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        
        {status === 'coming_soon' && (
          <View style={[styles.badge, styles.comingSoonBadge]}>
            <Text style={styles.badgeText}>Soon</Text>
          </View>
        )}
      </View>
      
      <Text
        style={[
          styles.description,
          { fontSize: sizeStyles.descriptionFontSize },
          statusStyles,
        ]}
      >
        {description}
      </Text>
    </View>
  );

  const renderChevron = () => {
    if (!showChevron && !onPress) return null;
    
    return (
      <View style={styles.chevronContainer}>
        <Text style={styles.chevron}>›</Text>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[styles.container, variantStyles, { padding: sizeStyles.padding }, statusStyles, style]}
      onPress={onPress}
      disabled={status === 'inactive' || status === 'coming_soon'}
      activeOpacity={0.8}
    >
      {renderIcon()}
      {renderContent()}
      {renderChevron()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    backgroundColor: CYBERPUNK_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activeIconContainer: {
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.primary + '40',
  },
  iconGradient: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontWeight: '600',
    color: CYBERPUNK_COLORS.text,
    flex: 1,
    letterSpacing: 0.5,
  },
  description: {
    color: CYBERPUNK_COLORS.textSecondary,
    lineHeight: 20,
  },
  badge: {
    backgroundColor: CYBERPUNK_COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  comingSoonBadge: {
    backgroundColor: CYBERPUNK_COLORS.warning,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.background,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chevronContainer: {
    marginLeft: 16,
  },
  chevron: {
    fontSize: 20,
    color: CYBERPUNK_COLORS.textSecondary,
    fontWeight: 'bold',
  },
});

export default FeatureItem;
