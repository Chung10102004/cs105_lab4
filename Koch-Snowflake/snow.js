"use strict";


// --- Shader Sources ---

const vsSource = `
    attribute vec2 a_position;
    uniform vec2 u_resolution;
    uniform mat3 u_transform; // Ma trận biến đổi (scale, translate)

    void main() {
      // Áp dụng ma trận biến đổi
      vec2 transformedPosition = (u_transform * vec3(a_position, 1.0)).xy;

      // Chuyển đổi từ pixel space sang clip space (-1 to +1)
      vec2 zeroToOne = transformedPosition / u_resolution;
      vec2 zeroToTwo = zeroToOne * 2.0;
      vec2 clipSpace = zeroToTwo - 1.0;

      // WebGL cần trục Y lật ngược so với hệ tọa độ canvas 2D thông thường
      gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    }
  `;

const fsSource = `
    precision mediump float;
    uniform vec4 u_color;

    void main() {
      gl_FragColor = u_color; // Màu trắng đơn giản
    }
  `;


// --- Logic tạo Koch Snowflake ---

// Lớp Vector 2D đơn giản để dễ tính toán
class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) {
        return new Vec2(this.x + v.x, this.y + v.y);
    }

    sub(v) {
        return new Vec2(this.x - v.x, this.y - v.y);
    }

    mult(scalar) {
        return new Vec2(this.x * scalar, this.y * scalar);
    }

    // Quay vector quanh gốc tọa độ theo độ (degrees)
    rotateDeg(angleDeg) {
        const angleRad = angleDeg * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
        const x = this.x * cosA - this.y * sinA;
        const y = this.x * sinA + this.y * cosA;
        return new Vec2(x, y);
    }
}

/**
 * Tạo các đỉnh cho một cạnh của đường Koch
 * @param {Vec2} p1 Điểm bắt đầu
 * @param {Vec2} p2 Điểm kết thúc
 * @param {number} depth Độ sâu đệ quy
 * @returns {Array<Vec2>} Mảng các điểm tạo thành đường Koch (không bao gồm p2)
 */
function generateKochSide(p1, p2, depth) {
    if (depth === 0) {
        return [p1]; // Chỉ trả về điểm bắt đầu
    } else {
        const v = p2.sub(p1); // Vector từ p1 đến p2
        const pA = p1;
        const pB = pA.add(v.mult(1 / 3));
        const pD = pA.add(v.mult(2 / 3));

        // Tính điểm C (đỉnh của tam giác nhô ra)
        // Quay vector (pD - pB) một góc -60 độ (để tạo tam giác đều) rồi cộng vào pB
        const segmentVec = pD.sub(pB);
        const pC = pB.add(segmentVec.rotateDeg(-60)); // -60 độ để nó "nhô ra ngoài"

        const points = [];
        points.push(...generateKochSide(pA, pB, depth - 1));
        points.push(...generateKochSide(pB, pC, depth - 1));
        points.push(...generateKochSide(pC, pD, depth - 1));
        points.push(...generateKochSide(pD, p2, depth - 1));
        return points;
    }
}

/**
 * Tạo tất cả các đỉnh cho bông tuyết Koch hoàn chỉnh
 * @param {Vec2} center Trung tâm của tam giác ban đầu
 * @param {number} radius Khoảng cách từ tâm đến đỉnh tam giác
 * @param {number} depth Độ sâu đệ quy
 * @returns {Array<number>} Mảng các tọa độ [x1, y1, x2, y2, ...]
 */
function generateKochSnowflakeVertices(center, radius, depth) {
    // Tính 3 đỉnh của tam giác đều ban đầu
    const angleStep = 360 / 3;
    const p1 = center.add(new Vec2(0, radius).rotateDeg(0));     // Đỉnh trên
    const p2 = center.add(new Vec2(0, radius).rotateDeg(angleStep)); // Đỉnh dưới phải
    const p3 = center.add(new Vec2(0, radius).rotateDeg(2 * angleStep)); // Đỉnh dưới trái

    // Tạo các điểm cho mỗi cạnh
    const side1Points = generateKochSide(p1, p2, depth);
    const side2Points = generateKochSide(p2, p3, depth);
    const side3Points = generateKochSide(p3, p1, depth);

    // Kết hợp tất cả các điểm và chuyển đổi Vec2 thành mảng [x, y, x, y, ...]
    const allPoints = [...side1Points, ...side2Points, ...side3Points];
    const vertices = [];
    for (const p of allPoints) {
        vertices.push(p.x, p.y);
    }

    return vertices;
}
function main() {
    const canvas = document.getElementById("glCanvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

    const program = webglUtils.createProgramFromSources(gl, [vsSource, fsSource]);
    
     const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
    const colorUniformLocation = gl.getUniformLocation(program, "u_color");
    const transformUniformLocation = gl.getUniformLocation(program, "u_transform");


    let recursionDepth = 1;
    let snowflakeRadius = 200;
    const center = new Vec2(0, 0);


 let vertices = generateKochSnowflakeVertices(center, snowflakeRadius, recursionDepth);
    let numVertices = vertices.length / 2;

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
     gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);


    let vao;
    if (gl instanceof WebGL2RenderingContext) {
        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
           gl.enableVertexAttribArray(positionAttributeLocation);
             const size = 2;
            const type = gl.FLOAT;
            const normalize = false;
           const stride = 0;
            const offset = 0;
       gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
        gl.bindVertexArray(null);   
    }





     let then = 0;
    let rotationAngle = 0;
   let isAnimating = false; // Biến cờ animation
      let animationFrameId;
        function render(now) {
          now *= 0.001;
        const deltaTime = now - then;
            then = now;

          rotationAngle += deltaTime;
         const colorR = Math.sin(now * 0.5) * 0.5 + 0.5;
         const colorG = Math.cos(now * 0.3) * 0.5 + 0.5;
         const colorB = Math.tan(now* 0.7) * 0.5 + 0.5;
      drawScene(colorR, colorG, colorB, rotationAngle);
            animationFrameId=requestAnimationFrame(render);
    }
        function stopAnimation() {
        cancelAnimationFrame(animationFrameId);
            isAnimating = false; // Đặt lại biến cờ
        animateButton.textContent = "Animate"; // Đặt lại text của nút
    }

    function drawScene(colorR, colorG, colorB, rotationAngle) {
    //    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
       if (webglUtils.resizeCanvasToDisplaySize(gl.canvas)) {
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
       }
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);

       if (vao) {
           gl.bindVertexArray(vao); // Bind VAO nếu được hỗ trợ
       } else {
           // Thiết lập lại attribute nếu không có VAO
           gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
           gl.enableVertexAttribArray(positionAttributeLocation);
           gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
       }

        gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
        gl.uniform4fv(colorUniformLocation, [colorR, colorG, colorB, 1]);


  const moveOriginMatrix = m3.translation(gl.canvas.width / 2, gl.canvas.height / 2);
        const rotationMatrix = m3.rotation(rotationAngle);
        const transformMatrix = m3.multiply(moveOriginMatrix, rotationMatrix);
        gl.uniformMatrix3fv(transformUniformLocation, false, transformMatrix);

        gl.drawArrays(gl.LINE_LOOP, 0, numVertices);
       if (vao) {
           gl.bindVertexArray(null); // Unbind VAO nếu được hỗ trợ
       }
    }

    const depthSlider = document.getElementById("depthSlider");
    const depthValue = document.getElementById("depthValue");
    depthValue.textContent = depthSlider.value;
  depthSlider.addEventListener("input", () => {
    recursionDepth = parseInt(depthSlider.value);
    depthValue.textContent = recursionDepth;
    updateSnowflake();
  });

        const animateButton = document.getElementById("animateButton");
        animateButton.addEventListener("click", () => {
            if (!isAnimating) {
        animateButton.textContent = "Stop";
                isAnimating = true;
                then = 0;
                requestAnimationFrame(render);
            } else {
                stopAnimation();
         }
        });

          document.getElementById("resetButton").addEventListener('click', () => {
              depthSlider.value = 1;
            recursionDepth = parseInt(depthSlider.value);
            depthValue.textContent = recursionDepth; // Cập nhật giá trị hiển thị
            updateSnowflake();
              rotationAngle = 0;
            drawScene(1, 1, 1, rotationAngle); // Vẽ lại với màu trắng
            stopAnimation();

          });

    function updateSnowflake() {
     vertices = generateKochSnowflakeVertices(
        center,
        snowflakeRadius,
        recursionDepth
      );
      numVertices = vertices.length / 2; // 2 coordinates per vertex

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
         if (vao) {
            gl.bindVertexArray(vao);
        }
      if (vao) {
           gl.bindVertexArray(null); // Unbind VAO nếu được hỗ trợ
       }
        drawScene(1,1,1,0);
    }

    updateSnowflake();


}

window.onload = main;

const m3 = {
    translation: function(tx, ty) {
        return [
            1, 0, 0,
            0, 1, 0,
            tx, ty, 1,
        ];
    },

    rotation: function(angleInRadians) {
        const c = Math.cos(angleInRadians);
        const s = Math.sin(angleInRadians);
        return [
            c, -s, 0,
            s, c, 0,
            0, 0, 1,
        ];
    },

    scale: function(sx, sy) {
        return [
            sx, 0, 0,
            0, sy, 0,
            0, 0, 1,
        ];
    },

     multiply: function(a, b) {
        var a00 = a[0 * 3 + 0];
        var a01 = a[0 * 3 + 1];
        var a02 = a[0 * 3 + 2];
        var a10 = a[1 * 3 + 0];
        var a11 = a[1 * 3 + 1];
        var a12 = a[1 * 3 + 2];
        var a20 = a[2 * 3 + 0];
        var a21 = a[2 * 3 + 1];
        var a22 = a[2 * 3 + 2];
        var b00 = b[0 * 3 + 0];
        var b01 = b[0 * 3 + 1];
        var b02 = b[0 * 3 + 2];
        var b10 = b[1 * 3 + 0];
        var b11 = b[1 * 3 + 1];
        var b12 = b[1 * 3 + 2];
        var b20 = b[2 * 3 + 0];
        var b21 = b[2 * 3 + 1];
        var b22 = b[2 * 3 + 2];
        return [
          b00 * a00 + b01 * a10 + b02 * a20,
          b00 * a01 + b01 * a11 + b02 * a21,
          b00 * a02 + b01 * a12 + b02 * a22,
          b10 * a00 + b11 * a10 + b12 * a20,
          b10 * a01 + b11 * a11 + b12 * a21,
          b10 * a02 + b11 * a12 + b12 * a22,
          b20 * a00 + b21 * a10 + b22 * a20,
          b20 * a01 + b21 * a11 + b22 * a21,
          b20 * a02 + b21 * a12 + b22 * a22,
        ];
      },

    translate: function(m, tx, ty) {
        return m3.multiply(m, m3.translation(tx, ty));
    },

    rotate: function(m, angleInRadians) {
        return m3.multiply(m, m3.rotation(angleInRadians));
    },

    scale: function(m, sx, sy) {
        return m3.multiply(m, m3.scale(sx, sy));
    },
};