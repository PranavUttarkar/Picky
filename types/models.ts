// Central app models shared across screens and services

export interface UserProfile {
  id: string;
  email: string;
  username?: string | null;
  display_name?: string | null;
  account_type?: 'personal' | 'organization' | null;
  avatar_url?: string | null;
  is_admin?: boolean | null;
  username_last_changed?: string | null; // server-enforced cooldown timestamp
}

export interface Event {
  id: number;
  title: string;
  description?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null; // up to 3 image URLs (new multi-image support)
  date_time: string; // ISO string
  end_time?: string | null; // ISO string (optional end time)
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  tags?: string[];
  rsvp_url?: string | null;
  created_by?: string;
}

export interface Group {
  id: number;
  name: string;
  invite_code?: string | null;
  created_by?: string;
}

export interface SavedEvent {
  user_id: string;
  event_id: number;
}

// Restaurant/food places used in the new Food browse category
export interface Restaurant {
  // Stable identifier: if stored in DB use numeric id; for JSON seed use place_id hash
  id: string; // prefer place_id; unique
  restaurant_name: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  phone?: string | null;
  website?: string | null;
  category?: string | null; // e.g., "fast food restaurant"
  price_range?: string | null; // e.g., "$1–10"
  review_points?: string | null; // e.g., "3.5"
  reviews?: string | null; // e.g., "1877"
  main_image?: string | null;
  image_1?: string | null;
  image_2?: string | null;
  image_3?: string | null;
  page_url?: string | null;
  place_id?: string | null;
  google_id?: string | null;
  plus_code?: string | null;
  plus_code_url?: string | null;
  delivery?: string | null;
  // Popular times as raw strings per day; optional parsed form is computed client-side
  popular_times_monday?: string | null;
  popular_times_tuesday?: string | null;
  popular_times_wednesday?: string | null;
  popular_times_thursday?: string | null;
  popular_times_friday?: string | null;
  popular_times_saturday?: string | null;
  popular_times_sunday?: string | null;
  open_time_monday?: string | null;
  open_time_tuesday?: string | null;
  open_time_wednesday?: string | null;
  open_time_thursday?: string | null;
  open_time_friday?: string | null;
  open_time_saturday?: string | null;
  open_time_sunday?: string | null;
}

export type ScoredRestaurant = Restaurant & { match_percent?: number };

// Friends system interfaces
export interface Friendship {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
}

export interface UserFollow {
  id: number;
  follower_id: string;
  followed_id: string;
  created_at: string;
}

export interface BlockedUser {
  id: number;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  show_activity_to_friends: boolean;
  show_activity_to_followers: boolean;
  allow_friend_requests: boolean;
  created_at: string;
  updated_at: string;
}

export interface FriendSearchResult {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  account_type: 'personal' | 'organization';
  is_friend: boolean;
  is_blocked: boolean;
}

export interface FriendActivityResult {
  friend_count: number;
  friend_names: string[];
}
