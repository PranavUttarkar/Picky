# Corporate Network SSL Certificate Issue

## Problem
Getting `ERR_CERT_AUTHORITY_INVALID` error when accessing Supabase on corporate WiFi, but it works on cellular hotspot.

**Error:**
```
https://osjqpxscuycbgtbojngb.supabase.co/auth/v1/user net::ERR_CERT_AUTHORITY_INVALID
```

## Root Cause
Corporate networks often use **SSL inspection** (man-in-the-middle) where they:
1. Intercept all HTTPS traffic
2. Decrypt it using their own certificate
3. Re-encrypt it with their corporate certificate

Your browser/app doesn't trust the corporate certificate, causing the SSL error.

## Solutions (In Order of Recommendation)

### 1. **Install Corporate SSL Certificate (RECOMMENDED)**
**Best for:** Long-term development on corporate network

**Steps:**
1. Contact your IT department
2. Request the corporate root SSL certificate
3. Install it in your system's trusted certificate store
   - **Windows:** `certmgr.msc` → Trusted Root Certification Authorities → Import
   - **Mac:** Keychain Access → System → Import → Trust
4. Restart your browser/dev environment

### 2. **Request IT to Whitelist Supabase**
**Best for:** If multiple developers need access

Ask IT to whitelist these domains from SSL inspection:
- `*.supabase.co`
- `osjqpxscuycbgtbojngb.supabase.co`

### 3. **Use Personal Hotspot for Development**
**Best for:** Quick workaround

- Use your mobile hotspot when developing
- Not ideal for long-term work

### 4. **Browser Development Mode (Web Only)**
**Best for:** Testing web build only

**Chrome:**
```bash
# Windows
chrome.exe --disable-web-security --user-data-dir="C:\temp\chrome-dev"

# Mac
open -a Google\ Chrome --args --disable-web-security --user-data-dir="/tmp/chrome-dev"
```

⚠️ **WARNING:** Only use for development, never for production

### 5. **Use HTTP Proxy (Advanced)**
**Best for:** Complex corporate environments

Set up a local proxy that handles SSL:
```bash
npm install -g local-ssl-proxy
local-ssl-proxy --source 3010 --target https://osjqpxscuycbgtbojngb.supabase.co --cert cert.pem --key key.pem
```

Then update your `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=http://localhost:3010
```

## For Native Apps (iOS/Android)

If building native apps with Expo:

### iOS
```xml
<!-- ios/Picky/Info.plist -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSExceptionDomains</key>
    <dict>
        <key>supabase.co</key>
        <dict>
            <key>NSIncludesSubdomains</key>
            <true/>
            <key>NSTemporaryExceptionAllowsInsecureHTTPLoads</key>
            <true/>
        </dict>
    </dict>
</dict>
```

### Android
```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">supabase.co</domain>
    </domain-config>
</network-security-config>
```

Then reference in `AndroidManifest.xml`:
```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    ...>
```

## Testing the Fix

1. Clear browser cache
2. Restart dev server: `npm start`
3. Check browser console for detailed error logs
4. Try accessing: `https://osjqpxscuycbgtbojngb.supabase.co/auth/v1/health`

## Production Deployment

**IMPORTANT:** This issue only affects development on corporate networks. Once deployed:
- Web apps on Vercel/Netlify will work fine
- Mobile apps will work fine (they bypass corporate network)
- Users won't experience this issue

## Need More Help?

1. Check browser console for detailed error messages
2. Run: `openssl s_client -connect osjqpxscuycbgtbojngb.supabase.co:443`
3. Contact IT support with Supabase documentation
4. Consider using a VPN to bypass SSL inspection

## Current Implementation

The app now includes better error logging in `services/supabase.ts` to help diagnose SSL issues during development.
