const pending = new Map();
let listening = false;
export const isAndroidCompanion = () => typeof window !== 'undefined' && typeof window.FitTrackAndroid?.postMessage === 'function';
export function requestAndroidHealth(method, args) {
  if (!isAndroidCompanion()) return Promise.reject(new Error('Automatic health sync is available in the FitTrack Android companion.'));
  if (!listening) {
    window.addEventListener('fittrack:native', event => {
      const message = event.detail;
      const request = pending.get(message?.id);
      if (!request) return;
      clearTimeout(request.timer); pending.delete(message.id);
      if (message.ok) request.resolve(message.result);
      else request.reject(new Error(message.error?.message || 'The Android health request could not finish. Try again.'));
    });
    listening = true;
  }
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('The health request timed out. Return to FitTrack and try again.')); }, method === 'connect' ? 120000 : 45000);
    pending.set(id, { resolve, reject, timer });
    try { window.FitTrackAndroid.postMessage(JSON.stringify({ id, method, args })); }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
}
