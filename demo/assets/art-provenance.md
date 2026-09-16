# Campus environment artwork

## campus-paving-v2.jpg

- Created: 2026-09-16.
- Tool: built-in `image_gen.imagegen`, original material texture, no reference images.
- Use: diffuse stone paving texture on actual Three.js ground geometry.
- Format: 1024 × 1024 JPEG, optimized with macOS `sips` to the requested 1K resolution and JPEG quality 64.
- Source PNG retained at `/Users/bytedance/.codex/generated_images/01a0a98e-76cf-7721-8c47-7ae0af144ccb/exec-6e5161b8-0dd6-48a3-ab9e-adb1301a7586.png`.
- Visual review: restrained warm-gray and blue-gray stones, small joints, fine grain, orthographic and evenly lit; no objects, vegetation, text or UI. Use `THREE.MirroredRepeatWrapping` on both axes to preserve boundary continuity because generation does not guarantee pixel-perfect repeat edges.

### Final paving generation prompt

```text
Use case: stylized-concept.
Asset type: a square seamless physically flat repeating pavement texture for the ground material in a refined anime-style 3D campus game.
Create a high-quality hand-painted material texture, 1024x1024 square. Strict orthographic top-down view of light warm-gray rectangular stone paving slabs in a tasteful irregular staggered layout, medium slab scale (about 4 to 6 slabs across image width). Subtle natural variation between ivory-gray, warm beige-gray, and softly cool blue-gray slabs. Finely painted stone grain and very delicate tight joints, lightly softened slab edges, clean and contemporary, calm restrained contrast. Mature Japanese animation background-art craftsmanship translated into a practical tileable game material, crisp and refined without being noisy.
Absolutely flat diffuse illumination with no directional shadows or highlights baked in. Seamlessly repeatable on all four edges. No perspective, no horizon, no border or margins, no surrounding scene. No objects, vegetation, moss, people, text, logos, UI, watermark, high-contrast cracks, dirt, damage, grunge, 3D blocks, low-poly look or bevels casting shadows. Fill the entire square exclusively with this paving pattern.
```

## campus-sky-v2.jpg

- Created: 2026-09-16.
- Tool: built-in `image_gen.imagegen` (default imagegen skill mode), original generated image; no reference images.
- Use: distant equirectangular sky background for the first-person campus demo. All playable geometry remains rendered in Three.js.
- Format: 1774 × 887 pixels, 2:1 JPEG. Converted with macOS `sips`, JPEG quality 91, without cropping or other edits.
- Source PNG retained at `/Users/bytedance/.codex/generated_images/01a0a98e-76cf-7721-8c47-7ae0af144ccb/exec-ca18bd86-d4b2-4687-9ddd-3ed0bd64f31a.png`.
- Visual review: hand-painted clouds and warm directional sun; a thin distant ridge and tiny distant silhouettes; no foreground objects, text, watermark or UI. Generated panoramic texture; seamless spherical continuity is not guaranteed.

### Final generation prompt

```text
Use case: stylized-concept.
Asset type: production sky background texture for an explorable first-person 3D campus game, not a scene illustration or screenshot.
Create a polished 2:1 equirectangular 360-degree anime sky panorama, ideally 3072x1536. The horizon is exactly the horizontal midpoint. Sky occupies the upper hemisphere: crystalline cyan-blue zenith, exquisite hand-painted sculptural white cumulus clouds with luminous warm edges and cool subtle interiors, some wispy streaks, warm clear late-afternoon sunlight entering from the upper right. Mature, cinematic Japanese animation background painting, nuanced natural color, confident clean detailed brushwork, high clarity, appealing depth, not pastel or low-poly.
On the exact horizon only, add a very thin low distant misty blue mountain ridge and extremely tiny sparse campus/city roof silhouettes, all several kilometers away, nothing projecting more than a few percent above horizon. Lower hemisphere is only a smooth soft muted horizon-color field without detail, because game terrain will hide it. Keep the extreme upper and lower edges appropriate for spherical wrapping; left and right edges must seamlessly join as a full 360-degree environment.
No foreground whatsoever. No nearby architecture, roads, trees, mountains in foreground, ground texture, people, animals, vehicles, objects, text, signs, UI, borders, logos, or watermark. No fisheye circular framing, no globe, no grid or visible projection lines. This image will be wrapped directly onto a sphere as the distant sky of a 3D game.
```
