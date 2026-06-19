/*
 * wasm_simd128.h
 *
 * Native assembly binding map for WASM SIMD128 intrinsics.
 * Provides portable macros for 128-bit SIMD operations used in the
 * pixel processing pipeline.
 *
 * When compiled with Emscripten (-msimd128), these map directly to
 * SSE/NEON-equivalent WebAssembly SIMD instructions.
 */

#ifndef WASM_SIMD128_H
#define WASM_SIMD128_H

#ifdef __EMSCRIPTEN__
#include <wasm_simd128.h>
#else
/*
 * Fallback stubs for local compilation / linting without Emscripten.
 * These are intentionally non-functional - the real implementation
 * requires Emscripten's SIMD intrinsics.
 */

typedef float __attribute__((__vector_size__(16))) v128_t;

#define wasm_f32x4_make(a, b, c, d) ((v128_t){a, b, c, d})
#define wasm_f32x4_splat(v)         ((v128_t){v, v, v, v})

static inline v128_t wasm_f32x4_add(v128_t a, v128_t b) { return a + b; }
static inline v128_t wasm_f32x4_sub(v128_t a, v128_t b) { return a - b; }
static inline v128_t wasm_f32x4_mul(v128_t a, v128_t b) { return a * b; }
static inline v128_t wasm_f32x4_div(v128_t a, v128_t b) { return a / b; }
static inline v128_t wasm_f32x4_min(v128_t a, v128_t b) { return __builtin_elementwise_min(a, b); }
static inline v128_t wasm_f32x4_max(v128_t a, v128_t b) { return __builtin_elementwise_max(a, b); }
static inline v128_t wasm_f32x4_load(const void* p)       { return *((const v128_t*)p); }
static inline void    wasm_f32x4_store(void* p, v128_t v) { *((v128_t*)p) = v; }

#endif /* __EMSCRIPTEN__ */

#endif /* WASM_SIMD128_H */
