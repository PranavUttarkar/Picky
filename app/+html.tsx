import React from 'react';

export default function Html({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Leaflet CSS for interactive maps */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        {/* Ensure proper scaling on iOS Safari and fit to device width */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, minimum-scale=1, maximum-scale=1"
        />
        {/* Prevent iOS from auto-zooming inputs when font-size < 16px and avoid horizontal overflow */}
        <style
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
              /* Ensure navigation containers size to the visible viewport on mobile browsers.
                 Prefer dynamic viewport units for Safari iOS (100dvh), fallback to 100svh then 100vh. */
              html, body, #root {
                /* Use dynamic viewport height where supported to avoid iOS Safari top/bottom UI issues */
                min-height: 100dvh;
                min-height: 100svh;
                min-height: 100vh;
                margin: 0;
                padding: 0;
              }
              /* React Navigation sometimes nests an extra div wrapper; ensure it fills its parent */
              body > #root > div { 
                min-height: inherit; 
                /* Make the app wrapper fill the dynamic viewport too */
                min-height: 100dvh;
                min-height: 100svh;
                min-height: 100vh;
                /* Ensure the app can extend into iOS safe areas (notch / home indicator)
                   and avoid white bars when the browser UI overlays the viewport. */
                padding-top: env(safe-area-inset-top);
                padding-bottom: env(safe-area-inset-bottom);
                padding-left: env(safe-area-inset-left);
                padding-right: env(safe-area-inset-right);
                /* Older Safari iOS fallback */
                padding-top: constant(safe-area-inset-top);
                padding-bottom: constant(safe-area-inset-bottom);
                padding-left: constant(safe-area-inset-left);
                padding-right: constant(safe-area-inset-right);
                /* Let the inner app control its own background so it can be full-bleed */
                background: transparent;
              }
              /* Make sure the page background also stretches under browser chrome */
              html, body, #root { background: transparent; }
              body { 
                overflow-x: hidden; 
                -webkit-text-size-adjust: 100%; 
                overscroll-behavior-y: none;
                font-family: 'Inter_400Regular', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              }
              *, *::before, *::after { box-sizing: border-box; }
              img, video, canvas, svg { max-width: 100%; height: auto; }
              input, textarea, select { 
                font-size: 16px; 
                font-family: 'Inter_400Regular', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              }
              /* Don't apply font-family to buttons to avoid breaking icons inside them */
              /* Ensure text elements use sans-serif fonts - but don't use !important to avoid breaking icons */
              p, h1, h2, h3, h4, h5, h6, label {
                font-family: 'Inter_400Regular', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
