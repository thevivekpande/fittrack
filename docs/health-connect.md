# Samsung Health and FitTrack

FitTrack's Android companion reads the health measurements you allow through Health Connect. A normal browser tab cannot call that native Android interface. Health Connect uses an Android SDK and on-device communication; FitTrack therefore needs its Android companion for direct access. See [Android's architecture guide](https://developer.android.com/health-and-fitness/health-connect/architecture).

## Connect your phone

1. Update Samsung Health on your phone and, if you use one, your Galaxy Watch.
2. Open **Samsung Health → Settings → Health Connect → App permissions → Samsung Health**. Allow Samsung Health to share the measurements you want FitTrack to read.
3. Open the FitTrack Android companion and connect Health Connect. Grant FitTrack the read permissions you choose.
4. Refresh from FitTrack while the companion is open.

If measurements are missing, reopen Samsung Health after changing permissions. Its **Settings → Sync with Samsung account → Sync now** action can help refresh watch data. Menu wording can vary by Samsung Health version. Watch measurements reach Health Connect through Samsung Health on the phone, so they may arrive later than the watch display. See [Samsung's Health Connect FAQ](https://developer.samsung.com/health/health-connect-faq.html).

Health Connect is integrated into Android 14 and later. On Android 9–13, install the Health Connect app when prompted. Search the phone's Settings for **Health Connect** to review app permissions. See [Android's setup instructions](https://developer.android.com/health-and-fitness/health-connect/get-started).

## When measurements update

FitTrack's refresh-on-open option runs while the Android companion is in the foreground. It does not promise continuous updates while closed, and it does not synchronize your desktop browser automatically. A manual refresh reads again after Samsung Health has shared its latest data.

Android supports a separate background-read feature that requires additional permission and scheduling. That capability is distinct from FitTrack's foreground refresh. See [Android's foreground and background read guidance](https://developer.android.com/health-and-fitness/health-connect/read-data).

## Use a browser or another device

Export a **FitTrack health JSON file** from the companion, transfer it to the desired device, and choose the health import action in FitTrack there. This imports a snapshot; refresh it by exporting and importing again. Raw Samsung Health exports are a different format and are not supported by this import.

The companion's embedded browser stores its FitTrack data separately from Chrome or Samsung Internet, even when the website address matches. Opening the same URL or scanning the website QR code does not move your local data between them. See [Android's WebView documentation](https://developer.android.com/develop/ui/views/layout/webapps/webview).

Imported measurements stay in the receiving FitTrack installation's local browser database. This health export does not transfer workout plans, workout history, or meal plans. No FitTrack cloud account or automatic cross-device transfer is provided.

For Samsung's detailed integration walkthrough, use [Accessing Samsung Health Data through Health Connect](https://developer.samsung.com/health/blog/en/accessing-samsung-health-data-through-health-connect).
