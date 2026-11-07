'use strict';
if ('serviceWorker' in navigator && window.isSecureContext && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(error => {
      console.warn('オフライン機能を準備できませんでした。', error);
    });
  });
}
