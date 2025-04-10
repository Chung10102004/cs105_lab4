"use strict";

// --- Shader Sources (Unchanged) ---
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

    void main() {
      gl_FragColor = u_color;
    }
`;

// --- Lớp Vec2 (Unchanged) ---
class Vec2 { /* ... */
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
    mult(scalar) { return new Vec2(this.x * scalar, this.y * scalar); }
    rotateDeg(angleDeg) {
        const angleRad = angleDeg * Math.PI / 180; const cosA = Math.cos(angleRad); const sinA = Math.sin(angleRad);
        const x = this.x * cosA - this.y * sinA; const y = this.x * sinA + this.y * cosA; return new Vec2(x, y);
    }
}

// --- Logic tạo Minkowski Island Side (Unchanged) ---
function generateMinkowskiSide(p1, p2, depth) { /* ... */
    if (depth <= 0) { return [p1]; }
    else {
        const v = p2.sub(p1); const v_quart = v.mult(1 / 4); const pA = p1.add(v_quart); const pB = pA.add(v.rotateDeg(90).mult(1 / 4));
        const pC = pB.add(v_quart); const pD = pC.add(v.rotateDeg(-90).mult(1 / 4)); const pE = pD.add(v.rotateDeg(-90).mult(1 / 4));
        const pF = pE.add(v_quart); const pG = p1.add(v.mult(3 / 4)); const points = [];
        points.push(...generateMinkowskiSide(p1, pA, depth - 1)); points.push(...generateMinkowskiSide(pA, pB, depth - 1));
        points.push(...generateMinkowskiSide(pB, pC, depth - 1)); points.push(...generateMinkowskiSide(pC, pD, depth - 1));
        points.push(...generateMinkowskiSide(pD, pE, depth - 1)); points.push(...generateMinkowskiSide(pE, pF, depth - 1));
        points.push(...generateMinkowskiSide(pF, pG, depth - 1)); points.push(...generateMinkowskiSide(pG, p2, depth - 1));
        return points;
    }
}

// --- Tạo đỉnh Minkowski Island (Unchanged) ---
function generateMinkowskiIslandVertices(center, baseSize, depth) { /* ... */
    const halfSize = baseSize / 2; const p1 = center.add(new Vec2(-halfSize, -halfSize)); const p2 = center.add(new Vec2( halfSize, -halfSize));
    const p3 = center.add(new Vec2( halfSize,  halfSize)); const p4 = center.add(new Vec2(-halfSize,  halfSize));
    const side1Points = generateMinkowskiSide(p1, p2, depth); const side2Points = generateMinkowskiSide(p2, p3, depth);
    const side3Points = generateMinkowskiSide(p3, p4, depth); const side4Points = generateMinkowskiSide(p4, p1, depth);
    const allPoints = [...side1Points, ...side2Points, ...side3Points, ...side4Points]; const vertices = [];
    for (const p of allPoints) { vertices.push(p.x, p.y); } return vertices;
}


// --- Main WebGL Function ---
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

    // --- State Variables ---
    let recursionDepth = 3; const baseSize = 10; const center = new Vec2(0, 0);
    let vertices = []; let numVertices = 0; const positionBuffer = gl.createBuffer();

    // --- VAO Setup (Unchanged) ---
    let vao; const size = 2, type = gl.FLOAT, normalize = false, stride = 0, offset = 0;
    if (gl instanceof WebGL2RenderingContext) { /* ... VAO setup ... */
        vao = gl.createVertexArray(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(positionAttributeLocation); gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
        gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    } else { /* WebGL1 setup */ }

    // --- Animation State ---
    let animationFrameId = null; let isAnimating = false; let then = 0; let rotationAngle = 0;

    // --- Render function (MODIFIED: passes dynamic color) ---
    function render(now) {
        now *= 0.001; const deltaTime = now - then; then = now;
        rotationAngle += deltaTime * 2;

        // Tính toán màu sắc thay đổi động
        const colorR = Math.cos(now * 0.6) * 0.5 + 0.5;
        const colorG = Math.sin(now * 0.4) * 0.5 + 0.5;
        const colorB = Math.cos(now * 0.8 + Math.PI / 2) * 0.5 + 0.5;

        // Gọi drawScene với màu động đã tính
        drawScene(colorR, colorG, colorB, rotationAngle);

        if (isAnimating) { animationFrameId = requestAnimationFrame(render); }
    }

    // --- Stop Animation function (MODIFIED: draws static white after stop) ---
    function stopAnimation() {
        if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
        isAnimating = false;
        if (animateButton) animateButton.textContent = "Animate";
        // Vẽ lại trạng thái tĩnh cuối cùng với màu trắng
        drawScene(1.0, 1.0, 1.0, rotationAngle);
    }

    // --- Draw Scene function (Unchanged logic, uses received color) ---
    function drawScene(lineR, lineG, lineB, currentRotation) {
        const resized = webglUtils.resizeCanvasToDisplaySize(gl.canvas);
        if (resized) { gl.viewport(0, 0, gl.canvas.width, gl.canvas.height); }

        gl.clearColor(0.1, 0.1, 0.15, 1.0); // Background color
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);

        // Bind VAO or Attributes
        if (vao) { gl.bindVertexArray(vao); }
        else { /* WebGL1 Bind/Enable/Pointer */
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.enableVertexAttribArray(positionAttributeLocation);
            gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
         }

        // --- Tính toán Bounding Box và Scale (Unchanged) ---
        let finalScale = 0.5;
        if (vertices.length > 0) {
            let minX=vertices[0], maxX=vertices[0], minY=vertices[1], maxY=vertices[1];
            for (let i=2; i<vertices.length; i+=2) { minX=Math.min(minX, vertices[i]); maxX=Math.max(maxX, vertices[i]); minY=Math.min(minY, vertices[i+1]); maxY=Math.max(maxY, vertices[i+1]); }
            const fractalWidth = maxX - minX; const fractalHeight = maxY - minY;
            if (fractalWidth > 0 && fractalHeight > 0) {
                const scaleX = gl.canvas.width / fractalWidth; const scaleY = gl.canvas.height / fractalHeight;
                finalScale = Math.min(scaleX, scaleY) * 0.7; // Add padding
            }
        }
        // ------------------------------------

        gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
        gl.uniform4f(colorUniformLocation, lineR, lineG, lineB, 1.0);

        const canvasCenterX = gl.canvas.width / 2; const canvasCenterY = gl.canvas.height / 2;
        let matrix = m3.scaling(finalScale, finalScale);
        matrix = m3.multiply(m3.rotation(currentRotation), matrix);
        matrix = m3.multiply(m3.translation(canvasCenterX, canvasCenterY), matrix);
        gl.uniformMatrix3fv(transformUniformLocation, false, matrix);
        // -----------------------------------------

        // --- Vẽ ---
        if (numVertices > 0) { gl.drawArrays(gl.LINE_LOOP, 0, numVertices); }

        // --- Cleanup ---
        if (vao) { gl.bindVertexArray(null); }
    }

    function updateFractal() {
        try {
            vertices = generateMinkowskiIslandVertices(center, baseSize, recursionDepth);
            numVertices = vertices.length / 2;
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);

            // Vẽ lại ngay lập tức với màu trắng nếu không đang chạy animation
            if (!isAnimating) {
                drawScene(1.0, 1.0, 1.0, rotationAngle); // Màu trắng tĩnh
            }
        } catch (error) {
            console.error("Error generating or buffering vertices:", error);
        }
    }

    const depthSlider = document.getElementById("depthSlider");
    const depthValue = document.getElementById("depthValue");
    const animateButton = document.getElementById("animateButton");
    const resetButton = document.getElementById("resetButton");

    if (!depthSlider || !depthValue || !animateButton || !resetButton) { console.error("UI elements not found!"); return; }
    depthSlider.min = "0"; depthSlider.max = "5"; depthSlider.value = recursionDepth; depthValue.textContent = recursionDepth;

    depthSlider.addEventListener("input", () => {
        recursionDepth = parseInt(depthSlider.value); depthValue.textContent = recursionDepth;
        if (isAnimating) stopAnimation(); // Dừng animation và vẽ màu trắng
        updateFractal(); // Sẽ gọi drawScene với màu trắng
    });

    animateButton.addEventListener("click", () => {
        if (!isAnimating) {
            isAnimating = true;
            animateButton.textContent = "Stop";
            then = performance.now() * 0.001; // Reset time cho animation màu/quay
            animationFrameId = requestAnimationFrame(render);
        } else {
            stopAnimation();
        }
    });

    resetButton.addEventListener("click", () => {
        stopAnimation(); // Dừng animation và vẽ màu trắng
        recursionDepth = 3; depthSlider.value = recursionDepth; depthValue.textContent = recursionDepth; rotationAngle = 0;
        updateFractal(); // Sẽ gọi drawScene với màu trắng
    });

    try { updateFractal(); }
    catch(initialError) { console.error("Initial fractal generation failed:", initialError); }
}

const m3 = { 
    identity: function() { return [1, 0, 0, 0, 1, 0, 0, 0, 1]; }, translation: function(tx, ty) { return [1, 0, 0, 0, 1, 0, tx, ty, 1]; },
    rotation: function(angleInRadians) { const c=Math.cos(angleInRadians),s=Math.sin(angleInRadians); return [c,-s,0, s,c,0, 0,0,1]; },
    scaling: function(sx, sy) { return [sx,0,0, 0,sy,0, 0,0,1]; },
    multiply: function(a, b) { const a00=a[0],a01=a[1],a02=a[2],a10=a[3],a11=a[4],a12=a[5],a20=a[6],a21=a[7],a22=a[8]; const b00=b[0],b01=b[1],b02=b[2],b10=b[3],b11=b[4],b12=b[5],b20=b[6],b21=b[7],b22=b[8]; return [b00*a00+b01*a10+b02*a20,b00*a01+b01*a11+b02*a21,b00*a02+b01*a12+b02*a22, b10*a00+b11*a10+b12*a20,b10*a01+b11*a11+b12*a21,b10*a02+b11*a12+b12*a22, b20*a00+b21*a10+b22*a20,b20*a01+b21*a11+b22*a21,b20*a02+b21*a12+b22*a22]; },
    translate: function(m, tx, ty) { return m3.multiply(m, m3.translation(tx, ty)); }, rotate: function(m, angleInRadians) { return m3.multiply(m, m3.rotation(angleInRadians)); }, scale: function(m, sx, sy) { return m3.multiply(m, m3.scaling(sx, sy)); },
};

const webglUtils = { 
    createProgramFromSources: function(gl, shaderSources) { /* ... */ const vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, shaderSources[0]); gl.compileShader(vs); if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) { console.error("VS Error:", gl.getShaderInfoLog(vs)); gl.deleteShader(vs); return null; } const fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, shaderSources[1]); gl.compileShader(fs); if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) { console.error("FS Error:", gl.getShaderInfoLog(fs)); gl.deleteShader(vs); gl.deleteShader(fs); return null; } const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.error("Program Link Error:", gl.getProgramInfoLog(program)); gl.deleteProgram(program); return null; } gl.detachShader(program, vs); gl.deleteShader(vs); gl.detachShader(program, fs); gl.deleteShader(fs); return program; },
    resizeCanvasToDisplaySize: function(canvas, multiplier) { /* ... */ multiplier = multiplier || 1; const width  = canvas.clientWidth  * multiplier | 0; const height = canvas.clientHeight * multiplier | 0; if (canvas.width !== width ||  canvas.height !== height) { canvas.width  = width; canvas.height = height; return true; } return false; }
};

window.onload = main;