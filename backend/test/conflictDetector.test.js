const { compareNormalizedClaims, getCanonicalAttribute, determineSeverity } = require('../src/pipeline/conflictDetector');
const { normalizeClaim } = require('../src/pipeline/normalizer');

function runConflictDetectorTests() {
    console.log('🧪 Running Conflict Detector Unit Test Suite...\n');
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

    // Test 1: 10 bar vs 1 MPa -> EQUIVALENT
    const claim10Bar = { normalized_value: '10', normalized_unit: 'bar' };
    const claim1MPa = normalizeClaim('pressure', '1', 'MPa'); // 10 bar
    const res1 = compareNormalizedClaims(claim10Bar, { normalized_value: String(claim1MPa.normalized_value), normalized_unit: claim1MPa.normalized_unit });
    assertTest('10 bar vs 1 MPa (Normalized) ➔ EQUIVALENT', res1.isEquivalent === true);

    // Test 2: 15 ms vs 25 ms -> GENUINE CONFLICT
    const claim15ms = { normalized_value: '15', normalized_unit: 'ms' };
    const claim25ms = { normalized_value: '25', normalized_unit: 'ms' };
    const res2 = compareNormalizedClaims(claim15ms, claim25ms);
    assertTest('15 ms vs 25 ms ➔ GENUINE CONFLICT', res2.isEquivalent === false);

    // Test 3: 1 inch vs 25.4 mm -> EQUIVALENT
    const claim1Inch = normalizeClaim('dimension', '1', 'inch'); // 25.4 mm
    const claim254mm = { normalized_value: '25.4', normalized_unit: 'mm' };
    const res3 = compareNormalizedClaims({ normalized_value: String(claim1Inch.normalized_value), normalized_unit: claim1Inch.normalized_unit }, claim254mm);
    assertTest('1 inch vs 25.4 mm (Normalized) ➔ EQUIVALENT', res3.isEquivalent === true);

    // Test 4: M12 vs M8 -> GENUINE CONFLICT
    const claimM12 = { normalized_value: 'M12', normalized_unit: '' };
    const claimM8 = { normalized_value: 'M8', normalized_unit: '' };
    const res4 = compareNormalizedClaims(claimM12, claim8 = claimM8);
    assertTest('M12 vs M8 connector ➔ GENUINE CONFLICT', res4.isEquivalent === false);

    // Test 5: Severity Classification for Voltage Conflict
    const sevVoltage = determineSeverity('SAFETY_CRITICAL', true);
    assertTest('Voltage mismatch ➔ Severity CRITICAL', sevVoltage === 'CRITICAL');

    // Test 6: Severity Classification for Connector Conflict
    const sevConnector = determineSeverity('COMPATIBILITY_RISK', true);
    assertTest('Connector mismatch ➔ Severity HIGH', sevConnector === 'HIGH');

    // Test 7: Canonical Attribute Mapping
    assertTest('Canonical mapping "rated voltage" ➔ voltage', getCanonicalAttribute('rated voltage') === 'voltage');
    assertTest('Canonical mapping "pressure range" ➔ measuring_range', getCanonicalAttribute('pressure range') === 'measuring_range');

    console.log(`\n📊 Conflict Detector Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests.`);
    if (failed > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    runConflictDetectorTests();
}

module.exports = { runConflictDetectorTests };
