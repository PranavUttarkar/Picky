import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { supabase } from "@/services/supabase";
import { ensureProfile } from "@/services/profile";

export default function Index() {
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await ensureProfile();
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        setSession(sess);
        if (sess) await ensureProfile();
      }
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return null;
  if (!session) return <Redirect href="/onboarding/welcome" />;
  return <Redirect href="/(tabs)/home" />;
}
