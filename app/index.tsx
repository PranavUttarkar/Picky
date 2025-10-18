import { Redirect } from 'expo-router';

// Default route: always go straight to Home tab (prevents blank root on web)
export default function Index() {
  return <Redirect href="/home" />;
}
