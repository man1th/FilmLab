#include <emscripten.h>
#include <math.h>

EMSCRIPTEN_KEEPALIVE
void process_image(unsigned char* data, int width, int height) {
    (void)data;
    (void)width;
    (void)height;
}

// params layout for Print Style Custom:
// [0] toneCurve   -1..1   (telecine-scan-like <-> photochemical-print-like)
// [1] color        0..2   (1 = neutral, <1 desaturate, >1 boost)
// [2] neutralize   0..1   (pulls color cast toward gray, scaled by 'color' context)
// [3] blackpoint  -1..1   (lifts or crushes shadow floor)
// [4] rolloff      0..1   (0 = hard clip highlights, 1 = soft filmic rolloff)
EMSCRIPTEN_KEEPALIVE
void process_print_style(unsigned char* data, int width, int height, float* params) {
    float toneCurve = params[0];
    float color = params[1];
    float neutralize = params[2];
    float blackpoint = params[3];
    float rolloff = params[4];

    int numPixels = width * height;

    for (int i = 0; i < numPixels; i++) {
        int idx = i * 4;
        float r = data[idx] / 255.0f;
        float g = data[idx + 1] / 255.0f;
        float b = data[idx + 2] / 255.0f;

        if (neutralize > 0.0f) {
            float gray = r * 0.299f + g * 0.587f + b * 0.114f;
            r = r + (gray - r) * neutralize;
            g = g + (gray - g) * neutralize;
            b = b + (gray - b) * neutralize;
        }

        if (color != 1.0f) {
            float gray = r * 0.299f + g * 0.587f + b * 0.114f;
            r = gray + (r - gray) * color;
            g = gray + (g - gray) * color;
            b = gray + (b - gray) * color;
        }

        if (blackpoint != 0.0f) {
            r = r * (1.0f - fmaxf(0.0f, -blackpoint) * 0.3f) + fmaxf(0.0f, blackpoint) * 0.1f;
            g = g * (1.0f - fmaxf(0.0f, -blackpoint) * 0.3f) + fmaxf(0.0f, blackpoint) * 0.1f;
            b = b * (1.0f - fmaxf(0.0f, -blackpoint) * 0.3f) + fmaxf(0.0f, blackpoint) * 0.1f;
        }

        if (toneCurve != 0.0f) {
            float t = fabsf(toneCurve);
            float sr = r * r * (3.0f - 2.0f * r);
            float sg = g * g * (3.0f - 2.0f * g);
            float sb = b * b * (3.0f - 2.0f * b);
            if (toneCurve > 0) {
                r = r + (sr - r) * t;
                g = g + (sg - g) * t;
                b = b + (sb - b) * t;
            } else {
                r = r + (0.5f - r) * t * 0.2f;
                g = g + (0.5f - g) * t * 0.2f;
                b = b + (0.5f - b) * t * 0.2f;
            }
        }

        if (rolloff > 0.0f) {
            float knee = 0.75f;
            if (r > knee) r = knee + (1.0f - knee) * (1.0f - expf(-(r - knee) / (1.0f - knee) * (1.0f + rolloff * 3.0f)));
            if (g > knee) g = knee + (1.0f - knee) * (1.0f - expf(-(g - knee) / (1.0f - knee) * (1.0f + rolloff * 3.0f)));
            if (b > knee) b = knee + (1.0f - knee) * (1.0f - expf(-(b - knee) / (1.0f - knee) * (1.0f + rolloff * 3.0f)));
        }

        r = fminf(1.0f, fmaxf(0.0f, r));
        g = fminf(1.0f, fmaxf(0.0f, g));
        b = fminf(1.0f, fmaxf(0.0f, b));

        data[idx] = (unsigned char)(r * 255.0f + 0.5f);
        data[idx + 1] = (unsigned char)(g * 255.0f + 0.5f);
        data[idx + 2] = (unsigned char)(b * 255.0f + 0.5f);
    }
}
