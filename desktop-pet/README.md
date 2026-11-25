# 뽀식이 데스크톱 펫

윈도우 화면 위를 돌아다니는 강아지 프로그램이에요 (Electron).

## 받기
https://github.com/pudlemixbbosik-beep/sceduler/releases/download/ppo-pet/PpoPet-Setup.exe

1. 위 링크로 `PpoPet-Setup.exe` 를 내려받아 더블클릭
2. "Windows의 PC 보호" 창이 뜨면 **추가 정보 → 실행**
3. 설치가 끝나면 바로 뽀식이가 화면 위에서 떨어져요

## 쓰는 법
- 뽀식이 클릭: 하트 뿅뿅 / 끌어서 옮기기·던지기
- 작업 표시줄 오른쪽 아래 강아지 아이콘: 부르기, 간식, 공, 재우기, 소리, 크기, 자동 실행, 설정(이름·사진), 숨기기, 종료
- 지우기: 윈도우 설정 → 앱 → "뽀식이 데스크톱 펫" 제거

## 개발
```
npm install
npm start          # 실행
npm run smoke      # 스크린샷 테스트 (out/)
npm run dist:win   # 윈도우 설치 파일 (dist/)
```
GitHub Actions(`.github/workflows/desktop-pet.yml`)가 `desktop-pet/` 이 바뀔 때마다 윈도우 설치 파일을 만들어 `ppo-pet` 릴리스에 올려요.
