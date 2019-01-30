onload = () => {
  document.body.onclick = () => {
    document.body.onclick = null
    start()
  }
}

class PhaseFilter {
  constructor(hz, time = 0.1) {
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
  const audioContext = new AudioContext()
  const node = audioContext.createScriptProcessor(1024, 1, 2)
  node.connect(audioContext.destination)

  navigator.getUserMedia({ audio: true }, stream => {
     var source = audioContext.createMediaStreamSource(stream)
     source.connect(node)
  }, e => console.error(e))
  const hz0 = 441 * 8
  const hzs = []
  const N = 5
  for (let i = 0; i < N; i++) {
    hzs.push(hz0 * Math.pow(2, i / N))
  }
  const hz1 = hzs[0]
  const hz2 = hzs[1]
  const hz3 = hzs[2]
  const hz4 = hzs[3]
  let cnt = 0
  const divs = ['red', 'blue', 'green', 'gray'].map(color => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    div.style.cssText = `
      position: fixed;
      width: 1px;
      height: 100%;
      background: ${color};
      box-shadow: 0 0 2px ${color};
    `
    return div
  })

  const filters = [new PhaseFilter(hz1), new PhaseFilter(hz2), new PhaseFilter(hz3), new PhaseFilter(hz4)]
  document.body.onclick = () => {
    filters.forEach(f => f.setZero())
  }
  node.onaudioprocess = e => {
    const output0 = e.outputBuffer.getChannelData(0)
    const output1 = e.outputBuffer.getChannelData(1)
    const input = e.inputBuffer.getChannelData(0)
    for (let i = 0; i < input.length; i++) {
      cnt++
      output0[i] = 0.25 * (Math.sin(2 * Math.PI * cnt / 44100 * hz1) + Math.sin(2 * Math.PI * cnt / 44100 * hz3)) +
                   0.25 * (Math.sin(2 * Math.PI * cnt / 44100 * hz2) + Math.sin(2 * Math.PI * cnt / 44100 * hz4))
      // output0[i] = 0.5 * (Math.sin(2 * Math.PI * cnt / 44100 * hz1) + Math.sin(2 * Math.PI * cnt / 44100 * hz3))
      // output1[i] = 0.5 * (Math.sin(2 * Math.PI * cnt / 44100 * hz2) + Math.sin(2 * Math.PI * cnt / 44100 * hz4))
      const v = input[i]
      filters.forEach(f => f.update(v))
    }
    const max = Math.max(...filters.map(f => f.magnitude))
    for (let i = 0; i < divs.length; i++) {
      divs[i].style.left = filters[i].normalizedPhase * 100 + '%'
      divs[i].style.opacity = filters[i].magnitude / max
    }
    const result = { v: 0, mm: 0 }
    for (let mm = 0; mm < 1000; mm++) {
      let v = 0
      for (let j = 0; j < 4; j++) {
        const f = filters[j]
        const hz =hzs[j]
        const wlen = 340 * 1000 / hz
        const w = (1 + Math.cos(2 * Math.PI * mm / wlen - f.normalizedPhase * 2 * Math.PI)) / 2
        const wv = (max / 8 + f.magnitude) * Math.pow(w, 4)
        v += wv
      }
      v /= 1000 + mm
      if (result.v < v) {
        result.v = v
        result.mm = mm
      }
    }
    document.querySelector('#distance').textContent = result.mm/10 + 'cm'
  }
}
