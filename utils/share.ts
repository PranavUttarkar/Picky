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
