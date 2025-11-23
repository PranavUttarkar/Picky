# Font Fix Guide - Ensuring Sans-Serif Fonts Throughout App

## Problem
Some Text components were using default serif fonts instead of the intended sans-serif fonts (Inter and Plus Jakarta Sans).

## Solution Applied

### 1. Updated Design Tokens (`theme/designTokens.ts`)
- Added comprehensive font family strings with system fallbacks
- Each font family now includes: `Inter_400Regular, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- This ensures sans-serif fallback even if custom fonts don't load

### 2. Global Web Styles (`app/+html.tsx`)
- Added global CSS rules to force all text elements to use sans-serif fonts
- Applied to: `p, span, div, h1-h6, label, a, button, input, textarea, select`
- Uses `!important` to override any default serif fonts

### 3. Updated Components
The following components have been updated with proper fontFamily:
- ✅ `components/EventGridCard.tsx`
- ✅ `components/EventRowCard.tsx`
- ✅ `components/FoodGridCard.tsx`
- ✅ `components/FoodRowCard.tsx`
- ✅ `components/PollCard.tsx`
- ✅ `components/GradientHeader.tsx`
- ✅ `components/GroupsBenefitsEmptyState.tsx`
- ✅ `components/Chip.tsx`
- ✅ `components/ThreeD.tsx`
- ✅ `components/BlurbBubble.tsx`
- ✅ `components/TopBarStyles.ts`
- ✅ All onboarding screens

### 4. Pattern for Remaining Components

For any Text component that doesn't have `fontFamily` specified, add:

```typescript
import { Typography } from '@/theme/designTokens';

// Then in the Text component:
<Text style={{
  // ... other styles
  fontFamily: Typography.fontFamily.body, // or bodyMedium, bodySemibold, bodyBold
  fontSize: Typography.scale.body.fontSize, // or appropriate scale
  fontWeight: Typography.fontWeight.regular, // or medium, semibold, bold
}}>
  Your text
</Text>
```

### 5. Font Family Selection Guide

- **Body text (regular)**: `Typography.fontFamily.body`
- **Body text (medium weight)**: `Typography.fontFamily.bodyMedium`
- **Body text (semibold)**: `Typography.fontFamily.bodySemibold`
- **Body text (bold)**: `Typography.fontFamily.bodyBold`
- **Headings/Display**: `Typography.fontFamily.display` or `Typography.fontFamily.displayBold`
- **Brand logo**: `Typography.fontFamily.brand` (Pacifico - only for "Picky!")

### 6. Remaining Files to Update

These files still need fontFamily added to Text components:
- `app/(tabs)/groups.tsx`
- `app/(tabs)/events.tsx`
- `app/(tabs)/food.tsx`
- `app/(tabs)/profile.tsx`
- `app/(tabs)/saved.tsx`
- `app/events/[id].tsx`
- `app/foods/[id].tsx`
- `app/groups/[id].tsx`
- `components/AvailabilityGrid.tsx`
- `components/AvailabilityGridMobile.tsx`
- `components/ImageGallery.tsx`
- `components/EventImages.tsx`
- And other utility pages

## Visual Language Alignment

The fonts now convey:
- ✅ **Fun vibe**: Inter is friendly and approachable, Plus Jakarta Sans adds warmth
- ✅ **Clean & Simple**: Sans-serif fonts ensure clarity and readability
- ✅ **Modern**: Contemporary font choices that feel fresh
- ✅ **Professional**: Maintains credibility while being approachable

