#ifndef FILM_STOCK_H
#define FILM_STOCK_H

#define LUT_SIZE 1024

typedef struct {
    const char* id;
    const char* name;
    const char** tags;
    int tag_count;

    /* Tone curves — per channel, 1024-point LUT
       Input:  normalized linear light [0,1] mapped to LUT index
       Output: normalized linear density [0,1] */
    float lut_r[LUT_SIZE];
    float lut_g[LUT_SIZE];
    float lut_b[LUT_SIZE];

    /* 3x3 color matrix, row-major (applied after tone curves)
       out_rgb = matrix * in_rgb */
    float color_matrix[9];

    /* Zone color tints — L*a*b* offsets (a=green-red, b=blue-yellow)
       Applied weighted by luminance zone */
    float shadow_ab[2];
    float midtone_ab[2];
    float highlight_ab[2];

    /* Halation */
    float halo_threshold;       /* luminance above which halation triggers, linear [0,1] */
    float halo_radius_factor;   /* halo radius as fraction of image width */
    float halo_r_intensity;     /* red channel halo strength */
    float halo_g_intensity;     /* green channel (orange core) strength */
    float halo_global_veil;     /* subtle global red diffusion across whole image */

    /* Grain */
    float grain_sigma;          /* base grain intensity */
    float grain_coarse_scale;   /* coarse grain size, fraction of image width */
    float grain_fine_scale;     /* fine grain size, fraction of image width */
    float grain_ch_r;           /* per-channel grain weight: red */
    float grain_ch_g;           /* green */
    float grain_ch_b;           /* blue */

} FilmStock;

#endif /* FILM_STOCK_H */
