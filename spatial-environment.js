import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'
window.THREE=THREE
const THEROPOD='./Cretaceous_teropod.mp4?v=20260912'
const MASK='/QInspired-WebAR-Tracking-Test/theropod-mask.mp4'
const ENV='./jurska_obala_AR_clean-1.mp4?v=20260929'
let rgbVideo,maskVideo,figure,xrCamera,envVideo
const $=id=>document.getElementById(id)
const makeVideo=(src,loop=true)=>{const v=document.createElement('video');v.src=src;v.loop=loop;v.muted=true;v.playsInline=true;v.preload='auto';v.crossOrigin='anonymous';return v}
function alphaMaterial(rgbMap,maskMap){return new THREE.ShaderMaterial({uniforms:{rgbMap:{value:rgbMap},maskMap:{value:maskMap}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D rgbMap;uniform sampler2D maskMap;varying vec2 vUv;void main(){vec4 c=texture2D(rgbMap,vUv);float a=smoothstep(.08,1.,texture2D(maskMap,vUv).r*1.15);if(a<.015)discard;gl_FragColor=vec4(c.rgb,a);}`,transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:false})}
function cropTexture(video,x,y,w,h){const t=new THREE.VideoTexture(video);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.repeat.set(w,h);t.offset.set(x,1-y-h);return t}
function plane(scene,tex,w,h,x,y,z,order){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:false,side:THREE.DoubleSide,depthWrite:true,toneMapped:false}));m.position.set(x,y,z);m.renderOrder=order;scene.add(m);return m}
function build(scene){
 rgbVideo=makeVideo(THEROPOD);maskVideo=makeVideo(MASK)
 const rt=new THREE.VideoTexture(rgbVideo);rt.colorSpace=THREE.SRGBColorSpace
 const mt=new THREE.VideoTexture(maskVideo);mt.colorSpace=THREE.NoColorSpace
 figure=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.8),alphaMaterial(rt,mt));figure.position.set(0,.9,-1.5);figure.renderOrder=5;scene.add(figure)
 envVideo=makeVideo(ENV);envVideo.loop=false
 envVideo.addEventListener('loadedmetadata',async()=>{envVideo.currentTime=.08
   // Crops are from the actual Kling source frame. This is deliberately a rough parallax proof.
   plane(scene,cropTexture(envVideo,0.00,0.10,1.00,0.27),5.8,1.55,0,1.55,-4.2,0) // sea/horizon
   plane(scene,cropTexture(envVideo,0.00,0.38,0.38,0.58),2.05,2.35,-1.45,1.05,-1.05,6) // left foreground
   plane(scene,cropTexture(envVideo,0.68,0.40,0.30,0.46),1.75,1.55,1.45,.78,-2.15,3) // right rocks
   try{await Promise.all([rgbVideo.play(),maskVideo.play()]);$('video-toggle').textContent='Pauziraj prizor'}catch{}
   $('status').textContent='Pomakni se lijevo/desno i gledaj mijenjaju li se odnosi slojeva.'
 })
}
const mod=()=>({name:'cretaceous-environment-parallax-test',onStart:({canvas})=>{const {scene,camera}=XR8.Threejs.xrScene();xrCamera=camera;build(scene);camera.position.set(0,1.6,2.5);XR8.XrController.updateCameraProjectionMatrix({origin:camera.position,facing:camera.quaternion});canvas.addEventListener('touchmove',e=>e.preventDefault(),{passive:false})},onUpdate:()=>{if(!figure||!xrCamera)return;if(rgbVideo&&maskVideo&&Math.abs(rgbVideo.currentTime-maskVideo.currentTime)>.08)maskVideo.currentTime=rgbVideo.currentTime;const dx=xrCamera.position.x-figure.position.x,dz=xrCamera.position.z-figure.position.z;figure.rotation.y=Math.atan2(dx,dz)}})
function start(){XR8.addCameraPipelineModules([XR8.GlTextureRenderer.pipelineModule(),XR8.Threejs.pipelineModule(),XR8.XrController.pipelineModule(),LandingPage.pipelineModule(),XRExtras.FullWindowCanvas.pipelineModule(),XRExtras.Loading.pipelineModule(),XRExtras.RuntimeError.pipelineModule(),mod()]);XR8.run({canvas:$('camerafeed')});$('recenter').onclick=()=>XR8.XrController.recenter();$('video-toggle').onclick=async()=>{if(rgbVideo?.paused){await Promise.all([rgbVideo.play(),maskVideo.play()]);$('video-toggle').textContent='Pauziraj prizor'}else{rgbVideo?.pause();maskVideo?.pause();$('video-toggle').textContent='Pokreni prizor'}}}
window.XR8?start():window.addEventListener('xrloaded',start)
