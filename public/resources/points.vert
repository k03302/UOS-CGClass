#version 300 es
layout(location=${loc_aPosition}) in vec4 aPosition;
layout(location=${loc_aColor}) in vec4 aColor;
uniform mat4 MVP;
out vec4 vColor;
void main()
{
    gl_Position = MVP * aPosition;
    gl_PointSize = 10.0;
    vColor = aColor;
}

