window.AudioContext = window.AudioContext || window.webkitAudioContext
let playing = true
onload = () => {
  document.body.onclick = document.body.ontouchstart = () => {
    document.body.onclick = document.body.ontouchstart = null
    start()
  }
}

class PhaseFilter {
  constructor(hz, time = 0.05) {
    const eth = 2 * Math.PI / 44100 * hz
    const etr = Math.cos(eth)
    const eti = Math.sin(eth)
    const e1 = Math.exp(-1 / (44100 * time))
    const e2 = e1 * e1
    let cnt = 0, e1r = 0, e1i = 0, e2r = 0, e2i = 0
    this.phase = 0
    this.magnitude = 0
    this.zeroPhase = 0
    this.update = value => {
      cnt++
      ;[e1r, e1i] = [e1 * (e1r * etr - e1i * eti) + value, e1 * (e1r * eti + e1i * etr)]
      ;[e2r, e2i] = [e2 * (e2r * etr - e2i * eti) + value, e2 * (e2r * eti + e2i * etr)]
      const vr = e1r - e2r
      const vi = e1i - e2i
      const t = Math.atan2(vr, vi) + 2 * Math.PI * cnt / 44100 * hz
      this.magnitude = Math.sqrt(vr * vr + vi * vi)
      this.phase = t / 2 / Math.PI - Math.floor(t / 2 / Math.PI)
    }
  }
  get normalizedPhase() {
    return (this.phase - this.zeroPhase + 1) % 1
  }
  setZero() {
    this.zeroPhase = this.phase
  }
}

function start() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const node = audioContext.createScriptProcessor(2048, 1, 2)
  node.connect(audioContext.destination)
  navigator.getUserMedia({ audio: true }, stream => {
     var source = audioContext.createMediaStreamSource(stream)
     source.connect(node)
  }, e => console.error(e))
  const canvas = document.querySelector('canvas')
  ctx = canvas.getContext('2d')
  const N = 13
  const hz0 = 441 * 8
  const hzs = []
  const filters = []
  for (let i = 0; i < N; i++) {
    const hz = hz0 * Math.pow(3, i / N)
    hzs.push(hz)
    filters.push(new PhaseFilter(hz))
  }
  const L = 500
  for (let mm = 0; mm <= L; mm += 50) {
    ctx.fillText((mm/10), canvas.width * mm / L, canvas.height - 6)
    const label = document.createElement('div')
    const arrow = document.createElement('div')
    label.className = 'label'
    arrow.className = 'arrow'
    label.textContent = mm / 10
    if (mm == 0) {
      label.classList.add('left')
      arrow.classList.add('left')
    } else if (mm == L) {
      label.classList.add('right')
      arrow.classList.add('right')
    } else {
      const x = label.style.left = 100 * (mm / L)
      arrow.style.left = x + '%'
      label.style.left = (x - 5) + '%'
    }
    document.body.appendChild(label)
    document.body.appendChild(arrow)
  }
  document.body.onclick = document.body.ontouchstart = () => {
    playing = !playing
  }
  let cnt = 0
  node.onaudioprocess = e => {
    const input = e.inputBuffer.getChannelData(0)
    const output0 = e.outputBuffer.getChannelData(0)
    const output1 = e.outputBuffer.getChannelData(1)
    if (!playing) {
      cnt = 0
      for (let i = 0; i < input.length; i++) {
        output0[i] = output1[i] = 0
      }
      return
    }
    for (let i = 0; i < input.length; i++) {
      let v = 0
      for (let j = 0; j < N; j++) {
        v += Math.sin(2 * Math.PI * cnt / 44100 * hzs[j])
      }
      cnt++
      output0[i] = v / N
      output1[i] = 0
      filters.forEach(f => f.update(input[i]))
    }
    if (cnt < 44100) filters.forEach(f => f.setZero())
    const max = Math.max(...filters.map(f => f.magnitude))
    const result = { v: 0, mm: 0 }
    for (let mm = 0; mm < L; mm++) {
      let v = 0
      let weight = 0
      for (let j = 0; j < N; j++) {
        const f = filters[j]
        const hz =hzs[j]
        const wlen = 340 * 1000 / hz
        const wave = (1 + Math.cos(2 * Math.PI * mm / wlen - f.normalizedPhase * 2 * Math.PI)) / 2
        const w = (max / N  + f.magnitude)
        v += w * Math.pow(wave, 2)
        weight += w
      }
      if (result.v < v) {
        result.v = v
        result.mm = mm
      }
    }
    const maxSize = Math.max(canvas.offsetWidth, canvas.offsetHeight)
    const cw = Math.round(canvas.offsetWidth / maxSize * 512)
    const ch = Math.round(canvas.offsetHeight / maxSize * 512)
    if (canvas.width != cw || canvas.height != ch) {
      canvas.width = cw
      canvas.height = ch
    }
    ctx.fillStyle = 'gray'
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < N; i++) {
      const f = filters[i]
      const hz =hzs[i]
      const wlen = 340 * 1000 / hz
      for (let j = 0; j < L / wlen; j++) {
        const x = (wlen * j + wlen * f.normalizedPhase) / L * canvas.width
        ctx.fillRect(x - 1, canvas.height * i / N, 2, canvas.height / N)
      }
    }
    ctx.globalAlpha = 0.4
    ctx.fillRect(result.mm / L * canvas.width - 4, 0, 8, canvas.height)
    document.querySelector('#distance').textContent = `${Math.floor(result.mm / 10)}.${result.mm % 10}cm`
  }
}
