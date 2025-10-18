import { Redirect } from 'expo-router';

// Web-safe 404: send users back to Home to avoid blank pages
export default function NotFound() {
  return <Redirect href="/home" />;
}
