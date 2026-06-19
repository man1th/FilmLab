import { useParameterStore } from "@/store/useParameterStore";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ParamSlider } from "@/components/controls/ParamSlider";
import { ParamSwitch } from "@/components/controls/ParamSwitch";
import { ParamSelect } from "@/components/controls/ParamSelect";
import {
  Droplets,
  Sun,
  Grid3x3,
  Scan,
  Camera,
  Film,
  FlaskConical,
} from "lucide-react";

export function ControlSidebar() {
  const {
    chemistry,
    halation,
    grain,
    acutance,
    lens,
    format,
    print,
    groupsEnabled,
    updateChemistry,
    updateHalation,
    updateGrain,
    updateAcutance,
    updateLens,
    updateFormat,
    updatePrint,
    toggleGroup,
  } = useParameterStore();

  return (
    <Accordion type="multiple" className="px-3 pt-2" defaultValue={["group-1"]}>
      {/* ─── Group 1: Chemistry & Tone Curve ─────────────────────────── */}
      <AccordionItem value="group-1">
        <AccordionTrigger className="text-sm font-medium text-zinc-300 py-2.5 gap-2">
          <Droplets className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
          <span className="flex-1 text-left">Chemistry &amp; Tone Curve</span>
          <label
            onClick={(e) => e.stopPropagation()}
            className="relative inline-flex items-center cursor-pointer"
          >
            <input
              type="checkbox"
              className="sr-only peer"
              checked={groupsEnabled.chemistry}
              onChange={() => toggleGroup("chemistry")}
            />
            <div className="w-7 h-4 rounded-full peer bg-zinc-700 peer-checked:bg-amber-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3" />
          </label>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          <ParamSlider
            label="D-Min (Base Density)"
            value={chemistry.dMin}
            min={0}
            max={0.3}
            step={0.01}
            displayValue={chemistry.dMin.toFixed(2)}
            onChange={(v) => updateChemistry({ dMin: v })}
            info="Sets the minimum density of unexposed film stock. Raising this lifts the absolute black floor and introduces a realistic clear-base tint to deep shadows."
          />
          <ParamSlider
            label="D-Max (Maximum Density)"
            value={chemistry.dMax}
            min={0.7}
            max={1.0}
            step={0.01}
            displayValue={chemistry.dMax.toFixed(2)}
            onChange={(v) => updateChemistry({ dMax: v })}
            info="Controls the upper limit of chemical exposure. Dictates highlight compression, peak white retention, and the softness of bright clipping thresholds."
          />
          <ParamSlider
            label="Subtractive Color Density"
            value={chemistry.subtractiveDensity}
            min={0}
            max={2.0}
            step={0.05}
            onChange={(v) => updateChemistry({ subtractiveDensity: v })}
            info="Simulates CMY subtractive dye layer coupling. Amplifies rich, dense color interactions in dark midtones and shadows without digital oversaturation."
          />
          <ParamSlider
            label="Contrast Profile"
            value={chemistry.contrastProfile}
            min={0.5}
            max={2.0}
            step={0.05}
            onChange={(v) => updateChemistry({ contrastProfile: v })}
            info="Modulates the slope of the film's characteristic curve. Sharpens or softens midtone contrast transitions while preserving natural, analog rolloffs."
          />
          <ParamSlider
            label="Chemistry Expiration"
            value={chemistry.chemistryExpiration}
            min={0}
            max={1.0}
            step={0.01}
            onChange={(v) => updateChemistry({ chemistryExpiration: v })}
            info="Simulates aged, degraded chemical emulsion. Triggers subtle color crossover instability, structural latent-image fading, and overall contrast breakdown."
          />
          <ParamSlider
            label="Shadow Fog"
            value={chemistry.shadowFog}
            min={0}
            max={0.2}
            step={0.01}
            displayValue={chemistry.shadowFog.toFixed(2)}
            onChange={(v) => updateChemistry({ shadowFog: v })}
            info="Introduces a uniform chemical haze across deep shadow zones, replicating background silver halide fogging caused by improper storage, heat, or age."
          />
        </AccordionContent>
      </AccordionItem>

      {/* ─── Group 2: Optical Halation & Bleed ───────────────────────── */}
      <AccordionItem value="group-2">
        <AccordionTrigger className="text-sm font-medium text-zinc-300 py-2.5 gap-2">
          <Sun className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
          <span className="flex-1 text-left">Optical Halation &amp; Bleed</span>
          <label
            onClick={(e) => e.stopPropagation()}
            className="relative inline-flex items-center cursor-pointer"
          >
            <input
              type="checkbox"
              className="sr-only peer"
              checked={groupsEnabled.halation}
              onChange={() => toggleGroup("halation")}
            />
            <div className="w-7 h-4 rounded-full peer bg-zinc-700 peer-checked:bg-amber-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3" />
          </label>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          <ParamSlider
            label="Spread Radius"
            value={halation.spreadRadius}
            min={1}
            max={50}
            step={0.5}
            displayValue={`${halation.spreadRadius.toFixed(0)}px`}
            onChange={(v) => updateHalation({ spreadRadius: v })}
          />
          <ParamSlider
            label="Fringe Chromaticity"
            value={halation.fringeChromaticity}
            min={0}
            max={2.0}
            onChange={(v) => updateHalation({ fringeChromaticity: v })}
          />
          <ParamSlider
            label="Edge Retention"
            value={halation.edgeRetention}
            min={0}
            max={1.0}
            onChange={(v) => updateHalation({ edgeRetention: v })}
          />
          <div className="pt-2 pb-1">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              RGB Spill Balance
            </span>
          </div>
          <ParamSlider
            label="Red Spill"
            value={halation.redSpill}
            min={0}
            max={2.0}
            onChange={(v) => updateHalation({ redSpill: v })}
          />
          <ParamSlider
            label="Green Spill"
            value={halation.greenSpill}
            min={0}
            max={2.0}
            onChange={(v) => updateHalation({ greenSpill: v })}
          />
          <ParamSlider
            label="Blue Spill"
            value={halation.blueSpill}
            min={0}
            max={2.0}
            onChange={(v) => updateHalation({ blueSpill: v })}
          />
          <ParamSwitch
            label="Remjet Protection Bypass"
            checked={halation.remjetProtection}
            onChange={(v) => updateHalation({ remjetProtection: v })}
          />
          <ParamSlider
            label="Glow Temperature"
            value={halation.glowTemperature}
            min={2000}
            max={10000}
            step={100}
            displayValue={`${halation.glowTemperature.toFixed(0)}K`}
            onChange={(v) => updateHalation({ glowTemperature: v })}
          />
        </AccordionContent>
      </AccordionItem>

      {/* ─── Group 3: Silver Halide Grain Engine ──────────────────────── */}
      <AccordionItem value="group-3">
        <AccordionTrigger className="text-sm font-medium text-zinc-300 py-2.5 gap-2">
          <Grid3x3 className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
          <span className="flex-1 text-left">Silver Halide Grain Engine</span>
          <label
            onClick={(e) => e.stopPropagation()}
            className="relative inline-flex items-center cursor-pointer"
          >
            <input
              type="checkbox"
              className="sr-only peer"
              checked={groupsEnabled.grain}
              onChange={() => toggleGroup("grain")}
            />
            <div className="w-7 h-4 rounded-full peer bg-zinc-700 peer-checked:bg-amber-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3" />
          </label>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          <ParamSlider
            label="Crystal Density"
            value={grain.crystalDensity}
            min={0}
            max={1.0}
            onChange={(v) => updateGrain({ crystalDensity: v })}
          />
          <ParamSlider
            label="Dye Cloud Saturation"
            value={grain.dyeCloudSaturation}
            min={0}
            max={2.0}
            onChange={(v) => updateGrain({ dyeCloudSaturation: v })}
          />
          <ParamSlider
            label="Clumping Roughness"
            value={grain.clumpingRoughness}
            min={1.0}
            max={5.0}
            onChange={(v) => updateGrain({ clumpingRoughness: v })}
          />
          <ParamSlider
            label="Directional Stretch"
            value={grain.directionalStretch}
            min={-1.0}
            max={1.0}
            onChange={(v) => updateGrain({ directionalStretch: v })}
          />
          <ParamSlider
            label="Anamorphic Squeeze Bias"
            value={grain.anamorphicSqueeze}
            min={1.0}
            max={2.0}
            onChange={(v) => updateGrain({ anamorphicSqueeze: v })}
          />
          <div className="pt-2 pb-1">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Tonal Distribution
            </span>
          </div>
          <ParamSlider
            label="Shadow Yield"
            value={grain.shadowYield}
            min={0}
            max={1.0}
            onChange={(v) => updateGrain({ shadowYield: v })}
          />
          <ParamSlider
            label="Midtone Yield"
            value={grain.midtoneYield}
            min={0}
            max={1.0}
            onChange={(v) => updateGrain({ midtoneYield: v })}
          />
          <ParamSlider
            label="Highlight Yield"
            value={grain.highlightYield}
            min={0}
            max={1.0}
            onChange={(v) => updateGrain({ highlightYield: v })}
          />
        </AccordionContent>
      </AccordionItem>

      {/* ─── Group 4: Acutance, Contrast & Multi-Scale Edge ───────────── */}
      <AccordionItem value="group-4">
        <AccordionTrigger className="text-sm font-medium text-zinc-300 py-2.5 gap-2">
          <Scan className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
          <span className="flex-1 text-left">
            Acutance &amp; Multi-Scale Edge
          </span>
          <label
            onClick={(e) => e.stopPropagation()}
            className="relative inline-flex items-center cursor-pointer"
          >
            <input
              type="checkbox"
              className="sr-only peer"
              checked={groupsEnabled.acutance}
              onChange={() => toggleGroup("acutance")}
            />
            <div className="w-7 h-4 rounded-full peer bg-zinc-700 peer-checked:bg-amber-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3" />
          </label>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          <ParamSlider
            label="Adjacency Effect (Mackie Lines)"
            value={acutance.adjacencyEffect}
            min={0}
            max={1.0}
            onChange={(v) => updateAcutance({ adjacencyEffect: v })}
          />
          <ParamSlider
            label="Scanner Sharpening Ringing"
            value={acutance.scannerSharpening}
            min={0}
            max={1.0}
            onChange={(v) => updateAcutance({ scannerSharpening: v })}
          />
          <div className="pt-2 pb-1">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Micro-Acutance (Fine)
            </span>
          </div>
          <ParamSlider
            label="Fine Detail Amount"
            value={acutance.microAcutance}
            min={0}
            max={3.0}
            onChange={(v) => updateAcutance({ microAcutance: v })}
          />
          <ParamSlider
            label="Fine Edge Balance"
            value={acutance.fineEdgeBalance}
            min={-1.0}
            max={1.0}
            onChange={(v) => updateAcutance({ fineEdgeBalance: v })}
          />
          <ParamSlider
            label="Fine Kernel Size"
            value={acutance.fineKernelSize}
            min={0.5}
            max={3.0}
            onChange={(v) => updateAcutance({ fineKernelSize: v })}
          />
          <div className="pt-2 pb-1">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Macro-Acutance (Coarse)
            </span>
          </div>
          <ParamSlider
            label="Coarse Detail Amount"
            value={acutance.macroAcutance}
            min={0}
            max={3.0}
            onChange={(v) => updateAcutance({ macroAcutance: v })}
          />
          <ParamSlider
            label="Coarse Edge Balance"
            value={acutance.coarseEdgeBalance}
            min={-1.0}
            max={1.0}
            onChange={(v) => updateAcutance({ coarseEdgeBalance: v })}
          />
          <ParamSlider
            label="Coarse Kernel Size"
            value={acutance.coarseKernelSize}
            min={5.0}
            max={30.0}
            step={0.5}
            displayValue={`${acutance.coarseKernelSize.toFixed(1)}px`}
            onChange={(v) => updateAcutance({ coarseKernelSize: v })}
          />
        </AccordionContent>
      </AccordionItem>

      {/* ─── Group 5: Lens Configurations & Aberrations ───────────────── */}
      <AccordionItem value="group-5">
        <AccordionTrigger className="text-sm font-medium text-zinc-300 py-2.5 gap-2">
          <Camera className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
          <span className="flex-1 text-left">
            Lens Configurations &amp; Aberrations
          </span>
          <label
            onClick={(e) => e.stopPropagation()}
            className="relative inline-flex items-center cursor-pointer"
          >
            <input
              type="checkbox"
              className="sr-only peer"
              checked={groupsEnabled.lens}
              onChange={() => toggleGroup("lens")}
            />
            <div className="w-7 h-4 rounded-full peer bg-zinc-700 peer-checked:bg-amber-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3" />
          </label>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          <ParamSlider
            label="Bokeh De-squeeze"
            value={lens.bokehDesqueeze}
            min={1.0}
            max={2.0}
            onChange={(v) => updateLens({ bokehDesqueeze: v })}
          />
          <ParamSlider
            label="Flare Inception Threshold"
            value={lens.flareThreshold}
            min={0.7}
            max={1.0}
            onChange={(v) => updateLens({ flareThreshold: v })}
          />
          <ParamSlider
            label="Streak Extension Reach"
            value={lens.streakExtension}
            min={10.0}
            max={600.0}
            step={5}
            displayValue={`${lens.streakExtension.toFixed(0)}px`}
            onChange={(v) => updateLens({ streakExtension: v })}
          />
          <ParamSelect
            label="Flare Temperature Tint"
            value={lens.flareTint}
            options={[
              { value: "Neutral", label: "Neutral" },
              { value: "Warm", label: "Warm (3200K)" },
              { value: "Cool", label: "Cool (5600K)" },
              { value: "Amber", label: "Amber" },
              { value: "Cyan", label: "Cyan" },
              { value: "Magenta", label: "Magenta" },
            ]}
            onChange={(v) => updateLens({ flareTint: v })}
          />
          <ParamSlider
            label="Geometric Barrel Distortion"
            value={lens.barrelDistortion}
            min={-0.3}
            max={0.3}
            onChange={(v) => updateLens({ barrelDistortion: v })}
          />
          <ParamSlider
            label="Peripheral Softness"
            value={lens.peripheralSoftness}
            min={0}
            max={1.0}
            onChange={(v) => updateLens({ peripheralSoftness: v })}
          />
          <ParamSlider
            label="Promist Diffusion"
            value={lens.promistDiffusion}
            min={0}
            max={1.0}
            onChange={(v) => updateLens({ promistDiffusion: v })}
          />
        </AccordionContent>
      </AccordionItem>

      {/* ─── Group 6: Film Gauge, Formats & Debris ────────────────────── */}
      <AccordionItem value="group-6">
        <AccordionTrigger className="text-sm font-medium text-zinc-300 py-2.5 gap-2">
          <Film className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
          <span className="flex-1 text-left">
            Film Gauge, Formats &amp; Debris
          </span>
          <label
            onClick={(e) => e.stopPropagation()}
            className="relative inline-flex items-center cursor-pointer"
          >
            <input
              type="checkbox"
              className="sr-only peer"
              checked={groupsEnabled.format}
              onChange={() => toggleGroup("format")}
            />
            <div className="w-7 h-4 rounded-full peer bg-zinc-700 peer-checked:bg-amber-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3" />
          </label>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          <ParamSelect
            label="Target Film Gauge"
            value={format.targetGauge}
            options={[
              { value: "8mm", label: "8mm (Standard 8)" },
              { value: "16mm", label: "16mm" },
              { value: "35mm", label: "35mm (Standard)" },
              { value: "65mm", label: "65mm (VistaVision)" },
            ]}
            onChange={(v) => updateFormat({ targetGauge: v })}
          />
          <ParamSlider
            label="Gate Overscan Margin"
            value={format.gateOverscan}
            min={0}
            max={0.25}
            step={0.01}
            displayValue={`${(format.gateOverscan * 100).toFixed(0)}%`}
            onChange={(v) => updateFormat({ gateOverscan: v })}
          />
          <ParamSelect
            label="Debris Profile"
            value={format.debrisProfile}
            options={[
              { value: "Specks", label: "Specks" },
              { value: "Threads", label: "Threads" },
              { value: "Crystals", label: "Crystals" },
            ]}
            onChange={(v) => updateFormat({ debrisProfile: v })}
          />
          <ParamSlider
            label="Debris Frequency"
            value={format.debrisFrequency}
            min={0}
            max={1.0}
            onChange={(v) => updateFormat({ debrisFrequency: v })}
          />
          <ParamSwitch
            label="Sprocket Perforations"
            checked={format.sprocketsEnabled}
            onChange={(v) => updateFormat({ sprocketsEnabled: v })}
          />
          <ParamSlider
            label="Vignette Darkening"
            value={format.vignetteStrength}
            min={0}
            max={1.0}
            onChange={(v) => updateFormat({ vignetteStrength: v })}
          />
          <ParamSwitch
            label="Debris Polar Inversion"
            checked={format.debrisInversion}
            onChange={(v) => updateFormat({ debrisInversion: v })}
          />
        </AccordionContent>
      </AccordionItem>

      {/* ─── Group 7: Laboratory Print Stage & Calibration ────────────── */}
      <AccordionItem value="group-7">
        <AccordionTrigger className="text-sm font-medium text-zinc-300 py-2.5 gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
          <span className="flex-1 text-left">
            Laboratory Print &amp; Calibration
          </span>
          <label
            onClick={(e) => e.stopPropagation()}
            className="relative inline-flex items-center cursor-pointer"
          >
            <input
              type="checkbox"
              className="sr-only peer"
              checked={groupsEnabled.print}
              onChange={() => toggleGroup("print")}
            />
            <div className="w-7 h-4 rounded-full peer bg-zinc-700 peer-checked:bg-amber-600 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3" />
          </label>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-3">
          <ParamSelect
            label="Print Stock Look"
            value={print.printStock}
            options={[
              { value: "Bypass", label: "Bypass (No Print)" },
              { value: "Kodak 2383", label: "Kodak Vision 2383" },
              { value: "Fuji 3510", label: "Fuji Eterna 3510" },
            ]}
            onChange={(v) => updatePrint({ printStock: v })}
          />
          <ParamSlider
            label="Contrast Density (S-Curve)"
            value={print.contrastDensity}
            min={0}
            max={2.0}
            onChange={(v) => updatePrint({ contrastDensity: v })}
          />
          <ParamSlider
            label="Grayscale Neutrality"
            value={print.grayscaleNeutrality}
            min={0}
            max={1.0}
            onChange={(v) => updatePrint({ grayscaleNeutrality: v })}
          />
          <ParamSlider
            label="Shadow Defog"
            value={print.shadowDefog}
            min={0}
            max={1.0}
            onChange={(v) => updatePrint({ shadowDefog: v })}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
