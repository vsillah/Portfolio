"""Validate the saved trumpet checkpoint after Blender opens it from disk."""

import json
from pathlib import Path

import bpy


root = Path(__file__).resolve().parents[1]
qa = root / "docs/qa/trumpet-recruitment-visual-story/deterministic-master"
manifest = json.loads((qa / "hierarchy-check.json").read_text())
master = bpy.data.objects[manifest["static_root"]]

def belongs_to(obj, ancestor):
    node = obj.parent
    while node:
        if node == ancestor:
            return True
        node = node.parent
    return False

for parent_name, moving_name in manifest["named_moving_roots"].items():
    parent = bpy.data.objects[parent_name]
    child = bpy.data.objects[moving_name]
    assert child.parent == parent, (moving_name, parent_name)
    assert belongs_to(parent, master), parent_name

for part in ("Bell outlet from first valve", "Leadpipe to main tuning receiver",
             "Main tuning connected U", "Main tuning return to third valve",
             "Third valve upper port elbow", "Third valve lower port elbow",
             "First valve upper port elbow", "First valve lower port elbow",
             "Main tuning water key spring lever", "Third slide water key spring lever"):
    assert part in bpy.data.objects, part
    assert belongs_to(bpy.data.objects[part], master), part

assert len([obj for obj in bpy.data.objects if obj.type == "MESH" and belongs_to(obj, master)]) > 30
assert len([obj for obj in bpy.data.objects if obj.type == "CURVE" and belongs_to(obj, master)]) > 15
assert (root / "design-files/trumpet-trainer/deterministic-master/trumpet-master-candidate.glb").stat().st_size > 100_000
blend_count = len(bpy.data.objects)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root / "design-files/trumpet-trainer/deterministic-master/trumpet-master-candidate.glb"))
for name in manifest["named_moving_roots"]:
    assert name in bpy.data.objects, ("GLB missing moving root", name)
assert sum(obj.type == "MESH" for obj in bpy.data.objects) > 30
print("CLEAN_LOAD_VALIDATED", json.dumps({
    "blend_object_count": blend_count,
    "glb_object_count": len(bpy.data.objects),
    "moving_roots": list(manifest["named_moving_roots"]),
    "bell_diameter_m": manifest["reference_bell_diameter_m"],
    "bore_m": manifest["reference_bore_m"],
}, sort_keys=True))
