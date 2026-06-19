#ifndef TONE_CURVES_H
#define TONE_CURVES_H
#include "../film_stock.h"
void apply_tone_curves(float* r, float* g, float* b,
                       int pixel_count, const FilmStock* stock);
#endif
