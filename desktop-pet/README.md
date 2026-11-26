# 뽀식이 데스크톱 펫

윈도우 화면 위를 돌아다니는 강아지 프로그램이에요 (Electron).

## 받기
https://github.com/pudlemixbbosik-beep/sceduler/releases/download/ppo-pet/PpoPet-Setup.exe

1. 위 링크로 `PpoPet-Setup.exe` 를 내려받아 더블클릭
2. "Windows의 PC 보호" 창이 뜨면 **추가 정보 → 실행**
3. 설치가 끝나면 바로 뽀식이가 화면 위에서 떨어져요

## 쓰는 법
- 뽀식이 클릭: 하트 뿅뿅 / 끌어서 옮기기·던지기
- 뽀식이 오른쪽 클릭(또는 메뉴의 대화하기): 대화 창. "앉아", "손", "간식", "산책", "사랑해", "내 이름은 ○○야" 등을 알아들어요 (인터넷·요금 없음)
- 기본 뽀식이는 원본 사진(public/ppo/ppo-default.jpg)을 바탕으로 AI가 만든 동작 그림(src/assets/ppo/)으로 걷기·달리기·앉기·자기·놀자 자세·손·밥 먹기를 해요. 내 사진을 고르면 사진 스티커로 움직여요
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

## 걷기 그림
`src/assets/ppo/walk0~7.png` 는 걷기 그림 한 장에서 무릎 아래만 앞뒤로 부드럽게 휘게 만든 8장(앞다리와 뒷다리가 반대로, 앞으로 내밀 때 살짝 들기)이에요. `pet.js` 는 시간 대신 걸은 거리에 맞춰 그림을 넘겨서 발이 미끄러지지 않아요.
