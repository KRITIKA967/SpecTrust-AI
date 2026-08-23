const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dbPath = process.env.DB_PATH || path.join(__dirname, 'spectrust.db');
const db = new DatabaseSync(dbPath);

// Enable foreign key constraints
db.exec('PRAGMA foreign_keys = ON;');

// Non-destructive column add for existing databases (do not drop/reseed).
try {
    const resolutionCols = db.prepare('PRAGMA table_info(resolutions)').all();
    if (resolutionCols.length > 0 && !resolutionCols.some((col) => col.name === 'explanation')) {
        db.exec('ALTER TABLE resolutions ADD COLUMN explanation TEXT');
    }
} catch (err) {
    // Table may not exist yet; schema.sql / init will create it.
}

module.exports = db;
