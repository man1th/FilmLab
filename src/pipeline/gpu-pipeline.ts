/**
 * gpu-pipeline.ts
 *
 * WebGL2-based pixel processing pipeline.
 * Runs chemistry transforms directly on the GPU via fragment shaders,
 * eliminating the CPU processing bottleneck entirely.
 */

interface GpuPipeline {
  gl: WebGL2RenderingContext;
  setParams: (params: Float64Array) => void;
  uploadPixels: (pixels: Uint8ClampedArray) => void;
  render: () => Uint8ClampedArray;
  destroy: () => void;
}

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

  // ─── Shaders ───────────────────────────────────────────────────────

  const vertSrc = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_position * 0.5 + 0.5;
}`;

  const fragSrc = `#version 300 es
precision highp float;
in vec2 v_texCoord;
out vec4 fragColor;
uniform sampler2D u_tex;
uniform float u_dMin;
uniform float u_dMax;
uniform float u_density;
uniform float u_contrast;
uniform float u_expiration;
uniform float u_fog;
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

  // ─── Compile ───────────────────────────────────────────────────────

  function compile(src: string, type: number): WebGLShader | null {
    if (!gl) return null;
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

  const vs = compile(vertSrc, gl.VERTEX_SHADER);
  const fs = compile(fragSrc, gl.FRAGMENT_SHADER);
  if (!vs || !fs) {
    return null;
  }

  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  gl.useProgram(program);

  // ─── Geometry ───────────────────────────────────────────────────────

  const verts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // ─── Uniforms ──────────────────────────────────────────────────────

  const uTex = gl.getUniformLocation(program, "u_tex");
  gl.uniform1i(uTex, 0);
  const uDMin = gl.getUniformLocation(program, "u_dMin")!;
  const uDMax = gl.getUniformLocation(program, "u_dMax")!;
  const uDensity = gl.getUniformLocation(program, "u_density")!;
  const uContrast = gl.getUniformLocation(program, "u_contrast")!;
  const uExpiration = gl.getUniformLocation(program, "u_expiration")!;
  const uFog = gl.getUniformLocation(program, "u_fog")!;

  // ─── Texture ────────────────────────────────────────────────────────

  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.viewport(0, 0, width, height);

  // ─── API ────────────────────────────────────────────────────────────

  return {
    gl,

    setParams(params: Float64Array) {
      gl.uniform1f(uDMin, params[0]);
      gl.uniform1f(uDMax, params[1]);
      gl.uniform1f(uDensity, params[2]);
      gl.uniform1f(uContrast, params[3]);
      gl.uniform1f(uExpiration, params[4]);
      gl.uniform1f(uFog, params[5]);
    },

    uploadPixels(pixels: Uint8ClampedArray) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
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
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      const raw = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      return new Uint8ClampedArray(raw.buffer);
    },

    destroy() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
