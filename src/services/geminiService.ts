import { auth } from "@/config/firebase";

export interface ImageInput {
  base64: string;
  mimeType: string;
}

export type HeroOutputFormat = 'desktop-16:9' | 'mobile-4:5' | 'both';
export type LogoMode = 'auto-contrast' | 'black' | 'white' | 'custom';

type GeminiPart =
  | { inlineData: { mimeType: string; data: string } }
  | { text: string };

function buildContents(text: string, images: ImageInput[]) {
  const parts: GeminiPart[] = [];

  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  }

  parts.push({ text });

  return [{ role: "user" as const, parts }];
}

async function generateWithFallback(
  contents: string | ReturnType<typeof buildContents>
): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in again before generating prompts.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch('/api/gemini-generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ contents }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    text?: string;
    error?: string;
    detail?: string;
  };

  if (!response.ok || !payload.text) {
    throw new Error(payload.detail || payload.error || 'Failed to generate prompt with Gemini');
  }

  return payload.text;
}

function hasLogos(logoImages?: ImageInput[]) {
  return !!logoImages && logoImages.length > 0;
}

function logoModeLabel(mode: LogoMode) {
  if (mode === 'black') return 'black logo variant';
  if (mode === 'white') return 'white logo variant';
  if (mode === 'custom') return 'custom uploaded logo';
  return 'black and white logo variants for automatic contrast selection';
}

function logoInstruction(logoImages?: ImageInput[], logoMode: LogoMode = 'auto-contrast') {
  if (!hasLogos(logoImages)) {
    return 'LOGO: Reserve a clean, premium space for the Sreerasthu Silvers brand mark, but do not invent or render a fake logo.';
  }

  return `LOGO RULE - CONTRAST-AWARE AND ABSOLUTE:
Attached logo image file(s) are provided as ${logoModeLabel(logoMode)}. Use the attached logo artwork directly; do NOT redraw it, retype it, convert it into random text, or place it on an opaque block.
- If both black and white logo variants are attached, choose the variant that is most readable against the final background: white logo on dark/rich backgrounds, black logo on light/bright backgrounds.
- Preserve the transparent PNG edges. No black box, white box, rectangle, glow blob, or muddy background behind the logo.
- Size: 12-18% of image width for product images; 10-16% for hero banners. It must be readable but never overpower the jewellery or offer.
- Position: choose the cleanest safe area with strong contrast, usually top-left or top-center for banners and a corner for product images.
- Opacity: 100% unless the background is extremely simple; never make the logo faded or hard to read.
- State exactly in the final prompt: "Place the attached logo image directly; choose black or white version based on background contrast; do not recreate it as text."`;
}

const NANO_BANANA_PRO_HANDOFF = `NANO BANANA PRO WORKFLOW:
This prompt is meant for Nano Banana Pro with attached reference images. The generated image must use those attached references as source assets, not as loose inspiration. The prompt must tell Nano Banana Pro exactly what to preserve, what to enhance, and what final ratio/quality to output.`;

const PRODUCT_FIDELITY_RULE = `PRODUCT FIDELITY - THE NON-NEGOTIABLE CORE:
Use the attached jewellery/product image exactly as provided. Preserve the exact design, shape, proportions, chain/setting, stone positions, engraving, polish, metal color, scale, silhouette, clasp details, defects, and craftsmanship. Do not redesign it, simplify it, add extra stones, remove parts, turn silver into gold, change gemstones, invent a matching set, or replace it with a similar-looking piece. Only improve the scene around it: lighting, camera, model, styling, environment, reflections, shadows, and composition.`;

const REFERENCE_DISCIPLINE_RULE = `REFERENCE DISCIPLINE:
Study every attached reference carefully. Keep the uploaded product/reference subject real and unchanged, like a professional retouching brief: preserve identity, geometry, materials, and proportions while upgrading the scene to a premium photographed result. If a reference is low quality, use it to preserve the product accurately, then rebuild only the lighting, surroundings, and photographic quality around it.`;

const PHOTOREALISM_RULE = `PHOTOREALISM - MUST LOOK LIKE A REAL CAMERA CAPTURE:
- Real skin texture if a model appears: visible pores, tiny facial hair, natural moles/freckles, slight skin tone variation, real lip lines, non-perfect symmetry, natural under-eye and cheek texture.
- Real eyes and hair: believable catchlights from softboxes/windows, individual hair strands, flyaways, imperfect hairline, no CG helmet hair.
- Real material response: silver has cool-toned specular highlights, fabric weave is visible, stones refract light naturally, shadows contact the surface correctly.
- Real camera behavior: Canon EOS R5 or Hasselblad-style editorial capture, accurate lens compression, natural depth of field, subtle film grain, true light falloff, no overdone HDR.
- Real environment: floors, walls, props, flowers, fabric folds, marble, velvet, and reflections must have scale, texture, depth, and natural imperfections.
- Banned AI tells: plastic skin, wax faces, floating jewellery, impossible shadows, deformed fingers, warped text, random extra jewellery, fake sparkle noise, over-smoothed surfaces, perfect symmetry, digital glow.`;

const ATTIRE_AND_STYLING_RULE = `DYNAMIC ATTIRE AND STYLING - DO NOT DEFAULT TO GREEN SAREE:
Choose attire based on the uploaded jewellery style and campaign mood. Options include Kanjivaram silk saree, Banarasi saree, handloom drape, bridal lehenga, modern structured gown, velvet blouse, minimalist editorial black/ivory outfit, or contemporary festive styling. The outfit must complement the jewellery and never compete with it. Avoid repeating green saree by default; use emerald or green only when it is clearly the best cultural/compositional choice. Prefer rich, varied palettes such as deep wine, ivory, champagne, sapphire, antique rose, charcoal, royal blue, temple red, pearl white, or muted gold accents while keeping silver jewellery cool-toned and accurate.`;

const LUXURY_ENVIRONMENT_RULE = `WORLD-CLASS ENVIRONMENT:
Create a real, high-budget luxury photography setting rather than a flat backdrop. Choose one setting that fits the product: editorial studio with sculpted light, palace corridor, temple-inspired architectural detail, marble atelier, velvet/silk styling table, premium boutique interior, garden at golden hour, or cinematic festive set. The environment must have foreground/midground/background depth, natural shadows, physically plausible reflections, and professional art direction.`;

const SILVER_COLOR_RULE = `SILVER JEWELLERY COLOR ANCHOR:
Sreerasthu Silvers sells 92.5% silver jewellery. Silver must remain cool, luminous, and premium. Do not warm it into yellow gold or bronze. Any gold, maroon, green, or festive colors belong to the set, props, text, or attire only - never to the silver product unless the uploaded reference itself contains those tones.`;

function heroFormatInstruction(format: HeroOutputFormat) {
  if (format === 'desktop-16:9') {
    return `OUTPUT FORMAT: Generate one desktop hero banner, 16:9 ratio, 3840x2160 or 4096x2304. Use horizontal composition, generous side safe zones, readable typography, and no cropped product/model face.`;
  }

  if (format === 'mobile-4:5') {
    return `OUTPUT FORMAT: Generate one mobile hero banner, 4:5 ratio, 3200x4000 or 4096x5120. Use vertical composition for phone screens, keep all text inside central safe zones, keep the jewellery and model face fully visible, and leave enough breathing room near top/bottom UI crop areas.`;
  }

  return `OUTPUT FORMAT: Generate TWO separate final banner images from the same premium campaign concept:
1. Desktop version: 16:9 ratio, 3840x2160 or 4096x2304, horizontal composition with readable text and logo safe zones.
2. Mobile version: 4:5 ratio, 3200x4000 or 4096x5120, vertical composition with all text, offer, jewellery, model face, and logo inside safe zones.
Both images must feel like the same campaign, but each must be composed natively for its ratio. Do not simply crop the desktop into mobile.`;
}

function modelInstruction(includeModel: 'auto' | 'yes' | 'no', festivalOrEvent: string) {
  if (includeModel === 'yes') {
    return `MODEL DIRECTION: Include a real-looking Indian model styled for "${festivalOrEvent}". She must look photographed, not generated. Choose pose, expression, attire, makeup, and camera angle based on the jewellery type. The model supports the jewellery; the product remains the hero.`;
  }

  if (includeModel === 'no') {
    return `MODEL DIRECTION: No model. Create a breathtaking product-and-design composition using the exact attached jewellery, premium props, typography, fabric, light, and festival elements.`;
  }

  return `MODEL DECISION: Decide whether model or product-only gives the strongest luxury banner for "${festivalOrEvent}". Do not include a model automatically. Use a model for bridal/emotional/lifestyle scale; choose product-only for collections, offer-led banners, intricate jewellery, or clean premium layouts. Either choice must feel like a real Tanishq/Kalyan/Malabar-level campaign.`;
}

export async function generateProductModelPrompt(
  productImage: ImageInput,
  logoImages: ImageInput[] = [],
  logoMode: LogoMode = 'auto-contrast'
): Promise<string> {
  const systemPrompt = `You are a world-class AI image prompt engineer and luxury jewellery creative director for Sreerasthu Silvers, a premium 92.5% silver jewellery brand.

${NANO_BANANA_PRO_HANDOFF}

ATTACHED IMAGES:
- Jewellery/product reference: attached first. Preserve it exactly.
${hasLogos(logoImages) ? `- Logo reference(s): ${logoImages.length} attached logo image(s). ${logoInstruction(logoImages, logoMode)}` : '- No usable logo image may be attached. Do not invent a fake logo.'}

Create the final prompt for a WORLD-CLASS product + model jewellery photoshoot.

${PRODUCT_FIDELITY_RULE}
${REFERENCE_DISCIPLINE_RULE}
${SILVER_COLOR_RULE}
${ATTIRE_AND_STYLING_RULE}
${LUXURY_ENVIRONMENT_RULE}
${PHOTOREALISM_RULE}

CAMPAIGN REQUIREMENTS:
- Output ratio: 1:1 square, 4096x4096, 4K.
- The image must feel like a real luxury editorial campaign shot by a top photographer, not a generated composite.
- Select the model pose dynamically from the jewellery type: necklace/choker gets collarbone/neck framing; earrings get hair swept aside and side profile; bangles/rings get elegant hand choreography; anklets get graceful foot/hem composition; sets get balanced 3/4 body framing.
- Use a dynamic, editorial pose with real gesture and body language. Avoid passport-photo frontality unless it is creatively justified.
- Use camera/lens choices that match the product: 85mm beauty portrait, 100mm macro detail, 70mm 3/4 editorial, or low-angle glamour. Include physically plausible depth of field and lighting.
- The attached jewellery must be sharp, correctly scaled, and naturally worn or placed with believable contact shadows.
- The final prompt must explicitly say to upload and use the attached product reference in Nano Banana Pro.
${logoInstruction(logoImages, logoMode)}

Generate ONLY the final Nano Banana Pro prompt text. No markdown, no explanation.`;

  const userMessage = `Create one premium 1:1 4K product + model prompt for Nano Banana Pro. The uploaded jewellery must remain exactly unchanged. Build a dynamic world-class campaign around it with realistic model, premium attire, luxury environment, exact silver fidelity, and no repetitive green-saree default.`;

  return generateWithFallback(
    buildContents(`${systemPrompt}\n\n${userMessage}`, [productImage, ...logoImages])
  );
}

export async function generateProductStudioPrompt(
  productImage: ImageInput,
  logoImages: ImageInput[] = [],
  logoMode: LogoMode = 'auto-contrast'
): Promise<string> {
  const systemPrompt = `You are a world-class prompt engineer for luxury jewellery studio photography: Cartier/Tiffany-level macro product imagery adapted for Sreerasthu Silvers.

${NANO_BANANA_PRO_HANDOFF}

ATTACHED IMAGES:
- Jewellery/product reference: attached first. Preserve it exactly.
${hasLogos(logoImages) ? `- Logo reference(s): ${logoImages.length} attached logo image(s). ${logoInstruction(logoImages, logoMode)}` : '- No usable logo image may be attached. Do not invent a fake logo.'}

Create the final prompt for a PRODUCT-ONLY world-class studio photoshoot.

${PRODUCT_FIDELITY_RULE}
${REFERENCE_DISCIPLINE_RULE}
${SILVER_COLOR_RULE}
${PHOTOREALISM_RULE}

STUDIO REQUIREMENTS:
- No model, no hands, no human body, no mannequin unless explicitly needed for scale. Product-only.
- Output ratio: 1:1 square, 4096x4096, 4K.
- Use a premium still-life setup chosen to flatter the uploaded jewellery: black velvet, ivory silk, white/grey marble, smoked acrylic riser, museum plinth, jewellery box, satin folds, brushed stone, or subtle flower petals.
- Use Canon EOS R5 / Hasselblad-style macro product photography, 100mm macro lens, ISO 100, focus stacking, calibrated white balance, softbox key light, rim light, flags, reflectors, and controlled specular highlights.
- Preserve every product detail: metal grain, stone facets, engravings, clasps, chain links, bends, surface wear, and exact proportions.
- Do not add matching pieces, extra gemstones, fake chains, fake sparkle overlays, or text unless logo placement is requested.
- Make the image look like a real high-end e-commerce/still-life photograph with natural shadows and contact reflections.
${logoInstruction(logoImages, logoMode)}

Generate ONLY the final Nano Banana Pro prompt text. No markdown, no explanation.`;

  const userMessage = `Create one premium 1:1 4K studio product prompt for Nano Banana Pro. Use the uploaded jewellery exactly as-is, no model, no redesigned product, and produce a world-class macro luxury still-life shot.`;

  return generateWithFallback(
    buildContents(`${systemPrompt}\n\n${userMessage}`, [productImage, ...logoImages])
  );
}

export async function generateHeroSectionPrompt(
  festivalOrEvent: string,
  offerTitle: string,
  offerInfo: string,
  bannerHeadline: string,
  includeModel: 'auto' | 'yes' | 'no',
  outputFormat: HeroOutputFormat = 'both',
  referenceImages?: ImageInput[],
  logoImages: ImageInput[] = [],
  logoMode: LogoMode = 'auto-contrast'
): Promise<string> {
  const hasRef = !!referenceImages && referenceImages.length > 0;
  const refCount = referenceImages?.length || 0;

  const systemPrompt = `You are the creative director at India's #1 luxury jewellery advertising agency. You create homepage campaigns for premium jewellery brands and now you are creating a Sreerasthu Silvers hero banner for Nano Banana Pro.

${NANO_BANANA_PRO_HANDOFF}

CREATIVE BRIEF:
- Festival/Event/Offer Type: "${festivalOrEvent}"
- Banner Headline: ${bannerHeadline ? `Use exactly "${bannerHeadline}"` : `Create a refined 3-7 word headline that includes or clearly references "${festivalOrEvent}"`}
- Offer Title: "${offerTitle}"
${offerInfo ? `- Offer Details: "${offerInfo}"` : '- Offer Details: none provided; keep the offer design clean and not cluttered.'}
- Model Preference: ${includeModel}
- Output Selection: ${outputFormat}

ATTACHED IMAGES:
${hasRef ? `- ${refCount} product/reference image(s) are attached. Use the exact jewellery/product assets from these images unchanged. If multiple products are attached, include them cohesively without redesigning any piece.` : '- No product image may be attached; create premium 92.5 silver jewellery suitable for the campaign, but do not invent a fake brand logo.'}
${hasLogos(logoImages) ? `- ${logoImages.length} logo image(s) are attached. ${logoInstruction(logoImages, logoMode)}` : '- No usable logo image may be attached. Reserve a clean brand area but do not invent a fake logo.'}

${hasRef ? PRODUCT_FIDELITY_RULE : SILVER_COLOR_RULE}
${REFERENCE_DISCIPLINE_RULE}
${SILVER_COLOR_RULE}
${ATTIRE_AND_STYLING_RULE}
${PHOTOREALISM_RULE}

${heroFormatInstruction(outputFormat)}

CAMPAIGN ART DIRECTION:
- Make this a complete publish-ready homepage banner, not a plain product photo with empty space.
- Use the festival/event as the real visual language: culturally accurate colors, props, flowers, fabric, motifs, and emotional mood.
- Avoid one-note color defaults. Do not let green dominate every campaign; use green only when culturally/compositionally needed and balance it with silver, ivory, wine, amber, maroon, blue, or neutral luxury tones.
- Silver jewellery must remain cool-toned, premium, and bright. Do not turn silver into gold.
- Text must be rendered inside the image with luxury typography: headline, offer title, optional offer details, and a premium CTA such as "SHOP NOW" or "EXPLORE NOW".
- The offer badge must look premium, not like a cheap sticker. Use refined spacing, strong contrast, and clean hierarchy.
- Keep all text readable and inside safe zones for the selected ratio. No cropped words, warped letters, or unreadable decorative text.
- Include logo using the contrast-aware rule above.

${modelInstruction(includeModel, festivalOrEvent)}
${LUXURY_ENVIRONMENT_RULE}

FINAL PROMPT MUST INCLUDE:
1. A clear instruction to attach and use the product/reference images exactly as provided.
2. A clear instruction to generate the selected ratio(s): ${outputFormat}.
3. The exact headline/offer requirements.
4. Product fidelity and silver color fidelity.
5. Realism rules for model, product, materials, and environment.
6. Contrast-aware black/white logo placement when logo references are attached.

Generate ONLY the final Nano Banana Pro prompt text. No markdown, no explanation.`;

  const userMessage = `Create the ultimate Sreerasthu Silvers hero banner prompt for Nano Banana Pro. Theme: ${festivalOrEvent}. Headline: ${bannerHeadline || 'AI creates one'}. Offer: ${offerTitle}${offerInfo ? ` - ${offerInfo}` : ''}. Output: ${outputFormat}. Use all attached product/reference images exactly as-is and create a world-class luxury advertisement with realistic photography, premium typography, safe zones, and contrast-aware logo handling.`;

  const images: ImageInput[] = [];
  if (referenceImages) images.push(...referenceImages);
  images.push(...logoImages);

  return generateWithFallback(
    images.length > 0
      ? buildContents(`${systemPrompt}\n\n${userMessage}`, images)
      : `${systemPrompt}\n\n${userMessage}`
  );
}

export async function generateCustomImagePrompt(
  customRequirement: string,
  imageType: string,
  referenceImage?: ImageInput,
  logoImages: ImageInput[] = [],
  logoMode: LogoMode = 'auto-contrast'
): Promise<string> {
  const systemPrompt = `You are an expert AI image prompt engineer for Sreerasthu Silvers, a premium 92.5% silver jewellery brand.

${NANO_BANANA_PRO_HANDOFF}

CUSTOM REQUEST:
- Image type: ${imageType}
- User requirement: "${customRequirement}"

ATTACHED IMAGES:
${referenceImage ? '- A product/reference image is attached. Use it exactly as provided and preserve the subject/product without redesigning it.' : '- No product/reference image is attached.'}
${hasLogos(logoImages) ? `- Logo reference(s): ${logoImages.length} attached image(s). ${logoInstruction(logoImages, logoMode)}` : '- No usable logo image may be attached. Do not invent a fake logo.'}

${referenceImage ? PRODUCT_FIDELITY_RULE : SILVER_COLOR_RULE}
${REFERENCE_DISCIPLINE_RULE}
${PHOTOREALISM_RULE}
${LUXURY_ENVIRONMENT_RULE}
${logoInstruction(logoImages, logoMode)}

Rules:
- The user's custom requirement is the creative direction, but product/reference fidelity and photorealism are mandatory.
- Use real camera, real materials, real lighting, believable scale, and premium jewellery art direction.
- If this is a banner/hero/social post, include safe text areas, readable typography, and premium layout.
- If this is product photography, keep jewellery/product as the hero and avoid distracting props.

Generate ONLY the final Nano Banana Pro prompt text. No markdown, no explanation.`;

  const images: ImageInput[] = [];
  if (referenceImage) images.push(referenceImage);
  images.push(...logoImages);

  return generateWithFallback(
    images.length > 0
      ? buildContents(systemPrompt, images)
      : systemPrompt
  );
}

export async function generateVariationPrompt(
  originalPrompt: string,
  productImage: ImageInput,
  logoImages: ImageInput[] = [],
  logoMode: LogoMode = 'auto-contrast'
): Promise<string> {
  const systemPrompt = `You are a world-class AI image prompt engineer for Nano Banana Pro. Create a new standalone variation of the existing product + model jewellery photoshoot prompt.

ORIGINAL PROMPT:
"""
${originalPrompt}
"""

VARIATION REQUIREMENTS:
- Keep the exact uploaded jewellery unchanged.
- Keep the same luxury campaign quality and product fidelity.
- Change the camera angle, crop, model pose, expression, hand placement, and composition enough to feel like a different shot from the same world-class session.
- Do not default to green saree. Choose attire and palette dynamically based on the jewellery and original mood.
- Preserve the same general brand mood unless the original prompt was weak; improve realism and premium art direction where needed.
${PRODUCT_FIDELITY_RULE}
${PHOTOREALISM_RULE}
${logoInstruction(logoImages, logoMode)}

Generate ONLY the complete replacement Nano Banana Pro prompt. No markdown, no explanation.`;

  const userMessage = `Create a different angle/pose variation for the uploaded jewellery. Product must remain exactly unchanged. Output should still be 1:1 4K world-class realistic jewellery campaign photography.`;

  return generateWithFallback(
    buildContents(`${systemPrompt}\n\n${userMessage}`, [productImage, ...logoImages])
  );
}

export async function refinePrompt(
  currentPrompt: string,
  refinementInstruction: string
): Promise<string> {
  const systemPrompt = `You are a world-class AI image prompt engineer. A Nano Banana Pro prompt has already been generated, and the user wants to modify it.

CURRENT PROMPT:
"""
${currentPrompt}
"""

USER'S REFINEMENT REQUEST:
"${refinementInstruction}"

Apply the requested change while preserving all product/reference fidelity, Nano Banana Pro attachment instructions, ratio instructions, realism rules, silver color accuracy, and logo contrast rules. Output the complete updated prompt, not a patch note.

Generate ONLY the refined prompt text. No explanations, no markdown.`;

  return generateWithFallback(systemPrompt);
}