"""Build a deterministic B-flat piston trumpet anatomy checkpoint in Blender.

Run: blender -b -noaudio --python scripts/render_trumpet_master.py
All coordinates are metres. The Yamaha owner manual and YTR-4335GII bore/bell
specifications are the reference anchors; other dimensions are documented as
measured visual assumptions in the adjacent source register.
"""

import json
import math
import shutil
import subprocess
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "design-files/trumpet-trainer/deterministic-master"
QA = ROOT / "docs/qa/trumpet-recruitment-visual-story/deterministic-master"
OUT.mkdir(parents=True, exist_ok=True)
QA.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for data in bpy.data.materials:
    bpy.data.materials.remove(data)

scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.render.resolution_x = 1600
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.14, 0.16, 0.19, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
scene.view_settings.view_transform = "AgX"
scene.view_settings.exposure = -0.70


def material(name, color, metallic, roughness):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1)
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    return mat


brass = material("Lacquered yellow brass", (0.48, 0.235, 0.036), 0.78, 0.31)
gold = material("Gold brass bell", (0.53, 0.265, 0.052), 0.79, 0.30)
nickel = material("Nickel silver slide inner tubes", (0.45, 0.49, 0.52), 0.87, 0.26)
dark = material("Valve felt and water-key cork", (0.045, 0.044, 0.038), 0.12, 0.55)
for lacquer in (brass, gold):
    shader = lacquer.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Coat Weight"].default_value = 0.28
    shader.inputs["Coat Roughness"].default_value = 0.18


def empty(name, parent=None, loc=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.012
    obj.location = loc
    if parent:
        obj.parent = parent
    return obj


master = empty("TRUMPET_MASTER__static_root")
bell_group = empty("01_Bell_and_return_bow__fixed", master)
lead_group = empty("02_Leadpipe_and_main_tuning__fixed", master)
valves_group = empty("03_Three_valve_casings__fixed", master)
first_fixed = empty("04_First_slide_sleeves__fixed", master)
first_move = empty("FIRST_SLIDE__translate_negative_X", master)
second_fixed = empty("05_Second_valve_slide__fixed", master)
third_fixed = empty("06_Third_slide_sleeves__fixed", master)
third_move = empty("THIRD_SLIDE__translate_positive_X", master)
hardware = empty("07_Braces_keys_and_finger_hook__fixed", master)
piston_roots = [empty(f"PISTON_{i}__translate_negative_Z", master) for i in (1, 2, 3)]


def assign(obj, name, mat, parent, collection=None):
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def tube(name, points, radius, mat, parent, resolution=16):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 24
    curve.bevel_depth = radius
    curve.bevel_resolution = max(3, resolution // 4)
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for p, xyz in zip(spline.points, points):
        p.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    return assign(obj, name, mat, parent)


def cylinder(name, center, radius, depth, mat, parent, axis="Z", vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center)
    obj = bpy.context.object
    if axis == "X":
        obj.rotation_euler[1] = math.pi / 2
    elif axis == "Y":
        obj.rotation_euler[0] = math.pi / 2
    return assign(obj, name, mat, parent)


def torus(name, center, major, minor, mat, parent, axis="Z"):
    bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=12,
                                     location=center, major_radius=major, minor_radius=minor)
    obj = bpy.context.object
    if axis == "X":
        obj.rotation_euler[1] = math.pi / 2
    elif axis == "Y":
        obj.rotation_euler[0] = math.pi / 2
    return assign(obj, name, mat, parent)


def u_path(x_start, x_end, y, z_top, z_bottom, direction, samples=24):
    """Straight paired legs and one tangent semicircular crook in the XZ plane."""
    centre = (z_top + z_bottom) / 2
    radius = (z_top - z_bottom) / 2
    points = [(x_start, y, z_top), (x_end, y, z_top)]
    for n in range(1, samples + 1):
        theta = math.pi / 2 - math.pi * n / samples
        points.append((x_end + direction * radius * math.cos(theta), y,
                       centre + radius * math.sin(theta)))
    points.append((x_start, y, z_bottom))
    return points


def lathe_x(name, profile, y, z, mat, parent, segments=64):
    vertices = []
    faces = []
    for x, radius in profile:
        for n in range(segments):
            angle = 2 * math.pi * n / segments
            vertices.append((x, y + radius * math.cos(angle), z + radius * math.sin(angle)))
    for ring in range(len(profile) - 1):
        for n in range(segments):
            a = ring * segments + n
            b = ring * segments + (n + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return assign(obj, name, mat, parent)


# The bell return bow exits the first valve, travels toward the player, turns
# through a 70 mm vertical U, and returns in a tapered bell tube.
tube("Bell outlet from first valve", [(-0.087, 0, -0.008), (-0.105, 0.022, -0.008),
                                      (-0.148, 0.022, -0.008),
                                      (-0.199, 0.022, -0.008)], 0.0064, brass, bell_group)
tube("Bell return bow", u_path(-0.199, -0.204, 0.022, 0.067, -0.008, -1),
     0.0064, gold, bell_group)
profile = []
for n in range(85):
    t = n / 84
    x = -0.204 + 0.449 * t
    base = 0.0064 + 0.007 * (t ** 2)
    flare = 0.0478 * max(0, (t - 0.72) / 0.28) ** 2.5
    profile.append((x, base + flare))
lathe_x("One-piece tapered bell body, 123 mm rim", profile, 0.022, 0.067, gold, bell_group)
torus("Rolled bell rim", (0.245, 0.022, 0.067), 0.0615, 0.0016, gold, bell_group, axis="X")
cylinder("Bell ferrule at return bow", (-0.185, 0.022, 0.067), 0.008, 0.011,
         brass, bell_group, axis="X")

# Mouthpiece and leadpipe remain physically separate removable parts. The
# leadpipe flows through the main tuning U and returns into the third valve.
lathe_x("Removable mouthpiece cup and shank", [(-0.329, 0.0055), (-0.327, 0.0070),
        (-0.322, 0.0070), (-0.318, 0.0055), (-0.313, 0.0045), (-0.303, 0.0045),
        (-0.300, 0.0051), (-0.295, 0.0042), (-0.274, 0.0033)],
        -0.024, 0.018, nickel, lead_group)
torus("Mouthpiece rolled cup lip", (-0.329, -0.024, 0.018), 0.0058, 0.0010,
      nickel, lead_group, axis="X")
lathe_x("Mouthpiece receiver", [(-0.282, 0.0062), (-0.279, 0.0073),
        (-0.267, 0.0073), (-0.262, 0.0064), (-0.249, 0.0064)],
        -0.024, 0.018, brass, lead_group)
tube("Leadpipe to main tuning receiver", [(-0.255, -0.024, 0.018), (-0.12, -0.024, 0.018),
                                          (0.088, -0.024, 0.018)], 0.0063, brass, lead_group)
cylinder("Main tuning upper female sleeve", (0.075, -0.024, 0.018), 0.0072,
         0.044, brass, lead_group, axis="X")
cylinder("Main tuning lower female sleeve", (0.075, -0.024, -0.034), 0.0072,
         0.044, brass, lead_group, axis="X")
tube("Main tuning connected U", u_path(0.073, 0.112, -0.024, 0.018, -0.034, 1),
     0.0061, brass, lead_group)
tube("Main tuning return to third valve", [(0.053, -0.024, -0.034),
     (-0.008, -0.024, -0.034), (-0.027, -0.004, -0.034)], 0.0063,
     brass, lead_group)

# Each casing and each independently controlled piston has its own hierarchy.
valve_x = [-0.087, -0.058, -0.029]
for number, x in enumerate(valve_x, start=1):
    cylinder(f"Valve {number} casing", (x, 0.0, -0.018), 0.0100, 0.086,
             brass, valves_group)
    cylinder(f"Valve {number} top cap", (x, 0, 0.028), 0.0114, 0.004,
             nickel, valves_group)
    torus(f"Valve {number} top cap knurl", (x, 0, 0.028), 0.0110, 0.0010,
          nickel, valves_group)
    cylinder(f"Valve {number} bottom cap", (x, 0, -0.064), 0.0115, 0.005,
             nickel, valves_group)
    torus(f"Valve {number} lower knurl", (x, 0, -0.064), 0.0110, 0.0010,
          nickel, valves_group)
    root = piston_roots[number - 1]
    cylinder(f"PISTON_{number}__body", (x, 0, -0.026), 0.0084, 0.044,
             nickel, root)
    cylinder(f"PISTON_{number}__stem", (x, 0, 0.036), 0.0019, 0.012,
             nickel, root)
    cylinder(f"PISTON_{number}__button", (x, 0, 0.043), 0.0057, 0.0020,
             nickel, root)
    torus(f"PISTON_{number}__button_rim", (x, 0, 0.044), 0.0055, 0.0006,
          nickel, root)
    cylinder(f"PISTON_{number}__felt", (x, 0, 0.032), 0.0062, 0.0012,
             dark, root)

# First slide: the two inner shanks and their crook share a moving parent. They
# overlap the fixed female sleeves by >=20 mm at the 18 mm outward stop.
first_top, first_bottom, first_y = -0.028, -0.047, -0.031
for label, z in (("upper", first_top), ("lower", first_bottom)):
    tube(f"First valve {label} port elbow", [(-0.087, 0, z), (-0.101, -0.018, z),
         (-0.115, first_y, z)], 0.0058, brass, first_fixed)
    cylinder(f"First slide {label} female sleeve", (-0.120, first_y, z),
             0.0067, 0.030, brass, first_fixed, axis="X")
tube("FIRST_SLIDE__paired_inner_shanks_and_crook",
     u_path(-0.085, -0.150, first_y, first_top, first_bottom, -1),
     0.0055, brass, first_move)
for label, z in (("upper", first_top), ("lower", first_bottom)):
    cylinder(f"FIRST_SLIDE__{label}_nickel_inner", (-0.141, first_y, z),
             0.0057, 0.012, nickel, first_move, axis="X")
tube("FIRST_SLIDE__thumb_hook", [(-0.121, first_y - 0.003, first_top),
     (-0.126, first_y - 0.011, -0.023), (-0.128, first_y - 0.016, -0.014),
     (-0.125, first_y - 0.017, -0.009), (-0.119, first_y - 0.014, -0.012)],
     0.0015, brass, first_move)

# The small second-valve U is fixed in this checkpoint, but its own real tubing
# remains visible and separate from the first and third moving assemblies.
tube("Second valve fixed branch", u_path(-0.058, -0.088, 0.027,
     -0.035, -0.052, -1), 0.0053, brass, second_fixed)
tube("Second valve port returns", [(-0.058, 0, -0.035), (-0.058, 0.027, -0.035)],
     0.0058, brass, second_fixed)
tube("Second valve lower return", [(-0.058, 0.027, -0.052), (-0.058, 0, -0.052)],
     0.0058, brass, second_fixed)

# Third slide is on a separate depth plane below the main tuning loop. Its
# inner shanks remain inserted in both fixed sleeves throughout 25 mm travel.
third_top, third_bottom, third_y = -0.031, -0.050, -0.042
for label, z in (("upper", third_top), ("lower", third_bottom)):
    tube(f"Third valve {label} port elbow", [(-0.029, 0, z), (-0.012, -0.020, z),
         (0.020, third_y, z)], 0.0062, brass, third_fixed)
    cylinder(f"Third slide {label} female sleeve", (0.038, third_y, z),
             0.0067, 0.040, brass, third_fixed, axis="X")
tube("THIRD_SLIDE__paired_inner_shanks_and_crook",
     u_path(-0.008, 0.118, third_y, third_top, third_bottom, 1),
     0.0055, brass, third_move)
for label, z in (("upper", third_top), ("lower", third_bottom)):
    cylinder(f"THIRD_SLIDE__{label}_nickel_inner", (0.063, third_y, z),
             0.0057, 0.018, nickel, third_move, axis="X")
torus("THIRD_SLIDE__finger_ring", (0.028, third_y - 0.012, -0.039),
      0.0090, 0.0016, brass, third_move, axis="Y")
cylinder("THIRD_SLIDE__stopper_collar", (0.065, third_y, third_top),
         0.0065, 0.004, brass, third_move, axis="X")

# Braces, finger hook, and two spring water keys belong to the fixed body.
for name, path in [
    ("Leadpipe to bell brace", [(-0.152, -0.024, 0.018), (-0.152, 0.022, 0.067)]),
    ("Front bell to leadpipe brace", [(0.019, -0.024, 0.018), (0.019, 0.022, 0.067)]),
    ("Main tuning brace", [(0.057, -0.024, -0.034), (0.057, -0.024, 0.018)]),
]:
    tube(name, path, 0.0033, brass, hardware)
torus("Right hand finger hook", (-0.002, -0.029, 0.006), 0.010,
      0.0018, brass, hardware, axis="Y")
tube("Finger hook welded stem", [(-0.002, -0.024, 0.018),
     (-0.002, -0.029, 0.006)], 0.003, brass, hardware)
for name, x, y, z in [("Main tuning water key", 0.133, -0.024, -0.027),
                      ("Third slide water key", 0.122, third_y, -0.048)]:
    cylinder(f"{name} hinge", (x, y - 0.004, z), 0.0035, 0.007,
             brass, hardware, axis="Y")
    tube(f"{name} spring lever", [(x, y - 0.008, z), (x - 0.018, y - 0.008, z - 0.005)],
         0.0013, nickel, hardware)
    cylinder(f"{name} cork pad", (x - 0.018, y - 0.008, z - 0.005),
             0.003, 0.002, dark, hardware, axis="Y")


def aim(obj, point):
    direction = Vector(point) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def camera(name, loc, target, ortho):
    data = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    data.type = "ORTHO"
    data.ortho_scale = ortho
    aim(obj, target)
    return obj


def area(name, loc, energy, size, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    aim(obj, (-0.02, 0, 0))


area("Large white key", (-0.15, -0.35, 0.30), 42, 0.33)
area("Warm upper rim", (0.12, 0.20, 0.24), 34, 0.27, (1, 0.88, 0.70))
area("Soft lower fill", (0.06, -0.22, -0.22), 22, 0.26)

# Cameras use the engineering axes: X length, Y depth, Z piston direction.
views = {
    "side_orthographic": camera("CAM_side_orthographic", (-0.025, -0.85, 0.015),
                                (-0.04, 0, 0.005), 0.67),
    "front_orthographic": camera("CAM_front_orthographic", (0.78, 0, 0.008),
                                 (-0.04, 0, 0.008), 0.50),
    "top_orthographic": camera("CAM_top_orthographic", (-0.04, 0, 0.78),
                               (-0.04, 0, 0), 0.67),
    "valve_block_closeup": camera("CAM_valve_block_closeup", (-0.12, -0.34, 0.15),
                                  (-0.058, 0, -0.005), 0.24),
    "first_slide_closeup": camera("CAM_first_slide_closeup", (-0.20, -0.33, 0.045),
                                  (-0.143, -0.024, -0.034), 0.22),
    "third_slide_closeup": camera("CAM_third_slide_closeup", (0.12, -0.34, 0.045),
                                  (0.054, -0.034, -0.039), 0.25),
    "upright_candidate": camera("CAM_upright_candidate", (0.15, -0.65, 0.26),
                                (-0.04, 0, 0), 0.68),
}
upright = views["upright_candidate"]
upright.rotation_euler = (upright.rotation_euler.to_quaternion() @
                          Quaternion((0, 0, 1), math.radians(74))).to_euler()

for name, cam in views.items():
    scene.render.resolution_x, scene.render.resolution_y = (
        (1000, 1600) if name == "upright_candidate" else (1600, 1000)
    )
    scene.camera = cam
    scene.render.filepath = str(QA / f"{name}.png")
    bpy.ops.render.render(write_still=True)

# A slow neutral turntable is camera-only; the instrument and mechanics do not
# animate. This is deliberately different from the later timeline phase.
turntable = camera("CAM_neutral_turntable", (-0.035, -0.76, 0.17),
                   (-0.04, 0, 0), 0.68)
scene.camera = turntable
scene.frame_start = 1
scene.frame_end = 48
scene.render.fps = 12
for frame in range(1, 49):
    angle = 2 * math.pi * (frame - 1) / 48
    turntable.location = (-0.04 + 0.70 * math.sin(angle), -0.70 * math.cos(angle), 0.17)
    aim(turntable, (-0.04, 0, 0))
    turntable.keyframe_insert(data_path="location", frame=frame)
    turntable.keyframe_insert(data_path="rotation_euler", frame=frame)

frames = Path("/tmp/trumpet-master-turntable-frames")
frames.mkdir(parents=True, exist_ok=True)
scene.render.resolution_x = 960
scene.render.resolution_y = 600
scene.cycles.samples = 8
scene.render.filepath = str(frames / "frame_")
bpy.ops.render.render(animation=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "12",
                "-i", str(frames / "frame_%04d.png"), "-c:v", "libx264",
                "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart",
                str(QA / "neutral_turntable.mp4")], check=True)
shutil.rmtree(frames)

# Verify independent parent hierarchies and mechanically safe slide travel.
expected = {
    "PISTON_1__translate_negative_Z": "PISTON_1__button",
    "PISTON_2__translate_negative_Z": "PISTON_2__button",
    "PISTON_3__translate_negative_Z": "PISTON_3__button",
    "FIRST_SLIDE__translate_negative_X": "FIRST_SLIDE__paired_inner_shanks_and_crook",
    "THIRD_SLIDE__translate_positive_X": "THIRD_SLIDE__paired_inner_shanks_and_crook",
}
for root_name, child_name in expected.items():
    assert bpy.data.objects[child_name].parent == bpy.data.objects[root_name]
assert len({bpy.data.objects[name].as_pointer() for name in expected}) == 5
def overlap(a0, a1, b0, b1):
    return max(0, min(a1, b1) - max(a0, b0))

assert overlap(-0.150 - 0.018, -0.085 - 0.018, -0.135, -0.105) > 0.02
assert overlap(-0.008 + 0.025, 0.118 + 0.025, 0.018, 0.058) > 0.02

# Keep render-only cameras, lights and floor out of the web-suitable candidate.
bpy.ops.object.select_all(action="DESELECT")
def child_of(obj, ancestor):
    current = obj.parent
    while current:
        if current == ancestor:
            return True
        current = current.parent
    return False

for obj in bpy.data.objects:
    if obj == master or child_of(obj, master):
        obj.select_set(True)
bpy.context.view_layer.objects.active = master
scene.frame_set(1)
bpy.ops.export_scene.gltf(filepath=str(OUT / "trumpet-master-candidate.glb"),
                          export_format="GLB", use_selection=True,
                          export_animations=False, export_cameras=False, export_lights=False)
bpy.ops.object.select_all(action="DESELECT")
bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "trumpet-master.blend"))

manifest = {
    "units": "metres",
    "reference_bell_diameter_m": 0.123,
    "reference_bore_m": 0.01165,
    "first_slide_max_travel_m": 0.018,
    "third_slide_max_travel_m": 0.025,
    "named_moving_roots": expected,
    "static_root": master.name,
    "source_script": "scripts/render_trumpet_master.py",
}
(QA / "hierarchy-check.json").write_text(json.dumps(manifest, indent=2) + "\n")
print("TRUMPET_MASTER_VALIDATED", json.dumps(manifest, sort_keys=True))
