const db = require('../../db/db');
const { normalizeClaim } = require('./normalizer');

/**
 * SpecTrust AI - Deterministic Conflict Detection Module
 *
 * Detects contradictions between claims from multiple sources.
 *
 * Classification:
 *   AGREE
 *       Raw values and units are identical.
 *
 *   EQUIVALENT
 *       Raw values differ, but normalized values are equivalent.
 *
 *   GENUINE_CONFLICT
 *       Normalized values are different.
 */

/**
 * Canonical Attribute Mapping
 */
const CANONICAL_ATTRIBUTES = {
    'measuring range': 'measuring_range',
    'pressure range': 'measuring_range',
    'range': 'measuring_range',
    'operating pressure': 'measuring_range',
    'operating_pressure': 'measuring_range',
    'max pressure': 'measuring_range',

    'response time': 'response_time',
    'switching response': 'response_time',
    'response': 'response_time',

    'voltage': 'voltage',
    'coil voltage': 'voltage',
    'rated voltage': 'voltage',
    'operating voltage': 'voltage',
    'supply voltage': 'voltage',
    'supply_voltage': 'voltage',
    'coil_voltage': 'voltage',

    'current': 'current',
    'rated current': 'current',
    'load current': 'current',
    'full load current': 'current',

    'temperature range': 'operating_temperature',
    'operating temperature': 'operating_temperature',
    'ambient temperature': 'operating_temperature',
    'temp range': 'operating_temperature',
    'temp_range': 'operating_temperature',

    'thread': 'thread',
    'thread_size': 'thread',
    'thread size': 'thread',
    'thread specification': 'thread',
    'process connection': 'thread',
    'port connection': 'thread',

    'connector': 'connector',
    'electrical connector': 'connector',
    'connection type': 'connector',

    'clamping range': 'clamping_range',
    'ingress protection': 'ingress_protection',
    'accuracy': 'accuracy',
    'orifice size': 'orifice_size'
};

/**
 * Attribute Categories for Severity Classification
 */
const ATTRIBUTE_CATEGORIES = {
    SAFETY_CRITICAL: [
        'voltage',
        'current',
        'pressure',
        'measuring_range',
        'operating_temperature',
        'certification',
        'hazardous_area_rating',
        'load_rating'
    ],

    COMPATIBILITY_RISK: [
        'thread',
        'connector',
        'dimensions',
        'mounting',
        'wire_range',
        'fitting_type',
        'clamping_range',
        'orifice_size'
    ],

    GENERAL: [
        'material',
        'color',
        'cosmetic',
        'descriptive',
        'accuracy'
    ]
};

/**
 * Maps a raw attribute string to its canonical attribute key.
 *
 * @param {string} attrStr
 * @returns {string}
 */
function getCanonicalAttribute(attrStr) {
    if (!attrStr) {
        return 'general';
    }

    const cleaned = String(attrStr)
        .trim()
        .toLowerCase();

    return (
        CANONICAL_ATTRIBUTES[cleaned] ||
        cleaned.replace(/\s+/g, '_')
    );
}

/**
 * Categorizes an attribute into:
 * SAFETY_CRITICAL
 * COMPATIBILITY_RISK
 * GENERAL
 *
 * @param {string} canonicalAttr
 * @returns {string}
 */
function getAttributeCategory(canonicalAttr) {
    if (
        ATTRIBUTE_CATEGORIES.SAFETY_CRITICAL.includes(
            canonicalAttr
        )
    ) {
        return 'SAFETY_CRITICAL';
    }

    if (
        ATTRIBUTE_CATEGORIES.COMPATIBILITY_RISK.includes(
            canonicalAttr
        )
    ) {
        return 'COMPATIBILITY_RISK';
    }

    return 'GENERAL';
}

/**
 * Creates a deterministic representation of a claim's
 * raw value and raw unit.
 *
 * This is used to distinguish:
 *
 * AGREE:
 *   Same raw value + same raw unit
 *
 * EQUIVALENT:
 *   Different raw representations but equivalent
 *   normalized values
 *
 * Example:
 *
 *   10 bar + 1 MPa
 *   => raw values differ
 *   => normalized values equivalent
 *   => EQUIVALENT
 *
 *   M20x1.5 + M20x1.5
 *   => raw values identical
 *   => AGREE
 *
 * @param {object} claim
 * @returns {string}
 */
function rawComparable(claim) {
    const rawValue = String(
        claim?.raw_value ?? ''
    )
        .trim()
        .toLowerCase();

    const rawUnit = String(
        claim?.raw_unit ?? ''
    )
        .trim()
        .toLowerCase();

    return `${rawValue} ${rawUnit}`.trim();
}

/**
 * Determines severity based on attribute category
 * and whether a genuine mismatch exists.
 *
 * @param {string} category
 * @param {boolean} hasConflict
 * @returns {string}
 */
function determineSeverity(category, hasConflict) {
    if (!hasConflict) {
        return 'NONE';
    }

    if (category === 'SAFETY_CRITICAL') {
        return 'CRITICAL';
    }

    if (category === 'COMPATIBILITY_RISK') {
        return 'HIGH';
    }

    return 'MEDIUM';
}

/**
 * Compares two normalized claim objects for equivalence.
 *
 * @param {object} claimA
 * @param {object} claimB
 * @returns {{isEquivalent: boolean, reason: string}}
 */
function compareNormalizedClaims(claimA, claimB) {
    const valA = String(
        claimA.normalized_value ??
        claimA.raw_value ??
        ''
    ).trim();

    const valB = String(
        claimB.normalized_value ??
        claimB.raw_value ??
        ''
    ).trim();

    const unitA = String(
        claimA.normalized_unit ??
        claimA.raw_unit ??
        ''
    )
        .trim()
        .toLowerCase();

    const unitB = String(
        claimB.normalized_unit ??
        claimB.raw_unit ??
        ''
    )
        .trim()
        .toLowerCase();

    /**
     * Exact string match
     */
    if (
        valA === valB &&
        unitA === unitB
    ) {
        return {
            isEquivalent: true,
            reason: 'Exact value and unit match'
        };
    }

    /**
     * Numeric comparison
     */
    const numA = parseFloat(valA);
    const numB = parseFloat(valB);

    if (
        !isNaN(numA) &&
        !isNaN(numB) &&
        unitA === unitB
    ) {
        const diff = Math.abs(numA - numB);

        if (diff < 0.0001) {
            return {
                isEquivalent: true,
                reason: 'Numeric equivalence within tolerance'
            };
        }

        return {
            isEquivalent: false,
            reason: `Numeric mismatch: ${numA} vs ${numB}`
        };
    }

    /**
     * Range comparison
     *
     * Example:
     *   0-10 vs 0-10
     */
    if (
        valA.includes('-') &&
        valB.includes('-') &&
        unitA === unitB
    ) {
        const [minA, maxA] = valA
            .split('-')
            .map(v => parseFloat(v.trim()));

        const [minB, maxB] = valB
            .split('-')
            .map(v => parseFloat(v.trim()));

        if (
            !isNaN(minA) &&
            !isNaN(maxA) &&
            !isNaN(minB) &&
            !isNaN(maxB)
        ) {
            if (
                Math.abs(minA - minB) < 0.0001 &&
                Math.abs(maxA - maxB) < 0.0001
            ) {
                return {
                    isEquivalent: true,
                    reason: 'Range equivalence'
                };
            }

            return {
                isEquivalent: false,
                reason: `Range mismatch: ${valA} vs ${valB}`
            };
        }
    }

    /**
     * Text equivalence rules
     */
    const textA = `${valA} ${unitA}`
        .trim()
        .toLowerCase();

    const textB = `${valB} ${unitB}`
        .trim()
        .toLowerCase();

    /**
     * Stainless steel handling
     */
    if (
        (
            textA.includes('316') &&
            textB.includes('316')
        ) ||
        (
            textA.includes('stainless') &&
            textB.includes('stainless')
        )
    ) {
        if (
            textA.includes('304') !==
            textB.includes('304')
        ) {
            return {
                isEquivalent: false,
                reason:
                    'Stainless steel grade mismatch (304 vs 316)'
            };
        }
    }

    return {
        isEquivalent: false,
        reason:
            `Value/unit mismatch: "${valA} ${unitA}" vs "${valB} ${unitB}"`
    };
}

/**
 * Analyzes and detects conflicts across all claims
 * for a given product.
 *
 * @param {string} productId
 * @returns {Promise<Array<object>>}
 */
async function analyzeProductConflicts(productId) {
    console.log(
        `[CONFLICT] Analyzing conflicts for product ${productId}...`
    );

    /**
     * 1. Load product claims from database
     */
    const claimsStmt = db.prepare(`
        SELECT
            id,
            product_id,
            source_id,
            attribute,
            raw_value,
            raw_unit,
            normalized_value,
            normalized_unit,
            extraction_confidence
        FROM claims
        WHERE product_id = ?
        ORDER BY attribute ASC, source_id ASC
    `);

    const claims = claimsStmt.all(productId);

    if (!claims || claims.length === 0) {
        console.log(
            `[CONFLICT] No claims found for product ${productId}`
        );

        return [];
    }

    /**
     * 2. Group claims by canonical attribute
     */
    const groupedByAttr = {};

    for (const claim of claims) {
        const canonical =
            getCanonicalAttribute(claim.attribute);

        if (!groupedByAttr[canonical]) {
            groupedByAttr[canonical] = [];
        }

        groupedByAttr[canonical].push(claim);
    }

    /**
     * Delete previous conflict records.
     *
     * This makes conflict analysis idempotent.
     *
     * IMPORTANT:
     * This does NOT delete claims or sources.
     */
    const deleteOldStmt = db.prepare(
        'DELETE FROM conflicts WHERE product_id = ?'
    );

    deleteOldStmt.run(productId);

    /**
     * Prepare conflict insertion.
     */
    const insertConflictStmt = db.prepare(`
        INSERT INTO conflicts (
            product_id,
            attribute,
            claim_ids,
            status,
            severity,
            rationale_text
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const conflictResults = [];

    /**
     * 3. Compare claims for every attribute.
     */
    for (
        const [attrKey, attrClaims]
        of Object.entries(groupedByAttr)
    ) {
        /**
         * No cross-source comparison is possible
         * with only one claim.
         */
        if (attrClaims.length <= 1) {
            continue;
        }

        const category =
            getAttributeCategory(attrKey);

        let hasMismatch = false;

        const claimIds =
            attrClaims.map(claim => claim.id);

        const sourceDetails =
            attrClaims.map(
                claim =>
                    `${claim.source_id}: "${claim.normalized_value ?? claim.raw_value ?? ''} ${claim.normalized_unit ?? claim.raw_unit ?? ''}"`
            );

        /**
         * Compare every claim against the first claim.
         */
        const refClaim = attrClaims[0];

        for (
            let i = 1;
            i < attrClaims.length;
            i++
        ) {
            const cmpResult =
                compareNormalizedClaims(
                    refClaim,
                    attrClaims[i]
                );

            if (!cmpResult.isEquivalent) {
                hasMismatch = true;
                break;
            }
        }

        /**
         * Determine classification.
         *
         * If normalized values differ:
         *     GENUINE_CONFLICT
         *
         * If normalized values agree:
         *     Compare raw values.
         *
         *     Same raw representation:
         *         AGREE
         *
         *     Different raw representation:
         *         EQUIVALENT
         */
        let classification = 'EQUIVALENT';

        if (!hasMismatch) {
            const allRawEqual =
                attrClaims.every(
                    claim =>
                        rawComparable(claim) ===
                        rawComparable(refClaim)
                );

            classification =
                allRawEqual
                    ? 'AGREE'
                    : 'EQUIVALENT';
        } else {
            classification =
                'GENUINE_CONFLICT';
        }

        /**
         * Severity
         */
        const severity =
            determineSeverity(
                category,
                hasMismatch
            );

        /**
         * Base rationale
         */
        let rationale =
            `Claims across ${attrClaims.length} sources for attribute '${attrKey}' (${classification}): ${sourceDetails.join(' | ')}.`;

        /**
         * EQUIVALENT rationale
         */
        if (
            classification === 'EQUIVALENT'
        ) {
            rationale =
                `All sources report semantically equivalent normalized values (${sourceDetails.join(' | ')}). No genuine conflict.`;
        }

        /**
         * AGREE rationale
         */
        else if (
            classification === 'AGREE'
        ) {
            rationale =
                `All sources agree exactly on value (${sourceDetails.join(' | ')}).`;
        }

        /**
         * GENUINE CONFLICT rationale
         */
        else if (
            classification === 'GENUINE_CONFLICT'
        ) {
            rationale =
                `Discrepancy detected across sources for ${attrKey} [Severity: ${severity}]. Details: ${sourceDetails.join(' | ')}.`;
        }

        /**
         * Store conflict record.
         */
        const info =
            insertConflictStmt.run(
                productId,
                attrKey,
                JSON.stringify(claimIds),
                classification,
                severity,
                rationale
            );

        /**
         * Return API-friendly record.
         */
        const record = {
            id: info.lastInsertRowid,
            product_id: productId,
            attribute: attrKey,
            claim_ids: claimIds,
            status: classification,
            severity,
            rationale_text: rationale
        };

        conflictResults.push(record);

        console.log(
            `[CONFLICT] Product ${productId} | ${attrKey}: ${classification} [Severity: ${severity}]`
        );
    }

    return conflictResults;
}

/**
 * Exports
 */
module.exports = {
    analyzeProductConflicts,
    getCanonicalAttribute,
    getAttributeCategory,
    compareNormalizedClaims,
    determineSeverity,
    rawComparable
};