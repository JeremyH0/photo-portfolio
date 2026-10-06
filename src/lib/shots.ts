import { getPhotos, getPhotosByIds, type Photo } from './queries';
import { urlFor, type Rect } from './image';

/**
 * A hand-picked photo on a curated surface (home panels, the Videos reel),
 * chosen by Sanity document id.
 */
export type Shot = {
  id: string;
  /** object-position — keeps the subject in frame when the box crops. */
  focus?: string;
  /**
   * Keep only this part of the photo, as fractions of its width/height.
   * Cropped by Sanity's CDN, so the rest never reaches the browser — use it
   * when something must stay out of frame in every layout (e.g. a face).
   */
  crop?: { x: number; y: number; w: number; h: number };
};

export type ResolvedShot = {
  photo: Photo;
  focus: string;
  rect?: Rect;
  /** Dimensions after cropping. */
  width: number;
  height: number;
  /** Tiny blurred placeholder matching the crop. */
  placeholder: string;
};

/**
 * Looks the shots up in Sanity. A photo deleted in the Studio falls back to
 * another one rather than breaking the build.
 */
export async function resolveShots(shots: Shot[]): Promise<ResolvedShot[]> {
  const found = await getPhotosByIds(shots.map((s) => s.id));
  const byId = new Map(found.map((p) => [p._id, p]));
  const fallback: Photo[] = found.length < shots.length ? await getPhotos() : [];

  return shots.map((shot, i) => {
    const photo = byId.get(shot.id) ?? fallback[i];
    const { width: w, height: h } = photo.image;
    const rect = shot.crop && {
      left: Math.round(shot.crop.x * w),
      top: Math.round(shot.crop.y * h),
      width: Math.round(shot.crop.w * w),
      height: Math.round(shot.crop.h * h),
    };
    return {
      photo,
      focus: shot.focus ?? '50% 50%',
      rect,
      width: rect?.width ?? w,
      height: rect?.height ?? h,
      // The stored LQIP is of the whole photo — a cropped shot needs its own.
      placeholder: rect ? urlFor(photo.image, 32, undefined, rect) : photo.image.lqip,
    };
  });
}
