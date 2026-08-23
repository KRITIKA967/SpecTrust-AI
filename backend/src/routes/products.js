const express = require('express');

const router = express.Router();

const db = require('../../db/db');

const { processProductExtraction } = require('../pipeline/extractor');
const { analyzeProductConflicts } = require('../pipeline/conflictDetector');
const { processProductArbitration } = require('../pipeline/arbitrator');

const {
    computeProductTrustScores,
    getProductTrustScores
} = require('../pipeline/trustScore');

// ============================================================
// Helpers
// ============================================================

function getProductById(productId) {
    return db.prepare(`
        SELECT
            id,
            name,
            category,
            image_url,
            created_at
        FROM products
        WHERE id = ?
    `).get(productId);
}

function parseClaimIds(value) {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value;
    }

    try {
        const parsed = JSON.parse(String(value));

        return Array.isArray(parsed)
            ? parsed
            : [];
    } catch (error) {
        console.warn(
            `[PRODUCT API] Invalid claim_ids JSON: ${value}`
        );

        return [];
    }
}

// ============================================================
// GET /api/products
// ============================================================

router.get('/', (req, res) => {
    try {
        const products = db.prepare(`
            SELECT
                id,
                name,
                category,
                image_url,
                created_at
            FROM products
            ORDER BY id ASC
        `).all();

        res.json({
            success: true,
            count: products.length,
            products
        });

    } catch (err) {
        console.error(
            '[PRODUCT API] Error fetching products:',
            err
        );

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ============================================================
// GET /api/products/:id
// Product details + sources
//
// IMPORTANT:
// This endpoint does NOT automatically expose analysis results
// as completed analysis.
//
// The frontend must explicitly call /analyze.
// ============================================================

router.get('/:id', (req, res) => {
    try {
        const productId = req.params.id;

        const product = getProductById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: `Product with id '${productId}' not found`
            });
        }

        const sources = db.prepare(`
            SELECT
                id,
                product_id,
                source_type,
                source_name,
                authority_tier,
                retrieved_at,
                raw_text
            FROM sources
            WHERE product_id = ?
            ORDER BY authority_tier ASC, id ASC
        `).all(productId);

        res.json({
            success: true,
            ...product,
            sources_count: sources.length,
            sources
        });

    } catch (err) {
        console.error(
            `[PRODUCT API] Error fetching product ${req.params.id}:`,
            err
        );

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ============================================================
// POST /api/products/:id/extract
// ============================================================

router.post('/:id/extract', async (req, res) => {
    try {
        const productId = req.params.id;

        const product = getProductById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: `Product with id '${productId}' not found`
            });
        }

        console.log(
            `[PIPELINE] Starting extraction for ${productId}...`
        );

        const claims =
            await processProductExtraction(productId);

        console.log(
            `[PIPELINE] Extraction complete for ${productId}: ${claims.length} claims`
        );

        res.json({
            success: true,
            product_id: productId,
            stage: 'extraction',
            claims_count: claims.length,
            claims
        });

    } catch (err) {
        console.error(
            `[PIPELINE] Extraction failed for ${req.params.id}:`,
            err
        );

        res.status(500).json({
            success: false,
            product_id: req.params.id,
            stage: 'extraction',
            error: err.message
        });
    }
});

// ============================================================
// GET /api/products/:id/claims
// ============================================================

router.get('/:id/claims', (req, res) => {
    try {
        const productId = req.params.id;

        const product = getProductById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: `Product with id '${productId}' not found`
            });
        }

        const claims = db.prepare(`
            SELECT
                id,
                product_id,
                source_id,
                attribute,
                raw_value,
                raw_unit,
                normalized_value,
                normalized_unit,
                extraction_confidence,
                created_at
            FROM claims
            WHERE product_id = ?
            ORDER BY attribute ASC, source_id ASC
        `).all(productId);

        res.json({
            success: true,
            product_id: productId,
            claims_count: claims.length,
            claims
        });

    } catch (err) {
        console.error(
            `[PRODUCT API] Error fetching claims for ${req.params.id}:`,
            err
        );

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ============================================================
// POST /api/products/:id/analyze-conflicts
// ============================================================

router.post('/:id/analyze-conflicts', async (req, res) => {
    try {
        const productId = req.params.id;

        const product = getProductById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: `Product with id '${productId}' not found`
            });
        }

        console.log(
            `[PIPELINE] Starting conflict analysis for ${productId}...`
        );

        const conflicts =
            await analyzeProductConflicts(productId);

        console.log(
            `[PIPELINE] Conflict analysis complete for ${productId}: ${conflicts.length} records`
        );

        res.json({
            success: true,
            product_id: productId,
            stage: 'conflict_detection',
            conflicts_count: conflicts.length,
            conflicts
        });

    } catch (err) {
        console.error(
            `[PIPELINE] Conflict analysis failed for ${req.params.id}:`,
            err
        );

        res.status(500).json({
            success: false,
            product_id: req.params.id,
            stage: 'conflict_detection',
            error: err.message
        });
    }
});

// ============================================================
// GET /api/products/:id/conflicts
// ============================================================

router.get('/:id/conflicts', (req, res) => {
    try {
        const productId = req.params.id;

        const product = getProductById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: `Product with id '${productId}' not found`
            });
        }

        const rawConflicts = db.prepare(`
            SELECT
                id,
                product_id,
                attribute,
                claim_ids,
                status,
                severity,
                rationale_text,
                created_at
            FROM conflicts
            WHERE product_id = ?
            ORDER BY id ASC
        `).all(productId);

        const conflicts = rawConflicts.map(conflict => ({
            ...conflict,
            claim_ids: parseClaimIds(conflict.claim_ids)
        }));

        res.json({
            success: true,
            product_id: productId,
            conflicts_count: conflicts.length,
            conflicts
        });

    } catch (err) {
        console.error(
            `[PRODUCT API] Error fetching conflicts for ${req.params.id}:`,
            err
        );

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ============================================================
// POST /api/products/:id/resolve-conflicts
//
// Arbitration
//     ↓
// Trust Score
//     ↓
// Persist trust_scores
// ============================================================

router.post('/:id/resolve-conflicts', async (req, res) => {
    try {
        const productId = req.params.id;

        const product = getProductById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: `Product with id '${productId}' not found`
            });
        }

        console.log(
            `[PIPELINE] Starting arbitration for ${productId}...`
        );

        const resolutions =
            await processProductArbitration(productId);

        console.log(
            `[PIPELINE] Arbitration complete for ${productId}: ${resolutions.length} resolutions`
        );

        console.log(
            `[PIPELINE] Computing Trust Score for ${productId}...`
        );

        const trustScores =
            computeProductTrustScores(productId);

        console.log(
            `[PIPELINE] Trust Score: ${trustScores.product_trust_score}/100`
        );

        res.json({
            success: true,
            product_id: productId,
            stage: 'complete',

            resolutions_count:
                resolutions.length,

            resolutions,

            trust_score: {
                product_trust_score:
                    trustScores.product_trust_score,

                attributes:
                    trustScores.attributes
            }
        });

    } catch (err) {
        console.error(
            `[PIPELINE] Arbitration failed for ${req.params.id}:`,
            err
        );

        res.status(500).json({
            success: false,
            product_id: req.params.id,
            stage: 'arbitration',
            error: err.message
        });
    }
});

// ============================================================
// GET /api/products/:id/resolutions
// ============================================================

router.get('/:id/resolutions', (req, res) => {
    try {
        const productId = req.params.id;

        const product = getProductById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: `Product with id '${productId}' not found`
            });
        }

        const rawResolutions = db.prepare(`
            SELECT
                r.id,
                r.conflict_id,
                c.attribute,
                c.severity,
                c.status AS conflict_status,
                r.resolved_value,
                r.resolved_unit,
                r.confidence,
                r.source_id_chosen,
                r.reviewer_status,
                r.explanation,
                r.resolved_at
            FROM resolutions r
            JOIN conflicts c
                ON r.conflict_id = c.id
            WHERE c.product_id = ?
            ORDER BY r.id ASC
        `).all(productId);

        const resolutions =
            rawResolutions.map(resolution => ({
                ...resolution,

                // Database stores confidence as 0–1.
                // Frontend receives confidence as 0–100.
                confidence:
                    Number.isFinite(
                        Number(resolution.confidence)
                    )
                        ? Number(resolution.confidence) * 100
                        : null,

                requires_human_review:
                    String(
                        resolution.reviewer_status || ''
                    ).toUpperCase() ===
                    'PENDING_REVIEW'
            }));

        res.json({
            success: true,
            product_id: productId,
            resolutions_count:
                resolutions.length,
            resolutions
        });

    } catch (err) {
        console.error(
            `[PRODUCT API] Error fetching resolutions for ${req.params.id}:`,
            err
        );

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ============================================================
// GET /api/products/:id/trust-score
//
// Backend is the single source of truth for Trust Score.
// ============================================================

router.get('/:id/trust-score', (req, res) => {
    try {
        const productId = req.params.id;

        const product = getProductById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: `Product with id '${productId}' not found`
            });
        }

        const trustScores =
            getProductTrustScores(productId);

        res.json({
            success: true,
            product_id: productId,

            product_trust_score:
                trustScores.product_trust_score,

            attributes:
                trustScores.attributes
        });

    } catch (err) {
        console.error(
            `[TRUST API] Error fetching trust score for ${req.params.id}:`,
            err
        );

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ============================================================
// POST /api/products/:id/analyze
//
// COMPLETE ANALYSIS PIPELINE
//
// 1. Extraction
// 2. Conflict Detection
// 3. Arbitration
// 4. Trust Score
//
// This is the primary endpoint that the frontend should use
// when the user clicks "Analyze Product".
// ============================================================

router.post('/:id/analyze', async (req, res) => {
    const productId = req.params.id;

    try {
        const product = getProductById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                product_id: productId,
                analysis_complete: false,
                error: `Product with id '${productId}' not found`
            });
        }

        console.log('');
        console.log(
            '================================================'
        );
        console.log(
            `[FULL PIPELINE] Starting analysis for ${productId}`
        );
        console.log(
            '================================================'
        );

        // ----------------------------------------------------
        // Stage 1 — Extraction
        // ----------------------------------------------------

        console.log(
            '[FULL PIPELINE] 1/4 Extraction...'
        );

        const claims =
            await processProductExtraction(productId);

        console.log(
            `[FULL PIPELINE] Extraction complete: ${claims.length} claims`
        );

        // ----------------------------------------------------
        // Stage 2 — Conflict Detection
        // ----------------------------------------------------

        console.log(
            '[FULL PIPELINE] 2/4 Conflict detection...'
        );

        const conflicts =
            await analyzeProductConflicts(productId);

        console.log(
            `[FULL PIPELINE] Conflict detection complete: ${conflicts.length} records`
        );

        // ----------------------------------------------------
        // Stage 3 — Arbitration
        // ----------------------------------------------------

        console.log(
            '[FULL PIPELINE] 3/4 Arbitration...'
        );

        const resolutions =
            await processProductArbitration(productId);

        console.log(
            `[FULL PIPELINE] Arbitration complete: ${resolutions.length} resolutions`
        );

        // ----------------------------------------------------
        // Stage 4 — Trust Score
        // ----------------------------------------------------

        console.log(
            '[FULL PIPELINE] 4/4 Trust Score...'
        );

        const trustScores =
            computeProductTrustScores(productId);

        console.log(
            `[FULL PIPELINE] Trust Score: ${trustScores.product_trust_score}/100`
        );

        console.log(
            `[FULL PIPELINE] Analysis completed for ${productId}`
        );

        console.log(
            '================================================'
        );
        console.log('');

        // ----------------------------------------------------
        // Complete response
        // ----------------------------------------------------

        res.json({
            success: true,

            product_id: productId,

            analysis_complete: true,

            completed_at:
                new Date().toISOString(),

            extraction: {
                claims_count:
                    claims.length,

                claims
            },

            conflict_detection: {
                conflicts_count:
                    conflicts.length,

                conflicts
            },

            arbitration: {
                resolutions_count:
                    resolutions.length,

                resolutions
            },

            trust_score: {
                product_trust_score:
                    trustScores.product_trust_score,

                attributes:
                    trustScores.attributes
            }
        });

    } catch (err) {
        console.error('');
        console.error(
            `[FULL PIPELINE] Analysis failed for ${productId}:`
        );
        console.error(err);
        console.error('');

        res.status(500).json({
            success: false,

            product_id: productId,

            analysis_complete: false,

            error: err.message
        });
    }
});

// ============================================================
// Export
// ============================================================

module.exports = router;