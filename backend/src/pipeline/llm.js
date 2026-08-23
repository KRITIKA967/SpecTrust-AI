const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../..', '.env') });

/**
 * LLM Provider Abstraction Module for SpecTrust AI
 * Extracts factual technical product claims from raw source text.
 */

// Mock extraction dataset for DEMO_MODE fallback
const DEMO_MOCK_CLAIMS = {
    "ST-011": {
        "ST-011-MFR": [
            { attribute: "measuring_range", raw_value: "0-10", raw_unit: "bar", extraction_confidence: 0.98 },
            { attribute: "output_signal", raw_value: "4-20", raw_unit: "mA", extraction_confidence: 0.95 },
            { attribute: "supply_voltage", raw_value: "10-30", raw_unit: "VDC", extraction_confidence: 0.95 },
            { attribute: "accuracy", raw_value: "±0.25", raw_unit: "% FS", extraction_confidence: 0.95 },
            { attribute: "response_time", raw_value: "4", raw_unit: "ms", extraction_confidence: 0.95 },
            { attribute: "process_connection", raw_value: "G1/2 male", raw_unit: "", extraction_confidence: 0.90 }
        ],
        "ST-011-PIM": [
            { attribute: "measuring_range", raw_value: "0-1", raw_unit: "MPa", extraction_confidence: 0.95 },
            { attribute: "output_signal", raw_value: "4-20", raw_unit: "mA", extraction_confidence: 0.92 },
            { attribute: "supply_voltage", raw_value: "10-30", raw_unit: "VDC", extraction_confidence: 0.92 },
            { attribute: "accuracy", raw_value: "±0.25", raw_unit: "% FS", extraction_confidence: 0.92 },
            { attribute: "response_time", raw_value: "4", raw_unit: "ms", extraction_confidence: 0.90 }
        ],
        "ST-011-WEB": [
            { attribute: "measuring_range", raw_value: "0-1000", raw_unit: "kPa", extraction_confidence: 0.90 },
            { attribute: "output_signal", raw_value: "4-20", raw_unit: "mA", extraction_confidence: 0.88 },
            { attribute: "supply_voltage", raw_value: "10-30", raw_unit: "VDC", extraction_confidence: 0.88 },
            { attribute: "accuracy", raw_value: "±0.25", raw_unit: "% FS", extraction_confidence: 0.88 },
            { attribute: "response_time", raw_value: "4", raw_unit: "ms", extraction_confidence: 0.85 }
        ]
    },
    "ST-001": {
        "ST-001-MFR": [
            { attribute: "coil_voltage", raw_value: "24", raw_unit: "VDC", extraction_confidence: 0.98 },
            { attribute: "operating_pressure", raw_value: "10", raw_unit: "bar", extraction_confidence: 0.95 },
            { attribute: "response_time", raw_value: "25", raw_unit: "ms", extraction_confidence: 0.95 },
            { attribute: "orifice_size", raw_value: "3.0", raw_unit: "mm", extraction_confidence: 0.90 },
            { attribute: "ingress_protection", raw_value: "IP65", raw_unit: "", extraction_confidence: 0.95 }
        ],
        "ST-001-PIM": [
            { attribute: "coil_voltage", raw_value: "24", raw_unit: "VDC", extraction_confidence: 0.95 },
            { attribute: "operating_pressure", raw_value: "10", raw_unit: "bar", extraction_confidence: 0.92 },
            { attribute: "response_time", raw_value: "25", raw_unit: "ms", extraction_confidence: 0.90 },
            { attribute: "orifice_size", raw_value: "3", raw_unit: "mm", extraction_confidence: 0.90 },
            { attribute: "ingress_protection", raw_value: "IP65", raw_unit: "", extraction_confidence: 0.92 }
        ],
        "ST-001-WEB": [
            { attribute: "coil_voltage", raw_value: "220", raw_unit: "VAC", extraction_confidence: 0.90 },
            { attribute: "operating_pressure", raw_value: "10", raw_unit: "bar", extraction_confidence: 0.88 },
            { attribute: "response_time", raw_value: "25", raw_unit: "ms", extraction_confidence: 0.88 },
            { attribute: "ingress_protection", raw_value: "IP65", raw_unit: "", extraction_confidence: 0.88 }
        ]
    },
    "ST-017": {
        "ST-017-MFR": [
            { attribute: "clamping_range", raw_value: "6-12", raw_unit: "mm", extraction_confidence: 0.98 },
            { attribute: "thread_size", raw_value: "M20x1.5", raw_unit: "", extraction_confidence: 0.95 },
            { attribute: "ingress_protection", raw_value: "IP68", raw_unit: "", extraction_confidence: 0.95 },
            { attribute: "temp_range", raw_value: "-40 to +100", raw_unit: "°C", extraction_confidence: 0.90 }
        ],
        "ST-017-PIM": [
            { attribute: "clamping_range", raw_value: "6-12", raw_unit: "mm", extraction_confidence: 0.95 },
            { attribute: "thread_size", raw_value: "M20x1.5", raw_unit: "", extraction_confidence: 0.92 },
            { attribute: "ingress_protection", raw_value: "IP68", raw_unit: "", extraction_confidence: 0.92 },
            { attribute: "temp_range", raw_value: "-40 to 100", raw_unit: "°C", extraction_confidence: 0.88 }
        ],
        "ST-017-WEB": [
            { attribute: "clamping_range", raw_value: "6-12", raw_unit: "mm", extraction_confidence: 0.90 },
            { attribute: "thread_size", raw_value: "M20x1.5", raw_unit: "", extraction_confidence: 0.88 },
            { attribute: "ingress_protection", raw_value: "IP68", raw_unit: "", extraction_confidence: 0.88 },
            { attribute: "temp_range", raw_value: "-40 to +100", raw_unit: "°C", extraction_confidence: 0.85 }
        ]
    }
};

/**
 * Extracts structured technical product claims from raw text.
 * Uses active LLM provider if configured, or DEMO_MODE fallback.
 * 
 * @param {string} productId - Product ID (e.g. 'ST-011')
 * @param {string} sourceId - Source ID (e.g. 'ST-011-MFR')
 * @param {string} rawText - Source raw text
 * @returns {Promise<Array<{attribute: string, raw_value: string, raw_unit: string, extraction_confidence: number}>>}
 */
async function extractClaimsFromText(productId, sourceId, rawText) {
    const isDemoMode = process.env.DEMO_MODE === 'true' || (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY);

    if (isDemoMode) {
        console.log(`[EXTRACT] Running in DEMO_MODE for product ${productId}, source ${sourceId}`);

        if (DEMO_MOCK_CLAIMS[productId] && DEMO_MOCK_CLAIMS[productId][sourceId]) {
            return DEMO_MOCK_CLAIMS[productId][sourceId];
        }

        // Generic fallback regex parser for any non-preset product in DEMO_MODE
        return extractGenericFallbackClaims(rawText);
    }

    // Live LLM Provider Execution
    try {
        if (process.env.GEMINI_API_KEY) {
            console.log(`[EXTRACT] Calling Gemini API for product ${productId}, source ${sourceId}`);
            return await extractWithGemini(rawText);
        } else if (process.env.OPENAI_API_KEY) {
            console.log(`[EXTRACT] Calling OpenAI API for product ${productId}, source ${sourceId}`);
            return await extractWithOpenAI(rawText);
        }
    } catch (err) {
        console.warn(`[EXTRACT] LLM provider error: ${err.message}. Falling back to DEMO_MODE parser.`);
        return extractGenericFallbackClaims(rawText);
    }

    return extractGenericFallbackClaims(rawText);
}

/**
 * Fallback regex extractor for generic texts
 */
function extractGenericFallbackClaims(text) {
    const claims = [];
    if (!text) return claims;

    // Pattern for pressure (bar, MPa, kPa, psi)
    const pressMatch = text.match(/(\d+(?:\.\d+)?(?:\s*[-–~to]\s*\d+(?:\.\d+)?)?)\s*(bar|MPa|kPa|psi)/i);
    if (pressMatch) {
        claims.push({
            attribute: 'operating_pressure',
            raw_value: pressMatch[1].trim(),
            raw_unit: pressMatch[2].trim(),
            extraction_confidence: 0.85
        });
    }

    // Pattern for voltage (VDC, VAC, V)
    const voltMatch = text.match(/(\d+(?:\.\d+)?(?:\s*[-–~to]\s*\d+(?:\.\d+)?)?)\s*(VDC|VAC|kV|mV|V)/i);
    if (voltMatch) {
        claims.push({
            attribute: 'supply_voltage',
            raw_value: voltMatch[1].trim(),
            raw_unit: voltMatch[2].trim(),
            extraction_confidence: 0.85
        });
    }

    // Pattern for response time (ms, s)
    const timeMatch = text.match(/(\d+(?:\.\d+)?)\s*(ms|sec|seconds|s\b)/i);
    if (timeMatch) {
        claims.push({
            attribute: 'response_time',
            raw_value: timeMatch[1].trim(),
            raw_unit: timeMatch[2].trim(),
            extraction_confidence: 0.85
        });
    }

    // Pattern for IP rating
    const ipMatch = text.match(/\b(IP\d{2}[K]?)\b/i);
    if (ipMatch) {
        claims.push({
            attribute: 'ingress_protection',
            raw_value: ipMatch[1].toUpperCase(),
            raw_unit: '',
            extraction_confidence: 0.90
        });
    }

    return claims;
}

/**
 * Gemini API extraction helper stub
 */
async function extractWithGemini(rawText) {
    // Standard fetch implementation for Google Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Extract technical specifications from the following product text. Return a JSON array of objects with keys "attribute", "raw_value", "raw_unit", "extraction_confidence". Do not convert units. Text: ${rawText}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    const data = await res.json();
    const textOut = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (textOut) {
        const jsonMatch = textOut.match(/\[\s*\{.*\}\s*\]/s);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    }
    return extractGenericFallbackClaims(rawText);
}

/**
 * OpenAI API extraction helper stub
 */
async function extractWithOpenAI(rawText) {
    return extractGenericFallbackClaims(rawText);
}

module.exports = {
    extractClaimsFromText
};
