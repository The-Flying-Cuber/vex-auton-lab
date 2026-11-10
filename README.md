# Vsimulator Auton Lab

A browser-only extension of [RoboSTEM Vsimulator](https://sim.robostem.org/). The original auton editor, field rendering, robot behavior, and physics are retained.

Added controls in **Auton Coder**:

- Match field, 15-second test; Skills field, full 60-second test.
- Run Robot 1, Robot 2, or both simultaneously.
- Edit a separate routine and starting position for each robot, for each field.
- **Robot 1 / Robot 2** tabs each own their path data. Switching tabs saves the current robot; the Path menu lists that robot's saved paths. Choosing another robot's path makes an independent copy.
- See the other robot's path while editing and both robots during playback.
- Return from a run with **Edit auton**. Each robot has its own Save button; the original undo and block controls remain.
- Drag the numbered start node on the field to move that robot's start; drag its small direction handle to change its heading.
- **Customize start** opens the original Singleplayer placement screen for both robots. Switch Robot 1/Robot 2, drag along either red wall, or use the Red 1/Red 2 presets. Save both starts together.
- Runs open from a raised view behind the red side. The surrounding shed is removed.
- Choose **Locked view** to keep the mouse free, or **Free cam** to fly around. Change it during a run with the view button or **F**.

Open **Auton Coder** from the main menu. Pick the field, choose which robot to edit, save its routine, then press **Run**. Routines and settings are stored separately in each visitor's browser; they are not shared automatically between visitors. The editor runs simulator commands, not uploaded PROS or VEXcode C++.

Saved setups from earlier versions that assigned the same path to both robots are split into independent copies automatically. Existing waypoints and starting positions are preserved.

For Override VEXU Skills, [VURS3](https://events.vex.com/storage/game_manual/VEX_V5_Robotics_Competition_2026-2027_Override/rules/VURS3.html) requires legal red-alliance starting positions; [SG1](https://events.vex.com/storage/game_manual/VEX_V5_Robotics_Competition_2026-2027_Override/rules/SG1.html) requires separate quadrants. New setups use the two red quadrants. Existing saved starts are preserved; use Customize start to change them.

## GitHub Pages

This app has no backend, login, installed dependency, or server to operate. GitHub Actions builds static files and publishes them to Pages; every visitor's browser runs its own simulation. All field/robot assets are included in this repository, so the app does not depend on the original simulator's asset server. Online accounts, leaderboards, and multiplayer open the original simulator.

In the repository's **Settings → Pages**, select **GitHub Actions** as the source. Push to `main` (or manually run **Build and deploy Auton Lab**) to publish. The URL is `https://<owner>.github.io/vex-auton-lab/`. App resources use relative paths to support that repository prefix.

## Development

Node.js 22 or later is enough; no packages need to be installed.

```sh
npm run build
npm run check
npm run preview
```

The preview is only a development aid. Users of the published app need only a modern browser with WebGL.

`vendor/` is the pinned upstream snapshot and assets. `src/auton-lab.js` contains the extension. `scripts/build.mjs` applies a small, checked set of integration patches and emits `dist/`. An upstream update must be reviewed before replacing the snapshot; patches fail if the expected code no longer matches.

## Attribution

Original simulator and artwork: [RoboSTEM](https://robostem.org/), [sim.robostem.org](https://sim.robostem.org/). This is an unofficial extension, not an official RoboSTEM release. Existing third-party license notices in the vendor bundle are retained. No ownership of upstream code or assets is claimed.
