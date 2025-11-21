import { View, Image, Pressable } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';

interface AvatarProps {
  uri?: string | null;
  size?: number;
  onPress?: () => void;
  showEditIcon?: boolean;
  disabled?: boolean;
}

const Avatar = memo(function Avatar({ 
  uri, 
  size = 40, 
  onPress, 
  showEditIcon = false,
  disabled = false 
}: AvatarProps) {
  const c = useThemeColors();
  
  const avatarContent = (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      position: 'relative',
    }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
        />
      ) : (
        <Ionicons 
          name="person" 
          size={size * 0.4} 
          color={c.muted} 
        />
      )}
      
      {showEditIcon && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          backgroundColor: c.primary,
          borderRadius: (size * 0.25) / 2,
          width: size * 0.25,
          height: size * 0.25,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: c.background,
        }}>
          <Ionicons 
            name="camera" 
            size={size * 0.12} 
            color="white" 
          />
        </View>
      )}
    </View>
  );
  
  if (onPress && !disabled) {
    return (
      <Pressable onPress={onPress} disabled={disabled}>
        {avatarContent}
      </Pressable>
    );
  }
  
  return avatarContent;
});

export default Avatar;
