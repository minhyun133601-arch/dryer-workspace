// Card identities and appearance are current evidence; room geometry is a historical-plan approximation.
// X/Z are centred drawing coordinates, never campus/GPS coordinates. Asset URLs live in liquid-assets.js.
export const LIQUID_ROOM = Object.freeze({
  "id": "liquid",
  "name": "3팀 액상 · 내부 설비",
  "shortName": "액상",
  "width": 99.7,
  "depth": 39.2,
  "height": 4.5,
  "center": [
    0,
    1.6,
    0
  ],
  "bounds": {
    "minX": -49.85,
    "maxX": 49.85,
    "minZ": -19.6,
    "maxZ": 19.6
  },
  "columns": [
    {
      "position": [
        10.1506,
        0,
        -0.0057
      ],
      "width": 0.2058,
      "depth": 0.4002,
      "height": 4.5,
      "section": "I",
      "pdfPathIndices": [
        9726,
        9730
      ],
      "source": "2022-05-03 PDF I-column vector outline",
      "confidence": "historical-plan-geometry; current height unmeasured"
    },
    {
      "position": [
        4.1494,
        0,
        -0.0057
      ],
      "width": 0.2058,
      "depth": 0.4002,
      "height": 4.5,
      "section": "I",
      "pdfPathIndices": [
        9735,
        9739
      ],
      "source": "2022-05-03 PDF I-column vector outline",
      "confidence": "historical-plan-geometry; current height unmeasured"
    },
    {
      "position": [
        -37.8476,
        0,
        -19.6057
      ],
      "width": 0.2058,
      "depth": 0.4002,
      "height": 4.5,
      "section": "I",
      "pdfPathIndices": [
        9850,
        9854
      ],
      "source": "2022-05-03 PDF I-column vector outline",
      "confidence": "historical-plan-geometry; current height unmeasured"
    },
    {
      "position": [
        -43.8488,
        0,
        -19.6057
      ],
      "width": 0.2058,
      "depth": 0.4002,
      "height": 4.5,
      "section": "I",
      "pdfPathIndices": [
        9859,
        9863
      ],
      "source": "2022-05-03 PDF I-column vector outline",
      "confidence": "historical-plan-geometry; current height unmeasured"
    },
    {
      "position": [
        -49.85,
        0,
        -19.6057
      ],
      "width": 0.2058,
      "depth": 0.4002,
      "height": 4.5,
      "section": "I",
      "pdfPathIndices": [
        9868,
        9872
      ],
      "source": "2022-05-03 PDF I-column vector outline",
      "confidence": "historical-plan-geometry; current height unmeasured"
    },
    {
      "position": [
        10.1506,
        0,
        19.6057
      ],
      "width": 0.2058,
      "depth": 0.4002,
      "height": 4.5,
      "section": "I",
      "pdfPathIndices": [
        10031,
        10033
      ],
      "source": "2022-05-03 PDF I-column vector outline",
      "confidence": "historical-plan-geometry; current height unmeasured"
    },
    {
      "position": [
        10.1506,
        0,
        -19.6057
      ],
      "width": 0.2058,
      "depth": 0.4002,
      "height": 4.5,
      "section": "I",
      "pdfPathIndices": [
        18721,
        18725
      ],
      "source": "2022-05-03 PDF I-column vector outline",
      "confidence": "historical-plan-geometry; current height unmeasured"
    },
    {
      "position": [
        4.1494,
        0,
        -19.6057
      ],
      "width": 0.2058,
      "depth": 0.4002,
      "height": 4.5,
      "section": "I",
      "pdfPathIndices": [
        18731,
        18799
      ],
      "source": "2022-05-03 PDF I-column vector outline",
      "confidence": "historical-plan-geometry; current height unmeasured"
    },
    {
      "position": [
        20.4498,
        0,
        -0.0057
      ],
      "width": 0.2058,
      "depth": 0.4002,
      "height": 4.5,
      "section": "I",
      "pdfPathIndices": [
        31324,
        31328
      ],
      "source": "2022-05-03 PDF I-column vector outline",
      "confidence": "historical-plan-geometry; current height unmeasured"
    }
  ],
  "walls": [],
  "routes": [
    {
      "id": "liquid-plan-pet-loop",
      "roomId": "pet",
      "kind": "conveyor",
      "width": 0.55,
      "height": 0.82,
      "points": [
        [
          -29.8,
          0.82,
          -9.8
        ],
        [
          -25.5,
          0.82,
          -9.8
        ],
        [
          -25.5,
          0.82,
          -8.7
        ],
        [
          -23.5,
          0.82,
          -8.7
        ],
        [
          -23.5,
          0.82,
          -11.8
        ],
        [
          -6,
          0.82,
          -11.8
        ],
        [
          -6,
          0.82,
          -5.4
        ],
        [
          -15.4,
          0.82,
          -5.4
        ]
      ],
      "clipEquipment": true,
      "source": "2022-05-03 equipment plan",
      "positionMatch": "unconfirmed",
      "confidence": "과거 도면의 이송선 중심을 참고한 근사 · 현재 카드별 연결 미확정",
      "note": "배경 이송선이며 새 카드 설비 수에 포함하지 않습니다. 카드 외형 안의 구간은 내장 벨트와 중복하지 않도록 생략합니다."
    },
    {
      "id": "liquid-plan-outer-loop",
      "roomId": "outer",
      "kind": "conveyor",
      "width": 0.55,
      "height": 0.82,
      "points": [
        [
          13.2,
          0.82,
          0.2
        ],
        [
          13.2,
          0.82,
          11.9
        ],
        [
          27.1,
          0.82,
          11.9
        ],
        [
          27.1,
          0.82,
          6.7
        ],
        [
          15.3,
          0.82,
          6.7
        ]
      ],
      "clipEquipment": true,
      "source": "2022-05-03 equipment plan",
      "positionMatch": "unconfirmed",
      "confidence": "과거 도면의 이송선 중심을 참고한 근사 · 현재 카드별 연결 미확정",
      "note": "배경 이송선이며 새 카드 설비 수에 포함하지 않습니다. 카드 외형 안의 구간은 내장 벨트와 중복하지 않도록 생략합니다."
    }
  ],
  "source": "2026 3팀 실내 이력카드 52건 · 2022-05-03 액상공장 장비배치도 · 2021 스틱 공사안 · 2025 배합실 개조 개념 DWG",
  "summary": "배합·파우치·외포장·PET·보일러·스틱·후살균·제환의 8개 카드상 구역과 52개 설비 그룹입니다. 외형은 실제 카드 사진, 위치는 과거 도면의 방 단위 배치를 참고했습니다.",
  "confidence": "카드의 8개 방·52개 설비 확인 · 과거 도면 축·실명 참고 · 현재 개별 위치·치수는 실측 정합 아님",
  "details": [
    "99.7×39.2m는 2022 건축 축 치수입니다. 이 좌표는 도면의 긴 변을 X, 짧은 변을 Z로 둔 내부 전용 모델이며 북쪽·GPS·캠퍼스 절대 좌표가 아닙니다.",
    "8개 구역은 이력카드의 방 분류입니다. PET충진실과 PET살균냉각실처럼 여러 과거 구획을 탐색용 한 방으로 묶은 곳이 있으며 보일러·스틱·제환의 현 구획은 추가 확인이 필요합니다.",
    "52는 카드 기반 선택 그룹 수입니다. 카드에 여러 호기가 적혀 있더라도 사진에 확인되지 않은 개체를 그 이름만으로 추가하지 않았습니다.",
    "기둥은 원본 PDF에서 같은 I형 벡터 외곽으로 확인한 9개만 옮겼습니다. 모든 현재 기둥을 조사한 것이 아니며 벽 높이 4.5m와 상세 이격은 근사입니다.",
    "PET와 외포장의 배경 이송선은 2022 평면의 선형을 참고했습니다. 현재 카드별 연결·분기와 실제 작동 경로를 확정하거나 새 설비 대수로 추가하지 않았습니다.",
    "과거 공사안의 신규·철거·개조 표시는 현재 설치 완료를 뜻하지 않습니다. 미확인 좌표를 현재 준공 배치나 피난 동선의 확정값으로 사용하지 않습니다."
  ]
});
export const LIQUID_ROOMS = Object.freeze([
  {
    "id": "mixing",
    "name": "배합실",
    "outline": [
      [
        -37.85,
        0.4
      ],
      [
        -33.85,
        0.4
      ],
      [
        -33.85,
        -3.2
      ],
      [
        -22.85,
        -3.2
      ],
      [
        -22.85,
        19.6
      ],
      [
        -37.85,
        19.6
      ]
    ],
    "planLabels": [
      "배합실"
    ],
    "doors": [
      {
        "side": "maxX",
        "offset": 6.1,
        "width": 1.8,
        "height": 2.3,
        "position": [
          -22.85,
          0,
          6.1
        ],
        "confidence": "historical-plan-opening; present position unconfirmed"
      },
      {
        "side": "maxX",
        "offset": 14.2,
        "width": 1.6,
        "height": 2.3,
        "position": [
          -22.85,
          0,
          14.2
        ],
        "confidence": "historical-plan-opening; present position unconfirmed"
      }
    ],
    "basis": "2022 장비배치도의 배합실·탱크열과 2025 디졸버믹서·A/B LINE 개조 개념도를 대조했습니다. 개별 카드의 탱크 번호와 도면 번호는 연결하지 않았습니다.",
    "bounds": {
      "minX": -37.85,
      "maxX": -22.85,
      "minZ": -3.2,
      "maxZ": 19.6
    },
    "height": 4.5,
    "confidence": "카드상 방·과거 도면 실명 대조 · 현재 경계·개별 위치 근사",
    "positionMatch": "historical-room-approximation"
  },
  {
    "id": "pouch",
    "name": "파우치실",
    "outline": [
      [
        -22.85,
        0.4
      ],
      [
        -4.85,
        0.4
      ],
      [
        -4.85,
        13.4
      ],
      [
        -22.85,
        13.4
      ]
    ],
    "planLabels": [
      "액상로타리포장실",
      "파우치포장실"
    ],
    "doors": [
      {
        "side": "minX",
        "offset": 6.4,
        "width": 1.8,
        "height": 2.3,
        "position": [
          -22.85,
          0,
          6.4
        ],
        "confidence": "historical-plan-opening; present position unconfirmed"
      },
      {
        "side": "maxX",
        "offset": 8.5,
        "width": 1.8,
        "height": 2.3,
        "position": [
          -4.85,
          0,
          8.5
        ],
        "confidence": "historical-plan-opening; present position unconfirmed"
      }
    ],
    "basis": "2022 로타리·파우치 포장 구역의 실루엣과 2021 스틱 배치 공사안의 중앙 충진기 군을 참고했습니다. 현재 6개 충진기의 개별 호기 좌표는 미확정입니다.",
    "bounds": {
      "minX": -22.85,
      "maxX": -4.85,
      "minZ": 0.4,
      "maxZ": 13.4
    },
    "height": 4.5,
    "confidence": "카드상 방·과거 도면 실명 대조 · 현재 경계·개별 위치 근사",
    "positionMatch": "historical-room-approximation"
  },
  {
    "id": "outer",
    "name": "외포장실",
    "outline": [
      [
        -4.85,
        -4.6
      ],
      [
        18.85,
        -4.6
      ],
      [
        18.85,
        2.6
      ],
      [
        27.85,
        2.6
      ],
      [
        27.85,
        19.6
      ],
      [
        10.85,
        19.6
      ],
      [
        10.85,
        0.4
      ],
      [
        -4.85,
        0.4
      ]
    ],
    "planLabels": [
      "외포장실"
    ],
    "doors": [
      {
        "side": "maxZ",
        "offset": 20.5,
        "width": 2.2,
        "height": 2.3,
        "position": [
          20.5,
          0,
          19.6
        ],
        "confidence": "historical-plan-opening; present position unconfirmed"
      }
    ],
    "basis": "2022 외포장실의 꺾인 외곽과 포장·검사 이송 흐름을 참고했습니다. 카드의 현 장비별 설치 완료 위치·컨베이어 연결은 확인되지 않았습니다.",
    "bounds": {
      "minX": -4.85,
      "maxX": 27.85,
      "minZ": -4.6,
      "maxZ": 19.6
    },
    "height": 4.5,
    "confidence": "카드상 방·과거 도면 실명 대조 · 현재 경계·개별 위치 근사",
    "positionMatch": "historical-room-approximation"
  },
  {
    "id": "pet",
    "name": "PET실",
    "outline": [
      [
        -34.85,
        -14.6
      ],
      [
        -22.85,
        -14.6
      ],
      [
        -22.85,
        -12.6
      ],
      [
        -4.85,
        -12.6
      ],
      [
        -4.85,
        -4.6
      ],
      [
        -22.85,
        -4.6
      ],
      [
        -22.85,
        -4.2
      ],
      [
        -34.85,
        -4.2
      ]
    ],
    "planLabels": [
      "PET충진실",
      "PET살균냉각실"
    ],
    "doors": [
      {
        "side": "maxZ",
        "offset": -28.2,
        "width": 1.6,
        "height": 2.3,
        "position": [
          -28.2,
          0,
          -4.2
        ],
        "confidence": "historical-plan-opening; present position unconfirmed"
      }
    ],
    "basis": "2022 PET충진실과 긴 PET살균냉각실 구역을 하나의 카드상 PET실 탐색 영역으로 묶었습니다. 현재 카드의 병 구경·설비명은 과거 도면 기호에 강제 대응하지 않습니다.",
    "bounds": {
      "minX": -34.85,
      "maxX": -4.85,
      "minZ": -14.6,
      "maxZ": -4.2
    },
    "height": 4.5,
    "confidence": "카드상 방·과거 도면 실명 대조 · 현재 경계·개별 위치 근사",
    "positionMatch": "historical-room-approximation"
  },
  {
    "id": "boiler",
    "name": "보일러실 · 위치 미확정",
    "outline": [
      [
        35.85,
        -19.6
      ],
      [
        42.85,
        -19.6
      ],
      [
        42.85,
        -14.6
      ],
      [
        35.85,
        -14.6
      ]
    ],
    "planLabels": [
      "2021 공사안 보일러실 후보"
    ],
    "doors": [],
    "basis": "2021 공사안의 탈의·샤워 구역 인접 보일러실 표기를 참고한 낮은 확신의 대표 영역입니다. 2022 발전기실을 보일러실로 바꾸지 않았으며 현재 구획·정확 위치는 확인되지 않았습니다.",
    "positionMatch": "unconfirmed-room",
    "bounds": {
      "minX": 35.85,
      "maxX": 42.85,
      "minZ": -19.6,
      "maxZ": -14.6
    },
    "height": 4.5,
    "confidence": "카드상 방 확인 · 과거 도면상 구역 후보 · 현재 경계·위치 미확정",
    "positionConfidence": "unconfirmed",
    "positionBasis": "representative",
    "referenceOnly": true,
    "summary": "위치 미확정 · 참조 배치. 카드상 소속 방은 확인했으나 현재 도면의 방 경계·설비 위치는 연결되지 않았습니다."
  },
  {
    "id": "stick",
    "name": "스틱실",
    "outline": [
      [
        -22.85,
        13.4
      ],
      [
        -4.85,
        13.4
      ],
      [
        -4.85,
        19.6
      ],
      [
        -22.85,
        19.6
      ]
    ],
    "planLabels": [
      "2021 HIPE형 병렬 충진기 후보"
    ],
    "doors": [
      {
        "side": "minX",
        "offset": 15.2,
        "width": 1.6,
        "height": 2.3,
        "position": [
          -22.85,
          0,
          15.2
        ],
        "confidence": "historical-plan-opening; present position unconfirmed"
      }
    ],
    "basis": "2021 스틱 배치 공사안의 병렬 HIPE형 2대와 2022 중앙 블록의 긴 충진·포장 실루엣을 참고했습니다. 3팀 액상의 스틱실이며 2팀 스틱 소포장동과 구분합니다.",
    "positionMatch": "unconfirmed-room",
    "bounds": {
      "minX": -22.85,
      "maxX": -4.85,
      "minZ": 13.4,
      "maxZ": 19.6
    },
    "height": 4.5,
    "confidence": "카드상 방 확인 · 과거 도면상 구역 후보 · 현재 경계·위치 미확정"
  },
  {
    "id": "retort",
    "name": "후살균실",
    "outline": [
      [
        -4.85,
        0.4
      ],
      [
        10.85,
        0.4
      ],
      [
        10.85,
        19.6
      ],
      [
        -4.85,
        19.6
      ]
    ],
    "planLabels": [
      "살균냉각실"
    ],
    "doors": [
      {
        "side": "minX",
        "offset": 7.1,
        "width": 1.8,
        "height": 2.3,
        "position": [
          -4.85,
          0,
          7.1
        ],
        "confidence": "historical-plan-opening; present position unconfirmed"
      },
      {
        "side": "maxX",
        "offset": 9.1,
        "width": 1.8,
        "height": 2.3,
        "position": [
          10.85,
          0,
          9.1
        ],
        "confidence": "historical-plan-opening; present position unconfirmed"
      }
    ],
    "basis": "2022 살균냉각실의 세 줄 긴 수조·냉각기 실루엣을 현재 후살균실 카드의 방 단위 배치 참고로 사용했습니다. 현재 기기별 일대일 대응과 정확한 길이는 미확정입니다.",
    "bounds": {
      "minX": -4.85,
      "maxX": 10.85,
      "minZ": 0.4,
      "maxZ": 19.6
    },
    "height": 4.5,
    "confidence": "카드상 방·과거 도면 실명 대조 · 현재 경계·개별 위치 근사",
    "positionMatch": "historical-room-approximation"
  },
  {
    "id": "pellet",
    "name": "제환실 · 위치 미확정",
    "outline": [
      [
        5,
        -14.6
      ],
      [
        9.2,
        -14.6
      ],
      [
        9.2,
        -6
      ],
      [
        5,
        -6
      ]
    ],
    "planLabels": [
      "펄제품제환실 구역 후보"
    ],
    "doors": [],
    "basis": "2022 펄제품제환실 표기 주변을 카드상 제환실의 후보 영역으로 표시했습니다. 현재 카드 2개 장비의 위치·방 경계는 확인되지 않았습니다.",
    "positionMatch": "unconfirmed-room",
    "bounds": {
      "minX": 5,
      "maxX": 9.2,
      "minZ": -14.6,
      "maxZ": -6
    },
    "height": 4.5,
    "confidence": "카드상 방 확인 · 과거 도면상 구역 후보 · 현재 경계·위치 미확정",
    "positionConfidence": "unconfirmed",
    "positionBasis": "representative",
    "referenceOnly": true,
    "summary": "위치 미확정 · 참조 배치. 카드상 소속 방은 확인했으나 현재 도면의 방 경계·설비 위치는 연결되지 않았습니다."
  }
]);
export const LIQUID_EQUIPMENT = Object.freeze([
  {
    "id": "liquid-card-042",
    "cardNumber": 42,
    "name": "28파이 Pet 충진기",
    "roomId": "pet",
    "room": "Pet실",
    "sourceRoom": "Pet실",
    "type": "filler",
    "variant": "pet-enclosed",
    "position": [
      -27.8,
      0,
      -8.1
    ],
    "rotation": 0,
    "width": 3,
    "depth": 2.6,
    "height": 2.6,
    "summary": "스테인리스 밀폐형 외함에 검은 세로 관찰창과 긴 양문 손잡이가 있다. 정면 창 3개, 좌우면 각 2개, 후면 4개가 보이며 옆으로 녹색 병 이송벨트가 연결된다.",
    "details": [
      "3팀 Pet실 이력카드 042의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-043",
    "cardNumber": 43,
    "name": "Pet실 1",
    "roomId": "pet",
    "room": "Pet실",
    "sourceRoom": "Pet실",
    "type": "tank",
    "variant": "pet-jacket",
    "position": [
      -33.1,
      0,
      -7.4
    ],
    "rotation": 0,
    "width": 1,
    "depth": 1,
    "height": 1.5,
    "summary": "낮은 스테인리스 원통 용기에 손잡이 달린 평평한 뚜껑이 있다. 옆 사각 조작함에는 두 줄의 버튼이 있고 하부 다리 사이로 검은 케이블이 굽어 지나간다.",
    "details": [
      "3팀 Pet실 이력카드 043의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 카드명 Pet실 1은 일반적인 명칭이지만 사진 주 대상은 작은 원통 용기다. 별도의 PET 전체 라인을 중복 생성할 근거가 아니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-044",
    "cardNumber": 44,
    "name": "Pet 라인",
    "roomId": "pet",
    "room": "Pet실",
    "sourceRoom": "Pet실",
    "type": "conveyor",
    "variant": "pet-line",
    "position": [
      -17,
      0,
      -6.5
    ],
    "rotation": 0,
    "width": 4,
    "depth": 2.4,
    "height": 1.9,
    "summary": "노즐과 호스가 노출된 병 충전부, 녹색 곡선 병 이송벨트, 흰 가이드판과 스테인리스 지지대가 보인다. 곡선 이송부 뒤로 다른 밀폐형 충전기 외함도 함께 찍혀 있다.",
    "details": [
      "3팀 Pet실 이력카드 044의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 배경의 밀폐형 외함은 042와 겹칠 수 있으므로 이 카드에 또 하나의 충전기 외함을 추가하지 않는다.",
      "사진 대조: 사진 한 장의 곡선을 전체 공장 이송경로의 실측 형상으로 해석하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-045",
    "cardNumber": 45,
    "name": "38파이 라벨러",
    "roomId": "outer",
    "room": "외포장실",
    "sourceRoom": "외포장실",
    "type": "cartoner",
    "variant": "labeler",
    "position": [
      17,
      0,
      7
    ],
    "rotation": 0,
    "width": 3.6,
    "depth": 2.3,
    "height": 2.2,
    "summary": "긴 병 이송벨트 옆에 흰 원판형 라벨 릴과 세로 축들이 배치돼 있다. 스테인리스 하부 몸체, 옆 조작 화면과 라벨을 안내하는 작은 롤러·가이드가 보인다.",
    "details": [
      "3팀 외포장실 이력카드 045의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-046",
    "cardNumber": 46,
    "name": "파스텔 라이저",
    "roomId": "pet",
    "room": "Pet실",
    "sourceRoom": "Pet실",
    "type": "pasteurizer",
    "variant": "pet-tunnel",
    "position": [
      -13.5,
      0,
      -10.2
    ],
    "rotation": 0,
    "width": 12,
    "depth": 3.4,
    "height": 2.1,
    "summary": "길고 낮은 사각 터널형 외함에 작은 관찰창들이 이어진다. 한쪽 아래에는 녹색 펌프와 회색 모터, 여러 수평 배관·밸브와 손잡이가 모여 있다.",
    "details": [
      "3팀 Pet실 이력카드 046의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 사진에서 보이는 외부 배관을 내부 열교환기 구조나 유체 흐름으로 단정하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-047",
    "cardNumber": 47,
    "name": "88파이 자동 충진기",
    "roomId": "pet",
    "room": "Pet실",
    "sourceRoom": "Pet실",
    "type": "filler",
    "variant": "pet-open",
    "position": [
      -26.8,
      0,
      -12.2
    ],
    "rotation": 0,
    "width": 1.6,
    "depth": 1.6,
    "height": 2.4,
    "summary": "상부가 넓은 스테인리스 원뿔형 공급통과 노출 충전부, 사각 받침 테이블이 보인다. 옆 기둥의 작은 조작부와 테이블 아래 펌프·호스가 주 실루엣을 이룬다.",
    "details": [
      "3팀 Pet실 이력카드 047의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 카드명의 88파이를 사진 속 노즐 수나 정확한 호퍼 지름으로 환산하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-048",
    "cardNumber": 48,
    "name": "HIPE 16 스틱 충진기-2",
    "roomId": "stick",
    "room": "스틱실",
    "sourceRoom": "스틱실",
    "type": "filler",
    "variant": "stick",
    "position": [
      -20,
      0,
      16.5
    ],
    "rotation": 0,
    "width": 2.3,
    "depth": 2.2,
    "height": 3,
    "summary": "높은 스테인리스 프레임 앞에 SP303·SOLPAC 표찰, 색이 다른 호스와 충전·실링 부품이 노출돼 있다. 앞쪽 별도 받침 테이블, 옆 버튼식 조작함, 상부 사각 공급함과 측면 판넬이 보인다.",
    "details": [
      "3팀 스틱실 이력카드 048의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 카드명 HIPE 16과 사진의 SP303·SOLPAC 표찰을 강제로 동일 모델명으로 확정하지 않는다.",
      "사진 대조: 카드명의 16만으로 사진 전면에 16개의 노즐 또는 충전열이 있다고 단정할 수 없다.",
      "사진 대조: 카드명 HIPE16과 사진 SP303/SOLPAC 표기가 함께 존재. 모델명 원본 필드는 공란이며 자동 통합하지 않음.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "unconfirmed-room",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-049",
    "cardNumber": 49,
    "name": "Hipe 16 스틱 충진기-1",
    "roomId": "stick",
    "room": "스틱실",
    "sourceRoom": "스틱실",
    "type": "filler",
    "variant": "stick",
    "position": [
      -15,
      0,
      16.5
    ],
    "rotation": 0,
    "width": 2.3,
    "depth": 2.2,
    "height": 3,
    "summary": "전면 투명 보호문에 SP303·SOLPAC 표찰이 있고 아래로 여러 출구가 내려온다. 후면에는 여러 가로 롤러와 낮은 위치의 인쇄 필름롤이 보이며 옆 작업 계단·상부 난간·조작함이 있다.",
    "details": [
      "3팀 스틱실 이력카드 049의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 카드명 Hipe 16과 사진 표찰을 강제로 동일 모델명으로 확정하지 않는다.",
      "사진 대조: 사진에서 가려진 충전열 수는 확인되지 않는다. 16열을 임의로 생성하지 않는다.",
      "사진 대조: 카드명 Hipe16과 사진 SP303/SOLPAC 표기가 함께 존재.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "unconfirmed-room",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-050",
    "cardNumber": 50,
    "name": "병뚜껑 조립기",
    "roomId": "pet",
    "room": "Pet실",
    "sourceRoom": "Pet실",
    "type": "conveyor",
    "variant": "cap-feeder",
    "position": [
      -32,
      0,
      -12.7
    ],
    "rotation": 0,
    "width": 1.3,
    "depth": 1.6,
    "height": 2.7,
    "summary": "높은 파란 승강 트랙이 스테인리스 세로 외함 안에 있고, 아래 사각 공급호퍼의 경사진 바닥이 낮은 파란 벨트로 이어진다. 상단 모터·배출 가이드와 바퀴 달린 사각 지지 프레임이 보인다.",
    "details": [
      "3팀 Pet실 이력카드 050의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-051",
    "cardNumber": 51,
    "name": "연수기",
    "roomId": "boiler",
    "room": "보일러실",
    "sourceRoom": "보일러실",
    "type": "softener",
    "variant": "resin-vessels",
    "position": [
      37,
      0,
      -18.4
    ],
    "rotation": 0,
    "width": 1.8,
    "depth": 1.2,
    "height": 2.2,
    "summary": "높은 파란 원통과 검은 하부 받침, 옆의 낮은 파란 통·검은 뚜껑이 보인다. 원통 위 조절부와 압력계, 가는 연결 배관·투명 튜브가 따로 드러난다.",
    "details": [
      "3팀 보일러실 이력카드 051의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 용기 내부 수지 종류·용량·운전 압력은 카드 사진만으로 확정하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "representative",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "unconfirmed-room",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-052",
    "cardNumber": 52,
    "name": "병 라인 중량 선별기",
    "roomId": "outer",
    "room": "외포장실",
    "sourceRoom": "외포장실",
    "type": "cartoner",
    "variant": "checkweigher",
    "position": [
      20.8,
      0,
      7
    ],
    "rotation": 0,
    "width": 2,
    "depth": 1.2,
    "height": 1.8,
    "summary": "짧은 녹색 계량벨트와 스테인리스 받침, 독립 기둥에 달린 조작 화면, 파란 출구 롤러가 보인다. 사진 뒤쪽에는 주황색 테이핑 장치도 함께 찍혀 있다.",
    "details": [
      "3팀 외포장실 이력카드 052의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 배경의 주황색 장치는 054의 대상과 중복될 수 있어 이 카드의 중량 선별기에 합쳐 만들지 않는다.",
      "사진 대조: 사진 뒤에 주황색 테이핑/제함형 기구가 포함된다. 다른 카드의 주대상을 이 카드에 중복 모델링하지 않음.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-053",
    "cardNumber": 53,
    "name": "카토너",
    "roomId": "outer",
    "room": "외포장실",
    "sourceRoom": "외포장실",
    "type": "cartoner",
    "variant": "cartoner",
    "position": [
      16.5,
      0,
      12
    ],
    "rotation": 0,
    "width": 4,
    "depth": 2.5,
    "height": 2.2,
    "summary": "길고 낮은 스테인리스 몸체 위에 투명 보호판과 세로 문틀이 이어진다. 옆으로 녹색 공급벨트가 들어오며 내부에는 상자 이송부와 여러 가로 기구가 보인다.",
    "details": [
      "3팀 외포장실 이력카드 053의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 투명문 뒤의 가려진 구동계 전체를 복원했다고 단정하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-054",
    "cardNumber": 54,
    "name": "3팀용 제함기 1호기",
    "roomId": "outer",
    "room": "외포장실",
    "sourceRoom": "외포장실",
    "type": "cartoner",
    "variant": "case-sealer",
    "position": [
      22,
      0,
      12
    ],
    "rotation": 0,
    "width": 2,
    "depth": 1.5,
    "height": 1.9,
    "summary": "개방된 사각 지지 프레임 위에 주황색 상부 헤드와 노란 테이프 롤이 있고 앞뒤 롤러 이송부가 이어진다. 투명 밀폐형 외함보다는 기둥·상부 테이핑부가 눈에 띈다.",
    "details": [
      "3팀 외포장실 이력카드 054의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 원문 카드명은 제함기 1호기지만 사진 외형은 상부 테이핑부가 있는 개방형 장치다. 명칭과 관찰 형태를 각각 보존한다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다.",
      "카드명은 제함기이지만 사진은 주황색 테이핑·시일 외형이므로 사진 형상으로 재현했습니다. 명칭 원문을 보존합니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-055",
    "cardNumber": 55,
    "name": "10입 자동 포장기",
    "roomId": "outer",
    "room": "외포장실",
    "sourceRoom": "외포장실",
    "type": "cartoner",
    "variant": "multipack",
    "position": [
      17.5,
      0,
      16
    ],
    "rotation": 0,
    "width": 4,
    "depth": 2.5,
    "height": 2.2,
    "summary": "스테인리스 하부 몸체와 여러 투명 보호문, 전면의 작은 버튼들이 보인다. 후면 필름롤과 상부 구동부, 옆 이송부가 일반 카토너와 다른 외형 단서다.",
    "details": [
      "3팀 외포장실 이력카드 055의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-056",
    "cardNumber": 56,
    "name": "파우치 후살균수조",
    "roomId": "retort",
    "room": "후살균실",
    "sourceRoom": "후살균실",
    "type": "pasteurizer",
    "variant": "pouch-hot",
    "position": [
      3,
      0,
      3.2
    ],
    "rotation": 0,
    "width": 12,
    "depth": 2.7,
    "height": 1.6,
    "summary": "길고 열린 스테인리스 수조 안에 메쉬 이송부가 있고 한쪽 끝에는 경사진 덮개가 있다. 파란 기어모터와 측면 배관·밸브, 분리된 지지발이 보인다.",
    "details": [
      "3팀 후살균실 이력카드 056의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 수조 내부의 가열 코일이나 온도는 사진만으로 확정하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-057",
    "cardNumber": 57,
    "name": "파우치 냉각수조",
    "roomId": "retort",
    "room": "후살균실",
    "sourceRoom": "후살균실",
    "type": "pasteurizer",
    "variant": "pouch-cool",
    "position": [
      3,
      0,
      9
    ],
    "rotation": 0,
    "width": 12,
    "depth": 2.7,
    "height": 1.6,
    "summary": "긴 개방형 스테인리스 수조에 메쉬 이송면과 위쪽의 긴 분사 헤더·작은 주황색 분사부들이 보인다. 끝단의 파란 구동부와 측면 배관이 있다.",
    "details": [
      "3팀 후살균실 이력카드 057의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-058",
    "cardNumber": 58,
    "name": "후살균기",
    "roomId": "retort",
    "room": "후살균실",
    "sourceRoom": "후살균실",
    "type": "pasteurizer",
    "variant": "pouch-tunnel",
    "position": [
      3,
      0,
      15
    ],
    "rotation": 0,
    "width": 7,
    "depth": 2.8,
    "height": 3.3,
    "summary": "높은 스테인리스 다구획 외함에 여러 문과 손잡이가 있고 상부에 둥근 관찰구가 이어진다. 아래에는 외부 배관·밸브·펌프, 옆에는 별도 제어함과 입출구 구간이 보인다.",
    "details": [
      "3팀 후살균실 이력카드 058의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 외함 안의 숨겨진 살균 경로나 내부 기구를 사진 근거로 확정하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-059",
    "cardNumber": 59,
    "name": "치어팩 언로더",
    "roomId": "pouch",
    "room": "파우치실",
    "sourceRoom": "파우치실",
    "type": "conveyor",
    "variant": "unloader",
    "position": [
      -6.2,
      0,
      6.7
    ],
    "rotation": 0,
    "width": 1.8,
    "depth": 1.5,
    "height": 1.8,
    "summary": "넓게 돌아가는 흰색 이송벨트와 스테인리스 가이드·지지발이 보인다. 곁의 노출 기구와 조작 기둥은 벨트와 별개로 서 있다.",
    "details": [
      "3팀 파우치실 이력카드 059의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 사진 속 인접 충전기와 언로더의 소유 범위가 겹칠 수 있으므로 주변 장비를 중복 추가하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-060",
    "cardNumber": 60,
    "name": "스틱 냉각기",
    "roomId": "stick",
    "room": "스틱실",
    "sourceRoom": "스틱실",
    "type": "conveyor",
    "variant": "stick-cooler",
    "position": [
      -8.1,
      0,
      16.5
    ],
    "rotation": 0,
    "width": 4,
    "depth": 2.4,
    "height": 1.8,
    "summary": "긴 스테인리스 수조형 몸체 위에 메쉬벨트와 여러 가이드관이 노출돼 있다. 측면 원형 클램프 점검문, 각도 있게 열린 끝단 덮개, 뒤쪽 세로 배관과 버튼 조작함이 보인다.",
    "details": [
      "3팀 스틱실 이력카드 060의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 사진의 경사진 부분은 끝단 덮개·배출판이다. 전체 벨트가 같은 경사로 올라간다고 단정하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "unconfirmed-room",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-061",
    "cardNumber": 61,
    "name": "파우치 충진기 3호기",
    "roomId": "pouch",
    "room": "파우치실",
    "sourceRoom": "파우치실",
    "type": "filler",
    "variant": "pouch",
    "position": [
      -20,
      0,
      3
    ],
    "rotation": 0.7853981633974483,
    "width": 3.6,
    "depth": 3.4,
    "height": 2.7,
    "summary": "스테인리스 개방 프레임 안에 충전·실링 기구와 여러 호스가 배치돼 있다. 한쪽 상부 공급통과 아래 배관, 옆 이송부와 조작부가 보인다.",
    "details": [
      "3팀 파우치실 이력카드 061의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 가려진 헤드 수와 내부 왕복 기구는 확정하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-062",
    "cardNumber": 62,
    "name": "파우치 충진기 2호기",
    "roomId": "pouch",
    "room": "파우치실",
    "sourceRoom": "파우치실",
    "type": "filler",
    "variant": "pouch",
    "position": [
      -14.7,
      0,
      3
    ],
    "rotation": 0.7853981633974483,
    "width": 3.6,
    "depth": 3.4,
    "height": 2.7,
    "summary": "스테인리스 보호 프레임과 노출 충전 기구 위로 작은 세로 공급통 두 개와 배관이 보인다. 옆 조작함, 하부 모터·호스와 이송부가 있다.",
    "details": [
      "3팀 파우치실 이력카드 062의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-063",
    "cardNumber": 63,
    "name": "파우치 충진기 1호기",
    "roomId": "pouch",
    "room": "파우치실",
    "sourceRoom": "파우치실",
    "type": "filler",
    "variant": "pouch",
    "position": [
      -9.4,
      0,
      3
    ],
    "rotation": 0.7853981633974483,
    "width": 3.6,
    "depth": 3.4,
    "height": 2.7,
    "summary": "파란 기둥과 노란 가장자리 띠, 투명 보호판으로 둘러싸인 충전 기구가 보인다. 내부의 호스·헤드와 옆의 짧은 이송벨트가 드러난다.",
    "details": [
      "3팀 파우치실 이력카드 063의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-064",
    "cardNumber": 64,
    "name": "치어팩 충진기 3호기",
    "roomId": "pouch",
    "room": "파우치실",
    "sourceRoom": "파우치실",
    "type": "filler",
    "variant": "cheer",
    "position": [
      -20,
      0,
      9
    ],
    "rotation": 0,
    "width": 3.6,
    "depth": 3.4,
    "height": 2.8,
    "summary": "투명 양문과 파란 가로띠, 하부 스테인리스 양문, 오른쪽 화면·표시등이 있는 충전기다. 옆 별도 원통 용기·모터와 빨간 보온 배관이 보이며 뒤에는 긴 사각 이송 프레임이 있다.",
    "details": [
      "3팀 파우치실 이력카드 064의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 공장 상부로 이어지는 빨간 배관을 기계의 구조 보로 해석하지 않는다.",
      "사진 대조: 옆 용기는 별도 카드와 겹칠 수 있어 기계에 임의로 중복 통합하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-065",
    "cardNumber": 65,
    "name": "치어팩 충진기 2호기",
    "roomId": "pouch",
    "room": "파우치실",
    "sourceRoom": "파우치실",
    "type": "filler",
    "variant": "cheer",
    "position": [
      -14.7,
      0,
      9
    ],
    "rotation": 0,
    "width": 3.6,
    "depth": 3.4,
    "height": 2.8,
    "summary": "주황색 전면 띠와 투명 보호판이 있는 충전기, 아래 사각 몸체와 옆 조작부가 보인다. 상부 빨간 보온 배관과 긴 측면 이송부가 함께 드러난다.",
    "details": [
      "3팀 파우치실 이력카드 065의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 빨간 상부 배관을 구조 프레임으로 바꾸지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-066",
    "cardNumber": 66,
    "name": "치어팩 충진기 1호기",
    "roomId": "pouch",
    "room": "파우치실",
    "sourceRoom": "파우치실",
    "type": "filler",
    "variant": "cheer",
    "position": [
      -9.4,
      0,
      9
    ],
    "rotation": 0,
    "width": 3.6,
    "depth": 3.4,
    "height": 2.8,
    "summary": "주황색 전면 띠가 있는 개방·투명 보호 프레임과 스테인리스 하부 몸체가 보인다. 옆으로 긴 녹색 이송라인이 이어지고 상부 빨간 보온 배관과 뒤쪽 조작부가 있다.",
    "details": [
      "3팀 파우치실 이력카드 066의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 촬영 배경의 긴 공장 이송라인 전체를 이 기계 한 대의 실측 외곽으로 삼지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-067",
    "cardNumber": 67,
    "name": "믹서탱크",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "mixer",
    "variant": "tall-top-drive",
    "position": [
      -32,
      0,
      -1.5
    ],
    "rotation": 0,
    "width": 2.4,
    "depth": 2.4,
    "height": 4.1,
    "summary": "스테인리스 둥근 탱크 위에 길고 높은 구동 기둥과 타공 금속 보호통이 솟아 있다. 평평한 분할 상부 뚜껑·보강대·손잡이, 뒤 조작함, 옆의 원형 연결구와 굽은 배관·하부 펌프가 보인다.",
    "details": [
      "3팀 배합실 이력카드 067의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 타공 보호통 내부의 축·교반날 형태는 사진만으로 확인되지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-068",
    "cardNumber": 68,
    "name": "배합탱크 10",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "mixer",
    "variant": "blue-top-drive",
    "position": [
      -28.2,
      0,
      -1.5
    ],
    "rotation": 0,
    "width": 2.4,
    "depth": 2.4,
    "height": 3.8,
    "summary": "낮고 넓은 둥근 상부에 여러 체결구가 있는 원형 맨홀과 작은 노즐들이 있다. 짙은 파란 모터가 위쪽에서 옆으로 놓이고, 굵은 상부 테두리와 옆 밸브·배관이 보인다.",
    "details": [
      "3팀 배합실 이력카드 068의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-069",
    "cardNumber": 69,
    "name": "배합탱크 7",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "mixer",
    "variant": "domestic-top-drive",
    "position": [
      -32,
      0,
      2
    ],
    "rotation": 0,
    "width": 2.4,
    "depth": 2.4,
    "height": 3.8,
    "summary": "볼록한 탱크 상부에 긴 세로 구동 기둥과 회녹색 세로 모터가 있다. 비스듬한 둥근 맨홀, 옆의 작은 모터·밸브와 검은 케이블이 보인다.",
    "details": [
      "3팀 배합실 이력카드 069의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-070",
    "cardNumber": 70,
    "name": "배합탱크 9",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "mixer",
    "variant": "blue-top-drive",
    "position": [
      -28.2,
      0,
      2
    ],
    "rotation": 0,
    "width": 2.4,
    "depth": 2.4,
    "height": 3.8,
    "summary": "스테인리스 탱크의 둥근 상부에 파란 가로축 모터와 감속부, 여러 노즐·손잡이와 배관이 있다. 옆에 뚜껑 달린 작은 원통 연결부도 보인다.",
    "details": [
      "3팀 배합실 이력카드 070의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-071",
    "cardNumber": 71,
    "name": "3번 탱크",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "mixer",
    "variant": "side-drive",
    "position": [
      -36.1,
      0,
      4.9
    ],
    "rotation": 0,
    "width": 2,
    "depth": 2,
    "height": 3.2,
    "summary": "볼록한 탱크 상부에서 높은 스테인리스 원통 목이 올라오고 그 옆에 가로축 검은 모터가 붙는다. 위쪽 큰 사각 덮개, 작은 측면 노즐과 외부 케이블·배관이 보인다.",
    "details": [
      "3팀 배합실 이력카드 071의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-077",
    "cardNumber": 77,
    "name": "4번 배합탱크",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "tank",
    "variant": "tall-process",
    "position": [
      -36.1,
      0,
      13.9
    ],
    "rotation": 0,
    "width": 1.7,
    "depth": 1.7,
    "height": 3.8,
    "summary": "큰 세로 스테인리스 원통의 아래쪽에 작은 원형 관찰구가 있고 바닥 둘레에는 여러 지지다리와 배출 배관이 있다. 한쪽에는 두꺼운 검은 유연관이 크게 돌아간다.",
    "details": [
      "3팀 배합실 이력카드 077의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 카드명 4번 배합탱크와 사진 속 번호 표찰이 일치하지 않는다. 원문 명칭을 유지하고 현재 호기를 재지정하지 않는다.",
      "사진 대조: 카드명 4번 배합탱크, 사진 전면 표찰 2번탱크. 별도 라인/과거 표찰 가능성 미해결.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다.",
      "카드는 4번 배합탱크이나 사진의 종이 표찰은 2번 탱크로 보입니다. 서로 다른 라인 여부는 확인되지 않아 도면 번호로 강제 치환하지 않았습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-078",
    "cardNumber": 78,
    "name": "3번 배합탱크",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "tank",
    "variant": "tall-process",
    "position": [
      -32.6,
      0,
      13.9
    ],
    "rotation": 0,
    "width": 1.7,
    "depth": 1.7,
    "height": 3.8,
    "summary": "높은 스테인리스 원통의 낮은 위치에 작은 원형 관찰구가 있고 아래에는 지지다리와 출구 배관이 있다. 옆면을 따라 굵은 검은 관이 내려간다.",
    "details": [
      "3팀 배합실 이력카드 078의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 카드명 3번 배합탱크와 사진 속 번호 표찰이 일치하지 않는다. 원문 명칭을 유지하고 현재 호기를 재지정하지 않는다.",
      "사진 대조: 카드명 3번 배합탱크, 사진 전면 표찰 1번탱크. 번호를 임의로 수정하지 않음.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다.",
      "카드는 3번 배합탱크이나 사진의 종이 표찰은 1번 탱크로 보입니다. 서로 다른 라인 여부는 확인되지 않아 도면 번호로 강제 치환하지 않았습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-079",
    "cardNumber": 79,
    "name": "2번 배합탱크",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "tank",
    "variant": "tall-process",
    "position": [
      -29.1,
      0,
      13.9
    ],
    "rotation": 0,
    "width": 1.7,
    "depth": 1.7,
    "height": 3.8,
    "summary": "높은 원통 몸체의 전면 아래쪽에 볼트가 둘러진 큰 둥근 맨홀이 있다. 옆으로 세로 배관과 휘어진 연결관, 하부 다리·배출부가 보인다.",
    "details": [
      "3팀 배합실 이력카드 079의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 사진 전면에 보이는 호기 표찰과 카드 이름을 확인 없이 새 번호로 바꾸지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-080",
    "cardNumber": 80,
    "name": "A라인 1-4",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "mixer",
    "variant": "a-line",
    "position": [
      -36.1,
      0,
      17.8
    ],
    "rotation": 0,
    "width": 1.8,
    "depth": 1.8,
    "height": 3.4,
    "summary": "원형 탱크 위에 평평하게 나뉜 뚜껑과 가로 보강대·손잡이가 있고 파란 세로 모터와 타공 보호 기둥이 올라온다. 옆면에는 짧은 배관과 밸브가 있다.",
    "details": [
      "3팀 배합실 이력카드 080의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-081",
    "cardNumber": 81,
    "name": "A라인 1-3",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "mixer",
    "variant": "a-line",
    "position": [
      -32.3,
      0,
      17.8
    ],
    "rotation": 0,
    "width": 1.8,
    "depth": 1.8,
    "height": 3.4,
    "summary": "볼록한 탱크 상부에 비스듬한 원형 맨홀과 파란 세로 모터·짧은 보호 목이 보인다. 옆으로 위생 배관·밸브와 검은 케이블이 이어진다.",
    "details": [
      "3팀 배합실 이력카드 081의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-082",
    "cardNumber": 82,
    "name": "A라인 1-2",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "mixer",
    "variant": "a-line",
    "position": [
      -28.5,
      0,
      17.8
    ],
    "rotation": 0,
    "width": 1.8,
    "depth": 1.8,
    "height": 3.4,
    "summary": "둥근 탱크 어깨에 비스듬한 원형 맨홀과 회녹색 세로 모터가 있다. 모터 아래 보호 목과 옆의 복잡한 위생 배관·밸브, 검은 케이블이 보인다.",
    "details": [
      "3팀 배합실 이력카드 082의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-083",
    "cardNumber": 83,
    "name": "A라인 1-1",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "mixer",
    "variant": "a-line",
    "position": [
      -24.7,
      0,
      17.8
    ],
    "rotation": 0,
    "width": 1.8,
    "depth": 1.8,
    "height": 3.4,
    "summary": "탱크 상부는 평평한 분할 원형 뚜껑과 가로 보강빔·볼트·손잡이로 이뤄져 보인다. 파란 세로 모터 아래 금속 보호 목과 옆 케이블·배관이 있다.",
    "details": [
      "3팀 배합실 이력카드 083의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-093",
    "cardNumber": 93,
    "name": "호모 믹서탱크",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "mixer",
    "variant": "side-drive",
    "position": [
      -32.3,
      0,
      6.3
    ],
    "rotation": 0,
    "width": 1.8,
    "depth": 1.8,
    "height": 2.8,
    "summary": "둥근 탱크 위에 높은 스테인리스 목과 위쪽 큰 사각 덮개가 있다. 한쪽에는 세로로 선 회색 모터·감속기, 앞에는 비스듬한 원형 맨홀과 주변 노즐·밸브가 보인다.",
    "details": [
      "3팀 배합실 이력카드 093의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 사진에서 노출된 구동부 외의 내부 교반날·축 구조는 확정하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-094",
    "cardNumber": 94,
    "name": "펄 진동채",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "sieve",
    "variant": "pearl-vibratory",
    "position": [
      -34.8,
      0,
      10.7
    ],
    "rotation": 0,
    "width": 1.2,
    "depth": 1.2,
    "height": 1.7,
    "summary": "여러 단으로 쌓인 스테인리스 원형 진동채와 둘레 클램프가 있다. 서로 다른 방향의 배출 슈트, 위 뚜껑의 짧은 유입관·투명 호스, 아래 짧은 받침이 보인다.",
    "details": [
      "3팀 배합실 이력카드 094의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 망의 눈 크기·내부 진동 구조나 처리능력은 사진만으로 확정하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-095",
    "cardNumber": 95,
    "name": "살균기 1호기",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "sterilizer",
    "variant": "tubular",
    "position": [
      -24.7,
      0,
      6
    ],
    "rotation": 1.5707963267948966,
    "width": 3.2,
    "depth": 1.4,
    "height": 2.2,
    "summary": "긴 수평 스테인리스 관들이 층층이 쌓인 프레임과 한쪽의 높은 조작함이 보인다. 반대쪽에는 여러 U자 연결관·밸브·게이지, 아래 펌프와 배관이 모여 있다.",
    "details": [
      "3팀 배합실 이력카드 095의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 원문 살균기 1호기와 사진의 HCPE·HTST 표찰 번호가 충돌한다. 원문 카드 번호와 관찰 표찰을 별도로 보존한다.",
      "사진 대조: 수평 관의 반복 개수와 유체 흐름을 사진에 가려진 범위까지 확정하지 않는다.",
      "사진 대조: 주 배관 표찰 액상살균기1호기와 제어함 HCPE-4 HTST살균기③ 표기가 함께 보인다. 제어함 표기만으로 카드 호기를 바꾸지 않음.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-096",
    "cardNumber": 96,
    "name": "살균기 2호기",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "sterilizer",
    "variant": "tubular-red",
    "position": [
      -24.7,
      0,
      10
    ],
    "rotation": 1.5707963267948966,
    "width": 3.2,
    "depth": 1.4,
    "height": 2.2,
    "summary": "수평 관 뭉치와 빨간 보온관, 아래 긴 원통·펌프가 사각 스키드에 모여 있다. 한쪽에는 세로 스테인리스 용기와 높은 조작함, 여러 밸브·배관이 보인다.",
    "details": [
      "3팀 배합실 이력카드 096의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 빨간 관은 보온 외관 관찰이며 내부 유체나 공정 순서를 사진만으로 확정하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-097",
    "cardNumber": 97,
    "name": "살균기 3호기",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "sterilizer",
    "variant": "tubular",
    "position": [
      -24.7,
      0,
      14
    ],
    "rotation": 1.5707963267948966,
    "width": 3.2,
    "depth": 1.4,
    "height": 2.2,
    "summary": "길게 쌓인 수평 관 뭉치 옆으로 큰 U자 연결관과 긴 세로 용기들이 보인다. 아래 작은 펌프·둥근 게이지·밸브와 사각 바닥 프레임이 있다.",
    "details": [
      "3팀 배합실 이력카드 097의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 가려진 관 개수와 세로 용기의 내부 기능·용량은 확정하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-098",
    "cardNumber": 98,
    "name": "펄 이송호퍼",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "hopper",
    "variant": "pearl-transfer",
    "position": [
      -29.6,
      0,
      7
    ],
    "rotation": 0,
    "width": 1.3,
    "depth": 1.3,
    "height": 2.3,
    "summary": "작은 세로 스테인리스 용기와 길게 뻗은 낮은 사각 이송부가 하나의 바닥 프레임에 붙어 있다. 낮은 이송부 위에는 여러 돌출 연결구와 밸브, 옆에는 검은 호스·전선이 보인다.",
    "details": [
      "3팀 배합실 이력카드 098의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 긴 이송부의 내부 기구를 오거·피스톤 등으로 확정하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-099",
    "cardNumber": 99,
    "name": "HCPE - 5 균질기",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "homogenizer",
    "variant": "hcpe-5",
    "position": [
      -27,
      0,
      8.1
    ],
    "rotation": 0,
    "width": 1.8,
    "depth": 1.2,
    "height": 1.7,
    "summary": "낮은 스테인리스 사각 몸체 앞에 여러 수평 돌출 헤드와 위쪽 압력계가 있다. 위를 돌아가는 흰 피복 호스, 측면 손잡이·하부 통풍구와 검은 케이블이 보인다.",
    "details": [
      "3팀 배합실 이력카드 099의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 내부 플런저·구동축·최대 압력은 카드 사진에서 확인되지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-100",
    "cardNumber": 100,
    "name": "B라인 열수탱크",
    "roomId": "mixing",
    "room": "배합실",
    "sourceRoom": "배합실",
    "type": "tank",
    "variant": "hot-water-box",
    "position": [
      -29,
      0,
      11
    ],
    "rotation": 0,
    "width": 2,
    "depth": 1.6,
    "height": 2,
    "summary": "높은 스테인리스 사각 탱크가 낮은 사각 받침 위에 서 있다. 옆에 둥근 온도계 모양의 계기, 세로 배관·밸브, 두꺼운 회색 엘보 배관과 하부 배출관이 보인다.",
    "details": [
      "3팀 배합실 이력카드 100의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 탱크 용량·가열 방식·계기 지시값은 사진만으로 확정하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-101",
    "cardNumber": 101,
    "name": "에어 콤프레셔",
    "roomId": "boiler",
    "room": "보일러실",
    "sourceRoom": "보일러실",
    "type": "compressor",
    "variant": "air-compressor",
    "position": [
      40.5,
      0,
      -18.3
    ],
    "rotation": 0,
    "width": 1.3,
    "depth": 1.2,
    "height": 2,
    "summary": "짙은 회색 세로 캐비닛의 전면에 청록색 가는 띠와 작은 화면·비상정지 버튼이 있다. 옆에는 큰 단문과 경첩·손잡이, 뒤쪽 위에는 넓은 검은 그릴과 연결선이 보인다.",
    "details": [
      "3팀 보일러실 이력카드 101의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 밀폐 캐비닛 안의 압축기 방식이나 내부 모터·배관은 사진만으로 확정하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "representative",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "unconfirmed-room",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-102",
    "cardNumber": 102,
    "name": "핫멜트",
    "roomId": "outer",
    "room": "외포장실",
    "sourceRoom": "외포장실",
    "type": "cartoner",
    "variant": "hotmelt",
    "position": [
      22,
      0,
      16
    ],
    "rotation": 0,
    "width": 0.9,
    "depth": 1,
    "height": 1.6,
    "summary": "회색 테두리를 두른 파란 모서리 둥근 사각 본체와 위의 작은 파란 공급함이 있다. 앞 조작판, 옆 통풍구, 뒤쪽 여러 호스 접속구·파란 호스가 드러난다.",
    "details": [
      "3팀 외포장실 이력카드 102의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-103",
    "cardNumber": 103,
    "name": "보일러 3호기",
    "roomId": "boiler",
    "room": "보일러실",
    "sourceRoom": "보일러실",
    "type": "boiler",
    "variant": "box",
    "position": [
      37.4,
      0,
      -15.8
    ],
    "rotation": 0,
    "width": 1.4,
    "depth": 1.8,
    "height": 2.6,
    "summary": "높은 스테인리스 사각 외함 앞쪽에 좁고 긴 짙은 제어부가 붙는다. 옆면 단문, 뒤쪽 아래의 파란 구동부와 노출 배관·밸브, 위쪽 굵은 연결부가 보인다.",
    "details": [
      "3팀 보일러실 이력카드 103의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 보일러 내부 화염·연소관·용량·압력은 사진 근거 없이 추가하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "representative",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "unconfirmed-room",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-104",
    "cardNumber": 104,
    "name": "보일러 1,2호기",
    "roomId": "boiler",
    "room": "보일러실",
    "sourceRoom": "보일러실",
    "type": "boiler",
    "variant": "vertical-single",
    "position": [
      40.8,
      0,
      -16
    ],
    "rotation": 0,
    "width": 2.4,
    "depth": 2.2,
    "height": 3.6,
    "summary": "밝은 세로 원통 몸체와 검은 상부, 앞의 좁고 높은 제어함이 보인다. 옆의 파란 구동부·굵은 엘보, 세로 수위관 모양 부품·게이지·바닥 배관이 있다.",
    "details": [
      "3팀 보일러실 이력카드 104의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 원문 카드명은 보일러 1,2호기지만 네 방향 사진은 한 몸체를 보여 준다. 독립된 두 장비라는 추가 근거 없이 두 대로 복제하지 않는다.",
      "사진 대조: 수위관의 내부 기능과 보일러 내부 구조는 사진만으로 확정하지 않는다.",
      "사진 대조: 보일러1,2호기라는 하나의 카드에 한 원통 보일러의 4면 사진이 있다. 실제 두 개체 독립사진/배치 확인 없이 2대로 복제하지 않음.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다.",
      "카드명은 보일러 1,2호기이나 네 방향 사진은 원통 보일러 한 대의 외관입니다. 이 카드 한 그룹을 유지하며 원문명만으로 보일러 두 대를 복제하지 않았습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "representative",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "unconfirmed-room",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-105",
    "cardNumber": 105,
    "name": "티칭 로봇",
    "roomId": "outer",
    "room": "외포장실",
    "sourceRoom": "외포장실",
    "type": "cartoner",
    "variant": "delta",
    "position": [
      24.9,
      0,
      7
    ],
    "rotation": 0,
    "width": 2.8,
    "depth": 2.4,
    "height": 3.5,
    "summary": "투명 보호 외함과 주황색 세로 기둥 안에 위쪽 흰 원형 구동체가 있다. 검은 3쌍의 병렬 링크가 아래 작은 말단으로 모이고 파란 유연관, 하부 흰 이송면·문 경첩이 보인다.",
    "details": [
      "3팀 외포장실 이력카드 105의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 6축 다관절 로봇으로 바꾸지 않는다. 내부 모터 사양·가반하중·운동범위는 확인되지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "historical-room-approximation",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "historical-room-approximation",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-106",
    "cardNumber": 106,
    "name": "제환기",
    "roomId": "pellet",
    "room": "제환실",
    "sourceRoom": "제환실",
    "type": "pellet",
    "variant": "pearl-former",
    "position": [
      7.1,
      0,
      -12
    ],
    "rotation": 0,
    "width": 1.5,
    "depth": 1.1,
    "height": 1.9,
    "summary": "두 높이로 나뉜 스테인리스 사각 몸체 위에 큰 사각 투입호퍼와 파란 세로 구동부가 있다. 높이가 다른 별도 조작함 두 개, 측면 통풍구·문·캐스터가 보인다.",
    "details": [
      "3팀 제환실 이력카드 106의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 가려진 내부 성형 롤러·칼날 구조와 생산능력은 확정하지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "representative",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "unconfirmed-room",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  },
  {
    "id": "liquid-card-107",
    "cardNumber": 107,
    "name": "반죽기",
    "roomId": "pellet",
    "room": "제환실",
    "sourceRoom": "제환실",
    "type": "kneader",
    "variant": "planetary-bowl",
    "position": [
      7.1,
      0,
      -8.5
    ],
    "rotation": 0,
    "width": 1.1,
    "depth": 1.3,
    "height": 1.8,
    "summary": "흰색 세로 몸체의 돌출된 상부 아래에 스테인리스 볼과 비스듬한 금속 덮개가 매달린다. 옆 단문·가로 통풍구·케이블, 넓은 받침과 둥근 조절발이 보인다.",
    "details": [
      "3팀 제환실 이력카드 107의 이름과 네 방향 실제 사진을 기준으로 외형을 구성했습니다.",
      "사진 대조: 상부의 흰 포장 비닐은 보관 상태일 수 있어 영구 기계 외형으로 확정하지 않는다.",
      "사진 대조: 볼 내부 교반날·기어박스 구성은 사진에서 확인되지 않는다.",
      "방 위치는 과거 배치도의 실명·설비 군과 대조한 근사입니다. 이 카드와 도면 기호의 개별 일대일 대응, 현재 위치·방향·치수는 확인되지 않았습니다.",
      "현재 설치·연결 상태나 가동률을 실시간 정보로 표시하지 않습니다. 가려진 내부와 배관 연결은 확정하지 않습니다."
    ],
    "confidence": "이력카드 실명·네 방향 사진 확인 · 방 단위 도면 대조 · 개별 위치·치수 근사",
    "positionMatch": "unconfirmed",
    "dimensionMatch": "photo-plan-proportion",
    "positionBasis": "representative",
    "positionConfidence": "unconfirmed",
    "sourceConfidence": {
      "identity": "direct-card",
      "appearance": "four-photo-panels",
      "room": "card-room",
      "roomGeometry": "unconfirmed-room",
      "equipmentPlanMatch": "unconfirmed",
      "currentPose": "unconfirmed",
      "dimensions": "approximate"
    },
    "appearanceReviewDate": "2026-11-10",
    "appearanceBasis": "individually-reviewed-four-direction-card-photos"
  }
]);
