import { supabase } from './supabase';

export async function ensureProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const email = user.email ?? '';
  await supabase.from('users').upsert({ id: user.id, email }, { onConflict: 'id' });
}

export type OnboardingPayload = {
  interests: string[];
  majors: string[];
  custom_interests: string[];
  food_restrictions: string[];
  preferences: Record<string, any>;
  complete?: boolean;
};

export async function getOnboarding() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('user_onboarding')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  return data ?? null;
}

export async function saveOnboarding(payload: OnboardingPayload) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const row: any = {
    user_id: user.id,
    interests: payload.interests ?? [],
    majors: payload.majors ?? [],
    custom_interests: payload.custom_interests ?? [],
    food_restrictions: payload.food_restrictions ?? [],
    preferences: payload.preferences ?? {},
  };
  if (payload.complete) row.completed_at = new Date().toISOString();
  const { error } = await supabase.from('user_onboarding').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

