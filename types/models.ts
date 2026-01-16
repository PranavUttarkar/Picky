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
  is_suspended?: boolean | null;
  is_banned?: boolean | null;
  suspended_until?: string | null; // ISO string
  suspension_reason?: string | null;
}

export type EventVisibility = 'public' | 'private';

// Creator info for events (populated via join)
export interface EventCreator {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  account_type?: 'personal' | 'organization' | null;
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
  // Creator info (populated via join)
  creator?: EventCreator | null;
  // Organizer features
  visibility?: EventVisibility;
  capacity?: number | null;
  allow_join_requests?: boolean;
  rsvp_required?: boolean; // Whether RSVP is required to attend
  // Ticket features
  is_ticketed?: boolean;
  ticket_customization?: TicketCustomization | null;
}

// RSVP-related types
export interface UserRSVP {
  attendee_id: number;
  event_id: number;
  status: 'pending' | 'accepted' | 'declined' | 'waitlisted';
  waitlist_position: number | null;
  rsvp_created_at: string;
  responded_at: string | null;
  event_title: string;
  event_description: string | null;
  event_date_time: string;
  event_end_time: string | null;
  event_location: string | null;
  event_image_url: string | null;
  event_image_urls: string[] | null;
  event_visibility: EventVisibility;
  event_capacity: number | null;
  event_rsvp_required: boolean;
  organizer_id: string;
  organizer_username: string | null;
  organizer_display_name: string | null;
  current_attendee_count: number;
  waitlist_count: number;
}

export interface RSVPCounts {
  total_rsvps: number;
  accepted_count: number;
  waitlisted_count: number;
  pending_count: number;
  upcoming_count: number;
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
  friendship_status?: 'accepted' | 'pending_incoming' | 'pending_outgoing' | null;
  is_following?: boolean;
}

export interface FriendActivityResult {
  friend_count: number;
  friend_names: string[];
}

// Event reporting interfaces
export type ReportReason = 'inappropriate' | 'spam' | 'misinformation' | 'other';

export type ReportStatus = 'pending' | 'reviewed' | 'resolved';

export interface EventReport {
  id: number;
  event_id: number;
  reported_by: string;
  reason: ReportReason;
  description?: string | null;
  status: ReportStatus;
  created_at: string; // ISO string
}

export interface EventReportWithDetails extends EventReport {
  event_title: string;
  event_description?: string | null;
  event_created_by?: string | null;
  creator_username?: string | null;
  creator_display_name?: string | null;
  reporter_username?: string | null;
  reporter_display_name?: string | null;
}

// Stripe and Ticket types
export interface OrganizationStripeAccount {
  user_id: string;
  stripe_account_id: string;
  stripe_account_status: 'active' | 'pending' | 'restricted' | 'disabled';
  is_test_mode: boolean;
  connected_at: string;
  updated_at: string;
}

export interface EventTicket {
  id: number;
  event_id: number;
  name: string;
  description?: string | null;
  price_cents: number;
  capacity?: number | null;
  sold_count: number;
  is_early_bird: boolean;
  early_bird_end_date?: string | null;
  early_bird_price_cents?: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface TicketPurchase {
  id: number;
  event_id: number;
  ticket_id: number;
  user_id: string;
  stripe_payment_intent_id?: string | null;
  stripe_checkout_session_id?: string | null;
  amount_paid_cents: number;
  quantity: number;
  status: 'pending' | 'completed' | 'refunded' | 'failed';
  purchased_at?: string | null;
  refunded_at?: string | null;
  created_at: string;
}

export interface TicketCustomization {
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_url?: string;
  ticket_design?: 'standard' | 'minimal' | 'bold';
  show_organizer_branding?: boolean;
}

export interface TicketTierInput {
  name: string;
  description?: string | null;
  price_cents: number;
  capacity?: number | null;
  is_early_bird?: boolean;
  early_bird_end_date?: string | null;
  early_bird_price_cents?: number | null;
  display_order?: number;
}
