import { Platform, Share } from 'react-native';
import * as Linking from 'expo-linking';

/**
 * Build a deep link (native scheme) and optional universal/web link for sharing events.
 * Currently we only have scheme in app.json ("picky"). If you later add a domain, update WEB_BASE.
 */
const WEB_BASE = 'https://usepicky.app'; // updated domain

export function buildEventShareLinks(eventId: number) {
  // expo-linking createURL ensures proper prefix for scheme + path
  const path = `/events/${eventId}`;
  // createURL may add scheme:// for native and relative for web
  const appUrl = Linking.createURL(path);
  const webUrl = `${WEB_BASE}/e/${eventId}`; // could redirect server-side to /events/<id>
  return { appUrl, webUrl };
}

export async function shareEvent(event: { id: number; title: string }) {
  const { appUrl, webUrl } = buildEventShareLinks(event.id);
  const message = `${event.title}\n${Platform.select({ web: webUrl, default: appUrl })}`;
  try {
    await Share.share({
      message,
      url: appUrl, // iOS uses this field
      title: event.title,
    });
  } catch (e) {
    console.warn('Share failed', e);
  }
  return { appUrl, webUrl };
}

// Groups: build and share invite links
export function buildGroupShareLinks(inviteCode: string) {
  const path = `/invite?code=${encodeURIComponent(inviteCode)}`;
  const appUrl = Linking.createURL(path);
  const webUrl = `${WEB_BASE}${path}`; // web points to the same SPA route
  return { appUrl, webUrl };
}

export async function shareGroup(group: { name?: string | null; invite_code: string }) {
  const title = group?.name ? `Join ${group.name} on Picky` : 'Join my group on Picky';
  const { appUrl, webUrl } = buildGroupShareLinks(group.invite_code);
  const link = Platform.select({ web: webUrl, default: appUrl });
  const message = `${title}\n${link}`;
  try {
    await Share.share({ message, url: appUrl, title });
  } catch (e) {
    console.warn('Share failed', e);
  }
  return { appUrl, webUrl };
}

// Quick Pick sessions: build and share invite links with quick pick flag
export function buildQuickPickShareLinks(inviteCode: string) {
  const path = `/invite?code=${encodeURIComponent(inviteCode)}&quickPick=true`;
  const appUrl = Linking.createURL(path);
  const webUrl = `${WEB_BASE}${path}`;
  return { appUrl, webUrl };
}

export async function shareQuickPickSession(session: { name?: string | null; inviteCode: string }, inviterName?: string) {
  const who = inviterName ? `${inviterName} invited you` : "You're invited";
  const title = `🤝 ${who} to make a quick decision!`;
  const { appUrl, webUrl } = buildQuickPickShareLinks(session.inviteCode);
  const link = Platform.select({ web: webUrl, default: appUrl });
  
  const message = `${title}\n\nJoin "${session.name || 'Quick Pick'}" on Picky - find the perfect plan in 60 seconds!\n\n${link}`;
  
  try {
    await Share.share({ message, url: appUrl, title });
  } catch (e) {
    console.warn('Share failed', e);
  }
  return { appUrl, webUrl };
}
