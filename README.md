<p align="center">
  <img src="frontend/public/logo.png" alt="The Source Logo" width="200" />
</p>

<h1 align="center">The Source</h1>

<p align="center">
  <strong>Ένα self-hosted σύστημα "Save For Later" σχεδιασμένο για όσους αποθηκεύουν τα πάντα αλλά δεν τα ξαναβλέπουν ποτέ.</strong>
</p>

<p align="center">
  <a href="#χαρακτηριστικά">Χαρακτηριστικά</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#ξεκινώντας">Ξεκινώντας</a> •
  <a href="#changelog">Changelog</a> •
  <a href="#roadmap">Roadmap</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.2.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome" />
</p>

<p align="center">
  <a href="README_EN.md">🇬🇧 English Version</a>
</p>

---

## Το Πρόβλημα

Έχεις αποθηκεύσει χιλιάδες links, βίντεο και posts σε YouTube Watch Later, Reddit Saved, Raindrop.io και browser bookmarks. Κάθονται εκεί, ξεχασμένα, ενώ συνεχίζεις να αποθηκεύεις περισσότερα. Σου θυμίζει κάτι;

**The Source** είναι ένα ADHD-optimized σύστημα "Inbox Zero" που:
- Συγκεντρώνει όλο το αποθηκευμένο περιεχόμενό σου σε μία searchable διεπαφή
- Σε αναγκάζει να **επεξεργαστείς** πραγματικά αυτά που αποθηκεύεις
- Κατηγοριοποιεί αυτόματα και παρακολουθεί την υγεία των links
- Εμφανίζει social mentions (Reddit, Hacker News) για τα αποθηκευμένα URLs σου

Σταμάτα να μαζεύεις. Άρχισε να καταναλώνεις.

---

## Χαρακτηριστικά

### Multi-Platform Sync
- **YouTube Watch Later** - Sync μέσω yt-dlp χρησιμοποιώντας browser cookies
- **Reddit Saved** - OAuth integration μέσω PRAW
- **Raindrop.io** - Πλήρης εισαγωγή bookmarks
- **Manual URLs** - Πρόσθεσε οποιοδήποτε URL με auto-fetch metadata

### Έξυπνη Οργάνωση
- **Full-Text Search** - FTS5 powered αναζήτηση σε τίτλους, περιγραφές και URLs
- **Advanced Filtering** - Φιλτράρισμα κατά πηγή, κατάσταση, ημερομηνία, tags και domains
- **Ευέλικτη Ομαδοποίηση** - Ομαδοποίηση κατά ημερομηνία (έτος/μήνα), πηγή, tags ή website
- **Link Health Tracking** - Αυτόματη ανίχνευση νεκρών/σπασμένων links
- **NSFW Detection** - Φιλτράρισμα adult περιεχομένου με explicit/NSFW status

### Σύγχρονη Διεπαφή
- **Editorial Design** - Όμορφη τυπογραφία με Fraunces + DM Sans fonts
- **Dark/Light Mode** - Ζεστή χρωματική παλέτα με amber accent
- **Grid & List Views** - Card view για browsing, compact list για power users
- **Responsive Layout** - Λειτουργεί σε desktop και tablet
- **URL State Sync** - Shareable filter URLs, browser back/forward support

### Social Presence Detection
- **Hacker News** - Εύρεση συζητήσεων για τα αποθηκευμένα URLs σου μέσω Algolia API
- **Reddit** - Ανακάλυψη posts που αναφέρουν τα links σου μέσω PRAW
- **Score & Comment Tracking** - Δες engagement metrics με μια ματιά

### Inbox Zero Workflow
- **Unprocessed Queue** - Τα νέα items πηγαίνουν στο inbox για review
- **Bulk Actions** - Σήμανση πολλών items ως read/archived
- **Processing Stats** - Παρακολούθηση της προόδου σου προς το inbox zero

---

## Screenshots

<details>
<summary><strong>Dashboard</strong> - Επισκόπηση με stats και πρόσφατα items</summary>

Το dashboard δείχνει:
- Σύνολο items, inbox count και processed count
- Items ομαδοποιημένα κατά πηγή με platform-specific χρώματα
- 20 πιο πρόσφατα unprocessed items
- Κατάσταση συνδεδεμένων πηγών με τελευταίο sync time

</details>

<details>
<summary><strong>Saved Items - Grid View</strong> - Card layout για visual browsing</summary>

Χαρακτηριστικά:
- Thumbnail previews για βίντεο/άρθρα
- Source badges με platform χρώματα
- New/Dead/NSFW status indicators
- Hover actions για γρήγορο processing

</details>

<details>
<summary><strong>Saved Items - List View</strong> - Compact 2-column layout</summary>

Χαρακτηριστικά:
- High-density viewing (150 items ανά σελίδα)
- Favicon-based αναγνώριση πηγής
- Checkbox bulk selection
- Date-based timestamps

</details>

---

## Tech Stack

### Frontend
| Τεχνολογία | Σκοπός |
|------------|--------|
| React 19.2 | UI Framework |
| TypeScript | Type Safety |
| TanStack Router | File-based Routing |
| TanStack Query | Server State |
| Tailwind CSS v4 | Styling |
| Vite 7 | Build Tool |
| Bun | Package Manager |

### Backend
| Τεχνολογία | Σκοπός |
|------------|--------|
| FastAPI | API Framework |
| Python 3.12+ | Runtime |
| SQLite + aiosqlite | Database |
| FTS5 | Full-Text Search |
| yt-dlp | YouTube Integration |
| PRAW | Reddit Integration |
| uv | Package Manager |

### Αρχιτεκτονική
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

## Ξεκινώντας

### Προαπαιτούμενα
- Python 3.12+
- Node.js 18+ (για bun)
- [uv](https://github.com/astral-sh/uv) - Python package manager
- [bun](https://bun.sh) - JavaScript runtime & package manager

### Εγκατάσταση

1. **Κλωνοποίησε το repository**
   ```bash
   git clone https://github.com/silver-gr/the-source.git
   cd the-source
   ```

2. **Εγκατέστησε τα backend dependencies**
   ```bash
   cd backend
   uv sync
   ```

3. **Εγκατέστησε τα frontend dependencies**
   ```bash
   cd frontend
   bun install
   ```

4. **Ρύθμισε το environment** (προαιρετικά)
   ```bash
   cp backend/.env.example backend/.env
   # Επεξεργάσου το .env με τις ρυθμίσεις σου
   ```

### Εκτέλεση

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

Άνοιξε το [http://localhost:3000](http://localhost:3000) στον browser σου.

### Συγχρονισμός Δεδομένων

1. **YouTube Watch Later**
   - Βεβαιώσου ότι είσαι συνδεδεμένος στο YouTube σε Chrome/Firefox
   - Πάτα "Trigger Sync" στο dashboard
   - Το yt-dlp χρησιμοποιεί browser cookies αυτόματα

2. **Reddit Saved**
   - Δημιούργησε Reddit app στο [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
   - Πρόσθεσε credentials στο `.env` ή system keyring
   - Κάνε trigger sync από το dashboard

3. **Raindrop.io**
   - Εξαγωγή bookmarks από το Raindrop
   - Εισαγωγή μέσω API (coming soon) ή manual CSV

---

## Changelog

### v0.2.0 - Editorial Edition (Ιανουάριος 2026)

#### Ανανέωση Design System
- **Νέα Τυπογραφία** - Fraunces (display), DM Sans (body), JetBrains Mono (stats)
- **Ζεστή Χρωματική Παλέτα** - Amber/gold primary με warm dark mode
- **Editorial Sidebar** - Always-dark με accent indicator bars
- **Card Hover Effects** - Lift animations με shadows
- **Staggered Animations** - Ομαλές page load transitions

#### Βελτιώσεις Dashboard
- Ακριβή stats από dedicated `/items/stats` endpoint
- 20 πρόσφατα inbox items (από 5)
- Πραγματικό unprocessed count στο Process Inbox button
- Source status cards με platform χρώματα

#### Βελτίωση List View
- Full-page flow χωρίς fixed scroll container
- Ταιριάζει με τη συμπεριφορά του grid view

### v0.1.1 - Social Features (Ιανουάριος 2026)

#### Social Presence Detection
- Hacker News discussion finder μέσω Algolia API
- Reddit mention tracker μέσω PRAW
- Εμφάνιση score και comment count
- Social badges στα item rows

#### Add Item Dialog
- Manual URL entry με auto-metadata fetch
- Title extraction από Open Graph / HTML
- Σωστό handling timestamps

### v0.1.0 - Initial Release (Ιανουάριος 2026)

#### Core Features
- Multi-source sync (YouTube, Reddit, Raindrop)
- Full-text search με FTS5
- Advanced filtering και sorting
- Grid και list view modes
- Date/Source/Tags/Website grouping
- Link health checking
- NSFW content filtering
- Bulk actions για processing
- URL state synchronization

---

## Roadmap

### Άμεσα (Q1 2026)

- [ ] **Spaced Repetition Review** - SM-2 αλγόριθμος για επαναφορά αποθηκευμένων items
- [ ] **Browser Extension** - Quick-save από οποιαδήποτε σελίδα με ένα κλικ
- [ ] **Raindrop API Sync** - Άμεση ενσωμάτωση (χωρίς export)
- [ ] **Instagram Saved** - Sync αποθηκευμένων posts και reels
- [ ] **Pocket Import** - Migration tool για χρήστες Pocket

### Μεσοπρόθεσμα (Q2 2026)

- [ ] **AI Categorization** - Auto-tag items με LLM analysis
- [ ] **Reading Time Estimates** - Βασισμένο στο μήκος/τύπο περιεχομένου
- [ ] **Mobile App** - React Native companion app
- [ ] **Archive Export** - Export επεξεργασμένων items σε Obsidian/Notion
- [ ] **Duplicate Detection** - Εύρεση και συγχώνευση διπλών saves

### Μακροπρόθεσμα (2026+)

- [ ] **Multi-user Support** - Family/team sharing
- [ ] **Content Summarization** - AI-generated TL;DR για άρθρα
- [ ] **Watch History Integration** - Παρακολούθηση του τι έχεις πραγματικά καταναλώσει
- [ ] **Analytics Dashboard** - Insights για saving/processing συνήθειες
- [ ] **Self-hosted Cloud Sync** - Sync ανάμεσα σε συσκευές

---

## Συνεισφορά

Οι συνεισφορές είναι ευπρόσδεκτες! Διάβασε τις οδηγίες συνεισφοράς πριν υποβάλεις PRs.

1. Fork το repository
2. Δημιούργησε feature branch (`git checkout -b feature/amazing-feature`)
3. Commit τις αλλαγές σου (`git commit -m 'Add amazing feature'`)
4. Push στο branch (`git push origin feature/amazing-feature`)
5. Άνοιξε Pull Request

---

## Άδεια Χρήσης

Αυτό το project διατίθεται υπό την άδεια MIT - δες το αρχείο [LICENSE](LICENSE) για λεπτομέρειες.

---

<p align="center">
  <strong>Σταμάτα να μαζεύεις. Άρχισε να καταναλώνεις.</strong><br/>
  Χτισμένο με απογοήτευση και καφεΐνη.
</p>
