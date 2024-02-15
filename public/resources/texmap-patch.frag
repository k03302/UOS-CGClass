#version 300 es
precision mediump float;

struct Light {
    vec3 direction;
    vec3 ambient;
    vec3 diffusive;
    vec3 specular;
};

struct Material {
    vec3 ambient;
    vec3 diffusive;
    vec3 specular;
    float shininess;
};

uniform sampler2D tex;
uniform Light sun;
uniform Material material;

in vec2 vTexCoords;
in vec3 vTangent_u;
in vec3 vTangent_v;
in vec3 vSurfaceToView;

out vec4 fColor;

float bump_u_d(vec2 texCoord)
{
    float u = texCoord.x;
    float v = texCoord.y;
    float h = 0.001;
    float right = texture(tex, vec2(u + h, v)).r;
    float left = texture(tex, vec2(u - h, v)).r;
    return (right - left) / (2.0 * h);
}

float bump_v_d(vec2 texCoord)
{
    float u = texCoord.x;
    float v = texCoord.y;
    float h = 0.001;
    float right = texture(tex, vec2(u, v + h)).r;
    float left = texture(tex, vec2(u, v - h)).r;
    return (right - left) / (2.0 * h);
}

void main() 
{
    vec3 tangent_u = normalize(vTangent_u);
    vec3 tangent_v = normalize(vTangent_v);
    vec3 normal = normalize(cross(tangent_u, tangent_v));
    vec3 normal_tangent_u = normalize(cross(normal, tangent_u));
    vec3 normal_tangent_v = normalize(cross(normal, tangent_v));

    vec2 texCoordRotated = vec2(vTexCoords.y, vTexCoords.x);

    vec3 bumped_normal = normal + bump_u_d(texCoordRotated) * normal_tangent_u - bump_v_d(texCoordRotated) * normal_tangent_v;
    bumped_normal = normalize(bumped_normal);

    vec3 surfaceToViewDirection = normalize(vSurfaceToView);
    vec3 surfaceToLightDirection = normalize(-1.0 * sun.direction);
    vec3 halfVector = normalize(surfaceToViewDirection + surfaceToLightDirection);

    vec3 ambient = material.ambient;
    vec3 diffusive = sun.diffusive * material.diffusive
        * clamp(
            dot(surfaceToLightDirection, bumped_normal),
            0.0, 1.0
        );
    vec3 specular = sun.specular * material.specular * pow(clamp(dot(halfVector, bumped_normal), 0.0, 1.0), material.shininess);

    vec3 lightedColor = ambient + diffusive + specular;
    fColor = vec4(lightedColor, 1.0);
}


