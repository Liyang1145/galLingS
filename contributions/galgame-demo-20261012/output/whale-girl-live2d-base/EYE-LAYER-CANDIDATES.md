# Eye layering experiment

Status: candidate assets only, not yet integrated or accepted. Native full-body rig remains authoritative.

Generated with built-in image_gen using eye-viewer-left-draft-v1.png as edit target.

Prompt 1: Remove only iris, pupil and iris highlights; fill with softly shaded white sclera. Preserve eye outline, navy lashes, lower eyelid, orientation, position and proportions. Transparent background, no extra objects.

Prompt 2: Isolate blue iris, dark pupil and existing highlights. Remove sclera/lashes/lids; reconstruct upper hidden portion as a complete disk. Preserve painted blue radial texture. Transparent background. Requested original position and diameter were not retained precisely; placement must be checked in Cubism.

Files: layers/eye-white-viewer-left-candidate-v2.png and layers/iris-blue-candidate-v2.png.

eye-layer-test-v2.psd is an isolated two-layer experiment. Packaging scales/repositions the iris to approximately match the source eye. It does not replace the character PSD or native model. Iris must be clipped to an eye-opening mask and rendered below lashes; the current white/lash combined asset may require a separate mask or lash mesh to prevent iris covering the upper lash.

Acceptance still required: no iris squash through blink, no iris spill over lashes, correct eye position and identity, left/right symmetry appropriate to pose, full-body rig integration, fresh runtime export and local game test.

## Cubism clipping experiment, 2026-10-11 11:52

Saved eye-layer-test-v2.cmo3, 724634 bytes. Iris_Test clipping ID is EyeWhite_Test. Editor rendering confirmed clipping at the lower edge. Upper iris still covers the combined white/lash layer, so this is not an accepted eye rig.

Generated layers/eyelash-overlay-candidate-v2.png with built-in image_gen. Prompt: retain only navy upper eyelash band and fine lower eyelid/lashes; remove entire sclera interior to transparency; preserve original shape, size and position on 1280 square canvas; no iris, white, skin or text. The output has visible outline/placement drift and must be aligned and inspected before adoption. It has not been imported into the test model yet.

## Overlay imported and roughly aligned

Imported eye-lash-import-v2.psd into the existing eye-layer-test-v2 model as new mesh Lash_Overlay_Test, above Iris_Test. At 89.6% editor zoom, scaled its full-canvas bounding box from (1220,147)-(2362,1289) to approximately (1268,174)-(2308,1220). Upper lashes now visibly cover iris. Lower outline is substantially closer to the white-layer edge, but small double outlines and lower iris spill remain. Native test saved. No blink binding or full-body integration yet. Next: align mask to inner eyelid boundaries, create blink deformation affecting mask/lashes while leaving iris unsquashed, verify intermediate values.

## Mask edge and blink hierarchy

EyeWhite_Test bottom bounding-box handle moved from screen (1791,1289) to (1791,1273) at 89.6%, tightening lower clipping boundary. Visible lower blue spill reduced. Created Eyelid_Blink_Test (ID Warp), 5x9 transform grid, 2x6 Bezier divisions, parent Root. EyeWhite_Test and Lash_Overlay_Test are children; Iris_Test stays at Root and clips to EyeWhite_Test. This prepares independent eyelid motion without iris compression. No parameter keys or blink deformation authored yet. Native saved after hierarchy changes. Full-body native unchanged.

Both EyeWhite_Test and Lash_Overlay_Test initially had only quad meshes. Applied Cubism auto-mesh preset deformation-heavy to both: outer/inner spacing 25, outer margin 3, inner margin 2, minimum margin 2, minimum boundary points 5, alpha threshold 0. Dense contour meshes confirmed visually and saved. Warp still has no blink keys. Iris remains independent and undeformed. Next author blink keys after this necessary topology preparation.

## Half-blink first pass

Eyelid_Blink_Test now binds ParamEyeROpen at 0, 0.5, 1. Only 0.5 has been shaped; 0 is still identical to open and must be completed before use. At 89.6%, center-column Bezier anchors changed from y507 to670, y710 to790, y913 to875, x1791 unchanged. Other anchors unchanged. Bounding box hidden through Display menu before middle anchor edit. Iris pupil/highlight geometry remains unchanged while lid and mask occlude it. Observed half-blink has narrower opening but still needs corner and lash-thickness refinement; not final accepted. Native saved with parameter at0.5.

## Closed endpoint first pass

At ParamEyeROpen=0, all three columns (screen x1171,1791,2410) of Bezier rows originally y507,710,913 moved respectively to y755,795,800 at 89.6% zoom. Other rows unchanged. Native saved at0. Eye slit now narrow across width, but a blue iris strip remains and lashes flatten excessively. This is NOT fully closed or accepted. Next: hide iris/white at exact0 with opacity keys while preserving0.5/1, refine closed lash curve and intermediate interpolation; do not treat this geometry as release quality.

Iris_Test and EyeWhite_Test now each bind ParamEyeROpen at0,0.5,1 with opacity0,100,100 percent. Exact0 blue and white remnants disappear, leaving Lash_Overlay_Test. A sample near0.25 (slider x719, displayed0.3) reveals unwanted semitransparent iris/white, because opacity interpolates across0..0.5. Must tighten fade interval near zero or complete geometric masking before acceptance. Current editor selects EyeWhite_Test at this intermediate value. Native saved; full-body model unchanged.

## 2026-10-11 12:44 checkpoint

Changed opacity middle keys on Iris_Test and EyeWhite_Test to 0.05, then explicitly restored each to 100 percent (key editor initially interpolated 10 percent). Sample near 0.25 now shows opaque iris and white; iris inspector confirms 100 percent. Saved eye-layer-test-v2.cmo3, 1083932 bytes, last write 12:44:48. Full-body model unchanged. Closed lash still too flat and near-zero geometric opening still too wide; prototype not accepted for integration.

Reinspected both resent JPG references. Preserve broad soft cheeks, short rounded chin transition, narrow almond eyes with upper lids occluding irises. Eye-line slope follows head roll and pitch; do not introduce arbitrary one-eye vertical offsets at neutral. First reference guides full-body proportions and clothing; second informs face volume and lowered lids but its pitched perspective must not be copied directly into a neutral face.

## Closed-curve refinement checkpoint
At EyeROpen=0, edited center Bezier anchors via observed screen drags at89.6%: bottom(1791,800)->(1791,838), middle(1791,791)->(1791,834), upper(1791,755)->(1791,821). After parameter reselection Cubism redisplays adjusted control positions; do not assume drag targets equal serialized anchor coordinates. Upper side anchors(1171,755) and(2410,755) moved to y780. Closed lash now shallow downward curve instead of upward/flat line. Sample0.05 still reveals blue slit; half-open0.5 remains opaque with independent iris. Saved at0.5. Still needs geometric closure, lash thickness and duplicate-contour cleanup before integration. Fullbody unchanged.

## Dedicated sclera mask imported
Hiding Lash_Overlay_Test at0.5 visibly exposes iris above the inner upper-lid edge: existing EyeWhite_Test alpha includes eyelashes and is an invalid precise sclera mask. Generated sclera-only-candidate-v3.png using built-in image_gen, edit target eye-white-viewer-left-candidate-v2.png; request remove all lashes/outline/skin, retain canvas registration and opaque sclera. Output has small edge flecks, needs QA. Original exec-8fa83cca-5b15-4596-a619-c66acbcf001d.png retained in generated_images. Packaged sclera-import-v3.psd via config, pixelRoundtrip true. Imported as NEW mesh Sclera_Only_Test into eye-layer-test-v2.cmo3. SAVED, EyeROpen=1. New mesh is ROOT, not yet meshed/bound/ordered or used for clipping. Lash_Overlay_Test temporarily hidden. Next: dense mesh, bind new sclera to Eyelid_Blink_Test at1, draworder below iris, replace iris clipID with new sclera ID, hide obsolete EyeWhite and restore Lash, then check geometry/opacity. Fullbody unchanged.

## Sclera mask binding checkpoint
Sclera_Only_Test auto mesh deformation-heavy (25/25 spacing,3/2 margins,min2,minpoints5,alpha0), bound to Eyelid_Blink_Test at EyeROpen1, draworder490. Iris_Test clipID now Sclera_Only_Test. EyeWhite_Test editor visibility OFF, Lash_Overlay_Test ON. Open1 and half0.5 observed: iris no longer extends into lash alpha, but visible transparent/white strip remains between sclera top and upper lash due to registration difference. Next lift/extend sclera upper boundary under lash at neutral, inspect0/0.05 closure; new sclera has no opacity keys yet. Do not integrate before fixing seam. Saved at0.5 with Iris selected.

## Upper seam fixed; closure experiment reverted
At EyeROpen1, Sclera_Only_Test bbox top-center(1854,596)->(1854,577), extending upper alpha under lash. Open and0.5 visually eliminate upper seam. Added Sclera EyeROpen keys0,0.5,1. Tried at0 bboxbottom839->815: near0.05 iris nearly disappears but0.25 shows severe lower transparent gap because independent sclera compression departs from lash contour. Ctrl+Z reverted this one compression; observed original bboxbottom839 restored. Keep upper seam extension and three identical sclera keys. Saved at0 selected Sclera. Next correct shared lid warp closure or dedicated paired upper/lower lid deformation; do not repeat independent whole-sclera squeeze. Current exact0 still white remnant; iris opacity0 hides blue. Fullbody unchanged.

## Shared closure refinement
Edited Eyelid_Blink_Test at0: observed center upperanchor(1791,814)->(1791,826), side upperanchors(1171,780)->(1171,790) and(2410,780)->(2410,790). EyeWhite remains hidden; Sclera and Lash share warp. Sample near0.25 now keeps sclera filling lower lash contour without independent-compression hole. Closed line remains thin with possible residual white: needs clean endpoint inspection without overlay and likely opacity0 only in tiny interval. Saved near0.25, Warp selected. Fullbody unchanged.

## Sclera endpoint opacity completed
Sclera_Only_Test keys changed from0,0.5,1 to0,0.05,1 before opacity editing; then at0 opacity set0. At0.25 inspector confirms100 percent and opaque sclera. Native saved with Sclera selected at0.25. Geometry unchanged this turn. Endpoint clean visual inspection without mesh still needed; lash closed contour still thin. User asked progress: reported fullbody basic rig is initial, eye prototype not integrated, quality/game testing outstanding, no GitHub upload.

## Clean endpoint inspection and lash continuity
Deselected mesh at0: no blue/white fill, but lash central line was near-invisible/discontinuous after overcompression. Selected Warp and moved observed center upperanchor(1791,824)->(1791,800), then deselected. Continuous dark central line restored; contour still too straight and lower fine line remains separated. Saved at0, nothing selected. Do not call blink final or integrate yet; refine curvature without collapsing mesh, test intermediates again.

## Rejected curvature experiment - editor differs from disk
Tried center control drags833->853,827->847,800->820 at0. Clean view showed enlarged gap between upper/lower lash, not acceptable. Issued three Ctrl+Z; Cubism undo appears granular (handles/control geometry), screenshot still differs from pre-experiment. DID NOT SAVE. Disk checkpoint remains13:17:24,1246199bytes. Ctrl+O same cmo only activated existing document, did not reload. Next safely restore disk checkpoint by closing ONLY eye-layer-test-v2 tab without saving then reopen it, or inspect undo history; do not overwrite disk with current rejected experiment. Need localized lid controls/direct mesh editing instead of repeated fullcanvas warp guesses. Main fullbody untouched.

## Recovery verified and localized lash control created
Closed ONLY eye-layer-test-v2 tab, chose No to save rejected experiment, reopened disk cmo3. Recovery completed, neutralEyeROpen1 visible. Created Lash_Local_Correction (ID Warp2) as parent of Lash_Overlay_Test, child of Eyelid_Blink_Test,5x9 transform and2x6 Bezier, fitted to dense lash mesh bbox rather than full1280canvas. Current at1 selected Warp2; no parameter keys yet, no shape edits on new warp. Saved. Next bind EyeROpen and author local correction using observed anchors; avoid previous fullcanvas anchor/handle confusion. Main fullbody unchanged.

## Local lash keys bound
Selected EyeROpen row explicitly, then added3keys to Lash_Local_Correction:0,0.5,1 confirmed green. No shape edits yet. At0 inherited parent compresses local control rows densely around y800..834; bbox1270..2272,y679..877, centerx1770. Must distinguish anchors from tangent handles and bbox before dragging. Saved at0,local Warp2 selected. First add-key click before selecting parameter had no effect; do not infer key creation from button click alone.

## Local correction first probe
AtEyeROpen0 dragged localWarp2 observed center(1770,829)->(1770,815). Small visible response; likely dense overlapping control/tangent area. Clean view still shows separated lower lashes, not solved. Half0.5 clean view has intact sclera and iris with no new gap. Saved at0.5 deselected. Need identify actual control row with higher zoom or direct mesh selection, avoid repeating ambiguous drags. Existing gray corner markers are editor deformer markers, not yet proven texture artifacts.

## 200 percent control inspection
Zoom set200 via bottom numeric field. At0 selected localWarp2 centerx1730, lower control cluster912..953. Dragged observed(1730,952)->(1730,923); lower contour moved only modestly, parent compression likely reduces effective displacement. Saved at0,localWarp selected,200percent. Visible lower lash still separated aroundy940 fromupper900; not solved. Need different strategy rather than more ambiguous compressed-child adjustments; consider direct ArtMesh closed-key vertex editing or separate upper/lower lash assets. Main fullbody untouched.
