# Event Images Component

The `EventImages` component provides a consistent, responsive layout for 1–N event images.

## Layout rules

1 image  Full bleed (100% width).
2 images  Even split side-by-side.
3 images  Magazine layout: left image (2/3 width) + right column of two stacked images (1/3 width).
>3 images  Same as 3-image layout; the third tile gets an overlay showing +N for the remaining images.

This avoids extremely wide single-aspect stretching when multiple images exist, while still favoring the first/primary image.

## Props

images (string[])  Required. Pre-filtered array of non-empty URLs.
height (number)  Optional height (defaults: card 160, detail/modal 220).
maxDisplay (number)  Defaults to 3. Controls how many images are laid out before overflow.
showOverflowIndicator (boolean)  Show +N overlay (default true).
borderRadius (number)  Corner rounding (default 16).
variant ('card'|'detail'|'modal')  Adjusts default height.

## Usage

```
import EventImages from '@/components/EventImages';

<EventImages images={event.image_urls ?? (event.image_url ? [event.image_url] : [])} />
```

## Accessibility

Each visible tile has an accessibility label (e.g., Event image 2). The overflow overlay sets a label indicating how many more images exist.

## Future Enhancements

- Tap-to-open full screen gallery / lightbox.
- Swipable carousel variant.
- Support for >3 distinct layout templates (e.g., 4-grid).

## Rationale

Centralizing this logic prevents divergence between feed cards, modal views, and dedicated event detail pages, and ensures any future layout improvements propagate automatically.
