import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'

window.THREE = THREE

const VIDEO_URL = './Cretaceous_teropod.mp4?v=20260912'
const MASK_URL = '/QInspired-WebAR-Tracking-Test/theropod-mask.mp4'
const SOUND_URL = './assets/environment-v2/ambient-vocalization.m4a?v=20260930a'
const ASSET = './assets/environment-v2/'

let rgbVideo = null
let maskVideo = null
let sound = null
let figure = null
let world = null
let xrCamera = null

const $ = (id) => document.getElementById(id)

function setStatus(text) {
  const node = $('status')
  if (node) node.textContent = text
}

function media(src, kind = 'video') {
  const el = document.createElement(kind)
  el.src = src
  el.loop = true
  el.preload = 'auto'
  el.crossOrigin = 'anonymous'
  if (kind === 'video') {
    el.muted = true
    el.playsInline = true
    el.setAttribute('playsinline', '')
    el.setAttribute('webkit-playsinline', '')
  }
  return el
}

function texture(url) {
  const map = new THREE.TextureLoader().load(url)
  map.colorSpace = THREE.SRGBColorSpace
  map.minFilter = THREE.LinearFilter
  map.magFilter = THREE.LinearFilter
  return map
}

function layer(url, width, height, x, y, z, options = {}) {
  const material = new THREE.MeshBasicMaterial({
    map: texture(url),
    transparent: Boolean(options.transparent),
    alphaTest: options.transparent ? 0.025 : 0,
    side: THREE.DoubleSide,
    depthWrite: options.depthWrite ?? true,
    toneMapped: false,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
  mesh.position.set(x, y, z)
  if (options.floor) mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = options.order ?? 0
  world.add(mesh)
  return mesh
}

function theropodMaterial(rgbMap, maskMap) {
  return new THREE.ShaderMaterial({
    uniforms: {rgbMap: {value: rgbMap}, maskMap: {value: maskMap}},
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform sampler2D rgbMap;uniform sampler2D maskMap;varying vec2 vUv;void main(){vec4 c=texture2D(rgbMap,vUv);float a=smoothstep(.08,1.,texture2D(maskMap,vUv).r*1.15);if(a<.015)discard;gl_FragColor=vec4(c.rgb,a);}',
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  })
}

function build(scene) {
  world = new THREE.Group()
  world.position.set(0, 0, -0.35)
  scene.add(world)

  // Daleki dijelovi ostaju mirni; bliži alfa-slojevi stvaraju paralaksu.
  layer(`${ASSET}horizon.webp`, 8.4, 3.15, 0, 2.2, -5.8)
  layer(`${ASSET}ground.webp`, 7.7, 5.4, 0, 0.005, -2.65, {floor: true})
  layer(`${ASSET}tide-pools.webp`, 4.25, 1.55, 0.65, 0.025, -1.75, {floor: true, transparent: true, depthWrite: false, order: 2})
  layer(`${ASSET}cycad.webp`, 2.1, 1.7, -2.15, 0.82, -1.05, {transparent: true, order: 6})
  layer(`${ASSET}right-rocks.webp`, 2.8, 1.45, 2.0, 0.72, -3.05, {transparent: true, order: 3})

  rgbVideo = media(VIDEO_URL)
  maskVideo = media(MASK_URL)
  sound = media(SOUND_URL, 'audio')
  sound.volume = 1

  const rgb = new THREE.VideoTexture(rgbVideo)
  rgb.colorSpace = THREE.SRGBColorSpace
  const mask = new THREE.VideoTexture(maskVideo)
  mask.colorSpace = THREE.NoColorSpace

  figure = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), theropodMaterial(rgb, mask))
  figure.position.set(0, 0.9, -1.5)
  figure.renderOrder = 5
  world.add(figure)

  setStatus('Okoliš je usidren. Dodirni “Pokreni prizor i zvuk”.')
}

async function playScene() {
  maskVideo.currentTime = rgbVideo.currentTime
  sound.currentTime = rgbVideo.currentTime
  await Promise.all([rgbVideo.play(), maskVideo.play(), sound.play()])
  $('video-toggle').textContent = 'Pauziraj prizor'
}

function pauseScene() {
  rgbVideo?.pause()
  maskVideo?.pause()
  sound?.pause()
  $('video-toggle').textContent = 'Pokreni prizor i zvuk'
}

const module = () => ({
  name: 'cretaceous-layered-environment-v2',
  onStart: ({canvas}) => {
    const {scene, camera} = XR8.Threejs.xrScene()
    xrCamera = camera
    build(scene)
    camera.position.set(0, 1.6, 2.5)
    XR8.XrController.updateCameraProjectionMatrix({origin: camera.position, facing: camera.quaternion})
    canvas.addEventListener('touchmove', (event) => event.preventDefault(), {passive: false})
  },
  onUpdate: () => {
    if (!figure || !xrCamera) return
    if (Math.abs(rgbVideo.currentTime - maskVideo.currentTime) > 0.08) maskVideo.currentTime = rgbVideo.currentTime
    if (!sound.paused && Math.abs(rgbVideo.currentTime - sound.currentTime) > 0.12) sound.currentTime = rgbVideo.currentTime
    const figureWorld = new THREE.Vector3()
    figure.getWorldPosition(figureWorld)
    figure.rotation.y = Math.atan2(xrCamera.position.x - figureWorld.x, xrCamera.position.z - figureWorld.z)
  },
})

function start() {
  XR8.addCameraPipelineModules([
    XR8.GlTextureRenderer.pipelineModule(),
    XR8.Threejs.pipelineModule(),
    XR8.XrController.pipelineModule(),
    LandingPage.pipelineModule(),
    XRExtras.FullWindowCanvas.pipelineModule(),
    XRExtras.Loading.pipelineModule(),
    XRExtras.RuntimeError.pipelineModule(),
    module(),
  ])
  XR8.run({canvas: $('camerafeed')})
  $('recenter').addEventListener('click', () => XR8.XrController.recenter())
  $('video-toggle').addEventListener('click', async () => {
    try {
      if (rgbVideo?.paused) await playScene()
      else pauseScene()
    } catch {
      setStatus('Preglednik je blokirao reprodukciju. Dodirni tipku ponovno.')
    }
  })
}

window.XR8 ? start() : window.addEventListener('xrloaded', start)
