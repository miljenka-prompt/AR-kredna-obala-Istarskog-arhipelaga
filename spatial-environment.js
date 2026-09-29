import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'
window.THREE=THREE
const SOURCE='./Cretaceous_teropod.mp4?v=20260929b'
const MASK='/QInspired-WebAR-Tracking-Test/theropod-mask.mp4'
let rgbVideo,maskVideo,figure,xrCamera,envVideo
const $=id=>document.getElementById(id)
const makeVideo=(src,loop=true)=>{const v=document.createElement('video');v.src=src;v.loop=loop;v.muted=true;v.playsInline=true;v.preload='auto';v.crossOrigin='anonymous';return v}
function theropodMat(rgb,mask){return new THREE.ShaderMaterial({uniforms:{rgbMap:{value:rgb},maskMap:{value:mask}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D rgbMap;uniform sampler2D maskMap;varying vec2 vUv;void main(){vec4 c=texture2D(rgbMap,vUv);float a=smoothstep(.08,1.,texture2D(maskMap,vUv).r*1.15);if(a<.015)discard;gl_FragColor=vec4(c.rgb,a);}`,transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:false})}
function envMat(tex,crop,edge){return new THREE.ShaderMaterial({uniforms:{map:{value:tex},crop:{value:new THREE.Vector4(...crop)},edge:{value:edge}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D map;uniform vec4 crop;uniform float edge;varying vec2 vUv;void main(){vec2 uv=crop.xy+vUv*crop.zw;vec4 c=texture2D(map,uv);float ax=smoothstep(0.,edge,vUv.x)*smoothstep(0.,edge,1.-vUv.x);float ay=smoothstep(0.,edge,vUv.y)*smoothstep(0.,edge,1.-vUv.y);float a=ax*ay;if(a<.02)discard;gl_FragColor=vec4(c.rgb,a*.94);}`,transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:false})}
function envPlane(scene,tex,crop,w,h,x,y,z,order,edge=.08){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),envMat(tex,crop,edge));m.position.set(x,y,z);m.renderOrder=order;scene.add(m);return m}
function build(scene){
 rgbVideo=makeVideo(SOURCE);maskVideo=makeVideo(MASK)
 const rt=new THREE.VideoTexture(rgbVideo);rt.colorSpace=THREE.SRGBColorSpace
 const mt=new THREE.VideoTexture(maskVideo);mt.colorSpace=THREE.NoColorSpace
 figure=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.8),theropodMat(rt,mt));figure.position.set(0,.9,-1.5);figure.renderOrder=5;scene.add(figure)
 // Same uploaded Kling source, second video element frozen near its first frame for static 2.5D scenery.
 envVideo=makeVideo(SOURCE,false);envVideo.addEventListener('loadedmetadata',()=>{envVideo.currentTime=.04})
 const et=new THREE.VideoTexture(envVideo);et.colorSpace=THREE.SRGBColorSpace;et.minFilter=et.magFilter=THREE.LinearFilter
 envVideo.addEventListener('seeked',()=>{envVideo.pause()
   // UV origin is bottom-left. Crops avoid the Kling watermark at lower-right.
   envPlane(scene,et,[0.00,.53,.86,.28],5.8,1.65,0,1.55,-4.2,0,.10) // distant sea / ridge
   envPlane(scene,et,[0.00,.00,.38,.62],2.15,2.45,-1.50,1.05,-.95,7,.12) // left vegetation + limestone
   envPlane(scene,et,[.62,.12,.25,.48],1.75,1.55,1.40,.78,-2.25,3,.13) // right rocks, before watermark
   $('status').textContent='Pomakni se lijevo/desno: okoliš mora pokazati paralaksu.'
 })
 Promise.all([rgbVideo.play(),maskVideo.play()]).then(()=>$('video-toggle').textContent='Pauziraj prizor').catch(()=>{})
}
const mod=()=>({name:'cretaceous-environment-parallax-test-v2',onStart:({canvas})=>{const {scene,camera}=XR8.Threejs.xrScene();xrCamera=camera;build(scene);camera.position.set(0,1.6,2.5);XR8.XrController.updateCameraProjectionMatrix({origin:camera.position,facing:camera.quaternion});canvas.addEventListener('touchmove',e=>e.preventDefault(),{passive:false})},onUpdate:()=>{if(!figure||!xrCamera)return;if(rgbVideo&&maskVideo&&Math.abs(rgbVideo.currentTime-maskVideo.currentTime)>.08)maskVideo.currentTime=rgbVideo.currentTime;const dx=xrCamera.position.x-figure.position.x,dz=xrCamera.position.z-figure.position.z;figure.rotation.y=Math.atan2(dx,dz)}})
function start(){XR8.addCameraPipelineModules([XR8.GlTextureRenderer.pipelineModule(),XR8.Threejs.pipelineModule(),XR8.XrController.pipelineModule(),LandingPage.pipelineModule(),XRExtras.FullWindowCanvas.pipelineModule(),XRExtras.Loading.pipelineModule(),XRExtras.RuntimeError.pipelineModule(),mod()]);XR8.run({canvas:$('camerafeed')});$('recenter').onclick=()=>XR8.XrController.recenter();$('video-toggle').onclick=async()=>{if(rgbVideo?.paused){await Promise.all([rgbVideo.play(),maskVideo.play()]);$('video-toggle').textContent='Pauziraj prizor'}else{rgbVideo?.pause();maskVideo?.pause();$('video-toggle').textContent='Pokreni prizor'}}}
window.XR8?start():window.addEventListener('xrloaded',start)
