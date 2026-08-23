const fs = require('fs');
const path = require('path');
const db = require('./db');
const { ensureTablesExist } = require('./init');

function seedDatabase() {
    // Ensure database tables exist without dropping existing data
    ensureTablesExist();

    const jsonPath = path.join(__dirname, '..', 'data', 'seed', 'products.json');
    if (!fs.existsSync(jsonPath)) {
        console.error(`❌ Seed dataset not found at ${jsonPath}`);
        process.exit(1);
    }

    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const productsData = JSON.parse(rawData);

    const insertProductStmt = db.prepare(`
        INSERT INTO products (id, name, category, image_url)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            category = excluded.category,
            image_url = excluded.image_url
    `);

    const insertSourceStmt = db.prepare(`
        INSERT INTO sources (id, product_id, source_type, source_name, authority_tier, retrieved_at, raw_text)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            product_id = excluded.product_id,
            source_type = excluded.source_type,
            source_name = excluded.source_name,
            authority_tier = excluded.authority_tier,
            retrieved_at = excluded.retrieved_at,
            raw_text = excluded.raw_text
    `);

    let processedProductsCount = 0;
    let processedSourcesCount = 0;

    const transaction = () => {
        for (const prod of productsData) {
            insertProductStmt.run(
                prod.product_id,
                prod.product_name,
                prod.category || null,
                prod.image_url || null
            );
            processedProductsCount++;

            if (Array.isArray(prod.sources)) {
                for (const src of prod.sources) {
                    insertSourceStmt.run(
                        src.source_id,
                        prod.product_id,
                        src.source_type,
                        src.source_name,
                        src.authority_tier,
                        src.retrieved_at,
                        src.raw_text
                    );
                    processedSourcesCount++;
                }
            }
        }
    };

    try {
        db.exec('BEGIN TRANSACTION;');
        transaction();
        db.exec('COMMIT;');

        const productCountResult = db.prepare('SELECT COUNT(*) as count FROM products').get();
        const sourceCountResult = db.prepare('SELECT COUNT(*) as count FROM sources').get();

        console.log(`✅ Database Seeding Completed Successfully!`);
        console.log(`   Products processed in batch: ${processedProductsCount}`);
        console.log(`   Sources processed in batch:  ${processedSourcesCount}`);
        console.log(`   Total Products in DB:       ${productCountResult.count}`);
        console.log(`   Total Sources in DB:        ${sourceCountResult.count}`);

        return {
            productsProcessed: processedProductsCount,
            sourcesProcessed: processedSourcesCount,
            totalProductsInDb: productCountResult.count,
            totalSourcesInDb: sourceCountResult.count
        };
    } catch (err) {
        db.exec('ROLLBACK;');
        console.error('❌ Seeding failed:', err.message);
        process.exit(1);
    }
}

if (require.main === module) {
    seedDatabase();
}

module.exports = { seedDatabase };
