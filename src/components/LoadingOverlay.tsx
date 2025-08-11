import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ViewStyle,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CYBERPUNK_COLORS } from '../constants/index';
import LoadingSpinner from './LoadingSpinner';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  variant?: 'modal' | 'overlay' | 'inline';
  spinnerVariant?: 'spinner' | 'pulse' | 'dots' | 'bars';
  transparent?: boolean;
  style?: ViewStyle;
  onRequestClose?: () => void;
}

const { width, height } = Dimensions.get('window');

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message = 'Loading...',
  variant = 'modal',
  spinnerVariant = 'spinner',
  transparent = false,
  style,
  onRequestClose,
}) => {
  if (!visible) return null;

  const renderContent = () => (
    <View style={styles.contentContainer}>
      <LinearGradient
        colors={[
          CYBERPUNK_COLORS.surface,
          CYBERPUNK_COLORS.background,
        ]}
        style={styles.loadingCard}
      >
        <LoadingSpinner
          variant={spinnerVariant}
          size="large"
          color={CYBERPUNK_COLORS.primary}
        />
        
        {message && (
          <Text style={styles.loadingText}>{message}</Text>
        )}
        
        {/* Cyberpunk decorative elements */}
        <View style={styles.decorativeLines}>
          <View style={[styles.line, styles.line1]} />
          <View style={[styles.line, styles.line2]} />
        </View>
      </LinearGradient>
    </View>
  );

  if (variant === 'modal') {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onRequestClose}
      >
        <View
          style={[
            styles.modalOverlay,
            transparent && styles.transparentOverlay,
            style,
          ]}
        >
          {renderContent()}
        </View>
      </Modal>
    );
  }

  if (variant === 'overlay') {
    return (
      <View
        style={[
          styles.absoluteOverlay,
          transparent && styles.transparentOverlay,
          style,
        ]}
      >
        {renderContent()}
      </View>
    );
  }

  // Inline variant
  return (
    <View style={[styles.inlineContainer, style]}>
      {renderContent()}
    </View>
  );
};

// Specialized loading components
export const FullScreenLoader: React.FC<{
  visible: boolean;
  message?: string;
  onRequestClose?: () => void;
}> = ({ visible, message = 'Loading...', onRequestClose }) => (
  <LoadingOverlay
    visible={visible}
    message={message}
    variant="modal"
    spinnerVariant="spinner"
    onRequestClose={onRequestClose}
  />
);

export const PageLoader: React.FC<{
  message?: string;
  style?: ViewStyle;
}> = ({ message = 'Loading...', style }) => (
  <LoadingOverlay
    visible={true}
    message={message}
    variant="inline"
    spinnerVariant="pulse"
    style={[styles.pageLoader, style] as ViewStyle}
  />
);

export const ButtonLoader: React.FC<{
  visible: boolean;
  message?: string;
}> = ({ visible, message = 'Processing...' }) => {
  if (!visible) return null;

  return (
    <View style={styles.buttonLoader}>
      <LoadingSpinner
        variant="dots"
        size="small"
        color={CYBERPUNK_COLORS.primary}
      />
      {message && (
        <Text style={styles.buttonLoaderText}>{message}</Text>
      )}
    </View>
  );
};

export const SectionLoader: React.FC<{
  visible: boolean;
  height?: number;
  message?: string;
}> = ({ visible, height = 200, message }) => {
  if (!visible) return null;

  return (
    <View style={[styles.sectionLoader, { height }]}>
      <LoadingSpinner
        variant="pulse"
        size="medium"
        color={CYBERPUNK_COLORS.primary}
      />
      {message && (
        <Text style={styles.sectionLoaderText}>{message}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transparentOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  absoluteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  inlineContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
    minWidth: 200,
    position: 'relative',
    overflow: 'hidden',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: CYBERPUNK_COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  decorativeLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  line: {
    position: 'absolute',
    height: 1,
    backgroundColor: CYBERPUNK_COLORS.primary + '30',
  },
  line1: {
    top: 8,
    left: 8,
    right: '60%',
  },
  line2: {
    bottom: 8,
    right: 8,
    left: '60%',
  },
  pageLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CYBERPUNK_COLORS.background,
  },
  buttonLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  buttonLoaderText: {
    marginLeft: 8,
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    fontWeight: '600',
  },
  sectionLoader: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  sectionLoaderText: {
    marginTop: 12,
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default LoadingOverlay;
