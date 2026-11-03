import { withBase } from "vitepress";
import { ref } from "vue";

// Webapp location hash (map:x:y:z:distance:rotation:angle:tilt:ortho:mode) shown by <DemoMap>; the gallery components
// set it. Empty: the webapp's start location (the end-game plaza overview).
export const demoHash = ref("");

export interface GalleryImage {
  file: string;
  title: string;
  caption: string;
  hash: string;
  map: string;
  texture?: "modernity" | "default";
  group?: "endgame" | "gallery"; // absent in galleries of older builds: "gallery"
  width: number;
  height: number;
}

// One machine shot with the same camera on the Modernity and the default-texture map.
export interface Comparison {
  key: string;
  title: string;
  caption: string;
  hash: string;
  modernity: string;
  default: string;
  width: number;
  height: number;
}

export interface Gallery {
  images: GalleryImage[];
  compare?: Comparison[];
}

// Generated files are absent until `pnpm demo` ran; the dev server answers unknown paths with the SPA page, so the
// content is checked, not only the status.
export async function loadJson<T>(path: string, valid: (value: unknown) => value is T): Promise<T | null> {
  try {
    const response = await fetch(withBase(path), { cache: "no-cache" });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    return valid(value) ? value : null;
  } catch {
    return null;
  }
}

let gallery: Promise<Gallery | null> | undefined;

// gallery.json, fetched once for all the gallery components of the page.
export function loadGallery(): Promise<Gallery | null> {
  gallery ??= loadJson(
    "/generated/gallery.json",
    (value): value is Gallery =>
      typeof value === "object" && value !== null && "images" in value && Array.isArray(value.images),
  );
  return gallery;
}

export function showInMap(hash: string): void {
  demoHash.value = hash;
  document.querySelector(".demo-map")?.scrollIntoView({ behavior: "smooth", block: "center" });
}
