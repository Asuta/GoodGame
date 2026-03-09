Original prompt: ????????????????????????????????????????????????????????????

- 2026-03-08: Added a time-slot system to config/state/runtime.
- Default day now has 4 slots: Morning / Noon / Afternoon / Night.
- Daily actions can declare `availableTimeSlotIds`; old saved configs now backfill defaults by action id.
- Home page now shows time blocks in the top-right of the scene and filters actions by the current slot.
- Executing an action advances the slot counter and updates remaining actions.
- Editor now exposes time-slot editing plus per-action slot assignment.
- Verified with `npm run build` and a Playwright smoke test on the local Vite app.
- Note: the base editor labels added in this task use English text to avoid the encoding corruption that appeared in a few rewritten files.
- 2026-03-09: Exposed the editor `AI 配置` tab button so the existing `AiTab` screen is reachable from the tab bar.
- 2026-03-09: Reworked the play-page settings panel into `游戏设置` and added explicit buttons to open/close AI mode.
- 2026-03-09: Removed the `setState in effect` lint issues by switching the typewriter effect to refs and making the custom AI intent form uncontrolled with a reset key.
- 2026-03-09: Split editor helper exports out of `shared.tsx` so Fast Refresh lint only sees component exports there.
- 2026-03-09: Verified with `npm run lint`, `npm run build`, the web-game Playwright client screenshots for `/` and `/editor`, and a direct Playwright toggle check that switched Home from `AI 模式已开启` to `AI 模式已关闭`.
