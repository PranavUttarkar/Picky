import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { supabase } from '@/services/supabase';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useThemeColors();
  return (
    <View style={{ backgroundColor: c.card, borderRadius: 12, padding: 12, marginBottom: 12 }}>
      <Text style={{ color: c.muted, fontWeight: '700', marginBottom: 6 }}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 }}>
      <Text style={{ color: c.text }}>{left}</Text>
      <Text style={{ color: c.muted }}>{right}</Text>
    </View>
  );
}

export default function AdminAnalytics() {
  const c = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [dailyCounts, setDailyCounts] = useState<any[]>([]);
  const [screenDaily, setScreenDaily] = useState<any[]>([]);
  const [ctaDaily, setCtaDaily] = useState<any[]>([]);
  const [activeUsersDaily, setActiveUsersDaily] = useState<any[]>([]);
  const [sharesDaily, setSharesDaily] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const { data: u } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      const admin = !!(u as any)?.is_admin;
      if (!mounted) return;
      setIsAdmin(admin);
      if (!admin) {
        setLoading(false);
        return;
      }

      // Fetch last 14 days for each view
      const since = new Date();
      since.setDate(since.getDate() - 14);
      const sinceIso = since.toISOString();

      const [dc, sv, ct, au, sh] = await Promise.all([
        supabase
          .from('analytics_events_daily_counts')
          .select('*')
          .gte('day', sinceIso)
          .order('day', { ascending: false }),
        supabase
          .from('analytics_screen_views_daily')
          .select('*')
          .gte('day', sinceIso)
          .order('day', { ascending: false }),
        supabase
          .from('analytics_cta_daily')
          .select('*')
          .gte('day', sinceIso)
          .order('day', { ascending: false }),
        supabase
          .from('analytics_active_users_daily')
          .select('*')
          .gte('day', sinceIso)
          .order('day', { ascending: false }),
        supabase
          .from('analytics_shares_daily')
          .select('*')
          .gte('day', sinceIso)
          .order('day', { ascending: false }),
      ]);

      if (!mounted) return;
      setDailyCounts(dc.data ?? []);
      setScreenDaily(sv.data ?? []);
      setCtaDaily(ct.data ?? []);
      setActiveUsersDaily(au.data ?? []);
      setSharesDaily(sh.data ?? []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <GradientBackground contentContainerStyle={{ flex: 1, padding: 16 }}>
        <AnimatedPage
          variant="pop"
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator />
        </AnimatedPage>
      </GradientBackground>
    );
  }

  if (!isAdmin) {
    return (
      <GradientBackground contentContainerStyle={{ flex: 1, padding: 16 }}>
        <AnimatedPage
          variant="pop"
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: c.muted }}>403 — Admins only</Text>
        </AnimatedPage>
      </GradientBackground>
    );
  }

  // Aggregate quick KPIs: today/7-day rollups
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayStr = today.toISOString();

  const sum = (rows: any[], f: (r: any) => number) => rows.reduce((a, r) => a + (f(r) || 0), 0);

  const dau7 = sum(
    activeUsersDaily.filter((r) => Date.parse(r.day) >= today.getTime() - 6 * 86400000),
    (r) => Number(r.users),
  );
  const eventsToday = sum(
    dailyCounts.filter((r) => Date.parse(r.day) >= today.getTime()),
    (r) => Number(r.count),
  );

  return (
    <GradientBackground contentContainerStyle={{ flex: 1, padding: 16 }}>
      <AnimatedPage variant="pop" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '900', marginBottom: 12 }}>
            Analytics (Admin)
          </Text>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Card title="Events Today">
              <Text style={{ color: c.text, fontSize: 24, fontWeight: '900' }}>{eventsToday}</Text>
            </Card>
            <Card title="7-day Active Users (sum)">
              <Text style={{ color: c.text, fontSize: 24, fontWeight: '900' }}>{dau7}</Text>
            </Card>
          </View>

          <Card title="Daily Active Users (last 14 days)">
            {activeUsersDaily.length === 0 ? (
              <Text style={{ color: c.muted }}>No data yet</Text>
            ) : (
              activeUsersDaily.map((r, i) => (
                <Row key={i} left={new Date(r.day).toDateString()} right={String(r.users)} />
              ))
            )}
          </Card>

          <Card title="Top Screens (last 14 days)">
            {screenDaily.length === 0 ? (
              <Text style={{ color: c.muted }}>No data yet</Text>
            ) : (
              screenDaily
                .slice(0, 20)
                .map((r, i) => (
                  <Row
                    key={i}
                    left={`${new Date(r.day).toDateString()} • ${r.screen || 'unknown'}`}
                    right={String(r.count)}
                  />
                ))
            )}
          </Card>

          <Card title="CTA Clicks (last 14 days)">
            {ctaDaily.length === 0 ? (
              <Text style={{ color: c.muted }}>No data yet</Text>
            ) : (
              ctaDaily
                .slice(0, 20)
                .map((r, i) => (
                  <Row
                    key={i}
                    left={`${new Date(r.day).toDateString()} • ${r.name}`}
                    right={String(r.count)}
                  />
                ))
            )}
          </Card>

          <Card title="Shares (last 14 days)">
            {sharesDaily.length === 0 ? (
              <Text style={{ color: c.muted }}>No data yet</Text>
            ) : (
              sharesDaily.map((r, i) => (
                <Row
                  key={i}
                  left={`${new Date(r.day).toDateString()} • ${r.event}`}
                  right={String(r.count)}
                />
              ))
            )}
          </Card>

          <Card title="All Events Daily (last 14 days)">
            {dailyCounts.length === 0 ? (
              <Text style={{ color: c.muted }}>No data yet</Text>
            ) : (
              dailyCounts.map((r, i) => (
                <Row
                  key={i}
                  left={`${new Date(r.day).toDateString()} • ${r.event}`}
                  right={String(r.count)}
                />
              ))
            )}
          </Card>
        </ScrollView>
      </AnimatedPage>
    </GradientBackground>
  );
}
