// User-supplied equipment nameplates. Geometry is an observation model.
export const MOTOR_SPEC = Object.freeze({
  manufacturer: '효성',
  model: 'HSX150412',
  frame: '160M',
  powerKw: 11,
  voltageV: 380,
  currentA: 24.3,
  ratedRpm: 1775,
  frequencyHz: 60,
  // Orientation clarified by the user: larger bearing at the output shaft.
  frontBearing: '6309ZZ',
  rearBearing: '6207ZZ',
  serial: '2094845129',
  manufactured: '2004.12',
});

export const BLOWER_SPEC = Object.freeze({
  manufacturer: '동아풍력',
  model: 'DATE-5#',
  powerKw: 11,
  massFlowKgPerHour: 3500,
  ratedRpm: 2350,
  pressureMmAq: 500,
  bearing: '6310',
  bearingQuantity: 2,
  serial: 'H-05-47',
  manufactured: '2005.10',
});
