# 오프라인 화면 내보내기

`export-scenes.mjs`는 보관된 원본 JSX에서 화면 DOM을 만들고, 저장된 조회값과 영상의 6초 PNG를 결합합니다. OWP 서버에 요청을 보내거나 설비를 제어하지 않습니다.

출력은 `snapshots/*.html`과 `*-layout.json`입니다. 원본 크롬 세션에서 촬영한 화면이 아니며, 게이지는 영역 표시로 대체되고 팝업과 시계는 생략됩니다. 조회하지 않은 값은 빈칸 또는 대시로 남깁니다.

의존성은 작업 당시 임시 폴더에만 설치했습니다. 다시 생성하려면 PowerShell에서:

```powershell
$owpRenderDeps = Join-Path $env:TEMP 'codex-owp-render-deps'
npm.cmd install --prefix $owpRenderDeps --no-save --no-package-lock @babel/core@8.0.9 @babel/plugin-transform-react-jsx@8.0.1
node .\tooling\export-scenes.mjs
```

다른 설치 경로를 쓸 때는 `OWP_RENDER_DEPS` 환경변수에 해당 경로를 지정합니다. 별도 React 설치는 필요하지 않습니다.
