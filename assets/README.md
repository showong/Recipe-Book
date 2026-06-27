# 앱 아이콘 / 스플래시 소스

이 폴더는 `@capacitor/assets`로 iOS/Android 아이콘·스플래시를 자동 생성하는 **원본**입니다.

| 파일 | 크기 | 용도 |
|------|------|------|
| `icon.png` | 1024×1024 | 앱 아이콘 원본 |
| `splash.png` | 2732×2732 | 스플래시(라이트) — 배경색 `#fff7ed` |
| `splash-dark.png` | 2732×2732 | 스플래시(다크) |

## 생성 방법 (Mac)

```bash
npm install                 # @capacitor/assets 설치 (sharp 포함)
npm run cap:assets          # ios/ android/ 에 모든 크기 자동 생성
npx cap sync
```

생성 후 Xcode에서 ▶ Run 하면 새 아이콘/스플래시가 적용됩니다.

## 더 멋진 디자인으로 바꾸려면
- `icon.png`(1024 정사각, 여백 약간 포함 권장)를 교체
- `splash.png`(2732 정사각, 가운데 로고 배치 권장)를 교체
- 다시 `npm run cap:assets` 실행

> 현재 splash 는 브랜드 배경색 단색입니다. 로고가 들어간 스플래시를 원하면
> 가운데에 로고를 배치한 2732×2732 이미지로 `splash.png` 를 교체하세요.
