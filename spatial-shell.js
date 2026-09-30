import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'
window.THREE=THREE

// Separate experiment. spatial-v2.* is intentionally untouched.
const SOURCE='./Cretaceous_teropod.mp4?v=20260912'
const MASK='/QInspired-WebAR-Tracking-Test/theropod-mask.mp4'
const SHELL='./env-background.png?v=20260929d'
let rgbVideo,maskVideo,figure,xrCamera
const $=id=>document.getElementById(id)

function makeVideo(src){const v=document.createElement('video');v.src=src;v.loop=true;v.muted=true;v.playsInline=true;v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');v.preload='auto';v.crossOrigin='anonymous';return v}

function theropodMat(rgb,mask){return new THREE.ShaderMaterial({uniforms:{rgbMap:{value:rgb},maskMap:{value:mask}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D rgbMap;uniform sampler2D maskMap;varying vec2 vUv;void main(){vec4 c=texture2D(rgbMap,vUv);float a=smoothstep(.08,1.,texture2D(maskMap,vUv).r*1.15);if(a<.015)discard;gl_FragColor=vec4(c.rgb,a);}`,transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:false})}

function curvedShellGeometry(radius=4.8,arc=Math.PI*2/3,segments=56){
 const positions=[],uvs=[],indices=[]
 const arcLength=radius*arc, height=arcLength*9/16, y0=1.4-height/2
 for(let i=0;i<=segments;i++){
   const u=i/segments,theta=(u-.5)*arc
   const x=radius*Math.sin(theta),z=-radius*Math.cos(theta)
   positions.push(x,y0,z,x,y0+height,z)
   uvs.push(u,0,u,1)
 }
 for(let i=0;i<segments;i++){const a=i*2,b=a+1,c=a+2,d=a+3;indices.push(a,c,b,c,d,b)}
 const g=new THREE.BufferGeometry()
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2))
 g.setIndex(indices);g.computeVertexNormals();return g
}

function addShell(scene){
 new THREE.TextureLoader().load(SHELL,t=>{
   t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter
   const mat=new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide,transparent:false,depthWrite:true,toneMapped:false})
   const shell=new THREE.Mesh(curvedShellGeometry(),mat);shell.renderOrder=0;scene.add(shell)
 },undefined,()=>{$('status').textContent='Pozadina se nije učitala. Osvježi stranicu.'})
}

function build(scene){
 addShell(scene)
 rgbVideo=makeVideo(SOURCE);maskVideo=makeVideo(MASK)
 const rt=new THREE.VideoTexture(rgbVideo);rt.colorSpace=THREE.SRGBColorSpace;rt.minFilter=THREE.LinearFilter;rt.magFilter=THREE.LinearFilter
 const mt=new THREE.VideoTexture(maskVideo);mt.colorSpace=THREE.NoColorSpace;mt.minFilter=THREE.LinearFilter;mt.magFilter=THREE.LinearFilter
 figure=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.8),theropodMat(rt,mt));figure.position.set(0,.9,-1.5);figure.renderOrder=5;scene.add(figure)
 rgbVideo.addEventListener('loadedmetadata',()=>{if(!rgbVideo.videoHeight)return;const w=1.8*rgbVideo.videoWidth/rgbVideo.videoHeight;figure.geometry.dispose();figure.geometry=new THREE.PlaneGeometry(w,1.8)})
 $('status').textContent='Pomakni i zakreni mobitel: kredna obala treba ostati kao zakrivljena pozadina, bez bočnih kartona.'
 Promise.all([rgbVideo.play(),maskVideo.play()]).then(()=>$('video-toggle').textContent='Pauziraj prizor').catch(()=>{})
}

const mod=()=>({name:'cretaceous-curved-environment-shell-v1',onStart:({canvas})=>{const {scene,camera}=XR8.Threejs.xrScene();xrCamera=camera;build(scene);camera.position.set(0,1.6,2.5);XR8.XrController.updateCameraProjectionMatrix({origin:camera.position,facing:camera.quaternion});canvas.addEventListener('touchmove',e=>e.preventDefault(),{passive:false})},onUpdate:()=>{if(!figure||!xrCamera)return;if(rgbVideo&&maskVideo&&Math.abs(rgbVideo.currentTime-maskVideo.currentTime)>.08)maskVideo.currentTime=rgbVideo.currentTime;const dx=xrCamera.position.x-figure.position.x,dz=xrCamera.position.z-figure.position.z;figure.rotation.y=Math.atan2(dx,dz)}})

function start(){XR8.addCameraPipelineModules([XR8.GlTextureRenderer.pipelineModule(),XR8.Threejs.pipelineModule(),XR8.XrController.pipelineModule(),LandingPage.pipelineModule(),XRExtras.FullWindowCanvas.pipelineModule(),XRExtras.Loading.pipelineModule(),XRExtras.RuntimeError.pipelineModule(),mod()]);XR8.run({canvas:$('camerafeed')});$('recenter').onclick=()=>XR8.XrController.recenter();$('video-toggle').onclick=async()=>{if(rgbVideo?.paused){await Promise.all([rgbVideo.play(),maskVideo.play()]);$('video-toggle').textContent='Pauziraj prizor'}else{rgbVideo?.pause();maskVideo?.pause();$('video-toggle').textContent='Pokreni prizor'}}}
window.XR8?start():window.addEventListener('xrloaded',start)
