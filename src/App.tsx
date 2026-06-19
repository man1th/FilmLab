import { useRef, useState, useCallback } from 'react'
import { Button, Card, FileInput, Slider, Switch, Tooltip, Icon, H4 } from '@blueprintjs/core'

declare global {
  interface Window {
    createCoreModule: any
  }
}

interface PrintStyleParams {
  toneCurve: number
  color: number
  neutralize: number
  blackpoint: number
  rolloff: number
}

const DEFAULT_PARAMS: PrintStyleParams = {
  toneCurve: 0,
  color: 1,
  neutralize: 0,
  blackpoint: 0,
  rolloff: 0,
}

function LabeledSlider(props: {
  label: string
  tooltip: string
  min: number
  max: number
  stepSize: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 13 }}>{props.label}</span>
        <Tooltip content={props.tooltip}>
          <Icon icon="info-sign" size={12} style={{ opacity: 0.6 }} />
        </Tooltip>
      </div>
      <Slider
        min={props.min}
        max={props.max}
        stepSize={props.stepSize}
        labelStepSize={(props.max - props.min)}
        value={props.value}
        onChange={props.onChange}
      />
    </div>
  )
}

function App() {
  const [darkMode, setDarkMode] = useState(true)
  const [fileName, setFileName] = useState<string>('Choose a photo...')
  const [params, setParams] = useState<PrintStyleParams>(DEFAULT_PARAMS)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const moduleRef = useRef<any>(null)
  const originalImageData = useRef<ImageData | null>(null)

  const getModule = async () => {
    if (!moduleRef.current) {
      moduleRef.current = await window.createCoreModule()
    }
    return moduleRef.current
  }

  const render = useCallback(async (p: PrintStyleParams) => {
    const original = originalImageData.current
    const canvas = canvasRef.current
    if (!original || !canvas) return

    const Module = await getModule()
    const width = original.width
    const height = original.height

    // Always start from the untouched original to keep edits non-destructive/repeatable
    const working = new Uint8ClampedArray(original.data)

    const numBytes = working.length
    const ptr = Module._malloc(numBytes)
    Module.HEAPU8.set(working, ptr)

    const paramArr = new Float32Array([
      p.toneCurve,
      p.color,
      p.neutralize,
      p.blackpoint,
      p.rolloff,
    ])
    const paramsPtr = Module._malloc(paramArr.byteLength)
    Module.HEAPF32.set(paramArr, paramsPtr / 4)

    Module.ccall(
      'process_print_style',
      null,
      ['number', 'number', 'number', 'number'],
      [ptr, width, height, paramsPtr]
    )

    const resultBytes = Module.HEAPU8.subarray(ptr, ptr + numBytes)
    const outputData = new ImageData(new Uint8ClampedArray(resultBytes), width, height)

    Module._free(ptr)
    Module._free(paramsPtr)

    const ctx = canvas.getContext('2d')!
    ctx.putImageData(outputData, 0, 0)
  }, [])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    const img = new Image()
    img.onload = async () => {
      const canvas = canvasRef.current!
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      originalImageData.current = imageData

      setParams(DEFAULT_PARAMS)
      await render(DEFAULT_PARAMS)
    }
    img.src = URL.createObjectURL(file)
  }

  const updateParam = (key: keyof PrintStyleParams, value: number) => {
    const next = { ...params, [key]: value }
    setParams(next)
    render(next)
  }

  return (
    <div className={darkMode ? 'bp6-dark' : ''} style={{ minHeight: '100vh', padding: 16, display: 'flex', gap: 16 }}>
      <Card style={{ width: 280, flexShrink: 0 }}>
        <Switch checked={darkMode} label="Dark mode" onChange={() => setDarkMode(!darkMode)} />
        <FileInput text={fileName} onInputChange={handleFile} inputProps={{ accept: 'image/*' }} fill />

        <H4 style={{ marginTop: 20 }}>Print Style Custom</H4>

        <LabeledSlider
          label="Tone Curve"
          tooltip="Blends between a photochemical contact-print curve and a flatter, telecine-style scan curve."
          min={-1} max={1} stepSize={0.01}
          value={params.toneCurve}
          onChange={(v) => updateParam('toneCurve', v)}
        />
        <LabeledSlider
          label="Color"
          tooltip="Overall color response intensity — push toward vivid or pull toward muted/desaturated."
          min={0} max={2} stepSize={0.01}
          value={params.color}
          onChange={(v) => updateParam('color', v)}
        />
        <LabeledSlider
          label="Neutralize Balance"
          tooltip="Pulls any color cast toward neutral gray, reducing tint imbalances in the image."
          min={0} max={1} stepSize={0.01}
          value={params.neutralize}
          onChange={(v) => updateParam('neutralize', v)}
        />
        <LabeledSlider
          label="Blackpoint"
          tooltip="Lifts or crushes the shadow floor — positive values create a soft, fogged-shadow look; negative deepens contrast."
          min={-1} max={1} stepSize={0.01}
          value={params.blackpoint}
          onChange={(v) => updateParam('blackpoint', v)}
        />
        <LabeledSlider
          label="Highlight Rolloff"
          tooltip="Controls how gently highlights compress before clipping — higher values give a softer, more filmic roll into white."
          min={0} max={1} stepSize={0.01}
          value={params.rolloff}
          onChange={(v) => updateParam('rolloff', v)}
        />

        <Button text="Reset" minimal style={{ marginTop: 8 }} onClick={() => { setParams(DEFAULT_PARAMS); render(DEFAULT_PARAMS) }} />
      </Card>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', border: '1px solid #444' }} />
      </div>
    </div>
  )
}

export default App
