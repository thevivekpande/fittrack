# FitTrack Android companion

The companion bundles the same FitTrack web application and adds a read-only Android Health Connect bridge. FitTrack reads steps, active calories, sleep and weight when available from connected apps. Samsung Health's supported sharing varies by device, version and data type; enable its Health Connect sharing and grant FitTrack read access. Other connected sources can also contribute. FitTrack uses Health Connect's aggregates/source priorities rather than adding phone and watch records together. Active calories may remain empty when a source supplies only total exercise calories; those are different data types.

The app reads the last seven local calendar days on demand. The web app controls opt-in and foreground sync; there is no background service, Health Connect write permission, account, or health-data backend. The companion's local database is separate from Chrome/the deployed website. A health-only JSON export/import transfers those values manually; it does not transfer workouts, identity, or the complete workspace.

## Build

Requirements: Node/npm, Android SDK 36 with Build Tools 35.0.0, and JDK 17 or later (Android Studio's bundled JDK works). Minimum device version is Android 9/API 28. Target and compile SDK are 36; this compile version is required by stable Health Connect 1.1.0.

From the repository root:

```sh
npm install
npm run android:build
```

Or run the individual steps:

```sh
npm run build
node scripts/prepare-android.mjs
cd android
./build.sh assembleDebug testDebugUnitTest lintDebug
```

`build.sh` detects Android Studio's usual macOS/Linux JDK and SDK locations. Explicit `JAVA_HOME` and `ANDROID_HOME` take precedence; Android Studio can also manage `local.properties`. On Windows, configure those variables and run `gradlew.bat assembleDebug testDebugUnitTest lintDebug` in this directory after preparing assets.

The debug artifact is `app/build/outputs/apk/debug/app-debug.apk`. These commands compile only; they do not install or modify a connected device. Open `android/` in Android Studio to inspect the project. Rebuild web assets whenever the React application changes. Generated assets, build output, local SDK paths and signing keys are ignored by Git.

Gradle 8.13's wrapper JAR is verified against the official SHA-256 `81a82aaea5abcc8ff68b3dfcb58b3c3c429378efd98e7433460610fecd7ae45f`. The distribution checksum is pinned in `gradle/wrapper/gradle-wrapper.properties`. Native dependencies are pinned, including Android Gradle Plugin 8.11.1 and stable `androidx.health.connect:connect-client:1.1.0`.

On a managed network, Gradle may require your organization's already-trusted CA in a separate copy of the JDK trust store. Configure that copy through a build-only override; keep TLS verification enabled and do not edit the system/JDK trust stores:

```sh
JAVA_TOOL_OPTIONS='-Djavax.net.ssl.trustStore=/path/to/build-truststore -Djavax.net.ssl.trustStorePassword=changeit' ./build.sh assembleDebug
```

## Connect on a phone

1. Install a locally built APK on your own test phone using your preferred Android development workflow.
2. Enable Samsung Health's Health Connect sharing for the desired data types. Android 14+ includes Health Connect; supported earlier Android versions use its Play Store app.
3. Open FitTrack, complete its blank setup, and connect Health Connect from the health card. Grant only the read permissions you want.
4. Sync, then compare the dates and totals with Health Connect. Empty fields mean no available value or no permission; they are not fabricated zeroes. Weight is the latest measurement each day. Sleep minutes are attributed to the local calendar interval, so a sleep session crossing midnight contributes to both days.
5. For Chrome/desktop, export the health snapshot through Android's share chooser and import that JSON on the website. Sharing starts only after the user's explicit action and recipient choice.

Permission denial and partial access are supported. Access is checked before every sync and again before returning results. Disconnect revokes only FitTrack's Health Connect permissions; the web health controls manage locally retained values. Samsung Health's records are never changed. Files selected for import use Android's document picker without broad storage access.

## Bridge and security

The application loads `https://appassets.androidplatform.net/assets/web/index.html` through `WebViewAssetLoader`. Vite's absolute `/assets/*`, `/images/*` and icon paths are mapped to the bundled `web/` directory. Local requests never fall back to a remote host when a file is missing. Remote links open in another app, not in the privileged WebView.

`WebViewCompat.addWebMessageListener` exposes `window.FitTrackAndroid.postMessage` only on the trusted asset origin. Native code additionally checks main-frame origin and current URL. It does not use `addJavascriptInterface`. Responses are discarded after document navigation, and JSON is escaped before dispatch. External fonts/images may use the internet, but health values are not sent with those requests. File URL access and cleartext HTTP resources are disabled. System backup and device-to-device extraction of the app database are disabled.

Requests: `{id: string, method: string, args?: object}`. Responses arrive as `fittrack:native` CustomEvents with `{id, ok: true, result}` or `{id, ok: false, error: {code, message}}`. Supported methods:

| Method | Result/action |
| --- | --- |
| `availability` | `{available, status, granted}`; status is `available`, `install-required`, or `unavailable` |
| `connect` | Android read-permission prompt, then the current availability result |
| `sync` | `{syncedAt, fromDate, toDate, permissions, days}` with seven daily rows |
| `disconnect` | Revoke this app's access, return availability |
| `openSettings` | Open Health Connect settings or its install/update screen |
| `exportHealth` | Validate `args.json`, then share a temporary health-only JSON file |

Permission IDs are `steps`, `activeCalories`, `sleep`, `weight`. Each daily row has `date`, `steps`, `activeCalories` (kcal), `sleepMinutes`, `weightKg`; unavailable fields are `null`. Native `fittrack:foreground` events notify the web app when a loaded activity resumes.

Exports must match `{format: 'fittrack-health-v1', snapshot: ...}`, stay below 1 MB, contain at most 366 unique dates and no fields outside the health schema. A narrowly scoped `FileProvider` grants read access only to the chosen share recipient. Temporary exports older than 24 hours are removed on the next launch/export. Health values, export contents, and Health Connect exception details are not logged.

## Validation and distribution

Unit tests verify the export boundary, types/ranges, duplicate dates, null/zero behavior, sparse history and size limits. Build/lint can validate source and manifests, but cannot establish Samsung Health synchronization on real hardware. Before distributing, test on a Samsung phone: no/partial/full access, permission revocation, Health Connect install/update, duplicate source priorities, local day boundaries, imports/exports, airplane mode, foreground return, and application restart. No phone installation or live health data access is part of this repository's build.

The supplied build is a development companion. Public release requires your own release signing, matching public privacy policy and the relevant Health Connect permission declaration in Play Console. The native rationale screen is implemented in `PermissionsRationaleActivity` for Android 13 and Android 14+ permission flows. An up-to-date Android System WebView supporting `WEB_MESSAGE_LISTENER` is required for the native bridge; the app never falls back to an unrestricted interface.

References: [Health Connect setup](https://developer.android.com/health-and-fitness/health-connect/get-started), [aggregation](https://developer.android.com/health-and-fitness/health-connect/aggregate-data), [stable SDK releases](https://developer.android.com/jetpack/androidx/releases/health-connect), [WebView native messaging](https://developer.android.com/reference/androidx/webkit/WebViewCompat#addWebMessageListener(android.webkit.WebView,java.lang.String,java.util.Set,androidx.webkit.WebViewCompat.WebMessageListener)).
