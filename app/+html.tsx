import React from 'react';

export default function Html({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
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
              body { overflow-x: hidden; -webkit-text-size-adjust: 100%; overscroll-behavior-y: none; }
              *, *::before, *::after { box-sizing: border-box; }
              img, video, canvas, svg { max-width: 100%; height: auto; }
              input, textarea, select, button { font-size: 16px; }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
