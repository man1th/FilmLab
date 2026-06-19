#!/usr/bin/env bash
#
# build.sh
#
# Emscripten compilation pipeline for the FilmLab engine core.
# Compiles engine_core.c to WebAssembly with SIMD optimizations.
#
# Prerequisites:
#   - Emscripten SDK installed and activated (emsdk activate latest)
#   - Or: docker run --rm -v $(pwd):/src emscripten/emsdk emcc ...
#
# Usage:
#   ./build.sh [release|debug]
#

set -euo pipefail

BUILD_TYPE="${1:-release}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}"

COMMON_FLAGS=(
    -O3
    -msimd128
    -flto
    -s WASM=1
    -s EXPORTED_FUNCTIONS='["_apply_chemistry","_apply_grain","_apply_acutance","_apply_print_transform","_run_full_pipeline"]'
    -s EXPORTED_RUNTIME_METHODS='["ccall","getValue","setValue"]'
    -s ALLOW_MEMORY_GROWTH=1
    -s INITIAL_MEMORY=134217728
    -s MAXIMUM_MEMORY=2147483648
    -s ENVIRONMENT=worker
    -s TEXTURE=0
    -s TOTAL_STACK=8388608
    --no-entry
)

if [ "${BUILD_TYPE}" = "debug" ]; then
    COMMON_FLAGS+=(-g4 -s ASSERTIONS=2 -s SAFE_HEAP=1)
else
    COMMON_FLAGS+=(-g0 --strip-debug)
fi

echo "=== Building FilmLab Engine Core (${BUILD_TYPE}) ==="

# Compile to WASM
emcc "${COMMON_FLAGS[@]}" \
    -o "${OUTPUT_DIR}/engine_core.wasm" \
    "${SCRIPT_DIR}/engine_core.c"

echo "=== Build complete ==="
echo "Output: ${OUTPUT_DIR}/engine_core.wasm"
ls -lh "${OUTPUT_DIR}/engine_core.wasm"
