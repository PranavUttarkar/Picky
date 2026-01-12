import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Spacing, BorderRadius, Typography } from '@/theme/designTokens';

export default function TermsOfService() {
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
                Terms of Service
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
              Welcome to Picky! These Terms of Service govern your use of our mobile application and services. By accessing and using Picky, you agree to be bound by these terms. If you do not agree to these terms, please do not use our service.
            </Section>

            <Section 
              title="1. Account Registration"
              children={[
                'To use Picky, you must create an account by providing accurate, complete, and current information. You are responsible for maintaining the confidentiality of your password and account credentials. You agree to notify us immediately of any unauthorized use of your account. You are solely responsible for all activity that occurs under your account.',
                'You must be at least 13 years old to use Picky. If you are under 18, you represent that you have obtained parental or guardian consent to use the service.'
              ]}
            />

            <Section 
              title="2. User Responsibilities"
              children={[
                'When using Picky, you agree to:',
                '• Use the service only for lawful purposes and in a way that does not infringe upon the rights of others or restrict their use and enjoyment of the service.',
                '• Behave respectfully toward other users and not engage in harassment, discrimination, or hate speech.',
                '• Not share false, misleading, or defamatory information.',
                '• Not attempt to gain unauthorized access to our systems or other users\' accounts.',
                '• Not use the service to spam, send malware, or engage in any form of cyberattack.',
                '• Not scrape, crawl, or use automated tools to extract data from our service without permission.'
              ]}
            />

            <Section 
              title="3. Content Ownership"
              children="You retain all rights to any content you create or upload to Picky. By using our service, you grant Picky a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute your content as necessary to provide and improve our services. We may also use anonymized data derived from your content for analytics and service improvement."
            />

            <Section 
              title="4. Prohibited Activities"
              children={[
                'You agree not to:',
                '• Impersonate another person or entity.',
                '• Upload, transmit, or distribute any content that is illegal, obscene, or harmful.',
                '• Engage in coordinated inauthentic behavior or manipulation of the platform.',
                '• Attempt to circumvent our safety features or rate limiting systems.',
                '• Access, retrieve, or index our content through automated means without permission.',
                '• Use Picky to develop competing products or services.'
              ]}
            />

            <Section 
              title="5. Limitation of Liability"
              children="Picky is provided on an 'AS IS' basis without warranties of any kind. To the maximum extent permitted by law, Picky disclaims all warranties, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement. In no event shall Picky be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of the service."
            />

            <Section 
              title="6. Indemnification"
              children="You agree to indemnify and hold harmless Picky, its owners, employees, and agents from any claims, damages, losses, or expenses arising out of your violation of these terms, your use of the service, or your infringement of any rights of another party."
            />

            <Section 
              title="7. Modification of Service"
              children="Picky reserves the right to modify, suspend, or discontinue the service at any time, with or without notice. We will not be liable to you for any modification, suspension, or discontinuation of the service. We may also modify these Terms of Service at any time, and your continued use of the service constitutes acceptance of any modifications."
            />

            <Section 
              title="8. Termination"
              children="We may terminate or suspend your account immediately, without prior notice or liability, for any reason, including if you breach these Terms of Service. Upon termination, your right to use the service will immediately cease, and we may delete your account and associated data."
            />

            <Section 
              title="9. Governing Law"
              children="These Terms of Service are governed by and construed in accordance with the laws of the jurisdiction in which Picky operates, without regard to its conflict of law principles. You agree to submit to the exclusive jurisdiction of the courts located in that jurisdiction."
            />

            <Section 
              title="10. Contact Us"
              children="If you have any questions about these Terms of Service, please contact us at admin@usepicky.app"
            />

            <Section 
              title="11. Severability"
              children="If any provision of these Terms of Service is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid provision shall be modified to the minimum extent necessary to make it valid and enforceable."
            />

            <View style={{ height: Spacing.xl }} />
          </View>
        </ScrollView>
      </AnimatedPage>
    </GradientBackground>
  );
}