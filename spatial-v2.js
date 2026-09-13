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

function softGroundTexture(center = 'rgba(205,190,154,.28)', edge = 'rgba(205,190,154,0)') {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(256, 256, 40, 256, 256, 250)
  g.addColorStop(0, center)
  g.addColorStop(.55, 'rgba(205,190,154,.16)')
  g.addColorStop(1, edge)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * 512
    const y = Math.random() * 512
    const r = 0.5 + Math.random() * 2.4
    ctx.fillStyle = `rgba(235,226,199,${0.018 + Math.random() * 0.035})`
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function lagoonTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(260, 130, 10, 260, 130, 235)
  g.addColorStop(0, 'rgba(115,190,186,.22)')
  g.addColorStop(.55, 'rgba(115,190,186,.11)')
  g.addColorStop(1, 'rgba(115,190,186,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 512, 256)
  return new THREE.CanvasTexture(canvas)
}

function buildEnvironment(scene) {
  const env = new THREE.Group()
  env.position.set(0, 0, -1.5)

  const trace = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 1.8),
    new THREE.MeshBasicMaterial({map: softGroundTexture(), transparent: true, depthWrite: false, toneMapped: false})
  )
  trace.rotation.x = -Math.PI / 2
  trace.position.y = 0.006
  env.add(trace)

  const lagoon = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, .72),
    new THREE.MeshBasicMaterial({map: lagoonTexture(), transparent: true, depthWrite: false, toneMapped: false})
  )
  lagoon.rotation.x = -Math.PI / 2
  lagoon.position.set(.72, .009, -.32)
  lagoon.rotation.z = -.16
  env.add(lagoon)

  const rockMat = new THREE.MeshStandardMaterial({color: 0xb5aa91, roughness: .96, metalness: 0})
  ;[
    [-.78, .055, .22, .13, .72, 1.15],
    [.35, .04, .48, .09, .62, 1.3],
    [1.00, .035, .15, .07, .55, 1.25],
  ].forEach(([x, y, z, s, sy, sx], i) => {
    const rock = new THREE.Mesh(new THREE.SphereGeometry(s, 14, 9), rockMat)
    rock.scale.set(sx, sy, .9 + i * .08)
    rock.rotation.y = i * .73
    rock.position.set(x, y, z)
    env.add(rock)
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
  name: 'cretaceous-theropod-spatial-chronovisor-v3',
  onStart: ({canvas}) => {
    const {scene, camera} = XR8.Threejs.xrScene()
    xrCamera = camera
    scene.add(new THREE.HemisphereLight(0xe9f2ff, 0x665c49, 1.15))
    const sun = new THREE.DirectionalLight(0xffffff, 0.58)
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
