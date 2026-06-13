# GreaseCycle Pro ♻️

**Free waste cooking oil collection for commercial kitchens.**

A complete lead-generation website and API for a waste cooking oil collection business. Restaurants, hotels, and food service businesses can learn about the service and submit a "Get a Quote" form, which is captured and stored via the backend API.

## Features

- 📱 **Responsive website** — Mobile-first design, works on all devices
- 🎨 **Modern branding** — Warm amber/gold + green eco-friendly palette
- 📝 **Lead capture form** — "Get a Quote" collects name, business, email, phone, volume
- 🔌 **REST API** — Stores leads in a SQLite database via Turso
- 📊 **Health endpoint** — Monitor server status and lead volume

## Quick Start

```bash
npm install
npm start
```

The server starts on port 8080 by default (or `$PORT` if set).

### Environment

The app uses the shared `team-db` CLI for database access — configured as part of the CTO platform.

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend:** Node.js, Express
- **Database:** Turso (SQLite via team-db CLI)
- **Fonts:** Playfair Display + Inter (Google Fonts)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server status & lead count |
| POST | `/api/lead` | Submit a lead (name, business, email required) |
| GET | `/` | Frontend website |

## Project Structure

```
├── public/
│   ├── index.html              # Full website
│   └── hero-oil-collection.jpg # Hero background image
├── server.js                   # Express API server
├── package.json
└── README.md
```