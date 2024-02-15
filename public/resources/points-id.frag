#version 300 es
#ifdef GL_ES
precision mediump float;
#endif
in vec4 vColor;
out vec4 fColor;
void main()
{
    if(length(gl_PointCoord.xy-vec2(0.5)) > 0.5)   discard; 
    fColor = vColor;
}


