const fs = require('fs');
const path = require('path');
const db = require('./db');

function initDb() {
    try {
        // Drop existing tables for fresh schema rebuild
        db.exec(`
            DROP TABLE IF EXISTS trust_scores;
            DROP TABLE IF EXISTS resolutions;
            DROP TABLE IF EXISTS conflicts;
            DROP TABLE IF EXISTS claims;
            DROP TABLE IF EXISTS sources;
            DROP TABLE IF EXISTS products;
        `);

        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        db.exec(schemaSql);
        console.log('✅ SQLite Database initialized successfully from schema.sql');
    } catch (err) {
        console.error('❌ Database initialization error:', err.message);
        process.exit(1);
    }
}

function ensureTablesExist() {
    try {
        // Check if products table has legacy INTEGER id column
        const info = db.prepare("PRAGMA table_info(products)").all();
        const idCol = info.find(c => c.name === 'id');
        if (idCol && idCol.type === 'INTEGER') {
            db.exec(`
                DROP TABLE IF EXISTS trust_scores;
                DROP TABLE IF EXISTS resolutions;
                DROP TABLE IF EXISTS conflicts;
                DROP TABLE IF EXISTS claims;
                DROP TABLE IF EXISTS sources;
                DROP TABLE IF EXISTS products;
            `);
        }

        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        db.exec(schemaSql);
    } catch (err) {
        console.error('❌ Ensure tables error:', err.message);
    }
}

if (require.main === module) {
    initDb();
}

module.exports = { initDb, ensureTablesExist };
