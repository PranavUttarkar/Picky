import React, { useState } from 'react';
import {
  View,
  Text,
  ViewStyle,
  TextStyle,
  Pressable,
  Animated,
  Share,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/theme/ThemeProvider';
import * as Clipboard from 'expo-clipboard';
import { Typography } from '@/theme/designTokens';

type Props = {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  onBack?: () => void;
  backLabel?: string;
  hideBrand?: boolean; // optionally suppress usePicky.app branding
  shareUrl?: string; // if provided, show share icon that copies link
};

export default function GradientHeader({
  title,
  subtitle,
  style,
  titleStyle,
  subtitleStyle,
  onBack,
  backLabel = 'Back',
  hideBrand,
  shareUrl,
}: Props) {
  const c = useThemeColors();
  const [copied, setCopied] = useState(false);
  const [fade] = useState(() => new Animated.Value(0));

  const showCopiedToast = () => {
    setCopied(true);
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setTimeout(() => {
        Animated.timing(fade, {
          toValue: 0,
          duration: 250,
          useNativeDriver: Platform.OS !== 'web',
        }).start(() => setCopied(false));
      }, 1200);
    });
  };

  const doCopy = async () => {
    if (!shareUrl) return;
    try {
      await Clipboard.setStringAsync(shareUrl);
      showCopiedToast();
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  const doShare = async () => {
    if (!shareUrl) return;
    try {
      // Web (PWA) – use Web Share API if available
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        try {
          await (navigator as any).share({ title, text: title, url: shareUrl });
          return; // success, no toast (system UI already showed)
        } catch (err: any) {
          if (err?.name === 'AbortError') return; // user cancelled
          // fall through to native/clipboard fallback
        }
      }
      // Native (iOS / Android)
      await Share.share(
        Platform.select({
          ios: { url: shareUrl, message: `${title}\n${shareUrl}`, title },
          default: { message: `${title}\n${shareUrl}` },
        }) as any,
      );
    } catch (e) {
      // Fallback: copy to clipboard + toast
      await doCopy();
    }
  };
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)'] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 12, borderRadius: 12 }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                  backgroundColor: '#00000030',
                  borderRadius: 8,
                  marginRight: 8,
                }}
                accessibilityRole="button"
                accessibilityLabel={backLabel}
              >
                <Text style={{ 
                  color: c.text, 
                  fontWeight: Typography.fontWeight.bold,
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.bodyBold,
                }}>
                  {'‹'}
                </Text>
              </Pressable>
            ) : null}
            <Text style={[{ 
              color: c.text, 
              fontWeight: Typography.fontWeight.bold,
              fontSize: Typography.scale.heading2.fontSize,
              fontFamily: Typography.fontFamily.bodyBold,
            }, titleStyle]}>
              {title}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {!hideBrand ? (
              <Text
                style={{
                  color: c.muted,
                  fontSize: Typography.scale.bodySmall.fontSize,
                  fontFamily: Typography.fontFamily.bodySemibold,
                  fontWeight: Typography.fontWeight.semibold,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
                accessibilityLabel="Brand: usePicky dot app"
              >
                usePicky.app
              </Text>
            ) : null}
            {shareUrl ? (
              <Pressable
                onPress={doShare}
                accessibilityLabel={copied ? 'Link copied' : 'Share link'}
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  backgroundColor: '#00000030',
                  borderRadius: 8,
                }}
              >
                <Text style={{ 
                  color: c.text, 
                  fontWeight: Typography.fontWeight.bold,
                  fontSize: Typography.scale.bodySmall.fontSize,
                  fontFamily: Typography.fontFamily.bodyBold,
                }}>
                  Share
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        {copied ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -6,
              right: 8,
              backgroundColor: c.card,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              flexDirection: 'row',
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              opacity: fade,
              transform: [
                {
                  translateY: fade.interpolate({
                    inputRange: [0, 1],
                    outputRange: [6, 0],
                  }),
                },
              ],
            }}
          >
            <Text style={{ 
              color: c.text, 
              fontWeight: Typography.fontWeight.bold,
              fontSize: Typography.scale.bodySmall.fontSize,
              fontFamily: Typography.fontFamily.bodyBold,
            }}>
              Link copied
            </Text>
          </Animated.View>
        ) : null}
        {subtitle ? (
          <Text style={[{ 
            color: c.muted, 
            fontSize: Typography.scale.body.fontSize,
            fontFamily: Typography.fontFamily.body,
            marginTop: 4,
          }, subtitleStyle]}>
            {subtitle}
          </Text>
        ) : null}
      </LinearGradient>
    </View>
  );
}
