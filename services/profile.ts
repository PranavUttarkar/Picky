import { supabase } from './supabase';

export async function ensureProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const email = user.email ?? '';
  await supabase.from('users').upsert({ id: user.id, email }, { onConflict: 'id' });
}
