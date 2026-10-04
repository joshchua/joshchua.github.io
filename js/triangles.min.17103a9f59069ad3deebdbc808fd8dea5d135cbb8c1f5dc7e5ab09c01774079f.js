(()=>{"use strict";if(typeof document=="undefined"){let e;self.onmessage=({data:t})=>{if(t.type==="init"){if(typeof requestAnimationFrame!="function"){self.postMessage({type:"retry",mode:"main"});return}e=f(t.canvas,t.options,e=>self.postMessage(e))}else t.type==="resize"?e?.resize(t.viewport):t.type==="state"?e?.state(t.paused,t.hidden):t.type==="pointer"&&e?.pointer(t.x,t.y,t.active)};return}const p=document.currentScript.src,r=matchMedia("(prefers-reduced-motion: reduce)");let t=document.querySelector("#triangles"),i=r.matches,e,n;const a=()=>({width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio||1});function s(o,r=!0){e?.terminate(),e=null,n?.dispose(),n=null;const c=t.cloneNode();t.replaceWith(c),t=c,t.hidden=!1;const l={...a(),paused:i,hidden:document.hidden,mode:o},d=n=>{n.type==="ready"?(t.dataset.renderer=n.renderer,t.dataset.animation="noise",t.dataset.pacing="60fps",t.dataset.execution=e?"worker":"main"):n.type==="retry"?n.mode==="main"?s(o,!1):s("webgl",r):n.type==="unavailable"&&(t.hidden=!0)};if(r&&typeof Worker!="undefined"&&t.transferControlToOffscreen)try{e=new Worker(p),e.onmessage=({data:e})=>d(e),e.onerror=e=>{e.preventDefault(),s(o,!1)};const n=t.transferControlToOffscreen();e.postMessage({type:"init",canvas:n,options:l},[n]);return}catch{e?.terminate(),e=null,s(o,!1);return}n=f(t,l,d)}function u(){const t=document.hidden;e?e.postMessage({type:"state",paused:i,hidden:t}):n?.state(i,t)}r.addEventListener("change",()=>{i=r.matches,u()}),document.addEventListener("visibilitychange",u),window.addEventListener("resize",()=>{e?e.postMessage({type:"resize",viewport:a()}):n?.resize(a())});let c=null,l=innerWidth/2,d=innerHeight/2,o=!1;function h(){if(c!==null)return;c=requestAnimationFrame(()=>{c=null,e?e.postMessage({type:"pointer",x:l,y:d,active:o}):n?.pointer(l,d,o)})}window.addEventListener("pointermove",e=>{if(e.pointerType==="touch")return;l=e.clientX,d=e.clientY,o=!0,h()},{passive:!0});function m(){o=!1,h()}document.documentElement.addEventListener("pointerleave",m),window.addEventListener("blur",m),s("webgpu");function g(e){const n=Math.max(1,e.width),s=Math.max(1,e.height),t=Math.min(e.pixelRatio||1,.75,(5e5/(n*s))**.5);return{width:Math.max(1,Math.floor(n*t)),height:Math.max(1,Math.floor(s*t)),ratio:t}}function f(e,t,n){let h=t,c=t.paused,d=t.hidden,u=!1,o,a=0,l=null,O=0,r=null;const A=1e3/60;let i,f,v;const s=new Float32Array(8),T=s.subarray(0,4),F=s.subarray(4);let y=t.width/2,_=t.height/2,m=0;s[4]=y,s[5]=_;function M(e){const t=1-Math.exp(-Math.min(e,.1)*9);s[4]+=(y-s[4])*t,s[5]+=(_-s[5])*t,s[6]+=(m-s[6])*t}const x=(e,t)=>{const n=Math.sin(e*127.1+t*311.7)*43758.5453;return n-Math.floor(n)};function p(){f=h.width,v=h.height;const a=g(h),u=a.ratio;e.width=a.width,e.height=a.height;const t=Math.max(90,Math.min(155,f/11)),c=Math.ceil(v/(t*.866))+4,n=Math.ceil(f/t)+4,l=[],r=[];for(let e=0;e<c;e++)for(let s=0;s<n;s++)l.push([(s-1.5+e%2*.5+(x(s,e)-.5)*.55)*t,(e-1.5+(x(e+17,s)-.5)*.5)*t*.866]);for(let e=0;e<c-1;e++)for(let o=0;o<n-1;o++){const t=e*n+o,i=t+1,s=t+n,a=s+1;r.push(...e%2?[[t,i,a],[t,a,s]]:[[t,i,s],[i,a,s]])}i=new Float32Array(r.length*3*9);let d=0;for(const e of r)for(let t=0;t<3;t++){for(const t of e)for(const e of l[t])i[d++]=e;for(let e=0;e<3;e++)i[d++]=Number(e===t)}s[0]=f,s[1]=v,s[3]=u,o?.resize(),j()}const C=`
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
  `,E=`
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
  `;function j(){o&&i&&(s[2]=O,o.draw())}function k(e){if(a=0,c||d||!o)return;if(l!==null&&(O+=(e-l)/1e3),M(l===null?0:(e-l)/1e3),l=e,r===null&&(r=e),e+.5>=r){j();const t=Math.floor((e+.5-r)/A)+1;r+=t*A}a=requestAnimationFrame(k)}function b(){cancelAnimationFrame(a),a=0,l=null,r=null,!c&&!d&&o&&(a=requestAnimationFrame(k))}async function z(){const a=await navigator.gpu?.requestAdapter({powerPreference:"low-power"});if(!a)throw Error("No WebGPU adapter");const t=await a.requestDevice(),o=e.getContext("webgpu");if(!o)throw t.destroy(),Error("No WebGPU context");const r=navigator.gpu.getPreferredCanvasFormat();o.configure({device:t,format:r,alphaMode:"opaque"});const c=t.createShaderModule({code:`
      struct Uniforms { view: vec4f, pointer: vec4f }
      @group(0) @binding(0) var<uniform> settings: Uniforms;
      ${C}
      ${E}
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
    `}),l=await t.createRenderPipelineAsync({layout:"auto",vertex:{module:c,entryPoint:"vs",buffers:[{arrayStride:36,attributes:[{shaderLocation:0,offset:0,format:"float32x2"},{shaderLocation:1,offset:8,format:"float32x2"},{shaderLocation:2,offset:16,format:"float32x2"},{shaderLocation:3,offset:24,format:"float32x3"}]}]},fragment:{module:c,entryPoint:"fs",targets:[{format:r}]},primitive:{topology:"triangle-list"}}),d=t.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),h=t.createBindGroup({layout:l.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:d}}]});let n;return t.lost.then(()=>{u||w()}),{dispose(){t.destroy()},resize(){n?.destroy(),n=t.createBuffer({size:i.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),t.queue.writeBuffer(n,0,i)},draw(){t.queue.writeBuffer(d,0,s);const a=t.createCommandEncoder(),e=a.beginRenderPass({colorAttachments:[{view:o.getCurrentTexture().createView(),clearValue:{r:.96,g:.96,b:.95,a:1},loadOp:"clear",storeOp:"store"}]});e.setPipeline(l),e.setBindGroup(0,h),e.setVertexBuffer(0,n),e.draw(i.length/9),e.end(),t.queue.submit([a.finish()])}}}function D(){const t=e.getContext("webgl2",{alpha:!1,antialias:!1,powerPreference:"low-power"});if(!t)throw Error("No WebGL2 context");const a=(C+E).replace(/fn (\w+)\(([^)]*)\) -> (\w+)/g,(e,t,n,s)=>`${s} ${t}(${n.replace(/(\w+): (\w+)/g,"$2 $1")})`).replace(/let (\w+): (\w+) =/g,"$2 $1 =").replace(/vec2f/g,"vec2").replace(/vec3f/g,"vec3").replace(/vec4f/g,"vec4").replace(/f32/g,"float");function s(e,n){const s=t.createShader(e);if(t.shaderSource(s,n),t.compileShader(s),!t.getShaderParameter(s,t.COMPILE_STATUS))throw Error(t.getShaderInfoLog(s));return s}const n=t.createProgram();if(t.attachShader(n,s(t.VERTEX_SHADER,`#version 300 es
      precision highp float;
      in vec2 pa; in vec2 pb; in vec2 pc; in vec3 bary;
      uniform vec4 u; uniform vec4 mouse; out vec3 vBary; flat out float vTone;
      ${a}
      void main() {
        vec3 a = influence(deform(pa,u.z),mouse,u.z), b = influence(deform(pb,u.z),mouse,u.z), c = influence(deform(pc,u.z),mouse,u.z);
        gl_Position = vec4(project(a*bary.x+b*bary.y+c*bary.z,u.xy),0.,1.);
        vBary = bary; vTone = shade(a,b,c,mouse);
      }`)),t.attachShader(n,s(t.FRAGMENT_SHADER,`#version 300 es
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
      }`)),t.linkProgram(n),!t.getProgramParameter(n,t.LINK_STATUS))throw Error(t.getProgramInfoLog(n));t.useProgram(n),t.bindBuffer(t.ARRAY_BUFFER,t.createBuffer());for(const[s,o,i]of[["pa",2,0],["pb",2,8],["pc",2,16],["bary",3,24]]){const e=t.getAttribLocation(n,s);t.enableVertexAttribArray(e),t.vertexAttribPointer(e,o,t.FLOAT,!1,36,i)}const r=t.getUniformLocation(n,"u"),c=t.getUniformLocation(n,"mouse");return e.addEventListener("webglcontextlost",e=>{e.preventDefault(),o=null,b()}),e.addEventListener("webglcontextrestored",()=>{u||w()}),{resize(){t.viewport(0,0,e.width,e.height),t.bufferData(t.ARRAY_BUFFER,i,t.STATIC_DRAW)},draw(){t.uniform4fv(r,T),t.uniform4fv(c,F),t.clearColor(.96,.96,.95,1),t.clear(t.COLOR_BUFFER_BIT),t.drawArrays(t.TRIANGLES,0,i.length/9)}}}function w(){cancelAnimationFrame(a),o=null,n({type:"retry",mode:"webgl"})}function S(e,t){if(u){e.dispose?.();return}o=e,p(),b(),n({type:"ready",renderer:t})}return p(),Promise.resolve().then(()=>{if(u)return;if(t.mode==="webgl")try{S(D(),"webgl2")}catch(e){console.warn("Background WebGL initialization failed:",e),n({type:"unavailable"})}else z().then(e=>S(e,"webgpu")).catch(w)}),{pointer(e,t,n){if(c||d)return;m===0&&s[6]<.001&&(s[4]=e,s[5]=t),y=e,_=t,m=n?1:0},resize(e){h=e,p()},state(e,t){c=e,d=t,(c||d)&&(m=0,s[6]=0),b(),c&&!d&&j()},dispose(){u=!0,cancelAnimationFrame(a),o?.dispose?.()}}}})()