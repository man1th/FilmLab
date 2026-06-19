#ifndef PROCESSOR_H
#define PROCESSOR_H
#include "film_stock.h"
#include <stdint.h>

/* Process an sRGB image through a film stock emulation pipeline.
   pixels_in/out: interleaved R,G,B uint8 (3 bytes per pixel, no alpha)
   Returns 0 on success, non-zero on error. */
int process_image(const uint8_t* pixels_in,
                  uint8_t*       pixels_out,
                  int width, int height,
                  const FilmStock* stock);
#endif
