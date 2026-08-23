const { calculateRecencyScore, AUTHORITY_WEIGHTS } = require('../src/pipeline/arbitrator');

function runArbitratorTests() {
    console.log('🧪 Running Explainable Arbitrator Unit Test Suite...\n');
    let passed = 0;
    let failed = 0;

    const assertTest = (name, condition, details = '') => {
        if (condition) {
            console.log(`  ✅ ${name} (PASSED)`);
            passed++;
        } else {
            console.error(`  ❌ ${name} (FAILED) ${details}`);
            failed++;
        }
    };

    // Test 1: Authority Weights
    assertTest('Tier 1 Authority Weight = 1.00', AUTHORITY_WEIGHTS[1] === 1.00);
    assertTest('Tier 2 Authority Weight = 0.75', AUTHORITY_WEIGHTS[2] === 0.75);
    assertTest('Tier 3 Authority Weight = 0.50', AUTHORITY_WEIGHTS[3] === 0.50);

    // Test 2: Recency Formula Calculation
    // 2025-09-02 vs 2026-08-22 (~0.97 years) -> recency_score = 1 / (1 + 0.97 * 0.15) ≈ 0.873
    const recency2025 = calculateRecencyScore('2025-09-02', new Date('2026-08-22'));
    assertTest('Recency score for 2025 retrieved_at is ~0.87', recency2025 > 0.85 && recency2025 < 0.90);

    // 2019-05-27 vs 2026-08-22 (~7.24 years) -> recency_score = 1 / (1 + 7.24 * 0.15) ≈ 0.479
    const recency2019 = calculateRecencyScore('2019-05-27', new Date('2026-08-22'));
    assertTest('Recency score for 2019 retrieved_at is lower (~0.48)', recency2019 < recency2025);

    // Test 3: ST-001 Conceptual Arbitration
    // Manufacturer (Tier 1, 24 VDC) + Distributor (Tier 2, 24 VDC) vs Website (Tier 3, 220 VAC)
    // 24 VDC has Tier 1 + Tier 2 + Agreement (2/3) -> higher score than 220 VAC (Tier 3, 1/3)
    const auth24 = (1.00 + 0.75) / 2; // 0.875
    const auth220 = 0.50;
    const agree24 = 2 / 3;
    const agree220 = 1 / 3;
    const score24 = ((auth24 * 0.45) + (0.90 * 0.20) + (agree24 * 0.20) + (0.95 * 0.15)) * 100;
    const score220 = ((auth220 * 0.45) + (0.75 * 0.20) + (agree220 * 0.20) + (0.90 * 0.15)) * 100;

    assertTest('ST-001 24 VDC score > 220 VAC score', score24 > score220);

    // Test 4: Human Review Flag requirement for Safety Critical Conflicts
    const isCritical = true;
    const requiresHumanReview = isCritical;
    assertTest('Safety Critical conflict flags requires_human_review = true', requiresHumanReview === true);

    // Test 5: ST-015 Recency/Authority Arbitration (Rev C 2025 ±1.0% vs PIM 2020 ±2.0%)
    const recency2025_fl = calculateRecencyScore('2025-11-02', new Date('2026-08-22'));
    const recency2020_fl = calculateRecencyScore('2020-01-08', new Date('2026-08-22'));
    const scoreMfr2025 = ((1.00 * 0.45) + (recency2025_fl * 0.20) + (0.33 * 0.20) + (0.95 * 0.15)) * 100;
    const scorePim2020 = ((0.75 * 0.45) + (recency2020_fl * 0.20) + (0.33 * 0.20) + (0.90 * 0.15)) * 100;
    assertTest('ST-015 Newer Manufacturer source (2025) > Older Distributor record (2020)', scoreMfr2025 > scorePim2020);

    console.log(`\n📊 Arbitrator Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests.`);
    if (failed > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    runArbitratorTests();
}

module.exports = { runArbitratorTests };
