import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useThemeColors } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { ensureProfile } from '@/services/profile';
import { useGroupDecisionNotification } from '@/utils/GroupDecisionNotificationContext';
import { Spacing, BorderRadius, Typography, Colors } from '@/theme/designTokens';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';

export default function OnboardingGroup() {
  const c = useThemeColors();
  const { triggerNotification: triggerGroupDot } = useGroupDecisionNotification();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Skip this step if interests already completed and user chooses to bypass groups
  // We keep this screen accessible but redirect if fully onboarded and landed here accidentally
  // (e.g., back button after onboarding completed)
  // Not strictly necessary, but improves UX.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  // @ts-ignore
  useState(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      const { data } = await supabase
        .from('user_interests_temp')
        .select('names')
        .eq('user_id', user.id)
        .maybeSingle();
      const names = (data?.names as string[] | null) ?? [];
      if (Array.isArray(names) && names.length >= 2) {
        // If they come here after finishing interests, allow them to proceed or skip.
        // We don't force redirect, but ensure Skip goes home (already implemented).
      }
    })();
    return undefined;
  });

  const createGroup = async () => {
    try {
      setError(null);
      if (!name.trim()) return;
      setLoading(true);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      // Ensure a users row exists to satisfy groups.created_by FK
      await ensureProfile();
      const invite_code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const { data: grp, error: e1 } = await supabase
        .from('groups')
        .insert({ name, created_by: user.id, invite_code })
        .select('id')
        .single();
      if (e1 || !grp) throw new Error(e1?.message ?? 'Failed');
      await supabase.from('group_members').insert({ group_id: grp.id, user_id: user.id });
      // Trigger a red dot on the Groups tab to highlight the new group
      try {
        await triggerGroupDot();
      } catch {}
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async () => {
    try {
      setError(null);
      if (!code.trim()) return;
      setLoading(true);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      let groupId: number | null = null;
      const numeric = parseInt(code, 10);
      if (!isNaN(numeric)) {
        groupId = numeric;
      } else {
        const { data } = await supabase
          .from('groups')
          .select('id')
          .eq('invite_code', code.toUpperCase())
          .maybeSingle();
        groupId = data?.id ?? null;
      }
      if (!groupId) throw new Error('Invalid code');
      await supabase.from('group_members').upsert({ group_id: groupId, user_id: user.id });
      router.replace('/(tabs)/groups');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientBackground>
      <AnimatedPage variant="slide-right">
        <View style={{ flex: 1, padding: Spacing.md }}>
          <Text
            style={{
              color: c.text,
              fontSize: Typography.scale.heading1.fontSize,
              lineHeight: Typography.scale.heading1.lineHeight,
              fontFamily: Typography.fontFamily.body,
              fontWeight: Typography.fontWeight.bold,
              marginBottom: Spacing.md - 4,
            }}
          >
            Create or Join Group
          </Text>
          <Text style={{
            color: c.muted,
            fontSize: Typography.scale.body.fontSize,
            lineHeight: Typography.scale.body.lineHeight,
            fontFamily: Typography.fontFamily.body,
            marginBottom: Spacing.md,
          }}>
            Connect with friends to make decisions together
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md }}>
            <Pressable
              onPress={() => setMode('create')}
              style={{
                flex: 1,
                padding: Spacing.md - 4,
                borderRadius: BorderRadius.md,
                backgroundColor: mode === 'create' ? c.primary : c.card,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: mode === 'create' ? 'transparent' : Colors.light.neutral[300] + '40',
              }}
            >
              <Text
                style={{
                  color: mode === 'create' ? '#FFFFFF' : c.text,
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  fontWeight: Typography.fontWeight.semibold,
                }}
              >
                Create
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('join')}
              style={{
                flex: 1,
                padding: Spacing.md - 4,
                borderRadius: BorderRadius.md,
                backgroundColor: mode === 'join' ? c.primary : c.card,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: mode === 'join' ? 'transparent' : Colors.light.neutral[300] + '40',
              }}
            >
              <Text
                style={{
                  color: mode === 'join' ? '#FFFFFF' : c.text,
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  fontWeight: Typography.fontWeight.semibold,
                }}
              >
                Join
              </Text>
            </Pressable>
          </View>
          {mode === 'create' ? (
            <View>
              <Text style={{
                color: c.text,
                fontSize: Typography.scale.bodyLarge.fontSize,
                lineHeight: Typography.scale.bodyLarge.lineHeight,
                fontFamily: Typography.fontFamily.body,
                fontWeight: Typography.fontWeight.semibold,
                marginBottom: Spacing.sm,
              }}>
                Group name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g., Weekend Squad"
                placeholderTextColor={c.muted}
                style={{
                  backgroundColor: c.card,
                  color: c.text,
                  padding: Spacing.md - 4,
                  borderRadius: BorderRadius.md,
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  marginBottom: Spacing.sm,
                }}
              />
              {error && <Text style={{ 
                color: Colors.light.accent, 
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                marginTop: Spacing.sm,
                marginBottom: Spacing.sm,
              }}>
                {error}
              </Text>}
              <Pressable
                onPress={createGroup}
                disabled={loading || !name.trim()}
                style={{
                  marginTop: Spacing.md,
                  backgroundColor: (loading || !name.trim()) ? c.muted : c.primary,
                  padding: Spacing.md - 2,
                  borderRadius: BorderRadius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ 
                  color: '#FFFFFF', 
                  fontSize: Typography.scale.bodyLarge.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  fontWeight: Typography.fontWeight.semibold,
                }}>
                  {loading ? 'Creating…' : 'Create group'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.replace('/(tabs)/home')}
                disabled={loading}
                style={{
                  marginTop: Spacing.md - 4,
                  padding: Spacing.md - 2,
                  alignItems: 'center',
                }}
              >
                <Text style={{ 
                  color: c.muted, 
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.body,
                }}>
                  Skip for now
                </Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={{
                color: c.text,
                fontSize: Typography.scale.bodyLarge.fontSize,
                lineHeight: Typography.scale.bodyLarge.lineHeight,
                fontFamily: Typography.fontFamily.body,
                fontWeight: Typography.fontWeight.semibold,
                marginBottom: Spacing.sm,
              }}>
                Invite code or ID
              </Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                placeholder="Enter code from friend"
                placeholderTextColor={c.muted}
                style={{
                  backgroundColor: c.card,
                  color: c.text,
                  padding: Spacing.md - 4,
                  borderRadius: BorderRadius.md,
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  marginBottom: Spacing.sm,
                }}
              />
              {error && <Text style={{ 
                color: Colors.light.accent, 
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                marginTop: Spacing.sm,
                marginBottom: Spacing.sm,
              }}>
                {error}
              </Text>}
              <Pressable
                onPress={joinGroup}
                disabled={loading || !code.trim()}
                style={{
                  marginTop: Spacing.md,
                  backgroundColor: (loading || !code.trim()) ? c.muted : c.primary,
                  padding: Spacing.md - 2,
                  borderRadius: BorderRadius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ 
                  color: '#FFFFFF', 
                  fontSize: Typography.scale.bodyLarge.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  fontWeight: Typography.fontWeight.semibold,
                }}>
                  {loading ? 'Joining…' : 'Join group'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.replace('/(tabs)/home')}
                disabled={loading}
                style={{
                  marginTop: Spacing.md - 4,
                  padding: Spacing.md - 2,
                  alignItems: 'center',
                }}
              >
                <Text style={{ 
                  color: c.muted, 
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.body,
                }}>
                  Skip for now
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </AnimatedPage>
    </GradientBackground>
  );
}
