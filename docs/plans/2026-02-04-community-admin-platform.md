# Community Admin Platform — Design Notes

**Status:** Future work (captured 2026-02-04)

## Problem

The Participation feed in My Community and Dear Neighbors is not populated. There's no way for community organizers to manage participation opportunities. Need a shared admin backend that serves both MC (community-scoped) and DN (neighborhood-scoped) audiences.

## Vision

A web app for community organizers/admins to populate participation opportunities displayed in both My Community and Dear Neighbors — two different interfaces for different audiences, shared backend.

## Core Features

### 1. API Integrations
- Connect Luma calendars to auto-import community events
- Other event/session APIs as needed (future)

### 2. Manual Entry
- Manually add participation opportunities: Harmonica sessions, Polis conversations, deliberations, sensemaking sessions, community meetings, votes
- Rich metadata: title, description, datetime, duration, type, links

### 3. Access Control
- Whitelists of emails or Bluesky accounts
- Community admins can manage who has organizer access

### 4. Pricing (community size-based)
Based on number of MC users who can simultaneously have the community turned on in new tab settings:

| Tier | Users | Price |
|------|-------|-------|
| Free | up to 10 | $0/month |
| Small | 11-100 | $10/month |
| Large | 100+ | $100/month |

"Users" = number of My Community extension users who have the community enabled in their settings at any given time.

## Architecture Notes

- Shared Supabase backend (or new project) serving both DN and MC
- Admin web app (separate deployment) for organizers
- MC and DN extensions consume the same participation API
- Pricing enforcement: count active users per community, gate access at the API level
