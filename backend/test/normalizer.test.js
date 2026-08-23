const { normalizeClaim } = require('../src/pipeline/normalizer');

const testCases = [
    { attribute: 'pressure', value: '10', unit: 'bar', expectedVal: 10, expectedUnit: 'bar' },
    { attribute: 'pressure', value: '1', unit: 'MPa', expectedVal: 10, expectedUnit: 'bar' },
    { attribute: 'pressure', value: '1000', unit: 'kPa', expectedVal: 10, expectedUnit: 'bar' },
    { attribute: 'response_time', value: '15', unit: 'ms', expectedVal: 15, expectedUnit: 'ms' },
    { attribute: 'response_time', value: '0.015', unit: 's', expectedVal: 15, expectedUnit: 'ms' },
    { attribute: 'dimension', value: '25.4', unit: 'mm', expectedVal: 25.4, expectedUnit: 'mm' },
    { attribute: 'dimension', value: '1', unit: 'inch', expectedVal: 25.4, expectedUnit: 'mm' },
    { attribute: 'voltage', value: '500', unit: 'V', expectedVal: 500, expectedUnit: 'V' },
    { attribute: 'voltage', value: '0.5', unit: 'kV', expectedVal: 500, expectedUnit: 'V' },
    { attribute: 'voltage', value: '500,000', unit: 'mV', expectedVal: 500, expectedUnit: 'V' },
    // Range tests
    { attribute: 'measuring_range', value: '0-10', unit: 'bar', expectedVal: '0-10', expectedUnit: 'bar' },
    { attribute: 'measuring_range', value: '0-1', unit: 'MPa', expectedVal: '0-10', expectedUnit: 'bar' },
    { attribute: 'measuring_range', value: '0-1000', unit: 'kPa', expectedVal: '0-10', expectedUnit: 'bar' }
];

function runTests() {
    console.log('🧪 Running Deterministic Normalizer Test Suite...\n');
    let passed = 0;
    let failed = 0;

    testCases.forEach((tc, idx) => {
        const result = normalizeClaim(tc.attribute, tc.value, tc.unit);
        const valMatch = result.normalized_value === tc.expectedVal;
        const unitMatch = result.normalized_unit === tc.expectedUnit;

        if (valMatch && unitMatch) {
            console.log(`  ✅ Test ${idx + 1}: ${tc.value} ${tc.unit} ➔ ${result.normalized_value} ${result.normalized_unit} (PASSED)`);
            passed++;
        } else {
            console.error(`  ❌ Test ${idx + 1}: ${tc.value} ${tc.unit} ➔ Got: ${result.normalized_value} ${result.normalized_unit}, Expected: ${tc.expectedVal} ${tc.expectedUnit} (FAILED)`);
            failed++;
        }
    });

    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests.`);
    if (failed > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    runTests();
}

module.exports = { runTests };
