/**
 * Volume Profile (Price-by-Volume) Logic
 * Ported from the provided Python implementation
 * Range: Entire visible/selected period
 */

function isValid(val) {
    return typeof val === 'number' && isFinite(val);
}

/**
 * Computes Volume Profile bins
 * @param {Array} data - OHLCV data
 * @param {Object} options - { priceBins, color }
 */
export function computeVolumeProfile(data, options) {
    const { priceBins = 40 } = options;
    if (!data || data.length === 0) return [];

    // 1. Calculate Typical Price: (H + L + C) / 3
    const typicalPrices = data.map(d => (d.high + d.low + d.close) / 3);

    // 2. Determine Price Range
    let priceMin = Infinity;
    let priceMax = -Infinity;

    for (const p of typicalPrices) {
        if (p < priceMin) priceMin = p;
        if (p > priceMax) priceMax = p;
    }

    if (priceMin === priceMax) return []; // Vertical line, no range

    // 3. Create Bins
    const binSize = (priceMax - priceMin) / priceBins;
    const bins = Array.from({ length: priceBins }, (_, i) => ({
        low: priceMin + i * binSize,
        high: priceMin + (i + 1) * binSize,
        volume: 0
    }));

    // 4. Sum Volume per Bin
    for (let i = 0; i < data.length; i++) {
        const p = typicalPrices[i];
        const v = data[i].volume || 0;

        // Find which bin this typical price falls into
        let binIndex = Math.floor((p - priceMin) / binSize);
        if (binIndex >= priceBins) binIndex = priceBins - 1;
        if (binIndex < 0) binIndex = 0;

        bins[binIndex].volume += v;
    }

    // 5. Normalize Volume (0 to 1)
    let maxVolume = 0;
    for (const b of bins) {
        if (b.volume > maxVolume) maxVolume = b.volume;
    }

    if (maxVolume === 0) return [];

    return bins.map(b => ({
        ...b,
        normalizedVolume: b.volume / maxVolume,
        center: (b.low + b.high) / 2
    }));
}
