import { promises as fs } from "fs";
import path from "path";

/**
 * 이미지 저장 추상화.
 *
 * - 현재(MVP): 로컬 파일(data/images)에 data URL 문자열을 보관한다.
 * - 배포 시: 이 인터페이스만 오브젝트 스토리지(S3 / Supabase Storage / Vercel Blob)
 *   구현으로 교체하면 된다. put()이 공개 URL을 반환하도록 만들면,
 *   resolve()는 그 URL을 그대로 통과시키므로 호출부 수정이 거의 없다.
 *
 * 레코드에는 base64가 아니라 여기서 반환한 ref(키 또는 URL)만 저장한다.
 */
export interface ImageStore {
  /** 이미지를 저장하고 참조(ref)를 반환. ref는 저장소 키 또는 공개 URL. */
  put(dataUrl: string): Promise<string>;
  /** ref로부터 <img src>에 바로 쓸 수 있는 URL(data URL 또는 공개 URL)을 반환. */
  resolve(ref: string | null | undefined): Promise<string | null>;
  /** 저장된 이미지를 삭제. 외부 URL / data URL ref는 무시. */
  remove(ref: string | null | undefined): Promise<void>;
}

const IMAGES_DIR = path.join(process.cwd(), "data", "images");

// 이미 외부 URL이거나 인라인 data URL이면 그대로 통과 (배포 환경 대비)
const isPassThrough = (ref: string) => /^https?:\/\//.test(ref) || ref.startsWith("data:");

const fileImageStore: ImageStore = {
  async put(dataUrl) {
    const ref = `img_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    await fs.mkdir(IMAGES_DIR, { recursive: true });
    await fs.writeFile(path.join(IMAGES_DIR, ref), dataUrl, "utf-8");
    return ref;
  },

  async resolve(ref) {
    if (!ref) return null;
    if (isPassThrough(ref)) return ref;
    try {
      return await fs.readFile(path.join(IMAGES_DIR, ref), "utf-8");
    } catch {
      return null;
    }
  },

  async remove(ref) {
    if (!ref || isPassThrough(ref)) return;
    try {
      await fs.unlink(path.join(IMAGES_DIR, ref));
    } catch {
      /* 이미 삭제됨 */
    }
  },
};

// 🔌 배포 시 여기만 다른 구현으로 교체
export const imageStore: ImageStore = fileImageStore;
