"use strict";

// --- Shader Sources (Giữ nguyên) ---
const vsSource = `
    attribute vec2 a_position;
    uniform vec2 u_resolution;
    uniform mat3 u_transform;

    void main() {
      vec2 transformedPosition = (u_transform * vec3(a_position, 1.0)).xy;
      vec2 zeroToOne = transformedPosition / u_resolution;
      vec2 zeroToTwo = zeroToOne * 2.0;
      vec2 clipSpace = zeroToTwo - 1.0;
      gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    }
`;
const fsSource = `
    precision mediump float;
    uniform vec4 u_color;
    void main() { gl_FragColor = u_color; }
`;

// --- Lớp Vec2 (Giữ nguyên) ---
class Vec2 {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
    mult(scalar) { return new Vec2(this.x * scalar, this.y * scalar); }
    // rotateDeg không cần thiết cho Carpet nhưng để lại cũng không sao
    rotateDeg(angleDeg) { const angleRad = angleDeg * Math.PI / 180; const cosA = Math.cos(angleRad); const sinA = Math.sin(angleRad); const x = this.x * cosA - this.y * sinA; const y = this.x * sinA + this.y * cosA; return new Vec2(x, y); }
}


/**
 * Hàm đệ quy tạo các đỉnh cho các hình vuông con.
 * @param {Vec2} origin Điểm gốc (thường là dưới trái) của hình vuông hiện tại
 * @param {number} size Kích thước cạnh của hình vuông hiện tại
 * @param {number} depth Độ sâu đệ quy còn lại
 * @param {Array<number>} vertices Mảng tích lũy các đỉnh
 */
function generateSierpinskiCarpet(origin, size, depth, vertices) {
    if (depth <= 0) {
        const p1 = origin;                           // Dưới trái
        const p2 = origin.add(new Vec2(size, 0));    // Dưới phải
        const p3 = origin.add(new Vec2(size, size)); // Trên phải
        const p4 = origin.add(new Vec2(0, size));    // Trên trái

        vertices.push(p1.x, p1.y, p2.x, p2.y, p4.x, p4.y);
        vertices.push(p2.x, p2.y, p3.x, p3.y, p4.x, p4.y);
    } else {
        const subSize = size / 3;
        for (let i = 0; i < 3; i++) { // Hàng (y)
            for (let j = 0; j < 3; j++) { // Cột (x)
                // Bỏ qua ô ở giữa (i=1, j=1)
                if (i === 1 && j === 1) {
                    continue;
                }
                const subOrigin = origin.add(new Vec2(j * subSize, i * subSize));
                generateSierpinskiCarpet(subOrigin, subSize, depth - 1, vertices);
            }
        }
    }
}

/**
 * Tạo tất cả các đỉnh cho Thảm Sierpinski hoàn chỉnh
 * @param {Vec2} center Trung tâm của hình vuông ban đầu
 * @param {number} size Kích thước cạnh của hình vuông ban đầu
 * @param {number} depth Độ sâu đệ quy
 * @returns {Array<number>} Mảng các tọa độ [x1, y1, x2, y2, ...]
 */
function generateSierpinskiCarpetVertices(center, size, depth) {
    const halfSize = size / 2;
    const initialOrigin = center.add(new Vec2(-halfSize, -halfSize));

    const vertices = [];
    generateSierpinskiCarpet(initialOrigin, size, depth, vertices);
    return vertices;
}


function main() {
    const canvas = document.getElementById("glCanvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) { alert("Không thể khởi tạo WebGL."); return; }

    const program = webglUtils.createProgramFromSources(gl, [vsSource, fsSource]);
    if (!program) { console.error("Không thể tạo WebGL program."); return; }

    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
    const colorUniformLocation = gl.getUniformLocation(program, "u_color");
    const transformUniformLocation = gl.getUniformLocation(program, "u_transform");

    let recursionDepth = 1;
    let carpetSize = Math.min(window.innerWidth, window.innerHeight) * 0.7; 
    const center = new Vec2(0, 0); 

    let vertices = [];
    let numVertices = 0;
    const positionBuffer = gl.createBuffer();

    let vao;
    const size = 2; const type = gl.FLOAT; const normalize = false; const stride = 0; const offset = 0;
    if (gl instanceof WebGL2RenderingContext) {
        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    let animationFrameId = null;
    let isAnimating = false;
    let then = 0;
    let rotationAngle = 0; 

    function render(now) {
        now *= 0.001; const deltaTime = now - then; then = now;
        rotationAngle += deltaTime * 0.3; 
        const colorR = Math.cos(now * 0.5 + Math.PI/3) * 0.5 + 0.5; 
        const colorG = Math.sin(now * 0.7) * 0.5 + 0.5;
        const colorB = Math.cos(now * 0.4) * 0.5 + 0.5;
        drawScene(colorR, colorG, colorB, rotationAngle);
        if (isAnimating) { animationFrameId = requestAnimationFrame(render); }
    }

    function stopAnimation() {
        if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
        isAnimating = false;
        if (animateButton) animateButton.textContent = "Animate";
    }

    function drawScene(colorR, colorG, colorB, currentRotation) {
        if (webglUtils.resizeCanvasToDisplaySize(gl.canvas)) {
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        }
        gl.clearColor(0.1, 0.1, 0.15, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);

        if (vao) { gl.bindVertexArray(vao); }
        else { 
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.enableVertexAttribArray(positionAttributeLocation);
            gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
        }

        gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
        gl.uniform4f(colorUniformLocation, colorR, colorG, colorB, 1.0);

        const moveOriginX = gl.canvas.width / 2;
        const moveOriginY = gl.canvas.height / 2;
        const translationMatrix = m3.translation(moveOriginX, moveOriginY);
        const rotationMatrix = m3.rotation(currentRotation);
        let matrix = m3.multiply(translationMatrix, rotationMatrix);
        gl.uniformMatrix3fv(transformUniformLocation, false, matrix);

        // *** Vẽ tam giác (mỗi hình vuông là 2 tam giác) ***
        if (numVertices > 0) {
            gl.drawArrays(gl.TRIANGLES, 0, numVertices);
        }

        if (vao) { gl.bindVertexArray(null); }
    }

    function updateCarpet() { 
         console.time(`generate vertices depth ${recursionDepth}`);
        try {
            vertices = generateSierpinskiCarpetVertices(center, carpetSize, recursionDepth); 
            numVertices = vertices.length / 2;
            console.log(`Generated ${numVertices / 6} squares (Depth ${recursionDepth})`); 
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            console.timeEnd(`generate vertices depth ${recursionDepth}`);

            if (!isAnimating) {
                drawScene(1.0, 1.0, 1.0, rotationAngle);
            }
        } catch (error) { console.error("Error generating/buffering vertices:", error); }
    }

    const depthSlider = document.getElementById("depthSlider");
    const depthValue = document.getElementById("depthValue");
    const animateButton = document.getElementById("animateButton");
    const resetButton = document.getElementById("resetButton");
    if (!depthSlider || !depthValue || !animateButton || !resetButton) { console.error("UI elements not found!"); return; }
    depthValue.textContent = depthSlider.value;
    depthSlider.addEventListener("input", () => {
        recursionDepth = parseInt(depthSlider.value);
        depthValue.textContent = recursionDepth;
        updateCarpet(); // Gọi hàm cập nhật tương ứng
    });
    animateButton.addEventListener("click", () => {
        if (!isAnimating) { isAnimating = true; animateButton.textContent = "Stop"; then = performance.now() * 0.001; animationFrameId = requestAnimationFrame(render); }
        else { stopAnimation(); drawScene(1.0, 1.0, 1.0, rotationAngle); }
    });
    resetButton.addEventListener("click", () => {
        stopAnimation(); depthSlider.value = 1; recursionDepth = 1; depthValue.textContent = recursionDepth; rotationAngle = 0;
        updateCarpet(); // Gọi hàm cập nhật tương ứng
    });

    try { updateCarpet(); } // Gọi hàm cập nhật ban đầu
    catch(initialError) { console.error("Initial generation failed:", initialError); }
}

const m3 = { 
    identity: function() { return [1, 0, 0, 0, 1, 0, 0, 0, 1]; },
    translation: function(tx, ty) { return [1, 0, 0, 0, 1, 0, tx, ty, 1]; },
    rotation: function(angleInRadians) { const c = Math.cos(angleInRadians); const s = Math.sin(angleInRadians); return [c, -s, 0, s, c, 0, 0, 0, 1]; },
    scaling: function(sx, sy) { return [sx, 0, 0, 0, sy, 0, 0, 0, 1]; },
    multiply: function(a, b) { /* ... copy phép nhân ma trận ... */
        const a00=a[0],a01=a[1],a02=a[2],a10=a[3],a11=a[4],a12=a[5],a20=a[6],a21=a[7],a22=a[8];
        const b00=b[0],b01=b[1],b02=b[2],b10=b[3],b11=b[4],b12=b[5],b20=b[6],b21=b[7],b22=b[8];
        return[b00*a00+b01*a10+b02*a20,b00*a01+b01*a11+b02*a21,b00*a02+b01*a12+b02*a22,
               b10*a00+b11*a10+b12*a20,b10*a01+b11*a11+b12*a21,b10*a02+b11*a12+b12*a22,
               b20*a00+b21*a10+b22*a20,b20*a01+b21*a11+b22*a21,b20*a02+b21*a12+b22*a22];
    },
    translate: function(m, tx, ty) { return m3.multiply(m, m3.translation(tx, ty)); },
    rotate: function(m, angleInRadians) { return m3.multiply(m, m3.rotation(angleInRadians)); },
    scale: function(m, sx, sy) { return m3.multiply(m, m3.scaling(sx, sy)); },
};


window.onload = main;