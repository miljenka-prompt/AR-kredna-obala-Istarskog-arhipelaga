import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'
window.THREE=THREE
const SOURCE='./Cretaceous_teropod.mp4?v=20260929b'
const MASK='/QInspired-WebAR-Tracking-Test/theropod-mask.mp4'
const LEFT='./env-left.png?v=20260929c'
const RIGHT='./env-right.png?v=20260929c'
let rgbVideo,maskVideo,figure,xrCamera
const $=id=>document.getElementById(id)
const makeVideo=(src,loop=true)=>{const v=document.createElement('video');v.src=src;v.loop=loop;v.muted=true;v.playsInline=true;v.preload='auto';v.crossOrigin='anonymous';return v}
function theropodMat(rgb,mask){return new THREE.ShaderMaterial({uniforms:{rgbMap:{value:rgb},maskMap:{value:mask}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D rgbMap;uniform sampler2D maskMap;varying vec2 vUv;void main(){vec4 c=texture2D(rgbMap,vUv);float a=smoothstep(.08,1.,texture2D(maskMap,vUv).r*1.15);if(a<.015)discard;gl_FragColor=vec4(c.rgb,a);}`,transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:false})}
function addPng(scene,url,w,h,x,y,z,order){new THREE.TextureLoader().load(url,t=>{t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,alphaTest:.025,side:THREE.DoubleSide,depthWrite:true,toneMapped:false}));m.position.set(x,y,z);m.renderOrder=order;scene.add(m)})}
function build(scene){
 rgbVideo=makeVideo(SOURCE);maskVideo=makeVideo(MASK)
 const rt=new THREE.VideoTexture(rgbVideo);rt.colorSpace=THREE.SRGBColorSpace
 const mt=new THREE.VideoTexture(maskVideo);mt.colorSpace=THREE.NoColorSpace
 figure=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.8),theropodMat(rt,mt));figure.position.set(0,.9,-1.5);figure.renderOrder=5;scene.add(figure)
 // Static layers extracted only from uploaded Kling Cretaceous video.
 addPng(scene,LEFT,2.15,2.45,-1.50,1.05,-.95,7)
 addPng(scene,RIGHT,1.75,1.55,1.40,.78,-2.25,3)
 $('status').textContent='Pomakni se lijevo/desno: stijene i vegetacija trebaju pokazati paralaksu.'
 Promise.all([rgbVideo.play(),maskVideo.play()]).then(()=>$('video-toggle').textContent='Pauziraj prizor').catch(()=>{})
}
const mod=()=>({name:'cretaceous-environment-portal-parallax-v4',onStart:({canvas})=>{const {scene,camera}=XR8.Threejs.xrScene();xrCamera=camera;build(scene);camera.position.set(0,1.6,2.5);XR8.XrController.updateCameraProjectionMatrix({origin:camera.position,facing:camera.quaternion});canvas.addEventListener('touchmove',e=>e.preventDefault(),{passive:false})},onUpdate:()=>{if(!figure||!xrCamera)return;if(rgbVideo&&maskVideo&&Math.abs(rgbVideo.currentTime-maskVideo.currentTime)>.08)maskVideo.currentTime=rgbVideo.currentTime;const dx=xrCamera.position.x-figure.position.x,dz=xrCamera.position.z-figure.position.z;figure.rotation.y=Math.atan2(dx,dz)}})
function start(){XR8.addCameraPipelineModules([XR8.GlTextureRenderer.pipelineModule(),XR8.Threejs.pipelineModule(),XR8.XrController.pipelineModule(),LandingPage.pipelineModule(),XRExtras.FullWindowCanvas.pipelineModule(),XRExtras.Loading.pipelineModule(),XRExtras.RuntimeError.pipelineModule(),mod()]);XR8.run({canvas:$('camerafeed')});$('recenter').onclick=()=>XR8.XrController.recenter();$('video-toggle').onclick=async()=>{if(rgbVideo?.paused){await Promise.all([rgbVideo.play(),maskVideo.play()]);$('video-toggle').textContent='Pauziraj prizor'}else{rgbVideo?.pause();maskVideo?.pause();$('video-toggle').textContent='Pokreni prizor'}}}
window.XR8?start():window.addEventListener('xrloaded',start)
