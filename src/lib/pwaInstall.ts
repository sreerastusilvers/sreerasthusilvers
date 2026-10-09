import { useCallback, useSyncExternalStore } from 'react';

/**
 * PWA install support. The `beforeinstallprompt` event fires once, early, so this
 * module is imported from main.tsx to capture it before React mounts. The only UI
 * that uses it is the install card on the account page.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PwaInstallState {
  canPrompt: boolean;
  installed: boolean;
  isIOS: boolean;
}

const isBrowser = typeof window !== 'undefined';

function detectStandalone(): boolean {
  if (!isBrowser) return false;
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

// iOS Safari only: other iOS browsers (Chrome, Firefox, Edge) cannot add to home screen the same way.
function detectIOSSafari(): boolean {
  if (!isBrowser) return false;
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || iPadOS;
  if (!isIOSDevice) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedFlag = detectStandalone();
const isIOS = detectIOSSafari();
const listeners = new Set<() => void>();

let snapshot: PwaInstallState = { canPrompt: false, installed: installedFlag, isIOS };

function update() {
  const next: PwaInstallState = {
    canPrompt: deferredPrompt !== null && !installedFlag,
    installed: installedFlag,
    isIOS,
  };
  if (
    next.canPrompt !== snapshot.canPrompt ||
    next.installed !== snapshot.installed ||
    next.isIOS !== snapshot.isIOS
  ) {
    snapshot = next;
    listeners.forEach((l) => l());
  }
}

if (isBrowser) {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Stop the browser's own mini-infobar; the install option lives on the account page only.
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    update();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedFlag = true;
    update();
  });

  try {
    const mq = window.matchMedia('(display-mode: standalone)');
    const onChange = () => {
      installedFlag = detectStandalone();
      update();
    };
    mq.addEventListener?.('change', onChange);
  } catch {
    /* ignore */
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const evt = deferredPrompt;
  if (!evt) return 'unavailable';
  // The event can only be used once.
  deferredPrompt = null;
  update();
  try {
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === 'accepted') {
      installedFlag = true;
      update();
    }
    return outcome;
  } catch {
    return 'dismissed';
  }
}

export function usePwaInstall() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const install = useCallback(() => promptInstall(), []);
  return { ...state, promptInstall: install };
}
