import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { getEventReports, resolveReport } from '@/services/reports';
import { suspendUser, banUser, unsuspendUser, unbanUser } from '@/services/admin';
import { deleteEvent as adminDeleteEvent } from '@/services/events';
import type { EventReportWithDetails, ReportStatus } from '@/types/models';
import dayjs from 'dayjs';

interface AdminReportsPanelProps {
  isAdmin: boolean;
  onEventDeleted?: () => void;
}

export default function AdminReportsPanel({ isAdmin, onEventDeleted }: AdminReportsPanelProps) {
  const c = useThemeColors();
  const [reports, setReports] = useState<EventReportWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | null>(null);
  const [selectedReport, setSelectedReport] = useState<EventReportWithDetails | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const loadReports = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const data = await getEventReports(statusFilter);
      setReports(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadReports();
    }
  }, [isAdmin, statusFilter]);

  const handleResolveReport = async (reportId: number, status: 'reviewed' | 'resolved') => {
    setActionLoading(reportId);
    try {
      await resolveReport(reportId, status);
      await loadReports();
      Alert.alert('Success', `Report marked as ${status}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resolve report');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteEvent = async (eventId: number, reportId: number) => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(reportId);
            try {
              await adminDeleteEvent(eventId);
              await resolveReport(reportId, 'resolved');
              await loadReports();
              onEventDeleted?.();
              Alert.alert('Success', 'Event deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete event');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleSuspendUser = async (userId: string, reportId: number) => {
    Alert.alert(
      'Suspend User',
      'This user will be able to login but cannot create events. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(reportId);
            try {
              await suspendUser(userId, 'Reported for inappropriate event');
              await resolveReport(reportId, 'reviewed');
              await loadReports();
              Alert.alert('Success', 'User suspended successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to suspend user');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleBanUser = async (userId: string, reportId: number) => {
    Alert.alert(
      'Ban User',
      'This user will be permanently banned and cannot login. This action cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(reportId);
            try {
              await banUser(userId, 'Reported for inappropriate event');
              await resolveReport(reportId, 'reviewed');
              await loadReports();
              Alert.alert('Success', 'User banned successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to ban user');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleUnsuspendUser = async (userId: string) => {
    try {
      await unsuspendUser(userId);
      await loadReports();
      Alert.alert('Success', 'User unsuspended successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to unsuspend user');
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      await unbanUser(userId);
      await loadReports();
      Alert.alert('Success', 'User unbanned successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to unban user');
    }
  };

  if (!isAdmin) return null;

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <View style={{ paddingBottom: 12 }}>
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: '#00000020',
        }}
      >
        <Pressable
          onPress={() => setIsExpanded(!isExpanded)}
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isExpanded ? 12 : 0 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={20}
              color={c.text}
            />
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>
              Admin: View Reports {pendingCount > 0 ? `(${pendingCount} pending)` : ''}
            </Text>
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              loadReports();
            }}
            style={{ padding: 4 }}
          >
            <Ionicons name="refresh" size={20} color={c.text} />
          </Pressable>
        </Pressable>

        {isExpanded && (
          <>
            {/* Status Filter */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {(['pending', 'reviewed', 'resolved', null] as const).map((status) => (
                <Pressable
                  key={status || 'all'}
                  onPress={() => setStatusFilter(status)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: statusFilter === status ? c.primary : '#00000010',
                  }}
                >
                  <Text style={{ color: statusFilter === status ? '#000' : c.text, fontSize: 13, fontWeight: '600' }}>
                    {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'All'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Reports List */}
            {loading ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator color={c.primary} />
              </View>
            ) : reports.length === 0 ? (
              <Text style={{ color: c.muted, textAlign: 'center', padding: 20 }}>No reports found</Text>
            ) : (
              <ScrollView style={{ maxHeight: 600 }}>
                <View style={{ gap: 12 }}>
                  {reports.map((report) => (
                    <View
                      key={report.id}
                      style={{
                        backgroundColor: '#00000010',
                        borderRadius: 8,
                        padding: 12,
                        borderLeftWidth: 3,
                        borderLeftColor:
                          report.status === 'pending' ? '#ff9500' : report.status === 'reviewed' ? '#007aff' : '#34c759',
                      }}
                    >
                      {/* Report Header */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{report.event_title}</Text>
                          <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                            Reported {dayjs(report.created_at).format('MMM D, YYYY h:mm A')}
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor:
                              report.status === 'pending'
                                ? '#ff9500'
                                : report.status === 'reviewed'
                                ? '#007aff'
                                : '#34c759',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
                            {report.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* Event Details */}
                      <View style={{ marginBottom: 8 }}>
                        <Text style={{ color: c.muted, fontSize: 11 }}>Event Creator:</Text>
                        <Text style={{ color: c.text, fontSize: 13 }}>
                          {report.creator_username || report.creator_display_name || 'Unknown'} (
                          {report.event_created_by || 'N/A'})
                        </Text>
                      </View>

                      {/* Reporter Info */}
                      <View style={{ marginBottom: 8 }}>
                        <Text style={{ color: c.muted, fontSize: 11 }}>Reported by:</Text>
                        <Text style={{ color: c.text, fontSize: 13 }}>
                          {report.reporter_username || report.reporter_display_name || 'Unknown'}
                        </Text>
                      </View>

                      {/* Reason */}
                      <View style={{ marginBottom: 8 }}>
                        <Text style={{ color: c.muted, fontSize: 11 }}>Reason:</Text>
                        <Text style={{ color: c.text, fontSize: 13, textTransform: 'capitalize' }}>{report.reason}</Text>
                      </View>

                      {/* Description */}
                      {report.description && (
                        <View style={{ marginBottom: 8 }}>
                          <Text style={{ color: c.muted, fontSize: 11 }}>Description:</Text>
                          <Text style={{ color: c.text, fontSize: 13 }}>{report.description}</Text>
                        </View>
                      )}

                      {/* Actions */}
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        <Pressable
                          onPress={() => setSelectedReport(report)}
                          style={{
                            backgroundColor: c.primary,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 6,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Ionicons name="eye" size={14} color="#000" />
                          <Text style={{ color: '#000', fontSize: 12, fontWeight: '600' }}>View Event</Text>
                        </Pressable>
                        {report.status === 'pending' && (
                          <>
                            <Pressable
                              onPress={() => handleDeleteEvent(report.event_id, report.id)}
                              disabled={actionLoading === report.id}
                              style={{
                                backgroundColor: '#ff3b30',
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 6,
                                opacity: actionLoading === report.id ? 0.5 : 1,
                              }}
                            >
                              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Delete Event</Text>
                            </Pressable>
                            {report.event_created_by && (
                              <>
                                <Pressable
                                  onPress={() => handleSuspendUser(report.event_created_by!, report.id)}
                                  disabled={actionLoading === report.id}
                                  style={{
                                    backgroundColor: '#ff9500',
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    opacity: actionLoading === report.id ? 0.5 : 1,
                                  }}
                                >
                                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Suspend</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => handleBanUser(report.event_created_by!, report.id)}
                                  disabled={actionLoading === report.id}
                                  style={{
                                    backgroundColor: '#8e0000',
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    opacity: actionLoading === report.id ? 0.5 : 1,
                                  }}
                                >
                                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Ban</Text>
                                </Pressable>
                              </>
                            )}
                            <Pressable
                              onPress={() => handleResolveReport(report.id, 'resolved')}
                              disabled={actionLoading === report.id}
                              style={{
                                backgroundColor: '#34c759',
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 6,
                                opacity: actionLoading === report.id ? 0.5 : 1,
                              }}
                            >
                              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Dismiss</Text>
                            </Pressable>
                          </>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </>
        )}
      </View>

      {/* Event Detail Modal */}
      <Modal visible={selectedReport !== null} transparent animationType="fade" onRequestClose={() => setSelectedReport(null)}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          {selectedReport && (
            <View
              style={{
                backgroundColor: c.card,
                borderRadius: 16,
                padding: 20,
                width: '100%',
                maxWidth: 500,
                maxHeight: '80%',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>Event Details</Text>
                <Pressable onPress={() => setSelectedReport(null)}>
                  <Ionicons name="close" size={24} color={c.text} />
                </Pressable>
              </View>
              <ScrollView>
                <Text style={{ color: c.text, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
                  {selectedReport.event_title}
                </Text>
                {selectedReport.event_description && (
                  <Text style={{ color: c.text, fontSize: 14, marginBottom: 12 }}>{selectedReport.event_description}</Text>
                )}
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  Created by: {selectedReport.creator_username || selectedReport.creator_display_name || 'Unknown'}
                </Text>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

