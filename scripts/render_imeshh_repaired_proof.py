"""Render a local iMeshh trumpet slide repair proof; never export source meshes.

Run with Blender: blender -b -noaudio --python this_file -- --asset-zip PATH --out DIR
Only the exact licensed archive SHA-256 is accepted. The source is extracted under
a temporary directory and removed after non-extractable renders are complete.
"""

import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import zipfile

import bpy
from mathutils import Vector


EXPECTED_SHA256 = "5d7d57de0da0cd1defe1c2b61c48bf9d66c73b0d698644bb0715ba75b92526fa"
FIRST_IDS = {6, 14, 29, 30, 34, 44, 49, 51, 58, 61, 65, 71}
THIRD_IDS = {7, 9, 20, 21, 28, 31, 35, 36, 52, 62, 68, 69}
PISTON_IDS = {1: 24, 2: 23, 3: 22}
TRAVEL_M = 0.008
PISTON_TRAVEL_M = 0.004
FPS = 24
FRAMES = 96


def args_after_dashdash():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset-zip", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--preview-only", action="store_true")
    parser.add_argument("--stills-only", action="store_true")
    parser.add_argument("--milestone-clips", action="store_true")
    parser.add_argument("--milestone-limit", type=int, default=6)
    parsed = parser.parse_args(args)
    if not parsed.asset_zip.is_file():
        parser.error("Local licensed ZIP is missing")
    digest = hashlib.sha256(parsed.asset_zip.read_bytes()).hexdigest()
    if digest != EXPECTED_SHA256:
        parser.error("Licensed ZIP SHA-256 mismatch; refusing a different source")
    if not 1 <= parsed.milestone_limit <= 6:
        parser.error("Milestone limit must be between one and six")
    return parsed


def component_signatures(mesh):
    parent = list(range(len(mesh.vertices)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for edge in mesh.edges:
        a, b = find(edge.vertices[0]), find(edge.vertices[1])
        if a != b:
            parent[b] = a
    groups = collections.defaultdict(list)
    for index, vertex in enumerate(mesh.vertices):
        groups[find(index)].append(vertex.co)
    signatures = {}
    for number, coordinates in enumerate(sorted(groups.values(), key=len, reverse=True)):
        lo = tuple(round(min(v[axis] for v in coordinates), 4) for axis in range(3))
        hi = tuple(round(max(v[axis] for v in coordinates), 4) for axis in range(3))
        key = (len(coordinates), lo, hi)
        if key in signatures:
            raise RuntimeError("Ambiguous loose-component signature")
        signatures[key] = number
    if len(signatures) != 82:
        raise RuntimeError(f"Expected 82 loose parts; found {len(signatures)}")
    return signatures


def separate_and_map(source):
    signatures = component_signatures(source.data)
    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True)
    bpy.context.view_layer.objects.active = source
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    mapped = {}
    for obj in bpy.context.selected_objects:
        if obj.type != "MESH":
            continue
        coords = [vertex.co for vertex in obj.data.vertices]
        lo = tuple(round(min(v[axis] for v in coords), 4) for axis in range(3))
        hi = tuple(round(max(v[axis] for v in coords), 4) for axis in range(3))
        key = (len(coords), lo, hi)
        if key not in signatures:
            raise RuntimeError(f"Unmapped loose component: {key}")
        part_id = signatures[key]
        obj.name = f"LOCAL_ONLY__component_{part_id:02d}"
        mapped[part_id] = obj
    if len(mapped) != 82:
        raise RuntimeError(f"Mapped {len(mapped)} components, expected 82")
    return mapped


def parent_preserving_world(obj, root):
    world = obj.matrix_world.copy()
    obj.parent = root
    obj.matrix_world = world


def make_root(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def make_tube(name, local_x, local_z, start_y, end_y, outer_radius, inner_radius,
              source_matrix, parent, material):
    # Open annular ends. The inner shank is a true tube, not a capped cylinder.
    segments = 32
    vertices = []
    for y, radius in ((start_y, outer_radius), (end_y, outer_radius),
                      (start_y, inner_radius), (end_y, inner_radius)):
        for index in range(segments):
            angle = 2 * math.pi * index / segments
            local = Vector((local_x + radius * math.cos(angle), y,
                            local_z + radius * math.sin(angle)))
            vertices.append(tuple(source_matrix @ local))
    faces = []
    for index in range(segments):
        next_index = (index + 1) % segments
        faces.extend(((index, next_index, segments + next_index, segments + index),
                      (2 * segments + next_index, 2 * segments + index,
                       3 * segments + index, 3 * segments + next_index),
                      (index, 2 * segments + index, 2 * segments + next_index, next_index),
                      (segments + next_index, 3 * segments + next_index,
                       3 * segments + index, segments + index)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(material)
    parent_preserving_world(obj, parent)
    return obj


def smooth_pulse(frame, begin, end):
    if frame < begin or frame > end:
        return 0.0
    phase = (frame - begin) / (end - begin)
    return math.sin(math.pi * phase) ** 2


def state(frame, roots):
    roots["piston_1"].location.z = -PISTON_TRAVEL_M * smooth_pulse(frame, 0, 23)
    roots["first"].location.y = -TRAVEL_M * smooth_pulse(frame, 24, 47)
    roots["piston_3"].location.z = -PISTON_TRAVEL_M * smooth_pulse(frame, 48, 71)
    roots["third"].location.y = TRAVEL_M * smooth_pulse(frame, 72, 95)


def milestone_state(step, frame, total, roots):
    for name in ("piston_1", "piston_2", "piston_3"):
        roots[name].location.z = 0
    roots["first"].location.y = 0
    roots["third"].location.y = 0
    if step == 6:
        span = total // 3
        for index, name in enumerate(("piston_1", "piston_2", "piston_3")):
            local = frame - index * span
            if 0 <= local < span:
                roots[name].location.z = -PISTON_TRAVEL_M * math.sin(math.pi * local / (span - 1)) ** 2
        return
    pulse = math.sin(math.pi * frame / (total - 1)) ** 2
    if step == 1:
        roots["piston_1"].location.z = -PISTON_TRAVEL_M * pulse
    elif step == 2:
        roots["first"].location.y = -TRAVEL_M * pulse
    elif step == 3:
        roots["piston_2"].location.z = -PISTON_TRAVEL_M * pulse
    elif step == 4:
        roots["third"].location.y = TRAVEL_M * pulse
    elif step == 5:
        roots["piston_3"].location.z = -PISTON_TRAVEL_M * pulse


def aim(camera, target):
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_render(scene, presentation):
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 960
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
    scene.render.fps = FPS
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = -0.55
    world = scene.world or bpy.data.worlds.new("Dark studio")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes.clear()
    background = world.node_tree.nodes.new("ShaderNodeBackground")
    background.inputs["Color"].default_value = (0.012, 0.018, 0.022, 1)
    background.inputs["Strength"].default_value = 0.3
    output = world.node_tree.nodes.new("ShaderNodeOutputWorld")
    world.node_tree.links.new(background.outputs["Background"], output.inputs["Surface"])
    # The supplied shaders were tuned for a different lighting rig. Keep their
    # brass/chrome/rubber identity while using a repeatable local studio setup.
    material_looks = {
        "Metal_Gold_Marked_01_2k": ((0.55, 0.30, 0.065, 1), 0.80, 0.31),
        "Metal_Chrome_01": ((0.60, 0.65, 0.69, 1), 0.86, 0.28),
        "Darker_Silver_01_2k": ((0.35, 0.39, 0.43, 1), 0.80, 0.34),
        "Black_Plastic_01": ((0.026, 0.029, 0.032, 1), 0.12, 0.48),
        "Black_Rubber_01": ((0.018, 0.019, 0.020, 1), 0.05, 0.66),
        "Cork_01_2k": ((0.21, 0.13, 0.07, 1), 0.0, 0.72),
    }
    for name, (color, metallic, roughness) in material_looks.items():
        material = bpy.data.materials.get(name)
        if material is None:
            raise RuntimeError(f"Expected source material missing: {name}")
        material.use_nodes = True
        material.node_tree.nodes.clear()
        shader = material.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Metallic"].default_value = metallic
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Coat Weight"].default_value = 0.12 if metallic > 0.5 else 0.0
        output_material = material.node_tree.nodes.new("ShaderNodeOutputMaterial")
        material.node_tree.links.new(shader.outputs["BSDF"], output_material.inputs["Surface"])
    camera_data = bpy.data.cameras.new("Locked mechanical proof camera")
    camera = bpy.data.objects.new(camera_data.name, camera_data)
    scene.collection.objects.link(camera)
    camera.location = (0.75, 0, 0.07)
    aim(camera, (0, 0, 0.015))
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 0.70
    scene.camera = camera
    for name, location, energy, size in (
        ("Large soft key", (0.48, -0.28, 0.38), 15, 0.36),
        ("Upper rim", (-0.25, 0.12, 0.37), 18, 0.30),
        ("Front fill", (0.35, 0.30, -0.08), 8, 0.42),
    ):
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new(name, light_data)
        scene.collection.objects.link(light)
        light.location = location
        aim(light, (0, 0, 0.01))
    return camera


def render_frame(scene, path):
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    # Drop Blender text/EXIF ancillary chunks so the committed PNG contains
    # image data only. The original pixel stream and CRCs remain untouched.
    data = path.read_bytes()
    cleaned = bytearray(data[:8])
    offset = 8
    while offset < len(data):
        length = struct.unpack_from(">I", data, offset)[0]
        kind = data[offset + 4 : offset + 8]
        if kind in (b"IHDR", b"IDAT", b"IEND"):
            cleaned.extend(data[offset : offset + length + 12])
        offset += length + 12
        if kind == b"IEND":
            break
    path.write_bytes(cleaned)


def render_still(scene, path, frame):
    state(frame, ROOTS)
    render_frame(scene, path)


def render_milestones(scene, output_dir, limit):
    scene.render.film_transparent = True
    scene.render.image_settings.color_mode = "RGBA"
    scene.camera.data.ortho_scale = .62
    milestone_state(1, 0, 24, ROOTS)
    scene.cycles.samples = 24
    render_frame(scene, output_dir / "poster.png")
    scene.cycles.samples = 10
    for step in range(1, limit + 1):
        count = 36 if step == 6 else 24
        with tempfile.TemporaryDirectory(prefix=f"trumpet-milestone-{step}-") as frames_dir:
            for frame in range(count):
                milestone_state(step, frame, count, ROOTS)
                render_frame(scene, Path(frames_dir) / f"{frame:04d}.png")
            duration = count / FPS
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-f", "lavfi", "-i", f"color=c=0x121e31:s=960x600:r={FPS}:d={duration}",
                "-framerate", str(FPS), "-i", str(Path(frames_dir) / "%04d.png"),
                "-filter_complex", "[0:v][1:v]overlay=shortest=1:format=auto,format=yuv420p[v]",
                "-map", "[v]", "-map_metadata", "-1", "-an",
                "-c:v", "libx264", "-crf", "17", "-movflags", "+faststart", "-y",
                str(output_dir / f"step-{step:02d}.mp4"),
            ], check=True)


if __name__ == "__main__":
    arguments = args_after_dashdash()
    arguments.out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="licensed-imeshh-trumpet-") as temporary:
        with zipfile.ZipFile(arguments.asset_zip) as archive:
            names = [name for name in archive.namelist() if name.lower().endswith(".blend")]
            if len(names) != 1:
                raise RuntimeError("Expected one native Blender file in the exact archive")
            archive.extractall(temporary)
        bpy.ops.wm.open_mainfile(filepath=str(Path(temporary) / names[0]))
        scene = bpy.context.scene
        source = bpy.data.objects.get("Decorations_Instruments_Trumpet_01")
        laying = bpy.data.objects.get("Decorations_Instruments_Trumpet_01_Laying")
        if source is None or laying is None:
            raise RuntimeError("Expected upright and laying meshes are missing")
        bpy.data.objects.remove(laying, do_unlink=True)
        source_matrix = source.matrix_world.copy()
        parts = separate_and_map(source)
        presentation = make_root("LOCAL_ONLY__presentation")
        ROOTS = {name: make_root("LOCAL_ONLY__" + name, presentation) for name in
                 ("piston_1", "piston_2", "piston_3", "first", "third")}
        for part_id, obj in parts.items():
            group = ("first" if part_id in FIRST_IDS else
                     "third" if part_id in THIRD_IDS else
                     "piston_1" if part_id == PISTON_IDS[1] else
                     "piston_2" if part_id == PISTON_IDS[2] else
                     "piston_3" if part_id == PISTON_IDS[3] else None)
            parent_preserving_world(obj, ROOTS[group] if group else presentation)
        gold = bpy.data.materials.get("Metal_Gold_Marked_01_2k")
        chrome = bpy.data.materials.get("Metal_Chrome_01")
        if gold is None or chrome is None:
            raise RuntimeError("Expected source materials missing")
        # Original tube centers and end intervals measured from the exact 82-part archive.
        # Female sleeves wrap the source slide shanks and remain fixed. Newly authored
        # inner shanks move with the complete crooks and remain inside both sleeves.
        repair = [
            ("first_upper", -.0140, .0548, -.030, .012, -.044, .014, "first"),
            ("first_lower", -.0139, .0356, -.030, .012, -.044, .014, "first"),
            ("third_upper", -.0228, .0549, .048, .086, .039, .103, "third"),
            ("third_lower", -.0296, .0349, .048, .086, .039, .103, "third"),
        ]
        overlaps = {}
        source_tube_overlaps = {}
        minimum_radial_clearance = 1.0
        for name, x, z, fixed_a, fixed_b, moving_a, moving_b, group in repair:
            source_outer_radius = {"first_upper": .00666, "first_lower": .00668,
                                   "third_upper": .00570, "third_lower": .00559}[name]
            source_inner_radius = {"first_upper": .00572, "first_lower": .00575,
                                   "third_upper": .00460, "third_lower": .00481}[name]
            sleeve_inner_radius = .0069 if group == "first" else .0059
            sleeve_outer_radius = .0076 if group == "first" else .0066
            shank_outer_radius = .0044
            clearance = min(sleeve_inner_radius - source_outer_radius,
                            source_inner_radius - shank_outer_radius)
            minimum_radial_clearance = min(minimum_radial_clearance, clearance)
            if clearance < .00015:
                raise RuntimeError(f"Interference or insufficient radial clearance: {name} {clearance}")
            make_tube(name + "_fixed_outer_sleeve", x, z, fixed_a, fixed_b,
                      sleeve_outer_radius, sleeve_inner_radius,
                      source_matrix, presentation, gold)
            make_tube(name + "_moving_inner_shank", x, z, moving_a, moving_b,
                      shank_outer_radius, .0036, source_matrix, ROOTS[group], chrome)
            delta = -TRAVEL_M if group == "first" else TRAVEL_M
            overlap = max(0, min(fixed_b, moving_b + delta) - max(fixed_a, moving_a + delta))
            overlaps[name] = round(overlap, 5)
            if overlap < .020:
                raise RuntimeError(f"Insufficient inner-shank overlap: {name} {overlap}")
            # The original moving outer tubes must also remain inserted in the
            # new female sleeves, so the narrower new shank is never a fake bridge.
            source_end = {"first_upper": -.0072, "first_lower": -.0071,
                          "third_upper": .0610, "third_lower": .0615}[name]
            source_overlap = (source_end - TRAVEL_M - fixed_a if group == "first"
                              else fixed_b - source_end - TRAVEL_M)
            source_tube_overlaps[name] = round(source_overlap, 5)
            if source_overlap < .012:
                raise RuntimeError(f"Original slide exits fixed sleeve: {name} {source_overlap}")
        presentation.rotation_euler.x = math.radians(40)
        camera = setup_render(scene, presentation)
        if arguments.milestone_clips:
            render_milestones(scene, arguments.out, arguments.milestone_limit)
        elif arguments.preview_only:
            render_still(scene, arguments.out / "repaired-preview.png", 36)
        else:
            for group, frames, focus in (
                ("first", (24, 36, 47), (-.014, -.075, .045)),
                ("third", (72, 84, 95), (-.025, .065, .045)),
            ):
                original_location = camera.location.copy()
                original_scale = camera.data.ortho_scale
                world_focus = presentation.matrix_world @ (source_matrix @ Vector(focus))
                camera.location = world_focus + Vector((.62, 0, .025))
                aim(camera, world_focus)
                camera.data.ortho_scale = .25
                for label, frame in zip(("start", "mid", "end"), frames):
                    render_still(scene, arguments.out / f"{group}-{label}.png", frame)
                camera.location = original_location
                aim(camera, (0, 0, .015))
                camera.data.ortho_scale = original_scale
            if not arguments.stills_only:
                scene.cycles.samples = 12
                with tempfile.TemporaryDirectory(prefix="trumpet-proof-frames-") as frames_dir:
                    for frame in range(FRAMES):
                        render_still(scene, Path(frames_dir) / f"{frame:04d}.png", frame)
                    subprocess.run([
                        "ffmpeg", "-hide_banner", "-loglevel", "error", "-framerate", str(FPS),
                        "-i", str(Path(frames_dir) / "%04d.png"), "-map_metadata", "-1",
                        "-vf", "crop=864:540:48:40,scale=960:600:flags=lanczos",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart",
                        "-y", str(arguments.out / "repaired-mechanical-proof.mp4"),
                    ], check=True)
        print("REPAIRED_PROOF", json.dumps({"source_sha256": EXPECTED_SHA256,
              "component_count": len(parts), "first_ids": sorted(FIRST_IDS),
              "third_ids": sorted(THIRD_IDS), "pistons": PISTON_IDS,
              "slide_travel_m": TRAVEL_M, "piston_travel_m": PISTON_TRAVEL_M,
              "minimum_inner_shank_overlap_m": min(overlaps.values()),
              "minimum_source_tube_overlap_m": min(source_tube_overlaps.values()),
              "minimum_radial_clearance_m": round(minimum_radial_clearance, 6),
              "overlaps_m": overlaps, "source_tube_overlaps_m": source_tube_overlaps,
              "frames": (arguments.milestone_limit * 24 + (12 if arguments.milestone_limit == 6 else 0))
              if arguments.milestone_clips else (1 if arguments.preview_only else
              (0 if arguments.stills_only else FRAMES))}))
