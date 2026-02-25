/**
 * SuperTrend Indicator Logic
 * Ported from the provided Python implementation.
 */

function isValid(val) {
    return typeof val === 'number' && isFinite(val) && val !== null;
}

/**
 * Compute SuperTrend Indicator.
 *
 * @param {Array} data - Array of OHLCV objects
 * @param {Object} settings - Indicator settings: { atrLength, factor }
 * @returns {Array} - Array of { time, value, trend } where trend is 1 (buy) or -1 (sell)
 */
export function computeSuperTrend(data, settings) {
    const {
        atrLength = 10,
        factor = 3
    } = settings;

    if (!data || data.length < atrLength) {
        return [];
    }

    const n = data.length;
    const atrValues = new Array(n).fill(null);
    const tr = new Array(n).fill(null);

    // 1. ATR Calculation (Simple Rolling Mean of True Range as per Python code)
    for (let i = 0; i < n; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const prevClose = i > 0 ? data[i - 1].close : data[i].close;

        if (!isValid(high) || !isValid(low) || !isValid(prevClose)) continue;

        tr[i] = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );

        if (i >= atrLength - 1) {
            let sum = 0;
            for (let j = 0; j < atrLength; j++) {
                sum += tr[i - j];
            }
            atrValues[i] = sum / atrLength;
        }
    }

    // 2. SuperTrend bands calculation
    const finalUpperBand = new Array(n).fill(0);
    const finalLowerBand = new Array(n).fill(0);
    const trend = new Array(n).fill(0);
    const supertrend = new Array(n).fill(null);

    for (let i = 0; i < n; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const close = data[i].close;
        const hl2 = (high + low) / 2;
        const atr = atrValues[i];

        if (!isValid(atr)) continue;

        const basicUpperBand = hl2 + factor * atr;
        const basicLowerBand = hl2 - factor * atr;

        if (i > 0) {
            const prevFinalUpper = finalUpperBand[i - 1];
            const prevFinalLower = finalLowerBand[i - 1];
            const prevClose = data[i - 1].close;

            // Final Upper Band
            if (basicUpperBand < prevFinalUpper || prevClose > prevFinalUpper) {
                finalUpperBand[i] = basicUpperBand;
            } else {
                finalUpperBand[i] = prevFinalUpper;
            }

            // Final Lower Band
            if (basicLowerBand > prevFinalLower || prevClose < prevFinalLower) {
                finalLowerBand[i] = basicLowerBand;
            } else {
                finalLowerBand[i] = prevFinalLower;
            }

            // Trend
            const prevTrend = trend[i - 1];
            if (close > finalUpperBand[i - 1]) {
                trend[i] = 1;
            } else if (close < finalLowerBand[i - 1]) {
                trend[i] = -1;
            } else {
                trend[i] = prevTrend || 1; // Default to 1 if no trend yet
            }
        } else {
            finalUpperBand[i] = basicUpperBand;
            finalLowerBand[i] = basicLowerBand;
            trend[i] = 1;
        }

        supertrend[i] = trend[i] === 1 ? finalLowerBand[i] : finalUpperBand[i];
    }

    // Format results for chart
    const results = [];
    for (let i = 0; i < n; i++) {
        if (supertrend[i] !== null) {
            results.push({
                time: data[i].time,
                value: supertrend[i],
                trend: trend[i]
            });
        }
    }

    return results;
}
