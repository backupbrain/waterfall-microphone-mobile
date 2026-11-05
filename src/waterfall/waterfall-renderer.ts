import type { ExpoWebGLRenderingContext } from 'expo-gl';

import { LUT_SIZE } from './colormaps';

const VERTEX_SHADER = `
attribute vec2 aPosition;
uniform float uHead;
uniform float uRows;
uniform float uVisible;
varying vec2 vUv;
varying float vRow;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  vRow = (uHead + 0.5) / uRows - (1.0 - vUv.y) * (uVisible / uRows);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uData;
uniform sampler2D uLut;
uniform float uLog;
uniform float uFmin;
varying vec2 vUv;
varying float vRow;
void main() {
  float logU = uFmin * pow(1.0 / uFmin, vUv.x);
  float u = mix(vUv.x, logU, uLog);
  float value = texture2D(uData, vec2(u, vRow)).r;
  gl_FragColor = texture2D(uLut, vec2(value, 0.5));
}
`;

type GL = ExpoWebGLRenderingContext;

function compileShader(gl: GL, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log ?? 'unknown error'}`);
  }
  return shader;
}

/**
 * Draws the waterfall from a ring-buffer texture: each new spectrum row is
 * uploaded as a single-row `texSubImage2D`, and the shader maps screen rows back
 * to texture rows so no pixels are ever moved. Colour comes from a 1-D LUT.
 */
export class WaterfallRenderer {
  readonly bins: number;
  readonly rows: number;

  /** Number of rows that span the view's height. */
  visibleRows: number;
  logScale = false;
  /** Lowest frequency of the log scale, as a fraction of Nyquist. */
  minFrequencyFraction = 20 / 24000;

  private readonly gl: GL;
  private readonly program: WebGLProgram;
  private readonly quad: WebGLBuffer;
  private readonly dataTexture: WebGLTexture;
  private readonly lutTexture: WebGLTexture;
  private readonly rowScratch: Uint8Array;
  private readonly uniforms: Record<string, WebGLUniformLocation | null>;
  private head: number;
  private disposed = false;

  constructor(gl: GL, bins: number, rows: number) {
    this.gl = gl;
    this.bins = bins;
    this.rows = rows;
    this.visibleRows = rows;
    this.head = rows - 1;
    this.rowScratch = new Uint8Array(bins);

    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error('Could not create program');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link failed: ${log ?? 'unknown error'}`);
    }
    this.program = program;

    this.uniforms = {};
    for (const name of ['uHead', 'uRows', 'uVisible', 'uData', 'uLut', 'uLog', 'uFmin']) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }

    const quad = gl.createBuffer();
    if (!quad) throw new Error('Could not create buffer');
    this.quad = quad;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    const dataTexture = gl.createTexture();
    if (!dataTexture) throw new Error('Could not create texture');
    this.dataTexture = dataTexture;
    gl.bindTexture(gl.TEXTURE_2D, dataTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      bins,
      rows,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      new Uint8Array(bins * rows)
    );

    const lutTexture = gl.createTexture();
    if (!lutTexture) throw new Error('Could not create texture');
    this.lutTexture = lutTexture;
    gl.bindTexture(gl.TEXTURE_2D, lutTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      LUT_SIZE,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(LUT_SIZE * 4)
    );

    gl.clearColor(0, 0, 0, 1);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  setPalette(lut: Uint8Array): void {
    if (this.disposed) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, LUT_SIZE, 1, gl.RGBA, gl.UNSIGNED_BYTE, lut);
  }

  /** Appends one row of `bins` intensity values (0..255). */
  pushRow(row: Uint8Array): void {
    if (this.disposed) return;
    const gl = this.gl;
    this.head = (this.head + 1) % this.rows;
    this.rowScratch.set(row);
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      this.head,
      this.bins,
      1,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      this.rowScratch
    );
  }

  clear(): void {
    if (this.disposed) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      this.bins,
      this.rows,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      new Uint8Array(this.bins * this.rows)
    );
    this.head = this.rows - 1;
  }

  draw(): void {
    if (this.disposed) return;
    const gl = this.gl;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.dataTexture);
    gl.uniform1i(this.uniforms.uData, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
    gl.uniform1i(this.uniforms.uLut, 1);

    gl.uniform1f(this.uniforms.uHead, this.head);
    gl.uniform1f(this.uniforms.uRows, this.rows);
    gl.uniform1f(this.uniforms.uVisible, Math.min(this.rows, Math.max(1, this.visibleRows)));
    gl.uniform1f(this.uniforms.uLog, this.logScale ? 1 : 0);
    gl.uniform1f(this.uniforms.uFmin, Math.min(0.5, Math.max(1e-4, this.minFrequencyFraction)));

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const position = gl.getAttribLocation(this.program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.flush();
    gl.endFrameEXP();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    gl.deleteTexture(this.dataTexture);
    gl.deleteTexture(this.lutTexture);
    gl.deleteBuffer(this.quad);
    gl.deleteProgram(this.program);
  }
}
