#include "processor.h"
#include "pipeline/tone_curves.h"
#include "pipeline/color_matrix.h"
#include "pipeline/halation.h"
#include "pipeline/grain.h"
#include <stdlib.h>
#include <math.h>

/* sRGB gamma → linear (exact IEC 61966-2-1) */
static inline float srgb_to_linear(float c) {
    return c <= 0.04045f ? c / 12.92f : powf((c + 0.055f) / 1.055f, 2.4f);
}

/* Linear → sRGB gamma */
static inline float linear_to_srgb(float c) {
    if (c <= 0.0f)       return 0.0f;
    if (c >= 1.0f)       return 1.0f;
    return c <= 0.0031308f ? c * 12.92f : 1.055f * powf(c, 1.0f/2.4f) - 0.055f;
}

int process_image(const uint8_t* pixels_in,
                  uint8_t*       pixels_out,
                  int width, int height,
                  const FilmStock* stock) {
    int pixels = width * height;

    /* Allocate float planes (R, G, B separate for SIMD-friendly layout) */
    float* r = (float*)malloc(pixels * sizeof(float));
    float* g = (float*)malloc(pixels * sizeof(float));
    float* b = (float*)malloc(pixels * sizeof(float));
    if (!r || !g || !b) { free(r); free(g); free(b); return -1; }

    /* Step 1: Unpack uint8 → float, linearize (remove sRGB gamma) */
    for (int i = 0; i < pixels; i++) {
        r[i] = srgb_to_linear(pixels_in[i*3 + 0] / 255.0f);
        g[i] = srgb_to_linear(pixels_in[i*3 + 1] / 255.0f);
        b[i] = srgb_to_linear(pixels_in[i*3 + 2] / 255.0f);
    }

    /* Step 2: Per-channel tone curves (H&D response) */
    apply_tone_curves(r, g, b, pixels, stock);

    /* Step 3: Color matrix (dye coupler simulation) */
    apply_color_matrix(r, g, b, pixels, stock);

    /* Step 4: Halation (before grain — it's an optical effect, not grain) */
    apply_halation(r, g, b, width, height, stock);

    /* Step 5: Film grain */
    apply_grain(r, g, b, width, height, stock);

    /* Step 6: Re-apply sRGB gamma and pack back to uint8 */
    for (int i = 0; i < pixels; i++) {
        pixels_out[i*3 + 0] = (uint8_t)(linear_to_srgb(r[i]) * 255.0f + 0.5f);
        pixels_out[i*3 + 1] = (uint8_t)(linear_to_srgb(g[i]) * 255.0f + 0.5f);
        pixels_out[i*3 + 2] = (uint8_t)(linear_to_srgb(b[i]) * 255.0f + 0.5f);
    }

    free(r); free(g); free(b);
    return 0;
}
