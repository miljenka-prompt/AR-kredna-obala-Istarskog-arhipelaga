import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'
import {PACKED_VIDEO_URL} from './theropod-packed-video.js?v=20260930a'

window.THREE = THREE

const SOUND_URL = './assets/environment-v2/ambient-vocalization.m4a?v=20260930a'
const ASSET = './assets/environment-v2/'
const params = new URLSearchParams(location.search)
const LANG = params.get('lang') === 'en' || (!params.get('lang') && localStorage.getItem('cretaceousLang') === 'en') ? 'en' : 'hr'
const COPY = {
  hr: {
    title: 'Kredni okoliš u stvarnom prostoru', mode: 'KREDNI OKOLIŠ U PROSTORU',
    place: 'Usmjeri kameru prema podu i dodirni mjesto za prizor.', placed: 'Kredni prizor je postavljen. Dodirni drugdje za novo mjesto.',
    hint: 'Dodirni pod gdje želiš postaviti kredni prizor', reset: 'Postavi ponovno', play: 'Pokreni prizor i zvuk', pause: 'Pauziraj prizor', blocked: 'Preglednik je blokirao reprodukciju. Dodirni tipku ponovno.',
  },
  en: {
    title: 'Cretaceous environment in real space', mode: 'CRETACEOUS ENVIRONMENT IN REAL SPACE',
    place: 'Aim the camera at the floor and tap where you want the scene.', placed: 'Cretaceous scene placed. Tap elsewhere to move it.',
    hint: 'Tap the floor to place the Cretaceous scene', reset: 'Place again', play: 'Start scene and sound', pause: 'Pause scene', blocked: 'Playback was blocked. Tap the button again.',
  },
}
const copy = COPY[LANG]

let rgbVideo = null
let sound = null
let figure = null
let world = null
let xrCamera = null
let placed = false
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const FOOT_BOTTOM_PX = [556,585,566,562,556,570,565,560,564,557,554,573,664,652,662,651,653,659,656,652,649,643,636,627]

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
  map.anisotropy = 8
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

function fadedMaterial(url, opacity, edge = .13) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: {value: texture(url)},
      opacity: {value: opacity},
      edge: {value: edge},
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform float opacity;
      uniform float edge;
      varying vec2 vUv;
      void main(){
        vec4 c=texture2D(map,vUv);
        vec2 d=(vUv-.5)/.5;
        float radial=1.0-smoothstep(1.0-edge,1.0,length(d));
        float nearWeight=1.0-smoothstep(.25,.9,vUv.y);
        float density=mix(.72,1.0,nearWeight);
        float water=smoothstep(.03,.20,min(c.g-c.r,c.b-c.r));
        float localOpacity=mix(opacity,min(1.0,opacity+.14),water);
        float a=localOpacity*radial*density;
        if(a<.01)discard;
        gl_FragColor=vec4(c.rgb,a);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
}

function terrain(url) {
  const geometry = new THREE.PlaneGeometry(12, 12, 48, 48)
  const positions = geometry.attributes.position
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i)
    const forward = positions.getY(i)
    const edge = Math.min(1, Math.max(0, (forward + 6) / 2.4))
    const relief = (
      Math.sin(x * 1.7 + forward * .42) * .055 +
      Math.sin(x * 3.9 - forward * 1.25) * .022 +
      Math.cos(forward * 2.1) * .028
    ) * edge
    positions.setZ(i, relief)
  }
  positions.needsUpdate = true
  geometry.computeVertexNormals()

  const material = fadedMaterial(url, .78, .32)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  mesh.scale.set(.58, .58, .58)
  mesh.position.set(0, -.03, 0)
  mesh.renderOrder = 1
  world.add(mesh)
  return mesh
}

function addCycads(url) {
  const map = texture(url)
  const material = new THREE.SpriteMaterial({
    map,
    transparent: true,
    alphaTest: .06,
    depthWrite: false,
    toneMapped: false,
  })

  const addOne = (x, z, width, height) => {
    const sprite = new THREE.Sprite(material)
    sprite.position.set(x, height * .5 - .015, z)
    sprite.scale.set(width, height, 1)
    sprite.renderOrder = 4
    world.add(sprite)
  }

  addOne(-.78, .12, 1.28, 1.08)
  addOne(.82, -.38, 1.02, .86)
}

function theropodMaterial(packedMap) {
  return new THREE.ShaderMaterial({
    uniforms: {packedMap: {value: packedMap}},
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform sampler2D packedMap;varying vec2 vUv;void main(){vec4 c=texture2D(packedMap,vec2(vUv.x,.5+vUv.y*.5));float m=texture2D(packedMap,vec2(vUv.x,vUv.y*.5)).r;float a=smoothstep(.08,1.,m*1.15);if(a<.015)discard;gl_FragColor=vec4(c.rgb,a);}',
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  })
}

function build(scene) {
  world = new THREE.Group()
  world.position.set(0, 0, -2.35)
  world.visible = false
  scene.add(world)

  // Prostor kamere ostaje vidljiv; rekonstrukcija je lokaliziran sloj na podu.
  terrain(`${ASSET}ground-square-v2.webp?v=20261003f`)
  addCycads(`${ASSET}cycad-v1.png?v=20261003g`)

  rgbVideo = media(PACKED_VIDEO_URL)
  sound = media(SOUND_URL, 'audio')
  sound.volume = 1

  const rgb = new THREE.VideoTexture(rgbVideo)
  rgb.colorSpace = THREE.SRGBColorSpace
  figure = new THREE.Mesh(new THREE.PlaneGeometry(2.65, 1.49), theropodMaterial(rgb))
  figure.position.set(0, 0.745, 0)
  figure.renderOrder = 5
  world.add(figure)

  setStatus(copy.place)
}

function placeAt(clientX, clientY, canvas) {
  if (!world || !xrCamera) return
  const rect = canvas.getBoundingClientRect()
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, xrCamera)
  const hit = new THREE.Vector3()
  if (!raycaster.ray.intersectPlane(floorPlane, hit)) return
  world.position.set(hit.x, 0, hit.z)
  world.visible = true
  placed = true
  $('placement-hint')?.classList.add('is-hidden')
  setStatus(copy.placed)
}

async function playScene() {
  sound.currentTime = rgbVideo.currentTime
  await Promise.all([rgbVideo.play(), sound.play()])
  $('video-toggle').textContent = copy.pause
}

function pauseScene() {
  rgbVideo?.pause()
  sound?.pause()
  $('video-toggle').textContent = copy.play
}

function groundFigure() {
  if (!figure || !rgbVideo?.duration) return
  const frame = (rgbVideo.currentTime / rgbVideo.duration) * FOOT_BOTTOM_PX.length
  const i = Math.floor(frame) % FOOT_BOTTOM_PX.length
  const next = (i + 1) % FOOT_BOTTOM_PX.length
  const mix = frame - Math.floor(frame)
  const bottom = FOOT_BOTTOM_PX[i] * (1 - mix) + FOOT_BOTTOM_PX[next] * mix
  figure.position.y = (bottom / 720) * 1.49 - .745 + .012
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
    canvas.addEventListener('pointerup', (event) => {
      if (event.target !== canvas) return
      placeAt(event.clientX, event.clientY, canvas)
    })
  },
  onUpdate: () => {
    if (!figure || !xrCamera) return
    groundFigure()
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
  $('recenter').addEventListener('click', () => {
    placed = false
    if (world) world.visible = false
    $('placement-hint')?.classList.remove('is-hidden')
    setStatus(copy.place)
  })
  $('video-toggle').addEventListener('click', async () => {
    try {
      if (rgbVideo?.paused) await playScene()
      else pauseScene()
    } catch {
      setStatus(copy.blocked)
    }
  })
}

document.documentElement.lang = LANG
document.title = copy.title
$('scene-title').textContent = copy.title
$('mode-label').textContent = copy.mode
$('status').textContent = copy.place
$('placement-hint').textContent = copy.hint
$('recenter').textContent = copy.reset
$('video-toggle').textContent = copy.play

window.XR8 ? start() : window.addEventListener('xrloaded', start)
