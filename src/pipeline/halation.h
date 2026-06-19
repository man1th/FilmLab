#ifndef HALATION_H
#define HALATION_H
#include "../film_stock.h"
void apply_halation(float* r, float* g, float* b,
                    int w, int h, const FilmStock* stock);
#endif
