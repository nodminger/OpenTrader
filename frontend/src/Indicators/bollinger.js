/**
 * Bollinger Bands Indicator Logic
 * Ported from the provided Python implementation
 */

function isValid(val) {
    return typeof val === 'number' && isFinite(val);
}

function getSourceValue(d, source) {
    if (!d) return null;
    switch (source.toLowerCase()) {
        case 'open': return isValid(d.open) ? d.open : null;
        case 'high': return isValid(d.high) ? d.high : null;
        case 'low': return isValid(d.low) ? d.low : null;
        case 'close': return isValid(d.close) ? d.close : null;
        case 'hl2': return (isValid(d.high) && isValid(d.low)) ? (d.high + d.low) / 2 : null;
        case 'hlc3': return (isValid(d.high) && isValid(d.low) && isValid(d.close)) ? (d.high + d.low + d.close) / 3 : null;
        case 'ohlc4': return (isValid(d.open) && isValid(d.high) && isValid(d.low) && isValid(d.close)) ? (d.open + d.high + d.low + d.close) / 4 : null;
        case 'hlcc4': return (isValid(d.high) && isValid(d.low) && isValid(d.close)) ? (d.high + d.low + d.close * 2) / 4 : null;
        default: return isValid(d.close) ? d.close : null;
    }
}

export function computeBollingerBands(data, settings) {
    const { length, stdDev, source, offset = 0, precision = 2 } = settings;
    if (!data || data.length < length) return { basis: [], upper: [], lower: [] };

    const sourceValues = data.map(d => getSourceValue(d, source));
    const results = { basis: [], upper: [], lower: [] };

    for (let i = 0; i < data.length; i++) {
        if (i < length - 1) continue;

        let sum = 0;
        let validCount = 0;
        const window = [];

        for (let j = 0; j < length; j++) {
            const val = sourceValues[i - j];
            if (val !== null) {
                sum += val;
                window.push(val);
                validCount++;
            }
        }

        if (validCount === length) {
            const mean = sum / length;
            const variance = window.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / length;
            const std = Math.sqrt(variance);

            const basisVal = mean;
            const upperVal = mean + stdDev * std;
            const lowerVal = mean - stdDev * std;

            const targetIndex = i + offset;
            if (targetIndex >= 0 && targetIndex < data.length) {
                const time = data[targetIndex].time;
                results.basis.push({ time, value: Number(basisVal.toFixed(precision)) });
                results.upper.push({ time, value: Number(upperVal.toFixed(precision)) });
                results.lower.push({ time, value: Number(lowerVal.toFixed(precision)) });
            }
        }
    }

    return results;
}
