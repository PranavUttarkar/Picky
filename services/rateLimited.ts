/**
 * Rate-Limited Service Wrappers
 * 
 * This module provides rate-limited versions of all service functions.
 * Import from here instead of the original service files to get automatic rate limiting.
 * 
 * Usage:
 * ```ts
 * // Instead of:
 * import { sendFriendRequest } from '@/services/friends';
 * 
 * // Use:
 * import { sendFriendRequest } from '@/services/rateLimited';
 * ```
 */

import {
  withRateLimit,
  getSharedLimiter,
  RateLimitPresets,
  createRateLimiter,
  RateLimitError,
} from '@/utils/rateLimiter';

// ============================================================================
// Original Service Imports
// ============================================================================

import * as friendsService from './friends';
import * as eventsService from './events';
import * as foodService from './food';
import * as pollsService from './polls';
import * as groupsService from './groups';
import * as followingService from './following';
import * as blockingService from './blocking';
import * as reportsService from './reports';
import * as availabilityService from './availability';
import * as profileService from './profile';
import * as decisionsService from './decisions';
import * as privacyService from './privacy';
import * as adminService from './admin';

// ============================================================================
// Shared Rate Limiters (for operations that should be globally rate-limited)
// ============================================================================

export const Limiters = {
  // External API calls
  geocoding: getSharedLimiter('geocoding', {
    ...RateLimitPresets.externalApi,
    key: 'geocoding',
  }),
  
  // Search operations
  search: getSharedLimiter('search', {
    ...RateLimitPresets.search,
    key: 'search',
  }),
  
  // Create operations
  create: getSharedLimiter('create', {
    ...RateLimitPresets.create,
    key: 'create',
  }),
  
  // Social actions
  social: getSharedLimiter('social', {
    ...RateLimitPresets.socialAction,
    key: 'social',
  }),
  
  // Uploads
  upload: getSharedLimiter('upload', {
    ...RateLimitPresets.upload,
    key: 'upload',
  }),
  
  // Reports
  report: getSharedLimiter('report', {
    ...RateLimitPresets.report,
    key: 'report',
  }),
  
  // Friend requests
  friendRequest: getSharedLimiter('friendRequest', {
    ...RateLimitPresets.friendRequest,
    key: 'friendRequest',
  }),
  
  // Group actions
  group: getSharedLimiter('group', {
    ...RateLimitPresets.groupAction,
    key: 'group',
  }),
};

// ============================================================================
// Friends Service (Rate Limited)
// ============================================================================

export const sendFriendRequest = withRateLimit(
  friendsService.sendFriendRequest,
  { ...RateLimitPresets.friendRequest, key: 'friends:sendRequest' }
);

export const respondToFriendRequest = withRateLimit(
  friendsService.respondToFriendRequest,
  { ...RateLimitPresets.socialAction, key: 'friends:respond' }
);

export const searchUsersByUsername = withRateLimit(
  friendsService.searchUsersByUsername,
  { ...RateLimitPresets.search, key: 'friends:search' }
);

export const getUserFriends = friendsService.getUserFriends; // Read-only, no limit
export const removeFriend = withRateLimit(
  friendsService.removeFriend,
  { ...RateLimitPresets.socialAction, key: 'friends:remove' }
);

export const getPendingFriendRequests = friendsService.getPendingFriendRequests;
export const getSentFriendRequests = friendsService.getSentFriendRequests;
export const getEventFriendActivity = friendsService.getEventFriendActivity;
export const getRestaurantFriendActivity = friendsService.getRestaurantFriendActivity;

export const updateUserProfile = withRateLimit(
  friendsService.updateUserProfile,
  { maxRequests: 5, windowMs: 60_000, key: 'friends:updateProfile' }
);

export const updateUsername = withRateLimit(
  friendsService.updateUsername,
  { maxRequests: 2, windowMs: 60_000, key: 'friends:updateUsername' }
);

export const checkUsernameAvailability = withRateLimit(
  friendsService.checkUsernameAvailability,
  { ...RateLimitPresets.search, key: 'friends:checkUsername' }
);

export const generateFriendInviteLink = friendsService.generateFriendInviteLink;

// ============================================================================
// Events Service (Rate Limited)
// ============================================================================

export const getTopUserMatches = eventsService.getTopUserMatches;
export const getTopGroupMatches = eventsService.getTopGroupMatches;

export const searchEvents = withRateLimit(
  eventsService.searchEvents,
  { ...RateLimitPresets.search, key: 'events:search' }
);

export const getUpcomingEvents = eventsService.getUpcomingEvents;
export const deleteEvent = eventsService.deleteEvent; // Admin/owner only

export const createEvent = withRateLimit(
  eventsService.createEvent,
  { ...RateLimitPresets.create, key: 'events:create' }
);

export const updateEvent = withRateLimit(
  eventsService.updateEvent,
  { maxRequests: 10, windowMs: 60_000, key: 'events:update' }
);

export const deleteEventDirect = eventsService.deleteEventDirect;

export const uploadEventImages = withRateLimit(
  eventsService.uploadEventImages,
  { ...RateLimitPresets.upload, key: 'events:uploadImages' }
);

export const uploadEventImagesWithPaths = withRateLimit(
  eventsService.uploadEventImagesWithPaths,
  { ...RateLimitPresets.upload, key: 'events:uploadImagesWithPaths' }
);

export const deleteEventImages = eventsService.deleteEventImages;

// ============================================================================
// Food Service (Rate Limited)
// ============================================================================

export const getRestaurantById = foodService.getRestaurantById;

export const listRestaurants = withRateLimit(
  foodService.listRestaurants,
  { maxRequests: 30, windowMs: 60_000, key: 'food:list' }
);

export const searchRestaurants = withRateLimit(
  foodService.searchRestaurants,
  { ...RateLimitPresets.search, key: 'food:search' }
);

export const scoreRestaurantsForUser = foodService.scoreRestaurantsForUser;
export const getTopUserRestaurantMatches = foodService.getTopUserRestaurantMatches;
export const getTopGroupRestaurantMatches = foodService.getTopGroupRestaurantMatches;
export const restaurantImages = foodService.restaurantImages;

// ============================================================================
// Polls Service (Rate Limited)
// ============================================================================

export const createPollWithOptions = withRateLimit(
  pollsService.createPollWithOptions,
  { ...RateLimitPresets.create, key: 'polls:create' }
);

export const createTextPoll = withRateLimit(
  pollsService.createTextPoll,
  { ...RateLimitPresets.create, key: 'polls:createText' }
);

export const closePoll = pollsService.closePoll;
export const getPoll = pollsService.getPoll;

export const castVote = withRateLimit(
  pollsService.castVote,
  { ...RateLimitPresets.socialAction, key: 'polls:vote' }
);

export const clearMyVote = pollsService.clearMyVote;
export const recordNoVote = pollsService.recordNoVote;
export const onPollRealtime = pollsService.onPollRealtime;
export const suggestLeader = pollsService.suggestLeader;

export const castRating = withRateLimit(
  pollsService.castRating,
  { maxRequests: 60, windowMs: 60_000, key: 'polls:rating' } // Higher limit for swipe actions
);

export const commitPoll = pollsService.commitPoll;
export const toggleCommitment = pollsService.toggleCommitment;

export const addPollOption = withRateLimit(
  pollsService.addPollOption,
  { maxRequests: 10, windowMs: 60_000, key: 'polls:addOption' }
);

export const addTextPollOption = withRateLimit(
  pollsService.addTextPollOption,
  { maxRequests: 10, windowMs: 60_000, key: 'polls:addTextOption' }
);

export const castTextVote = withRateLimit(
  pollsService.castTextVote,
  { ...RateLimitPresets.socialAction, key: 'polls:textVote' }
);

export const postStatusUpdate = withRateLimit(
  pollsService.postStatusUpdate,
  { maxRequests: 5, windowMs: 60_000, key: 'polls:statusUpdate' }
);

export const submitFeedback = withRateLimit(
  pollsService.submitFeedback,
  { maxRequests: 3, windowMs: 60_000, key: 'polls:feedback' }
);

export const deletePoll = pollsService.deletePoll;

// ============================================================================
// Groups Service (Rate Limited)
// ============================================================================

export const createGroup = withRateLimit(
  groupsService.createGroup,
  { ...RateLimitPresets.groupAction, key: 'groups:create' }
);

export const joinGroupByCode = withRateLimit(
  groupsService.joinGroupByCode,
  { ...RateLimitPresets.groupAction, key: 'groups:join' }
);

export const regenerateInviteCode = withRateLimit(
  groupsService.regenerateInviteCode,
  { maxRequests: 3, windowMs: 300_000, key: 'groups:regenerateCode' } // 3 per 5 min
);

export const getMyGroups = groupsService.getMyGroups;
export const getGroupMembers = groupsService.getGroupMembers;

// ============================================================================
// Following Service (Rate Limited)
// ============================================================================

export const followUser = withRateLimit(
  followingService.followUser,
  { ...RateLimitPresets.socialAction, key: 'following:follow' }
);

export const unfollowUser = withRateLimit(
  followingService.unfollowUser,
  { ...RateLimitPresets.socialAction, key: 'following:unfollow' }
);

export const getFollowing = followingService.getFollowing;
export const getFollowers = followingService.getFollowers;
export const isFollowing = followingService.isFollowing;
export const getFollowingCount = followingService.getFollowingCount;
export const getFollowersCount = followingService.getFollowersCount;

export const discoverOrganizations = withRateLimit(
  followingService.discoverOrganizations,
  { maxRequests: 20, windowMs: 60_000, key: 'following:discover' }
);

export const searchOrganizations = withRateLimit(
  followingService.searchOrganizations,
  { ...RateLimitPresets.search, key: 'following:search' }
);

// ============================================================================
// Blocking Service (Rate Limited)
// ============================================================================

export const blockUser = withRateLimit(
  blockingService.blockUser,
  { maxRequests: 10, windowMs: 60_000, key: 'blocking:block' }
);

export const unblockUser = blockingService.unblockUser;
export const isUserBlocked = blockingService.isUserBlocked;
export const getBlockedUsers = blockingService.getBlockedUsers;
export const getBlockedByUsers = blockingService.getBlockedByUsers;
export const filterBlockedUsers = blockingService.filterBlockedUsers;
export const isBlockedBy = blockingService.isBlockedBy;
export const getBlockStatus = blockingService.getBlockStatus;

// ============================================================================
// Reports Service (Rate Limited)
// ============================================================================

export const reportEvent = withRateLimit(
  reportsService.reportEvent,
  { ...RateLimitPresets.report, key: 'reports:event' }
);

export const getEventReports = reportsService.getEventReports; // Admin only
export const resolveReport = reportsService.resolveReport; // Admin only
export const getUserReports = reportsService.getUserReports; // Admin only

// ============================================================================
// Availability Service (Rate Limited)
// ============================================================================

export const getGroupAvailability = availabilityService.getGroupAvailability;
export const computeWindow = availabilityService.computeWindow;

export const replaceMyAvailability = withRateLimit(
  availabilityService.replaceMyAvailability,
  { maxRequests: 5, windowMs: 60_000, key: 'availability:replace' }
);

export const getGroupAvailabilitySummary = availabilityService.getGroupAvailabilitySummary;

// ============================================================================
// Profile Service (Rate Limited)
// ============================================================================

export const ensureProfile = profileService.ensureProfile;
export const getOnboarding = profileService.getOnboarding;

export const saveOnboarding = withRateLimit(
  profileService.saveOnboarding,
  { maxRequests: 5, windowMs: 60_000, key: 'profile:saveOnboarding' }
);

// ============================================================================
// Decisions Service (Rate Limited)
// ============================================================================

export const upsertDecisionPrefs = withRateLimit(
  decisionsService.upsertDecisionPrefs,
  { maxRequests: 10, windowMs: 60_000, key: 'decisions:upsert' }
);

export const getDecisionPrefs = decisionsService.getDecisionPrefs;
export const getRecommendationsForPoll = decisionsService.getRecommendationsForPoll;

// ============================================================================
// Privacy Service (Rate Limited)
// ============================================================================

export const getUserSettings = privacyService.getUserSettings;

export const updateUserSettings = withRateLimit(
  privacyService.updateUserSettings,
  { maxRequests: 10, windowMs: 60_000, key: 'privacy:update' }
);

export const getOrCreateUserSettings = privacyService.getOrCreateUserSettings;
export const canShowActivityToUser = privacyService.canShowActivityToUser;
export const canReceiveFriendRequest = privacyService.canReceiveFriendRequest;
export const filterVisibleActivity = privacyService.filterVisibleActivity;
export const getPrivacyAwareFriendCounts = privacyService.getPrivacyAwareFriendCounts;

// ============================================================================
// Admin Service (Rate Limited - extra protection)
// ============================================================================

export const suspendUser = withRateLimit(
  adminService.suspendUser,
  { maxRequests: 10, windowMs: 60_000, key: 'admin:suspend' }
);

export const banUser = withRateLimit(
  adminService.banUser,
  { maxRequests: 5, windowMs: 60_000, key: 'admin:ban' }
);

export const unsuspendUser = adminService.unsuspendUser;
export const unbanUser = adminService.unbanUser;
export const checkUserStatus = adminService.checkUserStatus;

// ============================================================================
// Utility Exports
// ============================================================================

export { RateLimitError };

/**
 * Helper to execute any function with a specific rate limiter
 */
export async function executeWithLimit<T>(
  limiterKey: keyof typeof Limiters,
  fn: () => Promise<T>
): Promise<T> {
  const limiter = Limiters[limiterKey];
  return limiter.execute(fn);
}

/**
 * Check if any limiter is currently blocking
 */
export async function getRateLimitStatus(): Promise<Record<string, { remaining: number; resetMs: number }>> {
  const status: Record<string, { remaining: number; resetMs: number }> = {};
  
  for (const [key, limiter] of Object.entries(Limiters)) {
    status[key] = await limiter.getInfo();
  }
  
  return status;
}

/**
 * Types re-exported for convenience
 */
export type {
  PendingFriendRequest,
  SentFriendRequest,
} from './friends';

export type {
  ScoredEvent,
  EventInput,
} from './events';

export type {
  PollOptionView,
} from './polls';

export type {
  DecisionPrefs,
} from './decisions';

export type {
  SlotKey,
  AvailabilityWindow,
  GroupAvailability,
  GroupAvailabilitySummary,
  AvailabilitySummarySlot,
} from './availability';

export type {
  OnboardingPayload,
} from './profile';

