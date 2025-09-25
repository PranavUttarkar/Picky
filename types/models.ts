// Central app models shared across screens and services

export interface UserProfile {
  id: string;
  email: string;
  is_admin?: boolean | null;
}

export interface Event {
  id: number;
  title: string;
  description?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null; // up to 3 image URLs (new multi-image support)
  date_time: string; // ISO string
  location?: string | null;
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
