import { supabase } from '@/services/supabase';
import type { EventReport, EventReportWithDetails, ReportReason, ReportStatus } from '@/types/models';

/**
 * Report an event with a reason and optional description
 */
export async function reportEvent(
  eventId: number,
  reason: ReportReason,
  description?: string | null
): Promise<EventReport> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('event_reports')
    .insert({
      event_id: eventId,
      reported_by: auth.user.id,
      reason,
      description: description?.trim() || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation (duplicate report)
    if (error.code === '23505') {
      throw new Error('You have already reported this event');
    }
    throw error;
  }

  return data as EventReport;
}

/**
 * Get event reports with details (admin only)
 * @param status Optional filter by status
 */
export async function getEventReports(status?: ReportStatus | null): Promise<EventReportWithDetails[]> {
  const { data, error } = await supabase.rpc('get_event_reports_with_details', {
    p_status: status || null,
  });

  if (error) throw error;
  
  // Map report_id to id to match the TypeScript interface
  return (data ?? []).map((row: any) => ({
    id: row.report_id,
    event_id: row.event_id,
    reported_by: row.reported_by,
    reason: row.reason,
    description: row.description,
    status: row.status,
    created_at: row.created_at,
    event_title: row.event_title,
    event_description: row.event_description,
    event_created_by: row.event_created_by,
    creator_username: row.creator_username,
    creator_display_name: row.creator_display_name,
    reporter_username: row.reporter_username,
    reporter_display_name: row.reporter_display_name,
  })) as EventReportWithDetails[];
}

/**
 * Resolve a report (mark as reviewed or resolved)
 */
export async function resolveReport(reportId: number, status: 'reviewed' | 'resolved'): Promise<void> {
  const { error } = await supabase
    .from('event_reports')
    .update({ status })
    .eq('id', reportId);

  if (error) throw error;
}

/**
 * Get all reports for a specific user (admin only)
 */
export async function getUserReports(userId: string): Promise<EventReportWithDetails[]> {
  const { data, error } = await supabase
    .from('event_reports')
    .select(`
      *,
      events!inner(id, title, description, created_by),
      reporter:users!reported_by(username, display_name),
      creator:users!events.created_by(username, display_name)
    `)
    .eq('reported_by', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Transform the data to match EventReportWithDetails format
  return (data ?? []).map((report: any) => ({
    id: report.id,
    event_id: report.event_id,
    reported_by: report.reported_by,
    reason: report.reason,
    description: report.description,
    status: report.status,
    created_at: report.created_at,
    event_title: report.events?.title || '',
    event_description: report.events?.description || null,
    event_created_by: report.events?.created_by || null,
    creator_username: report.creator?.username || null,
    creator_display_name: report.creator?.display_name || null,
    reporter_username: report.reporter?.username || null,
    reporter_display_name: report.reporter?.display_name || null,
  })) as EventReportWithDetails[];
}

