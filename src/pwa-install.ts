/**
 * PWA Install Prompt Handler
 * Captures the browser's install prompt and exposes helpers
 * so the app can trigger installation from its own UI.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

/** Listen for the browser's install prompt */
window.addEventListener('beforeinstallprompt', (event: Event) => {
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  showInstallButton();
  window.dispatchEvent(new CustomEvent('safesphere-install-available'));
});

/** Whether the browser has offered the install prompt (e.g. Android/Chrome). */
export function getInstallPromptAvailable(): boolean {
  return !!deferredPrompt;
}

/** Call when the install button is in the DOM (e.g. Menu mounted) to show it if the prompt was already captured. */
export function syncInstallButtonVisibility(): void {
  if (deferredPrompt) showInstallButton();
}

/** Trigger the install prompt from a custom button */
export async function installPWA(): Promise<void> {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();

  const { outcome } = await deferredPrompt.userChoice;
  console.log(`PWA install outcome: ${outcome}`);

  deferredPrompt = null;
  hideInstallButton();
}

/** Detect successful installation */
window.addEventListener('appinstalled', () => {
  console.log('PWA installed successfully');
  hideInstallButton();
});

/* ---------- UI helpers ---------- */
function showInstallButton(): void {
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'block';
}

function hideInstallButton(): void {
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'none';
}
