// Visible external assemblies reconstructed from the 2026-11-04 field photos.
// Geometry is illustrative: no unseen combustion chamber or service sequence.
export function buildFurnace(model, root) {
  const m = model;
  const steel = m.mat.steel, trim = m.mat.trim, dark = m.mat.dark;
  const yellow = m.mat.yellow, black = m.mat.black, white = m.mat.white;
  const orange = m.mat.furnaceOrange || (m._material ? m._material(0xe66320, .5, .18) : m.mat.red);
  const motor = m.mat.furnaceMotor || (m._material ? m._material(0x263d55, .52, .3) : m.mat.motor);
  const result = [];
  const part = (number, name, offset, home, anchor) => {
    const group = m._part(root, name, offset, home);
    group.userData.furnacePart = number;
    group.userData.labelAnchor = anchor;
    result.push({ number, name, group, anchor });
    return group;
  };
  const cylZ = (parent, radius, length, position, material, bottom = radius, segments = 32) => {
    const mesh = m._cyl(parent, radius, length, position, material, bottom, segments);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  };
  const cylX = (parent, radius, length, position, material, bottom = radius, segments = 32) => {
    const mesh = m._cyl(parent, radius, length, position, material, bottom, segments);
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  };
  const boltX = (parent, x, y, z) => cylX(parent, .035, .045, [x, y, z], trim, .035, 6);
  const boltZ = (parent, x, y, z) => cylZ(parent, .029, .045, [x, y, z], trim, .029, 6);
  const gauge = (parent, x, y, z, radius = .13) => {
    cylZ(parent, radius, .065, [x, y, z], trim);
    cylZ(parent, radius * .83, .012, [x, y, z + .04], white);
    m._bar(parent, [x, y, z + .05], [x - radius * .4, y + radius * .33, z + .05], .009, black);
    for (const a of [-2.2, -1.3, -.4, .5, 1.4, 2.2]) {
      m._bar(parent, [x + Math.sin(a) * radius * .64, y + Math.cos(a) * radius * .64, z + .052],
        [x + Math.sin(a) * radius * .76, y + Math.cos(a) * radius * .76, z + .052], .005, dark);
    }
  };

  // 01: tall stainless cylinder with visible circumferential seams.
  const duct = part(1, '상부 덕트', [0, 2.25, -.2], [0, 5.12, 0], [.83, .7, 0]);
  m._cyl(duct, .84, 2.36, [0, 0, 0], steel);
  for (const y of [-1.16, -.42, .4, 1.16]) m._ring(duct, .846, y, trim, .017);
  m._bar(duct, [.59, -1.15, .59], [.59, 1.15, .59], .008, trim);

  // 02: round duct joint blending into the broad rectangular lower flange.
  const hood = part(2, '전이 후드', [0, 1.05, 0], [0, 3.49, 0], [1.05, .1, .65]);
  const transition = m._cyl(hood, .84, .9, [0, 0, 0], steel, 1.25, 48);
  const hoodVertices = transition.geometry.attributes.position;
  for (let index = 0; index < hoodVertices.count; index++) {
    if (hoodVertices.getY(index) >= 0) continue;
    const x = hoodVertices.getX(index), z = hoodVertices.getZ(index);
    const edge = Math.max(Math.abs(x), Math.abs(z));
    if (edge < .0001) continue;
    hoodVertices.setX(index, x * 1.25 / edge);
    hoodVertices.setZ(index, z * .9375 / edge);
  }
  hoodVertices.needsUpdate = true;
  transition.geometry.computeVertexNormals();
  transition.geometry.computeBoundingBox();
  transition.geometry.computeBoundingSphere();
  m._box(hood, [2.46, .2, 1.8], [0, -.55, 0], steel);
  m._box(hood, [2.61, .09, 1.98], [0, -.47, 0], dark);
  m._box(hood, [2.76, .13, .18], [0, -.48, 1.01], orange);
  for (const x of [-1.25, 1.25]) m._box(hood, [.12, .1, 1.96], [x, -.48, 0], trim);
  for (const x of [-1.1, -.55, 0, .55, 1.1]) boltZ(hood, x, -.42, 1.01);

  // 03: external chamber, right-side bolted access panel and two handles.
  const body = part(3, '버너 본체·점검문', [-1.35, 0, -.65], [0, 1.54, 0], [1.25, .5, .25]);
  m._box(body, [2.46, 2.7, 1.8], [0, 0, 0], steel);
  m._box(body, [2.63, .09, 1.98], [0, -1.12, 0], trim);
  m._box(body, [.055, 1.95, 1.5], [1.255, .22, 0], dark);
  m._box(body, [.07, 1.87, 1.42], [1.29, .22, 0], steel);
  for (const y of [-.61, -.19, .23, .65, 1.07]) {
    for (const z of [-.63, .63]) {
      boltX(body, 1.35, y, z);
      m._bar(body, [1.37, y, z - .045], [1.37, y, z + .045], .012, trim);
    }
  }
  for (const z of [-.42, 0, .42]) for (const y of [-.64, 1.09]) boltX(body, 1.35, y, z);
  for (const z of [-.35, .35]) {
    m._bar(body, [1.34, -.23, z], [1.45, -.23, z], .022, trim);
    m._bar(body, [1.45, -.23, z], [1.45, .52, z], .026, trim);
    m._bar(body, [1.45, .52, z], [1.34, .52, z], .022, trim);
  }
  // Body seams and the two vertical base stiffeners visible in the photos.
  for (const x of [-.7, .7]) m._box(body, [.045, .9, .07], [x, -.89, .93], trim);
  for (const x of [-1.05, 1.05]) for (const z of [-.72, .72]) {
    m._box(body, [.53, .075, .48], [x, -1.43, z], trim);
    m._box(body, [.055, .47, .34], [x, -1.18, z], trim);
    m._bar(body, [x, -1.4, z + .2], [x, -.93, z - .08], .025, trim);
    m._cyl(body, .045, .045, [x + .17, -1.37, z + .14], dark, .045, 6);
  }
  for (const x of [-1.15, -.58, 0, .58, 1.15]) boltZ(body, x, 1.17, .92);
  m._box(body, [1.82, 1.06, .035], [0, .67, .923], trim);
  for (const x of [-.82, .82]) for (const y of [.23, 1.1]) boltZ(body, x, y, .96);
  gauge(body, .46, .83, .98, .085);

  // 04: paired orange air/burner housings, vertical motors and conduits.
  const fans = part(4, '전면 송풍부 2대', [-.7, -.12, 2.1], [0, 1.65, 1.04], [-.72, .1, .48]);
  for (const x of [-.72, .72]) {
    m._cyl(fans, .47, .3, [x, .25, 0], orange);
    m._cyl(fans, .43, .37, [x, .59, 0], orange, .28);
    m._cyl(fans, .44, .06, [x, .8, 0], trim);
    m._cyl(fans, .48, .065, [x, .095, 0], orange);
    m._cyl(fans, .235, .55, [x, -.31, 0], motor);
    m._cyl(fans, .245, .09, [x, -.62, 0], black);
    m._box(fans, [.2, .24, .16], [x + .2, -.29, .08], motor);
    for (let n = 0; n < 12; n++) {
      const a = n * Math.PI / 6;
      m._bar(fans, [x + Math.cos(a) * .239, -.48, Math.sin(a) * .239],
        [x + Math.cos(a) * .239, -.1, Math.sin(a) * .239], .009, trim);
    }
    for (let n = 0; n < 8; n++) {
      const a = n * Math.PI / 4;
      m._cyl(fans, .025, .035, [x + Math.cos(a) * .4, .43, Math.sin(a) * .4], trim, .025, 6);
    }
    m._box(fans, [.24, .12, .015], [x, .27, .475], yellow);
    m._bar(fans, [x + .2, -.42, .1], [x + .3, -.81, .13], .027, black);
    m._bar(fans, [x + .3, -.81, .13], [x + .05, -.95, -.18], .027, black);
  }

  // 05: front yellow gas train, right-hand valves, flange bolts and gauges.
  const gas = part(5, '배관·밸브', [2, .35, 1.3], [.45, 2.51, 1.25], [1.35, .15, 0]);
  m._bar(gas, [-1.98, 0, 0], [2.45, 0, 0], .085, yellow);
  for (const x of [-1.85, -.53, .36, 1.52, 2.2]) {
    cylX(gas, .17, .07, [x, 0, 0], yellow);
    for (let n = 0; n < 6; n++) {
      const a = n * Math.PI / 3;
      cylX(gas, .025, .09, [x, Math.cos(a) * .13, Math.sin(a) * .13], dark, .025, 6);
    }
  }
  for (const x of [.63, 1.12]) {
    m._box(gas, [.35, .3, .31], [x, .06, 0], trim);
    m._cyl(gas, .155, .36, [x, .38, 0], black);
    m._box(gas, [.08, .12, .09], [x + .17, .39, 0], black);
    m._bar(gas, [x + .14, .33, .04], [x + .21, -.35, .1], .017, black);
  }
  m._box(gas, [.32, .27, .28], [-1.17, .02, 0], dark);
  m._box(gas, [.27, .4, .24], [-1.17, .34, 0], trim);
  m._bar(gas, [-1.17, .11, .17], [-.91, .42, .17], .026, dark);
  m._bar(gas, [-.34, .08, 0], [-.34, .43, 0], .025, trim);
  m._box(gas, [.22, .26, .16], [-.34, .38, 0], dark);
  gauge(gas, -.34, .68, .05, .15);
  m._bar(gas, [-.34, .09, .17], [-.34, -.24, .17], .025, orange);
  m._bar(gas, [.38, .06, 0], [.38, .44, 0], .025, trim);
  gauge(gas, .38, .53, .02, .105);
  m._bar(gas, [1.8, .07, 0], [1.8, .3, 0], .025, trim);
  m._bar(gas, [1.64, .3, 0], [1.96, .3, 0], .025, orange);
  for (const x of [-1.15, .25]) {
    m._bar(gas, [x, -.08, 0], [x, -.3, -.06], .047, yellow);
    m._bar(gas, [x, -.3, -.06], [x, -.3, -.4], .047, yellow);
  }

  // 06: observed UV/ignition items; external cable runs only.
  const ignition = part(6, '점화·검출부', [.2, .75, 2.85], [0, 2.22, .96], [.1, .1, .2]);
  m._box(ignition, [.26, .3, .16], [-.38, .12, .035], black);
  cylZ(ignition, .075, .24, [-.12, .1, .12], trim);
  m._bar(ignition, [-.12, .12, .18], [-.05, .31, .18], .028, motor);
  m._bar(ignition, [-.05, .31, .18], [.18, .33, .12], .015, motor);
  m._bar(ignition, [.18, .33, .12], [.52, .19, .08], .015, black);
  m._bar(ignition, [.52, .19, .08], [.57, -.06, .08], .015, black);
  m._bar(ignition, [-.33, -.03, .12], [-.13, -.17, .14], .017, black);
  m._bar(ignition, [-.13, -.17, .14], [.43, -.17, .14], .017, black);
  m._bar(ignition, [.2, -.17, .14], [.2, .06, .14], .024, trim);
  cylZ(ignition, .047, .14, [.2, .06, .14], white);
  for (const x of [-.38, .2]) m._box(ignition, [.25, .08, .013], [x, -.28, .08], white);
  return result;
}
