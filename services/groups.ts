import { supabase } from '@/services/supabase';
import type { Group } from '@/types/models';

export async function createGroup(name: string): Promise<{ group_id: number; invite_code: string }> {
  const { data, error } = await supabase.rpc('create_group', { p_name: name });
  if (error) throw error;
  return data?.[0] ?? data; // returns table
}

export async function joinGroupByCode(code: string): Promise<number> {
  const { data, error } = await supabase.rpc('join_group_by_code', { p_code: code });
  if (error) throw error;
  return data as number;
}

export async function regenerateInviteCode(groupId: number): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_group_invite_code', { p_group_id: groupId });
  if (error) throw error;
  return data as string;
}

export async function getMyGroups(): Promise<Group[]> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('not authenticated');
  const { data, error } = await supabase
    .from('group_members')
    .select('group:groups(id,name,invite_code,created_by)')
    .eq('user_id', user.id);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.group);
}

export async function getGroupMembers(groupId: number): Promise<Array<{ id: string; name?: string | null; avatar_url?: string | null }>> {
  const { data, error } = await supabase
    .from('group_members')
    .select('user:users(id,name,avatar_url)')
    .eq('group_id', groupId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.user);
}
