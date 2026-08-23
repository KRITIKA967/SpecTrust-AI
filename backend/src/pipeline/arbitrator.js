const db = require('../../db/db');

/**
 * SpecTrust AI - Explainable Arbitration Module
 *
 * Computes source trust scores based on:
 * 1. Source Authority
 * 2. Source Recency
 * 3. Agreement Score
 * 4. Extraction Confidence
 *
 * Score Formula (0-100):
 * arbitration_score = (
 *     (authority_weight * 0.45) +
 *     (recency_score * 0.20) +
 *     (agreement_score * 0.20) +
 *     (extraction_confidence * 0.15)
 * ) * 100
 */

const AUTHORITY_WEIGHTS = {
    1: 1.00, // Manufacturer Datasheet
    2: 0.75, // Distributor PIM
    3: 0.50  // Scraped / Legacy Website
};

/**
 * Calculates recency score deterministically.
 *
 * Formula:
 * recency_score = 1 / (1 + age_in_years * 0.15)
 */
function calculateRecencyScore(
    retrievedAtStr,
    referenceDate = new Date('2026-08-22')
) {
    if (!retrievedAtStr) return 0.75;

    const date = new Date(retrievedAtStr);

    if (isNaN(date.getTime())) {
        return 0.75;
    }

    const diffMs = Math.max(
        0,
        referenceDate.getTime() - date.getTime()
    );

    const ageInYears =
        diffMs / (365.25 * 24 * 60 * 60 * 1000);

    return 1 / (1 + ageInYears * 0.15);
}

/**
 * Arbitrates conflicts and generates explainable recommendations.
 *
 * @param {string} productId
 * @returns {Promise<Array<object>>}
 */
async function processProductArbitration(productId) {
    console.log(
        `[ARBITRATE] Running arbitration for product ${productId}...`
    );

    // ------------------------------------------------------------
    // 1. Fetch sources
    // ------------------------------------------------------------

    const sourcesStmt = db.prepare(`
        SELECT
            id,
            product_id,
            source_type,
            source_name,
            authority_tier,
            retrieved_at
        FROM sources
        WHERE product_id = ?
    `);

    const sources = sourcesStmt.all(productId);

    const sourceMap = {};

    sources.forEach((source) => {
        sourceMap[source.id] = source;
    });

    // ------------------------------------------------------------
    // 2. Fetch claims
    // ------------------------------------------------------------

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
    `);

    const claims = claimsStmt.all(productId);

    // ------------------------------------------------------------
    // 3. Fetch conflicts
    // ------------------------------------------------------------

    const conflictsStmt = db.prepare(`
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
    `);

    const conflicts = conflictsStmt.all(productId);

    if (!conflicts || conflicts.length === 0) {
        console.log(
            `[ARBITRATE] No conflicts found to arbitrate for product ${productId}`
        );

        return [];
    }

    // ------------------------------------------------------------
    // 4. Delete old resolutions
    // ------------------------------------------------------------

    const conflictIds = conflicts.map(
        (conflict) => conflict.id
    );

    if (conflictIds.length > 0) {
        const placeholders = conflictIds
            .map(() => '?')
            .join(',');

        const deleteOldResolutionsStmt = db.prepare(`
            DELETE FROM resolutions
            WHERE conflict_id IN (${placeholders})
        `);

        deleteOldResolutionsStmt.run(...conflictIds);
    }

    // ------------------------------------------------------------
    // 5. Prepare resolution insert
    //
    // IMPORTANT:
    // The database already contains an `explanation` column.
    // We now persist the generated arbitration explanation.
    // ------------------------------------------------------------

    const insertResolutionStmt = db.prepare(`
        INSERT INTO resolutions (
            conflict_id,
            resolved_value,
            resolved_unit,
            confidence,
            source_id_chosen,
            reviewer_status,
            explanation,
            resolved_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const resolutionsList = [];

    // ------------------------------------------------------------
    // 6. Process every conflict
    // ------------------------------------------------------------

    for (const conflict of conflicts) {

        let claimIds = [];

        try {
            claimIds = JSON.parse(
                conflict.claim_ids || '[]'
            );
        } catch (error) {
            console.warn(
                `[ARBITRATE] Invalid claim_ids JSON for conflict ${conflict.id}`
            );

            claimIds = [];
        }

        const conflictClaims = claims.filter(
            (claim) => claimIds.includes(claim.id)
        );

        // ========================================================
        // A. AGREEMENT / SEMANTIC EQUIVALENCE
        // ========================================================

        if (
            conflict.status === 'EQUIVALENT' ||
            conflict.status === 'AGREE'
        ) {
            const refClaim = conflictClaims[0] || {};

            const resolvedValue =
                refClaim.normalized_value ??
                refClaim.raw_value ??
                'N/A';

            const resolvedUnit =
                refClaim.normalized_unit ??
                refClaim.raw_unit ??
                '';

            const chosenSourceId =
                refClaim.source_id || null;

            const explanation =
                `All ${conflictClaims.length} sources represent the same normalized value ` +
                `(${resolvedValue} ${resolvedUnit}). Auto-confirmed.`;

            // IMPORTANT:
            // Explanation is now persisted in SQLite.
            const info = insertResolutionStmt.run(
                conflict.id,
                String(resolvedValue),
                String(resolvedUnit),
                1.00,
                chosenSourceId,
                'AUTO_CONFIRMED',
                explanation
            );

            resolutionsList.push({
                id: info.lastInsertRowid,
                conflict_id: conflict.id,
                attribute: conflict.attribute,
                resolved_value: resolvedValue,
                resolved_unit: resolvedUnit,
                confidence: 100.0,
                source_id_chosen: chosenSourceId,
                reviewer_status: 'AUTO_CONFIRMED',
                requires_human_review: false,
                explanation
            });

            continue;
        }

        // ========================================================
        // B. GENUINE CONFLICT ARBITRATION
        // ========================================================

        const candidateGroups = {};

        const totalSources = conflictClaims.length;

        for (const claim of conflictClaims) {
            const normalizedValue =
                claim.normalized_value ??
                claim.raw_value;

            const normalizedUnit =
                claim.normalized_unit ??
                claim.raw_unit ??
                '';

            const key =
                `${normalizedValue} ${normalizedUnit}`.trim();

            if (!candidateGroups[key]) {
                candidateGroups[key] = {
                    value: normalizedValue,
                    unit: normalizedUnit,
                    claims: [],
                    supportingSources: []
                };
            }

            candidateGroups[key].claims.push(claim);

            const source =
                sourceMap[claim.source_id];

            if (source) {
                candidateGroups[key]
                    .supportingSources
                    .push(source);
            }
        }

        // --------------------------------------------------------
        // Score candidate values
        // --------------------------------------------------------

        let topCandidate = null;
        let topScore = -1;

        for (const group of Object.values(candidateGroups)) {

            if (group.claims.length === 0) {
                continue;
            }

            let totalAuthority = 0;
            let totalRecency = 0;
            let totalConfidence = 0;

            group.claims.forEach(
                (claim, index) => {

                    const source =
                        group.supportingSources[index] || {};

                    const authorityWeight =
                        AUTHORITY_WEIGHTS[
                            source.authority_tier
                        ] || 0.50;

                    const recencyScore =
                        calculateRecencyScore(
                            source.retrieved_at
                        );

                    const extractionConfidence =
                        claim.extraction_confidence ?? 1.0;

                    totalAuthority +=
                        authorityWeight;

                    totalRecency +=
                        recencyScore;

                    totalConfidence +=
                        extractionConfidence;
                }
            );

            const avgAuthority =
                totalAuthority /
                group.claims.length;

            const avgRecency =
                totalRecency /
                group.claims.length;

            const avgConfidence =
                totalConfidence /
                group.claims.length;

            const agreementScore =
                totalSources > 0
                    ? group.claims.length /
                      totalSources
                    : 0;

            // ----------------------------------------------------
            // Weighted arbitration formula
            // ----------------------------------------------------

            const finalScore =
                (
                    (avgAuthority * 0.45) +
                    (avgRecency * 0.20) +
                    (agreementScore * 0.20) +
                    (avgConfidence * 0.15)
                ) * 100;

            group.finalScore =
                Math.round(finalScore * 10) / 10;

            group.avgAuthority =
                avgAuthority;

            group.avgRecency =
                avgRecency;

            group.avgConfidence =
                avgConfidence;

            group.agreementScore =
                agreementScore;

            if (finalScore > topScore) {
                topScore = finalScore;
                topCandidate = group;
            }
        }

        // --------------------------------------------------------
        // Safety check
        // --------------------------------------------------------

        if (!topCandidate) {
            console.warn(
                `[ARBITRATE] No valid candidate found for conflict ${conflict.id}`
            );

            continue;
        }

        // --------------------------------------------------------
        // Determine human review requirement
        // --------------------------------------------------------

        const isSafetyCritical =
            conflict.severity === 'CRITICAL' ||
            conflict.severity === 'HIGH';

        const requiresHumanReview =
            isSafetyCritical ||
            topCandidate.finalScore < 85;

        const reviewerStatus =
            'PENDING_REVIEW';

        // --------------------------------------------------------
        // Select primary source
        // --------------------------------------------------------

        const topSourceId =
            topCandidate
                .supportingSources[0]
                ?.id || null;

        // --------------------------------------------------------
        // Build explainable rationale
        // --------------------------------------------------------

        const winningSourcesDesc =
            topCandidate.supportingSources
                .map(
                    (source) =>
                        `${source.source_name} ` +
                        `(Tier ${source.authority_tier}, ` +
                        `${source.retrieved_at})`
                )
                .join(' and ');

        const competingGroups =
            Object.values(candidateGroups)
                .filter(
                    (group) =>
                        group !== topCandidate
                );

        const competingDesc =
            competingGroups
                .map((group) => {

                    const sourceString =
                        group.supportingSources
                            .map(
                                (source) =>
                                    `${source.source_name} ` +
                                    `(Tier ${source.authority_tier}, ` +
                                    `${source.retrieved_at})`
                            )
                            .join(', ');

                    return (
                        `"${group.value} ${group.unit}" ` +
                        `from ${sourceString}`
                    );
                })
                .join('; ');

        let explanation =
            `Recommended "${topCandidate.value} ` +
            `${topCandidate.unit}" ` +
            `(Arbitration Score: ` +
            `${topCandidate.finalScore}/100) ` +
            `because ${winningSourcesDesc} ` +
            `provides higher source authority and recency.`;

        if (competingDesc) {
            explanation +=
                ` Competing values: ` +
                `${competingDesc}.`;
        }

        if (isSafetyCritical) {
            explanation +=
                ` Human verification is required ` +
                `because this attribute ` +
                `(${conflict.attribute}) has ` +
                `${conflict.severity} severity rating.`;
        }

        // --------------------------------------------------------
        // Save resolution
        // --------------------------------------------------------

        const info = insertResolutionStmt.run(
            conflict.id,
            String(topCandidate.value),
            String(topCandidate.unit),
            topCandidate.finalScore / 100,
            topSourceId,
            reviewerStatus,
            explanation
        );

        // --------------------------------------------------------
        // Return API-friendly representation
        // --------------------------------------------------------

        resolutionsList.push({
            id: info.lastInsertRowid,
            conflict_id: conflict.id,
            attribute: conflict.attribute,
            resolved_value:
                topCandidate.value,
            resolved_unit:
                topCandidate.unit,

            // API/UI representation is 0-100.
            confidence:
                topCandidate.finalScore,

            source_id_chosen:
                topSourceId,

            reviewer_status:
                reviewerStatus,

            requires_human_review:
                requiresHumanReview,

            explanation
        });

        console.log(
            `[ARBITRATE] Conflict ID ${conflict.id} ` +
            `(${conflict.attribute}): ` +
            `Recommended "${topCandidate.value} ` +
            `${topCandidate.unit}" ` +
            `(Score: ${topCandidate.finalScore}%, ` +
            `Status: ${reviewerStatus})`
        );
    }

    return resolutionsList;
}

module.exports = {
    processProductArbitration,
    calculateRecencyScore,
    AUTHORITY_WEIGHTS
};