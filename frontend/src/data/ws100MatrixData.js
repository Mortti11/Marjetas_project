/**
 * WS100 Network Comparison Matrix Data
 * 
 * Static data for the sensor network summary matrices.
 * Contains per-location statistics and differences vs network mean and baseline station.
 */

/**
 * @typedef {Object} StationMatrixRow
 * @property {string} station - Station name
 * @property {number} totalMm - Total precipitation (mm)
 * @property {number} p99MmH - 99th percentile intensity (mm/h)
 * @property {number} maxEventTotalMm - Max event total precipitation (mm)
 * @property {number} maxPeakMmH - Max peak intensity (mm/h)
 * @property {number} medianEventDurH - Median event duration (hours)
 * @property {number} rainPct - Rain percentage (%)
 * @property {number} snowPct - Snow percentage (%)
 * @property {number} mixedPct - Mixed precipitation percentage (%)
 */

/**
 * Per-location summary: Absolute values for each station
 */
export const perLocationSummary = [
    {
        station: 'Saaritie',
        totalMm: 1952.2,
        p99MmH: 0.9,
        maxEventTotalMm: 45.2,
        maxPeakMmH: 58.9,
        medianEventDurH: 0.2,
        rainPct: 66.0,
        snowPct: 15.9,
        mixedPct: 15.2
    },
    {
        station: 'Tuulimyllyntie',
        totalMm: 2499.1,
        p99MmH: 1.0,
        maxEventTotalMm: 101.2,
        maxPeakMmH: 96.6,
        medianEventDurH: 0.2,
        rainPct: 64.3,
        snowPct: 16.9,
        mixedPct: 16.2
    },
    {
        station: 'Tähtiniementie',
        totalMm: 2285.2,
        p99MmH: 1.0,
        maxEventTotalMm: 41.4,
        maxPeakMmH: 82.7,
        medianEventDurH: 0.2,
        rainPct: 63.1,
        snowPct: 18.7,
        mixedPct: 15.6
    },
    {
        station: 'Kaakkovuorentie',
        totalMm: 828.6,
        p99MmH: 1.0,
        maxEventTotalMm: 40.4,
        maxPeakMmH: 111.3,
        medianEventDurH: 0.2,
        rainPct: 75.8,
        snowPct: 7.4,
        mixedPct: 14.3
    },
    {
        station: 'Kotaniementie',
        totalMm: 2340.7,
        p99MmH: 0.9,
        maxEventTotalMm: 55.9,
        maxPeakMmH: 184.2,
        medianEventDurH: 0.2,
        rainPct: 65.9,
        snowPct: 19.6,
        mixedPct: 11.9
    }
];

/**
 * Difference vs network mean
 * Positive = above average, Negative = below average
 */
export const diffVsNetworkMean = [
    {
        station: 'Tuulimyllyntie',
        totalMm: 517.9,
        p99MmH: 0.0,
        maxEventTotalMm: 44.4,
        maxPeakMmH: -10.1,
        medianEventDurH: 0.0,
        rainPct: -2.7,
        snowPct: 1.2,
        mixedPct: 1.6
    },
    {
        station: 'Kotaniementie',
        totalMm: 359.5,
        p99MmH: -0.1,
        maxEventTotalMm: -0.9,
        maxPeakMmH: 77.5,
        medianEventDurH: 0.0,
        rainPct: -1.1,
        snowPct: 3.9,
        mixedPct: -2.7
    },
    {
        station: 'Tähtiniementie',
        totalMm: 304.0,
        p99MmH: 0.0,
        maxEventTotalMm: -15.4,
        maxPeakMmH: -24.0,
        medianEventDurH: 0.0,
        rainPct: -3.9,
        snowPct: 3.0,
        mixedPct: 1.0
    },
    {
        station: 'Saaritie',
        totalMm: -29.0,
        p99MmH: -0.1,
        maxEventTotalMm: -11.6,
        maxPeakMmH: -47.8,
        medianEventDurH: 0.0,
        rainPct: -1.0,
        snowPct: 0.2,
        mixedPct: 0.6
    },
    {
        station: 'Kaakkovuorentie',
        totalMm: -1152.6,
        p99MmH: 0.0,
        maxEventTotalMm: -16.4,
        maxPeakMmH: 4.6,
        medianEventDurH: 0.0,
        rainPct: 8.8,
        snowPct: -8.3,
        mixedPct: -0.3
    }
];

/**
 * Difference vs Kotaniementie (baseline station)
 * Positive = higher than Kotaniementie, Negative = lower
 */
export const diffVsKotaniementie = [
    {
        station: 'Tuulimyllyntie',
        totalMm: 158.4,
        p99MmH: 0.1,
        maxEventTotalMm: 45.3,
        maxPeakMmH: -87.6,
        medianEventDurH: 0.0,
        rainPct: -1.6,
        snowPct: -2.7,
        mixedPct: 4.3
    },
    {
        station: 'Tähtiniementie',
        totalMm: -55.5,
        p99MmH: 0.1,
        maxEventTotalMm: -14.5,
        maxPeakMmH: -101.5,
        medianEventDurH: 0.0,
        rainPct: -2.8,
        snowPct: -0.9,
        mixedPct: 3.7
    },
    {
        station: 'Saaritie',
        totalMm: -388.5,
        p99MmH: 0.0,
        maxEventTotalMm: -10.7,
        maxPeakMmH: -125.3,
        medianEventDurH: 0.0,
        rainPct: 0.1,
        snowPct: -3.7,
        mixedPct: 3.3
    },
    {
        station: 'Kaakkovuorentie',
        totalMm: -1512.1,
        p99MmH: 0.1,
        maxEventTotalMm: -15.5,
        maxPeakMmH: -72.9,
        medianEventDurH: 0.0,
        rainPct: 9.9,
        snowPct: -12.2,
        mixedPct: 2.4
    }
];
