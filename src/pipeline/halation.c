#include "halation.h"
#include <stdlib.h>
#include <string.h>
#include <math.h>

/* Build a 1D Gaussian kernel. Returns kernel (caller frees), sets *out_radius */
static float* make_gaussian_kernel(float sigma, int* out_radius) {
    int radius = (int)(sigma * 3.0f + 0.5f);
    if (radius < 1) radius = 1;
    int size = 2 * radius + 1;
    float* k = (float*)malloc(size * sizeof(float));
    float sum = 0.0f;
    for (int i = 0; i < size; i++) {
        float x = (float)(i - radius);
        k[i] = expf(-0.5f * x * x / (sigma * sigma));
        sum += k[i];
    }
    for (int i = 0; i < size; i++) k[i] /= sum;
    *out_radius = radius;
    return k;
}

/* Separable Gaussian blur on a single float channel */
static void gaussian_blur(float* dst, const float* src,
                          int w, int h, float sigma) {
    if (sigma <= 0.0f) {
        memcpy(dst, src, w * h * sizeof(float));
        return;
    }

    float* tmp = (float*)malloc(w * h * sizeof(float));
    int radius;
    float* k = make_gaussian_kernel(sigma, &radius);

    /* Horizontal pass */
    for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
            float acc = 0.0f;
            for (int kx = -radius; kx <= radius; kx++) {
                int sx = x + kx;
                if (sx < 0) sx = 0;
                if (sx >= w) sx = w - 1;
                acc += src[y * w + sx] * k[kx + radius];
            }
            tmp[y * w + x] = acc;
        }
    }

    /* Vertical pass */
    for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
            float acc = 0.0f;
            for (int ky = -radius; ky <= radius; ky++) {
                int sy = y + ky;
                if (sy < 0) sy = 0;
                if (sy >= h) sy = h - 1;
                acc += tmp[sy * w + x] * k[ky + radius];
            }
            dst[y * w + x] = acc;
        }
    }

    free(tmp);
    free(k);
}

void apply_halation(float* r, float* g, float* b,
                    int w, int h, const FilmStock* stock) {
    int pixels = w * h;
    float* luma   = (float*)malloc(pixels * sizeof(float));
    float* mask   = (float*)malloc(pixels * sizeof(float));
    float* halo_r = (float*)malloc(pixels * sizeof(float));
    float* halo_g = (float*)malloc(pixels * sizeof(float));

    /* Step 1: Compute luminance and bright-source mask */
    float threshold = stock->halo_threshold;
    for (int i = 0; i < pixels; i++) {
        /* Rec.709 luminance coefficients */
        luma[i] = 0.2126f * r[i] + 0.7152f * g[i] + 0.0722f * b[i];
        float above = luma[i] - threshold;
        mask[i] = above > 0.0f ? above / (1.0f - threshold) : 0.0f;
    }

    /* Step 2: Blur the bright mask to create the halo spread
       Two blur passes: wide (main halo) + narrow (orange core) */
    float sigma_main = stock->halo_radius_factor * (float)w;
    float sigma_core = sigma_main * 0.25f;

    gaussian_blur(halo_r, mask, w, h, sigma_main);
    gaussian_blur(halo_g, mask, w, h, sigma_core);

    /* Step 3: Modulate — suppress halo ON the bright source itself
       (halation only shows on the DARK side of the contrast edge) */
    for (int i = 0; i < pixels; i++) {
        float suppress = 1.0f - luma[i];  /* 0 at bright areas, 1 at dark */
        halo_r[i] *= suppress;
        halo_g[i] *= suppress;
    }

    /* Step 4: Add halo to red and green channels
       + global veil (very subtle red blush everywhere) */
    for (int i = 0; i < pixels; i++) {
        r[i] += halo_r[i] * stock->halo_r_intensity;
        g[i] += halo_g[i] * stock->halo_g_intensity;

        /* Global diffusion: red veil proportional to image brightness */
        r[i] += luma[i] * stock->halo_global_veil;

        /* Clamp */
        if (r[i] > 1.0f) r[i] = 1.0f;
        if (g[i] > 1.0f) g[i] = 1.0f;
    }

    free(luma); free(mask); free(halo_r); free(halo_g);
}
