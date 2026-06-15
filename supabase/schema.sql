-- ============================================================================
-- Recipe Book — Supabase 스키마 & 스토리지 설정
--
-- 사용법: Supabase 대시보드 → SQL Editor 에 붙여넣고 실행.
-- 이 앱은 service_role 키로 서버(API 라우트)에서만 접근하므로,
-- RLS는 "기본 차단"만 켜두면 된다. (service_role 키는 RLS를 우회함)
-- ============================================================================

-- 1) recipes 테이블 ----------------------------------------------------------
--    "character" 는 SQL 예약어라 반드시 큰따옴표로 감싼다.
create table if not exists public.recipes (
  id                  text primary key,
  name                text not null,
  emoji               text,
  "character"         text not null default 'cute_bear',
  recipe              jsonb not null,
  hero_image_ref      text,
  finished_image_ref  text,        -- 유저가 업로드한 완성 요리 사진 (썸네일 우선 소스)
  saved_at            timestamptz not null default now()
);

-- 목록 정렬용 / 중복 갱신(name+character) 조회용 인덱스
create index if not exists recipes_saved_at_idx
  on public.recipes (saved_at desc);
create index if not exists recipes_name_character_idx
  on public.recipes (name, "character");

-- 2) RLS: 기본 차단 ----------------------------------------------------------
--    정책을 전혀 부여하지 않으면 anon/authenticated 의 직접 접근이 모두 막힌다.
--    service_role 키(서버)는 RLS를 우회하므로 앱은 정상 동작한다.
alter table public.recipes enable row level security;

-- 3) Storage 버킷 (이미지) ---------------------------------------------------
--    <img src>로 바로 로드하기 위해 public 버킷으로 생성한다.
--    버킷 이름은 SUPABASE_STORAGE_BUCKET 환경변수(기본값 recipe-images)와 일치해야 한다.
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

-- 4) 기존 테이블에 finished_image_ref 컬럼 추가 (이미 테이블을 생성했다면 이 부분만 실행) ---
alter table public.recipes
  add column if not exists finished_image_ref text;

-- 5) 상세 레시피 한장 이미지 레퍼런스 컬럼 추가 ----------------------------------
alter table public.recipes
  add column if not exists detail_image_ref text;

-- 끝. 배포 환경변수에 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 설정하면
-- 앱이 자동으로 파일 저장소 대신 이 Supabase 저장소를 사용한다.
