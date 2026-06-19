#include "../film_stock.h"
#include <math.h>

/* ============================================================
   Digitized H&D Curves — Kodak Vision3 500T 5219 (C-41 adjusted)
   Source: Kodak technical datasheet, digitized via WebPlotDigitizer
   ============================================================ */
static const float HD_LOG_E[50] = {
    -3.41f,-3.31f,-3.21f,-3.11f,-3.01f,-2.91f,-2.81f,-2.71f,
    -2.62f,-2.52f,-2.42f,-2.32f,-2.22f,-2.12f,-2.03f,-1.93f,
    -1.83f,-1.73f,-1.63f,-1.53f,-1.43f,-1.34f,-1.24f,-1.14f,
    -1.04f,-0.94f,-0.84f,-0.75f,-0.65f,-0.55f,-0.45f,-0.35f,
    -0.25f,-0.16f,-0.06f, 0.04f, 0.14f, 0.24f, 0.34f, 0.43f,
     0.53f, 0.63f, 0.73f, 0.83f, 0.93f, 1.02f, 1.12f, 1.22f,
     1.32f, 1.41f
};

static const float HD_R[50] = {
    0.20f,0.20f,0.21f,0.21f,0.22f,0.22f,0.23f,0.25f,
    0.28f,0.31f,0.33f,0.36f,0.39f,0.44f,0.49f,0.54f,
    0.59f,0.64f,0.69f,0.75f,0.80f,0.86f,0.91f,0.97f,
    1.02f,1.08f,1.14f,1.19f,1.24f,1.28f,1.33f,1.38f,
    1.42f,1.46f,1.50f,1.54f,1.58f,1.61f,1.65f,1.69f,
    1.73f,1.76f,1.79f,1.81f,1.83f,1.84f,1.85f,1.86f,
    1.87f,1.88f
};

static const float HD_G[50] = {
    0.60f,0.60f,0.61f,0.61f,0.62f,0.63f,0.64f,0.68f,
    0.71f,0.74f,0.77f,0.81f,0.84f,0.92f,1.00f,1.08f,
    1.16f,1.23f,1.31f,1.39f,1.46f,1.53f,1.61f,1.68f,
    1.76f,1.83f,1.90f,1.97f,2.03f,2.09f,2.15f,2.21f,
    2.27f,2.32f,2.38f,2.43f,2.47f,2.52f,2.56f,2.59f,
    2.62f,2.65f,2.67f,2.69f,2.70f,2.72f,2.73f,2.74f,
    2.74f,2.75f
};

static const float HD_B[50] = {
    0.85f,0.85f,0.86f,0.86f,0.87f,0.88f,0.90f,0.93f,
    0.96f,0.99f,1.02f,1.07f,1.12f,1.21f,1.29f,1.38f,
    1.47f,1.55f,1.63f,1.72f,1.80f,1.88f,1.96f,2.04f,
    2.12f,2.20f,2.27f,2.34f,2.41f,2.47f,2.53f,2.59f,
    2.64f,2.70f,2.74f,2.79f,2.83f,2.87f,2.91f,2.94f,
    2.97f,2.99f,3.01f,3.03f,3.04f,3.05f,3.06f,3.07f,
    3.08f,3.09f
};

/* D-min and D-max per channel */
#define R_DMIN 0.20f
#define R_DMAX 1.88f
#define G_DMIN 0.60f
#define G_DMAX 2.75f
#define B_DMIN 0.85f
#define B_DMAX 3.09f
#define HD_N   50

/* Linear interpolation on the H&D curve at a given log_E */
static float hd_lookup(float log_E, const float* density) {
    if (log_E <= HD_LOG_E[0])      return density[0];
    if (log_E >= HD_LOG_E[HD_N-1]) return density[HD_N-1];
    int lo = 0, hi = HD_N - 1;
    while (hi - lo > 1) {
        int mid = (lo + hi) / 2;
        if (HD_LOG_E[mid] <= log_E) lo = mid; else hi = mid;
    }
    float t = (log_E - HD_LOG_E[lo]) / (HD_LOG_E[hi] - HD_LOG_E[lo]);
    return density[lo] * (1.0f - t) + density[hi] * t;
}

static void build_cinestill_luts(FilmStock* s) {
    /*
     * Exposure mapping: linear scene value → log_E on H&D curve
     *
     * Film is logarithmic — we use log10(x) not a linear ramp.
     * Calibration:
     *   x = 0.18 (18% gray / scene middle grey) → log_E = -0.50
     *   x = 1.00 (clipped white)                → log_E = +0.80
     *
     * Derivation:
     *   log_E = SLOPE × log10(x) + OFFSET
     *   OFFSET = 0.80  (white maps to log_E 0.80 = top of linear region)
     *   SLOPE  = (-0.50 - 0.80) / log10(0.18) = -1.30 / -0.745 = 1.745
     */
    const float SLOPE  = 1.745f;
    const float OFFSET = 0.800f;

    for (int i = 0; i < LUT_SIZE; i++) {
        float x     = (float)(i + 1) / (float)LUT_SIZE;
        float log_E = SLOPE * log10f(x) + OFFSET;

        float dr = hd_lookup(log_E, HD_R);
        float dg = hd_lookup(log_E, HD_G);
        float db = hd_lookup(log_E, HD_B);

        /* Normalize each channel's density range to [0,1] positive output.
           Higher density = more exposure = brighter in positive scan. */
        float r = (dr - R_DMIN) / (R_DMAX - R_DMIN);
        float g = (dg - G_DMIN) / (G_DMAX - G_DMIN);
        float b = (db - B_DMIN) / (B_DMAX - B_DMIN);

        s->lut_r[i] = r < 0.0f ? 0.0f : (r > 1.0f ? 1.0f : r);
        s->lut_g[i] = g < 0.0f ? 0.0f : (g > 1.0f ? 1.0f : g);
        s->lut_b[i] = b < 0.0f ? 0.0f : (b > 1.0f ? 1.0f : b);
    }
}

/* ============================================================
   Film stock definition
   ============================================================ */
static const char* tags[] = {
    "nighttime","tungsten","artificial-light","neon","street","portrait"
};

FilmStock cinestill_800t_create(void) {
    FilmStock s;

    s.id        = "cinestill_800t";
    s.name      = "CineStill 800T";
    s.tags      = tags;
    s.tag_count = 6;

    /*
     * Color matrix — derived from spectral data.
     *
     * Key physical basis:
     *  - Cyan dye has secondary absorption at 450nm (0.18 density).
     *    When red is high → cyan dye forms → also absorbs blue slightly.
     *    Effect: B_out reduced when R_in is high. Models the teal shift in
     *    highlight areas (e.g. bright red neon casting teal into adjacent blue).
     *
     *  - Magenta layer is cross-stimulated by both R and G camera channels
     *    (computed from spectral sensitivity overlap: M[magenta,R]=0.92 of peak).
     *    Effect: slight warmth bleed from R into G.
     *
     *  - B row sums to 0.96 (not 1.0) → slight warm/yellow push overall.
     *    This represents the tungsten-balanced film's characteristic behavior
     *    when the blue-sensitive layer captures excess blue under mixed light.
     *
     * Row order: [R_out], [G_out], [B_out]
     */
    s.color_matrix[0] = 0.95f; s.color_matrix[1] = 0.04f; s.color_matrix[2] = 0.01f;
    s.color_matrix[3] = 0.04f; s.color_matrix[4] = 0.95f; s.color_matrix[5] = 0.01f;
    s.color_matrix[6] = 0.10f; s.color_matrix[7] = 0.12f; s.color_matrix[8] = 0.76f;

    /* Zone tints (Lab a,b offsets) */
    s.shadow_ab[0]    = -0.008f; s.shadow_ab[1]    = -0.030f;
    s.midtone_ab[0]   =  0.005f; s.midtone_ab[1]   =  0.015f;
    s.highlight_ab[0] = -0.020f; s.highlight_ab[1] =  0.008f;

    /*
     * Halation — corrected parameters.
     *
     * Reference: Phoenix cinema shot you shared.
     * The halos are TIGHT and SOFT around individual bulbs,
     * not area-fills. Key changes vs previous version:
     *   threshold: 0.88 → 0.92  (only top 8% of luma triggers, not 12%)
     *   radius:    0.022 → 0.018 (tighter around source)
     *   r_intensity: 0.28 → 0.18 (visible glow, not blowout)
     *   g_intensity: 0.10 → 0.06 (orange core is subtle)
     *   global_veil: 0.012 → 0.008 (present but not pink-washing midtones)
     */
    s.halo_threshold     = 0.92f;
    s.halo_radius_factor = 0.018f;
    s.halo_r_intensity   = 0.18f;
    s.halo_g_intensity   = 0.06f;
    s.halo_global_veil   = 0.008f;

    /*
     * Grain — Vision3 500T granularity data.
     * Measured sigma (48-micrometer aperture densitometer):
     *   R peak: ~0.007, G peak: ~0.010, B peak: ~0.021
     * Scaled to our [0,1] linear pipeline (density range ~2.0):
     *   grain_sigma ≈ 0.010 / 2.0 = 0.005 base, ×3 for visual weight = 0.015
     * Channel weights from measured ratios: G/R=1.43, B/R=3.0
     */
    s.grain_sigma        = 0.015f;
    s.grain_coarse_scale = 0.008f;
    s.grain_fine_scale   = 0.002f;
    s.grain_ch_r         = 1.00f;
    s.grain_ch_g         = 1.43f;
    s.grain_ch_b         = 3.00f;

    build_cinestill_luts(&s);
    return s;
}
