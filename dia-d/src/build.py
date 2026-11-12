import sys
S=sys.argv[1]
shell=open(f'{S}/src/shell.html').read()
data=open(f'{S}/src/data.js').read(); app=open(f'{S}/src/app.js').read()
html=shell+'\n<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/utils/BufferGeometryUtils.js"></script>\n<script>\n'+data+'\n'+app+'\n</script>\n'
open(f'{S}/site/index.html','w').write(html)
print(len(html))
