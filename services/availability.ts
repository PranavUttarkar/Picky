import { supabase } from '@/services/supabase';
import { trackEvent } from '@/utils/analytics';
import { createRateLimiter } from '@/utils/rateLimiter';

// Rate limiter for availability updates
const availabilityUpdateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60000, key: 'availability:replace' });

export type SlotKey = string; // ISO string of slot_start in UTC (rounded to slot)

export interface AvailabilityWindow {
  startIso: string; // inclusive
  endIso: string;   // exclusive
}

export interface GroupAvailability {
  counts: Record<SlotKey, number>;
  mySlots: Set<SlotKey>;
  memberCount: number;
}

export interface AvailabilitySummarySlot {
  slotIso: string;
  count: number;
}

export interface GroupAvailabilitySummary {
  topSlots: AvailabilitySummarySlot[];
  memberCount: number;
  answeredCount: number; // members who added availability in window
  pendingCount: number; // memberCount - answeredCount
}

// Compute window [start, end) for the next N days starting at the nearest slot
export function computeWindow(now: Date, slotMinutes = 30, days = 7): AvailabilityWindow {
  const start = new Date(now);
  const ms = start.getMinutes();
  const remainder = ms % slotMinutes;
  if (remainder !== 0) {
    start.setMinutes(ms - remainder, 0, 0);
  } else {
    start.setSeconds(0, 0);
  }
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export async function getGroupAvailability(
  groupId: number,
  window: AvailabilityWindow,
): Promise<GroupAvailability> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('not authenticated');

  // Fetch all availability rows for the group in window
  const { data: rows, error } = await supabase
    .from('group_availability')
    .select('user_id, slot_start')
    .eq('group_id', groupId)
    .gte('slot_start', window.startIso)
    .lt('slot_start', window.endIso);
  if (error) throw error;

  const counts: Record<SlotKey, number> = {};
  const mySlots = new Set<SlotKey>();
  for (const r of rows ?? []) {
    const key = new Date(r.slot_start as string).toISOString();
    counts[key] = (counts[key] ?? 0) + 1;
    if (r.user_id === user.id) mySlots.add(key);
  }

  // Get member count to normalize heatmap
  const { data: members, error: err2 } = await supabase
    .from('group_members')
    .select('user_id', { count: 'exact', head: false })
    .eq('group_id', groupId);
  if (err2) throw err2;
  const memberCount = (members as any[])?.length ?? 0;

  return { counts, mySlots, memberCount };
}

export async function replaceMyAvailability(
  groupId: number,
  window: AvailabilityWindow,
  slots: SlotKey[],
): Promise<void> {
  return availabilityUpdateLimiter.execute(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('not authenticated');

    // Delete existing rows in the window for this user+group
    const del = await supabase
      .from('group_availability')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .gte('slot_start', window.startIso)
      .lt('slot_start', window.endIso);
    if (del.error) throw del.error;

    if (!slots.length) return;

    const rows = slots.map((iso) => ({ group_id: groupId, user_id: user.id, slot_start: iso }));
    const { error } = await supabase.from('group_availability').insert(rows);
    if (error) throw error;
    trackEvent('availability_replaced', { group_id: groupId, slots_count: slots.length, window_days: Math.max(1, Math.floor((new Date(window.endIso).getTime() - new Date(window.startIso).getTime()) / (24 * 60 * 60 * 1000))) }).catch(() => {});
  });
}

export async function getGroupAvailabilitySummary(
  groupId: number,
  window: AvailabilityWindow,
  limit: number = 3,
): Promise<GroupAvailabilitySummary> {
  // Fetch rows in window
  const { data: rows, error } = await supabase
    .from('group_availability')
    .select('user_id, slot_start')
    .eq('group_id', groupId)
    .gte('slot_start', window.startIso)
    .lt('slot_start', window.endIso);
  if (error) throw error;

  const counts: Record<string, number> = {};
  const users = new Set<string>();
  for (const r of rows ?? []) {
    const key = new Date(r.slot_start as string).toISOString();
    counts[key] = (counts[key] ?? 0) + 1;
    users.add(r.user_id as string);
  }
  const answeredCount = users.size;

  const { data: members, error: err2 } = await supabase
    .from('group_members')
    .select('user_id', { count: 'exact', head: false })
    .eq('group_id', groupId);
  if (err2) throw err2;
  const memberCount = (members as any[])?.length ?? 0;
  const pendingCount = Math.max(0, memberCount - answeredCount);

  const topSlots = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slotIso, count]) => ({ slotIso, count }));

  return { topSlots, memberCount, answeredCount, pendingCount };
}
