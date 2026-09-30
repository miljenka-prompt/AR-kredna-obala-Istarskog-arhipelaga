(() => {
  const COPY = {
    hr: {
      visitor: '<strong>A kako je zvučala?</strong> Ne znamo. Audio spaja rekonstruirani obalni ambijent i eksperimentalnu vokalizaciju oblikovanu prema usporedbama sa živim arhosaurima — pticama i krokodilima — te fosilnim nalazima vokalnog aparata drugih dinosaura.',
      scientific: '<strong>Rekonstrukcija ambijenta i vokalizacije.</strong> Nijedan fosil ne čuva zvuk. Audio spaja rekonstruirani obalni ambijent i eksperimentalnu arhosaurima informiranu vokalizaciju. Komparativni okvir čine žive ptice i krokodili, podaci o vokalizaciji zatvorenih usta te fosilni laringealni elementi drugih dinosaura; rezultat nije oporavljeni glas istarskog trackmakera.',
      environment: 'Kredni okoliš u stvarnom prostoru', guide: '3 · Kredni okoliš u prostoru',
      support: '<strong>Odaberite prostorni prikaz teropoda ili kredni okoliš u stvarnom prostoru.</strong> Bez markera i bez instalacije.',
      disclosure: '<strong>Digitalna izvedba i AI alati.</strong> Kling AI: animirani prizor i okolišni vizual; ElevenLabs Sound Effects: izvedbena rekonstrukcija ambijenta i arhosaurima informirane vokalizacije; ChatGPT GPT-5.6 Sol: WebAR arhitektura i razvojna suradnja. Koncept, istraživanje, interpretacija, kreativno vodstvo i završna evaluacija: Miljenka Ćurković.',
    },
    en: {
      visitor: '<strong>And its voice?</strong> We do not know. The audio combines a reconstructed coastal ambience with an experimental vocalisation shaped by comparisons with living archosaurs — birds and crocodilians — and fossil evidence of the vocal apparatus in other dinosaurs.',
      scientific: '<strong>Ambience and vocalisation reconstruction.</strong> No fossil preserves sound itself. The audio combines a reconstructed coastal ambience with an experimental archosaur-informed vocalisation. Living birds and crocodilians, evidence on closed-mouth vocalisation, and fossil laryngeal elements from other dinosaurs provide the comparative framework; this is not the recovered voice of the Istrian trackmaker.',
      environment: 'Cretaceous environment in real space', guide: '3 · Cretaceous environment in real space',
      support: '<strong>Choose the spatial theropod or the Cretaceous environment in real space.</strong> No marker and no app installation required.',
      disclosure: '<strong>Digital production and AI tools.</strong> Kling AI: animated scene and environmental imagery; ElevenLabs Sound Effects: performance reconstruction of ambience and archosaur-informed vocalisation; ChatGPT GPT-5.6 Sol: WebAR architecture and development collaboration. Concept, research, interpretation, creative direction and final evaluation: Miljenka Ćurković.',
    },
  }

  function updateMuseumCopy() {
    const lang = document.documentElement.lang === 'en' ? 'en' : 'hr'
    const mode = localStorage.getItem('cretaceousMode') || 'scientific'
    const copy = COPY[lang]
    const callouts = [...document.querySelectorAll('#interpretationCopy .callout')]
    const audioCallout = callouts.find((node) => /zvučala|vokalizacije|voice|vocalisation/i.test(node.textContent))
    if (audioCallout) audioCallout.innerHTML = mode === 'scientific' ? copy.scientific : copy.visitor

    const support = document.querySelector('[data-i18n-html="support"]')
    if (support) support.innerHTML = copy.support
    const environmentLink = document.getElementById('environmentLink')
    if (environmentLink) {
      environmentLink.textContent = copy.environment
      environmentLink.href = `./environment-v2.html?lang=${lang}`
    }
    const environmentGuide = document.getElementById('environmentGuide')
    if (environmentGuide) environmentGuide.textContent = copy.guide

    let disclosure = document.getElementById('aiDisclosure')
    if (!disclosure) {
      disclosure = document.createElement('p')
      disclosure.id = 'aiDisclosure'
      disclosure.className = 'detail-note'
      document.getElementById('aboutPanel')?.append(disclosure)
    }
    disclosure.innerHTML = copy.disclosure
  }

  document.querySelectorAll('[data-lang], #modeToggle').forEach((button) => {
    button.addEventListener('click', () => setTimeout(updateMuseumCopy, 0))
  })
  updateMuseumCopy()
})()
