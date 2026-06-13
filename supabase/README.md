# Supabase 연동 (웹 배포용 영속 저장소)

로컬에서는 레시피/이미지가 `data/` 폴더(파일)에 저장되지만, 웹 배포(특히 Vercel 같은
서버리스)에서는 파일이 휘발성이라 사라집니다. 아래 설정을 하면 앱이 **자동으로**
Supabase(Postgres + Storage)로 전환됩니다.

## 동작 방식

- `lib/recipe-store.ts` / `lib/image-store.ts` 가 `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
  존재 여부를 보고 구현체를 고릅니다.
  - **둘 다 설정됨** → Supabase 저장소 사용
  - **미설정** → 기존 로컬 파일 저장소 사용 (로컬 개발 그대로)
- 모든 접근은 서버(API 라우트)에서 **service_role** 키로만 이뤄집니다. 클라이언트에는
  어떤 Supabase 키도 노출되지 않습니다.

## 설정 순서

1. **Supabase 프로젝트 생성** → Dashboard

2. **스키마/버킷 생성**: SQL Editor 에 [`schema.sql`](./schema.sql) 전체를 붙여넣고 실행.
   - `recipes` 테이블 + 인덱스 + RLS(기본 차단)
   - `recipe-images` public Storage 버킷

3. **환경변수 등록** (`.env.local` 또는 Vercel → Settings → Environment Variables):
   ```
   SUPABASE_URL=https://xxxxxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...   # Project Settings → API → service_role
   SUPABASE_STORAGE_BUCKET=recipe-images     # 선택, 기본값 동일
   ```
   값은 Dashboard → **Project Settings → API** 에서 확인합니다.

4. 배포 후 끝. 유저가 저장한 레시피/이미지가 Supabase에 쌓이고, 관리자 쇼츠 화면에서
   동일하게 조회됩니다.

## 보안 주의

- `SUPABASE_SERVICE_ROLE_KEY` 는 **RLS를 우회하는 전권 키**입니다.
  - `NEXT_PUBLIC_` 접두사 금지 (붙이면 브라우저 번들에 노출됨).
  - Vercel에서는 **Production 환경 + "Sensitive"** 변수로 등록하세요.
  - 유출 의심 시 Dashboard 에서 즉시 로테이션(재발급).
