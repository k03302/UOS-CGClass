import * as mat4 from "../lib/gl-matrix/mat4.js"
import * as vec4 from "../lib/gl-matrix/vec4.js"
import * as vec3 from "../lib/gl-matrix/vec3.js"
import * as quat from "../lib/gl-matrix/quat.js"
import { toRadian } from "../lib/gl-matrix/common.js"

"use strict";

const loc_aPosition = 0;
const loc_aTexCoords = 1;
const loc_aColor = 2;
const loc_aNormal = 3;
const loc_aDu = 4;
const loc_aDv = 5;

const TEXUNIT_PATCH = 1;



async function main() {
    const canvas = document.getElementById('webgl');
    const gl = canvas.getContext("webgl2");

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(.2, .2, .2, 1);

    const V = mat4.create();
    mat4.lookAt(V, [15, 0, 0], [0, 0, 0], [0, 0, 1]);

    const P = mat4.create();
    let fovy = 30;
    mat4.perspective(P, toRadian(fovy), 1, 1, 100);

    let lastX;
    let lastY;
    let angle = [0, 0];
    let dragging = false;

    canvas.onwheel = function (ev) {
        fovy += ev.deltaY * 0.1;
        fovy = Math.min(170, Math.max(3, fovy));
        mat4.perspective(P, toRadian(fovy), 1, 1, 100);
    }

    canvas.onmousedown = function (ev) {
        let bb = ev.target.getBoundingClientRect();
        let x = ev.clientX - bb.left;
        let y = bb.bottom - ev.clientY;
        let id = points.get_point_id(gl, { x, y }, V, P);

        if (id >= 0 && id < points.count) {
            points.selected = id;
            document.querySelector("#console").innerHTML = `Point #${points.selected} is selected.`;
        }
        else {
            points.selected = -1;
            document.querySelector("#console").innerHTML = "No point is selected.";
        }

        if (x >= 0 && x < canvas.clientWidth
            && y >= 0 && y < canvas.clientHeight) {
            lastX = x;
            lastY = y;
            dragging = true;
        }
    }
    canvas.onmouseup = function (ev) { dragging = false; points.selected = -1; };

    const VP = mat4.create();
    canvas.onmousemove = function (ev) {
        let bb = ev.target.getBoundingClientRect();
        let x = ev.clientX - bb.left;
        let y = bb.bottom - ev.clientY;
        if (dragging) {
            mat4.copy(VP, P);
            mat4.multiply(VP, VP, V);
            let viewport = gl.getParameter(gl.VIEWPORT);
            if (points.selected == -1) {
                let offset = [(x - lastX), -(y - lastY)];
                if (offset[0] != 0 || offset[1] != 0) // In case the offset becomes zero...
                {
                    let axis = unproject_vector([offset[1], offset[0], 0], VP, viewport);
                    mat4.rotate(V, V, toRadian(length2(offset)), [axis[0], axis[1], axis[2]]);
                }
            }
            else {
                let p_obj = points.get_point_selected();
                let p_win = project(p_obj, VP, viewport);
                let p_new = unproject([x, y, p_win[2]], VP, viewport);
                points.update_point_selected(p_new);
                document.querySelector("#console").innerHTML
                    = `Position of point #${points.selected}: (${Array.from(p_new.subarray(0, 3)).map(x => x.toFixed(2))})`;
            }
        }
        lastX = x;
        lastY = y;
    }
    const sun = {
        direction: [0, 0, 1],   // in camera coordinate system
        ambient: [.1, .1, .1],
        diffusive: [1, 1, 1],
        specular: [1, 1, 1],
    };
    const gold = {
        ambient: [0.24725, 0.1995, 0.0745],
        diffusive: [0.75164, 0.60648, 0.22648],
        specular: [0.628281, 0.555802, 0.366065],
        shininess: 128.0 * 0.4,
    };

    // initialize the axes
    let sources_axes = await fetch_shader_files("./resources/axes.vert", "./resources/axes.frag");
    sources_axes[0] = sources_axes[0].replace("${loc_aPosition}", loc_aPosition);
    sources_axes[0] = sources_axes[0].replace("${loc_aColor}", loc_aColor);
    const axes = new Axes(gl, sources_axes[0], sources_axes[1], 4);

    // initialize the points
    let sources_points = await fetch_shader_files("./resources/points.vert", "./resources/points.frag");
    sources_points[0] = sources_points[0].replace("${loc_aPosition}", loc_aPosition);
    sources_points[0] = sources_points[0].replace("${loc_aColor}", loc_aColor);

    let sources_points_id = await fetch_shader_files("./resources/points.vert", "./resources/points-id.frag");

    const points = new Points(gl, sources_points[0], sources_points[1], sources_points_id[1], canvas.clientWidth, canvas.clientHeight);


    // initialize the patch
    let img = await load_image("./proj3.png");
    let sources = await fetch_shader_files("./resources/texmap-patch.vert", "./resources/texmap-patch.frag");
    sources[0] = sources[0].replace("${loc_aTexCoords}", loc_aTexCoords);

    let patch = new Patch(gl, 20, img, sources[0], sources[1], sun, gold);

    let MVP = mat4.create();
    let tick = function () {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        axes.render(gl, V, P);


        points.upload_data(gl);
        points.render(gl, V, P);

        patch.render(gl, V, P, points);

        requestAnimationFrame(tick, canvas); // Request that the browser calls tick
    };
    tick();
}

class Shader {
    constructor(gl, src_vert, src_frag, uniform_vars = undefined) {
        this.h_prog = createProgram(gl, src_vert, src_frag);
        if (!this.h_prog) return;
        if (uniform_vars) {
            this.loc_uniforms = {};
            for (let uniform of uniform_vars) {
                this.loc_uniforms[uniform] = gl.getUniformLocation(this.h_prog, uniform);
            }
        }
        else {
            let num_uniforms = gl.getProgramParameter(this.h_prog, gl.ACTIVE_UNIFORMS);
            this.loc_uniforms = {};
            let uniform_info;
            for (let i = 0; i < num_uniforms; i++) {
                uniform_info = gl.getActiveUniform(this.h_prog, i);
                this.loc_uniforms[uniform_info.name] = gl.getUniformLocation(this.h_prog, uniform_info.name);
            }
        }

        function createProgram(gl, src_vert, src_frag) {
            let h_vert = compileShader(gl, gl.VERTEX_SHADER, src_vert);
            var h_frag = compileShader(gl, gl.FRAGMENT_SHADER, src_frag);
            if (!h_vert || !h_frag) return null;

            let h_prog = gl.createProgram();
            if (!h_prog) return null;

            gl.attachShader(h_prog, h_vert);
            gl.attachShader(h_prog, h_frag);
            gl.linkProgram(h_prog);

            let status = gl.getProgramParameter(h_prog, gl.LINK_STATUS);
            if (!status) {
                let err = gl.getProgramInfoLog(h_prog);
                console.log(`Link Error: ${err}`);
                gl.deleteProgram(h_prog);
                gl.deleteShader(h_vert);
                gl.deleteShader(h_frag);
                return null;
            }
            return h_prog;
        }

        function compileShader(gl, type, src) {
            let shader = gl.createShader(type);
            if (!shader) {
                console.log('Compile Error: Failed to create a shader.');
                return null;
            }

            gl.shaderSource(shader, src);

            gl.compileShader(shader);

            let status = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
            if (!status) {
                let err = gl.getShaderInfoLog(shader);
                console.log(`Compilation Error: ${err}`);
                gl.deleteShader(shader);
                return null;
            }

            return shader;
        }

    }

}

class Axes {
    constructor(gl, src_vert, src_frag, length = 2) {
        this.MVP = mat4.create();
        if (!Axes.shader) Axes.shader = new Shader(gl, src_vert, src_frag);
        this.init_vbo(gl, length);
    }
    init_vbo(gl, l) {
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        const vertices = new Float32Array([
            0, 0, 0, 1, 0, 0,
            l, 0, 0, 1, 0, 0,
            0, 0, 0, 0, 1, 0,
            0, l, 0, 0, 1, 0,
            0, 0, 0, 0, 0, 1,
            0, 0, l, 0, 0, 1,
        ]);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const SZ = vertices.BYTES_PER_ELEMENT;

        gl.vertexAttribPointer(loc_aPosition, 3, gl.FLOAT, false, SZ * 6, 0);
        gl.enableVertexAttribArray(loc_aPosition);

        gl.vertexAttribPointer(loc_aColor, 3, gl.FLOAT, false, SZ * 6, SZ * 3);
        gl.enableVertexAttribArray(loc_aColor);

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    set_uniform_matrices(gl, V, P) {
        mat4.copy(this.MVP, P);
        mat4.multiply(this.MVP, this.MVP, V);
        gl.uniformMatrix4fv(Axes.shader.loc_uniforms["MVP"], false, this.MVP);
    }
    render(gl, V, P) {
        gl.useProgram(Axes.shader.h_prog);
        gl.bindVertexArray(this.vao);
        this.set_uniform_matrices(gl, V, P);
        gl.drawArrays(gl.LINES, 0, 6);
        gl.bindVertexArray(null);
        gl.useProgram(null);
    }
}

function length2(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

// https://github.com/g-truc/glm/blob/master/glm/ext/matrix_projection.inl
function project(p_obj, MVP, viewport) {
    let tmp = vec4.create();
    vec4.transformMat4(tmp, [p_obj[0], p_obj[1], p_obj[2], 1], MVP);
    for (let i in [0, 1, 2]) tmp[i] /= tmp[3];
    for (let i = 0; i < 2; i++) tmp[i] = (0.5 * tmp[i] + 0.5) * viewport[i + 2] + viewport[i];
    return tmp;
}

// https://github.com/g-truc/glm/blob/master/glm/ext/matrix_projection.inl
function unproject(p_win, MVP, viewport) {
    let MVP_inv = mat4.create();
    mat4.invert(MVP_inv, MVP);
    let tmp = mat4.clone([p_win[0], p_win[1], p_win[2], 1.0]);
    for (let i = 0; i < 2; i++) tmp[i] = 2.0 * (tmp[i] - viewport[i]) / viewport[i + 2] - 1.0;
    let p_obj = vec4.create();
    vec4.transformMat4(p_obj, tmp, MVP_inv);
    for (let i in [0, 1, 2]) p_obj[i] /= p_obj[3];
    return p_obj;
}

export function unproject_vector(vec_win, MVP, viewport) {
    let org_win = project([0, 0, 0], MVP, viewport);
    return unproject([org_win[0] + vec_win[0], org_win[1] + vec_win[1], org_win[2] + vec_win[2]], MVP, viewport);
}


async function fetch_shader_files(url_vert, url_frag) {
    return Promise.all([url_vert, url_frag].map(url => fetch(url)))
        .then(responses => Promise.all(responses.map(
            function (response) {
                if (response.ok) return response.text();
                else throw new Error(`Error while reading ${response.url}.`);
            })));
}

function load_image(url) {
    return new Promise(function (resolve, reject) {
        let img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Error while loading image "${url}"`));
        img.src = url;
    });
}

class Patch {
    constructor(gl, N, image, src_vert, src_frag, light, material) {
        this.shader = new Shader(gl, src_vert, src_frag);
        this.init_patch(gl, N);
        this.init_texture(gl, image);

        gl.useProgram(this.shader.h_prog);
        gl.uniform1i(this.shader.loc_uniforms["tex"], TEXUNIT_PATCH);
        gl.uniform3fv(this.shader.loc_uniforms["sun.direction"], light.direction);
        gl.uniform3fv(this.shader.loc_uniforms["sun.ambient"], light.ambient);
        gl.uniform3fv(this.shader.loc_uniforms["sun.diffusive"], light.diffusive);
        gl.uniform3fv(this.shader.loc_uniforms["sun.specular"], light.specular);
        gl.uniform3fv(this.shader.loc_uniforms["material.ambient"], material.ambient);
        gl.uniform3fv(this.shader.loc_uniforms["material.diffusive"], material.diffusive);
        gl.uniform3fv(this.shader.loc_uniforms["material.specular"], material.specular);
        gl.uniform1f(this.shader.loc_uniforms["material.shininess"], material.shininess);
        gl.useProgram(null);
    }

    init_texture(gl, image) {

        this.texture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        gl.bindTexture(gl.TEXTURE_2D, null);

    }

    init_patch(gl, N) {
        this.init_vao(gl, N);
        this.init_ubo(gl);
    }

    init_ubo(gl) {
        gl.uniformBlockBinding(this.shader.h_prog, this.shader.loc_uniforms["pointData"], 0);
        this.ubo = gl.createBuffer();
        gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.ubo);

        const FSIZE = 4;
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo);
        gl.bufferData(gl.UNIFORM_BUFFER, FSIZE * 4 * 16, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    }

    init_vao(gl, N) {
        let texcoord = [];
        for (let row = 0; row <= N; row++) {
            for (let col = 0; col <= N; col++) {
                texcoord.push(row / N);
                texcoord.push(col / N);
            }
        }


        let indices = [];
        for (let row = 0; row < N; row++) {
            for (let col = 0; col < N; col++) {
                indices.push(row + col * (N + 1));
                indices.push(row + (col + 1) * (N + 1));
                indices.push(row + col * (N + 1) + 1);

                indices.push(row + col * (N + 1) + 1);
                indices.push(row + (col + 1) * (N + 1));
                indices.push((row + 1) + (col + 1) * (N + 1));
            }
        }

        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        var buf_texcoord = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf_texcoord);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoord), gl.STATIC_DRAW);

        gl.vertexAttribPointer(loc_aTexCoords, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(loc_aTexCoords);


        var buf_index = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf_index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        gl.bindVertexArray(null);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        this.num_indices = indices.length;
    }

    render(gl, V, P, points = null) {
        let MVP = mat4.create();
        let viewerPos = vec3.create();
        let viewerQuat = quat.create();

        mat4.copy(MVP, P);
        mat4.multiply(MVP, MVP, V);


        mat4.getTranslation(viewerPos, V);
        mat4.getRotation(viewerQuat, V);
        vec3.transformQuat(viewerPos, viewerPos, viewerQuat);


        gl.useProgram(this.shader.h_prog);
        gl.uniform3fv(this.shader.loc_uniforms["uViewerPos"], viewerPos);
        gl.uniformMatrix4fv(this.shader.loc_uniforms["MVP"], false, MVP);
        gl.uniformMatrix4fv(this.shader.loc_uniforms["matNormal"], false, V);
        gl.uniformMatrix4fv(this.shader.loc_uniforms["MV"], false, V);

        gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, points.getPoints4());
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);

        gl.activeTexture(gl.TEXTURE0 + TEXUNIT_PATCH);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.bindVertexArray(this.vao);
        gl.drawElementsInstanced(gl.TRIANGLES, this.num_indices, gl.UNSIGNED_SHORT, 0, 16);
    }

}

class Points {
    constructor(gl, src_vert, src_frag, src_frag_id, width, height) {
        this.MVP = mat4.create();
        if (!Points.shader) Points.shader = new Shader(gl, src_vert, src_frag);
        if (!Points.shader_id) Points.shader_id = new Shader(gl, src_vert, src_frag_id);
        this.init_vbo(gl);
        this.init_fbo(gl, width, height);
    }

    getPoints4() {
        let points4 = [];
        let i = 0;
        for (let x of this.points) {
            points4.push(x);
            if (i < 2) {
                i++;
            } else {
                i = 0;
                points4.push(1);
            }
        }
        return new Float32Array(points4);
    }

    init_vbo(gl, l) {
        this.count = 16;
        this.points = new Float32Array([
            -2, -2, -2,
            -2, 2, -2,
            2, 2, -2,
            2, -2, -2,
            -2, -2, 2,
            -2, 2, 2,
            2, 2, 2,
            2, -2, 2,

            -6, -6, 2,
            -6, 6, 2,
            6, 6, 2,
            6, -6, 2,
            -6, -6, -2,
            -6, 6, -2,
            6, 6, -2,
            6, -6, -2,
        ]);

        const ids = new Uint8Array([
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
        ]);
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        this.vbo_position = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo_position);
        gl.bufferData(gl.ARRAY_BUFFER, this.points, gl.DYNAMIC_DRAW);  // DYNAMI_DRAW!!!

        gl.vertexAttribPointer(loc_aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(loc_aPosition);

        const vbo_id = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo_id);
        gl.bufferData(gl.ARRAY_BUFFER, ids, gl.STATIC_DRAW);

        gl.vertexAttribPointer(loc_aColor, 1, gl.UNSIGNED_BYTE, true, 0, 0);
        gl.enableVertexAttribArray(loc_aColor);

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

    }
    set_uniform_matrices(gl, shader, V, P) {
        mat4.copy(this.MVP, P);
        mat4.multiply(this.MVP, this.MVP, V);
        gl.uniformMatrix4fv(shader.loc_uniforms["MVP"], false, this.MVP);
    }
    render(gl, V, P) {
        gl.useProgram(Points.shader.h_prog);
        gl.bindVertexArray(this.vao);
        this.set_uniform_matrices(gl, Points.shader, V, P);
        gl.drawArrays(gl.POINTS, 0, 16);
        gl.bindVertexArray(null);
        gl.useProgram(null);
    }
    render_id(gl, V, P) {
        gl.useProgram(Points.shader_id.h_prog);
        gl.bindVertexArray(this.vao);
        this.set_uniform_matrices(gl, Points.shader_id, V, P);
        gl.drawArrays(gl.POINTS, 0, 16);
        gl.bindVertexArray(null);
        gl.useProgram(null);
    }

    upload_data(gl) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo_position);
        gl.bufferData(gl.ARRAY_BUFFER, this.points, gl.DYNAMIC_DRAW);  // DYNAMI_DRAW!!!
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    get_point_selected() {
        let index = this.selected;
        return [this.points[index * 3], this.points[index * 3 + 1], this.points[index * 3 + 2]];
    }
    update_point_selected(position) {
        this.points.set([position[0], position[1], position[2]], this.selected * 3);
    }
    init_fbo(gl, fbo_width, fbo_height) {
        this.fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);

        const rbo_color = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rbo_color);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, fbo_width, fbo_height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rbo_color);

        const rbo_depth = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rbo_depth);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, fbo_width, fbo_height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo_depth);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    get_point_id(gl, position, V, P) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.clearColor(1, 1, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        this.render_id(gl, V, P);

        let pixels = new Uint8Array(4);

        gl.readPixels(position.x, position.y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(.2, .2, .2, 1);

        return pixels[0];
    }



}




main();


