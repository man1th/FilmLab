#ifndef COLOR_MATRIX_H
#define COLOR_MATRIX_H
#include "../film_stock.h"
void apply_color_matrix(float* r, float* g, float* b,
                        int pixel_count, const FilmStock* stock);
#endif
