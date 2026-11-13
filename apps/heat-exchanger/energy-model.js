// Scenario arithmetic only. Recovered heat replacing KPI energy 1:1 is an
// explicit reference assumption; this is not a verified fuel conversion.
((root) => {
  'use strict';
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const optional = (value) => value === null || value === undefined || value === '' ? null : value;
  const freeze = (value) => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };

  function calculateForecast(data, input = {}) {
    const errors = [];
    const source = data?.annual?.['2026'];
    if (!source) return freeze({ valid: false, errors: ['2026년 기준 실적이 없습니다.'] });
    for (const key of ['energyKj', 'productionKg', 'electricityCost', 'lngCost', 'lpgCost']) {
      if (!finite(source[key]) || source[key] < 0 || (key === 'productionKg' && source[key] === 0)) {
        errors.push(`2026년 기준 ${key} 값을 확인해 주세요.`);
      }
    }
    if (!Number.isInteger(source.months) || source.months < 1 || source.months > 12) errors.push('기준 실적의 포함 월 수를 확인해 주세요.');
    const teams = Array.isArray(source.teams) ? source.teams : [];
    const targetTeamId = input.targetTeamId ?? data.source?.equipmentTeamId ?? 'team-1-part-2';
    const target = teams.find((team) => team.id === targetTeamId);
    if (!target) errors.push('열교환기 효과를 적용할 팀을 확인해 주세요.');
    const ids = new Set();
    for (const team of teams) {
      if (typeof team.id !== 'string' || ids.has(team.id) || !finite(team.energyKj) || team.energyKj < 0 || !finite(team.productionKg) || team.productionKg <= 0) {
        errors.push('팀별 기준 열량·생산량을 확인해 주세요.');
      }
      ids.add(team.id);
    }

    const heatKw = input.heatKw;
    const gasRate = input.gasM3PerHour;
    const gasPrice = input.gasPrice;
    const days = input.days;
    const hours = input.hours;
    const productionGrowth = input.productionGrowth ?? 0;
    const realization = input.realization ?? 1;
    const startMonth = input.startMonth ?? 1;
    const deltaKw = optional(input.deltaKw);
    const electricityPrice = optional(input.electricityPrice);
    const annualMaintenanceWon = input.maintenanceWon ?? 0;
    for (const [name, value] of [['회수열', heatKw], ['시간당 가스 절감량', gasRate], ['가스 단가', gasPrice], ['추가 정비비', annualMaintenanceWon]]) {
      if (!finite(value) || value < 0) errors.push(`${name}은 0 이상의 숫자로 입력해 주세요.`);
    }
    if (!finite(days) || days < 0 || days > 365) errors.push('연 가동일수는 0~365일로 입력해 주세요.');
    if (!finite(hours) || hours < 0 || hours > 24) errors.push('일 가동시간은 0~24시간으로 입력해 주세요.');
    if (!finite(productionGrowth) || productionGrowth <= -1) errors.push('생산량 증감률은 -100%보다 커야 합니다.');
    if (!finite(realization) || realization < 0 || realization > 1) errors.push('효과 반영률은 0~100%로 입력해 주세요.');
    if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) errors.push('2027년 가동 시작월은 1~12월로 입력해 주세요.');
    if (deltaKw !== null && !finite(deltaKw)) errors.push('순증전력은 숫자로 입력하거나 비워 주세요.');
    if (electricityPrice !== null && (!finite(electricityPrice) || electricityPrice < 0)) errors.push('전력단가는 0 이상의 숫자로 입력하거나 비워 주세요.');
    if (heatKw === 0 && finite(gasRate) && gasRate > 0) errors.push('회수열이 0이면 가스 절감량도 0이어야 합니다.');
    if (errors.length) return freeze({ valid: false, errors });

    function totals(factor, year, months) {
      const energyKj = source.energyKj * factor;
      const productionKg = source.productionKg * factor;
      const electricityCostWon = source.electricityCost * factor;
      const lngCostWon = source.lngCost * factor;
      const lpgCostWon = source.lpgCost * factor;
      const gasCostWon = lngCostWon + lpgCostWon;
      const totalCostWon = electricityCostWon + gasCostWon;
      return {
        year, months, energyKj, productionKg, electricityCostWon, lngCostWon,
        lpgCostWon, gasCostWon, totalCostWon,
        kjPerKg: energyKj / productionKg, costPerKg: totalCostWon / productionKg,
        teams: teams.map((team) => ({
          id: team.id, name: team.name, energyKj: team.energyKj * factor,
          productionKg: team.productionKg * factor, kjPerKg: team.energyKj / team.productionKg,
        })),
      };
    }
    const annualFactor = 12 / source.months;
    const actual = totals(1, 2026, source.months);
    const current = totals(annualFactor, 2026, 12);
    const base = totals(annualFactor * (1 + productionGrowth), 2027, 12);
    if (![current.energyKj, current.productionKg, current.totalCostWon, base.energyKj, base.productionKg, base.totalCostWon].every(finite) || base.productionKg <= 0) {
      return freeze({ valid: false, errors: ['연환산 또는 생산량 증감률의 계산 범위를 확인해 주세요.'] });
    }
    const targetBase = base.teams.find((team) => team.id === targetTeamId);
    const activeMonths = 13 - startMonth;
    const activeFraction = activeMonths / 12;
    const operatingHours = days * hours * activeFraction;
    const heatKjRequested = heatKw * 3600 * operatingHours * realization;
    const gasM3Requested = gasRate * operatingHours * realization;
    const gasCostWonRequested = gasM3Requested * gasPrice;
    const powerKjRequested = deltaKw === null ? null : deltaKw * 3600 * operatingHours;
    if (![operatingHours, heatKjRequested, gasM3Requested, gasCostWonRequested].every(finite) || (powerKjRequested !== null && !finite(powerKjRequested))) {
      return freeze({ valid: false, errors: ['회수열·가스량·전력의 계산 범위를 확인해 주세요.'] });
    }
    const heatKjApplied = Math.min(heatKjRequested, targetBase.energyKj);
    const heatFraction = heatKjRequested > 0 ? heatKjApplied / heatKjRequested : 1;
    const gasM3 = gasM3Requested * heatFraction;
    const heatLimitedGasCostWon = gasM3 * gasPrice;
    const gasCostWonApplied = Math.min(heatLimitedGasCostWon, base.gasCostWon);
    // A negative power change may save electricity, but cannot erase more energy
    // than remains in the selected team's recorded boundary.
    const powerKj = powerKjRequested === null ? null : Math.max(powerKjRequested, -(targetBase.energyKj - heatKjApplied));
    const effectivePowerKw = powerKj === null ? null : operatingHours > 0 ? powerKj / (3600 * operatingHours) : 0;
    const powerCostWon = effectivePowerKw === null || electricityPrice === null ? null : effectivePowerKw * electricityPrice * operatingHours;
    if (powerCostWon !== null && !finite(powerCostWon)) {
      return freeze({ valid: false, errors: ['순증전력과 전력단가의 계산 범위를 확인해 주세요.'] });
    }
    const maintenanceWon = annualMaintenanceWon * activeFraction;
    const energyKj = base.energyKj - heatKjApplied + (powerKj ?? 0);
    const grossCostWon = base.totalCostWon - gasCostWonApplied;
    const uncappedNetCostWon = powerCostWon === null ? null : grossCostWon + powerCostWon + maintenanceWon;
    const netCostWon = uncappedNetCostWon === null ? null : Math.max(0, uncappedNetCostWon);
    const energyBasis = powerKj === null ? 'gross-before-power' : 'net-with-power';
    const costBasis = 'gross-before-power-maintenance';
    const projected = {
      year: 2027, months: 12, energyKj, productionKg: base.productionKg,
      electricityCostWon: base.electricityCostWon,
      // The source does not identify which part of LNG/LPG the modeled gas saves.
      lngCostWon: null, lpgCostWon: null, gasCostWon: base.gasCostWon - gasCostWonApplied,
      totalCostWon: grossCostWon, grossCostWon, netCostWon,
      kjPerKg: energyKj / base.productionKg,
      costPerKg: grossCostWon / base.productionKg,
      netCostPerKg: netCostWon === null ? null : netCostWon / base.productionKg,
      energyBasis, costBasis,
    };
    const teamForecasts = base.teams.map((team) => {
      const allocatedHeatKj = team.id === targetTeamId ? heatKjApplied : 0;
      const allocatedPowerKj = team.id === targetTeamId ? powerKj : 0;
      const projectedEnergyKj = team.energyKj - allocatedHeatKj + (allocatedPowerKj ?? 0);
      return {
        id: team.id, name: team.name, baseEnergyKj: team.energyKj,
        productionKg: team.productionKg, baseKjPerKg: team.kjPerKg,
        projectedEnergyKj, projectedKjPerKg: projectedEnergyKj / team.productionKg,
        allocatedHeatKj, powerKj: allocatedPowerKj,
      };
    });
    const saving = {
      operatingHours, activeMonths, annualFactor, heatKjRequested, heatKjApplied,
      gasM3Requested, gasM3, gasCostWonRequested, heatLimitedGasCostWon, gasCostWonApplied,
      powerKj, powerCostWon, maintenanceWon,
      netSavingWon: netCostWon === null ? null : base.totalCostWon - netCostWon,
      kjPerKg: (base.energyKj - energyKj) / base.productionKg,
      gasCostPerKg: gasCostWonApplied / base.productionKg,
      heatReductionRate: base.energyKj > 0 ? (base.energyKj - energyKj) / base.energyKj : null,
      gasCostReductionRate: base.gasCostWon > 0 ? gasCostWonApplied / base.gasCostWon : null,
    };
    return freeze({
      valid: true, errors: [], actual, current, base, projected, teamForecasts, saving,
      targetTeamId, energyBasis, costBasis,
      assumptions: { recoveredHeatToKpiRatio: 1, fuelConversionVerified: false, productionGrowth, realization, startMonth },
      capped: {
        heat: heatKjApplied < heatKjRequested,
        cost: gasCostWonApplied < heatLimitedGasCostWon,
        power: powerKj !== powerKjRequested,
        netCost: uncappedNetCostWon !== null && uncappedNetCostWon < 0,
      },
    });
  }

  root.HeatEnergyModel = Object.freeze({ calculateForecast });
})(typeof window === 'undefined' ? globalThis : window);
