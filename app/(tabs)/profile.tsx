import { 
  View, 
  Text, 
  Pressable, 
  TextInput, 
  ActivityIndicator, 
  ScrollView,
  Image,
  Alert,
  useWindowDimensions,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import dayjs from 'dayjs';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { supabase } from '@/services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useCallback, memo } from 'react';
import { router } from 'expo-router';
import { trackCTA, trackEvent } from '@/utils/analytics';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { updateUserProfile, checkUsernameAvailability, updateUsername } from '@/services/friends';
import { checkProfanity } from '@/utils/profanity';
import Avatar from '@/components/Avatar';
import type { UserProfile } from '@/types/models';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Modern Tag Component
const ModernTag = memo(function ModernTag({ 
  tag, 
  onRemove, 
  variant = 'primary' 
}: { 
  tag: string; 
  onRemove: (tag: string) => void;
  variant?: 'primary' | 'secondary';
}) {
  const c = useThemeColors();
  
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: variant === 'primary' ? `${c.primary}20` : `${c.accent}20`,
      borderWidth: 1,
      borderColor: variant === 'primary' ? `${c.primary}40` : `${c.accent}40`,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
    }}>
      <Text style={{ 
        color: variant === 'primary' ? c.primary : c.accent, 
        fontSize: 13, 
        fontWeight: '600' 
      }}>
        {tag}
      </Text>
      <Pressable
        onPress={() => onRemove(tag)}
        hitSlop={8}
        style={{
          backgroundColor: variant === 'primary' ? `${c.primary}30` : `${c.accent}30`,
          borderRadius: 10,
          width: 20,
          height: 20,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons 
          name="close" 
          size={12} 
          color={variant === 'primary' ? c.primary : c.accent} 
        />
      </Pressable>
    </View>
  );
});

// Modern Section Card
const SectionCard = memo(function SectionCard({ 
  children, 
  title, 
  subtitle,
  icon 
}: { 
  children: React.ReactNode; 
  title: string;
  subtitle?: string;
  icon?: string;
}) {
  const c = useThemeColors();
  
  return (
    <View style={{
      backgroundColor: c.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    }}>
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginBottom: subtitle ? 8 : 16 
      }}>
        {icon && (
          <View style={{
            backgroundColor: `${c.primary}15`,
            borderRadius: 10,
            padding: 8,
            marginRight: 12,
          }}>
            <Ionicons name={icon as any} size={20} color={c.primary} />
          </View>
        )}
        <Text style={{ 
          color: c.text, 
          fontSize: 18, 
          fontWeight: '700',
          flex: 1,
        }}>
          {title}
        </Text>
      </View>
      {subtitle && (
        <Text style={{ 
          color: c.muted, 
          fontSize: 14, 
          marginBottom: 16,
          lineHeight: 20,
        }}>
          {subtitle}
        </Text>
      )}
      {children}
    </View>
  );
});

// Action Button Component
const ActionButton = memo(function ActionButton({
  title,
  subtitle,
  icon,
  onPress,
  variant = 'default',
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
  variant?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}) {
  const c = useThemeColors();
  
  const getColors = () => {
    if (disabled) return { bg: c.muted, text: '#fff', icon: '#fff' };
    switch (variant) {
      case 'primary':
        return { bg: c.primary, text: '#fff', icon: '#fff' };
      case 'danger':
        return { bg: '#ef4444', text: '#fff', icon: '#fff' };
      default:
        return { bg: `${c.text}10`, text: c.text, icon: c.text };
    }
  };
  
  const colors = getColors();
  
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: colors.bg,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <View style={{
        backgroundColor: variant === 'default' ? `${c.primary}20` : 'rgba(255,255,255,0.2)',
        borderRadius: 10,
        padding: 8,
        marginRight: 12,
      }}>
        <Ionicons 
          name={icon as any} 
          size={20} 
          color={variant === 'default' ? c.primary : colors.icon} 
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ 
          color: colors.text, 
          fontSize: 16, 
          fontWeight: '600',
          marginBottom: subtitle ? 2 : 0,
        }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{ 
            color: variant === 'default' ? c.muted : 'rgba(255,255,255,0.8)', 
            fontSize: 13 
          }}>
            {subtitle}
          </Text>
        )}
      </View>
      <Ionicons 
        name="chevron-forward" 
        size={20} 
        color={variant === 'default' ? c.muted : 'rgba(255,255,255,0.6)'} 
      />
    </Pressable>
  );
});

// Username Edit Modal
const UsernameEditModal = memo(function UsernameEditModal({
  visible,
  onClose,
  currentUsername,
  onSave,
  canEditUsername,
  nextAllowedDate,
}: {
  visible: boolean;
  onClose: () => void;
  currentUsername: string;
  onSave: (newUsername: string) => Promise<void>;
  canEditUsername: boolean;
  nextAllowedDate: Date | null;
}) {
  const c = useThemeColors();
  const [newUsername, setNewUsername] = useState(currentUsername);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (visible) {
      setNewUsername(currentUsername);
      setError(null);
      setIsAvailable(null);
    }
  }, [visible, currentUsername]);

  // Check username availability with debounce
  useEffect(() => {
    if (!newUsername.trim() || newUsername === currentUsername) {
      setIsAvailable(null);
      return;
    }

    if (newUsername.length < 3) {
      setError('Username must be at least 3 characters');
      setIsAvailable(false);
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      setError('Username can only contain letters, numbers, and underscores');
      setIsAvailable(false);
      return;
    }

    // Check for profanity
    const profanityCheck = checkProfanity(newUsername);
    if (!profanityCheck.isClean) {
      setError('Username contains inappropriate content');
      setIsAvailable(false);
      return;
    }

    setError(null);
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const available = await checkUsernameAvailability(newUsername.toLowerCase());
        setIsAvailable(available);
        if (!available) {
          setError('Username is already taken');
        }
      } catch (error) {
        console.error('Error checking username:', error);
        setError('Error checking username availability');
        setIsAvailable(false);
      } finally {
        setChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [newUsername, currentUsername]);

  const handleSave = async () => {
    if (!newUsername.trim() || !isAvailable || saving) return;

    setSaving(true);
    try {
      await onSave(newUsername.toLowerCase());
      onClose();
    } catch (error: any) {
      setError(error.message || 'Failed to update username');
    } finally {
      setSaving(false);
    }
  };

  const canSave = canEditUsername &&
                  newUsername.trim() && 
                  newUsername !== currentUsername && 
                  isAvailable === true && 
                  !error && 
                  !checking && 
                  !saving;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View style={{
          backgroundColor: c.background,
          margin: 20,
          padding: 24,
          borderRadius: 16,
          width: '90%',
          maxWidth: 400,
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 20,
          }}>
            <Text style={{
              fontSize: 20,
              fontWeight: '700',
              color: c.text,
              flex: 1,
            }}>
              Change Username
            </Text>
            <Pressable
              onPress={onClose}
              style={{ padding: 8 }}
            >
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
          </View>

          <Text style={{
            fontSize: 14,
            color: c.muted,
            marginBottom: 12,
            lineHeight: 20,
          }}>
            You can change your username once every 7 days. It can only contain letters, numbers, and underscores.
          </Text>
          {!canEditUsername && (
            <Text style={{
              fontSize: 13,
              color: '#ef4444',
              marginBottom: 12,
            }}>
              You changed your username recently. You can edit again on {nextAllowedDate ? dayjs(nextAllowedDate).format('MMM D, YYYY') : 'later'}.
            </Text>
          )}

          <View style={{ position: 'relative', marginBottom: 16 }}>
            <TextInput
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder={canEditUsername ? 'Enter new username' : 'Username locked'}
              placeholderTextColor={c.muted}
              editable={canEditUsername}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: c.card,
                padding: 16,
                borderRadius: 12,
                color: c.text,
                fontSize: 16,
                paddingRight: 50,
                opacity: canEditUsername ? 1 : 0.6,
                borderWidth: 2,
                borderColor: !canEditUsername ? c.muted : error ? '#ef4444' : 
                           isAvailable === true ? '#10b981' : 
                           isAvailable === false ? '#ef4444' : c.muted,
              }}
            />
            <View style={{
              position: 'absolute',
              right: 16,
              top: 16,
              bottom: 16,
              justifyContent: 'center',
            }}>
              {checking ? (
                <ActivityIndicator size="small" color={c.primary} />
              ) : isAvailable === true ? (
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              ) : isAvailable === false ? (
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              ) : null}
            </View>
          </View>

          {error && (
            <Text style={{ 
              color: '#ef4444', 
              fontSize: 14, 
              marginBottom: 16 
            }}>
              {error}
            </Text>
          )}

          {isAvailable === true && (
            <Text style={{ 
              color: '#10b981', 
              fontSize: 14, 
              marginBottom: 16 
            }}>
              Username is available!
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                backgroundColor: c.card,
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: c.text, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={{
                flex: 1,
                backgroundColor: canSave ? c.primary : c.muted,
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: 'center',
                opacity: canSave ? 1 : 0.6,
              }}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>
                {saving ? 'Saving...' : canEditUsername ? 'Save' : 'Locked'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

export default function Profile() {
  const c = useThemeColors();
  const { scheme, setScheme } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 768;
  
  // Auth & User State
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  
  // Avatar State
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Username Edit State
  const [showUsernameEdit, setShowUsernameEdit] = useState(false);
  
  // Interests State
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [foodTags, setFoodTags] = useState<string[]>([]);
  const [foodNewInput, setFoodNewInput] = useState('');
  
  // Loading States
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [loadingFoodInterests, setLoadingFoodInterests] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingFood, setSavingFood] = useState(false);
  // Server timestamp drives cooldown logic; stored in userProfile.username_last_changed

  // Load user profile and data
  useEffect(() => {
    loadUserData();
    
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setAuthed(!!sess);
      if (sess?.user) {
        loadUserData();
      } else {
        setUserProfile(null);
        setTags([]);
        setFoodTags([]);
      }
    });
    
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadUserData = async () => {
    try {
      setLoadingProfile(true);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setAuthed(false);
        return;
      }
      
      setAuthed(true);
      
      // Load user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setUserProfile(profile);
        setIsAdmin(!!profile.is_admin);
        setAvatarUrl(profile.avatar_url);
      }
      
      // Load interests
      setLoadingInterests(true);
      const { data: interests } = await supabase
        .from('user_interests_temp')
        .select('names')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const interestNames: string[] = ((interests?.names as any) ?? [])
        .map((n: string) => n.toLowerCase());
      setTags(interestNames);
      setLoadingInterests(false);
      
      // Load food interests
      setLoadingFoodInterests(true);
      const { data: foodInterests } = await supabase
        .from('user_food_interests')
        .select('names')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const foodNames: string[] = ((foodInterests?.names as any) ?? [])
        .map((n: string) => n.toLowerCase());
      setFoodTags(foodNames);
      setLoadingFoodInterests(false);
      
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Avatar functions
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload an avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadAvatar = async (uri: string) => {
    try {
      setUploadingAvatar(true);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      // Create form data for upload
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'image/jpeg',
        name: `avatar-${user.id}.jpg`,
      } as any);

      // Upload to Supabase storage
      const fileName = `avatar-${user.id}-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, formData, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update user profile
      await updateUserProfile({ avatar_url: publicUrl });
      setAvatarUrl(publicUrl);
      
      Alert.alert('Success', 'Avatar updated successfully!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Error', 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Username functions
  const handleUsernameUpdate = async (newUsername: string) => {
    try {
      await updateUsername(newUsername.toLowerCase());
      // Refetch minimal profile fields to get updated timestamp
      const { data: refreshed } = await supabase
        .from('users')
        .select('*')
        .eq('id', userProfile?.id)
        .single();
      if (refreshed) setUserProfile(refreshed as any);
      Alert.alert('Success', 'Username updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update username');
      throw error;
    }
  };

  // Tag management functions
  const addTag = (input: string, isFood: boolean = false) => {
    if (!input.trim()) return;
    
    const newTags = input
      .split(/[\n,]/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 24);
    
    if (isFood) {
      setFoodTags(prev => [...new Set([...prev, ...newTags])].slice(0, 24));
    } else {
      setTags(prev => [...new Set([...prev, ...newTags])].slice(0, 24));
    }
  };

  const removeTag = (tag: string, isFood: boolean = false) => {
    if (isFood) {
      setFoodTags(prev => prev.filter(t => t !== tag));
    } else {
      setTags(prev => prev.filter(t => t !== tag));
    }
  };

  const saveInterests = async (isFood: boolean = false) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      if (isFood) {
        setSavingFood(true);
        await supabase
          .from('user_food_interests')
          .upsert({ user_id: user.id, names: foodTags });
      } else {
        setSaving(true);
        await supabase
          .from('user_interests_temp')
          .upsert({ user_id: user.id, names: tags });
      }
    } catch (error) {
      console.error('Error saving interests:', error);
    } finally {
      if (isFood) {
        setSavingFood(false);
      } else {
        setSaving(false);
      }
    }
  };

  // Auto-save interests with debounce
  useEffect(() => {
    if (loadingInterests) return;
    const timer = setTimeout(() => saveInterests(false), 1000);
    return () => clearTimeout(timer);
  }, [tags, loadingInterests]);

  useEffect(() => {
    if (loadingFoodInterests) return;
    const timer = setTimeout(() => saveInterests(true), 1000);
    return () => clearTimeout(timer);
  }, [foodTags, loadingFoodInterests]);

  if (loadingProfile) {
    return (
      <GradientBackground>
        <AnimatedPage style={{ flex: 1 }}>
          <View style={{ 
            flex: 1, 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <ActivityIndicator size="large" color={c.primary} />
            <Text style={{ 
              color: c.text, 
              fontSize: 16, 
              marginTop: 16 
            }}>
              Loading profile...
            </Text>
          </View>
        </AnimatedPage>
      </GradientBackground>
    );
  }

  if (!authed) {
    return (
      <GradientBackground>
        <AnimatedPage style={{ flex: 1 }}>
          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{ 
              flexGrow: 1,
              justifyContent: 'center',
              paddingHorizontal: 20,
              paddingTop: insets.top + 20,
              paddingBottom: Math.max(insets.bottom, 20),
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ 
              alignItems: 'center',
              maxWidth: 400,
              alignSelf: 'center',
              width: '100%',
            }}>
              <View style={{
                backgroundColor: c.primary,
                borderRadius: 50,
                padding: 20,
                marginBottom: 24,
              }}>
                <Ionicons name="person" size={32} color="white" />
              </View>
              
              <Text style={{
                fontSize: 28,
                fontWeight: '700',
                color: c.text,
                textAlign: 'center',
                marginBottom: 12,
              }}>
                Welcome to Picky
              </Text>
              
              <Text style={{
                fontSize: 16,
                color: c.muted,
                textAlign: 'center',
                marginBottom: 32,
                lineHeight: 24,
              }}>
                Sign in to personalize your experience and connect with friends
              </Text>
              
              <Pressable
                onPress={() => {
                  trackCTA('profile_sign_in_press').catch(() => {});
                  router.push('/onboarding/welcome');
                }}
                style={{
                  backgroundColor: c.primary,
                  paddingVertical: 16,
                  paddingHorizontal: 32,
                  borderRadius: 12,
                  width: '100%',
                  alignItems: 'center',
                }}
              >
                <Text style={{ 
                  color: 'white', 
                  fontSize: 16,
                  fontWeight: '600' 
                }}>
                  Sign In or Sign Up
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </AnimatedPage>
      </GradientBackground>
    );
  }

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const lastChangedTs = userProfile?.username_last_changed ? new Date(userProfile.username_last_changed).getTime() : null;
  const canEditUsername = !lastChangedTs || (Date.now() - lastChangedTs) > SEVEN_DAYS_MS;
  const nextAllowedDate = lastChangedTs ? new Date(lastChangedTs + SEVEN_DAYS_MS) : null;

  return (
    <GradientBackground>
      <AnimatedPage style={{ flex: 1 }}>
        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ 
            paddingHorizontal: 20,
            paddingTop: insets.top + 20,
            paddingBottom: Math.max(insets.bottom, 40),
          }}
          showsVerticalScrollIndicator={false}
          bounces={true}
          alwaysBounceVertical={true}
        >
          {/* Profile Header */}
          <View style={{
            alignItems: 'center',
            marginBottom: 32,
            width: '100%',
          }}>
            {/* Avatar */}
            <View style={{ position: 'relative', marginBottom: 16 }}>
              <Avatar
                uri={avatarUrl}
                size={100}
                onPress={pickImage}
                showEditIcon={true}
                disabled={uploadingAvatar}
              />
              
              {uploadingAvatar && (
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderRadius: 50,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ActivityIndicator color="white" />
                </View>
              )}
            </View>
            
            {/* User Info */}
            <View style={{ position: 'relative', marginBottom: 4 }}>
              <Text style={{
                fontSize: 24,
                fontWeight: '700',
                color: c.text,
              }}>
                {userProfile?.display_name || userProfile?.username || 'User'}
              </Text>
              <Pressable
                onPress={() => {
                  if (canEditUsername) {
                    setShowUsernameEdit(true);
                  } else {
                    Alert.alert('Username Locked', `You can edit again on ${nextAllowedDate ? dayjs(nextAllowedDate).format('MMM D, YYYY') : 'later'}.`);
                  }
                }}
                accessibilityLabel="Edit username"
                hitSlop={8}
                style={{
                  position: 'absolute',
                  bottom: -5,
                  right: -30,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.15,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
                <Ionicons name="pencil" size={16} color={c.primary} />
              </Pressable>
            </View>
            
            {userProfile?.username && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginBottom: 6,
              }}>
                <Text style={{ fontSize: 16, color: c.muted }}>@{userProfile.username}</Text>
                <Text style={{ fontSize: 12, color: c.muted }}>
                  (Username can be changed once every 7 days)
                </Text>
              </View>
            )}
            {!canEditUsername && (
              <Text style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>
                Next edit available on {nextAllowedDate ? dayjs(nextAllowedDate).format('MMM D, YYYY') : ''}
              </Text>
            )}
            
            {userProfile?.email && (
              <Text style={{
                fontSize: 14,
                color: c.muted,
              }}>
                {userProfile.email}
              </Text>
            )}
          </View>

          {/* Quick Actions */}
          <View style={{ marginBottom: 24 }}>
            <ActionButton
              title="View Saved"
              subtitle="Events and restaurants you've saved"
              icon="heart"
              onPress={() => {
                trackCTA('profile_view_saved_press').catch(() => {});
                router.push('/(tabs)/saved');
              }}
            />
            
            <ActionButton
              title="My Events"
              subtitle="Events you've created"
              icon="create"
              onPress={() => {
                trackCTA('profile_view_my_events_press').catch(() => {});
                router.push('/(tabs)/my-events');
              }}
            />
            
            <ActionButton
              title="Privacy Settings"
              subtitle="Control your privacy and activity visibility"
              icon="shield-checkmark"
              onPress={() => {
                trackCTA('profile_privacy_settings_press').catch(() => {});
                router.push('/privacy-settings');
              }}
            />
            
            {isAdmin && (
              <ActionButton
                title="Admin Analytics"
                subtitle="View app analytics and insights"
                icon="stats-chart"
                onPress={() => router.push('/admin/analytics')}
              />
            )}
          </View>

          {/* Compact Appearance Toggle Row */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: c.card,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 10,
            marginBottom: 20,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="color-palette" size={20} color={c.primary} />
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>Appearance</Text>
            </View>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: `${c.text}08`,
              borderRadius: 30,
              padding: 4,
              gap: 4,
            }}>
              <Pressable
                onPress={() => { trackCTA('profile_theme_select', { value: 'light' }).catch(() => {}); setScheme('light'); }}
                style={{
                  backgroundColor: scheme === 'light' ? c.primary : 'transparent',
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 24,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="sunny" size={16} color={scheme === 'light' ? 'white' : c.text} />
                <Text style={{ color: scheme === 'light' ? 'white' : c.text, fontWeight: '600', fontSize: 13 }}>Light</Text>
              </Pressable>
              <Pressable
                onPress={() => { trackCTA('profile_theme_select', { value: 'dark' }).catch(() => {}); setScheme('dark'); }}
                style={{
                  backgroundColor: scheme === 'dark' ? c.primary : 'transparent',
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 24,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="moon" size={16} color={scheme === 'dark' ? 'white' : c.text} />
                <Text style={{ color: scheme === 'dark' ? 'white' : c.text, fontWeight: '600', fontSize: 13 }}>Dark</Text>
              </Pressable>
            </View>
          </View>

          {/* Interests Section */}
          <SectionCard
            title="Your Interests"
            subtitle="Add interests to get personalized recommendations"
            icon="heart"
          >
            {loadingInterests ? (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 16,
                backgroundColor: `${c.text}05`,
                borderRadius: 12,
              }}>
                <ActivityIndicator size="small" color={c.primary} />
                <Text style={{ color: c.muted }}>Loading interests...</Text>
              </View>
            ) : (
              <>
                {tags.length > 0 && (
                  <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 16,
                  }}>
                    {tags.map((tag) => (
                      <ModernTag
                        key={tag}
                        tag={tag}
                        onRemove={(t) => removeTag(t, false)}
                        variant="primary"
                      />
                    ))}
                  </View>
                )}
                
                <TextInput
                  value={newTagInput}
                  onChangeText={(val) => {
                    if (/[\n,]/.test(val)) {
                      addTag(val, false);
                      setNewTagInput('');
                    } else {
                      setNewTagInput(val);
                    }
                  }}
                  onSubmitEditing={() => {
                    if (newTagInput.trim()) {
                      addTag(newTagInput, false);
                      setNewTagInput('');
                    }
                  }}
                  placeholder={tags.length ? 'Add another interest...' : 'Add interests (e.g., music, sports)'}
                  placeholderTextColor={c.muted}
                  style={{
                    backgroundColor: `${c.text}08`,
                    borderRadius: 12,
                    padding: 16,
                    color: c.text,
                    fontSize: 16,
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                />
                
                {saving && (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 12,
                  }}>
                    <ActivityIndicator size="small" color={c.primary} />
                    <Text style={{ color: c.muted, fontSize: 14 }}>Saving...</Text>
                  </View>
                )}
              </>
            )}
          </SectionCard>

          {/* Food Interests Section */}
          <SectionCard
            title="Food Preferences"
            subtitle="Tell us about your favorite cuisines and foods"
            icon="restaurant"
          >
            {loadingFoodInterests ? (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 16,
                backgroundColor: `${c.text}05`,
                borderRadius: 12,
              }}>
                <ActivityIndicator size="small" color={c.accent} />
                <Text style={{ color: c.muted }}>Loading food preferences...</Text>
              </View>
            ) : (
              <>
                {foodTags.length > 0 && (
                  <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 16,
                  }}>
                    {foodTags.map((tag) => (
                      <ModernTag
                        key={tag}
                        tag={tag}
                        onRemove={(t) => removeTag(t, true)}
                        variant="primary" // Match style of Your Interests
                      />
                    ))}
                  </View>
                )}
                
                <TextInput
                  value={foodNewInput}
                  onChangeText={(val) => {
                    if (/[\n,]/.test(val)) {
                      addTag(val, true);
                      setFoodNewInput('');
                    } else {
                      setFoodNewInput(val);
                    }
                  }}
                  onSubmitEditing={() => {
                    if (foodNewInput.trim()) {
                      addTag(foodNewInput, true);
                      setFoodNewInput('');
                    }
                  }}
                  placeholder={foodTags.length ? 'Add another cuisine...' : 'Add cuisines (e.g., italian, mexican)'}
                  placeholderTextColor={c.muted}
                  style={{
                    backgroundColor: `${c.text}08`,
                    borderRadius: 12,
                    padding: 16,
                    color: c.text,
                    fontSize: 16,
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                />
                
                {savingFood && (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 12,
                  }}>
                    <ActivityIndicator size="small" color={c.accent} />
                    <Text style={{ color: c.muted, fontSize: 14 }}>Saving...</Text>
                  </View>
                )}
              </>
            )}
          </SectionCard>

          {/* Sign Out */}
          <Pressable
            onPress={async () => {
              Alert.alert(
                'Sign Out',
                'Are you sure you want to sign out?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                      trackCTA('profile_sign_out_press').catch(() => {});
                      await supabase.auth.signOut();
                    }
                  }
                ]
              );
            }}
            style={{
              backgroundColor: `${c.text}10`,
              borderRadius: 12,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <View style={{
              backgroundColor: '#dc2626',
              borderRadius: 10,
              padding: 8,
              marginRight: 12,
            }}>
              <Ionicons name="log-out" size={20} color={'white'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#dc2626', fontSize: 16, fontWeight: '600', marginBottom: 2 }}>
                Sign Out
              </Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>
                Sign out of your account
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.muted} />
          </Pressable>

          {/* Username Edit Modal */}
          <UsernameEditModal
            visible={showUsernameEdit}
            onClose={() => setShowUsernameEdit(false)}
            currentUsername={userProfile?.username || ''}
            onSave={handleUsernameUpdate}
            canEditUsername={canEditUsername}
            nextAllowedDate={nextAllowedDate}
          />
        </ScrollView>
      </AnimatedPage>
    </GradientBackground>
  );
}