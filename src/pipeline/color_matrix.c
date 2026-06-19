#include "color_matrix.h"

void apply_color_matrix(float* r, float* g, float* b,
                        int pixel_count, const FilmStock* stock) {
    const float* m = stock->color_matrix;
    for (int i = 0; i < pixel_count; i++) {
        float ri = r[i], gi = g[i], bi = b[i];
        r[i] = m[0]*ri + m[1]*gi + m[2]*bi;
        g[i] = m[3]*ri + m[4]*gi + m[5]*bi;
        b[i] = m[6]*ri + m[7]*gi + m[8]*bi;
    }
}
