-- SpecTrust AI - SQLite Database Schema

PRAGMA foreign_keys = ON;

-- 1. Products
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Sources (Data sources for products)
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    authority_tier INTEGER DEFAULT 1,
    retrieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_text TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 3. Claims (Extracted attribute claims from sources)
CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    attribute TEXT NOT NULL,
    raw_value TEXT,
    raw_unit TEXT,
    normalized_value REAL,
    normalized_unit TEXT,
    extraction_confidence REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- 4. Conflicts (Contradictions detected between claims)
CREATE TABLE IF NOT EXISTS conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    attribute TEXT NOT NULL,
    claim_ids TEXT NOT NULL, -- JSON array or comma-separated claim IDs
    status TEXT NOT NULL DEFAULT 'open', -- e.g. open, resolved, ignored
    severity TEXT DEFAULT 'medium', -- e.g. low, medium, high, critical
    rationale_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 5. Resolutions (Resolutions applied to conflicts)
CREATE TABLE IF NOT EXISTS resolutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conflict_id INTEGER NOT NULL,
    resolved_value TEXT,
    resolved_unit TEXT,
    confidence REAL DEFAULT 1.0,
    source_id_chosen TEXT,
    reviewer_status TEXT DEFAULT 'pending', -- e.g. pending, approved, rejected
    explanation TEXT,
    resolved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conflict_id) REFERENCES conflicts(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id_chosen) REFERENCES sources(id) ON DELETE SET NULL
);

-- 6. Trust Scores (Computed trust scores per product/attribute)
CREATE TABLE IF NOT EXISTS trust_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    attribute TEXT NOT NULL,
    score REAL NOT NULL, -- e.g. 0.0 to 100.0 or 0.0 to 1.0
    last_computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sources_product ON sources(product_id);
CREATE INDEX IF NOT EXISTS idx_claims_product ON claims(product_id);
CREATE INDEX IF NOT EXISTS idx_claims_attribute ON claims(attribute);
CREATE INDEX IF NOT EXISTS idx_conflicts_product ON conflicts(product_id);
CREATE INDEX IF NOT EXISTS idx_trust_scores_product ON trust_scores(product_id);
