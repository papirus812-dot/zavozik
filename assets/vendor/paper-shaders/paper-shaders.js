/*! @paper-design/shaders 0.0.46 (MIT) - https://github.com/paper-design/shaders - original ShaderMount + LiquidMetal, bundled unmodified for a no-build site. See LICENSE. */
var PaperShaders = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // ../../AppData/Local/Temp/claude/C--Users-------Desktop-website/66aca196-f321-4b64-99ef-4b39eee5da90/scratchpad/ref/entry.mjs
  var entry_exports = {};
  __export(entry_exports, {
    LiquidMetalShapes: () => LiquidMetalShapes,
    ShaderFitOptions: () => ShaderFitOptions,
    ShaderMount: () => ShaderMount,
    defaultObjectSizing: () => defaultObjectSizing,
    getShaderColorFromString: () => getShaderColorFromString,
    liquidMetalFragmentShader: () => liquidMetalFragmentShader
  });

  // ../../AppData/Local/Temp/claude/C--Users-------Desktop-website/66aca196-f321-4b64-99ef-4b39eee5da90/scratchpad/ref/paper-design-shaders-0.0.46/package/dist/vertex-shader.js
  var vertexShaderSource = `#version 300 es
precision mediump float;

layout(location = 0) in vec4 a_position;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_imageAspectRatio;

uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;

uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

uniform float u_pxSize;

out vec2 v_objectUV;
out vec2 v_objectBoxSize;
out vec2 v_objectHelperBox;

out vec2 v_responsiveUV;
out vec2 v_responsiveBoxSize;
out vec2 v_responsiveHelperBox;
out vec2 v_responsiveBoxGivenSize;

out vec2 v_patternUV;
out vec2 v_patternBoxSize;
out vec2 v_patternHelperBox;

out vec2 v_imageUV;

// #define ADD_HELPERS

vec3 getBoxSize(float boxRatio, vec2 givenBoxSize, vec2 maxBoxSize) {
  vec2 box = vec2(0.);
  // fit = none
  box.x = boxRatio * min(givenBoxSize.x / boxRatio, givenBoxSize.y);
  float noFitBoxWidth = box.x;
  if (u_fit == 1.) { // fit = contain
    box.x = boxRatio * min(maxBoxSize[0] / boxRatio, maxBoxSize[1]);
  } else if (u_fit == 2.) { // fit = cover
    box.x = boxRatio * max(maxBoxSize[0] / boxRatio, maxBoxSize[1]);
  }
  box.y = box.x / boxRatio;
  return vec3(box, noFitBoxWidth);
}

void main() {
  gl_Position = a_position;

  vec2 uv = gl_Position.xy * .5;
  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
  givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
  vec2 maxBoxSize = vec2(max(u_resolution.x, givenBoxSize.x), max(u_resolution.y, givenBoxSize.y));
  float r = u_rotation * 3.14159265358979323846 / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);


  // ===================================================
  // Sizing api for graphic objects with fixed ratio
  // (currently supports only ratio = 1)

  float fixedRatio = 1.;
  vec2 fixedRatioBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );

  v_objectBoxSize = getBoxSize(fixedRatio, fixedRatioBoxGivenSize, maxBoxSize).xy;
  vec2 objectWorldScale = u_resolution.xy / v_objectBoxSize;

  #ifdef ADD_HELPERS
  v_objectHelperBox = uv;
  v_objectHelperBox *= objectWorldScale;
  v_objectHelperBox += boxOrigin * (objectWorldScale - 1.);
  #endif

  v_objectUV = uv;
  v_objectUV *= objectWorldScale;
  v_objectUV += boxOrigin * (objectWorldScale - 1.);
  v_objectUV += graphicOffset;
  v_objectUV /= u_scale;
  v_objectUV = graphicRotation * v_objectUV;


  // ===================================================


  // ===================================================
  // Sizing api for graphic objects with either givenBoxSize ratio or canvas ratio.
  // Full-screen mode available with u_worldWidth = u_worldHeight = 0

  v_responsiveBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  float responsiveRatio = v_responsiveBoxGivenSize.x / v_responsiveBoxGivenSize.y;
  v_responsiveBoxSize = getBoxSize(responsiveRatio, v_responsiveBoxGivenSize, maxBoxSize).xy;
  vec2 responsiveBoxScale = u_resolution.xy / v_responsiveBoxSize;

  #ifdef ADD_HELPERS
  v_responsiveHelperBox = uv;
  v_responsiveHelperBox *= responsiveBoxScale;
  v_responsiveHelperBox += boxOrigin * (responsiveBoxScale - 1.);
  #endif

  v_responsiveUV = uv;
  v_responsiveUV *= responsiveBoxScale;
  v_responsiveUV += boxOrigin * (responsiveBoxScale - 1.);
  v_responsiveUV += graphicOffset;
  v_responsiveUV /= u_scale;
  v_responsiveUV.x *= responsiveRatio;
  v_responsiveUV = graphicRotation * v_responsiveUV;
  v_responsiveUV.x /= responsiveRatio;

  // ===================================================


  // ===================================================
  // Sizing api for patterns
  // (treating graphics as a image u_worldWidth x u_worldHeight size)

  float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
  vec2 patternBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  patternBoxRatio = patternBoxGivenSize.x / patternBoxGivenSize.y;

  vec3 boxSizeData = getBoxSize(patternBoxRatio, patternBoxGivenSize, maxBoxSize);
  v_patternBoxSize = boxSizeData.xy;
  float patternBoxNoFitBoxWidth = boxSizeData.z;
  vec2 patternBoxScale = u_resolution.xy / v_patternBoxSize;

  #ifdef ADD_HELPERS
  v_patternHelperBox = uv;
  v_patternHelperBox *= patternBoxScale;
  v_patternHelperBox += boxOrigin * (patternBoxScale - 1.);
  #endif

  v_patternUV = uv;
  v_patternUV += graphicOffset / patternBoxScale;
  v_patternUV += boxOrigin;
  v_patternUV -= boxOrigin / patternBoxScale;
  v_patternUV *= u_resolution.xy;
  v_patternUV /= u_pixelRatio;
  if (u_fit > 0.) {
    v_patternUV *= (patternBoxNoFitBoxWidth / v_patternBoxSize.x);
  }
  v_patternUV /= u_scale;
  v_patternUV = graphicRotation * v_patternUV;
  v_patternUV += boxOrigin / patternBoxScale;
  v_patternUV -= boxOrigin;
  // x100 is a default multiplier between vertex and fragmant shaders
  // we use it to avoid UV presision issues
  v_patternUV *= .01;

  // ===================================================


  // ===================================================
  // Sizing api for images

  vec2 imageBoxSize;
  if (u_fit == 1.) { // contain
    imageBoxSize.x = min(maxBoxSize.x / u_imageAspectRatio, maxBoxSize.y) * u_imageAspectRatio;
  } else if (u_fit == 2.) { // cover
    imageBoxSize.x = max(maxBoxSize.x / u_imageAspectRatio, maxBoxSize.y) * u_imageAspectRatio;
  } else {
    imageBoxSize.x = min(10.0, 10.0 / u_imageAspectRatio * u_imageAspectRatio);
  }
  imageBoxSize.y = imageBoxSize.x / u_imageAspectRatio;
  vec2 imageBoxScale = u_resolution.xy / imageBoxSize;

  #ifdef ADD_HELPERS
  vec2 imageHelperBox = uv;
  imageHelperBox *= imageBoxScale;
  imageHelperBox += boxOrigin * (imageBoxScale - 1.);
  #endif

  v_imageUV = uv;
  v_imageUV *= imageBoxScale;
  v_imageUV += boxOrigin * (imageBoxScale - 1.);
  v_imageUV += graphicOffset;
  v_imageUV /= u_scale;
  v_imageUV.x *= u_imageAspectRatio;
  v_imageUV = graphicRotation * v_imageUV;
  v_imageUV.x /= u_imageAspectRatio;

  v_imageUV += .5;
  v_imageUV.y = 1. - v_imageUV.y;

  // ===================================================

}`;

  // ../../AppData/Local/Temp/claude/C--Users-------Desktop-website/66aca196-f321-4b64-99ef-4b39eee5da90/scratchpad/ref/paper-design-shaders-0.0.46/package/dist/shader-mount.js
  var DEFAULT_MAX_PIXEL_COUNT = 1920 * 1080 * 4;
  var ShaderMount = class {
    constructor(parentElement, fragmentShader, uniforms, webGlContextAttributes, speed = 0, frame = 0, minPixelRatio = 2, maxPixelCount = DEFAULT_MAX_PIXEL_COUNT) {
      __publicField(this, "parentElement");
      __publicField(this, "canvasElement");
      __publicField(this, "gl");
      __publicField(this, "program", null);
      __publicField(this, "uniformLocations", {});
      /** The fragment shader that we are using */
      __publicField(this, "fragmentShader");
      /** Stores the RAF for the render loop */
      __publicField(this, "rafId", null);
      /** Time of the last rendered frame */
      __publicField(this, "lastRenderTime", 0);
      /** Total time that we have played any animation, passed as a uniform to the shader for time-based VFX */
      __publicField(this, "currentFrame", 0);
      /** The current speed that we progress through animation time (multiplies by delta time every update). Allows negatives to play in reverse. If set to 0, rAF will stop entirely so static shaders have no recurring performance costs */
      __publicField(this, "speed", 0);
      /** Uniforms that are provided by the user for the specific shader being mounted (not including uniforms that this Mount adds, like time and resolution) */
      __publicField(this, "providedUniforms");
      /** Just a sanity check to make sure frames don't run after we're disposed */
      __publicField(this, "hasBeenDisposed", false);
      /** If the resolution of the canvas has changed since the last render */
      __publicField(this, "resolutionChanged", true);
      /** Store textures that are provided by the user */
      __publicField(this, "textures", /* @__PURE__ */ new Map());
      __publicField(this, "minPixelRatio");
      __publicField(this, "maxPixelCount");
      __publicField(this, "isSafari", isSafari());
      __publicField(this, "uniformCache", {});
      __publicField(this, "textureUnitMap", /* @__PURE__ */ new Map());
      __publicField(this, "initProgram", () => {
        const program = createProgram(this.gl, vertexShaderSource, this.fragmentShader);
        if (!program) return;
        this.program = program;
      });
      __publicField(this, "setupPositionAttribute", () => {
        const positionAttributeLocation = this.gl.getAttribLocation(this.program, "a_position");
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        const positions = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(positionAttributeLocation);
        this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
      });
      __publicField(this, "setupUniforms", () => {
        const uniformLocations = {
          u_time: this.gl.getUniformLocation(this.program, "u_time"),
          u_pixelRatio: this.gl.getUniformLocation(this.program, "u_pixelRatio"),
          u_resolution: this.gl.getUniformLocation(this.program, "u_resolution")
        };
        Object.entries(this.providedUniforms).forEach(([key, value]) => {
          uniformLocations[key] = this.gl.getUniformLocation(this.program, key);
          if (value instanceof HTMLImageElement) {
            const aspectRatioUniformName = `${key}AspectRatio`;
            uniformLocations[aspectRatioUniformName] = this.gl.getUniformLocation(this.program, aspectRatioUniformName);
          }
        });
        this.uniformLocations = uniformLocations;
      });
      /**
       * The scale that we should render at.
       * - Used to target 2x rendering even on 1x screens for better antialiasing
       * - Prevents the virtual resolution from going beyond the maximum resolution
       * - Accounts for the page zoom level so we render in physical device pixels rather than CSS pixels
       */
      __publicField(this, "renderScale", 1);
      __publicField(this, "parentWidth", 0);
      __publicField(this, "parentHeight", 0);
      __publicField(this, "resizeObserver", null);
      __publicField(this, "setupResizeObserver", () => {
        this.resizeObserver = new ResizeObserver(([entry]) => {
          if (entry?.borderBoxSize[0]) {
            this.parentWidth = entry.borderBoxSize[0].inlineSize;
            this.parentHeight = entry.borderBoxSize[0].blockSize;
          }
          this.handleResize();
        });
        this.resizeObserver.observe(this.parentElement);
        visualViewport?.addEventListener("resize", this.handleVisualViewportChange);
        const rect = this.parentElement.getBoundingClientRect();
        this.parentWidth = rect.width;
        this.parentHeight = rect.height;
        this.handleResize();
      });
      // Visual viewport resize handler, mainly used to react to browser zoom changes.
      // Wait 2 frames to align with when the resize observer callback is done (in case it might follow):
      // - Frame 1: a paint after the visual viewport resize
      // - Frame 2: a paint after the resize observer has been handled, if it was ever triggered
      //
      // Both resize observer and visual viewport will react to classic browser zoom changes,
      // so we dedupe the callbacks, but pinch zoom only triggers the visual viewport handler.
      __publicField(this, "resizeRafId", null);
      __publicField(this, "handleVisualViewportChange", () => {
        if (this.resizeRafId !== null) {
          cancelAnimationFrame(this.resizeRafId);
        }
        this.resizeRafId = requestAnimationFrame(() => {
          this.resizeRafId = requestAnimationFrame(() => {
            this.handleResize();
          });
        });
      });
      /** Resize handler for when the container div changes size or the max pixel count changes and we want to resize our canvas to match */
      __publicField(this, "handleResize", () => {
        if (this.resizeRafId !== null) {
          cancelAnimationFrame(this.resizeRafId);
        }
        const pinchZoom = visualViewport?.scale ?? 1;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        const innerWidth = visualViewport ? visualViewport.scale * visualViewport.width + scrollbarWidth : window.innerWidth;
        const classicZoom = Math.round(1e4 * window.outerWidth / innerWidth) / 1e4;
        const realPixelRatio = this.isSafari ? devicePixelRatio : devicePixelRatio / classicZoom;
        const targetPixelRatio = Math.max(realPixelRatio, this.minPixelRatio);
        const targetRenderScale = targetPixelRatio * classicZoom * pinchZoom;
        const targetPixelWidth = this.parentWidth * targetRenderScale;
        const targetPixelHeight = this.parentHeight * targetRenderScale;
        const maxPixelCountHeadroom = Math.sqrt(this.maxPixelCount) / Math.sqrt(targetPixelWidth * targetPixelHeight);
        const newRenderScale = targetRenderScale * Math.min(1, maxPixelCountHeadroom);
        const newWidth = Math.round(this.parentWidth * newRenderScale);
        const newHeight = Math.round(this.parentHeight * newRenderScale);
        if (this.canvasElement.width !== newWidth || this.canvasElement.height !== newHeight || this.renderScale !== newRenderScale) {
          this.renderScale = newRenderScale;
          this.canvasElement.width = newWidth;
          this.canvasElement.height = newHeight;
          this.resolutionChanged = true;
          this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
          this.render(performance.now());
        }
      });
      __publicField(this, "render", (currentTime) => {
        if (this.hasBeenDisposed) return;
        if (this.program === null) {
          console.warn("Tried to render before program or gl was initialized");
          return;
        }
        const dt = currentTime - this.lastRenderTime;
        this.lastRenderTime = currentTime;
        if (this.speed !== 0) {
          this.currentFrame += dt * this.speed;
        }
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.useProgram(this.program);
        this.gl.uniform1f(this.uniformLocations.u_time, this.currentFrame * 1e-3);
        if (this.resolutionChanged) {
          this.gl.uniform2f(this.uniformLocations.u_resolution, this.gl.canvas.width, this.gl.canvas.height);
          this.gl.uniform1f(this.uniformLocations.u_pixelRatio, this.renderScale);
          this.resolutionChanged = false;
        }
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
        if (this.speed !== 0) {
          this.requestRender();
        } else {
          this.rafId = null;
        }
      });
      __publicField(this, "requestRender", () => {
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
        }
        this.rafId = requestAnimationFrame(this.render);
      });
      /** Creates a texture from an image and sets it into a uniform value */
      __publicField(this, "setTextureUniform", (uniformName, image) => {
        if (!image.complete || image.naturalWidth === 0) {
          throw new Error(`Paper Shaders: image for uniform ${uniformName} must be fully loaded`);
        }
        const existingTexture = this.textures.get(uniformName);
        if (existingTexture) {
          this.gl.deleteTexture(existingTexture);
        }
        if (!this.textureUnitMap.has(uniformName)) {
          this.textureUnitMap.set(uniformName, this.textureUnitMap.size);
        }
        const textureUnit = this.textureUnitMap.get(uniformName);
        this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
        const error = this.gl.getError();
        if (error !== this.gl.NO_ERROR || texture === null) {
          console.error("Paper Shaders: WebGL error when uploading texture:", error);
          return;
        }
        this.textures.set(uniformName, texture);
        const location = this.uniformLocations[uniformName];
        if (location) {
          this.gl.uniform1i(location, textureUnit);
          const aspectRatioUniformName = `${uniformName}AspectRatio`;
          const aspectRatioLocation = this.uniformLocations[aspectRatioUniformName];
          if (aspectRatioLocation) {
            const aspectRatio = image.naturalWidth / image.naturalHeight;
            this.gl.uniform1f(aspectRatioLocation, aspectRatio);
          }
        }
      });
      /** Utility: recursive equality test for all the uniforms */
      __publicField(this, "areUniformValuesEqual", (a, b) => {
        if (a === b) return true;
        if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
          return a.every((val, i) => this.areUniformValuesEqual(val, b[i]));
        }
        return false;
      });
      /** Sets the provided uniform values into the WebGL program, can be a partial list of uniforms that have changed */
      __publicField(this, "setUniformValues", (updatedUniforms) => {
        this.gl.useProgram(this.program);
        Object.entries(updatedUniforms).forEach(([key, value]) => {
          let cacheValue = value;
          if (value instanceof HTMLImageElement) {
            cacheValue = `${value.src.slice(0, 200)}|${value.naturalWidth}x${value.naturalHeight}`;
          }
          if (this.areUniformValuesEqual(this.uniformCache[key], cacheValue)) return;
          this.uniformCache[key] = cacheValue;
          const location = this.uniformLocations[key];
          if (!location) {
            console.warn(`Uniform location for ${key} not found`);
            return;
          }
          if (value instanceof HTMLImageElement) {
            this.setTextureUniform(key, value);
          } else if (Array.isArray(value)) {
            let flatArray = null;
            let valueLength = null;
            if (value[0] !== void 0 && Array.isArray(value[0])) {
              const firstChildLength = value[0].length;
              if (value.every((arr) => arr.length === firstChildLength)) {
                flatArray = value.flat();
                valueLength = firstChildLength;
              } else {
                console.warn(`All child arrays must be the same length for ${key}`);
                return;
              }
            } else {
              flatArray = value;
              valueLength = flatArray.length;
            }
            switch (valueLength) {
              case 2:
                this.gl.uniform2fv(location, flatArray);
                break;
              case 3:
                this.gl.uniform3fv(location, flatArray);
                break;
              case 4:
                this.gl.uniform4fv(location, flatArray);
                break;
              case 9:
                this.gl.uniformMatrix3fv(location, false, flatArray);
                break;
              case 16:
                this.gl.uniformMatrix4fv(location, false, flatArray);
                break;
              default:
                console.warn(`Unsupported uniform array length: ${valueLength}`);
            }
          } else if (typeof value === "number") {
            this.gl.uniform1f(location, value);
          } else if (typeof value === "boolean") {
            this.gl.uniform1i(location, value ? 1 : 0);
          } else {
            console.warn(`Unsupported uniform type for ${key}: ${typeof value}`);
          }
        });
      });
      /** Gets the current total animation time from 0ms */
      __publicField(this, "getCurrentFrame", () => {
        return this.currentFrame;
      });
      /** Set a frame to get a deterministic result, frames are literally just milliseconds from zero since the animation started */
      __publicField(this, "setFrame", (newFrame) => {
        this.currentFrame = newFrame;
        this.lastRenderTime = performance.now();
        this.render(performance.now());
      });
      /** Set an animation speed (or 0 to stop animation) */
      __publicField(this, "setSpeed", (newSpeed = 1) => {
        this.speed = newSpeed;
        if (this.rafId === null && newSpeed !== 0) {
          this.lastRenderTime = performance.now();
          this.rafId = requestAnimationFrame(this.render);
        }
        if (this.rafId !== null && newSpeed === 0) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
      });
      /** Set the maximum pixel count for the shader, this will limit the number of pixels that will be rendered */
      __publicField(this, "setMaxPixelCount", (newMaxPixelCount = DEFAULT_MAX_PIXEL_COUNT) => {
        this.maxPixelCount = newMaxPixelCount;
        this.handleResize();
      });
      /** Set the minimum pixel ratio for the shader */
      __publicField(this, "setMinPixelRatio", (newMinPixelRatio = 2) => {
        this.minPixelRatio = newMinPixelRatio;
        this.handleResize();
      });
      /** Update the uniforms that are provided by the outside shader, can be a partial set with only the uniforms that have changed */
      __publicField(this, "setUniforms", (newUniforms) => {
        this.setUniformValues(newUniforms);
        this.providedUniforms = { ...this.providedUniforms, ...newUniforms };
        this.render(performance.now());
      });
      /** Dispose of the shader mount, cleaning up all of the WebGL resources */
      __publicField(this, "dispose", () => {
        this.hasBeenDisposed = true;
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        if (this.gl && this.program) {
          this.textures.forEach((texture) => {
            this.gl.deleteTexture(texture);
          });
          this.textures.clear();
          this.gl.deleteProgram(this.program);
          this.program = null;
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
          this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
          this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);
          this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
          this.gl.getError();
        }
        if (this.resizeObserver) {
          this.resizeObserver.disconnect();
          this.resizeObserver = null;
        }
        visualViewport?.removeEventListener("resize", this.handleVisualViewportChange);
        this.uniformLocations = {};
        this.parentElement.paperShaderMount = void 0;
      });
      if (parentElement instanceof HTMLElement) {
        this.parentElement = parentElement;
      } else {
        throw new Error("Paper Shaders: parent element must be an HTMLElement");
      }
      if (!document.querySelector("style[data-paper-shader]")) {
        const styleElement = document.createElement("style");
        styleElement.innerHTML = defaultStyle;
        styleElement.setAttribute("data-paper-shader", "");
        document.head.prepend(styleElement);
      }
      const canvasElement = document.createElement("canvas");
      this.canvasElement = canvasElement;
      this.parentElement.prepend(canvasElement);
      this.fragmentShader = fragmentShader;
      this.providedUniforms = uniforms;
      this.currentFrame = frame;
      this.minPixelRatio = minPixelRatio;
      this.maxPixelCount = maxPixelCount;
      const gl = canvasElement.getContext("webgl2", webGlContextAttributes);
      if (!gl) {
        throw new Error("Paper Shaders: WebGL is not supported in this browser");
      }
      this.gl = gl;
      this.initProgram();
      this.setupPositionAttribute();
      this.setupUniforms();
      this.setUniformValues(this.providedUniforms);
      this.setupResizeObserver();
      this.setSpeed(speed);
      this.parentElement.setAttribute("data-paper-shader", "");
      this.parentElement.paperShaderMount = this;
    }
  };
  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  function createProgram(gl, vertexShaderSource2, fragmentShaderSource) {
    const format = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT);
    const precision = format ? format.precision : null;
    if (precision && precision < 23) {
      vertexShaderSource2 = vertexShaderSource2.replace(/precision\s+(lowp|mediump)\s+float;/g, "precision highp float;");
      fragmentShaderSource = fragmentShaderSource.replace(/precision\s+(lowp|mediump)\s+float/g, "precision highp float").replace(/\b(uniform|varying|attribute)\s+(lowp|mediump)\s+(\w+)/g, "$1 highp $3");
    }
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource2);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return null;
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Unable to initialize the shader program: " + gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }
    gl.detachShader(program, vertexShader);
    gl.detachShader(program, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return program;
  }
  var defaultStyle = `@layer paper-shaders {
  :where([data-paper-shader]) {
    isolation: isolate;
    position: relative;

    & canvas {
      contain: strict;
      display: block;
      position: absolute;
      inset: 0;
      z-index: -1;
      width: 100%;
      height: 100%;
      border-radius: inherit;
    }
  }
}`;
  function isSafari() {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes("safari") && !ua.includes("chrome") && !ua.includes("android");
  }

  // ../../AppData/Local/Temp/claude/C--Users-------Desktop-website/66aca196-f321-4b64-99ef-4b39eee5da90/scratchpad/ref/paper-design-shaders-0.0.46/package/dist/shader-sizing.js
  var sizingVariablesDeclaration = `
in vec2 v_objectUV;
in vec2 v_responsiveUV;
in vec2 v_responsiveBoxGivenSize;
in vec2 v_patternUV;
in vec2 v_imageUV;`;
  var defaultObjectSizing = {
    fit: "contain",
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    originX: 0.5,
    originY: 0.5,
    worldWidth: 0,
    worldHeight: 0
  };
  var ShaderFitOptions = {
    none: 0,
    contain: 1,
    cover: 2
  };

  // ../../AppData/Local/Temp/claude/C--Users-------Desktop-website/66aca196-f321-4b64-99ef-4b39eee5da90/scratchpad/ref/paper-design-shaders-0.0.46/package/dist/shader-utils.js
  var declarePI = `
#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846
`;
  var rotation2 = `
vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}
`;
  var colorBandingFix = `
  color += 1. / 256. * (fract(sin(dot(.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453123) - .5);
`;
  var simplexNoise = `
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

  // ../../AppData/Local/Temp/claude/C--Users-------Desktop-website/66aca196-f321-4b64-99ef-4b39eee5da90/scratchpad/ref/paper-design-shaders-0.0.46/package/dist/shaders/liquid-metal.js
  var liquidMetalFragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;

uniform vec4 u_colorBack;
uniform vec4 u_colorTint;

uniform float u_softness;
uniform float u_repetition;
uniform float u_shiftRed;
uniform float u_shiftBlue;
uniform float u_distortion;
uniform float u_contour;
uniform float u_shape;

${sizingVariablesDeclaration}

out vec4 fragColor;

${declarePI}
${rotation2}
${simplexNoise}

float getColorChanges(float c1, float c2, float stripe_p, vec3 w, float blur, float bump, float tint) {
  
  float ch = mix(c2, c1, smoothstep(.0, 2. * blur, stripe_p));

  float border = w[0];
  ch = mix(ch, c2, smoothstep(border, border + 2. * blur, stripe_p));

  border = w[0] + .4 * (1. - bump) * w[1];
  ch = mix(ch, c1, smoothstep(border, border + 2. * blur, stripe_p));

  border = w[0] + .5 * (1. - bump) * w[1];
  ch = mix(ch, c2, smoothstep(border, border + 2. * blur, stripe_p));

  border = w[0] + w[1];
  ch = mix(ch, c1, smoothstep(border, border + 2. * blur, stripe_p));

  float gradient_t = (stripe_p - w[0] - w[1]) / w[2];
  float gradient = mix(c1, c2, smoothstep(0., 1., gradient_t));
  ch = mix(ch, gradient, smoothstep(border, border + .5 * blur, stripe_p));
  
  // Tint color is applied with color burn blending
  ch = mix(ch, 1. - min(1., (1. - ch) / max(tint, 0.0001)), u_colorTint.a);
  return ch;
}

void main() {

  float t = .1 * u_time;

  vec2 uv = v_objectUV;
  uv += .5;
  uv.y = 1. - uv.y;

  float cycleWidth = .5 * u_repetition;

  float mask = 1.;
  float contOffset = 1.;

  if (u_shape < 1.) {

    vec2 borderUV = v_responsiveUV + .5;
    float ratio = v_responsiveBoxGivenSize.x / v_responsiveBoxGivenSize.y;
    vec2 edge = min(borderUV, 1. - borderUV);
    vec2 pixel_thickness = 250. / v_responsiveBoxGivenSize;
    float maskX = smoothstep(0.0, pixel_thickness.x, edge.x);
    float maskY = smoothstep(0.0, pixel_thickness.y, edge.y);
    maskX = pow(maskX, .25);
    maskY = pow(maskY, .25);
    mask = clamp(1. - maskX * maskY, 0., 1.);

    uv = v_responsiveUV;
    if (ratio > 1.) {
      uv.y /= ratio;
    } else {
      uv.x *= ratio;
    }
    uv += .5;
    uv.y = 1. - uv.y;

    cycleWidth *= 2.;
    contOffset = 1.5;

  } else if (u_shape < 2.) {
    vec2 shapeUV = uv - .5;
    shapeUV *= .67;
    mask = pow(clamp(3. * length(shapeUV), 0., 1.), 18.);
  } else if (u_shape < 3.) {
    vec2 shapeUV = uv - .5;
    shapeUV *= 1.68;

    float r = length(shapeUV) * 2.;
    float a = atan(shapeUV.y, shapeUV.x) + .2;
    r *= (1. + .05 * sin(3. * a + 2. * t));
    float f = abs(cos(a * 3.));
    mask = smoothstep(f, f + .7, r);
    mask = pow(mask, 2.);

    uv *= .8;
    cycleWidth *= 1.6;

  } else if (u_shape < 4.) {
    vec2 shapeUV = uv - .5;
    shapeUV *= 1.3;
    mask = 0.;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float speed = 4.5 + 2. * sin(fi * 12.345);
      float angle = -fi * 1.5;
      vec2 dir1 = vec2(cos(angle), sin(angle));
      vec2 dir2 = vec2(cos(angle + 1.57), sin(angle + 1.));
      vec2 traj = .4 * (dir1 * sin(t * speed + fi * 1.23) + dir2 * cos(t * (speed * 0.7) + fi * 2.17));
      float d = length(shapeUV + traj);
      mask += pow(1.0 - clamp(d, 0.0, 1.0), 4.0);
    }
    mask = 1. - smoothstep(.65, .9, mask);
    mask = pow(mask, 4.);
  }

  float opacity = 1. - smoothstep(.82 - 2. * fwidth(mask), .82, mask);

  float ridge = .15 * (smoothstep(.0, .15, uv.y) * smoothstep(.4, .15, uv.y));
  ridge += .05 * (smoothstep(.1, .2, 1. - uv.y) * smoothstep(.4, .2, 1. - uv.y));
  mask += ridge;

  float diagBLtoTR = uv.x - uv.y;
  float diagTLtoBR = uv.x + uv.y;

  vec3 color = vec3(0.);
  vec3 color1 = vec3(.98, 0.98, 1.);
  vec3 color2 = vec3(.1, .1, .1 + .1 * smoothstep(.7, 1.3, diagTLtoBR));

  vec2 grad_uv = uv - .5;

  float dist = length(grad_uv + vec2(0., .2 * diagBLtoTR));
  grad_uv = rotate(grad_uv, (.25 - .2 * diagBLtoTR) * PI);
  float direction = grad_uv.x;

  float bump = pow(1.8 * dist, 1.2);
  bump = 1. - bump;
  bump *= pow(uv.y, .3);


  float thin_strip_1_ratio = .12 / cycleWidth * (1. - .4 * bump);
  float thin_strip_2_ratio = .07 / cycleWidth * (1. + .4 * bump);
  float wide_strip_ratio = (1. - thin_strip_1_ratio - thin_strip_2_ratio);

  float thin_strip_1_width = cycleWidth * thin_strip_1_ratio;
  float thin_strip_2_width = cycleWidth * thin_strip_2_ratio;

  float noise = snoise(uv - t);

  mask += (1. - mask) * u_distortion * noise;

  direction += diagBLtoTR;

  float contour = u_contour * smoothstep(0., contOffset + .01, mask) * smoothstep(contOffset + .01, 0., mask);
  direction -= 14. * noise * contour;

  bump *= clamp(pow(uv.y, .1), .3, 1.);
  direction *= (.1 + (1.1 - mask) * bump);
  direction *= smoothstep(1., .2, mask);


  direction *= (.5 + .5 * pow(uv.y, 2.));
  direction *= cycleWidth;
  direction -= t;


  float colorDispersion = (1. - bump);
  float dispersionRed = colorDispersion;
  dispersionRed += bump * noise;
  float dispersionBlue = colorDispersion;

  dispersionRed *= (u_shiftRed / 20.);
  dispersionBlue *= (u_shiftBlue / 20.);

  float blur = u_softness / 15. + .3 * contour;

  vec3 w = vec3(thin_strip_1_width, thin_strip_2_width, wide_strip_ratio);
  w[1] -= .02 * smoothstep(.0, 1., mask + bump);
  float stripe_r = mod(direction + dispersionRed, 1.);
  float r = getColorChanges(color1.r, color2.r, stripe_r, w, blur + fwidth(stripe_r), bump, u_colorTint.r);
  float stripe_g = mod(direction, 1.);
  float g = getColorChanges(color1.g, color2.g, stripe_g, w, blur + fwidth(stripe_g), bump, u_colorTint.g);
  float stripe_b = mod(direction - dispersionBlue, 1.);
  float b = getColorChanges(color1.b, color2.b, stripe_b, w, blur + fwidth(stripe_b), bump, u_colorTint.b);

  color = vec3(r, g, b);
  color *= opacity;

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  color = color + bgColor * (1. - opacity);
  opacity = opacity + u_colorBack.a * (1. - opacity);

  ${colorBandingFix}

  fragColor = vec4(color, opacity);
}
`;
  var LiquidMetalShapes = {
    none: 0,
    circle: 1,
    daisy: 2,
    metaballs: 3
  };

  // ../../AppData/Local/Temp/claude/C--Users-------Desktop-website/66aca196-f321-4b64-99ef-4b39eee5da90/scratchpad/ref/paper-design-shaders-0.0.46/package/dist/get-shader-color-from-string.js
  function getShaderColorFromString(colorString) {
    if (Array.isArray(colorString)) {
      if (colorString.length === 4) return colorString;
      if (colorString.length === 3) return [...colorString, 1];
      return fallbackColor;
    }
    if (typeof colorString !== "string") {
      return fallbackColor;
    }
    let r, g, b, a = 1;
    if (colorString.startsWith("#")) {
      [r, g, b, a] = hexToRgba(colorString);
    } else if (colorString.startsWith("rgb")) {
      [r, g, b, a] = parseRgba(colorString);
    } else if (colorString.startsWith("hsl")) {
      [r, g, b, a] = hslaToRgba(parseHsla(colorString));
    } else {
      console.error("Unsupported color format", colorString);
      return fallbackColor;
    }
    return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1), clamp(a, 0, 1)];
  }
  function hexToRgba(hex) {
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) {
      hex = hex.split("").map((char) => char + char).join("");
    }
    if (hex.length === 6) {
      hex = hex + "ff";
    }
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const a = parseInt(hex.slice(6, 8), 16) / 255;
    return [r, g, b, a];
  }
  function parseRgba(rgba) {
    const match = rgba.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+))?\s*\)$/i);
    if (!match) return [0, 0, 0, 1];
    return [
      parseInt(match[1] ?? "0") / 255,
      parseInt(match[2] ?? "0") / 255,
      parseInt(match[3] ?? "0") / 255,
      match[4] === void 0 ? 1 : parseFloat(match[4])
    ];
  }
  function parseHsla(hsla) {
    const match = hsla.match(/^hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*([0-9.]+))?\s*\)$/i);
    if (!match) return [0, 0, 0, 1];
    return [
      parseInt(match[1] ?? "0"),
      parseInt(match[2] ?? "0"),
      parseInt(match[3] ?? "0"),
      match[4] === void 0 ? 1 : parseFloat(match[4])
    ];
  }
  function hslaToRgba(hsla) {
    const [h, s, l, a] = hsla;
    const hDecimal = h / 360;
    const sDecimal = s / 100;
    const lDecimal = l / 100;
    let r, g, b;
    if (s === 0) {
      r = g = b = lDecimal;
    } else {
      const hue2rgb = (p2, q2, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t;
        if (t < 1 / 2) return q2;
        if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6;
        return p2;
      };
      const q = lDecimal < 0.5 ? lDecimal * (1 + sDecimal) : lDecimal + sDecimal - lDecimal * sDecimal;
      const p = 2 * lDecimal - q;
      r = hue2rgb(p, q, hDecimal + 1 / 3);
      g = hue2rgb(p, q, hDecimal);
      b = hue2rgb(p, q, hDecimal - 1 / 3);
    }
    return [r, g, b, a];
  }
  var clamp = (n, min, max) => Math.min(Math.max(n, min), max);
  var fallbackColor = [0, 0, 0, 1];
  return __toCommonJS(entry_exports);
})();
