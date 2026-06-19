#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "vendor/stb_image.h"
#include "vendor/stb_image_write.h"
#include "processor.h"
#include "film_stock.h"
#include "stocks/cinestill_800t.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char* argv[]) {
    if (argc < 3) {
        fprintf(stderr, "Usage: filmlab <input.jpg|png> <output.png>\n");
        fprintf(stderr, "Example: filmlab photo.jpg cinestill_result.png\n");
        return 1;
    }

    const char* input_path  = argv[1];
    const char* output_path = argv[2];

    /* Load input image */
    int w, h, channels;
    unsigned char* pixels_in = stbi_load(input_path, &w, &h, &channels, 3);
    if (!pixels_in) {
        fprintf(stderr, "Error: could not load '%s'\n", input_path);
        return 1;
    }
    printf("Loaded: %s (%dx%d, %d channels)\n", input_path, w, h, channels);

    /* Allocate output buffer */
    unsigned char* pixels_out = (unsigned char*)malloc(w * h * 3);
    if (!pixels_out) {
        fprintf(stderr, "Error: out of memory\n");
        stbi_image_free(pixels_in);
        return 1;
    }

    /* Load Cinestill 800T film stock */
    FilmStock stock = cinestill_800t_create();
    printf("Processing with: %s\n", stock.name);

    /* Run the pipeline */
    int result = process_image(pixels_in, pixels_out, w, h, &stock);
    if (result != 0) {
        fprintf(stderr, "Error: processing failed\n");
        free(pixels_out);
        stbi_image_free(pixels_in);
        return 1;
    }

    /* Write output PNG */
    if (!stbi_write_png(output_path, w, h, 3, pixels_out, w * 3)) {
        fprintf(stderr, "Error: could not write '%s'\n", output_path);
        free(pixels_out);
        stbi_image_free(pixels_in);
        return 1;
    }

    printf("Done: %s\n", output_path);

    free(pixels_out);
    stbi_image_free(pixels_in);
    return 0;
}
