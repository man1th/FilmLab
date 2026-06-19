/**
 * pipeline.worker.ts
 *
 * Lifecycle:
 * 1. INIT        → receives SharedArrayBuffer
 * 2. INIT_CANVAS → receives OffscreenCanvas for WebGL2
 * 3. IMAGE_LOAD  → receives ArrayBuffer → decodes → uploads → renders
 * 4. RENDER_FRAME → re-renders with updated params
 */

let sharedParams: Float32Array | null = null;
let canvas: OffscreenCanvas | null = null;
let gl: WebGL2RenderingContext | null = null;
let sourceTexture: WebGLTexture | null = null;
let quadVAO: WebGLBuffer | null = null;
let quadProgram: WebGLProgram | null = null;
let imageLoaded = false;

function log(msg: string) {
  self.postMessage({ type: "LOG", message: `[Worker] ${msg}` });
}

function err(msg: string) {
  self.postMessage({ type: "ERROR", message: `[Worker] ${msg}` });
}

// ─── Full-screen quad shaders (WebGL2) ──────────────────────────────────────

const VERTEX_SRC = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_position * 0.5 + 0.5;
}`;

const FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 v_texCoord;
out vec4 fragColor;
uniform sampler2D u_texture;
void main() {
  fragColor = texture(u_texture, v_texCoord);
}`;

// ─── Message handler ────────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent) => {
  const { type } = event.data;

  try {
    switch (type) {
      case "INIT": {
        sharedParams = new Float32Array(event.data.sharedBuffer);
        log("INIT received, SharedArrayBuffer ready");
        break;
      }

      case "INIT_CANVAS": {
        canvas = event.data.canvas;
        log(`INIT_CANVAS received: ${canvas ? "OK" : "null"}`);

        if (!canvas) {
          err("OffscreenCanvas is null");
          break;
        }

        gl = canvas.getContext("webgl2", {
          alpha: false,
          antialias: false,
          desynchronized: true,
          premultipliedAlpha: false,
        });

        if (gl) {
          log("WebGL2 context created");
          initQuadProgram();
          self.postMessage({ type: "CANVAS_READY" });
        } else {
          // Fallback: try WebGL1
          const gl1 = canvas.getContext("webgl", {
            alpha: false,
            antialias: false,
            premultipliedAlpha: false,
          }) as WebGL2RenderingContext | null;

          if (gl1) {
            gl = gl1;
            log("WebGL1 fallback context created");
            initQuadProgram();
            self.postMessage({ type: "CANVAS_READY" });
          } else {
            err("No WebGL context available");
          }
        }
        break;
      }

      case "IMAGE_LOAD": {
        const buffer: ArrayBuffer = event.data.buffer;
        const fileName: string = event.data.fileName;
        log(`IMAGE_LOAD: ${fileName} (${buffer.byteLength} bytes)`);

        await loadAndRenderImage(buffer, fileName);
        break;
      }

      case "RENDER_FRAME": {
        if (imageLoaded) {
          renderFrame();
        }
        break;
      }
    }
  } catch (e) {
    err(`Handler error: ${e}`);
  }
};

// ─── Shaders ────────────────────────────────────────────────────────────────

function compileShader(src: string, type: number): WebGLShader | null {
  if (!gl) return null;
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    err(`Shader compile error: ${gl.getShaderInfoLog(shader)}`);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function initQuadProgram() {
  if (!gl) {
    err("initQuadProgram: no GL context");
    return;
  }

  const vs = compileShader(VERTEX_SRC, gl.VERTEX_SHADER);
  const fs = compileShader(FRAGMENT_SRC, gl.FRAGMENT_SHADER);
  if (!vs || !fs) {
    err("Failed to compile shaders");
    return;
  }

  const program = gl.createProgram();
  if (!program) {
    err("Failed to create program");
    return;
  }

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    err(`Program link error: ${gl.getProgramInfoLog(program)}`);
    gl.deleteProgram(program);
    return;
  }

  quadProgram = program;
  log("Quad program linked");

  // Full-screen quad geometry
  const positions = new Float32Array([
    -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
  ]);

  quadVAO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVAO);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  log("Quad geometry set up");
}

// ─── Image loading & rendering ──────────────────────────────────────────────

async function loadAndRenderImage(buffer: ArrayBuffer, fileName: string) {
  if (!gl || !canvas) {
    err("Cannot render: GL or canvas not initialized");
    return;
  }

  // Decode the ArrayBuffer into an ImageBitmap
  let bitmap: ImageBitmap;
  try {
    const blob = new Blob([buffer]);
    log(`Created Blob (${blob.size} bytes), decoding...`);

    bitmap = await createImageBitmap(blob);
    log(`Decoded: ${bitmap.width}x${bitmap.height}`);
  } catch (e) {
    err(`Failed to decode ${fileName}: ${e}`);
    return;
  }

  // Resize the OffscreenCanvas to the image dimensions
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  gl.viewport(0, 0, bitmap.width, bitmap.height);
  log(`Canvas resized to ${bitmap.width}x${bitmap.height}`);

  // Upload to WebGL texture
  if (sourceTexture) {
    gl.deleteTexture(sourceTexture);
  }

  sourceTexture = gl.createTexture();
  if (!sourceTexture) {
    err("Failed to create texture");
    bitmap.close();
    return;
  }

  gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  bitmap.close();
  imageLoaded = true;

  log("Texture uploaded, rendering...");
  renderFrame();
  log("Render complete");
}

function renderFrame() {
  if (!gl || !quadProgram || !sourceTexture) {
    err("renderFrame: missing resources");
    return;
  }

  gl.useProgram(quadProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sourceTexture);

  const uTex = gl.getUniformLocation(quadProgram, "u_texture");
  gl.uniform1i(uTex, 0);

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}
