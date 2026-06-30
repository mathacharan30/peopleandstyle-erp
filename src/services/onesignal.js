const APP_ID = '758e1141-e34e-44c4-a1bf-a9fc837c890e';

// Queues a callback to run after OneSignal SDK is fully initialized.
// If SDK is already ready, it runs immediately.
function deferred(callback) {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(callback);
}

export function loginUser(uid) {
  deferred(async (OneSignal) => {
    try {
      await OneSignal.login(uid);
      await OneSignal.Notifications.requestPermission();
    } catch (err) {
      console.warn('OneSignal login failed:', err?.message);
    }
  });
}

export function logoutUser() {
  deferred(async (OneSignal) => {
    try {
      await OneSignal.logout();
    } catch {
      // non-fatal
    }
  });
}

export async function sendPush(recipientUid, title, body) {
  try {
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${import.meta.env.VITE_ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: APP_ID,
        include_aliases: { external_id: [recipientUid] },
        target_channel: 'push',
        headings: { en: title },
        contents: { en: body },
      }),
    });
    if (!res.ok) console.warn('OneSignal push failed:', await res.text());
  } catch (err) {
    console.warn('OneSignal push error:', err?.message);
  }
}
