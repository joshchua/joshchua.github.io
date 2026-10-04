/* Static GPU geometry and a dedicated rendering worker. No frame messages or bitmap copies. */
(() => {
  'use strict';
  if (typeof document === 'undefined') {
    let engine;
    self.onmessage = ({data}) => {
      if (data.type === 'init') {
        if (typeof requestAnimationFrame !== 'function') {
          self.postMessage({type: 'retry', mode: 'main'}); return;
        }
        engine = createEngine(data.canvas, data.options, message => self.postMessage(message));
      } else if (data.type === 'resize') engine?.resize(data.viewport);
      else if (data.type === 'state') engine?.state(data.paused, data.hidden);
      else if (data.type === 'pointer') engine?.pointer(data.x, data.y, data.active);
    };
    return;
  }

  const scriptURL = document.currentScript.src;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let canvas = document.querySelector('#triangles');
  let paused = reduced.matches, worker, engine;
  const viewport = () => ({width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio || 1});
  function start(mode, offscreen = true) {
    worker?.terminate(); worker = null;
    engine?.dispose(); engine = null;
    const fresh = canvas.cloneNode(); canvas.replaceWith(fresh); canvas = fresh;
    canvas.hidden = false;
    const options = {...viewport(), paused, hidden: document.hidden, mode};
    const receive = message => {
      if (message.type === 'ready') {
        canvas.dataset.renderer = message.renderer;
        canvas.dataset.animation = 'noise';
        canvas.dataset.pacing = '60fps';
        canvas.dataset.execution = worker ? 'worker' : 'main';
      } else if (message.type === 'retry') {
        if (message.mode === 'main') start(mode, false);
        else start('webgl', offscreen);
      } else if (message.type === 'unavailable') {
        canvas.hidden = true;
      }
    };
    if (offscreen && typeof Worker !== 'undefined' && canvas.transferControlToOffscreen) {
      try {
        worker = new Worker(scriptURL);
        worker.onmessage = ({data}) => receive(data);
        worker.onerror = event => { event.preventDefault(); start(mode, false); };
        const surface = canvas.transferControlToOffscreen();
        worker.postMessage({type: 'init', canvas: surface, options}, [surface]);
        return;
      } catch { worker?.terminate(); worker = null; start(mode, false); return; }
    }
    engine = createEngine(canvas, options, receive);
  }
  function state() {
    const hidden = document.hidden;
    if (worker) worker.postMessage({type: 'state', paused, hidden});
    else engine?.state(paused, hidden);
  }
  reduced.addEventListener('change', () => { paused = reduced.matches; state(); });
  document.addEventListener('visibilitychange', state);
  window.addEventListener('resize', () => {
    if (worker) worker.postMessage({type: 'resize', viewport: viewport()});
    else engine?.resize(viewport());
  });
  // Coalesce pointer events; no messages are sent while the pointer is stationary.
  let pointerFrame = null, pointerX = innerWidth / 2, pointerY = innerHeight / 2, pointerActive = false;
  function sendPointer() {
    if (pointerFrame !== null) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = null;
      if (worker) worker.postMessage({type: 'pointer', x: pointerX, y: pointerY, active: pointerActive});
      else engine?.pointer(pointerX, pointerY, pointerActive);
    });
  }
  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    pointerX = event.clientX; pointerY = event.clientY; pointerActive = true; sendPointer();
  }, {passive: true});
  function leavePointer() { pointerActive = false; sendPointer(); }
  document.documentElement.addEventListener('pointerleave', leavePointer);
  window.addEventListener('blur', leavePointer);
  start('webgpu');

  // Background-only resolution policy, independent of display DPI and aspect ratio.
  function backgroundSize(viewport) {
    const width = Math.max(1, viewport.width), height = Math.max(1, viewport.height);
    const ratio = Math.min(viewport.pixelRatio || 1, 0.75, Math.sqrt(500000 / (width * height)));
    return {width: Math.max(1, Math.floor(width * ratio)), height: Math.max(1, Math.floor(height * ratio)), ratio};
  }

  function createEngine(canvas, initial, report) {
    let viewport = initial;
    let paused = initial.paused, hidden = initial.hidden, disposed = false;
    let renderer, frame = 0, last = null, time = 0, nextFrame = null;
    const frameInterval = 1000 / 60;
    let vertices, width, height;
    const uniforms = new Float32Array(8);
    const viewUniforms = uniforms.subarray(0, 4), pointerUniforms = uniforms.subarray(4);
    let targetX = initial.width / 2, targetY = initial.height / 2, targetStrength = 0;
    uniforms[4] = targetX; uniforms[5] = targetY;
    function updatePointer(delta) {
      const easing = 1 - Math.exp(-Math.min(delta, 0.1) * 9);
      uniforms[4] += (targetX - uniforms[4]) * easing;
      uniforms[5] += (targetY - uniforms[5]) * easing;
      uniforms[6] += (targetStrength - uniforms[6]) * easing;
    }
  const random = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  function resize() {
    width = viewport.width; height = viewport.height;
    // This is a decorative backdrop: bound fill cost on Retina / large displays.
    const sizePolicy = backgroundSize(viewport);
    const ratio = sizePolicy.ratio;
    canvas.width = sizePolicy.width; canvas.height = sizePolicy.height;
    const size = Math.max(90, Math.min(155, width / 11));
    const rows = Math.ceil(height / (size * .866)) + 4;
    const cols = Math.ceil(width / size) + 4;
    const points = [], faces = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      points.push([(x - 1.5 + (y % 2) * .5 + (random(x, y) - .5) * .55) * size,
        (y - 1.5 + (random(y + 17, x) - .5) * .5) * size * .866]);
    }
    for (let y = 0; y < rows - 1; y++) for (let x = 0; x < cols - 1; x++) {
      const a = y * cols + x, b = a + 1, c = a + cols, d = c + 1;
      faces.push(...(y % 2 ? [[a,b,d], [a,d,c]] : [[a,b,c], [b,d,c]]));
    }
    // Each corner knows its face, so the vertex shader can derive a flat normal.
    // Barycentric coordinates draw the outlines without separate edge geometry.
    vertices = new Float32Array(faces.length * 3 * 9);
    let offset = 0;
    for (const face of faces) for (let corner = 0; corner < 3; corner++) {
      for (const index of face) for (const value of points[index]) vertices[offset++] = value;
      for (let k = 0; k < 3; k++) vertices[offset++] = Number(k === corner);
    }
    uniforms[0] = width; uniforms[1] = height; uniforms[3] = ratio;
    renderer?.resize(); draw();
  }
  // Restricted, explicitly typed math shared by WGSL and GLSL to keep motion identical.
  const math = `
    // psrdnoise (c) 2021 Stefan Gustavson and Ian McEwan
    // Published under the MIT license. https://github.com/stegu/psrdnoise/
    // Non-tiling, value-only srnoise2 variant, shared by both shader backends.
    fn mod289(x: vec3f) -> vec3f {
      return x - floor(x / 289.0) * 289.0;
    }
    fn flowNoise(p: vec2f, angle: f32) -> f32 {
      let uv: vec2f = vec2f(p.x + p.y * 0.5, p.y);
      let i0: vec2f = floor(uv);
      let f0: vec2f = uv - i0;
      let o1: vec2f = mix(vec2f(0.0, 1.0), vec2f(1.0, 0.0), step(f0.y, f0.x));
      let i1: vec2f = i0 + o1;
      let i2: vec2f = i0 + vec2f(1.0);
      let v0: vec2f = vec2f(i0.x - i0.y * 0.5, i0.y);
      let v1: vec2f = v0 + vec2f(o1.x - o1.y * 0.5, o1.y);
      let v2: vec2f = v0 + vec2f(0.5, 1.0);
      let x0: vec2f = p - v0;
      let x1: vec2f = p - v1;
      let x2: vec2f = p - v2;
      let iu: vec3f = vec3f(i0.x, i1.x, i2.x);
      let iv: vec3f = vec3f(i0.y, i1.y, i2.y);
      let h0: vec3f = mod289(iu);
      let h1: vec3f = mod289((h0 * 51.0 + vec3f(2.0)) * h0 + iv);
      let hash: vec3f = mod289((h1 * 34.0 + vec3f(10.0)) * h1);
      let psi: vec3f = hash * 0.07482 + vec3f(angle);
      let gx: vec3f = cos(psi);
      let gy: vec3f = sin(psi);
      let w: vec3f = max(vec3f(0.8) - vec3f(dot(x0,x0), dot(x1,x1), dot(x2,x2)), vec3f(0.0));
      let w2: vec3f = w * w;
      let gdotx: vec3f = vec3f(dot(vec2f(gx.x,gy.x),x0), dot(vec2f(gx.y,gy.y),x1), dot(vec2f(gx.z,gy.z),x2));
      return 10.9 * dot(w2 * w2, gdotx);
    }
    fn deform(p: vec2f, elapsed: f32) -> vec3f {
      // Fixed spatial samples evolve in place; warped wave fronts ripple
      // through the surface without translating the whole noise field.
      // Slow only idle deformation; cursor waves and easing use real time.
      let t: f32 = elapsed * 0.4;
      let q: vec2f = p * 0.0032;
      let broad: f32 = flowNoise(q, t * 0.48);
      let middle: f32 = flowNoise(q * 2.0 + vec2f(13.1, 7.7), -t * 0.61);
      let warp: vec2f = vec2f(broad, middle);
      let fine: f32 = flowNoise(q * 4.0 + warp * 0.55 + vec2f(3.4, 19.2), t * 0.73);
      let wave: f32 = sin(length(q + vec2f(2.3, -1.7)) * 5.0 + broad * 2.4 - t * 1.35);
      let z: f32 = broad * 58.0 + middle * 30.0 + fine * 14.0 + wave * 22.0;
      return vec3f(p + warp * 9.0, z);
    }
    fn shade(a: vec3f, b: vec3f, c: vec3f, mouse: vec4f) -> f32 {
      let raw: vec3f = normalize(cross(b - a, c - a));
      let normal: vec3f = raw * sign(raw.z);
      let center: vec3f = (a + b + c) / 3.0;
      let baseLight: vec3f = normalize(vec3f(-0.5, -0.6, 0.7));
      // A soft, offset light reveals the changing orientation of repelled faces.
      let cursorLight: vec3f = normalize(vec3f(mouse.xy + vec2f(-100.0, -140.0), 220.0) - center);
      let projected: vec2f = vec2f(center.x, center.y + center.z * 0.32);
      let proximity: f32 = (1.0 - smoothstep(0.0, 420.0, length(projected - mouse.xy))) * mouse.z;
      let direction: vec3f = normalize(mix(baseLight, cursorLight, proximity * 0.85));
      let light: f32 = max(0.0, dot(normal, direction));
      // Broader continuous contrast near the cursor, with no quantized tones.
      let low: f32 = mix(0.72, 0.58, proximity);
      let faceLight: f32 = mix(low, 0.985, smoothstep(0.20, 0.98, light));
      // Stylized cavity shading makes the depressed center read as recessed,
      // while multiplication preserves differences between adjacent faces.
      let cavity: f32 = (1.0 - smoothstep(0.0, 250.0, length(projected - mouse.xy))) * mouse.z;
      return faceLight * (1.0 - cavity * 0.34);
    }
    fn project(p: vec3f, viewport: vec2f) -> vec2f {
      return vec2f(p.x, p.y + p.z * 0.32) / viewport * vec2f(2.0, -2.0) + vec2f(-1.0, 1.0);
    }
  `;
  const interaction = `
    fn influence(p: vec3f, mouse: vec4f, t: f32) -> vec3f {
      // Repel the already animated surface, retaining its original height field.
      // Measure from the projected position so the response sits under the cursor.
      let delta: vec2f = vec2f(p.x, p.y + p.z * 0.32) - mouse.xy;
      let radius: f32 = length(delta);
      let core: f32 = (1.0 - smoothstep(0.0, 250.0, radius)) * mouse.z;
      // Negative height presses the surface away from the viewer. Preserve the
      // ambient noise underneath, then radiate waves beyond the depressed area.
      let ring: f32 = smoothstep(20.0, 80.0, radius)
        * (1.0 - smoothstep(190.0, 440.0, radius)) * mouse.z;
      // Constant phase moves outward at 62.5 CSS pixels/second, even at rest.
      let ripple: f32 = sin(radius * 0.032 - t * 2.0 + p.z * 0.008);
      let outward: vec2f = delta / max(radius, 1.0);
      let drift: vec2f = delta * core * 0.12 + outward * ring * (3.0 + 3.0 * ripple);
      return vec3f(p.xy + drift, p.z - core * 65.0 + ring * ripple * 18.0);
    }
  `;
  function draw() {
    if (renderer && vertices) {
      uniforms[2] = time; renderer.draw();
    }
  }
  function tick(now) {
    frame = 0;
    if (paused || hidden || !renderer) return;
    // Advance by elapsed time on every callback, independently of drawing.
    // Browsers can change rAF cadence after startup (power saving, display moves,
    // inspector docking). Counting callbacks would change the animation's speed.
    if (last !== null) time += (now - last) / 1000;
    updatePointer(last === null ? 0 : (now - last) / 1000);
    last = now;
    if (nextFrame === null) nextFrame = now;
    if (now + 0.5 >= nextFrame) {
      draw();
      // Skip expired slots while preserving the original 60 Hz phase.
      // Resetting to now + interval after a late callback can also skip the
      // next healthy callback, adding a second hitch to the original delay.
      const slots = Math.floor((now + 0.5 - nextFrame) / frameInterval) + 1;
      nextFrame += slots * frameInterval;
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = null; nextFrame = null;
    if (!paused && !hidden && renderer) frame = requestAnimationFrame(tick);
  }
  async function webgpu() {
    const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'low-power' });
    if (!adapter) throw Error('No WebGPU adapter');
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    if (!context) { device.destroy(); throw Error('No WebGPU context'); }
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });
    const shader = device.createShaderModule({ code: `
      struct Uniforms { view: vec4f, pointer: vec4f }
      @group(0) @binding(0) var<uniform> settings: Uniforms;
      ${math}
      ${interaction}
      struct Output {
        @builtin(position) position: vec4f,
        @location(0) bary: vec3f,
        @location(1) @interpolate(flat) tone: f32
      }
      @vertex fn vs(@location(0) pa: vec2f, @location(1) pb: vec2f,
        @location(2) pc: vec2f, @location(3) bary: vec3f) -> Output {
        let u = settings.view;
        let a = influence(deform(pa, u.z), settings.pointer, u.z);
        let b = influence(deform(pb, u.z), settings.pointer, u.z);
        let c = influence(deform(pc, u.z), settings.pointer, u.z);
        let p = a * bary.x + b * bary.y + c * bary.z;
        var out: Output;
        out.position = vec4f(project(p, u.xy), 0.0, 1.0);
        out.bary = bary; out.tone = shade(a,b,c,settings.pointer); return out;
      }
      @fragment fn fs(in: Output) -> @location(0) vec4f {
        let u = settings.view;
        // Euclidean derivatives keep diagonal and upright lines equally wide.
        let dx = dpdx(in.bary); let dy = dpdy(in.bary);
        let distance = in.bary / max(sqrt(dx * dx + dy * dy), vec3f(0.00001));
        let edge = min(distance.x, min(distance.y, distance.z));
        // Filter across a full render pixel even when the canvas is downscaled.
        let halfWidth = max(0.55 * u.w, 0.5);
        let coverage = clamp(edge - halfWidth + 0.5, 0.0, 1.0);
        let tone = mix(0.32, in.tone, coverage);
        let wash = 0.78 * (1.0 - smoothstep(0.0, 0.75, in.position.x / (u.x * u.w)));
        let color = mix(vec3f(tone, tone, tone * 0.986), vec3f(0.980, 0.976, 0.965), wash);
        return vec4f(color, 1.0);
      }
    ` });
    const pipeline = await device.createRenderPipelineAsync({ layout: 'auto',
      vertex: { module: shader, entryPoint: 'vs', buffers: [{ arrayStride: 36, attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x2' }, { shaderLocation: 1, offset: 8, format: 'float32x2' },
        { shaderLocation: 2, offset: 16, format: 'float32x2' }, { shaderLocation: 3, offset: 24, format: 'float32x3' }] }] },
      fragment: { module: shader, entryPoint: 'fs', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
    const uniformBuffer = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniformBuffer } }] });
    let buffer;
    device.lost.then(() => { if (!disposed) fallback(); });
    return { dispose() { device.destroy(); }, resize() {
      buffer?.destroy(); buffer = device.createBuffer({ size: vertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(buffer, 0, vertices);
    }, draw() {
      device.queue.writeBuffer(uniformBuffer, 0, uniforms);
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(),
        clearValue: { r: .96, g: .96, b: .95, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
      pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup); pass.setVertexBuffer(0,buffer);
      pass.draw(vertices.length/9); pass.end(); device.queue.submit([encoder.finish()]);
    } };
  }
  function webgl() {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power' });
    if (!gl) throw Error('No WebGL2 context');
    const glslMath = (math + interaction).replace(/fn (\w+)\(([^)]*)\) -> (\w+)/g, (_, name, args, result) =>
      `${result} ${name}(${args.replace(/(\w+): (\w+)/g, '$2 $1')})`)
      .replace(/let (\w+): (\w+) =/g, '$2 $1 =').replace(/vec2f/g, 'vec2').replace(/vec3f/g, 'vec3').replace(/vec4f/g, 'vec4').replace(/f32/g, 'float');
    function compile(type, source) {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, `#version 300 es
      precision highp float;
      in vec2 pa; in vec2 pb; in vec2 pc; in vec3 bary;
      uniform vec4 u; uniform vec4 mouse; out vec3 vBary; flat out float vTone;
      ${glslMath}
      void main() {
        vec3 a = influence(deform(pa,u.z),mouse,u.z), b = influence(deform(pb,u.z),mouse,u.z), c = influence(deform(pc,u.z),mouse,u.z);
        gl_Position = vec4(project(a*bary.x+b*bary.y+c*bary.z,u.xy),0.,1.);
        vBary = bary; vTone = shade(a,b,c,mouse);
      }`));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      uniform vec4 u; in vec3 vBary; flat in float vTone; out vec4 color;
      void main() {
        vec3 dx = dFdx(vBary), dy = dFdy(vBary);
        vec3 distance = vBary / max(sqrt(dx*dx+dy*dy),vec3(.00001));
        float edge = min(distance.x,min(distance.y,distance.z));
        float coverage = clamp(edge-max(.55*u.w,.5)+.5,0.,1.);
        float tone = mix(.32,vTone,coverage);
        float wash = .78 * (1. - smoothstep(0.,.75,gl_FragCoord.x/(u.x*u.w)));
        color = vec4(mix(vec3(tone,tone,tone*.986),vec3(.980,.976,.965),wash),1.);
      }`));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
    for (const [name,size,offset] of [['pa',2,0],['pb',2,8],['pc',2,16],['bary',3,24]]) {
      const location = gl.getAttribLocation(program,name); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location,size,gl.FLOAT,false,36,offset);
    }
    const uniformLocation = gl.getUniformLocation(program,'u');
    const pointerLocation = gl.getUniformLocation(program,'mouse');
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); renderer = null; sync(); });
    canvas.addEventListener('webglcontextrestored', () => { if (!disposed) fallback(); });
    return { resize() { gl.viewport(0,0,canvas.width,canvas.height); gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW); }, draw() {
      gl.uniform4fv(uniformLocation,viewUniforms); gl.uniform4fv(pointerLocation,pointerUniforms); gl.clearColor(.96,.96,.95,1); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES,0,vertices.length/9);
    } };
  }

  function fallback() {
    cancelAnimationFrame(frame); renderer = null;
    report({type: 'retry', mode: 'webgl'});
  }
  function ready(result, kind) {
    if (disposed) { result.dispose?.(); return; }
    renderer = result; resize(); sync(); report({type: 'ready', renderer: kind});
  }
  resize();
  // Defer even the synchronous backend so the main-thread bridge receives its handle first.
  Promise.resolve().then(() => {
    if (disposed) return;
    if (initial.mode === 'webgl') {
      try { ready(webgl(), 'webgl2'); } catch (error) { console.warn('Background WebGL initialization failed:', error); report({type: 'unavailable'}); }
    } else webgpu().then(result => ready(result, 'webgpu')).catch(fallback);
  });
  return {
    pointer(x, y, active) {
      if (paused || hidden) return;
      if (targetStrength === 0 && uniforms[6] < 0.001) { uniforms[4] = x; uniforms[5] = y; }
      targetX = x; targetY = y; targetStrength = active ? 1 : 0;
    },
    resize(next) { viewport = next; resize(); },
    state(nextPaused, nextHidden) { paused = nextPaused; hidden = nextHidden;
      if (paused || hidden) { targetStrength = 0; uniforms[6] = 0; }
      sync();
      if (paused && !hidden) draw(); },
    dispose() { disposed = true; cancelAnimationFrame(frame); renderer?.dispose?.(); }
  };
  }
})();
