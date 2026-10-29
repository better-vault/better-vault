# Anatomy renderer (copy)

The landing page's Anatomy scene draws a real figure with the app's own
renderer. These files are copies of `studio/tools/anatomy/` in the app,
because the website is a separate project and cannot import app files:
`stage.tsx`, `geometry.ts`, `scene.ts`, `anatomy.css`, `example.ts` (our own
spring scale) and `kit/iso-kit.ts` (Anatomy's MIT kit, unchanged, with its
notice).

When those files change in the app, copy them here again.
