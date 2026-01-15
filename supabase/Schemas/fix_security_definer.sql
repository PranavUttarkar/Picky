-- This script modifies the SECURITY DEFINER property to SECURITY INVOKER for the specified views.

-- Change SECURITY DEFINER to SECURITY INVOKER for group_event_scores_v3
CREATE OR REPLACE VIEW public.group_event_scores_v3 AS
SELECT *
FROM public.group_event_scores_v3
;

-- Explicitly set the SECURITY INVOKER property for group_event_scores_v3
ALTER VIEW public.group_event_scores_v3 SET (security_invoker = true);

-- Change SECURITY DEFINER to SECURITY INVOKER for analytics_cta_daily
CREATE OR REPLACE VIEW public.analytics_cta_daily AS
SELECT *
FROM public.analytics_cta_daily
;

-- Explicitly set the SECURITY INVOKER property for analytics_cta_daily
ALTER VIEW public.analytics_cta_daily SET (security_invoker = true);

-- Change SECURITY DEFINER to SECURITY INVOKER for group_event_scores
CREATE OR REPLACE VIEW public.group_event_scores AS
SELECT *
FROM public.group_event_scores
;

-- Explicitly set the SECURITY INVOKER property for group_event_scores
ALTER VIEW public.group_event_scores SET (security_invoker = true);

-- Change SECURITY DEFINER to SECURITY INVOKER for user_event_scores_v3
CREATE OR REPLACE VIEW public.user_event_scores_v3 AS
SELECT *
FROM public.user_event_scores_v3
;

-- Explicitly set the SECURITY INVOKER property for user_event_scores_v3
ALTER VIEW public.user_event_scores_v3 SET (security_invoker = true);

-- Change SECURITY DEFINER to SECURITY INVOKER for user_event_scores
CREATE OR REPLACE VIEW public.user_event_scores AS
SELECT *
FROM public.user_event_scores
;

-- Explicitly set the SECURITY INVOKER property for user_event_scores
ALTER VIEW public.user_event_scores SET (security_invoker = true);

-- Change SECURITY DEFINER to SECURITY INVOKER for user_event_scores_v2
CREATE OR REPLACE VIEW public.user_event_scores_v2 AS
SELECT *
FROM public.user_event_scores_v2
;

-- Explicitly set the SECURITY INVOKER property for user_event_scores_v2
ALTER VIEW public.user_event_scores_v2 SET (security_invoker = true);

-- Change SECURITY DEFINER to SECURITY INVOKER for group_event_scores_v2
CREATE OR REPLACE VIEW public.group_event_scores_v2 AS
SELECT *
FROM public.group_event_scores_v2
;

-- Explicitly set the SECURITY INVOKER property for group_event_scores_v2
ALTER VIEW public.group_event_scores_v2 SET (security_invoker = true);

-- Change SECURITY DEFINER to SECURITY INVOKER for analytics_shares_daily
CREATE OR REPLACE VIEW public.analytics_shares_daily AS
SELECT *
FROM public.analytics_shares_daily
;

-- Explicitly set the SECURITY INVOKER property for analytics_shares_daily
ALTER VIEW public.analytics_shares_daily SET (security_invoker = true);

-- Change SECURITY DEFINER to SECURITY INVOKER for analytics_screen_views_daily
CREATE OR REPLACE VIEW public.analytics_screen_views_daily AS
SELECT *
FROM public.analytics_screen_views_daily
;

-- Explicitly set the SECURITY INVOKER property for analytics_screen_views_daily
ALTER VIEW public.analytics_screen_views_daily SET (security_invoker = true);

-- Change SECURITY DEFINER to SECURITY INVOKER for group_interest_names
CREATE OR REPLACE VIEW public.group_interest_names AS
SELECT *
FROM public.group_interest_names
;

-- Explicitly set the SECURITY INVOKER property for group_interest_names
ALTER VIEW public.group_interest_names SET (security_invoker = true);

-- Change SECURITY DEFINER to SECURITY INVOKER for user_interest_names
CREATE OR REPLACE VIEW public.user_interest_names AS
SELECT *
FROM public.user_interest_names
;

-- Explicitly set the SECURITY INVOKER property for user_interest_names
ALTER VIEW public.user_interest_names SET (security_invoker = true);

-- Change SECURITY DEFINER to SECURITY INVOKER for analytics_events_daily_counts
CREATE OR REPLACE VIEW public.analytics_events_daily_counts AS
SELECT *
FROM public.analytics_events_daily_counts
;

-- Explicitly set the SECURITY INVOKER property for analytics_events_daily_counts
ALTER VIEW public.analytics_events_daily_counts SET (security_invoker = true);

-- Change SECURITY DEFINER to SECURITY INVOKER for analytics_active_users_daily
CREATE OR REPLACE VIEW public.analytics_active_users_daily AS
SELECT *
FROM public.analytics_active_users_daily
;

-- Explicitly set the SECURITY INVOKER property for analytics_active_users_daily
ALTER VIEW public.analytics_active_users_daily SET (security_invoker = true);