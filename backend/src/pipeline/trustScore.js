/**
 * SpecTrust AI - Deterministic Trust Score Module
 *
 * Trust Score is different from Arbitration Score.
 *
 * Arbitration Score:
 *   Which source/value should win?
 *
 * Trust Score:
 *   How trustworthy is the resulting attribute data?
 *
 * Official formula:
 *
 * attribute_trust_score =
 *   100
 *   - (30 * has_genuine_conflict)
 *   - (15 * has_stale_conflict)
 *   - (10 * (1 - avg_extraction_confidence))
 *   - severity_penalty
 *
 * severity_penalty:
 *   safety-critical      = 25
 *   compatibility-risk   = 12
 *   cosmetic              = 3
 *   no genuine conflict   = 0
 *
 * Result is clamped to [0, 100].
 *
 * Product Trust Score:
 * weighted average of attribute scores,
 * with safety-critical attributes receiving 2x weight.
 */

const db = require('../../db/db');

// ---------------------------------------------------------
// Configuration
// ---------------------------------------------------------

const SEVERITY_PENALTIES = {
    safety_critical: 25,
    compatibility_risk: 12,
    cosmetic: 3
};

const SAFETY_CRITICAL_WEIGHT = 2;
const NORMAL_ATTRIBUTE_WEIGHT = 1;

// ---------------------------------------------------------
// Severity normalization
// ---------------------------------------------------------

/**
 * Converts the different severity labels used by the project
 * into the canonical Trust Score severity names.
 */
function normalizeSeverity(severity) {
    const value = String(severity || '').trim().toLowerCase();

    if (
        value === 'safety_critical' ||
        value === 'safety-critical' ||
        value === 'critical'
    ) {
        return 'safety_critical';
    }

    if (
        value === 'compatibility_risk' ||
        value === 'compatibility-risk' ||
        value === 'high'
    ) {
        return 'compatibility_risk';
    }

    if (
        value === 'cosmetic' ||
        value === 'low' ||
        value === 'medium'
    ) {
        return 'cosmetic';
    }

    return null;
}

// ---------------------------------------------------------
// Attribute Trust Score
// ---------------------------------------------------------

/**
 * Calculate the deterministic trust score for one attribute.
 *
 * @param {Object} params
 * @param {Array} params.claims
 * @param {Array} params.conflicts
 * @returns {Object}
 */
function calculateAttributeTrustScore({
    claims = [],
    conflicts = []
} = {}) {
    const safeClaims = Array.isArray(claims) ? claims : [];
    const safeConflicts = Array.isArray(conflicts) ? conflicts : [];

    // -----------------------------------------------------
    // Genuine conflicts
    // -----------------------------------------------------

    const genuineConflicts = safeConflicts.filter(
        conflict =>
            String(conflict.status || '').trim().toUpperCase() ===
            'GENUINE_CONFLICT'
    );

    // -----------------------------------------------------
    // Stale conflicts
    // -----------------------------------------------------

    const staleConflicts = safeConflicts.filter(conflict => {
        const status = String(
            conflict.status || ''
        ).trim().toUpperCase();

        return (
            status === 'STALE_SUPERSEDED' ||
            status === 'STALE'
        );
    });

    const hasGenuineConflict = genuineConflicts.length > 0;
    const hasStaleConflict = staleConflicts.length > 0;

    // -----------------------------------------------------
    // Average extraction confidence
    // -----------------------------------------------------

    let avgExtractionConfidence = 1;

    if (safeClaims.length > 0) {
        const confidenceValues = safeClaims.map(claim => {
            const confidence = Number(
                claim.extraction_confidence
            );

            if (!Number.isFinite(confidence)) {
                return 1;
            }

            return Math.max(
                0,
                Math.min(1, confidence)
            );
        });

        avgExtractionConfidence =
            confidenceValues.reduce(
                (sum, value) => sum + value,
                0
            ) / confidenceValues.length;
    }

    // -----------------------------------------------------
    // Determine highest severity
    // -----------------------------------------------------

    let severityPenalty = 0;
    let normalizedSeverity = null;

    if (hasGenuineConflict) {
        const severityPriority = {
            safety_critical: 3,
            compatibility_risk: 2,
            cosmetic: 1
        };

        for (const conflict of genuineConflicts) {
            const severity = normalizeSeverity(
                conflict.severity
            );

            if (!severity) {
                continue;
            }

            if (
                normalizedSeverity === null ||
                severityPriority[severity] >
                    severityPriority[normalizedSeverity]
            ) {
                normalizedSeverity = severity;
            }
        }

        severityPenalty =
            SEVERITY_PENALTIES[normalizedSeverity] || 0;
    }

    // -----------------------------------------------------
    // Official Trust Score formula
    // -----------------------------------------------------

    let score =
        100
        - (
            30 *
            (hasGenuineConflict ? 1 : 0)
        )
        - (
            15 *
            (hasStaleConflict ? 1 : 0)
        )
        - (
            10 *
            (1 - avgExtractionConfidence)
        )
        - severityPenalty;

    // -----------------------------------------------------
    // Clamp score to 0–100
    // -----------------------------------------------------

    score = Math.max(
        0,
        Math.min(100, score)
    );

    return {
        score: Math.round(score * 10) / 10,

        avg_extraction_confidence:
            Math.round(
                avgExtractionConfidence * 1000
            ) / 1000,

        has_genuine_conflict:
            hasGenuineConflict,

        has_stale_conflict:
            hasStaleConflict,

        severity:
            normalizedSeverity,

        severity_penalty:
            severityPenalty
    };
}

// ---------------------------------------------------------
// Product Trust Score
// ---------------------------------------------------------

/**
 * Calculate product-level Trust Score.
 *
 * Safety-critical attributes receive 2x weighting.
 *
 * @param {Array} attributeScores
 * @returns {number}
 */
function calculateProductTrustScore(
    attributeScores = []
) {
    if (
        !Array.isArray(attributeScores) ||
        attributeScores.length === 0
    ) {
        return 100;
    }

    let weightedTotal = 0;
    let totalWeight = 0;

    for (const attribute of attributeScores) {
        const score = Number(attribute.score);

        if (!Number.isFinite(score)) {
            continue;
        }

        const severity = normalizeSeverity(
            attribute.severity
        );

        const weight =
            severity === 'safety_critical'
                ? SAFETY_CRITICAL_WEIGHT
                : NORMAL_ATTRIBUTE_WEIGHT;

        weightedTotal += score * weight;
        totalWeight += weight;
    }

    if (totalWeight === 0) {
        return 100;
    }

    const score =
        weightedTotal / totalWeight;

    return Math.round(
        Math.max(
            0,
            Math.min(100, score)
        ) * 10
    ) / 10;
}

// ---------------------------------------------------------
// Compute + Persist Trust Scores
// ---------------------------------------------------------

/**
 * Computes attribute-level and product-level Trust Scores.
 *
 * IMPORTANT:
 * This implementation intentionally does NOT use
 * db.transaction(), because the current DatabaseSync
 * instance in this project does not expose that method.
 *
 * @param {string} productId
 * @returns {Object}
 */
function computeProductTrustScores(productId) {
    if (!productId) {
        throw new Error(
            'productId is required to compute trust scores'
        );
    }

    console.log(
        `[TRUST] Computing trust scores for ${productId}...`
    );

    // -----------------------------------------------------
    // Load claims
    // -----------------------------------------------------

    const claims = db.prepare(`
        SELECT
            id,
            product_id,
            source_id,
            attribute,
            extraction_confidence
        FROM claims
        WHERE product_id = ?
        ORDER BY attribute ASC, id ASC
    `).all(productId);

    // -----------------------------------------------------
    // Load conflicts
    // -----------------------------------------------------

    const conflicts = db.prepare(`
        SELECT
            id,
            product_id,
            attribute,
            claim_ids,
            status,
            severity,
            rationale_text
        FROM conflicts
        WHERE product_id = ?
        ORDER BY id ASC
    `).all(productId);

    // -----------------------------------------------------
    // Determine all attributes
    // -----------------------------------------------------

    const attributes = new Set();

    for (const claim of claims) {
        if (claim.attribute) {
            attributes.add(claim.attribute);
        }
    }

    for (const conflict of conflicts) {
        if (conflict.attribute) {
            attributes.add(conflict.attribute);
        }
    }

    const attributeScores = [];

    // -----------------------------------------------------
    // Calculate each attribute
    // -----------------------------------------------------

    for (const attribute of attributes) {
        const attributeClaims =
            claims.filter(
                claim =>
                    claim.attribute === attribute
            );

        const attributeConflicts =
            conflicts.filter(
                conflict =>
                    conflict.attribute === attribute
            );

        const result =
            calculateAttributeTrustScore({
                claims: attributeClaims,
                conflicts: attributeConflicts
            });

        attributeScores.push({
            product_id: productId,
            attribute,
            ...result
        });
    }

    // -----------------------------------------------------
    // Persist scores
    // -----------------------------------------------------

    const deleteExisting = db.prepare(`
        DELETE FROM trust_scores
        WHERE product_id = ?
    `);

    const insertTrustScore = db.prepare(`
        INSERT INTO trust_scores (
            product_id,
            attribute,
            score,
            last_computed_at
        )
        VALUES (
            ?,
            ?,
            ?,
            CURRENT_TIMESTAMP
        )
    `);

    /*
     * DatabaseSync in the current project does not provide
     * db.transaction().
     *
     * Therefore we execute the statements directly.
     *
     * Foreign keys remain enabled through db.js.
     */

    deleteExisting.run(productId);

    for (const item of attributeScores) {
        insertTrustScore.run(
            item.product_id,
            item.attribute,
            item.score
        );
    }

    // -----------------------------------------------------
    // Product-level Trust Score
    // -----------------------------------------------------

    const productTrustScore =
        calculateProductTrustScore(
            attributeScores
        );

    console.log(
        `[TRUST] ${productId}: ${productTrustScore}/100`
    );

    return {
        product_id: productId,
        product_trust_score:
            productTrustScore,
        attributes:
            attributeScores
    };
}

// ---------------------------------------------------------
// Get Stored Trust Scores
// ---------------------------------------------------------

/**
 * Retrieves persisted Trust Scores for a product.
 *
 * @param {string} productId
 * @returns {Object}
 */
function getProductTrustScores(productId) {
    if (!productId) {
        throw new Error(
            'productId is required to retrieve trust scores'
        );
    }

    const attributes = db.prepare(`
        SELECT
            id,
            product_id,
            attribute,
            score,
            last_computed_at
        FROM trust_scores
        WHERE product_id = ?
        ORDER BY attribute ASC
    `).all(productId);

    const productTrustScore =
        calculateProductTrustScore(
            attributes
        );

    return {
        product_id: productId,
        product_trust_score:
            productTrustScore,
        attributes
    };
}

// ---------------------------------------------------------
// Exports
// ---------------------------------------------------------

module.exports = {
    calculateAttributeTrustScore,
    calculateProductTrustScore,
    computeProductTrustScores,
    getProductTrustScores,
    normalizeSeverity,
    SEVERITY_PENALTIES
};