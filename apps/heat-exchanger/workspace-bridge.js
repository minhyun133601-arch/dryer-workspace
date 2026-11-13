// Keep the simulator independently runnable and preserve it across workspace tabs.
(() => {
  'use strict';
  const embedded = window.parent !== window;
  let hostActive = !embedded;

  function syncActivity() {
    const active = hostActive && !document.hidden;
    window.setHeatWorkspaceActive?.(active);
    if (active) window.refreshHeat3D?.();
  }

  window.addEventListener('message', (event) => {
    if (!embedded || event.source !== window.parent || event.origin !== location.origin) return;
    if (event.data?.type !== 'dryer-workspace:visibility') return;
    if (typeof event.data.active !== 'boolean') return;
    hostActive = event.data.active;
    syncActivity();
  });
  document.addEventListener('visibilitychange', syncActivity);
  syncActivity();

  // Calculation and drawing controls also work when WebGL uses its fallback.
  if (embedded) {
    window.parent.postMessage(
      { type: 'dryer-workspace:ready', moduleId: 'heat-exchanger' },
      location.origin === 'null' ? '*' : location.origin,
    );
  }
})();
