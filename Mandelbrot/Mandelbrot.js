"use strict";

// --- Shader Sources ---
// Vertex Shader: Đơn giản, chỉ vẽ quad và truyền tọa độ clip space làm texCoord
const vsSource = `
  attribute vec2 a_position; // Các đỉnh của quad (-1,-1) to (1,1)
  varying vec2 v_coord;      // Tọa độ để FS biết vị trí phức tương ứng

  void main() {
    // Tọa độ clip space cũng là tọa độ chúng ta cần để tính toán trong FS
    v_coord = a_position;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Fragment Shader: Nơi thực hiện phép toán Mandelbrot
// Fragment Shader: Nơi thực hiện phép toán Mandelbrot
// Fragment Shader: Nơi thực hiện phép toán Mandelbrot
const fsSource = `
  precision highp float;

  varying vec2 v_coord;

  uniform vec2 u_resolution;
  uniform vec2 u_center;
  uniform float u_scale;
  uniform int u_maxIterations; // Giá trị thực tế từ slider
  uniform float u_time;

  // *** Đặt một giới hạn trên là HẰNG SỐ ***
  // Giá trị này phải >= giá trị max của slider u_maxIterations
  const int MAX_ITER_CONST = 1000; // Hoặc 1024, 2048, v.v.

  // Hàm nhân số phức
  vec2 complex_mult(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
  }

  // Hàm lặp z = z^2 + c
  vec2 iterate(vec2 z, vec2 c) {
      return complex_mult(z, z) + c;
  }

  // Hàm màu (giữ nguyên)
  vec3 color_from_iterations(int i, int max_iter, float time) {
      if (i >= max_iter) {
          return vec3(0.0, 0.0, 0.0);
      }
      float t = float(i) / float(max_iter); 
      float r = 0.5 + 0.5 * cos(3.0 + t * 15.0 + time * 1.5);
      float g = 0.5 + 0.5 * cos(3.5 + t * 17.0 + time * 1.2);
      float b = 0.5 + 0.5 * cos(4.0 + t * 19.0 + time * 1.8);
      return pow(vec3(r, g, b), vec3(0.8));
  }

  void main() {
    float aspectRatio = u_resolution.x / u_resolution.y;
    vec2 c = u_center + vec2(v_coord.x * u_scale * aspectRatio, v_coord.y * u_scale);
    vec2 z = vec2(0.0, 0.0);

    int iterations_done = u_maxIterations; // Vẫn khởi tạo để xử lý trường hợp không thoát

    for (int iter_count = 0; iter_count < MAX_ITER_CONST; ++iter_count) {
        if (iter_count >= u_maxIterations) {
            iterations_done = u_maxIterations; // Đảm bảo giá trị không vượt quá giới hạn thực tế
            break; // Đạt giới hạn thực, thoát
        }

        z = iterate(z, c);

        if (dot(z, z) > 4.0) {
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
    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true }) || canvas.getContext("experimental-webgl", { preserveDrawingBuffer: true }); // preserveDrawingBuffer nếu muốn chụp ảnh
    if (!gl) { alert("Không thể khởi tạo WebGL."); return; }

    const program = webglUtils.createProgramFromSources(gl, [vsSource, fsSource]);
    if (!program) { return; }

    // --- Locations ---
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
    const centerUniformLocation = gl.getUniformLocation(program, "u_center");
    const scaleUniformLocation = gl.getUniformLocation(program, "u_scale");
    const maxIterationsUniformLocation = gl.getUniformLocation(program, "u_maxIterations");
    const timeUniformLocation = gl.getUniformLocation(program, "u_time");


    let maxIterations = 100;
    let centerCoords = { x: -0.5, y: 0.0 }; 
    let scale = 1.5; // Mức zoom 

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // --- VAO Setup (nếu có WebGL2) ---
    let vao = null;
    if (gl instanceof WebGL2RenderingContext) {
        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null); // Unbind VAO
        gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind buffer sau khi thiết lập VAO
    }

    let animationFrameId = null;
    let isAnimating = false;
    let startTime = performance.now();

    function render(now) {
        const time = (now - startTime) * 0.001; // Thời gian tính bằng giây

        drawScene(time);

        if (isAnimating) {
            animationFrameId = requestAnimationFrame(render);
        }
    }

    function stopAnimation() {
        if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
        isAnimating = false;
        if (animateButton) animateButton.textContent = "Animate Color";
    }

    function drawScene(time = 0) { // Mặc định time = 0 nếu không animate
        webglUtils.resizeCanvasToDisplaySize(gl.canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);


        gl.useProgram(program);

        // --- Bindings & Attributes ---
        if (vao) {
            gl.bindVertexArray(vao);
        } else {
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.enableVertexAttribArray(positionAttributeLocation);
            gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
        }

        // --- Uniforms ---
        gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
        gl.uniform2f(centerUniformLocation, centerCoords.x, centerCoords.y);
        gl.uniform1f(scaleUniformLocation, scale);
        gl.uniform1i(maxIterationsUniformLocation, maxIterations);
        gl.uniform1f(timeUniformLocation, time);

        // --- Vẽ Quad ---
        gl.drawArrays(gl.TRIANGLES, 0, 6); // Vẽ 2 tam giác tạo thành quad

        // --- Cleanup ---
        if (vao) {
            gl.bindVertexArray(null);
        }
    }

    // --- Event Listeners ---
    const iterSlider = document.getElementById("iterSlider");
    const iterValue = document.getElementById("iterValue");
    const animateButton = document.getElementById("animateButton");
    const resetButton = document.getElementById("resetButton");

    iterValue.textContent = iterSlider.value; // Initial value display
    maxIterations = parseInt(iterSlider.value);

    iterSlider.addEventListener("input", () => {
        maxIterations = parseInt(iterSlider.value);
        iterValue.textContent = maxIterations;
        // Vẽ lại ngay lập tức khi slider thay đổi (nếu không đang animate)
        if (!isAnimating) {
             startTime = performance.now(); // Reset time để màu bắt đầu lại
             drawScene(0);
        }
    });

    animateButton.addEventListener("click", () => {
        if (!isAnimating) {
            isAnimating = true;
            animateButton.textContent = "Stop Animation";
            startTime = performance.now(); // Reset time khi bắt đầu animate
            animationFrameId = requestAnimationFrame(render);
        } else {
            stopAnimation();
             // Vẽ lại frame cuối khi dừng, với time=0 để màu tĩnh
             drawScene(0);
        }
    });

    resetButton.addEventListener("click", () => {
        stopAnimation();
        // Reset state về giá trị ban đầu
        centerCoords = { x: -0.5, y: 0.0 };
        scale = 1.5;
        iterSlider.value = 100; // Đặt lại cả slider
        maxIterations = 100;
        iterValue.textContent = maxIterations;
        startTime = performance.now(); // Reset time
        drawScene(0); // Vẽ lại trạng thái reset
    });

    // --- Initial Draw ---
    drawScene(0);
}

// --- Thư viện m3 không cần thiết trực tiếp nhưng webgl-utils cần ---

window.onload = main;