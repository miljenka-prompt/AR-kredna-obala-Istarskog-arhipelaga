import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'

window.THREE = THREE

const VIDEO_URL = './Cretaceous_teropod.mp4?v=20260912'
const MASK_URL = '/QInspired-WebAR-Tracking-Test/theropod-mask.mp4'

let rgbVideo = null
let maskVideo = null
let figure = null
let shadow = null
let xrCamera = null
let statusTimer = null

const $ = (id) => document.getElementById(id)

function setStatus(text, autoHideMs = 0) {
  const el = $('status')
  const card = document.querySelector('.status-card')
  if (!el || !card) return
  if (statusTimer) clearTimeout(statusTimer)
  el.textContent = text
  card.classList.remove('is-hidden')
  if (autoHideMs > 0) statusTimer = setTimeout(() => card.classList.add('is-hidden'), autoHideMs)
}

function makeVideo(src) {
  const video = document.createElement('video')
  video.src = src
  video.loop = true
  video.muted = true
  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  return video
}

function softShadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(128, 64, 8, 128, 64, 120)
  g.addColorStop(0, 'rgba(0,0,0,.34)')
  g.addColorStop(.45, 'rgba(0,0,0,.14)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 128)
  return new THREE.CanvasTexture(canvas)
}

function irregularPatchGeometry(rx = 1.65, rz = 1.15) {
  const shape = new THREE.Shape()
  const pts = [
    [-1.00, 0.00], [-0.82, 0.48], [-0.38, 0.78], [0.12, 0.72],
    [0.70, 0.48], [1.00, 0.05], [0.82, -0.48], [0.30, -0.78],
    [-0.28, -0.72], [-0.78, -0.42],
  ]
  pts.forEach(([x, z], i) => {
    const px = x * rx
    const pz = z * rz
    if (i === 0) shape.moveTo(px, pz)
    else shape.lineTo(px, pz)
  })
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

function buildEnvironment(scene) {
  const env = new THREE.Group()
  env.position.set(0, 0, -1.5)

  const ground = new THREE.Mesh(
    irregularPatchGeometry(1.75, 1.12),
    new THREE.MeshStandardMaterial({color: 0xd8c9a4, roughness: 1, metalness: 0, transparent: true, opacity: 0.88})
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0.004
  env.add(ground)

  const lagoon = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 40),
    new THREE.MeshStandardMaterial({color: 0x78c7c2, roughness: 0.28, metalness: 0, transparent: true, opacity: 0.48, depthWrite: false})
  )
  lagoon.rotation.x = -Math.PI / 2
  lagoon.scale.set(1.35, 0.62, 1)
  lagoon.position.set(0.74, 0.012, -0.26)
  env.add(lagoon)

  const rockMat = new THREE.MeshStandardMaterial({color: 0xb7aa88, roughness: 1, flatShading: true})
  ;[
    [-0.86, 0.10, -0.18, 0.18],
    [0.18, 0.08, 0.58, 0.13],
    [0.94, 0.07, 0.26, 0.11],
  ].forEach(([x, y, z, s], i) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat)
    rock.scale.y = 0.55 + i * 0.08
    rock.rotation.set(0.2 * i, 0.55 * i, 0.12)
    rock.position.set(x, y, z)
    env.add(rock)
  })

  const plantMat = new THREE.MeshStandardMaterial({color: 0x61765b, roughness: 1, flatShading: true})
  ;[
    [-0.62, 0.10, 0.52],
    [-1.08, 0.08, 0.18],
    [0.18, 0.07, -0.64],
    [0.62, 0.06, -0.58],
  ].forEach(([x, y, z], i) => {
    const plant = new THREE.Group()
    for (let j = 0; j < 3; j++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.24 + j * 0.035, 4), plantMat)
      blade.position.set((j - 1) * 0.045, 0.11 + j * 0.012, 0)
      blade.rotation.z = (j - 1) * 0.32
      plant.add(blade)
    }
    plant.scale.setScalar(0.78 + i * 0.07)
    plant.position.set(x, y, z)
    env.add(plant)
  })

  scene.add(env)
}

function alphaMaterial(rgbMap, maskMap) {
  return new THREE.ShaderMaterial({
    uniforms: {
      rgbMap: {value: rgbMap},
      maskMap: {value: maskMap},
      alphaGain: {value: 1.15},
      alphaFloor: {value: 0.08},
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D rgbMap;
      uniform sampler2D maskMap;
      uniform float alphaGain;
      uniform float alphaFloor;
      varying vec2 vUv;
      void main(){
        vec4 rgb = texture2D(rgbMap, vUv);
        float m = texture2D(maskMap, vUv).r;
        float a = smoothstep(alphaFloor, 1.0, m * alphaGain);
        if (a < 0.015) discard;
        gl_FragColor = vec4(rgb.rgb, a);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  })
}

function syncVideos() {
  if (!rgbVideo || !maskVideo) return
  if (Math.abs(rgbVideo.currentTime - maskVideo.currentTime) > 0.08) maskVideo.currentTime = rgbVideo.currentTime
}

async function playBoth() {
  if (!rgbVideo || !maskVideo) return false
  maskVideo.currentTime = rgbVideo.currentTime
  await Promise.all([rgbVideo.play(), maskVideo.play()])
  return true
}

function pauseBoth() {
  rgbVideo?.pause()
  maskVideo?.pause()
}

function buildFigure(scene) {
  rgbVideo = makeVideo(VIDEO_URL)
  maskVideo = makeVideo(MASK_URL)

  const rgbTexture = new THREE.VideoTexture(rgbVideo)
  rgbTexture.colorSpace = THREE.SRGBColorSpace
  rgbTexture.minFilter = THREE.LinearFilter
  rgbTexture.magFilter = THREE.LinearFilter
  rgbTexture.generateMipmaps = false

  const maskTexture = new THREE.VideoTexture(maskVideo)
  maskTexture.colorSpace = THREE.NoColorSpace
  maskTexture.minFilter = THREE.LinearFilter
  maskTexture.magFilter = THREE.LinearFilter
  maskTexture.generateMipmaps = false

  const targetHeight = 1.8
  figure = new THREE.Mesh(new THREE.PlaneGeometry(3.2, targetHeight), alphaMaterial(rgbTexture, maskTexture))
  figure.position.set(0, targetHeight / 2, -1.5)
  figure.renderOrder = 2
  scene.add(figure)

  shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, .85),
    new THREE.MeshBasicMaterial({map: softShadowTexture(), transparent: true, depthWrite: false, toneMapped: false})
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.set(0, .018, -1.5)
  shadow.renderOrder = 1
  scene.add(shadow)

  let rgbReady = false
  let maskReady = false
  const ready = () => {
    if (!rgbReady || !maskReady) return
    const aspect = rgbVideo.videoWidth / rgbVideo.videoHeight
    const width = targetHeight * aspect
    figure.geometry.dispose()
    figure.geometry = new THREE.PlaneGeometry(width, targetHeight)
    shadow.geometry.dispose()
    shadow.geometry = new THREE.PlaneGeometry(Math.max(1.5, width * .72), .85)

    setStatus('Pomakni se oko prizora. Ako izgubiš teropoda, dodirni “Ponovno usidri”.', 5200)
    playBoth().then(() => {
      $('video-toggle').textContent = 'Pauziraj prizor'
    }).catch(() => {
      setStatus('Dodirni “Pokreni prizor”.', 4200)
    })
  }

  rgbVideo.addEventListener('loadedmetadata', () => { rgbReady = true; ready() })
  maskVideo.addEventListener('loadedmetadata', () => { maskReady = true; ready() })
  const error = () => setStatus('Prizor se nije učitao. Osvježi stranicu i pokušaj ponovno.')
  rgbVideo.addEventListener('error', error)
  maskVideo.addEventListener('error', error)
}

const spatialModule = () => ({
  name: 'cretaceous-theropod-spatial-chronovisor-v2',
  onStart: ({canvas}) => {
    const {scene, camera} = XR8.Threejs.xrScene()
    xrCamera = camera
    scene.add(new THREE.HemisphereLight(0xe9f2ff, 0x665c49, 1.35))
    const sun = new THREE.DirectionalLight(0xffffff, 0.75)
    sun.position.set(-2, 4, 2)
    scene.add(sun)
    buildEnvironment(scene)
    buildFigure(scene)
    camera.position.set(0, 1.6, 2.5)
    XR8.XrController.updateCameraProjectionMatrix({origin: camera.position, facing: camera.quaternion})
    canvas.addEventListener('touchmove', (event) => event.preventDefault(), {passive: false})
    setStatus('Uspostavljam prostorni prikaz…')
  },
  onUpdate: () => {
    if (!figure || !xrCamera) return
    syncVideos()
    const dx = xrCamera.position.x - figure.position.x
    const dz = xrCamera.position.z - figure.position.z
    figure.rotation.y = Math.atan2(dx, dz)
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
    spatialModule(),
  ])

  XR8.run({canvas: $('camerafeed')})

  $('recenter')?.addEventListener('click', () => {
    XR8.XrController.recenter()
    setStatus('Prizor je ponovno usidren.', 2600)
  })

  $('video-toggle')?.addEventListener('click', async () => {
    try {
      if (rgbVideo?.paused) {
        await playBoth()
        $('video-toggle').textContent = 'Pauziraj prizor'
      } else {
        pauseBoth()
        $('video-toggle').textContent = 'Pokreni prizor'
      }
    } catch {
      setStatus('Preglednik je blokirao reprodukciju. Dodirni tipku ponovno.')
    }
  })
}

window.XR8 ? start() : window.addEventListener('xrloaded', start)
