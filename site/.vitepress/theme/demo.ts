import { withBase } from "vitepress";
import { ref } from "vue";

// Webapp location hash (map:x:y:z:distance:rotation:angle:tilt:ortho:mode) shown by <DemoMap>; <DemoGallery> sets it.
export const demoHash = ref("gtnh_zoo:16:5:16:40:0.6:1:0:0:perspective");

export interface GalleryImage {
  file: string;
  title: string;
  caption: string;
  hash: string;
  map: string;
  width: number;
  height: number;
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
