import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  StatusBar,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CYBERPUNK_COLORS } from '@constants/index';

interface CyberpunkModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  variant?: 'default' | 'fullscreen' | 'bottom' | 'center';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  animationType?: 'slide' | 'fade' | 'none';
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const CyberpunkModal: React.FC<CyberpunkModalProps> = ({
  visible,
  onClose,
  title,
  children,
  variant = 'center',
  showCloseButton = true,
  closeOnBackdrop = true,
  animationType = 'fade',
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (visible) {
      if (animationType === 'fade') {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
        ]).start();
      } else if (animationType === 'slide') {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      if (animationType === 'fade') {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.5,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      } else if (animationType === 'slide') {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: screenHeight,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  }, [visible, animationType]);

  const handleBackdropPress = () => {
    if (closeOnBackdrop) {
      onClose();
    }
  };

  const getModalStyle = () => {
    switch (variant) {
      case 'fullscreen':
        return styles.fullscreenModal;
      case 'bottom':
        return styles.bottomModal;
      case 'center':
      default:
        return styles.centerModal;
    }
  };

  const getContentStyle = () => {
    const baseStyle = styles.modalContent;

    if (animationType === 'slide') {
      return [
        baseStyle,
        {
          transform: [{ translateY: slideAnim }],
        },
      ];
    }

    return [
      baseStyle,
      {
        transform: [{ scale: scaleAnim }],
      },
    ];
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" translucent />
      
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View style={[getModalStyle(), getContentStyle()]}>
          <LinearGradient
            colors={[CYBERPUNK_COLORS.surface, CYBERPUNK_COLORS.background]}
            style={styles.modalGradient}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <View style={styles.header}>
                <View style={styles.titleContainer}>
                  {title && (
                    <Text style={styles.title}>{title}</Text>
                  )}
                </View>
                
                {showCloseButton && (
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Content */}
            <View style={styles.content}>
              {children}
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  centerModal: {
    width: screenWidth * 0.9,
    maxHeight: screenHeight * 0.8,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  bottomModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: screenHeight * 0.9,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  fullscreenModal: {
    width: screenWidth,
    height: screenHeight,
    backgroundColor: CYBERPUNK_COLORS.background,
  },
  modalContent: {
    flex: 1,
  },
  modalGradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: CYBERPUNK_COLORS.border,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    letterSpacing: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CYBERPUNK_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  closeButtonText: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.textSecondary,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
});

export default CyberpunkModal;
