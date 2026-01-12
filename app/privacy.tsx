import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Spacing, BorderRadius, Typography } from '@/theme/designTokens';

export default function PrivacyPolicy() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const Section = ({ title, children }: { title: string; children: string | string[] }) => (
    <View style={{ marginBottom: Spacing.lg }}>
      <Text style={{
        color: c.text,
        fontSize: Typography.scale.heading3.fontSize,
        fontWeight: Typography.fontWeight.bold,
        marginBottom: Spacing.md,
        fontFamily: Typography.fontFamily.body,
      }}>
        {title}
      </Text>
      {Array.isArray(children) ? (
        children.map((child, idx) => (
          <Text key={idx} style={{
            color: c.text,
            fontSize: Typography.scale.body.fontSize,
            lineHeight: Typography.scale.body.lineHeight,
            marginBottom: Spacing.sm,
            fontFamily: Typography.fontFamily.body,
          }}>
            {child}
          </Text>
        ))
      ) : (
        <Text style={{
          color: c.text,
          fontSize: Typography.scale.body.fontSize,
          lineHeight: Typography.scale.body.lineHeight,
          marginBottom: Spacing.sm,
          fontFamily: Typography.fontFamily.body,
        }}>
          {children}
        </Text>
      )}
    </View>
  );

  return (
    <GradientBackground>
      <AnimatedPage style={{ flex: 1 }}>
        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ 
            flexGrow: 1,
            padding: Spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{
            flex: 1,
            maxWidth: isMobile ? '100%' : 800,
            alignSelf: 'center',
            width: '100%',
          }}>
            {/* Header */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: Spacing.lg,
            }}>
              <Text style={{
                color: c.text,
                fontSize: Typography.scale.heading1.fontSize,
                fontWeight: Typography.fontWeight.bold,
                fontFamily: Typography.fontFamily.body,
              }}>
                Privacy Policy
              </Text>
              <Pressable 
                onPress={() => router.back()}
                style={{ padding: Spacing.sm }}
              >
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>

            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.caption.fontSize,
              marginBottom: Spacing.lg,
              fontFamily: Typography.fontFamily.body,
            }}>
              Last Updated: December 1, 2025
            </Text>

            <Section title="">
              At Picky, we value your trust and are committed to protecting your privacy. We want you to feel comfortable and secure while discovering great experiences with your friends.
            </Section>

            <Section 
              title="1. Information We Collect"
              children={[
                'We do not share or sell information you provide directly to us. We collect information you provide when you create an account, and usage data generated when you use our services.',
                '• Account Information: Your name, email address, and encrypted password.',
                '• Profile & Preferences: Your interests, dietary preferences, and location settings to help us find the best matches for you.',
                '• Activity Data: Events you save, restaurants you like, and group polls you participate in.'
              ]}
            />

            <Section 
              title="2. How We Use Your Information"
              children={[
                'We use your data to make your experience better:',
                '• To provide and improve our discovery and planning services',
                '• To personalize your event and restaurant recommendations',
                '• To facilitate group decision-making with your friends',
                '• To communicate with you about your account and updates',
                '• To analyze usage patterns and improve our platform'
              ]}
            />

            <Section 
              title="3. Third-Party Sharing & Protection"
              children="We may use third-party services (such as analytics tools) to improve our app. We ensure that any third-party partner, subsidiary, or related entity with access to user data provides the same or equal level of data protection as stated in this Privacy Policy and required by applicable guidelines. We do not sell your personal data to advertisers."
            />

            <Section 
              title="4. Data Retention & Deletion"
              children="We retain your personal information only for as long as your account is active or as needed to provide you with our services. You can request deletion of your account and associated data at any time through the app settings. Upon deletion, your personal data will be removed from our active databases within 30 days."
            />

            <Section 
              title="5. Data Security"
              children="We are committed to protecting your data and work hard to keep it secure. We protect your personal information against unauthorized access, alteration, disclosure, or destruction by implementing appropriate technical and organizational measures. Your passwords are encrypted and are never visible to any organizational members."
            />

            <Section 
              title="6. Your Rights & Consent"
              children={[
                'By using our app, you consent to the collection and use of your information as described in this policy. You have full control over your data and can:',
                '• Access and update your personal information',
                '• Manage your privacy settings and permissions',
                '• Withdraw your consent by deleting your account',
                '• Opt-out of communications',
                'We only request access to device permissions (like location) when relevant to the app\'s core functionality, and you can revoke these permissions at any time in your device settings.'
              ]}
            />

            <Section 
              title="7. Contact Us"
              children="If you have any questions about this Privacy Policy, please contact us at admin@usepicky.app"
            />

            <Section 
              title="8. Changes to This Policy"
              children="We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the 'Last Updated' date."
            />

            <View style={{ height: Spacing.xl }} />
          </View>
        </ScrollView>
      </AnimatedPage>
    </GradientBackground>
  );
}