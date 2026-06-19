#include "grain.h"
#include <stdlib.h>
#include <math.h>
#include <time.h>

/* Fast hash-based noise — no global state, no malloc */
static float hash_noise(int x, int y, int seed) {
    unsigned int n = (unsigned int)(x * 1619 + y * 31337 + seed * 6971);
    n = (n << 13) ^ n;
    n = n * (n * n * 15731 + 789221) + 1376312589;
    return (float)(n & 0x7fffffff) / (float)0x7fffffff;  /* [0, 1] */
}

/* Bilinear interpolated noise for smooth grain clumps */
static float smooth_noise(float fx, float fy, int seed) {
    int ix = (int)fx;
    int iy = (int)fy;
    float tx = fx - (float)ix;
    float ty = fy - (float)iy;

    /* Smoothstep interpolation */
    tx = tx * tx * (3.0f - 2.0f * tx);
    ty = ty * ty * (3.0f - 2.0f * ty);

    float n00 = hash_noise(ix,   iy,   seed);
    float n10 = hash_noise(ix+1, iy,   seed);
    float n01 = hash_noise(ix,   iy+1, seed);
    float n11 = hash_noise(ix+1, iy+1, seed);

    return n00*(1-tx)*(1-ty) + n10*tx*(1-ty) +
           n01*(1-tx)*ty     + n11*tx*ty;
}

void apply_grain(float* r, float* g, float* b,
                 int w, int h, const FilmStock* stock) {
    /* Random seed per-render so grain is different each time */
    int seed_r = (int)(time(NULL)) & 0xffff;
    int seed_g = seed_r ^ 0x4A3F;
    int seed_b = seed_r ^ 0x9C1E;

    float coarse_inv = 1.0f / (stock->grain_coarse_scale * (float)w);
    float fine_inv   = 1.0f / (stock->grain_fine_scale   * (float)w);
    float sigma      = stock->grain_sigma;

    for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
            int i = y * w + x;

            /* Compute luminance for grain weighting
               Grain peaks in midtones, falls off in shadows and highlights */
            float luma = 0.2126f*r[i] + 0.7152f*g[i] + 0.0722f*b[i];
            float weight = 4.0f * luma * (1.0f - luma);  /* parabola, max at 0.5 */

            /* Two-octave grain: coarse clumps + fine crystal texture */
            float cx = (float)x * coarse_inv;
            float cy = (float)y * coarse_inv;
            float fx = (float)x * fine_inv;
            float fy = (float)y * fine_inv;

            float gr = (smooth_noise(cx, cy, seed_r)     * 0.65f +
                        smooth_noise(fx, fy, seed_r^0x1) * 0.35f) - 0.5f;
            float gg = (smooth_noise(cx, cy, seed_g)     * 0.65f +
                        smooth_noise(fx, fy, seed_g^0x1) * 0.35f) - 0.5f;
            float gb = (smooth_noise(cx, cy, seed_b)     * 0.65f +
                        smooth_noise(fx, fy, seed_b^0x1) * 0.35f) - 0.5f;

            /* Apply: weighted by luminance zone, scaled per channel */
            r[i] += gr * sigma * weight * stock->grain_ch_r;
            g[i] += gg * sigma * weight * stock->grain_ch_g;
            b[i] += gb * sigma * weight * stock->grain_ch_b;

            /* Clamp */
            if (r[i] < 0.0f) r[i] = 0.0f; if (r[i] > 1.0f) r[i] = 1.0f;
            if (g[i] < 0.0f) g[i] = 0.0f; if (g[i] > 1.0f) g[i] = 1.0f;
            if (b[i] < 0.0f) b[i] = 0.0f; if (b[i] > 1.0f) b[i] = 1.0f;
        }
    }
}
