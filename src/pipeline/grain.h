#ifndef GRAIN_H
#define GRAIN_H
#include "../film_stock.h"
void apply_grain(float* r, float* g, float* b,
                 int w, int h, const FilmStock* stock);
#endif
