#include "tone_curves.h"
#include "../film_stock.h"
#include <stdint.h>

/* Sample a 1024-point LUT with linear interpolation */
static inline float lut_sample(const float* lut, float x) {
    if (x <= 0.0f) return lut[0];
    if (x >= 1.0f) return lut[LUT_SIZE - 1];
    float idx = x * (float)(LUT_SIZE - 1);
    int   lo  = (int)idx;
    float t   = idx - (float)lo;
    return lut[lo] * (1.0f - t) + lut[lo + 1] * t;
}

void apply_tone_curves(float* r, float* g, float* b,
                       int pixel_count, const FilmStock* stock) {
    for (int i = 0; i < pixel_count; i++) {
        r[i] = lut_sample(stock->lut_r, r[i]);
        g[i] = lut_sample(stock->lut_g, g[i]);
        b[i] = lut_sample(stock->lut_b, b[i]);
    }
}
