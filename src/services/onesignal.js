const APP_ID = '758e1141-e34e-44c4-a1bf-a9fc837c890e';

function getOS() {
  return window.OneSignal;
}

export async function loginUser(uid) {
  try {
    const os = getOS();
    if (!os) return;
    await os.login(uid);
    await os.Notifications.requestPermission();
  } catch (err) {
    console.warn('OneSignal loginUser failed:', err?.message);
  }
}

export async function logoutUser() {
  try {
    const os = getOS();
    if (!os) return;
    await os.logout();
  } catch {
    // non-fatal
  }
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
