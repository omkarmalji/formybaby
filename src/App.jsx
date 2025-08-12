import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { PageFlip } from 'page-flip'

// pdf.js (ESM worker for Vite)
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'

import {
  PDF_FILE,
  CHAPTERS,
  AUTO_SWITCH_VIDEO_ON_CHAPTER_CHANGE,
  INITIAL_VOLUME,
} from './config.js'

pdfjsLib.GlobalWorkerOptions.workerPort = new pdfjsWorker()

/* --------------------------- helpers --------------------------- */
function findCurrentChapter(pageNum) {
  const sorted = [...CHAPTERS].sort((a, b) => a.startPage - b.startPage)
  let current = sorted[0] || null
  for (const ch of sorted) {
    if (pageNum >= ch.startPage) current = ch
    else break
  }
  return current
}

const nextTick = () => new Promise(r => requestAnimationFrame(r))

/* --------------------- VideoBackground ------------------------- */
/**
 * Imperative API:
 *   bgRef.current.setSource(src: string): Promise<void>
 *   bgRef.current.setMuted(muted: boolean): void
 */


const VideoBackground = forwardRef(function VideoBackground(_, ref) {
  const aRef = useRef(null)
  const bRef = useRef(null)
  const activeIdxRef = useRef(0) // 0 => A visible, 1 => B visible
  const [activeIdx, setActiveIdx] = useState(0)
  const [muted, setMuted] = useState(true)
  const currentSrcRef = useRef('')

  // initialize volumes once
  useEffect(() => {
    if (aRef.current) aRef.current.volume = INITIAL_VOLUME
    if (bRef.current) bRef.current.volume = INITIAL_VOLUME
  }, [])

  // one-time unlock on first user gesture
  useEffect(() => {
    const unlock = () => {
      setMuted(false)
      const A = aRef.current, B = bRef.current
      if (A) { A.muted = false; A.volume = INITIAL_VOLUME }
      if (B) { B.muted = false; B.volume = INITIAL_VOLUME }
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
  }, [])

  // helper: ensure a <video> is actually playing
  const ensurePlaying = async (el) => {
    if (!el) return false
    try {
      if (el.paused) await el.play()
      await nextTick() // allow state to settle
      if (el.paused) await el.play()
      return !el.paused
    } catch {
      return false
    }
  }

  // imperative API
  useImperativeHandle(ref, () => ({
    async setSource(src) {
      if (!src || src === currentSrcRef.current) return // no-op if same video
      const from = activeIdxRef.current === 0 ? aRef.current : bRef.current
      const to   = activeIdxRef.current === 0 ? bRef.current : aRef.current
      if (!to) return

      // prepare next video (autoplay-safe): always start muted
      try {
        to.pause()
        to.src = src
        to.loop = true
        to.playsInline = true
        to.muted = true
        to.volume = 0
        to.load()
        to.currentTime = 0

        // attempt to start
        await to.play().catch(() => {})
        const ok = await ensurePlaying(to)
        if (!ok) throw new Error('Failed to start next video')

        // if we’re globally unmuted, unmute AFTER it’s confirmed playing
        if (!muted) {
          await nextTick()
          to.muted = false
          to.volume = INITIAL_VOLUME
        }

        // Crossfade (opacity via CSS), then finalize
        activeIdxRef.current = activeIdxRef.current ^ 1
        setActiveIdx(activeIdxRef.current)
        currentSrcRef.current = src

        // fade audio if not globally muted
        if (!muted && from) {
          const start = performance.now()
          const D = 800
          const startVol = typeof from.volume === 'number' ? from.volume : INITIAL_VOLUME
          const tick = (t) => {
            const k = Math.min(1, (t - start) / D)
            to.volume = INITIAL_VOLUME * k
            from.volume = startVol * (1 - k)
            if (k < 1) requestAnimationFrame(tick)
            else { from.pause(); from.currentTime = 0 }
          }
          requestAnimationFrame(tick)
        } else if (from) {
          // still fade visually; pause after a delay
          setTimeout(() => from.pause(), 800)
        }
      } catch (e) {
        // keep prior video; don’t black-screen
        console.warn('Video switch failed, keeping previous video:', e)
      }
    },
    setMuted(next) {
      setMuted(next)
      const A = aRef.current, B = bRef.current
      ;[A, B].forEach(v => {
        if (!v) return
        v.muted = next
        v.volume = next ? 0 : INITIAL_VOLUME
      })
    },
    // convenience (optional)
    getMuted() { return muted },
  }), [muted])

  return (
    <div className="video-bg">
      <video
        ref={aRef}
        playsInline
        preload="auto"
        loop
        defaultMuted
        className={`bgv ${activeIdx === 0 ? 'on' : 'off'}`}
      />
      <video
        ref={bRef}
        playsInline
        preload="auto"
        loop
        defaultMuted
        className={`bgv ${activeIdx === 1 ? 'on' : 'off'}`}
      />
      {/* subtle gradient mask as safety so a brief frame gap isn't a hard cut */}
      <div className="video-vignette" />
    </div>
  )
})

/* --------------------------- App ------------------------------- */
export default function App() {
  const containerRef = useRef(null)
  const flipRef = useRef(null)
  const bgRef = useRef(null)

  const [isReady, setIsReady] = useState(false)
  const [loadingText, setLoadingText] = useState('Loading PDF…')
  const [isCover, setIsCover] = useState(true)
  const [muted, setMuted] = useState(true) // UI state
  const [currentVideo, setCurrentVideo] = useState('')

  // hard block page scrolling (wheel/touch) and map arrows to flip
  useEffect(() => {
    const lock = (e) => e.preventDefault()
    window.addEventListener('wheel', lock, { passive: false })
    window.addEventListener('touchmove', lock, { passive: false })
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); flipRef.current?.flipPrev() }
      if (e.key === 'ArrowRight') { e.preventDefault(); flipRef.current?.flipNext() }
      if (e.key === ' ') { e.preventDefault() } // block space scroll
    }
    window.addEventListener('keydown', onKey, { passive: false })
    return () => {
      window.removeEventListener('wheel', lock)
      window.removeEventListener('touchmove', lock)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // init PDF → render to images → init PageFlip → start first video
  useEffect(() => {
    const init = async () => {
      try {
        setLoadingText('I love you…')
        const pdf = await pdfjsLib.getDocument(PDF_FILE).promise

        const pageImgs = []
        const dpr = Math.min(window.devicePixelRatio || 1, 3)
        const scale = 2.0 * dpr
        for (let p = 1; p <= pdf.numPages; p++) {
          setLoadingText(`Rendering our story ${p} / ${pdf.numPages}…`)
          const page = await pdf.getPage(p)
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvasContext: ctx, viewport }).promise
          pageImgs.push({ url: canvas.toDataURL('image/png') })
        }

        await nextTick()
        if (!containerRef.current) return

        const pf = new PageFlip(containerRef.current, {
          width: 1248,
          height: 832,
          size: 'fixed',
          showCover: true,
          usePortrait: true,
          drawShadow: false,
          maxShadowOpacity: 0,
          flippingTime: 450,
          mobileScrollSupport: false,
          swipeDistance: 30,
        })

        const pages = pageImgs.map((img, idx) => {
          const page = document.createElement('div')
          page.className = 'page'
          page.style.width = '100%'
          page.style.height = '100%'
          const imgEl = document.createElement('img')
          imgEl.src = img.url
          imgEl.alt = `Page ${idx + 1}`
          imgEl.style.width = '100%'
          imgEl.style.height = '100%'
          imgEl.style.objectFit = 'contain'
          page.appendChild(imgEl)
          return page
        })

        pf.loadFromHTML(pages)

        pf.on('flip', async (e) => {
          const pageNum = e.data + 1
          setIsCover(pageNum === 1)

          const ch = findCurrentChapter(pageNum)
          if (AUTO_SWITCH_VIDEO_ON_CHAPTER_CHANGE && ch?.video && ch.video !== currentVideo) {
            setCurrentVideo(ch.video)
            // don’t await — keep UI snappy; the component guards black screens
            bgRef.current?.setSource(ch.video)
          }
        })

        // kick off first chapter’s video
        const ch0 = findCurrentChapter(1)
        if (ch0?.video) {
          setCurrentVideo(ch0.video)
          bgRef.current?.setSource(ch0.video) // starts muted for autoplay
        }

        flipRef.current = pf
        setIsReady(true)
      } catch (err) {
        console.error(err)
        setLoadingText('Failed to load PDF. Check console.')
      }
    }
    init()
  }, []) // eslint-disable-line

  const handlePrev = () => flipRef.current?.flipPrev()
  const handleNext = () => flipRef.current?.flipNext()

  const handleMuteToggle = () => {
    const next = !muted
    setMuted(next)
    bgRef.current?.setMuted(next)
  }

  return (
    <div className="app">
      <VideoBackground ref={bgRef} />

      <main className="main">
        <div id="flip-root" className={isCover ? 'is-cover' : ''}>
          {!isReady && (
            <div className="page-placeholder">
              <div>{loadingText}</div>
            </div>
          )}
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </main>

      {/* Minimal floating controls */}
      <div className="controls">
        <button onClick={handlePrev} aria-label="Previous page">◀</button>
        <button onClick={handleNext} aria-label="Next page">▶</button>
        <button onClick={handleMuteToggle}>{muted ? 'Unmute' : 'Mute'}</button>
      </div>
    </div>
  )
}
