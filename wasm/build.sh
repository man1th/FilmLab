#!/bin/bash
set -e

cd "$(dirname "$0")"

emcc core.c -o ../public/wasm/core.js \
  -s EXPORTED_FUNCTIONS=_process_image,_process_print_style,_malloc,_free \
  -s EXPORTED_RUNTIME_METHODS=ccall,cwrap,HEAPU8,HEAPF32 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME=createCoreModule \
  -s ENVIRONMENT=web \
  -s ALLOW_MEMORY_GROWTH=1 \
  -O2

echo "✅ WASM build complete"
