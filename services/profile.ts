import { supabase } from './supabase';

export async function ensureProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
    });
  }
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

  const { error: onboardingError } = await supabase.from('user_onboarding').upsert(row, { onConflict: 'user_id' });
  if (onboardingError) throw onboardingError;

  // Insert interests into user_interests table
  const interestRows = payload.interests.map((interest) => ({
    user_id: user.id,
    interest,
  }));

  const { error: interestsError } = await supabase.from('user_interests').upsert(interestRows, {
    onConflict: 'user_id',
  });

  if (interestsError) throw interestsError;
}

export async function saveUserInterests(interests: string[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not signed in');

  // Clear existing interests
  await supabase.from('user_interests').delete().eq('user_id', user.id);

  // Insert new interests
  const { error } = await supabase.from('user_interests').insert(
    interests.map((interest) => ({ user_id: user.id, interest })),
  );
  if (error) throw error;
}

