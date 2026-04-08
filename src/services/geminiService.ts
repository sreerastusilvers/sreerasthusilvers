import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = "AIzaSyDoYRqC55jj-iWuyal6iUKTOwohe5KjFXo";

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Models in priority order — if one fails, try the next
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

export interface ImageInput {
  base64: string;
  mimeType: string;
}

// Helper: build multimodal contents array
function buildContents(text: string, images: ImageInput[]) {
  const parts: any[] = [];

  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  }

  parts.push({ text });

  return [{ role: "user" as const, parts }];
}

// Helper: try each model in order until one succeeds
async function generateWithFallback(
  contents: string | ReturnType<typeof buildContents>
): Promise<string> {
  let lastError: any;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({ model, contents });
      const text = response.text;
      if (text) {
        console.log(`[Gemini] Success with model: ${model}`);
        return text;
      }
    } catch (err: any) {
      console.warn(`[Gemini] Model "${model}" failed:`, err?.message?.slice(0, 120));
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini models failed. Please try again later.");
}

const LOGO_WATERMARK_INSTRUCTION = `LOGO RULE — SIMPLE AND ABSOLUTE:
A brand logo IMAGE FILE is attached. Place it EXACTLY as-is in the final image. Do NOT recreate, redraw, retype, or redesign it in any way. Simply overlay the attached logo image file directly.

- Place the attached logo image as-is — do NOT write any text as a substitute
- Size: 15-20% of image width (must be clearly visible and readable)
- Opacity: 80-100% (it should be clearly seen, NOT faded or ghostly)
- Position: top-left or top-center (prominent brand placement)
- The logo is an IMAGE FILE — just place it, don't describe it, don't recreate it`;

const PRODUCT_IMAGE_RULE = `JEWELRY IMAGE RULE — SIMPLE AND ABSOLUTE:
A jewelry product image is attached. Use it EXACTLY as-is in the final image. Do NOT alter, redesign, change, or reimagine the jewelry in any way. Whatever jewelry is in the attached image (necklace, ring, earrings, bangles — whatever it is), place that EXACT piece in the generated image unchanged. Only change the background, lighting, environment, and model around it — the jewelry itself must be identical to the attached image.`;

// ─── Product + Model Prompt ──────────────────────────────────────────────

export async function generateProductModelPrompt(
  productImage: ImageInput,
  logoImage?: ImageInput
): Promise<string> {
  const hasLogo = !!logoImage;

  const systemPrompt = `You are a world-class AI image prompt engineer specializing in luxury jewelry advertising photography — think Tanishq, Tiffany & Co, Cartier level campaigns.

IMPORTANT — ATTACHED IMAGES:
- A jewelry product image is attached. Use this EXACT jewelry as-is in the generated image — do NOT alter, redesign, or create different jewelry. Whatever is in the attached image (necklace, ring, earrings, bangles — whatever it is), that EXACT piece must appear unchanged.
${hasLogo ? '- A brand logo image is attached. Place it EXACTLY as-is — do NOT recreate or redraw it. Just overlay the attached logo file directly. Size: 15-20% of image width, Opacity: 80-100%, Position: top-left or top-center.' : ''}

YOUR GOAL: Create a production-ready prompt for a WORLD-CLASS product photoshoot image — luxury brand website and Vogue magazine level.

MANDATORY REQUIREMENTS:
1. CELEBRITY-LEVEL MODEL: Stunningly beautiful Indian model (Deepika Padukone / Aishwarya Rai caliber). Real skin texture, real pores, natural glow. NOT plastic or AI-looking.
2. PROFESSIONAL STYLING: Makeup, hair, outfit — all designed to COMPLEMENT the attached jewelry piece.
3. THE ATTACHED JEWELRY IS THE HERO: Use the attached jewelry image EXACTLY as-is. Do NOT describe it — just say "use the attached jewelry image unchanged". The model enhances the jewelry.
4. CAMERA: Canon EOS R5, 85mm f/1.4L, ISO 100, f/2.8. Three-point studio lighting. ULTRA REALISTIC camera capture — must look like a real photograph, not AI-generated.
5. BACKGROUND: Premium luxury setting — marble, silk, gold-leaf architecture, or elegant bokeh.
6. ASPECT RATIO: 1:1 (4096x4096), 4K quality.
7. QUALITY: Ultra realistic DSLR photo quality COMBINED with professional graphic design — clean composition, balanced layout, luxury color grading.
8. LOGO: ${hasLogo ? 'State: "Place the attached logo image as-is — do not recreate it. 80-100% opacity, 15-20% width, top-left."' : 'Reserve space for brand watermark.'}

CRITICAL: In the prompt, do NOT try to describe what the jewelry looks like. Simply state "use the attached jewelry image exactly as provided — do not alter it". Same for the logo — "place the attached logo image as-is".

Generate ONLY the prompt text. No explanations, no notes, no markdown.`;

  const userMessage = `Create a stunning product photoshoot prompt featuring a celebrity-level Indian model wearing the EXACT attached jewelry — do NOT change or redesign it, use it as-is. ${hasLogo ? 'Place the attached logo image as-is (do NOT recreate it). Make it clearly visible — 80-100% opacity, 15-20% of image width, top-left position.' : ''} World-class quality for our premium e-commerce website.`;

  const images: ImageInput[] = [productImage];
  if (logoImage) images.push(logoImage);

  return generateWithFallback(
    buildContents(`${systemPrompt}\n\n${userMessage}`, images)
  );
}

// ─── Studio Product Prompt ───────────────────────────────────────────────

export async function generateProductStudioPrompt(
  productImage: ImageInput,
  logoImage?: ImageInput
): Promise<string> {
  const hasLogo = !!logoImage;

  const systemPrompt = `You are a world-class AI image prompt engineer specializing in luxury jewelry studio product photography — Tiffany, Cartier, premium Indian jewelry brand level.

IMPORTANT — ATTACHED IMAGES:
- A jewelry product image is attached. Use this EXACT jewelry as-is — do NOT alter, redesign, or create different jewelry. Whatever is in the attached image, that EXACT piece must appear unchanged.
${hasLogo ? '- A brand logo image is attached. Place it EXACTLY as-is — do NOT recreate or redraw it. Just overlay the attached logo file. Size: 15-20% of image width, Opacity: 80-100%, Position: top-left or top-center.' : ''}

YOUR GOAL: Generate a prompt for the most stunning STUDIO PRODUCT SHOT — product only, no model.

MANDATORY REQUIREMENTS:
1. PRODUCT-ONLY SHOT: Just the attached jewelry piece — no human model.
2. DO NOT DESCRIBE THE JEWELRY: Simply state "use the attached jewelry image exactly as provided". Do NOT try to describe what it looks like — that causes the AI to create a different version.
3. PREMIUM SURFACE: Place it on black velvet, white marble, rose gold silk, or a complementary surface.
4. CAMERA: Canon EOS R5, Canon RF 100mm f/2.8L Macro, ISO 100, focus stacking. Softbox key + rim light for metal highlights.
5. RAZOR-SHARP DETAIL: Metal grain, stone facets, engravings — macro-level detail.
6. LIGHTING: Professional studio lighting, natural metal brilliance, controlled specular highlights.
7. ASPECT RATIO: 1:1 (4096x4096), 4K.
8. QUALITY: Ultra realistic camera capture — must look like a real photograph. Combined with professional graphic design quality — clean layout, luxury color grading.
9. PREMIUM PROPS (optional): Subtle complementary props — flower petal, bokeh sparkles — never distracting.
10. LOGO: ${hasLogo ? 'State: "Place the attached logo image as-is — 80-100% opacity, 15-20% width, top-left."' : 'Reserve space for watermark.'}

CRITICAL: Do NOT describe the jewelry or logo in the prompt. Just say "use the attached image as-is". Describing them causes the AI to generate its own version.

Generate ONLY the prompt text. No explanations.`;

  const userMessage = `Create a premium studio product photography prompt using the EXACT attached jewelry image as-is — do NOT change or redesign it. ${hasLogo ? 'Place the attached logo image as-is (do NOT recreate it). Make it clearly visible — 80-100% opacity, 15-20% width, top-left.' : ''} Luxury e-commerce website quality.`;

  const images: ImageInput[] = [productImage];
  if (logoImage) images.push(logoImage);

  return generateWithFallback(
    buildContents(`${systemPrompt}\n\n${userMessage}`, images)
  );
}

// ─── Hero Banner Prompt ──────────────────────────────────────────────────

export async function generateHeroSectionPrompt(
  festivalOrEvent: string,
  offerTitle: string,
  offerInfo: string,
  bannerHeadline: string,
  includeModel: 'auto' | 'yes' | 'no',
  referenceImage?: ImageInput,
  logoImage?: ImageInput
): Promise<string> {
  const hasRef = !!referenceImage;
  const hasLogo = !!logoImage;

  const modelInstruction = includeModel === 'yes'
    ? `INCLUDE A MODEL: Yes — feature a stunningly beautiful, celebrity-level Indian woman (Deepika/Aishwarya caliber). She should be styled head-to-toe for the "${festivalOrEvent}" theme — her outfit (saree/lehenga/contemporary matching the occasion), makeup, hair, jewelry she wears, and expression must all be cohesive with the festival. She ENHANCES the banner — she doesn't overpower the jewelry or offer.`
    : includeModel === 'no'
      ? `NO MODEL: Product-and-design focused. Use only jewelry pieces, props, textures, and design elements — no human model.`
      : `MODEL DECISION: For "${festivalOrEvent}", you SHOULD include a beautiful Indian model unless it's a pure flash-sale or clearance. Festivals, weddings, cultural events, and seasonal themes almost ALWAYS look better with a model. Only skip the model if it's a generic sale (Flash Sale, Clearance, etc.). When in doubt, INCLUDE the model — it creates more impactful, emotional banners.`;

  const systemPrompt = `You are the creative director at India's #1 luxury jewelry advertising agency. Your team has created campaigns for Tanishq, Kalyan Jewellers, Malabar Gold — now you're designing a hero banner for "Sreerasthu Silvers", a premium 92.5% pure silver jewelry brand.

${hasRef ? `REFERENCE IMAGE ATTACHED: A jewelry/banner reference image is attached. Use the EXACT jewelry shown in the attached image — do NOT change it, do NOT create different jewelry, do NOT substitute it with other designs. Whatever jewelry piece is in the attached image, that EXACT piece must appear in the banner. Only build the banner design, background, text, and layout AROUND the attached jewelry — the jewelry itself stays unchanged.` : ''}

${hasLogo ? `BRAND LOGO ATTACHED: A logo image file is attached. Simply place it as-is in the banner. ${LOGO_WATERMARK_INSTRUCTION}` : ''}

═══ THE CREATIVE BRIEF ═══

Festival/Event: "${festivalOrEvent}"
Offer: "${offerTitle}"
${offerInfo ? `Details: "${offerInfo}"` : ''}
Headline: ${bannerHeadline ? `"${bannerHeadline}" (use this EXACT text — it MUST include "${festivalOrEvent}" or reference to it)` : `Create the perfect headline that MUST include the festival/event name "${festivalOrEvent}" — emotionally powerful, elegant, culturally resonant. 3-7 words max. Example: "Akshaya Tritiya: Prosperity Unfolds" or "Diwali Sparkle Collection". The festival name MUST be visible in the headline text.`}

═══ FESTIVAL-SPECIFIC DESIGN DIRECTION ═══

The festival "${festivalOrEvent}" MUST deeply influence EVERY design choice. This is NOT just a label — it defines the entire visual language:

Research and incorporate the REAL cultural elements of this festival:
- What are its traditional colors? (e.g., Akshaya Tritiya = gold + auspicious yellow/red + mango green; Diwali = deep red + gold + warm amber; Navratri = vibrant multi-colors; Christmas = red + green + silver + snow white; Pongal = rice white + turmeric yellow + sugarcane green)
- What are its iconic visual symbols? (e.g., Akshaya Tritiya = gold coins, kalash, mango leaves, turmeric, prosperity symbols; Diwali = diyas, rangoli, sparklers, marigolds; Wedding = mandap, flowers, sindoor, mangalsutra; Onam = pookalam, banana leaf)  
- What is the emotional mood? (e.g., Akshaya Tritiya = prosperity, auspiciousness, new beginnings; Diwali = joy, light, celebration; Wedding = romance, commitment, tradition)
- What traditional fabrics/textures fit? (e.g., Akshaya Tritiya = rich Kanjivaram silk in gold/red; Diwali = velvet in deep maroon; Wedding = bridal pink/red silk)

WEAVE these elements into the banner naturally — they should feel like an integral part of the design, not pasted on top. Like how Tanishq's Akshaya Tritiya banners show gold alongside mango leaves, traditional motifs, and a warm prosperity-filled atmosphere.

═══ TYPOGRAPHY & TEXT (MUST BE RENDERED IN THE IMAGE) ═══

The banner text is NOT overlaid later — it is PART of the generated image:

1. HEADLINE: ${bannerHeadline ? `"${bannerHeadline}"` : `A culturally resonant, emotionally powerful tagline for "${festivalOrEvent}"`}
   - Choose typography that MATCHES the festival mood:
     • Traditional festival (Akshaya Tritiya, Diwali, Navratri) → Elegant serif or decorative Devanagari-inspired English serif
     • Romantic/celebration (Valentine's, Wedding) → Flowing script/calligraphy
     • Modern sale (Flash Sale, Clearance) → Bold clean sans-serif
     • Nature/seasonal → Organic script with delicate serifs
   - Size it LARGE — it should be one of the first things the eye sees
   - Color must contrast beautifully with the background

2. OFFER BADGE: "${offerTitle}" designed as a PREMIUM visual element:
   - The number (e.g., "30%") should be LARGE and bold, "OFF" smaller
   - Frame it in an elegant badge/shape — gold border, decorative frame, or subtle background panel
   - It must feel luxury, NEVER cheap or cluttered
   ${offerInfo ? `- "${offerInfo}" in smaller elegant text below the badge` : ''}

3. CTA BUTTON: "SHOP NOW" or "EXPLORE NOW" — a clean, premium rectangular button that matches the color palette

4. LAYOUT: Position text wherever creates the BEST composition — could be right side (like Tanishq often does), left side, center, or split. The text area needs enough contrast for readability — use soft gradient overlays, darker regions, or naturally lighter areas.

═══ JEWELRY (THE HERO) ═══

${hasRef ? `The attached jewelry reference image IS the hero. Use that EXACT jewelry piece as-is — do NOT describe new jewelry, do NOT create different pieces, do NOT change the design. Simply place the attached jewelry prominently in the banner. The jewelry can be: worn by a model, artistically arranged on fabric/props, or displayed as the centerpiece — but it must be the SAME jewelry from the attached image, unchanged.` : `Silver jewelry (92.5 pure silver) MUST be the hero of this banner:
- Feature beautiful silver jewelry suitable for "${festivalOrEvent}"
- The jewelry can be: worn by a model, artistically arranged as props (on silk/velvet/marble), or displayed as the centerpiece
- The silver metal should GLOW with beautiful lighting — catch the shimmer and brilliance`}
- Light the jewelry beautifully — catch every shimmer and metallic gleam

═══ COMPOSITION & DESIGN ═══

${modelInstruction}

BACKGROUND: Rich, textured, festival-appropriate:
- Flowing fabric (silk, velvet, satin) in colors that match "${festivalOrEvent}"
- Cultural props and elements specific to the festival  
- Natural elements (flowers, petals, leaves) if seasonally appropriate
- Premium textures (marble, gold leaf, wood) for luxury feel
- Depth and dimension — foreground elements, midground jewelry, soft background

COLOR PALETTE: Derive ENTIRELY from "${festivalOrEvent}" cultural context. Every color must feel intentional. The palette should instantly communicate the festival feeling before reading any text.

LIGHTING: Warm, cinematic, atmospheric. Volumetric light rays where appropriate. Subtle sparkle on the jewelry. Professional 3-point lighting if a model is included. The light should enhance the festive mood.

═══ TECHNICAL SPECS ═══

- Ultra-wide: 1920×600 (3.2:1) or 3840×1080 (16:9) hero banner
- 4K quality, ULTRA REALISTIC camera-captured look — real DSLR photograph aesthetic
- Professional graphic design quality — clean typography, balanced layout, luxury color grading
- Must look like a REAL luxury brand advertisement shot by a professional photographer and designed by a top graphic designer — NOT AI-generated looking
- Combine photorealistic elements (real textures, real lighting, real skin) with premium graphic design (typography, badges, layout, color harmony)
${hasRef ? '- Match the quality level and design sophistication of the attached reference' : ''}

═══ LOGO PLACEMENT ═══

${hasLogo ? `The attached logo image must appear clearly in the banner:
- Simply place the attached logo image file directly — do NOT recreate or redraw it
- Position: top-left or top-center (prominent, like Tanishq places their logo)
- Size: 15-20% of banner width — it must be CLEARLY VISIBLE and readable
- Opacity: 80-100% — the logo should be bold and clear, NOT faded
- State: "Place the attached logo image exactly as-is — do not recreate it as text"` : 'Reserve a space for the brand logo watermark.'}

═══ CRITICAL RULES ═══

1. This is a COMPLETE, PUBLISH-READY banner — not a photo with empty space
2. Text, imagery, offers, and branding are all ONE inseparable design
3. The festival theme must be DEEPLY felt, not just surface decoration
4. The festival/event name "${festivalOrEvent}" MUST appear as visible text somewhere in the banner (headline or as a design element)
5. ${hasLogo ? 'LOGO: Just place the attached logo image as-is — do NOT write brand name in a font' : ''}
6. ${hasRef ? 'JEWELRY: Use the EXACT attached jewelry image as-is — do NOT create different jewelry' : 'Jewelry is always the HERO'}
7. Do NOT describe or recreate attached images — simply USE them unchanged
8. Ultra realistic camera-captured photo quality + professional graphic design layout

Generate ONLY the prompt text. No explanations, no markdown, no notes. Ready to paste.`;

  const userMessage = `Create the ultimate hero banner for Sreerasthu Silvers:

Theme: ${festivalOrEvent}
Headline: ${bannerHeadline || '(Create a stunning one)'}
Offer: "${offerTitle}" ${offerInfo ? `— ${offerInfo}` : ''}
Model: ${includeModel === 'auto' ? 'Your creative call' : includeModel === 'yes' ? 'Yes, include a model' : 'No model'}

This goes LIVE on our homepage. It must be Tanishq-campaign quality — complete with beautiful typography rendered in the image, silver jewelry as the hero, festival-accurate cultural elements for "${festivalOrEvent}", a premium offer badge, and a CTA button. One cohesive luxury composition.

${hasRef ? 'REMINDER: The attached jewelry image must appear EXACTLY as-is — do NOT change it or create different jewelry.' : ''}
${hasLogo ? 'REMINDER: The attached logo must appear EXACTLY as-is — just place the image file, do NOT redraw or recreate it. Make it clearly visible (80-100% opacity, 15-20% width).' : ''}`;

  const images: ImageInput[] = [];
  if (referenceImage) images.push(referenceImage);
  if (logoImage) images.push(logoImage);

  return generateWithFallback(
    images.length > 0
      ? buildContents(`${systemPrompt}\n\n${userMessage}`, images)
      : `${systemPrompt}\n\n${userMessage}`
  );
}

// ─── Custom Prompt Generation ────────────────────────────────────────────

export async function generateCustomImagePrompt(
  customRequirement: string,
  imageType: string,
  referenceImage?: ImageInput,
  logoImage?: ImageInput
): Promise<string> {
  const hasRef = !!referenceImage;
  const hasLogo = !!logoImage;

  const systemPrompt = `You are an expert AI image prompt engineer for "Sreerasthu Silvers", a premium silver jewelry brand.

ATTACHED IMAGES:
${hasRef ? '- A reference image is attached. Use it EXACTLY as-is — do NOT alter, redesign, or reimagine it. Simply say "use the attached reference image unchanged" in the prompt. Do NOT describe what it looks like.' : ''}
${hasLogo ? '- A brand logo image is attached. Place it as-is — do NOT recreate or redraw. Size: 15-20% width, Opacity: 80-100%, Position: top-left.' : ''}

Rules:
- Real DSLR photograph look, 4K, photorealistic, professional lighting
- Premium luxury aesthetic
- Camera settings, lighting details, composition
- Image type: ${imageType}
- CRITICAL: Do NOT describe attached images in the prompt. Simply state "use the attached image as-is". Describing them causes AI to generate different versions.

Generate ONLY the prompt text. No explanations.`;

  const images: ImageInput[] = [];
  if (referenceImage) images.push(referenceImage);
  if (logoImage) images.push(logoImage);

  return generateWithFallback(
    images.length > 0
      ? buildContents(`${systemPrompt}\n\nCustom Requirement: ${customRequirement}`, images)
      : `${systemPrompt}\n\nCustom Requirement: ${customRequirement}`
  );
}

// ─── Product + Model Variation Prompt ────────────────────────────────────

export async function generateVariationPrompt(
  originalPrompt: string,
  productImage: ImageInput,
  logoImage?: ImageInput
): Promise<string> {
  const hasLogo = !!logoImage;

  const systemPrompt = `You are a world-class AI image prompt engineer. You have already created one product photoshoot prompt (shown below). Now create a VARIATION of that same photoshoot with DIFFERENT:

- Camera angle (close-up, wide shot, 3/4 angle, overhead, low angle, profile, back-angle showing jewelry from behind, etc.)
- Model pose (different arm position, head tilt, different expression, looking away, looking down at jewelry, candid moment, etc.)
- Composition (different framing, different crop, jewelry positioned differently in frame)

BUT KEEP THE SAME:
- Background/environment (same setting, same overall mood)
- Model (same person, same makeup, same outfit)
- Jewelry (use the attached jewelry image EXACTLY as-is — unchanged)
- Lighting mood (same overall lighting feel)
- Quality level (same camera, same 4K, same DSLR look)
${hasLogo ? '- Logo placement (place the attached logo image as-is, 80-100% opacity, 15-20% width, top-left)' : ''}

ORIGINAL PROMPT:
"""
${originalPrompt}
"""

Generate a COMPLETE new prompt (not a modification instruction). It should be a standalone prompt ready to paste. Choose a DRAMATICALLY different angle/pose than the original — make it feel like a different shot from the same photoshoot session.

CRITICAL: Do NOT describe what the jewelry looks like. Just say "use the attached jewelry image exactly as-is". Same for logo — "place the attached logo image as-is".

Generate ONLY the prompt text. No explanations.`;

  const userMessage = `Create a variation of the above photoshoot with a completely different camera angle and model pose, but same background environment. Use the attached jewelry image EXACTLY as-is. This should feel like a different shot from the same session.`;

  const images: ImageInput[] = [productImage];
  if (logoImage) images.push(logoImage);

  return generateWithFallback(
    buildContents(`${systemPrompt}\n\n${userMessage}`, images)
  );
}

// ─── Refine / Modify Prompt ──────────────────────────────────────────────

export async function refinePrompt(
  currentPrompt: string,
  refinementInstruction: string
): Promise<string> {
  const systemPrompt = `You are a world-class AI image prompt engineer. A prompt has already been generated, and the user wants to MODIFY it based on their feedback.

CURRENT PROMPT:
"""
${currentPrompt}
"""

USER'S REFINEMENT REQUEST:
"${refinementInstruction}"

Apply the user's requested changes to the prompt. Keep everything else the same — only change what the user asked for. Output the COMPLETE updated prompt (not just the changes).

IMPORTANT RULES:
- Keep all "use the attached image as-is" instructions unchanged
- Keep all "do not alter/redesign" instructions unchanged  
- Keep the same quality level, camera settings, and technical specs
- Only modify what the user specifically asked for

Generate ONLY the refined prompt text. No explanations, no "Here's the updated prompt:", no markdown.`;

  return generateWithFallback(systemPrompt);
}
