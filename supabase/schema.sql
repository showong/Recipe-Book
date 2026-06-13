-- ============================================================================
-- Recipe Book — Supabase 스키마 & 스토리지 설정
--
-- 사용법: Supabase 대시보드 → SQL Editor 에 붙여넣고 실행.
-- service_role 키로 서버(API 라우트)에서만 접근하므로 RLS는 기본 차단만 유지.
-- (service_role 키는 RLS를 우회함)
-- ============================================================================

-- 1) recipes 테이블 ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipes (
  id                  text        PRIMARY KEY,
  name                text        NOT NULL,
  emoji               text,
  "character"         text        NOT NULL DEFAULT 'cute_bear',
  recipe              jsonb       NOT NULL,          -- RecipeDetail 전체
  hero_image_ref      text,                          -- AI 생성 레시피 카드 이미지 ref
  finished_image_ref  text,                          -- 유저가 직접 찍은 완성 요리 사진 ref
  saved_at            timestamptz NOT NULL DEFAULT now()
);

-- 목록 정렬용 인덱스
CREATE INDEX IF NOT EXISTS recipes_saved_at_idx
  ON public.recipes (saved_at DESC);

-- 중복 저장 방지용 인덱스 (name + character 조합이 같으면 최신본으로 덮어씀)
CREATE INDEX IF NOT EXISTS recipes_name_character_idx
  ON public.recipes (name, "character");

-- 2) RLS: 기본 차단 ----------------------------------------------------------
--    정책을 부여하지 않으면 anon/authenticated 의 직접 접근이 막힌다.
--    service_role 키(서버)는 RLS를 우회하므로 앱은 정상 동작한다.
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- 3) Storage 버킷 (이미지) ---------------------------------------------------
--    hero_image_ref / finished_image_ref 가 가리키는 파일을 저장하는 버킷.
--    <img src>로 바로 로드하기 위해 public 버킷으로 생성.
--    버킷 이름은 SUPABASE_STORAGE_BUCKET 환경변수(기본값 recipe-images)와 일치해야 함.
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 기존 테이블에 마이그레이션이 필요한 경우 아래만 별도 실행
-- (이미 CREATE TABLE 로 생성한 경우)
-- ============================================================================

-- finished_image_ref 컬럼 추가 (이미 있으면 무시)
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS finished_image_ref text;
