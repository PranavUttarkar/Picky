# Picky

**Find something worth doing, together.**

Picky is a cross-platform campus discovery app that helps students find events, explore food options, and make plans with friends. Built with Expo and Supabase, it brings personalized discovery and group coordination into one experience.

## What it does

- **Discover events:** Browse and search campus events, filter by interests, save favorites, and open event details or RSVP links.
- **Get personalized recommendations:** Rank events using interest-based matching, with server-side scoring and a client-side fallback.
- **Plan with friends:** Create or join groups and coordinate decisions through polls and group features.
- **Explore food:** Find restaurant options alongside campus activities.
- **Manage events:** Authorized organizers and admins can create and manage event listings.

## Built with

| Layer | Technology |
| --- | --- |
| App | React Native, Expo, Expo Router, TypeScript |
| Backend | Supabase Auth, PostgreSQL, Row Level Security, RPCs |
| Platforms | iOS, Android, and web |

## Getting started

You'll need Node.js, npm, and a Supabase project.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to your project's values.
3. Apply the migrations in `supabase/migrations/` in filename order. See [development setup](docs/development.md) and [Supabase setup](SUPABASE-SETUP.md) for more detail.
4. Start the development server:

   ```bash
   npm start
   ```

   Use the Expo terminal options to open the app on a device, emulator, or web browser. Run `npm run build` to export the web app.

## Project structure

```text
app/                  Expo Router screens and navigation
components/           Reusable UI components
services/             Supabase and feature-specific data access
theme/                Design tokens and theming
types/                Shared TypeScript models
supabase/             Database migrations and backend functions
webscraper/           Campus event data collection
docs/                 Architecture, setup, and feature documentation
```

Explore the [architecture](docs/architecture.md), [data model](docs/data-model.md), and [scoring](docs/scoring.md) docs for implementation details. Image proxying is optional and requires a separately hosted endpoint if `EXPO_PUBLIC_IMAGE_PROXY_BASE` is configured.
