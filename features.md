# Ultimate Film Emulation Engine: Technical Architecture (Part 1)

## Core Pipeline Architecture Review

* **UI Thread:** React + shadcn/ui strictly manages state and dispatches slider values.
* **Memory:** Image data resides in a `SharedArrayBuffer` to achieve zero-copy architecture.
* **CPU Pipeline (C + WASM + SIMD):** Handles per-pixel, 1D color math (Tone, Chemistry, Expiration). Processes 4 pixels per clock cycle using `wasm_simd128.h`.
* **GPU Pipeline (WebGL2 via OffscreenCanvas):** Handles spatial math, convolution kernels, and procedural generation (Halation, Grain, Mackie Lines) executed in a Web Worker.

---

## Group 1: Base Emulsion & Chemistry (Tone & Color)

*Execution: C (WASM) + SIMD. This layer processes pure chemical response before any physical artifacts are introduced.*

### 1.1 D-Min (Film Base Density)

* **Description:** Mimics the physical unexposed celluloid base. It raises the absolute black point organically, compressing shadow details without introducing a linear digital "lift" that washes out the image.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: 0.0, Max: 0.3, Default: 0.0, Step: 0.01
* **Mathematical Implementation:**
Shifts the linear floor of the exposure scale. For a normalized input pixel intensity $I_{\text{in}}$:

$$I_{\text{out}} = D_{\text{min}} + (1.0 - D_{\text{min}}) \cdot I_{\text{in}}$$



**SIMD Implementation:**
```c
// C WASM SIMD loop processing 4 pixels simultaneously
v128_t input = wasm_v128_load(pixel_ptr);
v128_t dmin_vec = wasm_f32x4_splat(d_min);
v128_t scale_vec = wasm_f32x4_splat(1.0f - d_min);
v128_t output = wasm_f32x4_add(dmin_vec, wasm_f32x4_mul(scale_vec, input));

```



### 1.2 D-Max (Maximum Density)

* **Description:** The absolute chemical saturation limit. Forces a soft-clipping ceiling in overexposed regions, mimicking film's inability to record infinite brightness.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: 0.7, Max: 1.0, Default: 1.0, Step: 0.01
* **Mathematical Implementation:**

$$I_{\text{out}} = \min(I_{\text{in}}, D_{\text{max}})$$



Executed using the hardware-level `wasm_f32x4_min` operator to cleanly clip highlight overflow before tone mapping.

### 1.3 Subtractive Color Density

* **Description:** Emulates CMY (Cyan, Magenta, Yellow) dye couplers. As saturation increases, colors become darker and richer (subtractive), unlike digital RGB which gets brighter (additive).
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: 0.0, Max: 2.0, Default: 1.0, Step: 0.05
* **Mathematical Implementation:**
Convert linear RGB to subtractive density, apply the scalar $S_d$, and convert back:

$$C = -\ln(R), \quad M = -\ln(G), \quad Y = -\ln(B)$$


$$R_{\text{out}} = \exp(-C \cdot S_d), \quad G_{\text{out}} = \exp(-M \cdot S_d), \quad B_{\text{out}} = \exp(-Y \cdot S_d)$$



*Performance Note:* `exp` and `log` are computationally expensive in C loops. The agent must implement a 1D pre-computed Look-Up Table (LUT) array in C memory to map these values instantly.

### 1.4 Emulsion Contrast (Curve Bias)

* **Description:** Modifies the steepness of the Hurter–Driffield curve, focusing heavily on shadow toe and highlight shoulder compression.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: 0.5, Max: 2.0, Default: 1.0, Step: 0.05
* **Mathematical Implementation:**
A normalized sigmoidal transfer function where $\gamma$ is the slider value:

$$f(x) = \frac{1}{1 + \exp(-\gamma \cdot (x - 0.5))}$$



### 1.5 Chemistry Expiration & Crossover

* **Description:** Simulates degraded silver halides. Casts an unpredictable, non-linear cyan/green tint strictly into the shadow structures.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: 0.0, Max: 1.0, Default: 0.0, Step: 0.01
* **Mathematical Implementation:**
Modulates specific channel lift as an inverse quadratic function of pixel luminance $Y$:

$$R_{\text{lift}} = (1.0 - Y)^2 \cdot \text{ExpirationFactor} \cdot 0.05$$


$$G_{\text{lift}} = (1.0 - Y)^2 \cdot \text{ExpirationFactor} \cdot 0.12$$



Added directly to the RGB vectors in the SIMD pipeline.

---

## Group 2: Light Bleed & Halation (Optical/Chemical Reaction)

*Execution: WebGL2 Fragment Shaders. Requires spatial convolution (blurring) which must be offloaded to the GPU to maintain $>60\text{ FPS}$.*

### 2.1 Bleed Spread (Radius)

* **Description:** The physical pixel distance light scatters through the emulsion backing.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: 1.0, Max: 50.0, Default: 10.0, Step: 1.0 (Pixels)
* **Mathematical Implementation:**
Maps directly to the standard deviation $\sigma$ in a 2D Gaussian function. To maintain performance, WebGL must execute this as a decoupled two-pass (Horizontal, then Vertical) linear blur on a luminance-thresholded texture.

$$G(x,y) = \frac{1}{2\pi\sigma^2} \exp\left(-\frac{x^2+y^2}{2\sigma^2}\right)$$



### 2.2 Fringe Chromaticity (Saturation)

* **Description:** The color purity of the glowing fringe.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: 0.0, Max: 2.0, Default: 1.0, Step: 0.05
* **Mathematical Implementation:**
Within the fragment shader, convert the blurred halation texture sample to HSV, multiply the $S$ channel by the scalar, and convert back to RGB.

### 2.3 R/G/B Spill Balance

* **Description:** Dictates the wavelength mapping of the light scattering. Dominant Red mimics Cinestill 800T (anti-halation backing removed).
* **UI Element:** 3x `Sliders` (shadcn/ui) - Grouped
* **Bounds:** Min: 0.0, Max: 1.0, Default: (R: 1.0, G: 0.2, B: 0.0)
* **Mathematical Implementation:**
A vector multiplication applied to the halation texture prior to additive blending with the base image:

$$\text{Halation}_{\text{scaled}} = \text{Halation}_{\text{raw}} \cdot \begin{bmatrix} R_{\text{spill}} \\ G_{\text{spill}} \\ B_{\text{spill}} \end{bmatrix}$$



### 2.4 Edge Retention (Bilateral Constraint)

* **Description:** Prevents halation from bleeding over and erasing sharp structural silhouettes (e.g., powerlines crossing a bright sky).
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: 0.0 (Soft), Max: 1.0 (Strict Masking), Default: 0.2
* **Mathematical Implementation:**
Modifies the Gaussian blur into a Bilateral Filter inside WebGL. The weight $W$ of neighboring pixels drops if their luminance variance exceeds a threshold relative to the target pixel:

$$W = \exp\left(-\frac{\Delta p^2}{2\sigma_s^2}\right) \cdot \exp\left(-\frac{\Delta L^2}{2\sigma_r^2 \cdot (1.0 - \text{EdgeRetention})}\right)$$



Where $\Delta p$ is spatial distance and $\Delta L$ is luma difference.

---

## Group 3: The Grain Engine (Silver Halide Simulation)

*Execution: WebGL2 Procedural Generation. We do not use static image overlays; grain is generated mathematically per-pixel via shaders for infinite resolution scaling.*

### 3.1 Crystal Density (Strength) & Dye Cloud Saturation

* **Description:** The opacity of the grain layer and whether the grain is monochromatic (Luma) or colored (Chroma).
* **UI Elements:** 2x `Sliders` (shadcn/ui)
* **Bounds (Density):** Min: 0.0, Max: 1.0, Default: 0.1
* **Bounds (Saturation):** Min: 0.0, Max: 2.0, Default: 0.0
* **Mathematical Implementation:**
Generates a pseudo-random hash via a GLSL fract/sin function. Mixes a greyscale noise vector $\vec{v}_{\text{luma}}$ with an RGB noise vector $\vec{v}_{\text{chroma}}$ based on the Saturation scalar, multiplied by Density.

### 3.2 Clumping Factor (Roughness)

* **Description:** Causes individual grain particles to stick together, simulating organic, gritty silver halide clusters.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: 1.0, Max: 5.0, Default: 1.0, Step: 0.1
* **Mathematical Implementation:**
Shifts the generation algorithm from standard white noise to **Cellular Voronoi Noise** or **Fractional Brownian Motion (fBm)**. The slider inversely scales the grid frequency of the Voronoi algorithm inside the shader.

### 3.3 Directional Stretch & Anamorphic Bias

* **Description:** Stretches grain to simulate physical film advancing mechanisms or anamorphic lens squeeze.
* **UI Element:** `Slider` (Anamorphic), `Slider` (Streak Direction)
* **Bounds (Anamorphic):** Min: 1.0, Max: 2.0, Default: 1.0
* **Mathematical Implementation:**
Transforms the UV coordinate space of the noise generator using a 2D rotation/scale matrix:

$$\begin{bmatrix} U' \\ V' \end{bmatrix} = \begin{bmatrix} \text{Bias}_{\text{ana}} & 0 \\ 0 & 1.0 \end{bmatrix} \cdot \begin{bmatrix} \cos(\theta) & -\sin(\theta) \\ \sin(\theta) & \cos(\theta) \end{bmatrix} \cdot \begin{bmatrix} U \\ V \end{bmatrix}$$



### 3.4 Tonal Distribution (Shadow, Mid, Highlight Yield)

* **Description:** Physical grain is most visible in midtones and drops off in pure blacks/whites. This allows users to sculpt where the grain lives.
* **UI Element:** 3x `Sliders` (shadcn/ui)
* **Bounds:** Min: 0.0, Max: 1.0 for all. Default: (S: 0.2, M: 1.0, H: 0.05)
* **Mathematical Implementation:**
A 3-point parabolic weighting equation mapped to pixel Luminance $Y$:

$$W(Y) = S \cdot (1.0 - Y)^2 + M \cdot (4.0 \cdot Y \cdot (1.0 - Y)) + H \cdot Y^2$$



The final noise fragment is multiplied by $W(Y)$ before overlaying onto the image buffer.

---

## Group 4: Acutance & Micro-Contrast

*Execution: WebGL2 Fragment Shaders.*

### 4.1 Adjacency Effect (Mackie Lines)

* **Description:** Simulates chemical developer exhaustion. Creates a distinct micro-contrast boundary: a dark band on the dark side of an edge, and a light band on the bright side.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: 0.0, Max: 1.0, Default: 0.0, Step: 0.05
* **Mathematical Implementation:**
Computed via a Difference of Gaussians (DoG) filter in WebGL. Subtracting a heavily blurred version of the image from a lightly blurred version isolates the high-frequency edges, which are then multiplied by the slider value and added back to the original image.

$$\text{DoG}(x,y) = G_{\sigma_1}(x,y) - G_{\sigma_2}(x,y)$$



### 4.2 Scanner Sharpening Artifacts

* **Description:** Mimics the specific digital ringing and harsh micro-contrast of vintage drum and lab scanners (Noritsu/Frontier).
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: 0.0, Max: 1.0, Default: 0.0
* **Mathematical Implementation:**
Applies a discrete convolution matrix (Unsharp Masking approximation) mimicking the sinc-function ringing of old digital signal processors:

$$\begin{bmatrix} 0 & -1 & 0 \\ -1 & 5 & -1 \\ 0 & -1 & 0 \end{bmatrix} \cdot \text{Intensity}$$

---

## Group 5: Multi-Scale Acutance & Edge Control

*Execution: WebGL2 Fragment Shaders. Isolates specific frequency bands inside a pixel matrix to sculpt perceived sharpness and chemical edge reactions without creating digital halos.*

### 5.1 Micro-Acutance (Fine Detail Amount)

* **Description:** Controls the amplification of high-frequency spatial details (such as skin pores, fabric texture, or fine hair) without affecting large shapes.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `0.0`, Max: `3.0`, Default: `1.0`, Step: `0.05`
* **Mathematical Implementation:** Isolates high frequencies using a discrete Laplacian filtering step inside the fragment shader. A 3x3 convolution matrix samples neighboring pixels to compute high-frequency divergence, scaled by the slider value ($A_f$):

$$\text{Laplacian Kernel} = \begin{bmatrix} 0 & -1 & 0 \\ -1 & 4 & -1 \\ 0 & -1 & 0 \end{bmatrix}$$


$$I_{\text{out}} = I_{\text{in}} + A_f \cdot (I_{\text{in}} * \text{Laplacian})$$



### 5.2 Fine Edge Balance

* **Description:** Governs the symmetry of the fine-detail sharpening response. Shifting toward negative limits darkens local edge boundaries; shifting positive accentuates bright specular micro-halos.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `-1.0`, Max: `1.0`, Default: `0.0`, Step: `0.05`
* **Mathematical Implementation:**
Splits the isolated high-frequency component ($H_f = I_{\text{in}} * \text{Laplacian}$) into positive and negative ranges, applying asymmetric multipliers tied to the balance factor ($B_f$):

$$H'_f = \begin{cases} H_f \cdot (1.0 + B_f) & \text{if } H_f > 0 \\ H_f \cdot (1.0 - B_f) & \text{if } H_f \le 0 \end{cases}$$



### 5.3 Fine Kernel Size (Radius)

* **Description:** Adjusts the physical pixel span of the high-frequency detection filter. Scales the width of the sampled edge boundaries.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `0.5`, Max: `3.0`, Default: `1.0`, Step: `0.1` (Pixels)
* **Mathematical Implementation:**
Dynamically modulates the UV step offset vector inside the texture sampler loop of the GLSL fragment shader:
```glsl
vec2 texelSize = 1.0 / u_resolution * u_fine_kernel_size;

```



### 5.4 Macro-Acutance (Coarse Detail Amount)

* **Description:** Emphasizes structural micro-contrast across broad mid-frequency bands, mimicking the distinct rendering of vintage lens groupings and large-format emulsions.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `0.0`, Max: `3.0`, Default: `1.0`, Step: `0.05`
* **Mathematical Implementation:**
Constructs a low mid-frequency band pass frame by calculating the difference between two downsampled mipmap texture targets ($L_1$ and $L_2$). The resulting coarse structure profile is mixed into the primary buffer using the coarse scalar ($A_c$).

### 5.5 Coarse Edge Balance

* **Description:** Regulates the tonal bias of large structural halos, determining whether thick edge definitions clip primarily into neighboring highlights or shadow fields.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `-1.0`, Max: `1.0`, Default: `0.0`, Step: `0.05`
* **Mathematical Implementation:**
Identical in architecture to parameter 5.2, but executed exclusively on the isolated mid-frequency macro texture mask prior to final composition.

### 5.6 Coarse Kernel Size (Radius)

* **Description:** Dictates the pixel boundary thickness of macro structural sharpness outlines.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `5.0`, Max: `30.0`, Default: `10.0`, Step: `0.5` (Pixels)
* **Mathematical Implementation:**
Controls the look-up offset multiplier for the wide-aperture macro blur pass, sampling a broad, sparse texture coordinate grid inside the WebGL loop.

---

## Group 6: Optical Lens Emulation (Vintage Glass & Anamorphic)

*Execution: WebGL2 Pipeline via specialized multi-pass render targets. Replicates geometric and chromatic aberrations born out of historical camera glass and anamorphic configurations.*

### 6.1 Bokeh De-squeeze (Anamorphic Squeeze Factor)

* **Description:** Morphologically distorts the coordinate space of spatial elements to emulate the characteristic tall oval out-of-focus highlights yielded by anamorphic lenses.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `1.0` (Spherical), Max: `2.0` (2x Anamorphic Squeeze), Default: `1.0`, Step: `0.01`
* **Mathematical Implementation:**
Alters the aspect ratio of coordinate operations during the spatial filtering passes. When executing any subsequent blur mask, the horizontal texture coordinate step size is scaled inversely by the squeeze factor ($S_a$):

$$\Delta U = \frac{\Delta U_{\text{base}}}{S_a}, \quad \Delta V = \Delta V_{\text{base}}$$



### 6.2 Anamorphic Flare Activation Threshold

* **Description:** Establishes the minimum luminance point required for a localized light source to trigger a horizontal lens streak flare.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `0.7`, Max: `1.0`, Default: `0.95`, Step: `0.01`
* **Mathematical Implementation:**
Isolates bright highlights into a dedicated offscreen render buffer via a thresholding shader fragment pass:

$$\text{Color}_{\text{isolated}} = \max(\text{Color}_{\text{in}} - T_a, 0.0) \cdot \frac{1.0}{1.0 - T_a}$$



Where $T_a$ is the threshold value.

### 6.3 Flare Linear Elongation (Reach)

* **Description:** Controls how far the horizontal anamorphic streak flare bleeds and scales across the canvas width.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `10.0`, Max: `500.0`, Default: `150.0`, Step: `5.0` (Pixels)
* **Mathematical Implementation:**
Executes an iterative, heavily directional 1D horizontal box-blur downsampling routine exclusively over the isolated high-threshold highlight frame, scaling coordinates exclusively on the $U$-axis over 4 successive passes.

### 6.4 Flare Chromatic Shift (Color)

* **Description:** Shifts the tint of the horizontal streaks from classic vintage deep cobalt blue to neutral white or warm amber tones.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `2000K` (Amber), Max: `15000K` (Anamorphic Blue), Default: `11000K`, Step: `100K`
* **Mathematical Implementation:**
Transforms the intensity value of the calculated horizontal streak texture mask by multiplying it with a normalized RGB color coordinate vector generated from the chosen Kelvin color temperature integer.

### 6.5 Radial Barrel Distortion (Geometric Aberration)

* **Description:** Emulates the non-linear barrel bowing of wide vintage lenses, warping the image outward from the optical center.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `-0.2` (Pincushion), Max: `0.2` (Barrel), Default: `0.0`, Step: `0.01`
* **Mathematical Implementation:**
Warping occurs during primary texture mapping via a standard Brown-Conrady polynomial radial distortion formula applied to normalized coordinates ($r^2 = x^2 + y^2$):

$$x' = x \cdot (1.0 + K_1 \cdot r^2 + K_2 \cdot r^4)$$


$$y' = y \cdot (1.0 + K_1 \cdot r^2 + K_2 \cdot r^4)$$



Where $K_1$ matches the slider input value, and $K_2$ is set internally to $K_1 \cdot 0.5$ for balanced edge expansion.

### 6.6 Peripheral Softness (Spherical Aberration)

* **Description:** Introduces a progressive blur from the center toward the image periphery, mimicking the edge-definition loss typical of vintage optics shot wide open.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `0.0`, Max: `1.0`, Default: `0.0`, Step: `0.05`
* **Mathematical Implementation:**
Generates a radial mask value ($M_r$) relative to the distance from center coordinates $(0.5, 0.5)$. The pixel output is a linear interpolation (`mix`) between the clean image base and a secondary blurred image pass:

$$M_r = \text{pow}(\text{distance}(\text{UV}, \vec{0.5}) \cdot 2.0, \, 2.0)$$


$$\text{Color}_{\text{final}} = \text{mix}(\text{Color}_{\text{sharp}}, \text{Color}_{\text{blurred}}, M_r \cdot \text{SoftnessFactor})$$



### 6.7 Promist Diffusion (Chamber Mist)

* **Description:** Emulates an on-lens physical mist diffusion filter. Introduces an ambient un-masked highlight glow across all midtones, separate from the chemical reaction of halation.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `0.0`, Max: `1.0`, Default: `0.0`, Step: `0.02`
* **Mathematical Implementation:**
Composites a large-radius Gaussian blurred frame pass back over the original image sequence using a Screen blend operation, scaled by the Promist factor ($P_f$):

$$\text{Color}_{\text{final}} = 1.0 - (1.0 - \text{Color}_{\text{base}}) \cdot (1.0 - \text{Color}_{\text{blur}} \cdot P_f)$$



---

## Group 7: Format, Gate & Dust Simulation

*Execution: Hybrid Engine. The structural format acts as a scaling coefficient inside the C compiler/WASM memory, while debris texturing layers execute inside the WebGL rendering step.*

### 7.1 Target Film Gauge

* **Description:** Standardizes the physical scale of the grain structure, light bleed thresholds, and acutance fields to perfectly align with specific negative surface formats.
* **UI Element:** `Select` / Dropdown (shadcn/ui)
* **Options:** `8mm`, `16mm`, `35mm`, `65mm` (Default: `35mm`)
* **Mathematical Implementation:**
Acts as a global multiplier constant ($F_g$) that alters the parameter inputs of other engines. When switched to `8mm`, $F_g = 4.0$ (drastically amplifying grain clumping and halation radius); when switched to `65mm`, $F_g = 0.25$ (yielding tight, hyper-fine grain architecture).

### 7.2 Gate Overscan Padding

* **Description:** Scales down and frames the active photo texture to reveal the unexposed, rounded chemical physical borders of the camera gate negative sheet.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `0.0` (Full Bleed Frame), Max: `0.2`, Default: `0.0`, Step: `0.01`
* **Mathematical Implementation:**
Compresses the primary texture input layout UV space coordinates toward the center point:

$$\text{UV}_{\text{scaled}} = (\text{UV} - \vec{0.5}) \cdot (1.0 + \text{Padding}) + \vec{0.5}$$



Texture samples landing outside the $(0.0 - 1.0)$ coordinate space return procedural black or pre-mapped negative border textures with rounded corners modeled via a signed distance field (SDF) box formula.

### 7.3 Camera Mechanical Perforations (Sprockets)

* **Description:** Renders physical negative film sprocket holes into the overscan frame border space. (Requires Gate Overscan to be $> 0.0$).
* **UI Element:** `Switch` / Toggle (shadcn/ui)
* **Bounds:** Binary (`true` / `false`), Default: `false`
* **Mathematical Implementation:**
When flagged active, a procedural GLSL fragment pass runs an analytical repetition calculation along the vertical border layout edges using a periodic sine function mapped to a sharp step sequence, generating empty transparent rectangular perforation channels inside the black border zone.

### 7.4 Peripheral Exposure Falloff (Vignette)

* **Description:** Simulates illumination loss in peripheral lens regions, darkening the outer edges of the frame.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `0.0`, Max: `1.0`, Default: `0.2`, Step: `0.05`
* **Mathematical Implementation:**
Applies a cosine-fourth law approximation across the fragment coordinates:

$$V_{\text{mask}} = \cos(\text{distance}(\text{UV}, \vec{0.5}) \cdot \text{VignetteFactor})$$


$$\text{Color}_{\text{out}} = \text{Color}_{\text{in}} \cdot \text{clamp}(V_{\text{mask}}, 0.0, 1.0)$$



### 7.5 Physical Debris Profile (Dust & Lint)

* **Description:** Changes the structural preset taxonomy of the physical artifact generation engine.
* **UI Element:** `Select` / Dropdown (shadcn/ui)
* **Options:** `Emulsion Specks`, `Hair & Lint Threads`, `Mineral Crystals`
* **Mathematical Implementation:**
Switches the mathematical noise hash logic inside the procedural generator between a sparse cellular point distribution (Emulsion Specks) and an integrated line-segment vector generator based on multi-frequency Perlin noise strings (Hair & Lint).

### 7.6 Dust Intermittent Density

* **Description:** Adjusts the amount of randomly distributed dust and physical particles scattered across the photo plane.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `0.0`, Max: `1.0`, Default: `0.05`, Step: `0.01`
* **Mathematical Implementation:**
Controls the sparse discard threshold of a high-frequency coordinate hashing function:
```glsl
float noiseValue = pseudo_random_hash(floor(UV * u_density_scale));
if (noiseValue > (1.0 - u_dust_density)) { // Render artifact fragment }

```



### 7.7 Dust Polar Inversion (Light vs Dark)

* **Description:** Toggles the chemical location of the debris. "Negative" creates dark specks (dust sitting on the negative during exposure); "Print" creates white specks (dust sitting on the scanner glass).
* **UI Element:** `Switch` / Toggle (shadcn/ui)
* **Bounds:** Binary (`Negative` / `Print`), Default: `Negative`
* **Mathematical Implementation:**
Controls the blending mode of the generated debris fragment.

$$\text{Negative Blending:} \quad \text{Color}_{\text{final}} = \text{Color}_{\text{base}} \cdot (1.0 - \text{Debris}_{\text{alpha}})$$


$$\text{Print Blending:} \quad \text{Color}_{\text{final}} = \text{Color}_{\text{base}} + \text{Debris}_{\text{alpha}}$$



---

## Group 8: Photochemical Print Process & Transforms

*Execution: C (WASM) + SIMD Pipeline. Simulates the final film-to-film laboratory inter-negative print transfer step, cross-balancing color channel interaction under high density.*

### 8.1 Emulated Print Medium (Target Look Transform)

* **Description:** Triggers specific 3D color lookup configurations that simulate printing raw negative profiles onto historic release projection print stocks.
* **UI Element:** `Select` / Dropdown (shadcn/ui)
* **Options:** `Linear Scan (Bypass)`, `Kodak 2383 Profile`, `Fuji 3510 Profile`, `Warm Tone Monolith`
* **Mathematical Implementation:**
Loads a pre-compiled 3D RGB Look-Up Table matrix ($33 \times 33 \times 33$ data space vertices) into the WebAssembly memory layout. The incoming RGB channel vectors act as high-speed trilinear memory interpolation indices to map cross-channel output shifts instantly.

### 8.2 Print Contrast Density (S-Curve Compression)

* **Description:** Modulates the compression slope of the print film's characteristic curve, crushing deep blacks and pulling down low midtones to achieve cinematic pop.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `0.0`, Max: `2.0`, Default: `1.0`, Step: `0.05`
* **Mathematical Implementation:**
Executed in the C-SIMD loop using an optimized cubic polynomial spline function centered around the 18% middle gray value ($0.18$):

$$x_{\text{norm}} = I_{\text{in}} - 0.18$$


$$I_{\text{out}} = 0.18 + x_{\text{norm}} \cdot \text{ContrastFactor} - 0.4 \cdot \text{pow}(x_{\text{norm}}, 3.0) \cdot (1.0 - \text{ContrastFactor})$$



### 8.3 Grayscale Balance Color Neutralization

* **Description:** Counteracts the natural chemical crossover color shifts in unexposed areas, forcing the mid-grays and shadows back into strict algorithmic alignment.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `0.0`, Max: `1.0`, Default: `0.0`, Step: `0.05`
* **Mathematical Implementation:**
Calculates the running desaturated luminance value ($Y$) of the pixel vector. It linearly interpolates (`mix`) the native colored pixel channels back toward absolute gray alignment, weighted by the inverse saturation profile:

$$\vec{C}_{\text{neutral}} = \vec{\text{Luma}}(Y)$$


$$\vec{C}_{\text{out}} = \text{mix}(\vec{C}_{\text{in}}, \vec{C}_{\text{neutral}}, \text{NeutralizationFactor} \cdot (1.0 - \text{Saturation}))$$



### 8.4 Base Shadow Defogging (Logarithmic Black Correction)

* **Description:** Mitigates the milky raised shadow fogging artifacts caused by expired film chemical breakdown, pulling the lowest densities back down into absolute rich black.
* **UI Element:** `Slider` (shadcn/ui)
* **Bounds:** Min: `0.0`, Max: `1.0`, Default: `0.0`, Step: `0.05`
* **Mathematical Implementation:**
Applies a localized subtraction window offset that scales downward exponentially as luminance increases, ensuring highlights remain entirely untouched while shadows drop cleanly:

$$I_{\text{out}} = \max\left(I_{\text{in}} - \text{DefogFactor} \cdot \exp(-4.0 \cdot I_{\text{in}}), \, 0.0\right)$$



---
