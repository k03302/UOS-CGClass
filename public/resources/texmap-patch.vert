#version 300 es
#define M_PI 3.1415926535897932384626433832795
layout(location=${loc_aTexCoords}) in vec2 aTexCoords;


uniform vec3 uViewerPos;

uniform PointData {
    vec4[16] pointData;
};
uniform mat4 MVP;

out vec2 vTexCoords;
out vec3 vTangent_u;
out vec3 vTangent_v;
out vec3 vSurfaceToView;

vec4 getPointFromNet(int i, int j) {
    int m = gl_InstanceID / 4;
    int n = gl_InstanceID % 4;
    return pointData[4 *((i + m) % 4) + ((j + n) % 4)];
}

float B3_0(float t) {
    float s = 1.0 - t;
    return (s * s * s) / 6.0;
}

float B3_1(float t) {
    return (3.0 * t * t * t - 6.0 * t * t + 4.0) / 6.0;
}

float B3_2(float t) {
    return (-3.0 * t * t * t + 3.0 * t * t + 3.0 * t + 1.0) / 6.0;
}

float B3_3(float t) {
    return (t * t * t) / 6.0;
}

float B3_0_d(float t) {
    float s = 1.0 - t;
    return -s * s / 2.0;
}

float B3_1_d(float t) {
    return (9.0 * t * t - 12.0 * t) / 6.0;
}

float B3_2_d(float t) {
    return (-9.0 * t * t + 6.0 * t + 3.0) / 6.0;
}

float B3_3_d(float t) {
    return t * t / 2.0;
}

vec3 p(vec2 texCoord) {
    float u = texCoord.x;
    float v = texCoord.y;
    highp float B_u[4];
    highp float B_v[4];

    B_u[0] = B3_0(u);
    B_u[1] = B3_1(u);
    B_u[2] = B3_2(u);
    B_u[3] = B3_3(u);

    B_v[0] = B3_0(v);
    B_v[1] = B3_1(v);
    B_v[2] = B3_2(v);
    B_v[3] = B3_3(v);
    
    vec3 result = vec3(0.0, 0.0, 0.0);
    for(int i = 0; i < 4; ++i) {
        for(int j = 0; j < 4; ++j) {
            result += B_u[i] * B_v[j] * getPointFromNet(i, j).xyz;
        }
    }
    return result;
}

vec3 t_u(vec2 texCoord) {
    float u = texCoord.x;
    float v = texCoord.y;

    highp float B_u_d[4];
    highp float B_v[4];

    B_u_d[0] = B3_0_d(u);
    B_u_d[1] = B3_1_d(u);
    B_u_d[2] = B3_2_d(u);
    B_u_d[3] = B3_3_d(u);

    B_v[0] = B3_0(v);
    B_v[1] = B3_1(v);
    B_v[2] = B3_2(v);
    B_v[3] = B3_3(v);
    
    vec3 result = vec3(0.0, 0.0, 0.0);
    for(int i = 0; i < 4; ++i) {
        for(int j = 0; j < 4; ++j) {
            result += B_u_d[i] * B_v[j] * getPointFromNet(i, j).xyz;
        }
    }
    return result;
}

vec3 t_v(vec2 texCoord) {
    float u = texCoord.x;
    float v = texCoord.y;

    highp float B_u[4];
    highp float B_v_d[4];

    B_u[0] = B3_0(u);
    B_u[1] = B3_1(u);
    B_u[2] = B3_2(u);
    B_u[3] = B3_3(u);

    B_v_d[0] = B3_0_d(v);
    B_v_d[1] = B3_1_d(v);
    B_v_d[2] = B3_2_d(v);
    B_v_d[3] = B3_3_d(v);
    
    vec3 result = vec3(0.0, 0.0, 0.0);
    for(int i = 0; i < 4; ++i) {
        for(int j = 0; j < 4; ++j) {
            result += B_u[i] * B_v_d[j] * getPointFromNet(i, j).xyz;
        }
    }
    return result;
}

void main() 
{
    vec3 surfacePos = p(aTexCoords);
    gl_Position = MVP * vec4(surfacePos, 1.0);
    vTangent_u = t_u(aTexCoords);
    vTangent_v = t_v(aTexCoords);
    vSurfaceToView = uViewerPos - surfacePos;
    vTexCoords = vec2(aTexCoords);
}

