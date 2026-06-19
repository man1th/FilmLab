/**
 * gpu-pipeline.ts
 *
 * WebGL2 multi-pass pixel processing pipeline.
 * - Pass 0: Chemistry (per-pixel color transforms)
 * - Pass 1: Luminance threshold + horizontal Gaussian blur (halation)
 * - Pass 2: Vertical bilateral blur + chromaticity + spill balance
 * - Pass 3: Composite halation onto chemistry with edge retention
 */

import type { HalationParams } from "@/store/useParameterStore";

interface GpuPipeline {
  gl: WebGL2RenderingContext;
  setChemistryParams: (params: Float64Array) => void;
  setHalationParams: (params: HalationParams) => void;
  uploadPixels: (pixels: Uint8ClampedArray) => void;
  render: () => Uint8ClampedArray;
  destroy: () => void;
}

// ─── Shared vertex shader ────────────────────────────────────────────────────

const VERT_SRC = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_position * 0.5 + 0.5;
}`;

// ─── Pass 0: Chemistry (per-pixel) ───────────────────────────────────────────

const CHEM_FRAG = `#version 300 es
precision highp float;
in vec2 v_texCoord;
out vec4 fragColor;
uniform sampler2D u_tex;
uniform float u_dMin, u_dMax, u_density, u_contrast, u_expiration, u_fog;
void main() {
  vec4 col = texture(u_tex, v_texCoord);
  vec3 c = col.rgb;
  c = u_dMin + (1.0 - u_dMin) * c;
  c = min(c, vec3(u_dMax));
  if (u_density != 1.0) { c = exp(-(-log(c + 1e-6) * u_density)); }
  if (u_contrast != 1.0) {
    vec3 sig = 1.0 / (1.0 + exp(-u_contrast * (c - 0.5)));
    c = c + (sig - c) * 0.5;
  }
  if (u_expiration > 0.0) {
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    float sf = (1.0 - lum) * (1.0 - lum) * u_expiration;
    c.r += sf * 0.05; c.g += sf * 0.12;
  }
  c += vec3(u_fog);
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

// ─── Pass 1: Horizontal Gaussian blur (separable) ────────────────────────────

const BLURH_FRAG = `#version 300 es
precision highp float;
in vec2 v_texCoord;
out vec4 fragColor;
uniform sampler2D u_tex;
uniform float u_radius;
uniform vec2 u_step;
void main() {
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int i = -15; i <= 15; i++) {
    float fi = float(i);
    if (abs(fi) > u_radius) continue;
    float w = exp(-(fi * fi) / (2.0 * u_radius * u_radius));
    vec2 off = vec2(fi * u_step.x, 0.0);
    vec3 s = texture(u_tex, v_texCoord + off).rgb;
    // Luminance threshold — only bright areas contribute to halation
    float lum = dot(s, vec3(0.299, 0.587, 0.114));
    w *= smoothstep(0.2, 0.6, lum);
    sum += s * w;
    total += w;
  }
  fragColor = total > 0.0 ? vec4(sum / total, 1.0) : vec4(0.0);
}`;

// ─── Pass 2: Vertical bilateral blur + chromaticity + spill ──────────────────

const BLURV_FRAG = `#version 300 es
precision highp float;
in vec2 v_texCoord;
out vec4 fragColor;
uniform sampler2D u_tex;       // Pass 1 output (horizontal blur)
uniform sampler2D u_chem;      // Chemistry result (for edge retention)
uniform float u_radius;
uniform float u_edgeRetention;
uniform float u_fringe;        // chromaticity saturation boost
uniform vec3 u_spill;          // RGB spill balance
uniform vec2 u_step;
void main() {
  vec3 centerCol = texture(u_chem, v_texCoord).rgb;
  float centerLum = dot(centerCol, vec3(0.299, 0.587, 0.114));

  vec3 sum = vec3(0.0);
  float total = 0.0;
  float sigmaR = max(0.01, (1.0 - u_edgeRetention) * 0.3);

  for (int i = -15; i <= 15; i++) {
    float fi = float(i);
    if (abs(fi) > u_radius) continue;

    vec2 off = vec2(0.0, fi * u_step.y);
    vec3 s = texture(u_tex, v_texCoord + off).rgb;
    float sampleLum = texture(u_chem, v_texCoord + off).r; // cheaper approx

    // Spatial weight
    float wS = exp(-(fi * fi) / (2.0 * u_radius * u_radius));
    // Range weight (bilateral edge retention)
    float dL = sampleLum - centerLum;
    float wR = exp(-(dL * dL) / (2.0 * sigmaR * sigmaR));

    float w = wS * wR;
    sum += s * w;
    total += w;
  }

  vec3 halation = total > 0.0 ? sum / total : vec3(0.0);

  // Apply spill balance
  halation *= u_spill;

  // Apply fringe chromaticity (boost saturation)
  float hLum = dot(halation, vec3(0.299, 0.587, 0.114));
  halation = mix(vec3(hLum), halation, u_fringe);

  fragColor = vec4(halation, 1.0);
}`;

// ─── Pass 3: Composite ───────────────────────────────────────────────────────

const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 v_texCoord;
out vec4 fragColor;
uniform sampler2D u_chem;      // Chemistry result
uniform sampler2D u_halation;  // Processed halation
uniform float u_edgeRetention;
void main() {
  vec3 chem = texture(u_chem, v_texCoord).rgb;
  vec3 h = texture(u_halation, v_texCoord).rgb;

  // Edge-aware blend: less halation where edges are strong
  float edgeStrength = u_edgeRetention;

  vec3 result = chem + h * (1.0 - edgeStrength * 0.5);
  fragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}`;

// ─── Helper: compile shader ──────────────────────────────────────────────────

function compile(
  gl: WebGL2RenderingContext,
  src: string,
  type: number,
): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

// ─── Helper: create program ──────────────────────────────────────────────────

function createProgram(
  gl: WebGL2RenderingContext,
  vs: WebGLShader,
  fs: WebGLShader,
): WebGLProgram | null {
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

// ─── Helper: create texture ──────────────────────────────────────────────────

function createTex(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    w,
    h,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

// ─── Helper: create FBO ─────────────────────────────────────────────────────

function createFbo(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
): WebGLFramebuffer {
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    tex,
    0,
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fbo;
}

// ─── Full pipeline factory ───────────────────────────────────────────────────

export function createGpuPipeline(
  width: number,
  height: number,
): GpuPipeline | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    desynchronized: true,
    premultipliedAlpha: false,
  });

  if (!gl) return null;

  // ─── Quad geometry ────────────────────────────────────────────────────

  const verts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

  // ─── Compile shaders ─────────────────────────────────────────────────

  const vs = compile(gl, VERT_SRC, gl.VERTEX_SHADER);
  if (!vs) return null;

  const chemProg = createProgram(
    gl,
    vs,
    compile(gl, CHEM_FRAG, gl.FRAGMENT_SHADER)!,
  );
  const blurHProg = createProgram(
    gl,
    vs,
    compile(gl, BLURH_FRAG, gl.FRAGMENT_SHADER)!,
  );
  const blurVProg = createProgram(
    gl,
    vs,
    compile(gl, BLURV_FRAG, gl.FRAGMENT_SHADER)!,
  );
  const compProg = createProgram(
    gl,
    vs,
    compile(gl, COMPOSITE_FRAG, gl.FRAGMENT_SHADER)!,
  );
  if (!chemProg || !blurHProg || !blurVProg || !compProg) return null;

  const gl2 = gl!;

  function setupQuad(prog: WebGLProgram) {
    gl2.useProgram(prog);
    const aPos = gl2.getAttribLocation(prog, "a_position");
    gl2.enableVertexAttribArray(aPos);
    gl2.vertexAttribPointer(aPos, 2, gl2.FLOAT, false, 0, 0);
  }

  // ─── Textures & FBOs ─────────────────────────────────────────────────

  const inputTex = createTex(gl, width, height); // uploaded pixels
  const chemTex = createTex(gl, width, height); // chemistry result
  const blurHTex = createTex(gl, width, height); // horizontal blur
  const halationTex = createTex(gl, width, height); // final halation
  const outputTex = createTex(gl, width, height); // final composite

  const fboChem = createFbo(gl, chemTex);
  const fboBlurH = createFbo(gl, blurHTex);
  const fboHalation = createFbo(gl, halationTex);
  const fboOutput = createFbo(gl, outputTex);

  gl.viewport(0, 0, width, height);

  // ─── Halation state ──────────────────────────────────────────────────

  let halationEnabled = false;
  let currentHalation: HalationParams = {
    spreadRadius: 10,
    fringeChromaticity: 1,
    redSpill: 1,
    greenSpill: 0.2,
    blueSpill: 0,
    edgeRetention: 0.2,
    remjetProtection: false,
    glowTemperature: 5500,
  };

  // ─── Draw helper ─────────────────────────────────────────────────────

  function drawTo(prog: WebGLProgram, fbo: WebGLFramebuffer | null) {
    gl2.bindFramebuffer(gl2.FRAMEBUFFER, fbo);
    gl2.useProgram(prog);
    setupQuad(prog);
    gl2.drawArrays(gl2.TRIANGLES, 0, 6);
  }

  // ─── API ─────────────────────────────────────────────────────────────

  return {
    gl,

    setChemistryParams(params: Float64Array) {
      gl.useProgram(chemProg);
      gl.uniform1f(gl.getUniformLocation(chemProg, "u_dMin")!, params[0]);
      gl.uniform1f(gl.getUniformLocation(chemProg, "u_dMax")!, params[1]);
      gl.uniform1f(gl.getUniformLocation(chemProg, "u_density")!, params[2]);
      gl.uniform1f(gl.getUniformLocation(chemProg, "u_contrast")!, params[3]);
      gl.uniform1f(gl.getUniformLocation(chemProg, "u_expiration")!, params[4]);
      gl.uniform1f(gl.getUniformLocation(chemProg, "u_fog")!, params[5]);
    },

    setHalationParams(params: HalationParams) {
      currentHalation = params;
      halationEnabled = params.spreadRadius > 0;
    },

    uploadPixels(pixels: Uint8ClampedArray) {
      gl.bindTexture(gl.TEXTURE_2D, inputTex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
    },

    render(): Uint8ClampedArray {
      const h = currentHalation;
      const stepX = 1.0 / width;
      const stepY = 1.0 / height;

      // ── Pass 0: Chemistry ──
      setupQuad(chemProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, inputTex);
      gl.uniform1i(gl.getUniformLocation(chemProg, "u_tex")!, 0);
      drawTo(chemProg, fboChem);

      if (!halationEnabled || h.spreadRadius < 1) {
        // No halation — read back chemistry directly
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboChem);
        const raw = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
        return new Uint8ClampedArray(raw.buffer);
      }

      // ── Pass 1: Horizontal blur ──
      setupQuad(blurHProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, chemTex);
      gl.uniform1i(gl.getUniformLocation(blurHProg, "u_tex")!, 0);
      gl.uniform1f(
        gl.getUniformLocation(blurHProg, "u_radius")!,
        h.spreadRadius,
      );
      gl.uniform2f(gl.getUniformLocation(blurHProg, "u_step")!, stepX, stepY);
      drawTo(blurHProg, fboBlurH);

      // ── Pass 2: Vertical blur + chromaticity + spill ──
      setupQuad(blurVProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, blurHTex);
      gl.uniform1i(gl.getUniformLocation(blurVProg, "u_tex")!, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, chemTex);
      gl.uniform1i(gl.getUniformLocation(blurVProg, "u_chem")!, 1);
      gl.uniform1f(
        gl.getUniformLocation(blurVProg, "u_radius")!,
        h.spreadRadius,
      );
      gl.uniform1f(
        gl.getUniformLocation(blurVProg, "u_edgeRetention")!,
        h.edgeRetention,
      );
      gl.uniform1f(
        gl.getUniformLocation(blurVProg, "u_fringe")!,
        h.fringeChromaticity,
      );
      gl.uniform3f(
        gl.getUniformLocation(blurVProg, "u_spill")!,
        h.redSpill,
        h.greenSpill,
        h.blueSpill,
      );
      gl.uniform2f(gl.getUniformLocation(blurVProg, "u_step")!, stepX, stepY);
      drawTo(blurVProg, fboHalation);

      // ── Pass 3: Composite ──
      setupQuad(compProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, chemTex);
      gl.uniform1i(gl.getUniformLocation(compProg, "u_chem")!, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, halationTex);
      gl.uniform1i(gl.getUniformLocation(compProg, "u_halation")!, 1);
      gl.uniform1f(
        gl.getUniformLocation(compProg, "u_edgeRetention")!,
        h.edgeRetention,
      );
      drawTo(compProg, fboOutput);

      // ── Read back ──
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboOutput);
      const raw = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      return new Uint8ClampedArray(raw.buffer);
    },

    destroy() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
