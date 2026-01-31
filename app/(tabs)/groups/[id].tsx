import { View, Text, Pressable, FlatList, Alert, Platform, KeyboardAvoidingView, ActivityIndicator, ActionSheetIOS } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useLocalSearchParams, router } from 'expo-router';
import { regenerateInviteCode } from '@/services/groups';
import { shareGroup } from '@/utils/share';
import Avatar from '@/components/Avatar';
import InlinePollCreator from '@/components/InlinePollCreator';
import { castTextVote, castVote, suggestLeader } from '@/services/polls';
import type { Event } from '@/types/models';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import MessageBubble, { DateSeparator } from '@/components/MessageBubble';
import MessageInput from '@/components/MessageInput';
import { 
  getGroupMessages, 
  sendMessage, 
  deleteMessage,
  toggleMessageReaction,
  subscribeToGroupMessages,
  type GroupMessage,
  type MessageReaction as MessageReactionType 
} from '@/services/messages';

// Reaction types
type ReactionType = 'thumbs_up' | 'thumbs_down' | 'love' | 'meh';

const REACTION_EMOJIS: Record<ReactionType, string> = {
  thumbs_up: '👍',
  thumbs_down: '👎',
  love: '❤️',
  meh: '😐',
};

interface PollReaction {
  poll_id: number;
  user_id: string;
  reaction: ReactionType;
  user?: {
    id: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  };
}

interface PollMessage {
  id: number;
  created_at: string;
  is_active: boolean;
  title: string | null;
  deadline_at: string | null;
  final_event_id: number | null;
  created_by: string;
  mode?: 'single' | 'rating'; // rating mode for Quick Pick swipe voting
  creator?: {
    id: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  };
  options?: Array<{
    id: number;
    text?: string;
    event_id?: number;
    votes: number;
    // Rating mode fields for Quick Pick scoring
    love_it?: number;    // +1 swipes (yes)
    fine?: number;       // 0 swipes (maybe)
    not_for_me?: number; // -1 swipes (no)
    score?: number;      // Calculated score: love_it - not_for_me
  }>;
  votes?: Array<{
    user_id: string;
    option_id: number;
    user?: {
      id: string;
      username?: string | null;
      display_name?: string | null;
      avatar_url?: string | null;
    };
  }>;
  // For rating mode: track users who have completed all ratings
  ratingParticipants?: string[];
  reactions?: PollReaction[];
}

interface GroupMember {
  user_id: string;
  user?: {
    id: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  };
}

// Helper to parse Quick Pick encoded option text
const parseOptionText = (text: string): { displayText: string; type: 'food' | 'event' | 'text'; emoji: string } => {
  // Match [FOOD:id]Name pattern
  const foodMatch = text.match(/^\[FOOD:[^\]]+\](.+)$/);
  if (foodMatch) {
    return { displayText: foodMatch[1].trim(), type: 'food', emoji: '🍕' };
  }
  
  // Match [EVENT:id]Name pattern  
  const eventMatch = text.match(/^\[EVENT:\d+\](.+)$/);
  if (eventMatch) {
    return { displayText: eventMatch[1].trim(), type: 'event', emoji: '🎉' };
  }
  
  // Plain text
  return { displayText: text, type: 'text', emoji: '' };
};

// Combined message/poll item type for rendering
type ChatItem = 
  | { type: 'message'; data: GroupMessage }
  | { type: 'poll'; data: PollMessage }
  | { type: 'date'; data: string };

export default function GroupChat() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);
  const [group, setGroup] = useState<any>(null);
  const [polls, setPolls] = useState<PollMessage[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [winnersById, setWinnersById] = useState<Record<number, Event>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [regenCooldown, setRegenCooldown] = useState<number>(0);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const regenTimerRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const prevItemsCountRef = useRef<number>(0);
  // Track current scroll offset so we can restore it when reply is clicked
  const scrollOffsetRef = useRef(0);
  const userAtBottomRef = useRef(true);
  const handleListScroll = (e: any) => {
    try {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      scrollOffsetRef.current = contentOffset.y;
      const distanceFromBottom = (contentSize?.height ?? 0) - (contentOffset.y + (layoutMeasurement?.height ?? 0));
      userAtBottomRef.current = distanceFromBottom <= 100;
    } catch {}
  };
  const [reactingPollId, setReactingPollId] = useState<number | null>(null);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [votingOptionId, setVotingOptionId] = useState<{ pollId: number; optionId: number } | null>(null);
  const [myVotes, setMyVotes] = useState<Record<number, number>>({}); // pollId -> optionId

  // Load group data, polls with creators, and members
  useEffect(() => {
    let mounted = true;
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        router.replace('/onboarding/welcome');
        return;
      }
      setCurrentUserId(user.id);

      // Fetch group
      const { data: g } = await supabase.from('groups').select('*').eq('id', groupId).single();
      
      // Fetch polls with creator info (include mode for Quick Pick rating detection)
      const { data: pollsData } = await supabase
        .from('polls')
        .select(`
          id,
          created_at,
          is_active,
          title,
          deadline_at,
          final_event_id,
          created_by,
          mode
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      // Fetch group members with profiles
      const { data: membersData } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

      if (!mounted) return;
      setGroup(g);

      // Fetch creator profiles for polls
      if (pollsData && pollsData.length > 0) {
        const creatorIds = [...new Set(pollsData.map(p => p.created_by).filter(Boolean))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', creatorIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        const pollsWithCreators = pollsData.map(poll => ({
          ...poll,
          creator: profileMap.get(poll.created_by) || undefined,
        }));

        // Fetch poll options and votes for each poll
        const pollsWithDetails = await Promise.all(pollsWithCreators.map(async (poll) => {
          // Try to get text options first
          const { data: textOptions } = await supabase
            .from('poll_text_options')
            .select('id, text')
            .eq('poll_id', poll.id);

          // Get text votes
          const { data: textVotes } = await supabase
            .from('poll_text_votes')
            .select('user_id, option_id')
            .eq('poll_id', poll.id);

          // If no text options, try event options
          let options: any[] = [];
          let votes: any[] = [];
          let ratingParticipants: string[] = [];

          if (textOptions && textOptions.length > 0) {
            const voteCountMap = new Map<number, number>();
            textVotes?.forEach(v => {
              voteCountMap.set(v.option_id, (voteCountMap.get(v.option_id) || 0) + 1);
            });
            options = textOptions.map(o => ({
              id: o.id,
              text: o.text,
              votes: voteCountMap.get(o.id) || 0,
            }));
            votes = textVotes || [];
          } else {
            // Try event-based poll options
            const { data: eventOptions } = await supabase
              .from('poll_options')
              .select('poll_id, event_id')
              .eq('poll_id', poll.id);

            const { data: eventVotes } = await supabase
              .from('poll_votes')
              .select('user_id, event_id')
              .eq('poll_id', poll.id);

            if (eventOptions && eventOptions.length > 0) {
              const voteCountMap = new Map<number, number>();
              eventVotes?.forEach(v => {
                if (v.event_id) {
                  voteCountMap.set(v.event_id, (voteCountMap.get(v.event_id) || 0) + 1);
                }
              });
              
              // Fetch event details
              const eventIds = eventOptions.map(o => o.event_id).filter(Boolean);
              const { data: events } = await supabase
                .from('events')
                .select('id, title')
                .in('id', eventIds);
              
              const eventMap = new Map(events?.map(e => [e.id, e]) || []);
              
              // For rating mode (Quick Pick), fetch poll_ratings to calculate scores
              let ratingAggregates = new Map<number, { love_it: number; fine: number; not_for_me: number }>();
              
              if ((poll as any).mode === 'rating') {
                const { data: ratingsData } = await supabase
                  .from('poll_ratings')
                  .select('event_id, user_id, rating')
                  .eq('poll_id', poll.id);
                
                if (ratingsData && ratingsData.length > 0) {
                  // Aggregate ratings by event
                  for (const r of ratingsData) {
                    const eid = r.event_id;
                    if (!ratingAggregates.has(eid)) {
                      ratingAggregates.set(eid, { love_it: 0, fine: 0, not_for_me: 0 });
                    }
                    const agg = ratingAggregates.get(eid)!;
                    if (r.rating === 1) agg.love_it++;
                    else if (r.rating === 0) agg.fine++;
                    else if (r.rating === -1) agg.not_for_me++;
                  }
                  
                  // Determine which users have completed voting (rated all options)
                  const userRatingCounts = new Map<string, Set<number>>();
                  for (const r of ratingsData) {
                    if (!userRatingCounts.has(r.user_id)) {
                      userRatingCounts.set(r.user_id, new Set());
                    }
                    userRatingCounts.get(r.user_id)!.add(r.event_id);
                  }
                  const optionCount = eventOptions.length;
                  ratingParticipants = Array.from(userRatingCounts.entries())
                    .filter(([, ratedEvents]) => ratedEvents.size >= optionCount)
                    .map(([userId]) => userId);
                }
              }
              
              options = eventOptions.map(o => {
                const agg = ratingAggregates.get(o.event_id!);
                // Calculate score: love_it (+1) - not_for_me (-1), fine is neutral (0)
                const score = agg ? (agg.love_it - agg.not_for_me) : 0;
                return {
                  id: o.event_id,
                  text: eventMap.get(o.event_id)?.title || `Event #${o.event_id}`,
                  event_id: o.event_id,
                  votes: (poll as any).mode === 'rating' ? score : (voteCountMap.get(o.event_id!) || 0),
                  love_it: agg?.love_it || 0,
                  fine: agg?.fine || 0,
                  not_for_me: agg?.not_for_me || 0,
                  score: score,
                };
              });
              
              // For rating mode, use ratingParticipants as voters
              if ((poll as any).mode === 'rating' && ratingParticipants.length > 0) {
                votes = ratingParticipants.map(uid => ({ user_id: uid, option_id: 0 }));
              } else {
                votes = (eventVotes || []).map(v => ({ user_id: v.user_id, option_id: v.event_id }));
              }
            }
          }

          // Fetch voter profiles
          const voterIds = [...new Set(votes.map((v: any) => v.user_id))];
          const { data: voterProfiles } = voterIds.length > 0 
            ? await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', voterIds)
            : { data: [] };
          
          const voterMap = new Map(voterProfiles?.map(p => [p.id, p]) || []);
          const votesWithProfiles = votes.map((v: any) => ({
            ...v,
            user: voterMap.get(v.user_id),
          }));

          // Fetch reactions for this poll
          const { data: reactionsData } = await supabase
            .from('poll_reactions')
            .select('poll_id, user_id, reaction')
            .eq('poll_id', poll.id);

          let reactionsWithProfiles: PollReaction[] = [];
          if (reactionsData && reactionsData.length > 0) {
            const reactorIds = [...new Set(reactionsData.map(r => r.user_id))];
            const { data: reactorProfiles } = await supabase
              .from('profiles')
              .select('id, username, display_name, avatar_url')
              .in('id', reactorIds);
            
            const reactorMap = new Map(reactorProfiles?.map(p => [p.id, p]) || []);
            reactionsWithProfiles = reactionsData.map(r => ({
              ...r,
              reaction: r.reaction as ReactionType,
              user: reactorMap.get(r.user_id),
            }));
          }

          return {
            ...poll,
            options,
            votes: votesWithProfiles,
            reactions: reactionsWithProfiles,
            ratingParticipants,
          };
        }));

        setPolls(pollsWithDetails);
      } else {
        setPolls([]);
      }

      // Fetch member profiles
      if (membersData && membersData.length > 0) {
        const memberIds = membersData.map(m => m.user_id);
        const { data: memberProfiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', memberIds);

        const memberProfileMap = new Map(memberProfiles?.map(p => [p.id, p]) || []);
        const membersWithProfiles = membersData.map(m => ({
          ...m,
          user: memberProfileMap.get(m.user_id),
        }));
        setMembers(membersWithProfiles);
      }

      // Fetch messages
      try {
        const msgs = await getGroupMessages(groupId, 100);
        if (mounted) setMessages(msgs);
      } catch (error) {
        console.error('Failed to load messages:', error);
      }

      // Set up realtime subscriptions
      const pollChannel = supabase
        .channel(`group-${groupId}-polls-chat`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'polls', filter: `group_id=eq.${groupId}` },
          async () => {
            // Refetch polls on any change - just reload the page for simplicity
            if (mounted) {
              router.replace(`/(tabs)/groups/${groupId}`);
            }
          },
        )
        .subscribe();

      const groupChannel = supabase
        .channel(`group-${groupId}-row-chat`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` },
          async () => {
            const { data: g2 } = await supabase
              .from('groups')
              .select('*')
              .eq('id', groupId)
              .single();
            if (mounted) setGroup(g2);
          },
        )
        .subscribe();

      // Subscribe to messages
      const messageChannel = subscribeToGroupMessages(
        groupId,
        (newMessage) => {
          if (mounted) {
            // Check if this message was sent by us (optimistically added)
            setMessages(prev => {
              // Skip if we already have this message (from optimistic update)
              const existingById = prev.find(m => m.id === newMessage.id);
              if (existingById) {
                // Update the existing message with server data (in case we had optimistic)
                return prev.map(m => m.id === newMessage.id ? { ...newMessage, reactions: m.reactions || [] } : m);
              }
              
              // Check if this is a message we sent (by matching user_id and message content within last 5 seconds)
              const now = new Date().getTime();
              const messageTime = new Date(newMessage.created_at).getTime();
              const isRecent = (now - messageTime) < 5000;
              
              // Check for optimistic duplicates (negative IDs from our optimistic updates)
              const hasOptimisticVersion = prev.some(m => 
                m.id < 0 && 
                m.user_id === newMessage.user_id && 
                m.message === newMessage.message &&
                isRecent
              );
              
              if (hasOptimisticVersion) {
                // Replace the optimistic message with the real one
                return prev.map(m => 
                  (m.id < 0 && m.user_id === newMessage.user_id && m.message === newMessage.message)
                    ? { ...newMessage, reactions: [] }
                    : m
                );
              }
              
              // This is a new message from another user, add it
              return [...prev, newMessage];
            });
            
            // Scroll to bottom if user is at bottom or if this is our message
            setTimeout(() => {
              try {
                if (newMessage.user_id === currentUserId || userAtBottomRef.current) {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }
              } catch {}
            }, 100);
          }
        },
        (reaction) => {
          if (mounted) {
            setMessages(prev => prev.map(msg => {
              if (msg.id === reaction.message_id) {
                const existingReactions = msg.reactions || [];
                
                // Check if we already have this exact reaction (from optimistic update)
                const hasExactMatch = existingReactions.some(
                  r => r.user_id === reaction.user_id && r.emoji === reaction.emoji && r.id > 0
                );
                
                // If we have an optimistic version (negative id), replace it with server version
                const hasOptimisticVersion = existingReactions.some(
                  r => r.user_id === reaction.user_id && r.emoji === reaction.emoji && r.id < 0
                );
                
                if (hasOptimisticVersion) {
                  // Replace optimistic with real
                  return {
                    ...msg,
                    reactions: existingReactions.map(r => 
                      (r.user_id === reaction.user_id && r.emoji === reaction.emoji && r.id < 0)
                        ? reaction
                        : r
                    ),
                  };
                }
                
                if (hasExactMatch) {
                  // Already have this reaction, skip
                  return msg;
                }
                
                // Check if this is a DELETE event (reaction being removed)
                // We signal deletion with id === 0 from the messages service
                const existingIndex = existingReactions.findIndex(
                  r => r.user_id === reaction.user_id && r.emoji === reaction.emoji
                );
                
                if (existingIndex >= 0) {
                  // Check if this is a deletion signal (id === 0) or just a duplicate
                  if (reaction.id === 0) {
                    // This is a DELETE event, remove the reaction
                    return {
                      ...msg,
                      reactions: existingReactions.filter((_, i) => i !== existingIndex),
                    };
                  }
                  // Already have this reaction (maybe from optimistic), skip adding again
                  return msg;
                } else {
                  // This is a new reaction, check it's not a deletion signal
                  if (reaction.id === 0) {
                    // Already removed (probably from optimistic update), skip
                    return msg;
                  }
                  // Add reaction from another user
                  return {
                    ...msg,
                    reactions: [...existingReactions, reaction],
                  };
                }
              }
              return msg;
            }));
          }
        },
        (deletedId) => {
          if (mounted) {
            setMessages(prev => prev.filter(m => m.id !== deletedId));
          }
        }
      );

      // Polling fallback: periodically fetch latest messages and append any missing.
      // This covers cases where realtime events fail to arrive.
      const pollInterval = setInterval(async () => {
        try {
          const latest = await getGroupMessages(groupId, 100);
          if (!mounted) return;
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const toAdd = latest.filter(m => !existingIds.has(m.id));
            if (toAdd.length === 0) return prev;
            const next = [...prev, ...toAdd];
            // If user is at bottom, scroll to show new messages
            setTimeout(() => {
              try {
                if (userAtBottomRef.current) flatListRef.current?.scrollToEnd({ animated: true });
              } catch {}
            }, 120);
            return next;
          });
        } catch (e) {
          // ignore polling errors
        }
      }, 3000);

      return () => {
        supabase.removeChannel(pollChannel);
        supabase.removeChannel(groupChannel);
        supabase.removeChannel(messageChannel);
        try {
          clearInterval(pollInterval);
        } catch {}
      };
    })();
    return () => {
      mounted = false;
    };
  }, [groupId]);

  // Fetch winner events for any polls that have final_event_id
  useEffect(() => {
    (async () => {
      const ids = Array.from(new Set(polls.map((p) => p.final_event_id).filter(Boolean)));
      const missing = ids.filter((id) => !winnersById[id!]);
      if (!missing.length) return;
      const { data } = await supabase
        .from('events')
        .select('id,title,description,location,date_time,image_url,image_urls,tags,rsvp_url')
        .in('id', missing as number[]);
      if (data && data.length) {
        setWinnersById((prev) => {
          const next = { ...prev };
          for (const ev of data as Event[]) next[ev.id] = ev;
          return next;
        });
      }
    })();
  }, [polls]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      try {
        if (regenTimerRef.current) clearInterval(regenTimerRef.current);
      } catch {}
    };
  }, []);

  const onRegenerate = async () => {
    try {
      if (regenCooldown > 0) {
        Alert.alert('Please wait', `You can regenerate again in ${regenCooldown}s`);
        return;
      }
      const code = await regenerateInviteCode(groupId);
      setGroup((prev: any) => ({ ...prev, invite_code: code }));
      Alert.alert('Invite code regenerated', code);
      setRegenCooldown(30);
      regenTimerRef.current = setInterval(() => {
        setRegenCooldown((s) => {
          if (s <= 1) {
            if (regenTimerRef.current) clearInterval(regenTimerRef.current);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (e: any) {
      Alert.alert('Not allowed', e.message ?? String(e));
    }
  };

  const onCopy = async () => {
    try {
      if (!group?.invite_code) return;
      const code = group.invite_code as string;
      if (Platform.OS === 'web' && (globalThis as any).navigator?.clipboard?.writeText) {
        await (globalThis as any).navigator.clipboard.writeText(code);
      } else {
        await Clipboard.setStringAsync(code);
      }
      Alert.alert('Copied', 'Invite code copied to clipboard');
    } catch (e: any) {
      Alert.alert('Copy failed', e?.message ?? String(e));
    }
  };

  const onShare = async () => {
    try {
      if (!group?.invite_code) {
        const code = await regenerateInviteCode(groupId);
        setGroup((prev: any) => ({ ...prev, invite_code: code }));
      }
      await shareGroup({ name: group?.name, invite_code: group.invite_code });
    } catch (e: any) {
      Alert.alert('Share failed', e?.message ?? String(e));
    }
  };

  // Toggle reaction on a poll
  const toggleReaction = async (pollId: number, reaction: ReactionType) => {
    if (!currentUserId) return;
    
    try {
      // Find existing reaction
      const poll = polls.find(p => p.id === pollId);
      const existingReaction = poll?.reactions?.find(r => r.user_id === currentUserId);
      
      if (existingReaction?.reaction === reaction) {
        // Remove reaction if clicking the same one
        await supabase
          .from('poll_reactions')
          .delete()
          .eq('poll_id', pollId)
          .eq('user_id', currentUserId);
        
        // Update local state
        setPolls(prev => prev.map(p => {
          if (p.id !== pollId) return p;
          return {
            ...p,
            reactions: p.reactions?.filter(r => r.user_id !== currentUserId) || [],
          };
        }));
      } else {
        // Upsert the reaction
        await supabase
          .from('poll_reactions')
          .upsert({
            poll_id: pollId,
            user_id: currentUserId,
            reaction,
          }, { onConflict: 'poll_id,user_id' });
        
        // Update local state
        setPolls(prev => prev.map(p => {
          if (p.id !== pollId) return p;
          const otherReactions = p.reactions?.filter(r => r.user_id !== currentUserId) || [];
          return {
            ...p,
            reactions: [...otherReactions, { poll_id: pollId, user_id: currentUserId, reaction }],
          };
        }));
      }
      
      setReactingPollId(null);
    } catch (e: any) {
      console.error('Failed to toggle reaction:', e);
    }
  };

  // Get reaction counts for a poll
  const getReactionCounts = (poll: PollMessage): Record<ReactionType, number> => {
    const counts: Record<ReactionType, number> = {
      thumbs_up: 0,
      thumbs_down: 0,
      love: 0,
      meh: 0,
    };
    poll.reactions?.forEach(r => {
      if (counts[r.reaction] !== undefined) {
        counts[r.reaction]++;
      }
    });
    return counts;
  };

  // Get current user's reaction on a poll
  const getMyReaction = (poll: PollMessage): ReactionType | null => {
    return poll.reactions?.find(r => r.user_id === currentUserId)?.reaction || null;
  };

  const getTotalVotes = (poll: PollMessage) => {
    return poll.options?.reduce((sum, opt) => sum + opt.votes, 0) || 0;
  };

  const getVotersForOption = (poll: PollMessage, optionId: number) => {
    return poll.votes?.filter(v => v.option_id === optionId) || [];
  };

  // Find the current leader option for a poll
  const getCurrentLeader = (poll: PollMessage) => {
    if (!poll.options || poll.options.length === 0) return null;
    const sorted = [...poll.options].sort((a, b) => b.votes - a.votes);
    if (sorted[0].votes === 0) return null;
    return sorted[0];
  };

  // Handle inline voting
  const handleInlineVote = async (poll: PollMessage, optionId: number, isEventOption: boolean) => {
    if (!poll.is_active || !currentUserId) return;
    
    // Check if already voted for this option
    const currentVote = myVotes[poll.id];
    if (currentVote === optionId) return; // Already voted for this
    
    setVotingOptionId({ pollId: poll.id, optionId });
    
    try {
      if (isEventOption) {
        await castVote(poll.id, optionId);
      } else {
        await castTextVote(poll.id, optionId);
      }
      
      // Update local state
      setMyVotes(prev => ({ ...prev, [poll.id]: optionId }));
      
      // Update poll options locally
      setPolls(prev => prev.map(p => {
        if (p.id !== poll.id) return p;
        return {
          ...p,
          options: p.options?.map(opt => ({
            ...opt,
            votes: opt.id === optionId 
              ? opt.votes + 1 
              : (currentVote === opt.id ? opt.votes - 1 : opt.votes),
          })),
          votes: [
            ...(p.votes?.filter(v => v.user_id !== currentUserId) || []),
            { user_id: currentUserId, option_id: optionId },
          ],
        };
      }));
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (e: any) {
      Alert.alert('Vote failed', e.message ?? String(e));
    } finally {
      setVotingOptionId(null);
    }
  };

  // Generate a unique optimistic ID for new messages
  const generateOptimisticId = useCallback(() => {
    return -(Date.now() + Math.floor(Math.random() * 10000));
  }, []);

  // Track pending optimistic message IDs to prevent duplicates when realtime fires
  const pendingMessageIds = useRef<Set<number>>(new Set());

  // Message handlers
  const handleSendMessage = async (text: string) => {
    if (!currentUserId || !text.trim()) return;

    // Get current user's profile from members
    const currentMember = members.find(m => m.user_id === currentUserId);
    const userProfile = currentMember?.user;

    // Create optimistic message
    const optimisticId = generateOptimisticId();
    const optimisticMessage: GroupMessage = {
      id: optimisticId,
      group_id: groupId,
      user_id: currentUserId,
      message: text.trim(),
      created_at: new Date().toISOString(),
      updated_at: null,
      deleted_at: null,
      is_edited: false,
      reply_to_id: replyTo?.id || null,
      user: userProfile ? {
        id: userProfile.id,
        username: userProfile.username,
        display_name: userProfile.display_name,
        avatar_url: userProfile.avatar_url,
      } : {
        id: currentUserId,
        username: null,
        display_name: null,
        avatar_url: null,
      },
      reactions: [],
      reply_to: replyTo ? {
        id: replyTo.id,
        message: replyTo.message,
        user_id: replyTo.user_id,
        user: replyTo.user,
      } : undefined,
    };

    // Mark this as pending to prevent duplicate from realtime
    pendingMessageIds.current.add(optimisticId);

    // Optimistically add message to state immediately
    setMessages(prev => [...prev, optimisticMessage]);
    setReplyTo(null);

    // Scroll to bottom immediately
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      // Send message to server
      const serverMessage = await sendMessage(groupId, text.trim(), replyTo?.id);
      
      // Replace optimistic message with server message
      setMessages(prev => prev.map(msg => 
        msg.id === optimisticId ? { ...serverMessage, reactions: [] } : msg
      ));
      
      // Mark the server message ID as "ours" to prevent duplicate from realtime
      pendingMessageIds.current.add(serverMessage.id);
      
      // Clean up pending IDs after a short delay
      setTimeout(() => {
        pendingMessageIds.current.delete(optimisticId);
        pendingMessageIds.current.delete(serverMessage.id);
      }, 2000);
    } catch (error: any) {
      // Rollback: remove the optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
      pendingMessageIds.current.delete(optimisticId);
      Alert.alert('Failed to send message', error.message || String(error));
    }
  };

  const handleMessageLongPress = (message: GroupMessage) => {
    if (Platform.OS === 'ios') {
      const options = ['Reply', 'Copy', 'Cancel'];
      if (message.user_id === currentUserId) {
        options.splice(2, 0, 'Delete');
      }

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: message.user_id === currentUserId ? 3 : undefined,
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) {
            // Reply
            setReplyTo(message);
          } else if (buttonIndex === 1) {
            // Copy
            if (Platform.OS === 'web' && (globalThis as any).navigator?.clipboard?.writeText) {
              await (globalThis as any).navigator.clipboard.writeText(message.message);
            } else {
              await Clipboard.setStringAsync(message.message);
            }
          } else if (buttonIndex === 3 && message.user_id === currentUserId) {
            // Delete
            try {
              await deleteMessage(message.id);
            } catch (error: any) {
              Alert.alert('Failed to delete', error.message || String(error));
            }
          }
        }
      );
    } else {
      // Android/Web - show custom action sheet
      setSelectedMessageId(message.id);
      Alert.alert(
        'Message Actions',
        '',
        [
          { text: 'Reply', onPress: () => setReplyTo(message) },
          {
            text: 'Copy',
            onPress: async () => {
              if (Platform.OS === 'web' && (globalThis as any).navigator?.clipboard?.writeText) {
                await (globalThis as any).navigator.clipboard.writeText(message.message);
              } else {
                await Clipboard.setStringAsync(message.message);
              }
            },
          },
          ...(message.user_id === currentUserId
            ? [
                {
                  text: 'Delete',
                  onPress: async () => {
                    try {
                      await deleteMessage(message.id);
                    } catch (error: any) {
                      Alert.alert('Failed to delete', error.message || String(error));
                    }
                  },
                  style: 'destructive' as const,
                },
              ]
            : []),
          { text: 'Cancel', style: 'cancel' as const },
        ]
      );
    }
  };

  const handleMessageReaction = async (messageId: number, emoji: string) => {
    if (!currentUserId) return;

    // Get current user's profile from members
    const currentMember = members.find(m => m.user_id === currentUserId);
    const userProfile = currentMember?.user;

    // Optimistically update reactions
    let wasRemoved = false;
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg;
      
      const existingReactions = msg.reactions || [];
      const existingIndex = existingReactions.findIndex(
        r => r.user_id === currentUserId && r.emoji === emoji
      );

      if (existingIndex >= 0) {
        // Remove reaction optimistically
        wasRemoved = true;
        return {
          ...msg,
          reactions: existingReactions.filter((_, i) => i !== existingIndex),
        };
      } else {
        // Add reaction optimistically
        const newReaction = {
          id: -(Date.now() + Math.floor(Math.random() * 10000)), // Optimistic ID
          message_id: messageId,
          user_id: currentUserId,
          emoji,
          created_at: new Date().toISOString(),
          user: userProfile ? {
            id: userProfile.id,
            username: userProfile.username,
            display_name: userProfile.display_name,
            avatar_url: userProfile.avatar_url,
          } : undefined,
        };
        return {
          ...msg,
          reactions: [...existingReactions, newReaction],
        };
      }
    }));

    try {
      await toggleMessageReaction(messageId, emoji);
      // Server confirmed - reaction will be updated via realtime if needed
    } catch (error: any) {
      // Rollback: revert the optimistic update
      setMessages(prev => prev.map(msg => {
        if (msg.id !== messageId) return msg;
        
        const existingReactions = msg.reactions || [];
        
        if (wasRemoved) {
          // Re-add the reaction that we optimistically removed
          return {
            ...msg,
            reactions: [...existingReactions, {
              id: -(Date.now()),
              message_id: messageId,
              user_id: currentUserId,
              emoji,
              created_at: new Date().toISOString(),
              user: userProfile ? {
                id: userProfile.id,
                username: userProfile.username,
                display_name: userProfile.display_name,
                avatar_url: userProfile.avatar_url,
              } : undefined,
            }],
          };
        } else {
          // Remove the reaction we optimistically added
          return {
            ...msg,
            reactions: existingReactions.filter(r => !(r.user_id === currentUserId && r.emoji === emoji)),
          };
        }
      }));
      console.error('Failed to toggle reaction:', error);
    }
  };

  // Combine messages and polls into a single sorted list with date separators
  const combinedItems = useCallback((): ChatItem[] => {
    const items: Array<{ timestamp: Date; item: ChatItem }> = [];

    // Add polls
    polls.forEach(poll => {
      items.push({
        timestamp: new Date(poll.created_at),
        item: { type: 'poll', data: poll },
      });
    });

    // Add messages
    messages.forEach(msg => {
      items.push({
        timestamp: new Date(msg.created_at),
        item: { type: 'message', data: msg },
      });
    });

    // Sort by timestamp
    items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Insert date separators
    const result: ChatItem[] = [];
    let lastDate: string | null = null;

    items.forEach(({ timestamp, item }) => {
      const dateStr = timestamp.toDateString();
      if (dateStr !== lastDate) {
        result.push({ type: 'date', data: dateStr });
        lastDate = dateStr;
      }
      result.push(item);
    });

    return result;
  }, [messages, polls]);

  const handleReplyClick = (msg: GroupMessage) => {
    const prevOffset = scrollOffsetRef.current;
    setReplyTo(msg);
    setTimeout(() => {
      try {
        flatListRef.current?.scrollToOffset({ offset: prevOffset, animated: false });
      } catch {}
    }, 50);
  };

  // Keep track of previous combined items count to avoid auto-scrolling on every content change
  useEffect(() => {
    try {
      prevItemsCountRef.current = combinedItems().length;
    } catch {}
  }, [messages, polls]);

  const renderChatItem = useCallback(({ item, index }: { item: ChatItem; index: number }) => {
    if (item.type === 'date') {
      return <DateSeparator date={item.data} />;
    }

    if (item.type === 'message') {
      const message = item.data;
      const isOwnMessage = message.user_id === currentUserId;
      
      // Check if we should show avatar and group messages
      const allItems = combinedItems();
      const prevItem = index > 0 ? allItems[index - 1] : null;
      const nextItem = index < allItems.length - 1 ? allItems[index + 1] : null;
      
      // Message grouping logic: messages from same user within 4 minutes are grouped
      const MESSAGE_GROUP_THRESHOLD_MS = 4 * 60 * 1000; // 4 minutes
      
      const prevMessage = prevItem?.type === 'message' ? prevItem.data : null;
      const nextMessage = nextItem?.type === 'message' ? nextItem.data : null;
      
      const prevIsSameUser = prevMessage?.user_id === message.user_id;
      const prevIsRecent = prevMessage 
        ? (new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime()) < MESSAGE_GROUP_THRESHOLD_MS
        : false;
      
      const nextIsSameUser = nextMessage?.user_id === message.user_id;
      const nextIsRecent = nextMessage
        ? (new Date(nextMessage.created_at).getTime() - new Date(message.created_at).getTime()) < MESSAGE_GROUP_THRESHOLD_MS
        : false;
      
      // Show avatar only on the last message in a group (from the same user)
      const isFirstInGroup = !prevIsSameUser || !prevIsRecent;
      const isLastInGroup = !nextIsSameUser || !nextIsRecent;
      const showAvatar = !isOwnMessage && isLastInGroup;

      return (
        <MessageBubble
          message={message}
          isOwnMessage={isOwnMessage}
          showAvatar={showAvatar}
          isFirstInGroup={isFirstInGroup}
          isLastInGroup={isLastInGroup}
          onLongPress={() => handleMessageLongPress(message)}
          onReactionPress={(emoji) => handleMessageReaction(message.id, emoji)}
          onReplyPress={() => handleReplyClick(message)}
          onAvatarPress={(userId) => {
            // Navigate to user profile if needed
            console.log('Avatar pressed:', userId);
          }}
        />
      );
    }

    if (item.type === 'poll') {
      return renderPollMessage({ item: item.data });
    }

    return null;
  }, [currentUserId, combinedItems, handleMessageLongPress, handleMessageReaction]);

  const renderPollMessage = useCallback(({ item: poll }: { item: PollMessage }) => {
    const totalVotes = getTotalVotes(poll);
    const hasWinner = poll.final_event_id != null;
    const winnerEvent = poll.final_event_id ? winnersById[poll.final_event_id] : null;
    const currentLeader = getCurrentLeader(poll);
    const myCurrentVote = myVotes[poll.id] || poll.votes?.find(v => v.user_id === currentUserId)?.option_id;
    
    // Check if this is a Quick Pick poll
    const isQuickPick = poll.title?.startsWith('Quick Pick');
    const isRatingMode = poll.mode === 'rating';
    
    // Get unique voters for progress display
    // For rating mode, use ratingParticipants (users who completed all ratings)
    const uniqueVoters = poll.votes ? [...new Map(poll.votes.map(v => [v.user_id, v])).values()] : [];
    const votedCount = isRatingMode && poll.ratingParticipants 
      ? poll.ratingParticipants.length 
      : uniqueVoters.length;
    
    // Check if current user has participated in this Quick Pick
    // For rating mode, check ratingParticipants instead of regular votes
    const hasParticipated = isQuickPick && (
      isRatingMode 
        ? (poll.ratingParticipants || []).includes(currentUserId || '')
        : uniqueVoters.some(v => v.user_id === currentUserId)
    );
    
    // Get top 3 options sorted by score for leaderboard
    // For rating mode, use the score field; otherwise use votes
    const topOptions = poll.options 
      ? [...poll.options].sort((a, b) => {
          if (isRatingMode) {
            // Sort by score (love_it - not_for_me)
            return (b.score ?? b.votes) - (a.score ?? a.votes);
          }
          return b.votes - a.votes;
        }).slice(0, 3)
      : [];

    // QUICK PICK SPECIAL RENDERING
    if (isQuickPick) {
      return (
        <View style={{
          flexDirection: 'row',
          marginBottom: 16,
          paddingHorizontal: 12,
          alignItems: 'flex-start',
        }}>
          {/* Creator avatar */}
          <Avatar
            uri={poll.creator?.avatar_url}
            size={40}
          />

          {/* Message bubble - Quick Pick Style */}
          <View style={{
            flex: 1,
            marginLeft: 10,
            borderRadius: 16,
            borderTopLeftRadius: 4,
            shadowColor: '#8B5CF6',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 4,
            overflow: 'hidden',
          }}>
            {/* Gradient Header */}
            <LinearGradient
              colors={['#8B5CF6', '#6366F1', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="flash" size={16} color="#fff" />
                  </View>
                  <View>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                      Quick Pick
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10 }}>
                      Swipe to Rate • Score to Win
                    </Text>
                  </View>
                </View>
                
                {/* Status badge */}
                <View style={{
                  backgroundColor: poll.is_active ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 10,
                }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                    {poll.is_active ? 'LIVE' : 'ENDED'}
                  </Text>
                </View>
              </View>
              
              {/* Progress bar */}
              <View style={{
                marginTop: 10,
                height: 4,
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <View style={{
                  width: `${members.length > 0 ? (votedCount / members.length) * 100 : 0}%`,
                  height: '100%',
                  backgroundColor: '#fff',
                  borderRadius: 2,
                }} />
              </View>
              
              {/* Voters row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                <View style={{ flexDirection: 'row' }}>
                  {uniqueVoters.slice(0, 5).map((voter, i) => (
                    <View
                      key={voter.user_id}
                      style={{
                        marginLeft: i > 0 ? -8 : 0,
                        borderWidth: 2,
                        borderColor: '#8B5CF6',
                        borderRadius: 12,
                      }}
                    >
                      <Avatar uri={voter.user?.avatar_url} size={20} />
                    </View>
                  ))}
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' }}>
                  {votedCount}/{members.length} swiped
                </Text>
              </View>
            </LinearGradient>
            
            {/* Content area */}
            <View style={{ backgroundColor: c.card, padding: 14 }}>
              {/* Creator info */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>
                  {poll.creator?.display_name || poll.creator?.username || 'Member'}
                </Text>
                <Text style={{ color: c.muted, fontSize: 11, marginLeft: 6 }}>
                  started this Quick Pick
                </Text>
              </View>
              
              {/* How it works hint for non-participants */}
              {!hasParticipated && poll.is_active && (
                <View style={{
                  backgroundColor: '#8B5CF6' + '10',
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#8B5CF6' + '30',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Ionicons name="swap-horizontal" size={14} color="#8B5CF6" />
                    <Text style={{ color: '#8B5CF6', fontWeight: '700', fontSize: 12 }}>
                      How Quick Pick Works
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 16 }}>👉</Text>
                      <Text style={{ color: c.muted, fontSize: 9, marginTop: 2 }}>Swipe Right</Text>
                      <Text style={{ color: '#22c55e', fontSize: 9, fontWeight: '700' }}>+1 pt</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 16 }}>👆</Text>
                      <Text style={{ color: c.muted, fontSize: 9, marginTop: 2 }}>Swipe Up</Text>
                      <Text style={{ color: '#f59e0b', fontSize: 9, fontWeight: '700' }}>0 pt</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 16 }}>👈</Text>
                      <Text style={{ color: c.muted, fontSize: 9, marginTop: 2 }}>Swipe Left</Text>
                      <Text style={{ color: '#ef4444', fontSize: 9, fontWeight: '700' }}>-1 pt</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 16 }}>🏆</Text>
                      <Text style={{ color: c.muted, fontSize: 9, marginTop: 2, textAlign: 'right' }}>Highest Score Wins!</Text>
                    </View>
                  </View>
                </View>
              )}
              
              {/* LEADERBOARD for participants or closed polls */}
              {(hasParticipated || !poll.is_active) && topOptions.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: c.muted, fontSize: 11, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {poll.is_active ? '🔥 Current Rankings' : '🏆 Final Results'}
                  </Text>
                  
                  {topOptions.map((option, index) => {
                    const { displayText, emoji } = parseOptionText(option.text || '');
                    const medals = ['🥇', '🥈', '🥉'];
                    const medal = medals[index] || `#${index + 1}`;
                    const isWinning = !poll.is_active && index === 0;
                    
                    // For rating mode, use score; otherwise use votes
                    const displayScore = isRatingMode ? (option.score ?? 0) : option.votes;
                    const maxScore = isRatingMode 
                      ? Math.max(...topOptions.map(o => Math.abs(o.score ?? 0)), 1)
                      : (topOptions[0]?.votes || 1);
                    
                    // Calculate bar width - handle negative scores
                    const barWidth = isRatingMode 
                      ? Math.max(0, (displayScore / maxScore) * 100)
                      : (maxScore > 0 ? (option.votes / maxScore) * 100 : 0);
                    
                    // Color based on score (green for positive, yellow for neutral, red for negative)
                    const getScoreColor = (score: number) => {
                      if (score > 0) return '#22c55e';
                      if (score < 0) return '#ef4444';
                      return '#f59e0b';
                    };
                    
                    const scoreColor = isRatingMode ? getScoreColor(displayScore) : '#8B5CF6';
                    
                    return (
                      <View
                        key={option.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: isWinning ? '#8B5CF6' + '15' : c.background,
                          borderRadius: 10,
                          padding: 10,
                          marginBottom: 6,
                          borderWidth: isWinning ? 2 : 1,
                          borderColor: isWinning ? '#8B5CF6' : c.background,
                          overflow: 'hidden',
                        }}
                      >
                        {/* Score bar background */}
                        <View
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${barWidth}%`,
                            backgroundColor: index === 0 ? '#8B5CF6' + '20' : index === 1 ? '#6366F1' + '15' : '#4F46E5' + '10',
                          }}
                        />
                        
                        <Text style={{ fontSize: 18, marginRight: 8 }}>{medal}</Text>
                        {emoji && <Text style={{ fontSize: 14, marginRight: 4 }}>{emoji}</Text>}
                        <Text style={{ 
                          flex: 1, 
                          color: c.text, 
                          fontWeight: isWinning ? '700' : '600',
                          fontSize: 13,
                        }} numberOfLines={1}>
                          {displayText}
                        </Text>
                        <View style={{
                          backgroundColor: scoreColor,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 8,
                        }}>
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                            {isRatingMode && displayScore > 0 ? '+' : ''}{displayScore} pts
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  
                  {(poll.options?.length || 0) > 3 && (
                    <Pressable 
                      onPress={() => router.push(`/(tabs)/polls/${poll.id}`)}
                      style={{ alignItems: 'center', paddingVertical: 4 }}
                    >
                      <Text style={{ color: '#8B5CF6', fontSize: 12, fontWeight: '600' }}>
                        +{(poll.options?.length || 0) - 3} more options
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
              
              {/* JOIN BUTTON for non-participants */}
              {!hasParticipated && poll.is_active && (
                <Pressable
                  onPress={() => router.push(`/quick-pick/vote?groupId=${groupId}&groupName=${encodeURIComponent(group?.name || 'Group')}`)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <LinearGradient
                    colors={['#8B5CF6', '#6366F1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      paddingVertical: 14,
                      borderRadius: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Ionicons name="play" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                      Join Quick Pick
                    </Text>
                  </LinearGradient>
                </Pressable>
              )}
              
              {/* Already voted indicator */}
              {hasParticipated && poll.is_active && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 8,
                  backgroundColor: '#22c55e' + '15',
                  borderRadius: 10,
                }}>
                  <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                  <Text style={{ color: '#22c55e', fontWeight: '700', fontSize: 13 }}>
                    You've swiped! Waiting for others...
                  </Text>
                </View>
              )}
              
              {/* Winner announcement for closed Quick Pick */}
              {!poll.is_active && topOptions[0] && (
                <View style={{
                  backgroundColor: '#8B5CF6' + '10',
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 2,
                  borderColor: '#8B5CF6',
                  alignItems: 'center',
                }}>
                  <Text style={{ color: '#8B5CF6', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    🎉 The Group Has Decided!
                  </Text>
                  <Text style={{ color: c.text, fontWeight: '800', fontSize: 16, marginTop: 4 }}>
                    {parseOptionText(topOptions[0].text || '').displayText}
                  </Text>
                </View>
              )}
              
              {/* Action buttons */}
              <View style={{ flexDirection: 'row', marginTop: 12, gap: 12, alignItems: 'center' }}>
                <Pressable
                  onPress={() => router.push(`/(tabs)/polls/${poll.id}`)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Ionicons name="stats-chart" size={14} color="#8B5CF6" />
                  <Text style={{ color: '#8B5CF6', fontWeight: '600', fontSize: 12 }}>
                    Full Results
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setReactingPollId(reactingPollId === poll.id ? null : poll.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Ionicons 
                    name={reactingPollId === poll.id ? 'happy' : 'happy-outline'} 
                    size={14} 
                    color={c.muted} 
                  />
                  <Text style={{ color: c.muted, fontWeight: '600', fontSize: 12 }}>
                    React
                  </Text>
                </Pressable>
              </View>
              
              {/* Reaction picker */}
              {reactingPollId === poll.id && (
                <View style={{
                  flexDirection: 'row',
                  backgroundColor: c.background,
                  padding: 8,
                  borderRadius: 20,
                  gap: 4,
                  marginTop: 8,
                  alignSelf: 'flex-start',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  elevation: 4,
                }}>
                  {(Object.keys(REACTION_EMOJIS) as ReactionType[]).map(type => {
                    const myReaction = getMyReaction(poll);
                    const isMyReaction = myReaction === type;
                    return (
                      <Pressable
                        key={type}
                        onPress={() => toggleReaction(poll.id, type)}
                        style={{
                          padding: 8,
                          borderRadius: 16,
                          backgroundColor: isMyReaction ? '#8B5CF6' + '30' : 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: 20 }}>{REACTION_EMOJIS[type]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              
              {/* Show existing reactions */}
              {(() => {
                const reactionCounts = getReactionCounts(poll);
                const hasAnyReactions = Object.values(reactionCounts).some(cnt => cnt > 0);
                const myReaction = getMyReaction(poll);
                
                if (!hasAnyReactions) return null;
                
                return (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {(Object.keys(REACTION_EMOJIS) as ReactionType[]).map(type => {
                      const count = reactionCounts[type];
                      if (count === 0) return null;
                      const isMyReaction = myReaction === type;
                      return (
                        <Pressable
                          key={type}
                          onPress={() => toggleReaction(poll.id, type)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: isMyReaction ? '#8B5CF6' + '30' : c.background,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 12,
                            borderWidth: isMyReaction ? 1 : 0,
                            borderColor: '#8B5CF6',
                          }}
                        >
                          <Text style={{ fontSize: 14 }}>{REACTION_EMOJIS[type]}</Text>
                          <Text style={{ 
                            color: isMyReaction ? '#8B5CF6' : c.muted, 
                            fontSize: 12, 
                            fontWeight: '600',
                            marginLeft: 4,
                          }}>
                            {count}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })()}
            </View>
          </View>
        </View>
      );
    }

    // REGULAR POLL RENDERING (non-Quick Pick)
    return (
      <View style={{
        flexDirection: 'row',
        marginBottom: 16,
        paddingHorizontal: 12,
        alignItems: 'flex-start',
      }}>
        {/* Creator avatar */}
        <Avatar
          uri={poll.creator?.avatar_url}
          size={40}
        />

        {/* Message bubble */}
        <View style={{
          flex: 1,
          marginLeft: 10,
          backgroundColor: c.card,
          borderRadius: 16,
          borderTopLeftRadius: 4,
          padding: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
          overflow: 'hidden',
        }}>
          <View style={{ padding: 12 }}>
            {/* Header: Creator name and time */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>
                {poll.creator?.display_name || poll.creator?.username || 'Member'}
              </Text>
              <Text style={{ color: c.muted, fontSize: 12, marginLeft: 8 }}>
                {new Date(poll.created_at).toLocaleDateString(undefined, { 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              {!poll.is_active && (
                <View style={{
                  backgroundColor: c.muted + '30',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  marginLeft: 8,
                }}>
                  <Text style={{ color: c.muted, fontSize: 10, fontWeight: '600' }}>CLOSED</Text>
                </View>
              )}
            </View>

          {/* Poll title */}
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 16, marginBottom: 10 }}>
            {'📊 '}{poll.title || `Poll #${poll.id}`}
          </Text>

          {/* Current Leader Banner (if active and has votes) */}
          {poll.is_active && currentLeader && currentLeader.votes > 0 && !hasWinner && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: c.primary + '15',
              padding: 10,
              borderRadius: 10,
              marginBottom: 10,
              gap: 8,
            }}>
              <Text style={{ fontSize: 18 }}>👑</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.muted, fontSize: 11, fontWeight: '600' }}>
                  {poll.is_active ? 'CURRENT LEADER' : 'WINNER'}
                </Text>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                  {parseOptionText(currentLeader.text || '').displayText}
                </Text>
              </View>
              <View style={{
                backgroundColor: c.primary,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
              }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                  {currentLeader.votes} {currentLeader.votes === 1 ? 'vote' : 'votes'}
                </Text>
              </View>
            </View>
          )}

          {/* Poll options with vote bars */}
          {poll.options && poll.options.length > 0 && (
            <View style={{ gap: 8 }}>
              {poll.options.map((option) => {
                const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                const voters = getVotersForOption(poll, option.id);
                const isWinningOption = hasWinner && option.event_id === poll.final_event_id;
                const isCurrentLeader = !hasWinner && currentLeader?.id === option.id && option.votes > 0;
                const isMyVote = myCurrentVote === option.id;
                const isVoting = votingOptionId?.pollId === poll.id && votingOptionId?.optionId === option.id;
                const isEventOption = !!option.event_id;
                
                // Parse Quick Pick encoded text
                const { displayText, emoji } = parseOptionText(option.text || '');

                return (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      if (poll.is_active) {
                        // Vote inline
                        handleInlineVote(poll, option.id, isEventOption);
                      } else {
                        // View results
                        router.push(`/(tabs)/polls/${poll.id}`);
                      }
                    }}
                    disabled={isVoting}
                    style={{
                      backgroundColor: c.background,
                      borderRadius: 10,
                      overflow: 'hidden',
                      borderWidth: isWinningOption || isMyVote ? 2 : isCurrentLeader ? 1 : 0,
                      borderColor: isWinningOption 
                        ? c.primary 
                        : isMyVote 
                          ? '#22c55e' 
                          : isCurrentLeader 
                            ? c.primary + '60' 
                            : 'transparent',
                      opacity: isVoting ? 0.7 : 1,
                    }}
                  >
                    {/* Progress bar background */}
                    <View
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${percentage}%`,
                        backgroundColor: isWinningOption 
                          ? c.primary + '40' 
                          : isMyVote 
                            ? '#22c55e30' 
                            : c.primary + '20',
                      }}
                    />
                    
                    <View style={{ padding: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                          {/* Vote indicator or crown */}
                          {isMyVote && (
                            <View style={{
                              width: 18,
                              height: 18,
                              borderRadius: 9,
                              backgroundColor: '#22c55e',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 6,
                            }}>
                              <Ionicons name="checkmark" size={12} color="#fff" />
                            </View>
                          )}
                          {isWinningOption && <Text style={{ marginRight: 4 }}>👑</Text>}
                          {isVoting && <ActivityIndicator size="small" color={c.primary} style={{ marginRight: 6 }} />}
                          {emoji && !isWinningOption && (
                            <Text style={{ marginRight: 4, fontSize: 14 }}>{emoji}</Text>
                          )}
                          <Text style={{ 
                            color: c.text, 
                            fontWeight: isMyVote || isWinningOption ? '700' : '600', 
                            flex: 1,
                          }} numberOfLines={2}>
                            {displayText}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>
                            {option.votes} {option.votes === 1 ? 'vote' : 'votes'}
                          </Text>
                          {percentage > 0 && (
                            <Text style={{ color: c.muted, fontSize: 10 }}>
                              {Math.round(percentage)}%
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Voter avatars */}
                      {voters.length > 0 && (
                        <View style={{ flexDirection: 'row', marginTop: 6, alignItems: 'center' }}>
                          {voters.slice(0, 5).map((voter, i) => (
                            <View
                              key={voter.user_id}
                              style={{
                                marginLeft: i > 0 ? -8 : 0,
                                borderWidth: 2,
                                borderColor: c.card,
                                borderRadius: 12,
                              }}
                            >
                              <Avatar uri={voter.user?.avatar_url} size={20} />
                            </View>
                          ))}
                          {voters.length > 5 && (
                            <Text style={{ color: c.muted, fontSize: 11, marginLeft: 4 }}>
                              +{voters.length - 5}
                            </Text>
                          )}
                        </View>
                      )}
                      
                      {/* Tap to vote hint for active polls */}
                      {poll.is_active && !isMyVote && voters.length === 0 && (
                        <Text style={{ color: c.muted, fontSize: 10, marginTop: 4 }}>
                          Tap to vote
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Winner announcement */}
          {hasWinner && winnerEvent && (
            <View style={{
              marginTop: 12,
              backgroundColor: c.primary + '15',
              padding: 10,
              borderRadius: 10,
              borderLeftWidth: 3,
              borderLeftColor: c.primary,
            }}>
              <Text style={{ color: c.text, fontWeight: '700', marginBottom: 4 }}>
                🎉 Winner: {winnerEvent.title}
              </Text>
              {winnerEvent.date_time && (
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  {new Date(winnerEvent.date_time).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              )}
            </View>
          )}

          {/* Deadline */}
          {poll.deadline_at && poll.is_active && (
            <Text style={{ color: c.muted, fontSize: 11, marginTop: 8 }}>
              ⏰ Ends {new Date(poll.deadline_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          )}

          {/* Reactions display */}
          {(() => {
            const reactionCounts = getReactionCounts(poll);
            const hasAnyReactions = Object.values(reactionCounts).some(cnt => cnt > 0);
            const myReaction = getMyReaction(poll);
            
            return (
              <View style={{ marginTop: 10 }}>
                {/* Show existing reactions */}
                {hasAnyReactions && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {(Object.keys(REACTION_EMOJIS) as ReactionType[]).map(type => {
                      const count = reactionCounts[type];
                      if (count === 0) return null;
                      const isMyReaction = myReaction === type;
                      return (
                        <Pressable
                          key={type}
                          onPress={() => toggleReaction(poll.id, type)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: isMyReaction ? c.primary + '30' : c.background,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 12,
                            borderWidth: isMyReaction ? 1 : 0,
                            borderColor: c.primary,
                          }}
                        >
                          <Text style={{ fontSize: 14 }}>{REACTION_EMOJIS[type]}</Text>
                          <Text style={{ 
                            color: isMyReaction ? c.primary : c.muted, 
                            fontSize: 12, 
                            fontWeight: '600',
                            marginLeft: 4,
                          }}>
                            {count}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Reaction picker (shown when reactingPollId matches) */}
                {reactingPollId === poll.id && (
                  <View style={{
                    flexDirection: 'row',
                    backgroundColor: c.background,
                    padding: 8,
                    borderRadius: 20,
                    gap: 4,
                    marginBottom: 8,
                    alignSelf: 'flex-start',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    elevation: 4,
                  }}>
                    {(Object.keys(REACTION_EMOJIS) as ReactionType[]).map(type => {
                      const isMyReaction = myReaction === type;
                      return (
                        <Pressable
                          key={type}
                          onPress={() => toggleReaction(poll.id, type)}
                          style={{
                            padding: 8,
                            borderRadius: 16,
                            backgroundColor: isMyReaction ? c.primary + '30' : 'transparent',
                          }}
                        >
                          <Text style={{ fontSize: 20 }}>{REACTION_EMOJIS[type]}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })()}

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', marginTop: 8, gap: 12, alignItems: 'center' }}>
            <Pressable
              onPress={() => router.push(`/(tabs)/polls/${poll.id}`)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Ionicons name="bar-chart-outline" size={16} color={c.primary} />
              <Text style={{ color: c.primary, fontWeight: '600', fontSize: 13 }}>
                {poll.is_active ? 'Details' : 'Results'}
              </Text>
            </Pressable>

            {/* React button */}
            <Pressable
              onPress={() => setReactingPollId(reactingPollId === poll.id ? null : poll.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Ionicons 
                name={reactingPollId === poll.id ? 'happy' : 'happy-outline'} 
                size={16} 
                color={c.muted} 
              />
              <Text style={{ color: c.muted, fontWeight: '600', fontSize: 13 }}>
                React
              </Text>
            </Pressable>

            <View style={{ flex: 1 }} />

            {/* Vote status */}
            {myCurrentVote ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '600' }}>Voted</Text>
              </View>
            ) : poll.is_active ? (
              <Text style={{ color: c.primary, fontSize: 12, fontWeight: '600' }}>
                Tap to vote
              </Text>
            ) : null}
            
            <Text style={{ color: c.muted, fontSize: 12 }}>
              {totalVotes} {totalVotes === 1 ? 'response' : 'responses'}
            </Text>
          </View>
          </View>
        </View>
      </View>
    );
  }, [c, winnersById, currentUserId, reactingPollId, polls, myVotes, votingOptionId, members, group, groupId]);

  const renderEmptyState = () => (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingVertical: 60,
    }}>
      <Ionicons name="chatbubbles-outline" size={64} color={c.muted} />
      <Text style={{ 
        color: c.text, 
        fontSize: 18, 
        fontWeight: '700', 
        marginTop: 16,
        textAlign: 'center',
      }}>
        No polls yet
      </Text>
      <Text style={{ 
        color: c.muted, 
        fontSize: 14, 
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
      }}>
        Start the conversation by creating a poll for your group to vote on!
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={{ paddingBottom: 8 }}>
      {/* Settings/Info toggle */}
      {showSettings && (
        <View style={{
          backgroundColor: c.card,
          margin: 12,
          borderRadius: 12,
          padding: 12,
        }}>
          {/* Invite code section */}
          {group?.invite_code ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>Invite Code</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: c.text, letterSpacing: 2, fontWeight: '700', flex: 1 }}>
                  {group.invite_code}
                </Text>
                <Pressable onPress={onCopy} hitSlop={8}>
                  <Ionicons name="copy-outline" size={18} color={c.text} />
                </Pressable>
                <Pressable onPress={onShare} hitSlop={8}>
                  <Ionicons name="paper-plane" size={18} color={c.text} />
                </Pressable>
                <Pressable onPress={regenCooldown > 0 ? undefined : onRegenerate} disabled={regenCooldown > 0}>
                  <Text style={{ color: c.primary, fontWeight: '700', opacity: regenCooldown > 0 ? 0.5 : 1 }}>
                    {regenCooldown > 0 ? `${regenCooldown}s` : 'New'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={onShare} style={{ marginBottom: 12 }}>
              <Text style={{ color: c.primary, fontWeight: '700' }}>Enable Invite Link</Text>
            </Pressable>
          )}

          {/* Members list */}
          <Text style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>
            Members ({members.length})
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {members.slice(0, 10).map(member => (
              <View key={member.user_id} style={{ alignItems: 'center' }}>
                <Avatar uri={member.user?.avatar_url} size={32} />
                <Text style={{ color: c.muted, fontSize: 10, marginTop: 2 }} numberOfLines={1}>
                  {member.user?.display_name || member.user?.username || 'Member'}
                </Text>
              </View>
            ))}
            {members.length > 10 && (
              <View style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 16, 
                backgroundColor: c.background,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ color: c.muted, fontSize: 10, fontWeight: '700' }}>
                  +{members.length - 10}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <GradientBackground variant="dim">
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable 
                onPress={() => router.push('/(tabs)/groups')}
                style={{ padding: 8, marginLeft: -8 }}
                accessibilityLabel="Back to groups"
              >
                <Ionicons name="arrow-back" size={24} color={c.text} />
              </Pressable>
              
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>
                  {group?.name ?? 'Group'}
                </Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Settings toggle */}
              <Pressable
                onPress={() => setShowSettings(!showSettings)}
                style={{ padding: 8 }}
                accessibilityLabel="Group settings"
              >
                <Ionicons 
                  name={showSettings ? 'chevron-up' : 'ellipsis-horizontal'} 
                  size={24} 
                  color={c.text} 
                />
              </Pressable>
            </View>
          </View>

          {/* Chat list (messages + polls) */}
          <FlatList
            ref={flatListRef}
            data={combinedItems()}
            keyExtractor={(item, index) => {
              if (item.type === 'message') return `msg-${item.data.id}`;
              if (item.type === 'poll') return `poll-${item.data.id}`;
              return `date-${index}`;
            }}
            renderItem={renderChatItem}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={{ 
              flexGrow: 1,
              paddingBottom: Math.max(insets.bottom + 80, 170), // Ensure at least 140px bottom padding so messages aren't hidden
            }}
            onContentSizeChange={() => {
              // Only auto-scroll on initial load (when there were no items before).
              // Avoid forcing scroll for subsequent content changes which can jump the view.
              const items = combinedItems();
              if (prevItemsCountRef.current === 0 && items.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
              prevItemsCountRef.current = items.length;
            }}
            onScroll={handleListScroll}
            onLayout={() => {
              // Scroll to bottom on initial layout
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }, 100);
            }}
          />

          {/* Combined action bar with buttons and message input */}
          <View style={{
            position: 'absolute',
            bottom: insets.bottom + 90,
            left: 8,
            right: 8,
            backgroundColor: c.card,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            paddingVertical: 10,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
          }}>
            {/* Action buttons on the left */}
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {/* New Poll button */}
              <Pressable
                onPress={() => setShowPollCreator(true)}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: c.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.8 : 1,
                })}
                accessibilityLabel="Create a new poll"
              >
                <Ionicons name="add-circle-outline" size={22} color="#fff" />
              </Pressable>

              {/* Quick Pick button */}
              <Pressable
                onPress={() => router.push(`/QuickPick?groupId=${groupId}&groupName=${encodeURIComponent(group?.name || 'Group')}`)}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: c.muted + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.8 : 1,
                })}
                accessibilityLabel="Start quick pick"
              >
                <Ionicons name="flash-outline" size={22} color={c.primary} />
              </Pressable>
            </View>

            {/* Message input - takes remaining space */}
            <View style={{ flex: 1, justifyContent: 'center', height: 44 }}>
              <MessageInput
                compact
                onSend={handleSendMessage}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                placeholder="Message"
              />
            </View>
          </View>

          {/* Inline Poll Creator Modal */}
          <InlinePollCreator
            visible={showPollCreator}
            onClose={() => setShowPollCreator(false)}
            groupId={groupId}
            onPollCreated={(pollId) => {
              // Refresh the group page to show the new poll
              router.replace(`/(tabs)/groups/${groupId}`);
            }}
            colors={c}
          />
        </View>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}
