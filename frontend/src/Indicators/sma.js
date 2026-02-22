/**
 * SMA Indicator Logic
 * Ported from the provided Python implementation
 */

export const SMA_SOURCES = [
    { label: 'Open', value: 'open' },
    { label: 'Close', value: 'close' },
    { label: 'High', value: 'high' },
    { label: 'Low', value: 'low' },
    { label: '(H+L)/2', value: 'hl2' },
    { label: '(H+L+C)/3', value: 'hlc3' },
    { label: '(O+H+L+C)/4', value: 'ohlc4' },
    { label: '(H+L+C+C)/4', value: 'hlcc4' },
    { label: 'Volume', value: 'volume' },
    { label: 'Volume MA', value: 'volume_ma' },
];

export const SMA_COLORS = [
    '#2962ff', // blue
    '#ff9800', // orange
    '#e91e63', // pink
    '#4caf50', // green
    '#9c27b0', // purple
    '#ffeb3b', // yellow
    '#00bcd4', // cyan
    '#673ab7', // deep purple
    '#8bc34a', // light green
    '#f44336', // red
];

/**
 * Helper to ensure we are working with finite numbers
 */
function isValid(val) {
    return typeof val === 'number' && isFinite(val);
}

/**
 * Computes source value for a single candle
 * @param {Object} d - Single OHLCV data point { open, high, low, close, volume, time }
 * @param {string} source - Source type
 * @param {number} index - Index in data array (for rolling calcs like vol_ma)
 * @param {Array} data - Full OHLCV array
 * @param {number} length - SMA length (for volume_ma)
 */
function getSourceValue(d, source, index, data, length) {
    if (!d) return null;

    switch (source) {
        case 'open': return isValid(d.open) ? d.open : null;
        case 'close': return isValid(d.close) ? d.close : null;
        case 'high': return isValid(d.high) ? d.high : null;
        case 'low': return isValid(d.low) ? d.low : null;
        case 'hl2': {
            if (!isValid(d.high) || !isValid(d.low)) return null;
            return (d.high + d.low) / 2;
        }
        case 'hlc3': {
            if (!isValid(d.high) || !isValid(d.low) || !isValid(d.close)) return null;
            return (d.high + d.low + d.close) / 3;
        }
        case 'ohlc4': {
            if (!isValid(d.open) || !isValid(d.high) || !isValid(d.low) || !isValid(d.close)) return null;
            return (d.open + d.high + d.low + d.close) / 4;
        }
        case 'hlcc4': {
            if (!isValid(d.high) || !isValid(d.low) || !isValid(d.close)) return null;
            return (d.high + d.low + d.close * 2) / 4;
        }
        case 'volume': return isValid(d.volume) ? d.volume : null;
        case 'volume_ma': {
            if (index < length - 1) return null;
            let sum = 0;
            let count = 0;
            for (let i = 0; i < length; i++) {
                const vol = data[index - i]?.volume;
                if (isValid(vol)) {
                    sum += vol;
                    count++;
                }
            }
            return count === length ? sum / length : null;
        }
        default: return isValid(d.close) ? d.close : null;
    }
}

/**
 * Computes SMA for a whole dataset
 */
export function computeSMA(data, length, source) {
    if (!data || data.length < length) return [];

    // Pre-extract source values and handle gaps/NaNs as null
    const sourceValues = data.map((d, i) => getSourceValue(d, source, i, data, length));
    const sma = [];

    for (let i = 0; i < data.length; i++) {
        // We need a full window of valid source values to calculate SMA
        if (i < length - 1) continue;

        let sum = 0;
        let validWindow = true;
        for (let j = 0; j < length; j++) {
            const val = sourceValues[i - j];
            if (val === null) {
                validWindow = false;
                break;
            }
            sum += val;
        }

        if (validWindow) {
            const avg = sum / length;
            // Final check: only push if we have a valid number and a valid timestamp
            if (isValid(avg) && data[i].time != null) {
                sma.push({
                    time: data[i].time,
                    value: avg
                });
            }
        }
    }

    // Double insurance: ensure times are unique and strictly increasing
    // (Lightweight-charts will crash otherwise)
    const result = [];
    let lastTime = -Infinity;

    for (const point of sma) {
        if (point.time > lastTime) {
            result.push(point);
            lastTime = point.time;
        }
    }

    return result;
}
