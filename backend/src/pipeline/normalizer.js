/**
 * SpecTrust AI - Deterministic Unit Normalizer Module
 * Converts raw unit values into standardized technical units deterministically.
 */

// Unit conversion definitions
const CONVERSIONS = {
    // Pressure -> bar
    pressure: {
        targetUnit: 'bar',
        units: {
            'bar': 1,
            'mpa': 10,
            'kpa': 0.01,
            'psi': 0.0689475729
        }
    },
    // Voltage -> V (preserves VDC / VAC tags in unit or value if specified)
    voltage: {
        targetUnit: 'V',
        units: {
            'v': 1,
            'vdc': 1,
            'vac': 1,
            'v dc': 1,
            'v ac': 1,
            'kv': 1000,
            'kvdc': 1000,
            'kvac': 1000,
            'mv': 0.001,
            'mvdc': 0.001,
            'mvac': 0.001
        }
    },
    // Time -> ms
    time: {
        targetUnit: 'ms',
        units: {
            'ms': 1,
            's': 1000,
            'sec': 1000,
            'seconds': 1000
        }
    },
    // Length / Dimensions -> mm
    length: {
        targetUnit: 'mm',
        units: {
            'mm': 1,
            'cm': 10,
            'm': 1000,
            'inch': 25.4,
            'in': 25.4,
            'inches': 25.4,
            '"': 25.4
        }
    },
    // Power -> W
    power: {
        targetUnit: 'W',
        units: {
            'w': 1,
            'kw': 1000
        }
    },
    // Current -> A
    current: {
        targetUnit: 'A',
        units: {
            'a': 1,
            'ma': 0.001
        }
    },
    // Temperature -> °C
    temperature: {
        targetUnit: '°C',
        units: {
            '°c': 1,
            'c': 1,
            'deg c': 1,
            '°f': null // placeholder if °F conversion needed
        }
    }
};

/**
 * Normalizes raw numeric or range values and unit strings deterministically.
 * 
 * @param {string} attribute - Technical attribute name (e.g. 'pressure', 'voltage', 'response_time')
 * @param {string|number} rawValue - Raw attribute value (e.g. '10', '0-16', '1', '500,000')
 * @param {string} rawUnit - Raw unit string (e.g. 'MPa', 'bar', 's', 'mV', 'inch', 'VDC', 'VAC')
 * @returns {{ normalized_value: string|number, normalized_unit: string, is_normalized: boolean }}
 */
function normalizeClaim(attribute, rawValue, rawUnit) {
    if (rawValue === null || rawValue === undefined) {
        return { normalized_value: null, normalized_unit: rawUnit || null, is_normalized: false };
    }

    const valStr = String(rawValue).trim();
    const unitStr = String(rawUnit || '').trim().toLowerCase();
    const attrKey = String(attribute || '').trim().toLowerCase();

    // Preserve voltage types (VDC vs VAC) in normalized_unit if specified
    let typeSuffix = '';
    if (unitStr.includes('vdc') || valStr.toLowerCase().includes('vdc')) {
        typeSuffix = ' VDC';
    } else if (unitStr.includes('vac') || valStr.toLowerCase().includes('vac')) {
        typeSuffix = ' VAC';
    }

    // Determine category based on raw unit or attribute name.
    // Do not treat every attribute containing "range" as pressure (e.g. clamping_range, temp_range).
    const isPressureAttribute =
        attrKey.includes('clamping') ||
        attrKey === 'measuring_range' ||
        attrKey === 'pressure_range' ||
        attrKey.includes('measuring_range');

    let category = null;
    if (unitStr in CONVERSIONS.pressure.units || isPressureAttribute) {
        category = 'pressure';
    } else if (unitStr in CONVERSIONS.voltage.units || attrKey.includes('voltage') || attrKey.includes('coil')) {
        category = 'voltage';
    } else if (unitStr in CONVERSIONS.time.units || attrKey.includes('time') || attrKey.includes('response')) {
        category = 'time';
    } else if (
        unitStr in CONVERSIONS.length.units ||
        attrKey.includes('length') ||
        attrKey.includes('bore') ||
        attrKey.includes('dimension') ||
        attrKey.includes('distance') ||
        attrKey.includes('clamping')
    ) {
        category = 'length';
    } else if (unitStr in CONVERSIONS.power.units || attrKey.includes('power')) {
        category = 'power';
    } else if (unitStr in CONVERSIONS.current.units || attrKey.includes('current')) {
        category = 'current';
    } else if (unitStr in CONVERSIONS.temperature.units || attrKey.includes('temp')) {
        category = 'temperature';
    }

    if (!category || !CONVERSIONS[category]) {
        // Fallback: Return raw values if unit unrecognized
        return {
            normalized_value: valStr,
            normalized_unit: rawUnit || null,
            is_normalized: false
        };
    }

    const config = CONVERSIONS[category];
    const cleanUnit = unitStr.replace(/\s+/g, '');
    const conversionFactor = config.units[cleanUnit] || config.units[unitStr] || 1;

    let targetUnit = config.targetUnit;
    if (category === 'voltage' && typeSuffix) {
        targetUnit = typeSuffix.trim(); // e.g. 'VDC' or 'VAC'
    }

    // Helper to convert single clean numeric string
    const convertNum = (numStr) => {
        const cleaned = numStr.replace(/,/g, '').replace(/[^\d.-]/g, '');
        const parsed = parseFloat(cleaned);
        if (isNaN(parsed)) return numStr;
        
        let converted = parsed * conversionFactor;
        // Round cleanly to avoid floating point precision artifacts (e.g. 25.400000000000002 -> 25.4)
        converted = Math.round(converted * 100000) / 100000;
        return converted;
    };

    // Check for range patterns (e.g., "0-16", "0–1", "10-30", "0-1000")
    const rangeMatch = valStr.match(
    /^([+-]?\d+(?:\.\d+)?)\s*(?:[-–~]|to)\s*([+-]?\d+(?:\.\d+)?)$/i
);

    if (rangeMatch) {
        const minVal = convertNum(rangeMatch[1]);
        const maxVal = convertNum(rangeMatch[2]);
        return {
            normalized_value: `${minVal}-${maxVal}`,
            normalized_min: minVal,
            normalized_max: maxVal,
            normalized_unit: targetUnit,
            is_normalized: true
        };
    }

    const singleConverted = convertNum(valStr);
    return {
        normalized_value: singleConverted,
        normalized_unit: targetUnit,
        is_normalized: true
    };
}

module.exports = {
    normalizeClaim,
    CONVERSIONS
};
