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
              /* Ensure navigation containers can size correctly on web */
              html, body, #root { height: 100%; margin: 0; padding: 0; }
              /* React Navigation sometimes nests an extra div wrapper; make sure it fills */
              body > #root > div { height: 100%; }
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
