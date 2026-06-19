# Ultimate Film Emulation Engine: Technical Architecture & Environment Specification (Part 3)

This document provides the technical blueprint for the project directory workspace, dependency tree, and user interface architecture. It is designed to be ingested directly by an engineering agent to scaffold the complete execution environment within `Desktop/projects/filmlab`.

---

## 1. Package Manifesto & Environment Setup

To ensure zero-copy memory transfers over a `SharedArrayBuffer` between the UI thread, WebAssembly CPU pipeline, and background Web Worker GPU shaders, the local development server must assert strict cross-origin security context headers.

### Required Dependencies (`package.json`)

* **Core:** `react`, `react-dom`
* **Build/Tooling:** `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`, `autoprefixer`, `postcss`
* **State Architecture:** `zustand` (critical for decoupling 40+ high-frequency parameter state mutations from React's main render reconciliation loops, preventing slider stutter).
* **UI Components & Icons:** `lucide-react`, `clsx`, `tailwind-merge`, `tailwindcss-animate`

### Execution Script: Workspace Setup

Run the following commands sequentially inside the project directory (`Desktop/projects/filmlab`):

```bash
# Initialize Vite with TypeScript template
npm create vite@latest . -- --template react-ts

# Install core performance and utility dependencies
npm install zustand lucide-react clsx tailwind-merge tailwindcss-animate

# Install Tailwind CSS and configuration utilities
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Execute the exact production design system preset injection command
npx shadcn@latest init --preset b1VlIw1Q --base base --template vite

```

### Critical Configuration: Cross-Origin Isolation (`vite.config.ts`)

To instantiate `SharedArrayBuffer` objects in modern browsers, Vite must serve the application with Cross-Origin Opener Policy (COOP) and Cross-Origin Embedder Policy (COEP) active.

Update `vite.config.ts` to reflect the following structure:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'configure-response-headers',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

```

---

## 2. Comprehensive Directory Architecture

This structured tree maps out the segregation between our high-frequency WASM compiler source, the canvas render-worker loop, and the React structural panels.

```
filmlab/
├── .vscode/
│   └── settings.json             # C++ and TS format tooling
├── public/
│   ├── assets/                   # Base look LUT patterns (.cube/bin)
│   └── favicon.ico
├── src/
│   ├── assets/                   # Default static vector icons
│   ├── components/
│   │   ├── ui/                   # Inject target space for shadcn primitives
│   │   │   ├── accordion.tsx
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── select.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── tooltip.tsx
│   │   ├── panels/
│   │   │   ├── ControlSidebar.tsx # Modules Group 1 to 8 dynamic controls
│   │   │   ├── TopToolbar.tsx     # History, Ingest, Export controls
│   │   │   └── ViewportCanvas.tsx # WebGL2 canvas mounting wrapper
│   │   └── AppLayout.tsx         # Flex-grid orchestration block
│   ├── hooks/
│   │   └── useEngineBridge.ts    # React interaction window to WebWorker
│   ├── store/
│   │   └── useParameterStore.ts  # Zustand fast-lane state matrix
│   ├── wasm/
│   │   ├── build.sh              # Emscripten compilation pipeline script
│   │   ├── engine_core.c         # C source containing internal SIMD loops
│   │   └── wasm_simd128.h        # Native assembly binding map reference
│   ├── workers/
│   │   └── pipeline.worker.ts    # OffscreenCanvas WebGL context driver
│   ├── App.tsx
│   ├── index.css                 # Global styles and Tailwind declarations
│   ├── main.tsx
│   └── vite-env.d.ts
├── components.json               # Shadcn/ui engine layout configurations
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
└── tsconfig.node.json

```

---

## 3. UI/UX Blueprint & Component Layout

To deliver a high-performance editing experience on an M1 Mac with 8GB RAM, the layout isolates static UI boundaries from high-frequency viewport redraws.

```
+-------------------------------------------------------------------------+
|  [Logo]  TopToolbar: [Import Image] [Before/After] [Undo/Redo] [Export] |
+------------------------------------+------------------------------------+
|                                    | ControlSidebar (Scrollable Layout) |
|                                    | +--------------------------------+ |
|                                    | | > Group 1: Base Emulsion       | |
|                                    | | > Group 2: Light Bleed         | |
|                                    | | > Group 3: The Grain Engine    | |
|         ViewportCanvas             | | > Group 4: Acutance & Contrast | |
|    (Centrally isolated view,       | | > Group 5: Multi-Scale Edge    | |
|   handles zoom, pan via WebGL2     | | > Group 6: Lens Emulation      | |
|     OffscreenCanvas pointer)       | | > Group 7: Format & Dust       | |
|                                    | | > Group 8: Laboratory Print    | |
|                                    | +--------------------------------+ |
+------------------------------------+------------------------------------+

```

### 3.1 Layout Architecture (Three-Zone Desktop Matrix)

The layout uses a dark-mode-first theme configured via Tailwind CSS classes inside `src/components/AppLayout.tsx`:

* **Top Bar Menu (`TopToolbar.tsx`):** Fixed height (`h-14`), horizontal layout (`flex items-center justify-between`), dark background (`bg-zinc-900 border-b border-zinc-800 px-4`). Contains the ingestion trigger, global state switches, history array controls, and the final linear export download matrix.
* **Central Workspace Area (`ViewportCanvas.tsx`):** Responsive viewport allocation container (`flex-1 bg-zinc-950 relative overflow-hidden flex items-center justify-center`). Houses the HTML5 `<canvas>` element driven by the `OffscreenCanvas` transfer model inside the worker thread.
* **Interactive Control Drawer (`ControlSidebar.tsx`):** Fixed width (`w-80`), vertical container aligned to the right, scrollable structure (`h-[calc(100vh-3.5rem)] overflow-y-auto border-l border-zinc-800 bg-zinc-900/50 backdrop-blur`). Organizes the 8 parameter groups into accessible control modules.

### 3.2 Component Group Organization (Accordion Interface Topology)

To minimize layout clutter, parameters 1.1 through 8.4 are nested inside a clean Accordion control layout (`@/components/ui/accordion`) using space-optimized shadcn/ui components:

* **Accordion Item 1: Chemistry & Tone Curve**
* *Sliders:* D-Min (0.0 to 0.3), D-Max (0.7 to 1.0), Subtractive Color Density (0.0 to 2.0), Contrast Profile (0.5 to 2.0), Chemistry Expiration (0.0 to 1.0), Shadow Fog (0.0 to 0.2).


* **Accordion Item 2: Optical Halation & Bleed**
* *Sliders:* Spread Radius (1px to 50px), Fringe Chromaticity Saturation (0.0 to 2.0), Edge Retention (0.0 to 1.0).
* *Multi-Control Sliders:* Red, Green, and Blue Spill Balance vectors grouped together.
* *Toggles:* Remjet Protection Bypass (`Switch`), Glow Temperature (2000K to 10000K).


* **Accordion Item 3: Silver Halide Grain Engine**
* *Sliders:* Crystal Density Strength (0.0 to 1.0), Dye Cloud Saturation (0.0 to 2.0), Grain Clumping Roughness (1.0 to 5.0), Directional Stretch (-1.0 to 1.0), Anamorphic Squeeze Bias (1.0 to 2.0).
* *Tonal Mapping Sliders:* Shadow Yield, Midtone Yield, Highlight Yield (0.0 to 1.0 array).


* **Accordion Item 4: Acutance, Contrast & Multi-Scale Edge**
* *Sliders:* Adjacency Effect Mackie Lines (0.0 to 1.0), Scanner Sharpening Ringing (0.0 to 1.0), Micro-Acutance Fine Detail (0.0 to 3.0), Fine Edge Balance (-1.0 to 1.0), Fine Kernel Size (0.5 to 3.0), Macro-Acutance Coarse Detail (0.0 to 3.0), Coarse Edge Balance (-1.0 to 1.0), Coarse Kernel Size (5.0 to 30.0).


* **Accordion Item 5: Lens Configurations & Aberrations**
* *Sliders:* Bokeh Horizontal De-squeeze (1.0 to 2.0), Flare Inception Threshold (0.7 to 1.0), Streak Extension Reach (10.0 to 600.0), Geometric Barrel Distortion (-0.3 to +0.3), Lens Peripheral Focus Softness (0.0 to 1.0), Promist Chamber Diffusion (0.0 to 1.0).
* *Select Menus:* Flare Temperature Tint Selection.


* **Accordion Item 6: Film Gauge, Formats & Debris**
* *Dropdown Selects:* Target Format Base Gauge (`8mm`, `16mm`, `35mm`, `65mm`), Debris Morphology Profile (`Specks`, `Threads`, `Crystals`).
* *Sliders:* Gate Margin Overscan Layout (0.0 to 0.25), Artifact Accumulation Frequency (0.0 to 1.0).
* *Toggles:* Perforation Transport Channels Sprockets (`Switch`), Vignette Peripheral Darkening (0.0 to 1.0), Debris Polar Inversion (`Switch`).


* **Accordion Item 7: Laboratory Print Stage & Calibration**
* *Dropdown Selects:* Emulated Target Print Stock Look (`Bypass`, `Kodak 2383`, `Fuji 3510`).
* *Sliders:* Inter-Negative Curve Contrast Density (0.0 to 2.0), Grayscale Realignment Neutrality (0.0 to 1.0), Shadow Fog Reclamation Defog (0.0 to 1.0).



---

## 4. User Interaction & Data Routing Flow

To prevent UI lag, state changes and rendering are decoupled using a background data processing loop.

```
 [User Interacts with Slider]
              │
              ▼
   Zustand Store Updates  ──(Subscribes)──>  React UI Re-renders (Slider Element Only)
              │
      (Dispatches Event)
              │
              ▼
      [Web Worker Loop]
              │
     (Checks Shared memory)
              │
              ▼
   [WASM SIMD Compute Core] ───> [WebGL2 Fragment Shaders] ───> [OffscreenCanvas Paint]

```

1. **Ingestion Phase:** The user clicks the image import mechanism in `TopToolbar.tsx`. The file buffer is converted into a linear RGBA `Float32Array` or clamped byte stream.
2. **Shared Memory Allocation:** An underlying `SharedArrayBuffer` is allocated inside `useEngineBridge.ts`. The input image byte arrays are mirrored directly into this memory space, which is shared across the UI thread, Web Worker, and WebAssembly memory regions.
3. **High-Frequency Mutation Tracking:** When a slider is adjusted, the data loop performs the following actions:
* The `Zustand` store (`useParameterStore.ts`) updates the parameter value locally.
* The corresponding entry inside a shared configuration data block (`Float32Array` containing the parameter array values) is updated in real time.
* A high-speed message trigger is dispatched to `pipeline.worker.ts` via `postMessage`: `worker.postMessage({ type: 'RENDER_FRAME' })`.


4. **Vector Execution Pass:** The background Web Worker intercepts the rendering instruction:
* It calls the structural WebAssembly entry functions inside `engine_core.c` via the mapped WASM memory pointers.
* The C-SIMD loops evaluate the per-pixel transformation arrays over the shared memory buffer.
* The worker transfers the processed memory block directly to a WebGL2 texture target, binds the procedural spatial fragment shaders (for Halation, Grain, and Acutance), and renders the image directly onto the user's screen via `OffscreenCanvas`.



---

## 5. Direct Execution Instruction for the Agent

1. Navigate directly into the folder target path: `cd Desktop/projects/filmlab`.
2. Run the terminal commands listed in **Section 1** to initialize the workspace, configure the project dependencies, and inject the requested `shadcn/ui` custom preset setup.
3. Configure `vite.config.ts` with the required Cross-Origin security headers to enable `SharedArrayBuffer` memory allocation.
4. Scaffold the complete workspace directory tree structure detailed in **Section 2**. Create empty files at their designated folder paths to prepare for functional code integration.
