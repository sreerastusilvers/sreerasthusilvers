import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  DEFAULT_IMAGE,
  SITE_NAME,
  STATIC_PAGES,
  absoluteUrl,
  isNoindexPath,
  storeJsonLd,
  websiteJsonLd,
  type JsonLd,
} from "@/lib/seo/core.mjs";

export interface SeoProps {
  title: string;
  description?: string;
  /** Absolute URL. Omit on pages that are noindex. */
  canonical?: string;
  image?: string;
  imageAlt?: string;
  type?: "website" | "product" | "article";
  noindex?: boolean;
  jsonLd?: JsonLd[];
}

function upsertMeta(attr: "name" | "property", key: string, content: string | undefined) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  if (el.content !== content) el.content = content;
}

function upsertCanonical(href: string | undefined) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  if (el.href !== href) el.href = href;
}

function replaceJsonLd(items: JsonLd[]) {
  // Also drops the blocks the build-time prerender wrote (same data-seo marker).
  document.head.querySelectorAll('script[data-seo="ld"]').forEach((n) => n.remove());
  for (const item of items) {
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.dataset.seo = "ld";
    s.textContent = JSON.stringify(item);
    document.head.appendChild(s);
  }
}

/** Writes the page's head tags. Effects only: renders nothing. */
export function applySeo({ title, description, canonical, image, imageAlt, type = "website", noindex, jsonLd = [] }: SeoProps) {
  document.title = title;
  upsertMeta("name", "description", description);
  upsertMeta("name", "robots", noindex ? "noindex, follow" : "index, follow, max-image-preview:large");
  upsertCanonical(noindex ? undefined : canonical);
  const img = image || DEFAULT_IMAGE;
  upsertMeta("property", "og:site_name", SITE_NAME);
  upsertMeta("property", "og:type", type);
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", canonical);
  upsertMeta("property", "og:image", img);
  upsertMeta("property", "og:image:alt", imageAlt || title);
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", img);
  replaceJsonLd(noindex ? [] : jsonLd);
}

export default function Seo(props: SeoProps) {
  const key = JSON.stringify(props);
  useEffect(() => {
    applySeo(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

/** Pages that set their own tags (product, category and listing pages). */
const SELF_MANAGED = (path: string) =>
  path.startsWith("/product/") || path.startsWith("/category/") || path === "/products";

/**
 * Route-level defaults: static pages get their copy, private pages get
 * noindex, unknown paths (404s and legacy redirects) get noindex.
 */
export function RouteSeo() {
  const { pathname } = useLocation();
  useEffect(() => {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    if (SELF_MANAGED(path)) return;
    const page = STATIC_PAGES[path];
    if (page && !isNoindexPath(path)) {
      applySeo({
        title: page.title,
        description: page.description,
        canonical: absoluteUrl(path === "/" ? "/" : path),
        jsonLd: path === "/" ? [storeJsonLd(), websiteJsonLd()] : path === "/contact" ? [storeJsonLd()] : [],
      });
      return;
    }
    applySeo({ title: SITE_NAME, description: STATIC_PAGES["/"].description, noindex: true });
  }, [pathname]);
  return null;
}
