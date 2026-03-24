# zkTransfer UI Architecture

## Shared Information Architecture

- `Overview`
- `Send`
- `Activity`
- `Explorer`

원칙:

- 일반 사용자는 `zk`, `proof`, `note` 같은 내부 용어를 보지 않는다
- 기본 행동은 항상 `누구에게`, `무엇을`, `얼마나` 보낼지만 고른다
- `빠른 송금`과 `개인정보 보호 송금`은 기술 모드가 아니라 서비스 모드로 표현한다
- 영수증과 상태는 결과 중심으로 압축해서 보여준다

## Overview

- 총 요청 수
- 최근 보호 송금 비율
- 처리 중 요청
- 최근 전송

## Send

입력:

- 수신자
- 자산
- 금액
- 송금 방식

보조 정보:

- 예상 처리 시간
- 예상 수수료
- 자동 추천 사유

## Activity

- 요청 상태 타임라인
- 최근 요청 목록
- 실패 사유

## Explorer

- local chain tx 목록
- requestId와 txHash 연결
- token type / network / amount 표시

## App-Specific Layout

- 하단 탭 4개
  - 홈
  - 송금
  - 활동
  - 영수증

- 송금은 단일 스크린 중심
- 상태/영수증은 카드형
- Expo 기반으로 web UI와 동일한 API를 사용

## Web-Specific Layout

- 홈에서는 자산, 자주 보내는 사람, 최근 처리 결과를 먼저 보여준다
- 송금 화면은 은행 앱처럼 단일 폼과 요약 카드만 노출한다
- 개발용 상세 응답은 `details` 안으로 숨긴다
