export function isFullscreen(): boolean {
  return !!(document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement);
}

export function toggleFullscreen(): void {
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  const p = isFullscreen() ? (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.()) : (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
  void p?.catch?.(() => undefined);
}
