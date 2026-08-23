const {
    calculateAttributeTrustScore,
    calculateProductTrustScore
} = require('../src/pipeline/trustScore');

console.log('🧪 Running Trust Score Test Suite...\n');

let passed = 0;
let failed = 0;

function test(name, condition) {
    if (condition) {
        console.log(`  ✅ ${name} (PASSED)`);
        passed++;
    } else {
        console.log(`  ❌ ${name} (FAILED)`);
        failed++;
    }
}

// ---------------------------------------------------------
// Test 1: Clean attribute
// ---------------------------------------------------------

const clean = calculateAttributeTrustScore({
    claims: [
        { extraction_confidence: 1.0 },
        { extraction_confidence: 1.0 },
        { extraction_confidence: 1.0 }
    ],
    conflicts: []
});

test(
    'Clean attribute = 100 trust',
    clean.score === 100
);

// ---------------------------------------------------------
// Test 2: Genuine safety-critical conflict
// ---------------------------------------------------------

const safetyConflict = calculateAttributeTrustScore({
    claims: [
        { extraction_confidence: 1.0 },
        { extraction_confidence: 1.0 },
        { extraction_confidence: 1.0 }
    ],
    conflicts: [
        {
            status: 'GENUINE_CONFLICT',
            severity: 'CRITICAL'
        }
    ]
});

test(
    'Safety-critical conflict = 45 trust',
    safetyConflict.score === 45
);

// 100 - 30 - 25 = 45

// ---------------------------------------------------------
// Test 3: Compatibility conflict
// ---------------------------------------------------------

const compatibilityConflict = calculateAttributeTrustScore({
    claims: [
        { extraction_confidence: 1.0 },
        { extraction_confidence: 1.0 }
    ],
    conflicts: [
        {
            status: 'GENUINE_CONFLICT',
            severity: 'HIGH'
        }
    ]
});

test(
    'Compatibility-risk conflict = 58 trust',
    compatibilityConflict.score === 58
);

// 100 - 30 - 12 = 58

// ---------------------------------------------------------
// Test 4: Stale conflict
// ---------------------------------------------------------

const staleConflict = calculateAttributeTrustScore({
    claims: [
        { extraction_confidence: 1.0 },
        { extraction_confidence: 1.0 }
    ],
    conflicts: [
        {
            status: 'STALE_SUPERSEDED',
            severity: 'HIGH'
        }
    ]
});

test(
    'Stale conflict = 85 trust',
    staleConflict.score === 85
);

// 100 - 15 = 85

// ---------------------------------------------------------
// Test 5: Extraction confidence penalty
// ---------------------------------------------------------

const lowConfidence = calculateAttributeTrustScore({
    claims: [
        { extraction_confidence: 0.8 },
        { extraction_confidence: 0.8 }
    ],
    conflicts: []
});

test(
    'Extraction confidence 0.8 = 98 trust',
    lowConfidence.score === 98
);

// 100 - (10 × 0.2) = 98

// ---------------------------------------------------------
// Test 6: Score clamping
// ---------------------------------------------------------

const extreme = calculateAttributeTrustScore({
    claims: [
        { extraction_confidence: 0.0 }
    ],
    conflicts: [
        {
            status: 'GENUINE_CONFLICT',
            severity: 'CRITICAL'
        },
        {
            status: 'STALE_SUPERSEDED',
            severity: 'CRITICAL'
        }
    ]
});

test(
    'Trust score is clamped to 0-100',
    extreme.score >= 0 && extreme.score <= 100
);

// ---------------------------------------------------------
// Test 7: Product weighted average
// ---------------------------------------------------------

const productScore = calculateProductTrustScore([
    {
        score: 45,
        severity: 'safety_critical'
    },
    {
        score: 100,
        severity: null
    }
]);

// Safety-critical gets 2x weight:
// (45×2 + 100×1) / 3 = 63.333...

test(
    'Safety-critical attributes receive 2x weight',
    productScore === 63.3
);

// ---------------------------------------------------------

console.log(
    `\n📊 Trust Score Test Results: ${passed} passed, ${failed} failed`
);

process.exit(failed > 0 ? 1 : 0);