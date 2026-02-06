# Morse Melody (Local Only)

텍스트를 모스 부호 멜로디로 변환하고, 로컬 Web Audio + Canvas 비주얼라이저로 재생하는 **완전 로컬 웹앱**입니다.  
외부 AI / API를 전혀 사용하지 않습니다.

## 실행 방법

1. 의존성 설치

```bash
npm install
```

2. 개발 서버 실행

```bash
npm run dev
```

3. 브라우저에서 `http://localhost:5173` (또는 터미널에 표시되는 주소)를 열면 됩니다.

## 빌드

```bash
npm run build
```

`dist/` 폴더가 생성되며, 정적 호스팅(Vercel, Netlify, GitHub Pages 등)에 그대로 올릴 수 있습니다.

## 배포 가이드 (Vercel 기준)

1. Git 저장소 초기화 및 커밋 (없다면)

```bash
git init
git add .
git commit -m "init local morse melody"
```

2. GitHub에 새 저장소를 만들고, 이 프로젝트를 푸시합니다.

```bash
git remote add origin <your-github-repo-url>
git branch -M main
git push -u origin main
```

3. [Vercel](https://vercel.com)에 로그인한 뒤, **Add New Project** → GitHub에서 방금 올린 저장소 선택

4. 프레임워크/빌드 설정
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

5. **Deploy** 버튼을 누르면 몇 분 안에 배포 URL이 생성됩니다.

> 이 앱은 AI / API를 사용하지 않으므로, 별도의 API 키나 환경 변수 설정이 필요 없습니다.

