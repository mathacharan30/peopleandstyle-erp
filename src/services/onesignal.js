import OneSignal from 'react-onesignal';

const APP_ID = '758e1141-e34e-44c4-a1bf-a9fc837c890e';

let initialized = false;

async function init() {
  if (initialized) return;
  initialized = true;
  await OneSignal.init({
    appId: APP_ID,
    serviceWorkerPath: '/OneSignalSDKWorker.js',
    notifyButton: { enable: false },
    promptOptions: { slidedown: { prompts: [{ type: 'push', autoPrompt: false }] } },
  });
}

export async function loginUser(uid) {
  try {
    await init();
    await OneSignal.login(uid);
    await OneSignal.Notifications.requestPermission();
  } catch {
    // Non-fatal — push is an enhancement only
  }
}

export async function logoutUser() {
  try {
    await OneSignal.logout();
  } catch {
    // Non-fatal
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
