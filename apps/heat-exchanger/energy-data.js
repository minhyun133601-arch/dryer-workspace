// Normalized source data. Refresh from the original workbook; keep missing values as null.
window.HeatEnergyData = Object.freeze({
  "source": {
    "filename": "KPI-전기-가스-월별-2024-2026 (1).xlsx",
    "sheets": [
      {
        "name": "필터 보기",
        "nonEmptyCells": 752,
        "formulaCount": 0
      },
      {
        "name": "원자료",
        "nonEmptyCells": 281,
        "formulaCount": 0
      },
      {
        "name": "팀별 원단위",
        "nonEmptyCells": 103,
        "formulaCount": 0
      },
      {
        "name": "전년 대비 비교",
        "nonEmptyCells": 127,
        "formulaCount": 88
      }
    ],
    "actualThroughYear": 2026,
    "actualThroughMonth": 9,
    "rawMonthCount": 36,
    "externalLinkCount": 0,
    "hiddenSheetCount": 0,
    "equipmentTeamId": "team-1-part-2",
    "equipmentTeamEvidence": {
      "filename": "열교환기 설치도.pptx",
      "path": "사업자료/2026-01-21 유산)건조기 열교환기(폐열회수 장치) 설치/첨부파일/열교환기 설치도.pptx",
      "slide": 2,
      "title": "유산) 생산1팀2파트 건조기 가스(LPG/LNG) 절감"
    },
    "energyScope": "팀별 총열량; 건조기 단독 계측값 아님",
    "gasScope": "원자료 전체 LNG·LPG 합계; 설비별·사업장별 배분 없음",
    "currency": "KRW",
    "energyUnit": "kJ",
    "productionUnit": "kg",
    "lngQuantityUnit": "m³",
    "lpgQuantityUnit": "kg"
  },
  "annual": {
    "2024": {
      "months": 12,
      "energyKj": 179781830505,
      "productionKg": 41110477.9,
      "kjPerKg": 4373.1389098009,
      "electricityKwh": 8838710,
      "electricityCost": 1495967804,
      "lngM3": 2007961,
      "lngCost": 1820967967,
      "lpgKg": 1244250,
      "lpgCost": 1218815497,
      "gasCost": 3039783464,
      "totalCost": 4535751268,
      "teams": [
        {
          "id": "team-1-part-1",
          "name": "1팀 1파트",
          "months": 12,
          "energyKj": 73320540345,
          "productionKg": 14464466,
          "kjPerKg": 5069.011213065176,
          "sourceCells": {
            "period": "'팀별 원단위'!A7",
            "name": "'팀별 원단위'!B7",
            "months": "'팀별 원단위'!C7",
            "energyKj": "'팀별 원단위'!D7",
            "productionKg": "'팀별 원단위'!E7",
            "kjPerKg": "'팀별 원단위'!F7"
          }
        },
        {
          "id": "team-1-part-2",
          "name": "1팀 2파트",
          "months": 12,
          "energyKj": 88546336335,
          "productionKg": 19368755.5,
          "kjPerKg": 4571.606902415594,
          "sourceCells": {
            "period": "'팀별 원단위'!A8",
            "name": "'팀별 원단위'!B8",
            "months": "'팀별 원단위'!C8",
            "energyKj": "'팀별 원단위'!D8",
            "productionKg": "'팀별 원단위'!E8",
            "kjPerKg": "'팀별 원단위'!F8"
          }
        },
        {
          "id": "team-2",
          "name": "2팀",
          "months": 12,
          "energyKj": 3617866800,
          "productionKg": 4293113.699999999,
          "kjPerKg": 842.7139490854856,
          "sourceCells": {
            "period": "'팀별 원단위'!A9",
            "name": "'팀별 원단위'!B9",
            "months": "'팀별 원단위'!C9",
            "energyKj": "'팀별 원단위'!D9",
            "productionKg": "'팀별 원단위'!E9",
            "kjPerKg": "'팀별 원단위'!F9"
          }
        },
        {
          "id": "team-3",
          "name": "3팀",
          "months": 12,
          "energyKj": 14297087025,
          "productionKg": 2984142.7000000007,
          "kjPerKg": 4791.019888224513,
          "sourceCells": {
            "period": "'팀별 원단위'!A10",
            "name": "'팀별 원단위'!B10",
            "months": "'팀별 원단위'!C10",
            "energyKj": "'팀별 원단위'!D10",
            "productionKg": "'팀별 원단위'!E10",
            "kjPerKg": "'팀별 원단위'!F10"
          }
        }
      ]
    },
    "2025": {
      "months": 12,
      "energyKj": 161366369360,
      "productionKg": 36357692.9,
      "kjPerKg": 4438.300576547309,
      "electricityKwh": 8145140,
      "electricityCost": 1524180180,
      "lngM3": 1895392,
      "lngCost": 1583686551,
      "lpgKg": 1022023,
      "lpgCost": 1000543186,
      "gasCost": 2584229737,
      "totalCost": 4108409917,
      "teams": [
        {
          "id": "team-1-part-1",
          "name": "1팀 1파트",
          "months": 12,
          "energyKj": 71242681995,
          "productionKg": 13395878,
          "kjPerKg": 5318.254017765764,
          "sourceCells": {
            "period": "'팀별 원단위'!A11",
            "name": "'팀별 원단위'!B11",
            "months": "'팀별 원단위'!C11",
            "energyKj": "'팀별 원단위'!D11",
            "productionKg": "'팀별 원단위'!E11",
            "kjPerKg": "'팀별 원단위'!F11"
          }
        },
        {
          "id": "team-1-part-2",
          "name": "1팀 2파트",
          "months": 12,
          "energyKj": 72327107570,
          "productionKg": 15397662.9,
          "kjPerKg": 4697.278284355738,
          "sourceCells": {
            "period": "'팀별 원단위'!A12",
            "name": "'팀별 원단위'!B12",
            "months": "'팀별 원단위'!C12",
            "energyKj": "'팀별 원단위'!D12",
            "productionKg": "'팀별 원단위'!E12",
            "kjPerKg": "'팀별 원단위'!F12"
          }
        },
        {
          "id": "team-2",
          "name": "2팀",
          "months": 12,
          "energyKj": 2907072000,
          "productionKg": 4307029,
          "kjPerKg": 674.9599317766376,
          "sourceCells": {
            "period": "'팀별 원단위'!A13",
            "name": "'팀별 원단위'!B13",
            "months": "'팀별 원단위'!C13",
            "energyKj": "'팀별 원단위'!D13",
            "productionKg": "'팀별 원단위'!E13",
            "kjPerKg": "'팀별 원단위'!F13"
          }
        },
        {
          "id": "team-3",
          "name": "3팀",
          "months": 12,
          "energyKj": 14889507795,
          "productionKg": 3257123,
          "kjPerKg": 4571.367981804801,
          "sourceCells": {
            "period": "'팀별 원단위'!A14",
            "name": "'팀별 원단위'!B14",
            "months": "'팀별 원단위'!C14",
            "energyKj": "'팀별 원단위'!D14",
            "productionKg": "'팀별 원단위'!E14",
            "kjPerKg": "'팀별 원단위'!F14"
          }
        }
      ]
    },
    "2026": {
      "months": 9,
      "energyKj": 119305146772.79999,
      "productionKg": 26301288.099999998,
      "kjPerKg": 4536.095202607206,
      "electricityKwh": 6584744.998,
      "electricityCost": 1280126614,
      "lngM3": 1404316,
      "lngCost": 1242044449,
      "lpgKg": 712575,
      "lpgCost": 734575019,
      "gasCost": 1976619468,
      "totalCost": 3256746082,
      "teams": [
        {
          "id": "team-1-part-1",
          "name": "1팀 1파트",
          "months": 9,
          "energyKj": 52860610035,
          "productionKg": 9959633,
          "kjPerKg": 5307.485731150937,
          "sourceCells": {
            "period": "'팀별 원단위'!A15",
            "name": "'팀별 원단위'!B15",
            "months": "'팀별 원단위'!C15",
            "energyKj": "'팀별 원단위'!D15",
            "productionKg": "'팀별 원단위'!E15",
            "kjPerKg": "'팀별 원단위'!F15"
          }
        },
        {
          "id": "team-1-part-2",
          "name": "1팀 2파트",
          "months": 9,
          "energyKj": 49432307995.79999,
          "productionKg": 10459934,
          "kjPerKg": 4725.871883684925,
          "sourceCells": {
            "period": "'팀별 원단위'!A16",
            "name": "'팀별 원단위'!B16",
            "months": "'팀별 원단위'!C16",
            "energyKj": "'팀별 원단위'!D16",
            "productionKg": "'팀별 원단위'!E16",
            "kjPerKg": "'팀별 원단위'!F16"
          }
        },
        {
          "id": "team-2",
          "name": "2팀",
          "months": 9,
          "energyKj": 4962511152,
          "productionKg": 3239110.6999999993,
          "kjPerKg": 1532.0597570191105,
          "sourceCells": {
            "period": "'팀별 원단위'!A17",
            "name": "'팀별 원단위'!B17",
            "months": "'팀별 원단위'!C17",
            "energyKj": "'팀별 원단위'!D17",
            "productionKg": "'팀별 원단위'!E17",
            "kjPerKg": "'팀별 원단위'!F17"
          }
        },
        {
          "id": "team-3",
          "name": "3팀",
          "months": 9,
          "energyKj": 12049717590,
          "productionKg": 2642610.4,
          "kjPerKg": 4559.778312383846,
          "sourceCells": {
            "period": "'팀별 원단위'!A18",
            "name": "'팀별 원단위'!B18",
            "months": "'팀별 원단위'!C18",
            "energyKj": "'팀별 원단위'!D18",
            "productionKg": "'팀별 원단위'!E18",
            "kjPerKg": "'팀별 원단위'!F18"
          }
        }
      ]
    }
  },
  "monthly": [
    {
      "year": 2024,
      "month": 1,
      "electricityKwh": 743235,
      "electricityCost": 132330441,
      "lngM3": 210744,
      "lngCost": 209328224,
      "lpgKg": 126322,
      "lpgCost": 121269120,
      "gasCost": 330597344,
      "totalCost": 462927785,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B2",
        "electricityCost": "'원자료'!C2",
        "lngM3": "'원자료'!D2",
        "lngCost": "'원자료'!E2",
        "lpgKg": "'원자료'!F2",
        "lpgCost": "'원자료'!G2",
        "month": "'원자료'!A2",
        "gasCost": "'원자료'!H2"
      }
    },
    {
      "year": 2024,
      "month": 2,
      "electricityKwh": 633155,
      "electricityCost": 116459151,
      "lngM3": 158001,
      "lngCost": 144147387,
      "lpgKg": 83794,
      "lpgCost": 80442240,
      "gasCost": 224589627,
      "totalCost": 341048778,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B3",
        "electricityCost": "'원자료'!C3",
        "lngM3": "'원자료'!D3",
        "lngCost": "'원자료'!E3",
        "lpgKg": "'원자료'!F3",
        "lpgCost": "'원자료'!G3",
        "month": "'원자료'!A3",
        "gasCost": "'원자료'!H3"
      }
    },
    {
      "year": 2024,
      "month": 3,
      "electricityKwh": 683939,
      "electricityCost": 103999756,
      "lngM3": 175458,
      "lngCost": 164362589,
      "lpgKg": 115880,
      "lpgCost": 111244800,
      "gasCost": 275607389,
      "totalCost": 379607145,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B4",
        "electricityCost": "'원자료'!C4",
        "lngM3": "'원자료'!D4",
        "lngCost": "'원자료'!E4",
        "lpgKg": "'원자료'!F4",
        "lpgCost": "'원자료'!G4",
        "month": "'원자료'!A4",
        "gasCost": "'원자료'!H4"
      }
    },
    {
      "year": 2024,
      "month": 4,
      "electricityKwh": 734327,
      "electricityCost": 109292959,
      "lngM3": 167504,
      "lngCost": 140038103,
      "lpgKg": 130412,
      "lpgCost": 125195520,
      "gasCost": 265233623,
      "totalCost": 374526582,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B5",
        "electricityCost": "'원자료'!C5",
        "lngM3": "'원자료'!D5",
        "lngCost": "'원자료'!E5",
        "lpgKg": "'원자료'!F5",
        "lpgCost": "'원자료'!G5",
        "month": "'원자료'!A5",
        "gasCost": "'원자료'!H5"
      }
    },
    {
      "year": 2024,
      "month": 5,
      "electricityKwh": 816048,
      "electricityCost": 119011713,
      "lngM3": 194015,
      "lngCost": 169675460,
      "lpgKg": 130114,
      "lpgCost": 124909440,
      "gasCost": 294584900,
      "totalCost": 413596613,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B6",
        "electricityCost": "'원자료'!C6",
        "lngM3": "'원자료'!D6",
        "lngCost": "'원자료'!E6",
        "lpgKg": "'원자료'!F6",
        "lpgCost": "'원자료'!G6",
        "month": "'원자료'!A6",
        "gasCost": "'원자료'!H6"
      }
    },
    {
      "year": 2024,
      "month": 6,
      "electricityKwh": 830642,
      "electricityCost": 138269365,
      "lngM3": 166198,
      "lngCost": 140472451,
      "lpgKg": 116155,
      "lpgCost": 111508800,
      "gasCost": 251981251,
      "totalCost": 390250616,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B7",
        "electricityCost": "'원자료'!C7",
        "lngM3": "'원자료'!D7",
        "lngCost": "'원자료'!E7",
        "lpgKg": "'원자료'!F7",
        "lpgCost": "'원자료'!G7",
        "month": "'원자료'!A7",
        "gasCost": "'원자료'!H7"
      }
    },
    {
      "year": 2024,
      "month": 7,
      "electricityKwh": 793836,
      "electricityCost": 143578047,
      "lngM3": 144178,
      "lngCost": 125707372,
      "lpgKg": 99673,
      "lpgCost": 95686080,
      "gasCost": 221393452,
      "totalCost": 364971499,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B8",
        "electricityCost": "'원자료'!C8",
        "lngM3": "'원자료'!D8",
        "lngCost": "'원자료'!E8",
        "lpgKg": "'원자료'!F8",
        "lpgCost": "'원자료'!G8",
        "month": "'원자료'!A8",
        "gasCost": "'원자료'!H8"
      }
    },
    {
      "year": 2024,
      "month": 8,
      "electricityKwh": 722993,
      "electricityCost": 131290113,
      "lngM3": 133431,
      "lngCost": 122267757,
      "lpgKg": 76012,
      "lpgCost": 77152180,
      "gasCost": 199419937,
      "totalCost": 330710050,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B9",
        "electricityCost": "'원자료'!C9",
        "lngM3": "'원자료'!D9",
        "lngCost": "'원자료'!E9",
        "lpgKg": "'원자료'!F9",
        "lpgCost": "'원자료'!G9",
        "month": "'원자료'!A9",
        "gasCost": "'원자료'!H9"
      }
    },
    {
      "year": 2024,
      "month": 9,
      "electricityKwh": 648564,
      "electricityCost": 104476627,
      "lngM3": 102881,
      "lngCost": 95471708,
      "lpgKg": 50910,
      "lpgCost": 51673650,
      "gasCost": 147145358,
      "totalCost": 251621985,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B10",
        "electricityCost": "'원자료'!C10",
        "lngM3": "'원자료'!D10",
        "lngCost": "'원자료'!E10",
        "lpgKg": "'원자료'!F10",
        "lpgCost": "'원자료'!G10",
        "month": "'원자료'!A10",
        "gasCost": "'원자료'!H10"
      }
    },
    {
      "year": 2024,
      "month": 10,
      "electricityKwh": 723420,
      "electricityCost": 110368822,
      "lngM3": 181161,
      "lngCost": 163678011,
      "lpgKg": 95184,
      "lpgCost": 95088816,
      "gasCost": 258766827,
      "totalCost": 369135649,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B11",
        "electricityCost": "'원자료'!C11",
        "lngM3": "'원자료'!D11",
        "lngCost": "'원자료'!E11",
        "lpgKg": "'원자료'!F11",
        "lpgCost": "'원자료'!G11",
        "month": "'원자료'!A11",
        "gasCost": "'원자료'!H11"
      }
    },
    {
      "year": 2024,
      "month": 11,
      "electricityKwh": 757290,
      "electricityCost": 142103836,
      "lngM3": 177218,
      "lngCost": 159604071,
      "lpgKg": 107113,
      "lpgCost": 107005887,
      "gasCost": 266609958,
      "totalCost": 408713794,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B12",
        "electricityCost": "'원자료'!C12",
        "lngM3": "'원자료'!D12",
        "lngCost": "'원자료'!E12",
        "lpgKg": "'원자료'!F12",
        "lpgCost": "'원자료'!G12",
        "month": "'원자료'!A12",
        "gasCost": "'원자료'!H12"
      }
    },
    {
      "year": 2024,
      "month": 12,
      "electricityKwh": 751261,
      "electricityCost": 144786974,
      "lngM3": 197172,
      "lngCost": 186214834,
      "lpgKg": 112681,
      "lpgCost": 117638964,
      "gasCost": 303853798,
      "totalCost": 448640772,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B13",
        "electricityCost": "'원자료'!C13",
        "lngM3": "'원자료'!D13",
        "lngCost": "'원자료'!E13",
        "lpgKg": "'원자료'!F13",
        "lpgCost": "'원자료'!G13",
        "month": "'원자료'!A13",
        "gasCost": "'원자료'!H13"
      }
    },
    {
      "year": 2025,
      "month": 1,
      "electricityKwh": 656040,
      "electricityCost": 128251811,
      "lngM3": 158576,
      "lngCost": 146643631,
      "lpgKg": 81753,
      "lpgCost": 85350132,
      "gasCost": 231993763,
      "totalCost": 360245574,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B14",
        "electricityCost": "'원자료'!C14",
        "lngM3": "'원자료'!D14",
        "lngCost": "'원자료'!E14",
        "lpgKg": "'원자료'!F14",
        "lpgCost": "'원자료'!G14",
        "month": "'원자료'!A14",
        "gasCost": "'원자료'!H14"
      }
    },
    {
      "year": 2025,
      "month": 2,
      "electricityKwh": 645587,
      "electricityCost": 129799492,
      "lngM3": 173543,
      "lngCost": 158069817,
      "lpgKg": 92762,
      "lpgCost": 96843528,
      "gasCost": 254913345,
      "totalCost": 384712837,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B15",
        "electricityCost": "'원자료'!C15",
        "lngM3": "'원자료'!D15",
        "lngCost": "'원자료'!E15",
        "lpgKg": "'원자료'!F15",
        "lpgCost": "'원자료'!G15",
        "month": "'원자료'!A15",
        "gasCost": "'원자료'!H15"
      }
    },
    {
      "year": 2025,
      "month": 3,
      "electricityKwh": 683494,
      "electricityCost": 117239381,
      "lngM3": 166073,
      "lngCost": 147233434,
      "lpgKg": 91686,
      "lpgCost": 95720184,
      "gasCost": 242953618,
      "totalCost": 360192999,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B16",
        "electricityCost": "'원자료'!C16",
        "lngM3": "'원자료'!D16",
        "lngCost": "'원자료'!E16",
        "lpgKg": "'원자료'!F16",
        "lpgCost": "'원자료'!G16",
        "month": "'원자료'!A16",
        "gasCost": "'원자료'!H16"
      }
    },
    {
      "year": 2025,
      "month": 4,
      "electricityKwh": 725958,
      "electricityCost": 122722753,
      "lngM3": 167494,
      "lngCost": 154924292,
      "lpgKg": 89941,
      "lpgCost": 93898404,
      "gasCost": 248822696,
      "totalCost": 371545449,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B17",
        "electricityCost": "'원자료'!C17",
        "lngM3": "'원자료'!D17",
        "lngCost": "'원자료'!E17",
        "lpgKg": "'원자료'!F17",
        "lpgCost": "'원자료'!G17",
        "month": "'원자료'!A17",
        "gasCost": "'원자료'!H17"
      }
    },
    {
      "year": 2025,
      "month": 5,
      "electricityKwh": 607401,
      "electricityCost": 103648913,
      "lngM3": 125043,
      "lngCost": 107334728,
      "lpgKg": 62287,
      "lpgCost": 65027628,
      "gasCost": 172362356,
      "totalCost": 276011269,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B18",
        "electricityCost": "'원자료'!C18",
        "lngM3": "'원자료'!D18",
        "lngCost": "'원자료'!E18",
        "lpgKg": "'원자료'!F18",
        "lpgCost": "'원자료'!G18",
        "month": "'원자료'!A18",
        "gasCost": "'원자료'!H18"
      }
    },
    {
      "year": 2025,
      "month": 6,
      "electricityKwh": 643492,
      "electricityCost": 127053369,
      "lngM3": 135681,
      "lngCost": 113082983,
      "lpgKg": 70193,
      "lpgCost": 71365223,
      "gasCost": 184448206,
      "totalCost": 311501575,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B19",
        "electricityCost": "'원자료'!C19",
        "lngM3": "'원자료'!D19",
        "lngCost": "'원자료'!E19",
        "lpgKg": "'원자료'!F19",
        "lpgCost": "'원자료'!G19",
        "month": "'원자료'!A19",
        "gasCost": "'원자료'!H19"
      }
    },
    {
      "year": 2025,
      "month": 7,
      "electricityKwh": 717304,
      "electricityCost": 141976825,
      "lngM3": 134220,
      "lngCost": 106719564,
      "lpgKg": 67905,
      "lpgCost": 63946139,
      "gasCost": 170665703,
      "totalCost": 312642528,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B20",
        "electricityCost": "'원자료'!C20",
        "lngM3": "'원자료'!D20",
        "lngCost": "'원자료'!E20",
        "lpgKg": "'원자료'!F20",
        "lpgCost": "'원자료'!G20",
        "month": "'원자료'!A20",
        "gasCost": "'원자료'!H20"
      }
    },
    {
      "year": 2025,
      "month": 8,
      "electricityKwh": 676466,
      "electricityCost": 140932590,
      "lngM3": 141279,
      "lngCost": 111188929,
      "lpgKg": 72678,
      "lpgCost": 68440873,
      "gasCost": 179629802,
      "totalCost": 320562392,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B21",
        "electricityCost": "'원자료'!C21",
        "lngM3": "'원자료'!D21",
        "lngCost": "'원자료'!E21",
        "lpgKg": "'원자료'!F21",
        "lpgCost": "'원자료'!G21",
        "month": "'원자료'!A21",
        "gasCost": "'원자료'!H21"
      }
    },
    {
      "year": 2025,
      "month": 9,
      "electricityKwh": 796742,
      "electricityCost": 137446513,
      "lngM3": 174353,
      "lngCost": 144937703,
      "lpgKg": 98751,
      "lpgCost": 89763785,
      "gasCost": 234701488,
      "totalCost": 372148001,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B22",
        "electricityCost": "'원자료'!C22",
        "lngM3": "'원자료'!D22",
        "lngCost": "'원자료'!E22",
        "lpgKg": "'원자료'!F22",
        "lpgCost": "'원자료'!G22",
        "month": "'원자료'!A22",
        "gasCost": "'원자료'!H22"
      }
    },
    {
      "year": 2025,
      "month": 10,
      "electricityKwh": 583850,
      "electricityCost": 100751316,
      "lngM3": 128179,
      "lngCost": 101004829,
      "lpgKg": 79586,
      "lpgCost": 77047150,
      "gasCost": 178051979,
      "totalCost": 278803295,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B23",
        "electricityCost": "'원자료'!C23",
        "lngM3": "'원자료'!D23",
        "lngCost": "'원자료'!E23",
        "lpgKg": "'원자료'!F23",
        "lpgCost": "'원자료'!G23",
        "month": "'원자료'!A23",
        "gasCost": "'원자료'!H23"
      }
    },
    {
      "year": 2025,
      "month": 11,
      "electricityKwh": 664458,
      "electricityCost": 129075095,
      "lngM3": 174639,
      "lngCost": 129566719,
      "lpgKg": 91368,
      "lpgCost": 82276884,
      "gasCost": 211843603,
      "totalCost": 340918698,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B24",
        "electricityCost": "'원자료'!C24",
        "lngM3": "'원자료'!D24",
        "lngCost": "'원자료'!E24",
        "lpgKg": "'원자료'!F24",
        "lpgCost": "'원자료'!G24",
        "month": "'원자료'!A24",
        "gasCost": "'원자료'!H24"
      }
    },
    {
      "year": 2025,
      "month": 12,
      "electricityKwh": 744348,
      "electricityCost": 145282122,
      "lngM3": 216312,
      "lngCost": 162979922,
      "lpgKg": 123113,
      "lpgCost": 110863256,
      "gasCost": 273843178,
      "totalCost": 419125300,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B25",
        "electricityCost": "'원자료'!C25",
        "lngM3": "'원자료'!D25",
        "lngCost": "'원자료'!E25",
        "lpgKg": "'원자료'!F25",
        "lpgCost": "'원자료'!G25",
        "month": "'원자료'!A25",
        "gasCost": "'원자료'!H25"
      }
    },
    {
      "year": 2026,
      "month": 1,
      "electricityKwh": 778168,
      "electricityCost": 150033113,
      "lngM3": 220863,
      "lngCost": 170303536,
      "lpgKg": 125407,
      "lpgCost": 114183074,
      "gasCost": 284486610,
      "totalCost": 434519723,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B26",
        "electricityCost": "'원자료'!C26",
        "lngM3": "'원자료'!D26",
        "lngCost": "'원자료'!E26",
        "lpgKg": "'원자료'!F26",
        "lpgCost": "'원자료'!G26",
        "month": "'원자료'!A26",
        "gasCost": "'원자료'!H26"
      }
    },
    {
      "year": 2026,
      "month": 2,
      "electricityKwh": 578456,
      "electricityCost": 115252823,
      "lngM3": 161499,
      "lngCost": 127198642,
      "lpgKg": 97629,
      "lpgCost": 88891205,
      "gasCost": 216089847,
      "totalCost": 331342670,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B27",
        "electricityCost": "'원자료'!C27",
        "lngM3": "'원자료'!D27",
        "lngCost": "'원자료'!E27",
        "lpgKg": "'원자료'!F27",
        "lpgCost": "'원자료'!G27",
        "month": "'원자료'!A27",
        "gasCost": "'원자료'!H27"
      }
    },
    {
      "year": 2026,
      "month": 3,
      "electricityKwh": 651113,
      "electricityCost": 110436464,
      "lngM3": 178230,
      "lngCost": 136647574,
      "lpgKg": 95532,
      "lpgCost": 87889440,
      "gasCost": 224537014,
      "totalCost": 334973478,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B28",
        "electricityCost": "'원자료'!C28",
        "lngM3": "'원자료'!D28",
        "lngCost": "'원자료'!E28",
        "lpgKg": "'원자료'!F28",
        "lpgCost": "'원자료'!G28",
        "month": "'원자료'!A28",
        "gasCost": "'원자료'!H28"
      }
    },
    {
      "year": 2026,
      "month": 4,
      "electricityKwh": 553302.951,
      "electricityCost": 103748921,
      "lngM3": 160777,
      "lngCost": 127046953,
      "lpgKg": 65013,
      "lpgCost": 61112220,
      "gasCost": 188159173,
      "totalCost": 291908094,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B29",
        "electricityCost": "'원자료'!C29",
        "lngM3": "'원자료'!D29",
        "lngCost": "'원자료'!E29",
        "lpgKg": "'원자료'!F29",
        "lpgCost": "'원자료'!G29",
        "month": "'원자료'!A29",
        "gasCost": "'원자료'!H29"
      }
    },
    {
      "year": 2026,
      "month": 5,
      "electricityKwh": 531018.665,
      "electricityCost": 97465491,
      "lngM3": 129084,
      "lngCost": 111794843,
      "lpgKg": 66833,
      "lpgCost": 70114500,
      "gasCost": 181909343,
      "totalCost": 279374834,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B30",
        "electricityCost": "'원자료'!C30",
        "lngM3": "'원자료'!D30",
        "lngCost": "'원자료'!E30",
        "lpgKg": "'원자료'!F30",
        "lpgCost": "'원자료'!G30",
        "month": "'원자료'!A30",
        "gasCost": "'원자료'!H30"
      }
    },
    {
      "year": 2026,
      "month": 6,
      "electricityKwh": 710016.917,
      "electricityCost": 150175458,
      "lngM3": 154466,
      "lngCost": 146202249,
      "lpgKg": 77512,
      "lpgCost": 86247602,
      "gasCost": 232449851,
      "totalCost": 382625309,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B31",
        "electricityCost": "'원자료'!C31",
        "lngM3": "'원자료'!D31",
        "lngCost": "'원자료'!E31",
        "lpgKg": "'원자료'!F31",
        "lpgCost": "'원자료'!G31",
        "month": "'원자료'!A31",
        "gasCost": "'원자료'!H31"
      }
    },
    {
      "year": 2026,
      "month": 7,
      "electricityKwh": 714005.822,
      "electricityCost": 151946963,
      "lngM3": 141711,
      "lngCost": 137110713,
      "lpgKg": 57292,
      "lpgCost": 66304032,
      "gasCost": 203414745,
      "totalCost": 355361708,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B32",
        "electricityCost": "'원자료'!C32",
        "lngM3": "'원자료'!D32",
        "lngCost": "'원자료'!E32",
        "lpgKg": "'원자료'!F32",
        "lpgCost": "'원자료'!G32",
        "month": "'원자료'!A32",
        "gasCost": "'원자료'!H32"
      }
    },
    {
      "year": 2026,
      "month": 8,
      "electricityKwh": 602323.2220000001,
      "electricityCost": 128574972,
      "lngM3": 110573,
      "lngCost": 118449071,
      "lpgKg": 60565,
      "lpgCost": 73671266,
      "gasCost": 192120337,
      "totalCost": 320695309,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B33",
        "electricityCost": "'원자료'!C33",
        "lngM3": "'원자료'!D33",
        "lngCost": "'원자료'!E33",
        "lpgKg": "'원자료'!F33",
        "lpgCost": "'원자료'!G33",
        "month": "'원자료'!A33",
        "gasCost": "'원자료'!H33"
      }
    },
    {
      "year": 2026,
      "month": 9,
      "electricityKwh": 1466340.421,
      "electricityCost": 272492409,
      "lngM3": 147113,
      "lngCost": 167290868,
      "lpgKg": 66792,
      "lpgCost": 86161680,
      "gasCost": 253452548,
      "totalCost": 525944957,
      "complete": true,
      "sourceCells": {
        "electricityKwh": "'원자료'!B34",
        "electricityCost": "'원자료'!C34",
        "lngM3": "'원자료'!D34",
        "lngCost": "'원자료'!E34",
        "lpgKg": "'원자료'!F34",
        "lpgCost": "'원자료'!G34",
        "month": "'원자료'!A34",
        "gasCost": "'원자료'!H34"
      }
    },
    {
      "year": 2026,
      "month": 10,
      "electricityKwh": 1207063.170999,
      "electricityCost": 0,
      "lngM3": 46113,
      "lngCost": null,
      "lpgKg": 96654,
      "lpgCost": null,
      "gasCost": null,
      "totalCost": null,
      "complete": false,
      "sourceCells": {
        "electricityKwh": "'원자료'!B35",
        "electricityCost": "'원자료'!C35",
        "lngM3": "'원자료'!D35",
        "lngCost": "'원자료'!E35",
        "lpgKg": "'원자료'!F35",
        "lpgCost": "'원자료'!G35",
        "month": "'원자료'!A35",
        "gasCost": "'원자료'!H35"
      }
    },
    {
      "year": 2026,
      "month": 11,
      "electricityKwh": 21155.306001,
      "electricityCost": 0,
      "lngM3": null,
      "lngCost": null,
      "lpgKg": null,
      "lpgCost": null,
      "gasCost": null,
      "totalCost": null,
      "complete": false,
      "sourceCells": {
        "electricityKwh": "'원자료'!B36",
        "electricityCost": "'원자료'!C36",
        "lngM3": "'원자료'!D36",
        "lngCost": "'원자료'!E36",
        "lpgKg": "'원자료'!F36",
        "lpgCost": "'원자료'!G36",
        "month": "'원자료'!A36",
        "gasCost": "'원자료'!H36"
      }
    },
    {
      "year": 2026,
      "month": 12,
      "electricityKwh": null,
      "electricityCost": null,
      "lngM3": null,
      "lngCost": null,
      "lpgKg": null,
      "lpgCost": null,
      "gasCost": null,
      "totalCost": null,
      "complete": false,
      "sourceCells": {
        "electricityKwh": "'원자료'!B37",
        "electricityCost": "'원자료'!C37",
        "lngM3": "'원자료'!D37",
        "lngCost": "'원자료'!E37",
        "lpgKg": "'원자료'!F37",
        "lpgCost": "'원자료'!G37",
        "month": "'원자료'!A37",
        "gasCost": "'원자료'!H37"
      }
    }
  ],
  "comparison": {
    "costPeriod": "1~9월",
    "cost2025": {
      "electricityCost": 1149071647,
      "lngCost": 1190135081,
      "lpgCost": 730355896,
      "totalCost": 3069562624,
      "sourceCells": {
        "electricityCost": "'전년 대비 비교'!C11",
        "lngCost": "'전년 대비 비교'!C12",
        "lpgCost": "'전년 대비 비교'!C13",
        "gasCost": "'전년 대비 비교'!C14",
        "totalCost": "'전년 대비 비교'!C15"
      }
    },
    "cost2026": {
      "electricityCost": 1280126614,
      "lngCost": 1242044449,
      "lpgCost": 734575019,
      "totalCost": 3256746082,
      "sourceCells": {
        "electricityCost": "'전년 대비 비교'!D11",
        "lngCost": "'전년 대비 비교'!D12",
        "lpgCost": "'전년 대비 비교'!D13",
        "gasCost": "'전년 대비 비교'!D14",
        "totalCost": "'전년 대비 비교'!D15"
      }
    },
    "intensityPeriods": {
      "2025": "1~12월",
      "2026": "1~9월"
    }
  },
  "sourceNotes": [
    "전기·LNG·LPG 비용 비교는 2025년과 2026년 모두 1~9월 누계입니다.",
    "팀별 원단위는 2025년 12개월과 2026년 9개월 합계 기준입니다. 월별 팀 생산량·열량이 없어 동일 기간 비교로 재구성하지 않았습니다.",
    "전체 kJ/kg은 팀별 총열량 합계 ÷ 팀별 총생산량 합계입니다. 팀 원단위의 단순 평균을 사용하지 않습니다.",
    "2026년 10월은 가스비 누락, 11월은 일부 사용량 및 비용 0, 12월은 공란입니다. 10~12월 원자료를 남기고 연간 추정의 실적 기준에서는 제외합니다.",
    "원자료의 LNG는 m³, LPG는 kg입니다. 두 사용량을 같은 단위로 합산하지 않습니다.",
    "설치도 2쪽은 유산 생산1팀2파트 건조기를 대상으로 합니다. 팀별 총열량·생산량은 건조기 단독 계측값이 아니므로 해당 팀 전체의 예상 원단위로 표시합니다.",
    "통합 원자료에는 LNG·LPG의 설비별·사업장별 배분과 연료 발열량 계수가 없습니다. 연료 환산과 비용 전망은 표시된 시나리오 가정에 따릅니다.",
    "연간 환산값은 2026년 1~9월 실적 × 12/9로 계산하며, 생산 구성과 운전 조건이 유지된다는 가정입니다."
  ]
});
