import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import GradientBackground from '@/components/GradientBackground';
import { useThemeColors } from '@/theme/ThemeProvider';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/services/supabase';
import {
	upsertDecisionPrefs,
	getDecisionPrefs,
	getRecommendationsForPoll,
} from '../../../services/decisions';
import { joinGroupByCode } from '@/services/groups';

export default function DecisionRoom() {
	const c = useThemeColors();
	const { id, code } = useLocalSearchParams<{ id: string; code?: string }>();
	const pollId = Number(id);
	const [budget, setBudget] = useState(50); // 0-100
	const [timePref, setTimePref] = useState<'evening' | 'late' | 'flex'>('evening');
	const [radius, setRadius] = useState(5); // miles
	const [needs, setNeeds] = useState<string[]>([]);
	const [notes, setNotes] = useState('');
	const [loading, setLoading] = useState(true);
	const [recs, setRecs] = useState<any[] | null>(null);
	const [inviteCode, setInviteCode] = useState<string | null>(null);
	const [groupId, setGroupId] = useState<number | null>(null);

	useEffect(() => {
		(async () => {
			const user = (await supabase.auth.getUser()).data.user;
			if (!user) {
				router.replace('/onboarding/welcome');
				return;
			}
			// Fetch group + invite code
			const { data: poll } = await supabase
				.from('polls')
				.select('group_id, group:groups!polls_group_id_fkey(invite_code)')
				.eq('id', pollId)
				.maybeSingle();
			const gid = (poll as any)?.group_id as number | undefined;
			setGroupId(gid ?? null);
			setInviteCode(((poll as any)?.group as any)?.invite_code ?? null);

			// If invite code present, attempt to join
			if (code && typeof code === 'string' && code.trim()) {
				try {
					await joinGroupByCode(code.trim());
				} catch {}
			}

			const existing = await getDecisionPrefs(pollId);
			if (existing) {
				setBudget(existing.budget ?? 50);
				setTimePref((existing.time_pref as any) ?? 'evening');
				setRadius(existing.radius_miles ?? 5);
				setNeeds(existing.needs ?? []);
				setNotes(existing.notes ?? '');
			}
			setLoading(false);
			// Prefetch recs in background
			getRecommendationsForPoll(pollId)
				.then(setRecs)
				.catch(() => setRecs([]));
		})();
	}, [pollId]);

	const toggleNeed = (t: string) => {
		setNeeds((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
	};

	const save = async () => {
		try {
			await upsertDecisionPrefs(pollId, {
				budget,
				time_pref: timePref,
				radius_miles: radius,
				needs,
				notes,
			});
			Alert.alert('Saved', "Thanks! We'll tailor options to the group.");
		} catch (e: any) {
			Alert.alert('Save failed', e.message ?? String(e));
		}
	};

	return (
		<GradientBackground variant="dim">
			<ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
				<Text style={{ color: c.text, fontSize: 24, fontWeight: '900' }}>Decision Room</Text>
				<Text style={{ color: c.muted, marginTop: 6 }}>Help us figure this out 🎉</Text>

				{/* Invite/share row */}
				<View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
					{inviteCode ? (
						<Pressable
							onPress={async () => {
								try {
									await Clipboard.setStringAsync(inviteCode);
									Alert.alert('Copied', 'Invite code copied to clipboard');
								} catch {}
							}}
							style={{
								backgroundColor: c.card,
								paddingHorizontal: 12,
								paddingVertical: 8,
								borderRadius: 10,
							}}
						>
							<Text style={{ color: c.text, fontWeight: '700' }}>Copy invite code</Text>
						</Pressable>
					) : null}
					<Pressable
						onPress={async () => {
							try {
								const url = Linking.createURL(
									`/(tabs)/decisions/${pollId}${inviteCode ? `?code=${inviteCode}` : ''}`,
								);
								try {
									await Clipboard.setStringAsync(url);
									Alert.alert('Link copied', 'Share this decision room link');
								} catch {}
							} catch {
								Alert.alert('Share', 'Unable to copy link');
							}
						}}
						style={{
							backgroundColor: c.primary,
							paddingHorizontal: 12,
							paddingVertical: 8,
							borderRadius: 10,
						}}
					>
						<Text style={{ color: '#000', fontWeight: '900' }}>Share link</Text>
					</Pressable>
				</View>

				{/* Budget */}
				<View style={{ backgroundColor: c.card, padding: 16, borderRadius: 14, marginTop: 16 }}>
					<Text style={{ color: c.text, fontWeight: '800' }}>Budget</Text>
					<Text style={{ color: c.muted, marginTop: 4 }}>Low 💸 to High 💵</Text>
					<View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
						{[
							{ v: 20, label: 'Low' },
							{ v: 50, label: 'Medium' },
							{ v: 80, label: 'High' },
						].map((b) => (
							<Pressable
								key={b.v}
								onPress={() => setBudget(b.v)}
								style={{
									paddingHorizontal: 10,
									paddingVertical: 8,
									borderRadius: 10,
									backgroundColor: budget === b.v ? c.primary : c.background,
								}}
							>
								<Text style={{ color: c.text }}>{b.label}</Text>
							</Pressable>
						))}
					</View>
				</View>

				{/* Time */}
				<View style={{ backgroundColor: c.card, padding: 16, borderRadius: 14, marginTop: 12 }}>
					<Text style={{ color: c.text, fontWeight: '800' }}>Time</Text>
					<View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
						{[
							{ k: 'evening', label: 'Evening' },
							{ k: 'late', label: 'Late night' },
							{ k: 'flex', label: 'Flexible' },
						].map((opt) => (
							<Pressable
								key={opt.k}
								onPress={() => setTimePref(opt.k as any)}
								style={{
									paddingHorizontal: 10,
									paddingVertical: 8,
									borderRadius: 10,
									backgroundColor: timePref === (opt.k as any) ? c.primary : c.background,
								}}
							>
								<Text style={{ color: c.text }}>{opt.label}</Text>
							</Pressable>
						))}
					</View>
				</View>

				{/* Location radius */}
				<View style={{ backgroundColor: c.card, padding: 16, borderRadius: 14, marginTop: 12 }}>
					<Text style={{ color: c.text, fontWeight: '800' }}>Location radius</Text>
					<View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
						{[5, 10, 25].map((mi) => (
							<Pressable
								key={mi}
								onPress={() => setRadius(mi)}
								style={{
									paddingHorizontal: 10,
									paddingVertical: 8,
									borderRadius: 10,
									backgroundColor: radius === mi ? c.primary : c.background,
								}}
							>
								<Text style={{ color: c.text }}>{mi} mi</Text>
							</Pressable>
						))}
						<Pressable
							onPress={() => setRadius(1000)}
							style={{
								paddingHorizontal: 10,
								paddingVertical: 8,
								borderRadius: 10,
								backgroundColor: radius > 25 ? c.primary : c.background,
							}}
						>
							<Text style={{ color: c.text }}>Anywhere</Text>
						</Pressable>
					</View>
				</View>

				{/* Needs */}
				<View style={{ backgroundColor: c.card, padding: 16, borderRadius: 14, marginTop: 12 }}>
					<Text style={{ color: c.text, fontWeight: '800' }}>Dietary / Activity</Text>
					<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
						{[
							{ k: 'veg', label: 'Vegetarian 🌱' },
							{ k: 'noalc', label: 'No alcohol 🚫🍸' },
							{ k: 'outdoor', label: 'Outdoor 🌳' },
							{ k: 'dance', label: 'Dancing 💃' },
						].map((n) => {
							const active = needs.includes(n.k);
							return (
								<Pressable
									key={n.k}
									onPress={() => toggleNeed(n.k)}
									style={{
										paddingHorizontal: 10,
										paddingVertical: 8,
										borderRadius: 999,
										backgroundColor: active ? c.primary : c.background,
									}}
								>
									<Text style={{ color: c.text }}>{n.label}</Text>
								</Pressable>
							);
						})}
					</View>
				</View>

				{/* Notes */}
				<View style={{ backgroundColor: c.card, padding: 16, borderRadius: 14, marginTop: 12 }}>
					<Text style={{ color: c.text, fontWeight: '800' }}>Special requests</Text>
					<TextInput
						placeholder="I hate loud places"
						placeholderTextColor={c.muted}
						value={notes}
						onChangeText={setNotes}
						style={{
							marginTop: 8,
							backgroundColor: '#00000020',
							color: c.text,
							borderRadius: 10,
							paddingHorizontal: 10,
							paddingVertical: 8,
						}}
						multiline
					/>
				</View>

				<View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
					<Pressable
						onPress={save}
						style={{
							backgroundColor: c.primary,
							paddingHorizontal: 14,
							paddingVertical: 10,
							borderRadius: 10,
						}}
					>
						<Text style={{ color: '#000', fontWeight: '900' }}>I’m in!</Text>
					</Pressable>
					<Pressable
						onPress={() => router.replace(`/(tabs)/polls/${pollId}`)}
						style={{
							backgroundColor: c.background,
							paddingHorizontal: 14,
							paddingVertical: 10,
							borderRadius: 10,
						}}
					>
						<Text style={{ color: c.text, fontWeight: '700' }}>View options</Text>
					</Pressable>
				</View>

				{/* Recommendations preview */}
				{recs ? (
					<View style={{ marginTop: 16 }}>
						<Text style={{ color: c.text, fontWeight: '800' }}>Recommended</Text>
						{recs.length ? (
							<View style={{ marginTop: 8, gap: 8 }}>
								{recs.map((r) => (
									<View
										key={r.id}
										style={{ backgroundColor: c.card, padding: 12, borderRadius: 12 }}
									>
										<Text style={{ color: c.text, fontWeight: '700' }}>{r.title}</Text>
										<Text style={{ color: c.muted, marginTop: 4 }}>
											{new Date(r.date_time).toLocaleString()} • {r.location}
										</Text>
										{r.match_percent != null ? (
											<Text style={{ color: c.muted, marginTop: 4 }}>{r.match_percent}% match</Text>
										) : null}
									</View>
								))}
							</View>
						) : (
							<Text style={{ color: c.muted, marginTop: 8 }}>
								We’ll suggest options based on everyone’s prefs.
							</Text>
						)}
					</View>
				) : null}
			</ScrollView>
		</GradientBackground>
	);
}
