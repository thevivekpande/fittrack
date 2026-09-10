# FitTrack

A responsive fitness workspace with daily plans for Beginner, Medium, and Experienced users. Built with React, Vite, Three.js, and Lucide icons.

## Run locally

```bash
npm install
npm run dev
```

Use the local URL printed by Vite. For a specific port:

```bash
npm run dev -- --port 4173
```

Scan the desktop QR card to open [FitTrack on your phone](https://fittrack-three-bice.vercel.app/). The QR code and copy-link button always use this fixed deployed URL, including when the desktop app runs locally.

## Features

- Home and Gym training modes with three experience levels each and dedicated recovery sessions. Home plans use bodyweight exercises, a mat, or stable household support.
- Sixty-seven searchable gym exercises and thirty home-friendly exercises with instructions and animated 3D movement previews. Filter biceps, triceps, and Abs & core separately; search “abs” to find all available core movements. View a smooth athletic demo figure, pause playback, change speed, drag to rotate, or pinch to zoom. Reset the camera anytime. An illustrated fallback works without WebGL.
- Workout sessions with set completion, a pauseable timer, rest countdown, and automatic save/resume.
- Weekly activity charts, workout history, body-weight trends, milestones, and CSV export.
- Blank first-time setup for your name, gender, training location, experience level, primary fitness goal, weekly workout target, and optional starting weight.
- Build a recurring weekly split in **My workout plan → Edit weekly split**: assign muscle groups to Monday–Sunday, choose exercises, adjust sets and reps, and schedule recovery days. Each training location and experience level keeps its own routine.
- Add exercises to today’s workout or choose **Edit this date** for a single-day change. Saving a weekly split replaces individual date edits from the current week onward; completed workouts and unfinished sessions keep their original details.
- Goal-based weekly suggestions for fat loss, muscle building, physique development, general fitness, and core strength. Suggestions adapt to your training location, experience, and chosen number of workouts.
- Change goals from the dashboard or **Settings → Goals & suggested plan**, review the proposed week, and decide whether to keep or replace your custom routine. Every suggested day remains editable.
- Editable name, gender, and weekly workout target.
- Responsive workout screens with wrapping exercise tabs and touch-friendly controls, keyboard-accessible dialogs, and reduced-motion support.
- Gender selection controls demo representation and rotates comparable exercise variations; goals, experience, and equipment determine the workout difficulty. All exercises remain available to everyone. Non-binary and private selections use a neutral demo figure.
- A desktop QR card opens `https://fittrack-three-bice.vercel.app/` on a phone. QR codes are generated locally; progress stays in each browser.

## Your data

Your profile, preferences, actual workout history, weight entries, weekly splits, custom day plans, and unfinished session are saved in **IndexedDB** (`fittrack` → `workspace` → `current`). No account or backend is required. First-time setup starts blank: no assumed name, selected level, goal, starting weight, or fabricated activity.

Return using the **same browser and site address (including port)** to restore your workspace. The app remembers your last visit and resumes from your saved progress. Data is local to this browser, not synchronized across devices; clearing site data removes it. Save failures are shown with a retry option. A stale tab cannot silently overwrite progress saved in another tab.

Opening the deployed app on your phone starts or restores that phone browser’s own workspace. Scanning the QR code does not transfer your desktop or localhost progress.

Existing profiles without a fitness goal or gender keep their data and current plans; the app asks for those choices without assuming them. Choose **Complete profile**, or edit your gender in **Settings**.

Existing installations migrate real workout and weight records from localStorage while removing old sample sessions and asking you to confirm your profile through the new setup. The migration runs only when no IndexedDB workspace exists; clearing activity will not reimport it.

Choose **Settings → Clear activity and start fresh** to remove activity, weekly splits, and custom day plans while keeping your profile. Export workout history, including training location, as CSV from **My progress**.

Fat-loss suggestions combine strength, conditioning, and core work. The goal selector explains that ab exercises alone do not reduce belly fat, following [Mayo Clinic guidance](https://www.mayoclinic.org/healthy-lifestyle/womens-health/in-depth/belly-fat/art-20045809). Activity suggestions use the general principle of combining aerobic and muscle-strengthening activity from [CDC guidance](https://www.cdc.gov/physical-activity-basics/guidelines/adults.html); short or low-frequency plans are starting points, not a claim to meet the full weekly guidelines.

Calorie figures are estimates. Demo figures illustrate movement patterns; exercise instructions accompany each preview.

The home-training background is bundled locally (Unsplash photo `1594737625785-a6cbdabd333c`). Other photographs are served from Unsplash and fonts from Google Fonts; they need an internet connection. The workout plans and movement animations are included in the application.

## Verify and build

```bash
npm test
npm run build
npm run preview
```

Tests validate both training environments, every plan and exercise reference, new demo movements, recovery sessions, all goal/location/level/frequency combinations, recurring splits, date-specific overrides, blank defaults, migration, record validation, and visit tracking. Production files are generated in `dist/` and can be served by any static web host.
