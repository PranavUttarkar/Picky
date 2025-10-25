import { supabase } from '@/services/supabase';
import type { Restaurant, ScoredRestaurant } from '@/types/models';

const SELECT_RESTAURANT = `
  place_id, google_id, restaurant_name, description, address, city, state, zipcode,
  latitude, longitude, phone, website, category, price_range,
  review_points, reviews, main_image, image_1, image_2, image_3,
  page_url, plus_code, plus_code_url, delivery,
  popular_times_monday, popular_times_tuesday, popular_times_wednesday,
  popular_times_thursday, popular_times_friday, popular_times_saturday, popular_times_sunday,
  open_time_monday, open_time_tuesday, open_time_wednesday, open_time_thursday,
  open_time_friday, open_time_saturday, open_time_sunday
`;

function normalize(row: any): Restaurant {
  return {
    id: String(row.place_id),
    google_id: row.google_id ?? null,
    restaurant_name: row.restaurant_name,
    description: row.description ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    zipcode: row.zipcode ?? null,
    latitude: row.latitude != null ? String(row.latitude) : null,
    longitude: row.longitude != null ? String(row.longitude) : null,
    phone: row.phone ?? null,
    website: row.website ?? null,
    category: row.category ?? null,
    price_range: row.price_range ?? null,
    review_points: row.review_points != null ? String(row.review_points) : null,
    reviews: row.reviews != null ? String(row.reviews) : null,
    main_image: row.main_image ?? null,
    image_1: row.image_1 ?? null,
    image_2: row.image_2 ?? null,
    image_3: row.image_3 ?? null,
    page_url: row.page_url ?? null,
    place_id: row.place_id ?? null,
    plus_code: row.plus_code ?? null,
    plus_code_url: row.plus_code_url ?? null,
    delivery: row.delivery ?? null,
    popular_times_monday: row.popular_times_monday ?? null,
    popular_times_tuesday: row.popular_times_tuesday ?? null,
    popular_times_wednesday: row.popular_times_wednesday ?? null,
    popular_times_thursday: row.popular_times_thursday ?? null,
    popular_times_friday: row.popular_times_friday ?? null,
    popular_times_saturday: row.popular_times_saturday ?? null,
    popular_times_sunday: row.popular_times_sunday ?? null,
    open_time_monday: row.open_time_monday ?? null,
    open_time_tuesday: row.open_time_tuesday ?? null,
    open_time_wednesday: row.open_time_wednesday ?? null,
    open_time_thursday: row.open_time_thursday ?? null,
    open_time_friday: row.open_time_friday ?? null,
    open_time_saturday: row.open_time_saturday ?? null,
    open_time_sunday: row.open_time_sunday ?? null,
  } as Restaurant;
}

export async function getRestaurantById(id: string): Promise<Restaurant | undefined> {
  const { data, error } = await supabase.from('restaurants').select(SELECT_RESTAURANT).eq('place_id', id).maybeSingle();
  if (error) throw error;
  return data ? normalize(data) : undefined;
}

export async function listRestaurants(offset = 0, limit = 20): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select(SELECT_RESTAURANT)
    .order('reviews', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function searchRestaurants(query: string, offset = 0, limit = 20): Promise<Restaurant[]> {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const { data, error } = await supabase
    .from('restaurants')
    .select(SELECT_RESTAURANT)
    .or(`restaurant_name.ilike.${like},category.ilike.${like},address.ilike.${like},description.ilike.${like}`)
    .order('reviews', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []).map(normalize);
}

// Lightweight, local-only scoring. Later we can move this logic into a Supabase RPC.
// Inputs: current user interests + onboarding food_restrictions, restaurant name/category/price/rating
export async function scoreRestaurantsForUser(items: Restaurant[]): Promise<Record<string, number>> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return {};
    // Food-specific interests
    const { data: interestsRow } = await supabase
      .from('user_food_interests')
      .select('names')
      .eq('user_id', user.id)
      .maybeSingle();
    const interests: string[] = ((interestsRow?.names as any) ?? []).map((t: string) => t.toLowerCase());
    // Onboarding (food restrictions/preferences)
    const { data: onboard } = await supabase
      .from('user_onboarding')
      .select('food_restrictions, preferences')
      .eq('user_id', user.id)
      .maybeSingle();
    const restrictions: string[] = ((onboard?.food_restrictions as any) ?? []).map((t: string) => t.toLowerCase());
    const prefs = (onboard?.preferences as any) || {};

    const scores: Record<string, number> = {};
  for (const r of items) {
      let s = 50; // baseline
      const text = [r.restaurant_name, r.category].filter(Boolean).join(' ').toLowerCase();
      // Interest match bonus up to +25
      if (interests.length) {
        let hits = 0;
        for (const t of interests) if (t && text.includes(t)) hits += 1;
        if (hits > 0) s += Math.min(25, 8 + hits * 4);
      }
      // Diet compatibility. If restriction found in text (e.g., 'vegan'), boost; if conflict ("meat" vs vegetarian), small penalty
      if (restrictions.length) {
        const hasVegan = /vegan|plant\s*based/.test(text);
        const hasVeg = /vegetarian|veg\b/.test(text);
        if (restrictions.includes('vegan') && hasVegan) s += 12;
        if (restrictions.includes('vegetarian') && (hasVeg || hasVegan)) s += 8;
      }
      // Price preferences (if provided in prefs.price_level: '$', '$$', etc.)
      const userPrice: string | undefined = prefs.price_level;
      if (userPrice && r.price_range) {
        const countDollar = (r.price_range.match(/\$/g) || []).length;
        const desired = (String(userPrice).match(/\$/g) || []).length;
        if (desired && countDollar) {
          const diff = Math.abs(desired - countDollar);
          s += Math.max(-10, 8 - diff * 6);
        }
      }
      // Rating influence (normalize 0-5 as up to +15)
      const rating = r.review_points ? Number(r.review_points) : NaN;
      if (!Number.isNaN(rating)) {
        const clamp = Math.max(0, Math.min(5, rating));
        s += Math.round((clamp / 5) * 15);
      }
      // Clamp 1..99
      s = Math.max(1, Math.min(99, Math.round(s)));
      scores[r.id] = s;
    }
    return scores;
  } catch {
    return {};
  }
}

export async function getTopUserRestaurantMatches(limit = 8): Promise<ScoredRestaurant[]> {
  // Fetch a bounded sample to score locally to avoid heavy queries
  const sample = Math.max(limit * 8, 40); // e.g., limit 10 -> 80 rows
  const { data, error } = await supabase
    .from('restaurants')
    .select(SELECT_RESTAURANT)
    .order('reviews', { ascending: false, nullsFirst: false })
    .limit(sample);
  if (error) throw error;
  const items = (data ?? []).map(normalize);
  const scores = await scoreRestaurantsForUser(items);
  const scored = items
    .map((r) => ({ ...r, match_percent: scores[r.id] }))
    .filter((r) => (r.match_percent ?? 0) > 0)
    .sort((a, b) => (b.match_percent ?? 0) - (a.match_percent ?? 0))
    .slice(0, limit);
  return scored;
}

export async function getTopGroupRestaurantMatches(groupId: number, limit = 8): Promise<ScoredRestaurant[]> {
  // Approximate group score by current user for now (no DB support yet)
  return getTopUserRestaurantMatches(limit);
}

export function restaurantImages(r: Restaurant): string[] {
  const arr = [r.main_image, r.image_1, r.image_2, r.image_3].filter(Boolean) as string[];
  // dedupe while preserving order
  const seen = new Set<string>();
  return arr.filter((u) => {
    const key = u.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
