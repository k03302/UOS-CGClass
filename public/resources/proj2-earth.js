import * as mat4 from "../lib/gl-matrix/mat4.js";
import { toRadian } from "../lib/gl-matrix/common.js";

const loc_aPosition = 0;
const loc_aNormal = 1;
const loc_aTexCoord = 2;

const src_vert =
    `#version 300 es
layout(location=${loc_aPosition}) in vec4 aPosition;
layout(location=${loc_aNormal}) in vec3 aNormal;
layout(location=${loc_aTexCoord}) in vec2 aTexCoord;

uniform vec3 uPointLightWorldPosition;
uniform vec3 uSpotLightWorldPosition;

uniform vec3 uViewWorldPosition;
uniform mat4 uWorld;
uniform mat4 uWorldViewProjection;
uniform mat4 uWorldInverseTranspose;
uniform sampler2D uBumpSampler;

out vec2 vTexCoord;
out vec3 vNormal;
out vec3 vSurfaceToPointLight;
out vec3 vSurfaceToSpotLight;
out vec3 vSurfaceToView;



void main() 
{
    vec3 bumpColor = texture(uBumpSampler, vTexCoord).rgb;
    float bumpAmount = bumpColor.g;

    vec3 displace = aPosition.xyz;

    
    vNormal = mat3(uWorldInverseTranspose) * aNormal;
    vec3 surfaceWorldPosition = (uWorld * aPosition).xyz;
    vSurfaceToPointLight = uPointLightWorldPosition - surfaceWorldPosition;
    vSurfaceToSpotLight = uSpotLightWorldPosition - surfaceWorldPosition;
    vSurfaceToView = uViewWorldPosition - surfaceWorldPosition;
    vTexCoord = aTexCoord;
    gl_Position = uWorldViewProjection * uWorld * vec4(displace, 1.0);

}`;
const src_frag =
    `#version 300 es
precision mediump float;

uniform sampler2D uImgSampler;
uniform sampler2D uSpecSampler;
uniform float uCutOffCos;
uniform bool uPointLightOn;
uniform bool uSpotLightOn;

out vec4 fColor;

in vec2 vTexCoord;
in vec3 vNormal;
in vec3 vSurfaceToPointLight;
in vec3 vSurfaceToSpotLight;
in vec3 vSurfaceToView;

const float diffusiveIntensity = 2.0;
const float specularIntensity = 0.1;
const float shininess = 5.0;

void main() 
{

    vec3 normal = normalize(vNormal);
    vec3 surfaceToPointLightDirection = normalize(vSurfaceToPointLight);
    vec3 surfaceToSpotLightDirection = normalize(vSurfaceToSpotLight);
    vec3 surfaceToViewDirection = normalize(vSurfaceToView);
    vec3 pointLightHalfVector = normalize(surfaceToPointLightDirection + surfaceToViewDirection);
    vec3 spotLightHalfVector = normalize(surfaceToSpotLightDirection + surfaceToViewDirection);


    vec3 imgColor = texture(uImgSampler, vTexCoord).rgb;
    vec3 specColor = texture(uSpecSampler, vTexCoord).rgb;
    
    float specularIntensity = specColor.g;
    
    float ambient = 0.1;
    float pointLight = 0.0;
    float pointSpecular = 0.0;
    if(uPointLightOn) {
        pointLight = dot(normal, surfaceToPointLightDirection);
        if(pointLight > 0.0 && dot(normal, pointLightHalfVector) > 0.0) {
            pointSpecular = specularIntensity * pow(dot(normal, pointLightHalfVector), shininess);
        }
    }

    float spotLight = 0.0;
    float spotSpecular = 0.0;
    float cos = dot(normal, surfaceToSpotLightDirection);
    if(uSpotLightOn && cos > uCutOffCos) {
        spotLight = cos;
        if(dot(normal, spotLightHalfVector) > 0.0) {
            spotSpecular = specularIntensity * pow(dot(normal, spotLightHalfVector), shininess);
        }
    }

    imgColor.rgb *= (ambient + pointLight + spotLight);
    imgColor.rgb += pointSpecular + spotSpecular;
    fColor = vec4(imgColor, 1.0);
}`;

const line_loc_aPosition = 0;
const line_loc_aColor = 1;

const line_vert =
    `#version 300 es
layout(location=${line_loc_aPosition}) in vec4 aPosition;
layout(location=${line_loc_aColor}) in vec4 aColor;
uniform mat4 MVP;
out vec4 vColor;
void main()
{
    gl_Position = MVP * aPosition;
    vColor = aColor;
}
`;

const line_frag =
    `#version 300 es
precision mediump float;
out vec4 fColor;
in vec4 vColor;

void main()
{
    fColor = vColor;
}
`;


function main() {


    // get the WebGL context & create program
    const canvas = document.getElementById('webgl');
    const gl = canvas.getContext("webgl2");
    const h_prog = createProgram(gl, src_vert, src_frag);
    const line_prog = createProgram(gl, line_vert, line_frag);




    // get ui elements
    const longitude_slider = document.getElementById('longitude');
    const longitude_val = document.getElementById('longitude-val');
    longitude_val.innerHTML = longitude_slider.value;

    const latitude_slider = document.getElementById('latitude');
    const latitude_val = document.getElementById('latitude-val');
    latitude_val.innerHTML = latitude_slider.value;

    const control_message = document.getElementById('message');

    const light_point_checkbox = document.getElementById('light-point');
    const light_spot_checkbox = document.getElementById('light-spot');

    const cutoff_angle_slider = document.getElementById('cutoff-angle');
    const cutoff_angle_val = document.getElementById('cutoff-angle-val');
    cutoff_angle_val.innerHTML = cutoff_angle_slider.value;

    const height_slider = document.getElementById('height');
    const height_val = document.getElementById('height-val');
    height_val.innerHTML = height_slider.value;

    const angle_slider = document.getElementById('angle');
    const angle_val = document.getElementById('angle-val');
    angle_val.innerHTML = angle_slider.value;




    // get uniform locations
    const loc_worldViewProjection = gl.getUniformLocation(h_prog, "uWorldViewProjection");
    const loc_worldInverseTranspose = gl.getUniformLocation(h_prog, "uWorldInverseTranspose");
    const loc_viewWorldPosition = gl.getUniformLocation(h_prog, "uViewWorldPosition");
    const loc_world = gl.getUniformLocation(h_prog, "uWorld");

    const loc_pointLightWorldPosition = gl.getUniformLocation(h_prog, "uPointLightWorldPosition");
    const loc_spotLightWorldPosition = gl.getUniformLocation(h_prog, "uSpotLightWorldPosition");
    const loc_cutOffCos = gl.getUniformLocation(h_prog, "uCutOffCos");

    const loc_pointLightOn = gl.getUniformLocation(h_prog, "uPointLightOn");
    const loc_spotLightOn = gl.getUniformLocation(h_prog, "uSpotLightOn");

    const line_loc_MVP = gl.getUniformLocation(line_prog, "MVP");



    // set up world constant values
    const pointLightPos = [15, 35, 15];
    const satellitePos = [0, 0, 10];
    const thirdViewPos = [30, 10, 30];
    const sphere_radius = 7;

    const satellite_angle_diff = 5;
    const satellite_height = 20;



    // create matrices
    const V1 = mat4.create();
    const P1 = mat4.create();
    const VP1 = mat4.create();

    const V2 = mat4.create();
    const P2 = mat4.create();
    const VP2 = mat4.create();

    const M = mat4.create();
    const M_inverseTranspose = mat4.create();

    const fixedFrameModelMat = mat4.create();
    const fixedFrameMVP = mat4.create();

    const rotatingFrameModelMat = mat4.create();
    const rotatingFrameMVP = mat4.create();

    const fixedLineFrameMat = mat4.create();
    const fixedLineFrameMVP = mat4.create();

    const rotatingLineFrameMat = mat4.create();
    const rotatingLineFrameMVP = mat4.create();


    // create meshes
    const [sphere_vao, sphere_index_size] = init_sphere(gl, 100);
    const [fixed_frame_vao, fixed_frame_vertex_size] = init_round_frame(gl, [1, 1, 1]);
    const [rotating_frame_vao, rotating_frame_index_size] = init_round_frame(gl, [1, 1, 0.5]);
    const [fixed_line_frame_vao, fixed_line_frame_vertex_size] = init_manaual_vao(gl,
        [0.9, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0],
        [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1]);
    const [rotating_line_frame_vao, rotating_line_frame_vertex_size] = init_manaual_vao(gl,
        [0, 0, 0.9, 0, 0, 0],
        [1, 0.5, 0.5, 1, 0.5, 0.5]);

    // set up variables
    let satellite_control = null;
    let satellite_longitude = 0;
    let satellite_latitude = 0;


    mat4.identity(fixedFrameModelMat);
    mat4.scale(fixedFrameModelMat, fixedFrameModelMat,
        [satellite_height, satellite_height, satellite_height]);

    mat4.identity(rotatingFrameModelMat);
    mat4.scale(rotatingFrameModelMat, rotatingFrameModelMat,
        [satellite_height, satellite_height, satellite_height]);

    mat4.identity(fixedLineFrameMat);
    mat4.scale(fixedLineFrameMat, fixedLineFrameMat,
        [satellite_height, satellite_height, satellite_height]);

    mat4.identity(rotatingLineFrameMat);
    mat4.scale(rotatingLineFrameMat, rotatingLineFrameMat,
        [satellite_height, satellite_height, satellite_height]);

    mat4.perspective(P1, toRadian(30), (canvas.width / 2) / canvas.height, 1, 100);
    mat4.lookAt(V1, thirdViewPos, [0, 0, 0], [0, 1, 0]);
    mat4.translate(V1, V1, thirdViewPos.map((e) => -e));
    mat4.multiply(VP1, P1, V1);



    // initialize
    setSatelliteRotation(satellite_longitude, satellite_latitude);
    setSphereRotation(angle_slider.value);
    initTextures();
    render_scene();




    function setSatelliteRotation(longitude, latitude) {
        const radius = satellite_height;
        const theta = toRadian(90 - latitude);
        const phi = toRadian(longitude);

        const x = radius * Math.sin(theta) * Math.sin(phi);
        const y = radius * Math.cos(theta);
        const z = radius * Math.sin(theta) * Math.cos(phi); radius * Math.cos(theta);

        satellitePos[0] = x;
        satellitePos[1] = y;
        satellitePos[2] = z;

        mat4.perspective(P2, toRadian(30), (canvas.width / 2) / canvas.height, 1, 100);

        mat4.identity(V2);
        mat4.rotate(V2, V2, -theta + Math.PI / 2, [1, 0, 0]);
        mat4.rotate(V2, V2, -phi, [0, 1, 0]);


        mat4.identity(rotatingFrameModelMat);
        mat4.scale(rotatingFrameModelMat, rotatingFrameModelMat,
            [satellite_height, satellite_height, satellite_height]);
        mat4.rotate(rotatingFrameModelMat, rotatingFrameModelMat, Math.PI / 2, [-1, 0, 0]);
        mat4.rotate(rotatingFrameModelMat, rotatingFrameModelMat, phi - Math.PI / 2, [0, 0, 1]);


        mat4.identity(rotatingLineFrameMat);
        mat4.scale(rotatingLineFrameMat, rotatingLineFrameMat,
            [satellite_height, satellite_height, satellite_height]);
        mat4.rotate(rotatingLineFrameMat, rotatingLineFrameMat, phi, [0, 1, 0]);
        mat4.rotate(rotatingLineFrameMat, rotatingLineFrameMat, theta - Math.PI / 2, [1, 0, 0]);

        mat4.translate(V2, V2, satellitePos.map((e) => -e));
        mat4.multiply(VP2, P2, V2);
    }

    function setSatelliteLongitude(longitude) {
        setSatelliteRotation(longitude, satellite_latitude);
        satellite_longitude = longitude;
    }

    function setSatelliteLatitude(latitude) {
        setSatelliteRotation(satellite_longitude, latitude);
        satellite_latitude = latitude;
    }


    function setSphereRotation(angle) {
        // Model transformation (might be different for each object to render)
        mat4.identity(M);
        mat4.scale(M, M, [sphere_radius, sphere_radius, sphere_radius]);
        mat4.rotate(M, M, toRadian(angle), [0, 1, 0]);

        mat4.invert(M_inverseTranspose, M);
        mat4.transpose(M_inverseTranspose, M_inverseTranspose);
    }

    function initTextures() {
        gl.useProgram(h_prog);

        let img_texture = gl.createTexture();   // Create a texture object
        let bump_texture = gl.createTexture();
        let spec_texture = gl.createTexture();

        // Get the storage location of uImgSampler
        let loc_uImgSampler = gl.getUniformLocation(h_prog, 'uImgSampler');
        let loc_uBumpSampler = gl.getUniformLocation(h_prog, 'uBumpSampler');
        let loc_uSpecSampler = gl.getUniformLocation(h_prog, 'uSpecSampler');


        let initTexture = (texture, index, loc, src) => {
            gl.activeTexture(gl.TEXTURE0 + index);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                new Uint8Array([0, 0, 255, 255]));
            gl.uniform1i(loc, index);

            let image = new Image();
            // Register the event handler to be called on loading an image
            image.onload = function () {
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
                render_scene();
            };

            // Tell the browser to load an image
            image.src = src;
        };
        initTexture(spec_texture, 2, loc_uSpecSampler, '../resources/earthspec1k.jpg');
        initTexture(img_texture, 0, loc_uImgSampler, '../resources/earthmap1k.jpg');
        initTexture(bump_texture, 1, loc_uBumpSampler, '../resources/earthbump1k.jpg');


        return true;
    }


    function render_scene() {

        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.enable(gl.DEPTH_TEST);

        gl.viewport(0, 0, canvas.width / 2, canvas.height);
        gl.clearColor(0.1, 0.1, 0.1, 1);

        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        gl.useProgram(line_prog);



        gl.bindVertexArray(fixed_frame_vao);
        mat4.multiply(fixedFrameMVP, VP1, fixedFrameModelMat);
        gl.uniformMatrix4fv(line_loc_MVP, false, fixedFrameMVP);
        gl.drawArrays(gl.LINE_LOOP, 0, fixed_frame_vertex_size);

        gl.bindVertexArray(fixed_line_frame_vao);
        mat4.multiply(fixedLineFrameMVP, VP1, fixedLineFrameMat);
        gl.uniformMatrix4fv(line_loc_MVP, false, fixedLineFrameMVP);
        gl.drawArrays(gl.LINES, 0, fixed_line_frame_vertex_size);



        gl.bindVertexArray(rotating_frame_vao);
        mat4.multiply(rotatingFrameMVP, VP1, rotatingFrameModelMat);
        gl.uniformMatrix4fv(line_loc_MVP, false, rotatingFrameMVP);
        gl.drawArrays(gl.LINE_LOOP, 0, rotating_frame_index_size);

        gl.bindVertexArray(rotating_line_frame_vao);
        mat4.multiply(rotatingLineFrameMVP, VP1, rotatingLineFrameMat);
        gl.uniformMatrix4fv(line_loc_MVP, false, rotatingLineFrameMVP);
        gl.drawArrays(gl.LINES, 0, rotating_line_frame_vertex_size);



        gl.useProgram(h_prog);
        gl.bindVertexArray(sphere_vao);

        gl.uniformMatrix4fv(loc_world, false, M);
        gl.uniformMatrix4fv(loc_worldInverseTranspose, false, M_inverseTranspose);
        gl.uniformMatrix4fv(loc_worldViewProjection, false, VP1);
        gl.uniform3fv(loc_pointLightWorldPosition, pointLightPos);
        gl.uniform3fv(loc_spotLightWorldPosition, satellitePos);
        gl.uniform3fv(loc_viewWorldPosition, thirdViewPos);
        gl.uniform1i(loc_pointLightOn, light_point_checkbox.checked);
        gl.uniform1i(loc_spotLightOn, light_spot_checkbox.checked);
        gl.uniform1f(loc_cutOffCos, Math.cos(toRadian(cutoff_angle_slider.value)));
        gl.drawElements(gl.TRIANGLES, sphere_index_size, gl.UNSIGNED_SHORT, 0);

        gl.viewport(canvas.width / 2, 0, canvas.width / 2, canvas.height);
        gl.uniformMatrix4fv(loc_worldViewProjection, false, VP2);
        gl.uniform3fv(loc_viewWorldPosition, satellitePos);
        gl.drawElements(gl.TRIANGLES, sphere_index_size, gl.UNSIGNED_SHORT, 0);

    }








    light_point_checkbox.onclick = function () {
        render_scene();
    }
    light_spot_checkbox.onclick = function () {
        render_scene();
    }
    angle_slider.oninput = function () {
        angle_val.innerHTML = this.value;
        setSphereRotation(this.value);
        render_scene();
    };
    longitude_slider.oninput = function () {
        longitude_val.innerHTML = this.value;
        setSatelliteLongitude(this.value);
        render_scene();
    };
    latitude_slider.oninput = function () {
        latitude_val.innerHTML = this.value;
        setSatelliteLatitude(this.value);
        render_scene();
    };
    cutoff_angle_slider.oninput = function () {
        cutoff_angle_val.innerHTML = this.value;
        render_scene();
    };
    height_slider.oninput = function () {
        height_val.innerHTML = this.value;
    };
    window.onkeydown = function (evt) {
        if (satellite_control !== null) return;

        const key = evt.key;

        if (key === 'ArrowRight') {
            control_message.innerHTML = 'Right arrow is pressed';
            setSatelliteLongitude(satellite_longitude + satellite_angle_diff);
        } else if (key === 'ArrowLeft') {
            control_message.innerHTML = 'Left arrow is pressed';
            setSatelliteLongitude(satellite_longitude - satellite_angle_diff);
        } else if (key === 'ArrowUp') {
            control_message.innerHTML = 'Up arrow is pressed';
            setSatelliteLatitude(satellite_latitude + satellite_angle_diff);
        } else if (key === 'ArrowDown') {
            control_message.innerHTML = 'Down arrow is pressed';
            setSatelliteLatitude(satellite_latitude - satellite_angle_diff);
        } else {
            return;
        }
        satellite_control = key;
        render_scene();
    };

    window.onkeyup = function (evt) {
        if (satellite_control === null) return;
        const key = evt.key;
        if (key === 'ArrowRight' || key === 'ArrowLeft' || key === 'ArrowUp' || key === 'ArrowDown') {
            control_message.innerHTML = '';
            satellite_control = null;
        }
    }
}

function init_manaual_vao(gl, vertices, colors) {
    let vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.vertexAttribPointer(line_loc_aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(line_loc_aPosition);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    gl.vertexAttribPointer(line_loc_aColor, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(line_loc_aColor);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return [vao, vertices.length];
}

function init_round_frame(gl, color) {
    let vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Define vertices for a circle
    const vertices = [];
    const colors = [];
    const radius = 0.9;
    const N = 30;

    for (let i = 0; i < N; i++) {
        const theta = (i / N) * (2 * Math.PI);
        const x = radius * Math.sin(theta)
        const y = 0.0;
        const z = radius * Math.cos(theta);
        vertices.push(x, y, z);
        colors.push(...color);
    }

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.vertexAttribPointer(line_loc_aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(line_loc_aPosition);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    gl.vertexAttribPointer(line_loc_aColor, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(line_loc_aColor);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return [vao, N];
}


function init_sphere(gl, SPHERE_DIV) {
    let vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    let i;
    let j;
    let phi, sin_phi, cos_phi;
    let theta, sin_theta, cos_theta;
    let u, v;
    let p1, p2;

    let positions = [];
    let texcoords = [];
    let indices = [];

    // Generate coordinates
    for (j = 0; j <= SPHERE_DIV; j++) {
        v = 1.0 - j / SPHERE_DIV;
        phi = (1.0 - v) * Math.PI;
        sin_phi = Math.sin(phi);
        cos_phi = Math.cos(phi);
        for (i = 0; i <= SPHERE_DIV; i++) {
            u = i / SPHERE_DIV;
            theta = u * 2 * Math.PI;
            sin_theta = Math.sin(theta);
            cos_theta = Math.cos(theta);

            positions.push(cos_theta * sin_phi);  // x
            positions.push(sin_theta * sin_phi);  // y
            positions.push(cos_phi);       // z

            texcoords.push(u);
            texcoords.push(v);
        }
    }

    // Generate indices
    for (j = 0; j < SPHERE_DIV; j++) {
        for (i = 0; i < SPHERE_DIV; i++) {
            p1 = j * (SPHERE_DIV + 1) + i;
            p2 = p1 + (SPHERE_DIV + 1);

            indices.push(p1);
            indices.push(p2);
            indices.push(p1 + 1);

            indices.push(p1 + 1);
            indices.push(p2);
            indices.push(p2 + 1);
        }
    }

    let buf_position = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf_position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    gl.vertexAttribPointer(loc_aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc_aPosition);

    let buf_texcoord = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf_texcoord);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STATIC_DRAW);

    gl.vertexAttribPointer(loc_aTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc_aTexCoord);

    let buf_normal = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf_normal);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    gl.vertexAttribPointer(loc_aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc_aNormal);

    let buf_index = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf_index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    return [vao, indices.length];
}


function createProgram(gl, src_vert, src_frag) {
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


main();





