/**
 * Stochastic Oscillator Indicator
 * Ported from the provided Python implementation.
 *
 * Calculation:
 *   %K = 100 * (Close - lowestLow) / (highestHigh - lowestLow)
 *   %D = SMA of %K
 */

function isValid(val) {
    return typeof val === 'number' && isFinite(val) && val !== null;
}

/**
 * Compute Stochastic Oscillator.
 *
 * @param {Array} data - Array of OHLCV objects
 * @param {Object} settings - Indicator settings: { length, dLength, precision }
 * @returns {{ k: [], d: [] }}
 */
export function computeStochastic(data, settings) {
    const {
        length = 14,
        dLength = 3,
        precision = 2
    } = settings;

    if (!data || data.length < length) {
        return { k: [], d: [] };
    }

    const kValuesRaw = [];

    // 1. Calculate %K
    for (let i = 0; i < data.length; i++) {
        if (i < length - 1) {
            kValuesRaw.push({ time: data[i].time, value: null });
            continue;
        }

        let lowestLow = Infinity;
        let highestHigh = -Infinity;
        let validWindow = true;

        for (let j = 0; j < length; j++) {
            const bar = data[i - j];
            if (!isValid(bar.low) || !isValid(bar.high)) {
                validWindow = false;
                break;
            }
            if (bar.low < lowestLow) lowestLow = bar.low;
            if (bar.high > highestHigh) highestHigh = bar.high;
        }

        if (!validWindow || !isValid(data[i].close)) {
            kValuesRaw.push({ time: data[i].time, value: null });
            continue;
        }

        const diff = highestHigh - lowestLow;
        let k = 0;
        if (diff !== 0) {
            k = 100 * (data[i].close - lowestLow) / diff;
        } else {
            // If price is flat, typical behavior is to stay at previous or 50
            k = 50;
        }
        kValuesRaw.push({ time: data[i].time, value: k });
    }

    // 2. Calculate %D (SMA of %K)
    const dValuesRaw = [];
    for (let i = 0; i < kValuesRaw.length; i++) {
        const startIdx = i - dLength + 1;
        if (startIdx < 0) {
            dValuesRaw.push({ time: kValuesRaw[i].time, value: null });
            continue;
        }

        let sum = 0;
        let count = 0;
        let validSMA = true;

        for (let j = 0; j < dLength; j++) {
            const val = kValuesRaw[i - j].value;
            if (val === null) {
                validSMA = false;
                break;
            }
            sum += val;
            count++;
        }

        dValuesRaw.push({
            time: kValuesRaw[i].time,
            value: (validSMA && count === dLength) ? sum / dLength : null
        });
    }

    const filterNulls = (arr) => arr
        .filter(v => v.value !== null)
        .map(v => ({ ...v, value: Number(v.value.toFixed(precision)) }));

    return {
        k: filterNulls(kValuesRaw),
        d: filterNulls(dValuesRaw)
    };
}
