const db = require('../../db/db');
const { extractClaimsFromText } = require('./llm');
const { normalizeClaim } = require('./normalizer');

/**
 * Pipeline Extractor: Reads source texts for a product, calls LLM/Demo extractor,
 * normalizes claims deterministically, and stores them in SQLite.
 * 
 * @param {string} productId - Product ID (e.g., 'ST-011')
 * @returns {Promise<Array<object>>} Extracted and normalized claims stored in database
 */
async function processProductExtraction(productId) {
    console.log(`[EXTRACT] Starting extraction pipeline for product ${productId}...`);

    // 1. Fetch sources from database
    const sourcesStmt = db.prepare('SELECT id, product_id, source_type, source_name, authority_tier, raw_text FROM sources WHERE product_id = ? ORDER BY authority_tier ASC');
    const sources = sourcesStmt.all(productId);

    if (!sources || sources.length === 0) {
        throw new Error(`No sources found in database for product '${productId}'`);
    }

    // Prepare SQL statements
    const deleteOldClaimsStmt = db.prepare('DELETE FROM claims WHERE product_id = ?');
    const insertClaimStmt = db.prepare(`
        INSERT INTO claims (product_id, source_id, attribute, raw_value, raw_unit, normalized_value, normalized_unit, extraction_confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const newClaims = [];

    // Delete existing claims for clean idempotent re-extraction
    deleteOldClaimsStmt.run(productId);

    // 2. Extract and normalize claims per source
    for (const src of sources) {
        console.log(`[EXTRACT] Processing source ${src.id} (${src.source_name})...`);
        const extractedList = await extractClaimsFromText(productId, src.id, src.raw_text);

        for (const item of extractedList) {
            // Perform deterministic unit normalization
            const normResult = normalizeClaim(item.attribute, item.raw_value, item.raw_unit);

            console.log(`[normalize] ${src.id} | ${item.attribute}: "${item.raw_value} ${item.raw_unit}" ➔ "${normResult.normalized_value} ${normResult.normalized_unit}"`);

            const claimRecord = {
                product_id: productId,
                source_id: src.id,
                attribute: item.attribute,
                raw_value: String(item.raw_value),
                raw_unit: String(item.raw_unit || ''),
                normalized_value: String(normResult.normalized_value),
                normalized_unit: String(normResult.normalized_unit || ''),
                extraction_confidence: item.extraction_confidence || 1.0
            };

            const info = insertClaimStmt.run(
                claimRecord.product_id,
                claimRecord.source_id,
                claimRecord.attribute,
                claimRecord.raw_value,
                claimRecord.raw_unit,
                claimRecord.normalized_value,
                claimRecord.normalized_unit,
                claimRecord.extraction_confidence
            );

            console.log(`[DB] Saved claim ID ${info.lastInsertRowid} for ${claimRecord.attribute}`);
            newClaims.push({
                id: info.lastInsertRowid,
                ...claimRecord
            });
        }
    }

    console.log(`[EXTRACT] Completed extraction for product ${productId}. Total claims generated: ${newClaims.length}`);
    return newClaims;
}

module.exports = {
    processProductExtraction
};
