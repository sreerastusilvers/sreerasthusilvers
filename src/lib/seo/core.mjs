// @ts-check
/**
 * SEO building blocks shared by the browser app (src/components/seo/Seo.tsx)
 * and the build-time prerender (scripts/seo/prerender.mjs), so the HTML Google
 * fetches and the page React later renders carry the same title, description,
 * canonical URL and structured data.
 *
 * Plain ESM JavaScript on purpose: Node runs it at build time without a
 * TypeScript step. Types live in core.d.mts.
 *
 * Real business facts only (address, phone, hours, map pin come from the
 * Contact page and the shop's Google Business Profile). Never add ratings,
 * review counts or claims that are not backed by real data.
 */

export const SITE_URL = 'https://www.sreerasthusilvers.com';
export const SITE_NAME = 'Sreerasthu Silvers';
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;
export const LOGO_URL = `${SITE_URL}/logo-new.png`;

export const BUSINESS = {
  name: SITE_NAME,
  alternateName: ['Sreerastu Silvers', 'Sreerasthu Silver'],
  telephone: '+91-6304960489',
  email: 'sreerasthusilvers@gmail.com',
  street: 'Ramasomayajulu Street, Rama Rao Peta',
  city: 'Kakinada',
  region: 'Andhra Pradesh',
  postalCode: '533001',
  country: 'IN',
  latitude: 16.9577817,
  longitude: 82.2346344,
  mapUrl: 'https://www.google.com/maps/place/Sreerastu+silvers/@16.9577817,82.2346344,17z/data=!4m6!3m5!1s0x3a38290006734e2b:0x9f8b6cdf933bc2a!8m2!3d16.9577817!4d82.2346344',
  sameAs: ['https://www.facebook.com/sreerasthusilvers', 'https://www.instagram.com/sreerasthu_silvers/'],
};

/** Collapse whitespace and cut at a word boundary. */
export function clip(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

export function absoluteUrl(path) {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Title with the brand suffix, kept near Google's ~60 character display. */
export function brandTitle(text) {
  const suffix = ` | ${SITE_NAME}`;
  return `${clip(text, Math.max(30, 64 - suffix.length))}${suffix}`;
}

export const formatInr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// ── Site-wide structured data ───────────────────────────────────────────────

export function storeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'JewelryStore',
    '@id': `${SITE_URL}/#store`,
    name: BUSINESS.name,
    alternateName: BUSINESS.alternateName,
    url: SITE_URL,
    logo: LOGO_URL,
    image: DEFAULT_IMAGE,
    telephone: BUSINESS.telephone,
    email: BUSINESS.email,
    priceRange: '₹₹',
    currenciesAccepted: 'INR',
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS.street,
      addressLocality: BUSINESS.city,
      addressRegion: BUSINESS.region,
      postalCode: BUSINESS.postalCode,
      addressCountry: BUSINESS.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: BUSINESS.latitude, longitude: BUSINESS.longitude },
    hasMap: BUSINESS.mapUrl,
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '09:00',
        closes: '20:00',
      },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Sunday', opens: '10:00', closes: '18:00' },
    ],
    sameAs: BUSINESS.sameAs,
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    publisher: { '@id': `${SITE_URL}/#store` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search-results?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

// ── Static pages ────────────────────────────────────────────────────────────

/** @type {Record<string, {title: string, description: string, h1: string}>} */
export const STATIC_PAGES = {
  '/': {
    title: 'Sreerasthu Silvers | Pure Silver Jewellery, Gifts & Pooja Items in Kakinada',
    description:
      'Shop pure silver jewellery, 999 silver gifts, idols and pooja articles from Sreerasthu Silvers, Kakinada. Anklets, chains, rings, bangles and more, delivered across India.',
    h1: 'Sreerasthu Silvers: pure silver jewellery, gifts and pooja items in Kakinada',
  },
  '/products': {
    title: brandTitle('All Silver Jewellery, Gifts & Articles'),
    description:
      'Browse every piece at Sreerasthu Silvers: silver jewellery for women and men, 999 silver idols, gifting articles and pooja items. Shop online or visit our Kakinada store.',
    h1: 'All silver products',
  },
  '/about': {
    title: brandTitle('About Us'),
    description:
      'Sreerasthu Silvers is a silver jewellery and articles store in Rama Rao Peta, Kakinada, Andhra Pradesh. Learn about our shop, our craft and our promise.',
    h1: 'About Sreerasthu Silvers',
  },
  '/contact': {
    title: brandTitle('Contact & Store Location, Kakinada'),
    description:
      'Visit Sreerasthu Silvers at Ramasomayajulu Street, Rama Rao Peta, Kakinada 533001. Call +91 63049 60489. Open Mon–Sat 9 am–8 pm, Sun 10 am–6 pm.',
    h1: 'Contact Sreerasthu Silvers',
  },
  '/customer-support': {
    title: brandTitle('Customer Support'),
    description: 'Help with orders, delivery, returns and payments at Sreerasthu Silvers. Reach our Kakinada team by phone, WhatsApp or email.',
    h1: 'Customer support',
  },
  '/privacy-policy': {
    title: brandTitle('Privacy Policy'),
    description: 'How Sreerasthu Silvers collects, uses and protects your personal information.',
    h1: 'Privacy policy',
  },
  '/terms-conditions': {
    title: brandTitle('Terms & Conditions'),
    description: 'Terms and conditions for shopping on sreerasthusilvers.com.',
    h1: 'Terms and conditions',
  },
  '/shipping-policy': {
    title: brandTitle('Shipping Policy'),
    description: 'Orders are processed in 1–3 working days and delivered in 3–7 business days across India. Read the Sreerasthu Silvers shipping policy.',
    h1: 'Shipping policy',
  },
  '/cancellation-refund-policy': {
    title: brandTitle('Cancellation & Refund Policy'),
    description: 'Return requests within 7 days of delivery; refunds processed within 7 business days. Read the Sreerasthu Silvers cancellation and refund policy.',
    h1: 'Cancellation and refund policy',
  },
};

/** Paths that must never appear in search results. */
export const NOINDEX_PREFIXES = [
  '/admin', '/delivery', '/account', '/checkout', '/cart', '/wishlist', '/profile', '/call', '/my-video-calls',
  '/buy-again', '/purchase-summary', '/wallet', '/security', '/write-review', '/thank-you-review', '/login',
  '/signup', '/verify-email', '/forgot-password', '/reset-password', '/auth', '/__', '/search', '/search-results',
];

export function isNoindexPath(pathname) {
  return NOINDEX_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// ── Categories ──────────────────────────────────────────────────────────────

/** Hand-written copy for the categories that hold products. */
const CATEGORY_COPY = {
  jewellery: {
    title: 'Silver Jewellery for Women & Men Online',
    description:
      'Shop silver jewellery at Sreerasthu Silvers, Kakinada: anklets, chains, rings, bangles, earrings, necklaces, harams and bridal sets for women and men. Delivered across India.',
  },
  gifting: {
    title: '999 Pure Silver Gifts, Idols & Articles',
    description:
      'Pure silver gifts for every occasion: Balaji, Ganesh and Lakshmi idols, tulasi pots, dry fruit boxes, elephants, kumkum boxes and more from Sreerasthu Silvers, Kakinada.',
  },
  mens: {
    title: "Men's Silver Jewellery: Chains, Rings, Bracelets",
    description:
      "Silver chains, rings, bracelets, kadas and pendants for men from Sreerasthu Silvers, Kakinada. Shop online with delivery across India.",
  },
  'pooja-items': {
    title: 'Silver Pooja Items: Lamps, Plates & Idols',
    description: 'Silver pooja items from Sreerasthu Silvers, Kakinada: lamps, plates, idols and puja essentials for your home mandir.',
  },
  wedding: {
    title: 'Silver Wedding Jewellery & Gifts',
    description: 'Silver bridal, groom and couple sets, plus wedding return gifts, from Sreerasthu Silvers, Kakinada.',
  },
  articles: {
    title: 'Silver Articles, Decor & Antiques',
    description: 'Silver articles for gifting, pooja and home decor, including antique pieces, from Sreerasthu Silvers, Kakinada.',
  },
  furniture: {
    title: 'Silver Furniture',
    description: 'Silver-cladded furniture for the home from Sreerasthu Silvers, Kakinada.',
  },
  others: {
    title: 'More Silver Articles',
    description: 'More silver articles and pooja items from Sreerasthu Silvers, Kakinada.',
  },
};

export function categorySeo(slug, name) {
  const copy = CATEGORY_COPY[slug] || {
    title: `Silver ${name}`,
    description: `Shop silver ${String(name).toLowerCase()} online at Sreerasthu Silvers, Kakinada. Delivered across India.`,
  };
  const path = `/category/${slug}`;
  return {
    title: brandTitle(copy.title),
    description: clip(copy.description, 160),
    canonical: absoluteUrl(path),
    h1: copy.title,
    jsonLd: [breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name, path }])],
  };
}

// ── Products ────────────────────────────────────────────────────────────────

/**
 * @param {any} p catalog product (same shape as catalog/products.json and Firestore)
 * @param {{ categoryPath?: string, categoryName?: string, rating?: {average: number, count: number} | null }} [extra]
 */
export function productSeo(p, extra = {}) {
  const path = `/product/${encodeURIComponent(p.id)}`;
  const name = String(p.name || 'Silver product').replace(/\s+/g, ' ').trim();
  const about = String(p.description || '').replace(/\s+/g, ' ').trim();
  const price = typeof p.price === 'number' && p.price > 0 ? p.price : null;
  const purity = p.specifications?.purity ? String(p.specifications.purity).trim() : '';
  const lead = [price ? formatInr(price) : '', purity].filter(Boolean).join(' · ');
  const description = clip(
    [lead, about || `${name}, from Sreerasthu Silvers, Kakinada.`].filter(Boolean).join('. '),
    160,
  );
  const images = [p.media?.thumbnail, ...(p.media?.images || [])].filter(
    (v, i, a) => typeof v === 'string' && /^https?:\/\//.test(v) && a.indexOf(v) === i,
  );
  const stock = Number(p.inventory?.stock);
  const inStock = !Number.isFinite(stock) || stock > 0;

  /** @type {Record<string, any>} */
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${absoluteUrl(path)}#product`,
    name,
    url: absoluteUrl(path),
    image: images.slice(0, 6),
    description: clip(about || name, 5000),
    sku: p.inventory?.sku || p.id,
    brand: { '@type': 'Brand', name: SITE_NAME },
  };
  if (p.specifications?.material) product.material = String(p.specifications.material);
  if (p.category) product.category = [p.category, p.subcategory, p.subSubcategory].filter(Boolean).join(' > ');
  if (price) {
    product.offers = {
      '@type': 'Offer',
      url: absoluteUrl(path),
      priceCurrency: p.currency || 'INR',
      price: price.toFixed(2),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': `${SITE_URL}/#store` },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 7,
        returnMethod: 'https://schema.org/ReturnByMail',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 7, unitCode: 'DAY' },
        },
      },
    };
  }
  // Only real, on-site reviews (passed in by the product page). Never invented.
  if (extra.rating && extra.rating.count > 0 && extra.rating.average > 0) {
    product.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(extra.rating.average.toFixed(1)),
      reviewCount: extra.rating.count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const crumbs = [{ name: 'Home', path: '/' }];
  if (extra.categoryPath && extra.categoryName) crumbs.push({ name: extra.categoryName, path: extra.categoryPath });
  crumbs.push({ name, path });

  return {
    title: brandTitle(name),
    description,
    canonical: absoluteUrl(path),
    image: images[0] || DEFAULT_IMAGE,
    imageAlt: name,
    h1: name,
    about,
    price,
    inStock,
    images,
    jsonLd: [product, breadcrumbJsonLd(crumbs)],
  };
}

/** Category slug a product lives under (same rule as CategoryPage). */
export function productCategory(p, categories) {
  const byName = categories.find((c) => c.name.toLowerCase() === String(p.category || '').toLowerCase());
  return byName ? { path: `/category/${byName.slug}`, name: byName.name } : null;
}
