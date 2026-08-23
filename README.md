# SpecTrust AI

An AI-powered trust layer for industrial product information that detects contradictions between multiple product-data sources.

---

## Workspace Structure

```
spectrust-ai/
├── backend/
│   ├── src/
│   │   ├── pipeline/
│   │   ├── routes/
│   │   │   └── health.js
│   │   └── server.js
│   ├── data/
│   │   ├── sources/
│   │   └── seed/
│   ├── db/
│   │   ├── schema.sql
│   │   ├── db.js
│   │   └── init.js
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   └── Home.jsx
│   │   ├── components/
│   │   │   └── StatusBadge.jsx
│   │   ├── lib/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
│
├── README.md
└── .gitignore
```

---

## 1. How to Install Backend

From the root directory:

```bash
cd backend
npm install
```

---

## 2. How to Install Frontend

From the root directory:

```bash
cd frontend
npm install
```

---

## 3. Database Initialization

To initialize the SQLite database (`backend/db/spectrust.db`) with the schema:

```bash
cd backend
npm run db:init
```

---

## 4. How to Start Backend

```bash
cd backend
npm start
```

The server will start at `http://localhost:5000`.

---

## 5. How to Start Frontend

```bash
cd frontend
npm run dev
```

The frontend application will start at `http://localhost:5173`.

---

## 6. API Health Endpoint

### `GET /api/health`

Returns service health status:

```json
{
  "ok": true,
  "service": "SpecTrust AI API"
}
```
