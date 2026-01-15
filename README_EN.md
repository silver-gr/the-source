<p align="center">
  <img src="frontend/public/logo.png" alt="The Source Logo" width="200" />
</p>

<h1 align="center">The Source</h1>

<p align="center">
  <strong>A self-hosted "Save For Later" system designed for people who save everything but never look at it again.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#changelog">Changelog</a> •
  <a href="#roadmap">Roadmap</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.2.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome" />
</p>

<p align="center">
  <a href="README.md">🇬🇷 Ελληνική Έκδοση</a>
</p>

---

## The Problem

You've saved thousands of links, videos, and posts across YouTube Watch Later, Reddit Saved, Raindrop.io, and browser bookmarks. They sit there, forgotten, while you keep saving more. Sound familiar?

**The Source** is an ADHD-optimized "Inbox Zero" system that:
- Aggregates all your saved content into one searchable interface
- Forces you to actually **process** what you save
- Auto-categorizes and tracks link health
- Surfaces social mentions (Reddit, Hacker News) for your saved URLs

Stop hoarding. Start consuming.

---

## Features

### Multi-Platform Sync
- **YouTube Watch Later** - Syncs via yt-dlp using browser cookies
- **Reddit Saved** - OAuth integration via PRAW
- **Raindrop.io** - Full bookmark import
- **Manual URLs** - Add any URL with auto-metadata fetch

### Smart Organization
- **Full-Text Search** - FTS5 powered search across titles, descriptions, and URLs
- **Advanced Filtering** - Filter by source, status, date range, tags, and domains
- **Flexible Grouping** - Group by date (year/month), source, tags, or website
- **Link Health Tracking** - Automatically detects dead/broken links
- **NSFW Detection** - Filters adult content with explicit/NSFW status

### Modern Interface
- **Editorial Design** - Beautiful typography with Fraunces + DM Sans fonts
- **Dark/Light Mode** - Warm color palette with amber accent
- **Grid & List Views** - Card view for browsing, compact list for power users
- **Responsive Layout** - Works on desktop and tablet
- **URL State Sync** - Shareable filter URLs, browser back/forward support

### Social Presence Detection
- **Hacker News** - Find discussions about your saved URLs via Algolia API
- **Reddit** - Discover posts mentioning your links via PRAW
- **Score & Comment Tracking** - See engagement metrics at a glance

### Inbox Zero Workflow
- **Unprocessed Queue** - New items land in inbox for review
- **Bulk Actions** - Mark multiple items as read/archived
- **Processing Stats** - Track your progress toward inbox zero

---

## Screenshots

<details>
<summary><strong>Dashboard</strong> - Overview with stats and recent items</summary>

The dashboard shows:
- Total items, inbox count, and processed count
- Items grouped by source with platform-specific colors
- 20 most recent unprocessed items
- Connected source status with last sync time

</details>

<details>
<summary><strong>Saved Items - Grid View</strong> - Card layout for visual browsing</summary>

Features:
- Thumbnail previews for videos/articles
- Source badges with platform colors
- New/Dead/NSFW status indicators
- Hover actions for quick processing

</details>

<details>
<summary><strong>Saved Items - List View</strong> - Compact 2-column layout</summary>

Features:
- High-density viewing (150 items per page)
- Favicon-based source identification
- Checkbox bulk selection
- Date-based timestamps

</details>

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 19.2 | UI Framework |
| TypeScript | Type Safety |
| TanStack Router | File-based Routing |
| TanStack Query | Server State |
| Tailwind CSS v4 | Styling |
| Vite 7 | Build Tool |
| Bun | Package Manager |

### Backend
| Technology | Purpose |
|------------|---------|
| FastAPI | API Framework |
| Python 3.12+ | Runtime |
| SQLite + aiosqlite | Database |
| FTS5 | Full-Text Search |
| yt-dlp | YouTube Integration |
| PRAW | Reddit Integration |
| uv | Package Manager |

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌───────────────┐  │
│  │ Routes  │  │ Features │  │ Hooks   │  │ Components    │  │
│  └────┬────┘  └────┬─────┘  └────┬────┘  └───────┬───────┘  │
│       └────────────┴─────────────┴───────────────┘          │
│                           │                                  │
│                    TanStack Query                            │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/REST
┌───────────────────────────┴─────────────────────────────────┐
│                      Backend (FastAPI)                       │
│  ┌─────────┐  ┌──────────┐  ┌─────────────┐  ┌───────────┐  │
│  │ Routes  │→ │ Services │→ │ Repositories│→ │  SQLite   │  │
│  └─────────┘  └──────────┘  └─────────────┘  └───────────┘  │
│       │                                                      │
│  ┌────┴────────────────────────────────────┐                │
│  │         Sync Workers (Background)        │                │
│  │  YouTube │ Reddit │ Raindrop │ Manual   │                │
│  └──────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites
- Python 3.12+
- Node.js 18+ (for bun)
- [uv](https://github.com/astral-sh/uv) - Python package manager
- [bun](https://bun.sh) - JavaScript runtime & package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/silver-gr/the-source.git
   cd the-source
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   uv sync
   ```

3. **Install frontend dependencies**
   ```bash
   cd frontend
   bun install
   ```

4. **Configure environment** (optional)
   ```bash
   cp backend/.env.example backend/.env
   # Edit .env with your settings
   ```

### Running the Application

**Terminal 1 - Backend:**
```bash
cd backend
uv run uvicorn app.main:app --reload --port 8001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Syncing Your Data

1. **YouTube Watch Later**
   - Ensure you're logged into YouTube in Chrome/Firefox
   - Click "Trigger Sync" on the dashboard
   - yt-dlp uses browser cookies automatically

2. **Reddit Saved**
   - Create a Reddit app at [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
   - Add credentials to `.env` or system keyring
   - Trigger sync from dashboard

3. **Raindrop.io**
   - Export your bookmarks from Raindrop
   - Import via the API (coming soon) or manual CSV

---

## Changelog

### v0.2.0 - Editorial Edition (January 2026)

#### Design System Overhaul
- **New Typography** - Fraunces (display), DM Sans (body), JetBrains Mono (stats)
- **Warm Color Palette** - Amber/gold primary with warm dark mode
- **Editorial Sidebar** - Always-dark with accent indicator bars
- **Card Hover Effects** - Lift animations with shadows
- **Staggered Animations** - Smooth page load transitions

#### Dashboard Improvements
- Accurate stats from dedicated `/items/stats` endpoint
- 20 recent inbox items (up from 5)
- Real unprocessed count in Process Inbox button
- Source status cards with platform colors

#### List View Enhancement
- Full-page flow without fixed scroll container
- Matches grid view behavior

### v0.1.1 - Social Features (January 2026)

#### Social Presence Detection
- Hacker News discussion finder via Algolia API
- Reddit mention tracker via PRAW
- Score and comment count display
- Social badges in item rows

#### Add Item Dialog
- Manual URL entry with auto-metadata fetch
- Title extraction from Open Graph / HTML
- Proper timestamp handling

### v0.1.0 - Initial Release (January 2026)

#### Core Features
- Multi-source sync (YouTube, Reddit, Raindrop)
- Full-text search with FTS5
- Advanced filtering and sorting
- Grid and list view modes
- Date/Source/Tags/Website grouping
- Link health checking
- NSFW content filtering
- Bulk actions for processing
- URL state synchronization

---

## Roadmap

### Near-term (Q1 2026)

- [ ] **Spaced Repetition Review** - SM-2 algorithm for resurfacing saved items
- [ ] **Browser Extension** - Quick-save from any page with one click
- [ ] **Raindrop API Sync** - Direct integration (no export needed)
- [ ] **Instagram Saved** - Sync saved posts and reels
- [ ] **Pocket Import** - Migration tool for Pocket users

### Mid-term (Q2 2026)

- [ ] **AI Categorization** - Auto-tag items using LLM analysis
- [ ] **Reading Time Estimates** - Based on content length/type
- [ ] **Mobile App** - React Native companion app
- [ ] **Archive Export** - Export processed items to Obsidian/Notion
- [ ] **Duplicate Detection** - Find and merge duplicate saves

### Long-term (2026+)

- [ ] **Multi-user Support** - Family/team sharing
- [ ] **Content Summarization** - AI-generated TL;DR for articles
- [ ] **Watch History Integration** - Track what you've actually consumed
- [ ] **Analytics Dashboard** - Insights into saving/processing habits
- [ ] **Self-hosted Cloud Sync** - Sync across devices

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Stop hoarding. Start consuming.</strong><br/>
  Built with frustration and caffeine.
</p>
