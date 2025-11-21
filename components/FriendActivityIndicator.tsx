import { View, Text } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { getEventFriendActivity, getRestaurantFriendActivity } from '@/services/friends';
import type { FriendActivityResult } from '@/types/models';

interface FriendActivityIndicatorProps {
  itemId: string | number;
  itemType: 'event' | 'restaurant';
  style?: any;
}

export default function FriendActivityIndicator({ 
  itemId, 
  itemType, 
  style 
}: FriendActivityIndicatorProps) {
  const c = useThemeColors();
  const [activity, setActivity] = useState<FriendActivityResult>({ friend_count: 0, friend_names: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActivity = async () => {
      try {
        setLoading(true);
        let result: FriendActivityResult;
        
        if (itemType === 'event') {
          result = await getEventFriendActivity(Number(itemId));
        } else {
          result = await getRestaurantFriendActivity(String(itemId));
        }
        
        setActivity(result);
      } catch (error) {
        console.error('Error loading friend activity:', error);
        setActivity({ friend_count: 0, friend_names: [] });
      } finally {
        setLoading(false);
      }
    };

    loadActivity();
  }, [itemId, itemType]);

  if (loading || activity.friend_count === 0) {
    return null;
  }

  const getActivityText = () => {
    const count = activity.friend_count;
    const names = activity.friend_names;
    
    if (itemType === 'event') {
      if (count === 1) {
        return `${names[0]} is going`;
      } else if (count === 2) {
        return `${names[0]} and ${names[1]} are going`;
      } else if (count === 3) {
        return `${names[0]}, ${names[1]} and ${names[2]} are going`;
      } else {
        return `${names[0]}, ${names[1]} and ${count - 2} other friends are going`;
      }
    } else {
      if (count === 1) {
        return `${names[0]} loves this`;
      } else if (count === 2) {
        return `${names[0]} and ${names[1]} love this`;
      } else if (count === 3) {
        return `${names[0]}, ${names[1]} and ${names[2]} love this`;
      } else {
        return `${names[0]}, ${names[1]} and ${count - 2} other friends love this`;
      }
    }
  };

  return (
    <View style={[{
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderColor: 'rgba(59, 130, 246, 0.3)',
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    }, style]}>
      <Ionicons 
        name={itemType === 'event' ? 'calendar' : 'heart'} 
        size={14} 
        color="#3b82f6" 
      />
      <Text style={{
        color: '#3b82f6',
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
      }}>
        {getActivityText()}
      </Text>
    </View>
  );
}
