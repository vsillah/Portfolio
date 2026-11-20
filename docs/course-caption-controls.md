# Course caption controls

Agentified and Accelerated share one caption size control. Show three `Aa` samples at the actual small, medium, and large caption scales (currently 14, 18, and 24 px), so learners can preview each choice before selecting it. The samples must share the same font family, weight, style, color, and line-height; only font-size changes. Keep their button footprints and alignment equal. Use `Small captions`, `Medium captions`, and `Large captions` as the button names, and `Caption size` as the accessible group name. Keep one clearly selected choice, keyboard-operable buttons, and the shared browser preference across lessons and workshops.

Keep the control compact at 390 px. The samples carry the visible meaning; a separate `Size` label is unnecessary. Hover must remain visually distinct from selection. Caption off/on, cue timing, native track modes, player geometry, and persistence must continue to work at every size.

Hide the entire size control when English captions are off. Restore it immediately when captions turn on, with the previously selected size still pressed and stored. Turning captions off does not reset the size preference.

The control follows Portfolio's Light, Dark, and System theme setting through the existing `html.dark` and semantic color variables. Keep all three previews the same color within a theme, including the selected preview. Surface, border, selected, hover, and keyboard focus states must remain legible in both course layouts; do not introduce a separate caption theme preference.
