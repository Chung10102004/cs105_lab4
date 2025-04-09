"use strict";

// --- Shader Sources (Tái sử dụng) ---
const vsSource = `
    attribute vec2 a_position;
    uniform vec2 u_resolution;
    uniform mat3 u_transform;

    void main() {
      // Áp dụng ma trận biến đổi (bao gồm quay và dịch chuyển)
      vec2 transformedPosition = (u_transform * vec3(a_position, 1.0)).xy;

      // Chuyển đổi từ pixel space sang clip space (-1 to +1)
      vec2 zeroToOne = transformedPosition / u_resolution;
      vec2 zeroToTwo = zeroToOne * 2.0;
      vec2 clipSpace = zeroToTwo - 1.0;

      // Lật trục Y cho WebGL
      gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    }
`;

const fsSource = `
    precision mediump float;
    uniform vec4 u_color;

    void main() {
      gl_FragColor = u_color;
    }
`;

// --- Lớp Vec2 (Tái sử dụng) ---
class Vec2 {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
    mult(scalar) { return new Vec2(this.x * scalar, this.y * scalar); }
    rotateDeg(angleDeg) {
        const angleRad = angleDeg * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
        const x = this.x * cosA - this.y * sinA;
        const y = this.x * sinA + this.y * cosA;
        return new Vec2(x, y);
    }
}

// --- Logic tạo Minkowski Island ---

/**
 * Tạo các đỉnh cho một cạnh của đường Minkowski
 * Thay thế đoạn p1->p2 bằng 8 đoạn con.
 * @param {Vec2} p1 Điểm bắt đầu
 * @param {Vec2} p2 Điểm kết thúc
 * @param {number} depth Độ sâu đệ quy
 * @returns {Array<Vec2>} Mảng các điểm tạo thành đường cong (không bao gồm p2)
 */
function generateMinkowskiSide(p1, p2, depth) {
    if (depth <= 0) { // Thay đổi điều kiện dừng thành <= 0 cho rõ ràng
        return [p1]; // Chỉ trả về điểm bắt đầu
    } else {
        const v = p2.sub(p1);         // Vector hướng từ p1 đến p2
        const v_perp = v.rotateDeg(-90).mult(1 / 4); // Vector vuông góc, đã scale trước
        const v_quart = v.mult(1 / 4); // 1/4 vector gốc

        // Tính các điểm chia đoạn thẳng
        const pA = p1.add(v_quart);
        const pB = p1.add(v_quart).add(v_quart); // p1 + v*(1/2)
        const pC = p1.add(v_quart).add(v_quart).add(v_quart); // p1 + v*(3/4)

        // Tính các điểm nhô ra dựa trên mẫu Minkowski
        // Mẫu hình 8 đoạn: P1-A, A-D, D-E, E-B, B-F, F-G, G-C, C-P2
        const pD = pA.add(v_perp);
        const pE = pD.add(v_quart);
        const pF = pB.add(v_perp);
        const pG = pF.add(v_quart);

        const points = [];
        // Gọi đệ quy cho 8 đoạn con theo đúng thứ tự
        points.push(...generateMinkowskiSide(p1, pA, depth - 1)); // 1
        points.push(...generateMinkowskiSide(pA, pD, depth - 1)); // 2
        points.push(...generateMinkowskiSide(pD, pE, depth - 1)); // 3
        points.push(...generateMinkowskiSide(pE, pB, depth - 1)); // 4
        points.push(...generateMinkowskiSide(pB, pF, depth - 1)); // 5
        points.push(...generateMinkowskiSide(pF, pG, depth - 1)); // 6
        points.push(...generateMinkowskiSide(pG, pC, depth - 1)); // 7
        points.push(...generateMinkowskiSide(pC, p2, depth - 1)); // 8

        return points;
    }
}


/**
 * Tạo tất cả các đỉnh cho Đảo Minkowski hoàn chỉnh
 * @param {Vec2} center Trung tâm của hình vuông ban đầu
 * @param {number} size Độ dài cạnh hình vuông ban đầu
 * @param {number} depth Độ sâu đệ quy
 * @returns {Array<number>} Mảng các tọa độ [x1, y1, x2, y2, ...]
 */
function generateMinkowskiIslandVertices(center, size, depth) {
    const halfSize = size / 2;
    // Tạo 4 đỉnh của hình vuông ban đầu (ngược chiều kim đồng hồ)
    const p1 = center.add(new Vec2(-halfSize, -halfSize)); // Góc dưới trái
    const p2 = center.add(new Vec2( halfSize, -halfSize)); // Góc dưới phải
    const p3 = center.add(new Vec2( halfSize,  halfSize)); // Góc trên phải
    const p4 = center.add(new Vec2(-halfSize,  halfSize)); // Góc trên trái

    // Tạo các điểm cho mỗi cạnh của hình vuông
    const side1Points = generateMinkowskiSide(p1, p2, depth);
    const side2Points = generateMinkowskiSide(p2, p3, depth);
    const side3Points = generateMinkowskiSide(p3, p4, depth);
    const side4Points = generateMinkowskiSide(p4, p1, depth);

    // Kết hợp tất cả các điểm và chuyển đổi Vec2 thành mảng [x, y, x, y, ...]
    const allPoints = [...side1Points, ...side2Points, ...side3Points, ...side4Points];
    const vertices = [];
    for (const p of allPoints) {
        vertices.push(p.x, p.y);
    }
    return vertices;
}


// --- Main WebGL Function ---
function main() {
    const canvas = document.getElementById("glCanvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) {
        alert("Không thể khởi tạo WebGL.");
        return;
    }

    // --- Shader và Program ---
    const program = webglUtils.createProgramFromSources(gl, [vsSource, fsSource]);
    if (!program) {
        console.error("Không thể tạo WebGL program.");
        return;
    }

    // --- Locations ---
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
    const colorUniformLocation = gl.getUniformLocation(program, "u_color");
    const transformUniformLocation = gl.getUniformLocation(program, "u_transform");

    // --- State Variables ---
    let recursionDepth = 1;
    let islandSize = Math.min(window.innerWidth, window.innerHeight) * 0.6; // Kích thước ban đầu
    const center = new Vec2(0, 0); // Tạo quanh gốc tọa độ

    let vertices = [];
    let numVertices = 0;
    const positionBuffer = gl.createBuffer();

    // --- VAO Setup ---
    let vao;
    const size = 2; // 2 components per iteration
    const type = gl.FLOAT; // the data is 32bit floats
    const normalize = false; // don't normalize the data
    const stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
    const offset = 0; // start at the beginning of the buffer

    if (gl instanceof WebGL2RenderingContext) {
        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); // Bind buffer *inside* VAO config
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(
            positionAttributeLocation, size, type, normalize, stride, offset);
        gl.bindVertexArray(null); // Hủy bind VAO sau khi cấu hình
        gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind buffer after VAO setup
    } else {
        // WebGL1: Chỉ cần tạo buffer, việc bind và pointer sẽ trong drawScene
    }

    // --- Animation State ---
    let animationFrameId = null;
    let isAnimating = false;
    let then = 0;
    let rotationAngle = 0;


    function render(now) {
        now *= 0.001; // convert to seconds
        const deltaTime = now - then;
        then = now;

        rotationAngle += deltaTime * 0.5; // Tốc độ quay chậm hơn

        // Màu sắc thay đổi
        const colorR = Math.cos(now * 0.6) * 0.5 + 0.5;
        const colorG = Math.sin(now * 0.4) * 0.5 + 0.5;
        const colorB = Math.cos(now * 0.8 + Math.PI / 2) * 0.5 + 0.5;

        drawScene(colorR, colorG, colorB, rotationAngle);

        // Kiểm tra nếu vẫn đang animating thì mới request tiếp
        if (isAnimating) {
           animationFrameId = requestAnimationFrame(render);
        }
    }

    function stopAnimation() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        isAnimating = false;
        // Đảm bảo nút bấm hiển thị đúng trạng thái
        if (animateButton) animateButton.textContent = "Animate";
    }
 // --- Hàm vẽ chính ---
function drawScene(colorR, colorG, colorB, currentRotation) {
    if (webglUtils.resizeCanvasToDisplaySize(gl.canvas)) {
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        // In ra để xác nhận resize (tùy chọn)
        // console.log("Resized - Viewport:", gl.canvas.width, gl.canvas.height);
    }

    gl.clearColor(0.1, 0.1, 0.15, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    // --- Bindings & Attributes ---
    if (vao) {
        gl.bindVertexArray(vao);
    } else {
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(positionAttributeLocation);
        // Đảm bảo các biến size, type, normalize, stride, offset có thể truy cập
        gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
    }

    // --- Uniforms ---
    gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
    gl.uniform4f(colorUniformLocation, colorR, colorG, colorB, 1.0);

    const moveOriginX = gl.canvas.width / 2;
    const moveOriginY = gl.canvas.height / 2;

    // === THAY ĐỔI TÍNH TOÁN MA TRẬN Ở ĐÂY ===
    // Tạo ma trận dịch chuyển đến tâm canvas
    const translationMatrix = m3.translation(moveOriginX, moveOriginY);
    // Tạo ma trận quay quanh gốc (0,0)
    const rotationMatrix = m3.rotation(currentRotation);

    // Áp dụng phép biến đổi giống code Koch: Translate * Rotate
    // Điều này có nghĩa là: Quay các đỉnh quanh (0,0) TRƯỚC,
    // sau đó dịch chuyển kết quả đã quay đến tâm canvas.
    let matrix = m3.multiply(translationMatrix, rotationMatrix);
    // ========================================

    // Gửi ma trận cuối cùng đến shader
    gl.uniformMatrix3fv(transformUniformLocation, false, matrix);

    // --- Vẽ ---
    if (numVertices > 0) {
        gl.drawArrays(gl.LINE_LOOP, 0, numVertices);
    }
    // --- Cleanup ---
    if (vao) {
        gl.bindVertexArray(null);
    }
}
//  --- Hàm cập nhật hình học ---
    function updateFractal() {
        // console.time(`generate vertices depth ${recursionDepth}`); // Bỏ comment nếu cần đo
        try {
             vertices = generateMinkowskiIslandVertices(center, islandSize, recursionDepth);
             numVertices = vertices.length / 2;
             gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
             gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
             gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind sau khi nạp xong

             if (!isAnimating) {
                 drawScene(1.0, 1.0, 1.0, rotationAngle);
             }
        } catch (error) {
             console.error("Error generating or buffering vertices:", error);
             // Có thể thêm thông báo lỗi cho người dùng ở đây
        }
    }


    // --- Event Listeners ---
    const depthSlider = document.getElementById("depthSlider");
    const depthValue = document.getElementById("depthValue");
    const animateButton = document.getElementById("animateButton");
    const resetButton = document.getElementById("resetButton");

    // Đảm bảo các element UI tồn tại trước khi thêm listener
    if (!depthSlider || !depthValue || !animateButton || !resetButton) {
        console.error("UI elements not found!");
        return; // Thoát nếu thiếu UI
    }

    depthValue.textContent = depthSlider.value; // Hiển thị giá trị ban đầu

    depthSlider.addEventListener("input", () => {
        recursionDepth = parseInt(depthSlider.value);
        depthValue.textContent = recursionDepth;
        updateFractal(); // Tạo lại và vẽ lại fractal
    });

    animateButton.addEventListener("click", () => {
        if (!isAnimating) {
            isAnimating = true;
            animateButton.textContent = "Stop";
            then = performance.now() * 0.001; // Reset thời gian bắt đầu animation
            animationFrameId = requestAnimationFrame(render); // Gán ID để có thể cancel
        } else {
            stopAnimation();
            // Vẽ lại trạng thái tĩnh cuối cùng khi dừng
            // Sử dụng góc quay hiện tại thay vì 0
            drawScene(1.0, 1.0, 1.0, rotationAngle);
        }
    });

    resetButton.addEventListener("click", () => {
        stopAnimation(); // Dừng animation nếu đang chạy
        depthSlider.value = 1; // Đặt lại slider
        recursionDepth = 1;
        depthValue.textContent = recursionDepth;
        rotationAngle = 0; // Đặt lại góc quay
        updateFractal(); // Tạo lại và vẽ lại fractal ở trạng thái reset (sẽ gọi drawScene)
    });

    try {
         updateFractal();
    } catch(initialError) {
         console.error("Initial fractal generation failed:", initialError);
    }

}

const m3 = {
    identity: function() { return [1, 0, 0, 0, 1, 0, 0, 0, 1]; },
    translation: function(tx, ty) { return [1, 0, 0, 0, 1, 0, tx, ty, 1]; },
    rotation: function(angleInRadians) {
        const c = Math.cos(angleInRadians); const s = Math.sin(angleInRadians);
        return [c, -s, 0, s, c, 0, 0, 0, 1];
    },
    scaling: function(sx, sy) { return [sx, 0, 0, 0, sy, 0, 0, 0, 1]; },
    multiply: function(a, b) {
        const a00 = a[0*3+0], a01 = a[0*3+1], a02 = a[0*3+2];
        const a10 = a[1*3+0], a11 = a[1*3+1], a12 = a[1*3+2];
        const a20 = a[2*3+0], a21 = a[2*3+1], a22 = a[2*3+2];
        const b00 = b[0*3+0], b01 = b[0*3+1], b02 = b[0*3+2];
        const b10 = b[1*3+0], b11 = b[1*3+1], b12 = b[1*3+2];
        const b20 = b[2*3+0], b21 = b[2*3+1], b22 = b[2*3+2];
        return [
            b00*a00 + b01*a10 + b02*a20, b00*a01 + b01*a11 + b02*a21, b00*a02 + b01*a12 + b02*a22,
            b10*a00 + b11*a10 + b12*a20, b10*a01 + b11*a11 + b12*a21, b10*a02 + b11*a12 + b12*a22,
            b20*a00 + b21*a10 + b22*a20, b20*a01 + b21*a11 + b22*a21, b20*a02 + b21*a12 + b22*a22,
        ];
    },
    translate: function(m, tx, ty) { return m3.multiply(m, m3.translation(tx, ty)); },
    rotate: function(m, angleInRadians) { return m3.multiply(m, m3.rotation(angleInRadians)); },
    scale: function(m, sx, sy) { return m3.multiply(m, m3.scaling(sx, sy)); },
};

window.onload = main;