"use strict";

// --- Shader Sources ---
// Vertex Shader (Unchanged)
const vsSource = `
  attribute vec2 a_position;
  varying vec2 v_coord;

  void main() {
    v_coord = a_position;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Fragment Shader (MODIFIED for Julia Set)
const fsSource = `
  precision highp float;

  varying vec2 v_coord;

  uniform vec2 u_resolution;
  uniform vec2 u_center;
  uniform float u_scale;
  uniform int u_maxIterations;
  uniform float u_time;
  uniform vec2 u_juliaC; // *** Tham số C cố định cho Julia Set ***

  const int MAX_ITER_CONST = 1000; // Giới hạn cứng

  // Hàm nhân số phức (Unchanged)
  vec2 complex_mult(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
  }

  // Hàm lặp z = z^2 + c (Unchanged)
  vec2 iterate(vec2 z, vec2 c) {
      return complex_mult(z, z) + c;
  }

  // Hàm màu (Unchanged)
  vec3 color_from_iterations(int i, int max_iter, float time) {
      if (i >= max_iter) { return vec3(0.0, 0.0, 0.0); }
      float t = float(i) / float(max_iter);
      float r = 0.5 + 0.5 * cos(3.0 + t * 15.0 + time * 1.5);
      float g = 0.5 + 0.5 * cos(3.5 + t * 17.0 + time * 1.2);
      float b = 0.5 + 0.5 * cos(4.0 + t * 19.0 + time * 1.8);
      return pow(vec3(r, g, b), vec3(0.8));
  }

  void main() {
    float aspectRatio = u_resolution.x / u_resolution.y;

    // *** Thay đổi logic chính: z là tọa độ, c là hằng số ***
    // Tính z ban đầu dựa trên tọa độ pixel
    vec2 z = u_center + vec2(v_coord.x * u_scale * aspectRatio, v_coord.y * u_scale);
    // c là hằng số được truyền vào từ uniform
    vec2 c = u_juliaC;
    //-----------------------------------------------------

    int iterations_done = u_maxIterations;

    for (int iter_count = 0; iter_count < MAX_ITER_CONST; ++iter_count) {
        if (iter_count >= u_maxIterations) {
            iterations_done = u_maxIterations;
            break;
        }

        // Phép lặp vẫn là z = z^2 + c
        z = iterate(z, c);

        if (dot(z, z) > 4.0) { // Điều kiện thoát
            iterations_done = iter_count;
            break;
        }
    }

    vec3 color = color_from_iterations(iterations_done, u_maxIterations, u_time);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function main() {
    const canvas = document.getElementById("glCanvas");
    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true }) || canvas.getContext("experimental-webgl", { preserveDrawingBuffer: true });
    if (!gl) { alert("Không thể khởi tạo WebGL."); return; }

    // Assume webglUtils exists and works
    const program = webglUtils.createProgramFromSources(gl, [vsSource, fsSource]);
    if (!program) { return; }

    // --- Locations ---
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
    const centerUniformLocation = gl.getUniformLocation(program, "u_center");
    const scaleUniformLocation = gl.getUniformLocation(program, "u_scale");
    const maxIterationsUniformLocation = gl.getUniformLocation(program, "u_maxIterations");
    const timeUniformLocation = gl.getUniformLocation(program, "u_time");
    // *** Thêm Location cho Julia C ***
    const juliaCUniformLocation = gl.getUniformLocation(program, "u_juliaC");

    // --- State Variables ---
    let maxIterations = 100;
    let centerCoords = { x: 0.0, y: 0.0 }; // Tâm cho Julia thường là (0,0)
    let scale = 1.5;
    // *** Thêm biến trạng thái cho Julia C ***
    let juliaC = { x: -0.8, y: 0.156 }; // Một giá trị khởi đầu thú vị

    // --- Buffer cho Quad (Unchanged) ---
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [ -1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1 ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // --- VAO Setup (Unchanged) ---
    let vao = null;
    if (gl instanceof WebGL2RenderingContext) { /* ... VAO setup ... */
        vao = gl.createVertexArray(); gl.bindVertexArray(vao);
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    // --- Animation State (Unchanged) ---
    let animationFrameId = null; let isAnimating = false; let startTime = performance.now();

    function render(now) { /* ... */
        const time = (now - startTime) * 0.001;
        drawScene(time);
        if (isAnimating) { animationFrameId = requestAnimationFrame(render); }
    }
    function stopAnimation() { /* ... */
        if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
        isAnimating = false; if (animateButton) animateButton.textContent = "Animate Color";
    }

    function drawScene(time = 0) {
        webglUtils.resizeCanvasToDisplaySize(gl.canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.useProgram(program);

        // --- Bindings & Attributes (Unchanged) ---
        if (vao) { gl.bindVertexArray(vao); }
        else { /* WebGL1 Bind/Enable/Pointer */
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.enableVertexAttribArray(positionAttributeLocation);
            gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
         }

        // --- Uniforms (MODIFIED: added Julia C) ---
        gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
        gl.uniform2f(centerUniformLocation, centerCoords.x, centerCoords.y);
        gl.uniform1f(scaleUniformLocation, scale);
        gl.uniform1i(maxIterationsUniformLocation, maxIterations);
        gl.uniform1f(timeUniformLocation, time);
        // *** Gửi giá trị Julia C đến shader ***
        gl.uniform2f(juliaCUniformLocation, juliaC.x, juliaC.y);

        // --- Vẽ Quad (Unchanged) ---
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // --- Cleanup (Unchanged) ---
        if (vao) { gl.bindVertexArray(null); }
    }

    // --- Event Listeners (MODIFIED: added Julia C controls) ---
    const iterSlider = document.getElementById("iterSlider");
    const iterValue = document.getElementById("iterValue");
    const animateButton = document.getElementById("animateButton");
    const resetButton = document.getElementById("resetButton");
    // *** Lấy tham chiếu đến các điều khiển Julia C mới ***
    const juliaCRealSlider = document.getElementById("juliaCRealSlider");
    const juliaCRealValue = document.getElementById("juliaCRealValue");
    const juliaCImagSlider = document.getElementById("juliaCImagSlider");
    const juliaCImagValue = document.getElementById("juliaCImagValue");

    // --- Initial UI setup ---
    iterValue.textContent = iterSlider.value;
    maxIterations = parseInt(iterSlider.value);
    // *** Thiết lập giá trị ban đầu cho hiển thị Julia C ***
    juliaCRealValue.textContent = juliaCRealSlider.value;
    juliaCImagValue.textContent = juliaCImagSlider.value;
    // Đồng bộ giá trị state với slider nếu khác
    juliaC.x = parseFloat(juliaCRealSlider.value);
    juliaC.y = parseFloat(juliaCImagSlider.value);


    // --- Event Listener Setup ---
    iterSlider.addEventListener("input", () => {
        maxIterations = parseInt(iterSlider.value);
        iterValue.textContent = maxIterations;
        if (!isAnimating) { startTime = performance.now(); drawScene(0); }
    });

    // *** Thêm Event Listeners cho Julia C Sliders ***
    juliaCRealSlider.addEventListener("input", () => {
        juliaC.x = parseFloat(juliaCRealSlider.value);
        juliaCRealValue.textContent = juliaC.x.toFixed(3); // Hiển thị với 3 chữ số thập phân
        if (!isAnimating) { startTime = performance.now(); drawScene(0); }
    });

    juliaCImagSlider.addEventListener("input", () => {
        juliaC.y = parseFloat(juliaCImagSlider.value);
        juliaCImagValue.textContent = juliaC.y.toFixed(3);
        if (!isAnimating) { startTime = performance.now(); drawScene(0); }
    });
    // ---------------------------------------------

    animateButton.addEventListener("click", () => {
        if (!isAnimating) {
            isAnimating = true; animateButton.textContent = "Stop Animation";
            startTime = performance.now(); animationFrameId = requestAnimationFrame(render);
        } else {
            stopAnimation(); drawScene(0); // Draw static frame when stopped
        }
    });

    resetButton.addEventListener("click", () => {
        stopAnimation();
        // Reset state
        centerCoords = { x: 0.0, y: 0.0 }; // Reset center
        scale = 1.5;
        iterSlider.value = 100; maxIterations = 100; iterValue.textContent = maxIterations;
        // *** Reset Julia C và các slider tương ứng ***
        juliaC = { x: -0.8, y: 0.156 }; // Reset về giá trị mặc định
        juliaCRealSlider.value = juliaC.x;
        juliaCImagSlider.value = juliaC.y;
        juliaCRealValue.textContent = juliaC.x.toFixed(3);
        juliaCImagValue.textContent = juliaC.y.toFixed(3);
        // ---------------------------------------------
        startTime = performance.now();
        drawScene(0);
    });

    // --- Initial Draw ---
    drawScene(0);
}

// --- webglUtils helper (Assume this exists) ---
const webglUtils = { /* ... createProgramFromSources, resizeCanvasToDisplaySize ... */
    createProgramFromSources: function(gl, shaderSources) { /* ... */ const vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, shaderSources[0]); gl.compileShader(vs); if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) { console.error("VS Error:", gl.getShaderInfoLog(vs)); gl.deleteShader(vs); return null; } const fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, shaderSources[1]); gl.compileShader(fs); if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) { console.error("FS Error:", gl.getShaderInfoLog(fs)); gl.deleteShader(vs); gl.deleteShader(fs); return null; } const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.error("Program Link Error:", gl.getProgramInfoLog(program)); gl.deleteProgram(program); return null; } gl.detachShader(program, vs); gl.deleteShader(vs); gl.detachShader(program, fs); gl.deleteShader(fs); return program; },
    resizeCanvasToDisplaySize: function(canvas, multiplier) { /* ... */ multiplier = multiplier || 1; const width  = canvas.clientWidth  * multiplier | 0; const height = canvas.clientHeight * multiplier | 0; if (canvas.width !== width ||  canvas.height !== height) { canvas.width  = width; canvas.height = height; return true; } return false; }
};


window.onload = main;