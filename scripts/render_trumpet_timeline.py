"""Rebuild the recruitment timeline trumpet in Blender 5.1.

blender -b --python scripts/render_trumpet_timeline.py -- --output /tmp/trumpet-render --still
blender -b --python scripts/render_trumpet_timeline.py -- --output /tmp/trumpet-render
"""
import bpy
import math
import os
import sys
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
output = args[args.index("--output") + 1] if "--output" in args else "/tmp/trumpet-render"
still = "--still" in args
os.makedirs(output, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic, roughness):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat

brass = material("aged warm brass", (0.56, 0.29, 0.075), .83, .28)
bright = material("polished brass edges", (0.84, 0.57, 0.17), .86, .19)
dark = material("valve well shadow", (0.18, 0.105, 0.04), .68, .4)
pearl = material("ivory valve caps", (.88, .82, .68), .25, .16)

def tube(name, points, radius=.085, mat=brass, parent=None):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 24
    curve.bevel_depth = radius
    curve.bevel_resolution = 5
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, xyz in zip(spline.points, points):
        point.co = (*xyz, 1)
    ob = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    ob.parent = parent
    return ob

def segment(name, a, b, radius, mat=brass, parent=None, vertices=48):
    a, b = Vector(a), Vector(b)
    mid = (a + b) / 2
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=(b-a).length, location=mid)
    ob = bpy.context.object
    ob.name = name
    ob.rotation_euler = (b-a).to_track_quat("Z", "Y").to_euler()
    ob.data.materials.append(mat)
    ob.parent = parent
    for poly in ob.data.polygons: poly.use_smooth = True
    bevel = ob.modifiers.new("soft machined rim", "BEVEL")
    bevel.width = min(.022, radius * .2)
    bevel.segments = 3
    ob.modifiers.new("weighted normals", "WEIGHTED_NORMAL")
    return ob

def slide_loop(name, x_left, x_right, z_open, z_turn, y, radius, up, parent):
    center=(x_left+x_right)/2
    half=(x_right-x_left)/2
    if up:
        pts=[(x_right,y,z_open),(x_right,y,z_turn)]
        pts += [(center+half*math.cos(t),y,z_turn+half*math.sin(t)) for t in [math.pi*i/32 for i in range(1,33)]]
        pts += [(x_left,y,z_open)]
    else:
        pts=[(x_right,y,z_open),(x_right,y,z_turn)]
        pts += [(center+half*math.cos(t),y,z_turn-half*math.sin(t)) for t in [math.pi*i/32 for i in range(1,33)]]
        pts += [(x_left,y,z_open)]
    return tube(name,pts,radius,parent=parent)

# The vertical presentation is based on the approved portrait reference; every part below is mesh/curve geometry.
segment("main leadpipe", (.49, 0, -1.94), (.49, 0, 2.48), .105)
segment("mouthpiece shank", (.49, 0, 2.47), (.49, 0, 2.91), .075, bright)
segment("mouthpiece cup", (.49, 0, 2.9), (.49, 0, 3.11), .16, bright)
segment("mouthpiece lip", (.49, 0, 3.10), (.49, 0, 3.17), .19, pearl)

# Bell is an actual spun mesh, with a hollow dark opening and a bright rolled rim.
profile = [(-1.8,.12),(-2.05,.125),(-2.4,.15),(-2.75,.24),(-3.1,.43),(-3.36,.72),(-3.47,.86)]
verts, faces = [], []
for z, radius in profile:
    for i in range(64):
        a=2*math.pi*i/64
        verts.append((.49+radius*math.cos(a), .02+radius*math.sin(a), z))
for j in range(len(profile)-1):
    for i in range(64): faces.append((j*64+i,j*64+(i+1)%64,(j+1)*64+(i+1)%64,(j+1)*64+i))
mesh=bpy.data.meshes.new("spun bell mesh")
mesh.from_pydata(verts, [], faces)
mesh.update()
bell=bpy.data.objects.new("flared bell",mesh)
bpy.context.collection.objects.link(bell)
bell.data.materials.append(brass)
for poly in bell.data.polygons: poly.use_smooth=True
tube("rolled bell lip",[(.49+.86*math.cos(2*math.pi*i/96),.02+.86*math.sin(2*math.pi*i/96),-3.47) for i in range(97)],.038,bright)
segment("bell throat shadow",(.49,0,-3.47),(.49,0,-3.43),.76,dark)

# Fixed return tubing gives the upper and lower independent slide assemblies a credible home.
segment("upper right receiver",(-.20,.08,1.45),(-.20,.08,1.88),.09)
segment("upper left receiver",(-1.04,.08,1.30),(-1.04,.08,1.77),.09)
segment("lower right receiver",(-.25,.07,-1.13),(-.25,.07,-.72),.09)
segment("lower left receiver",(-1.11,.07,-1.07),(-1.11,.07,-.64),.09)
for x,z in ((-.20,1.85),(-1.04,1.74),(-.25,-1.10),(-1.11,-1.04)):
    segment("slide receiver collar",(x,.08,z-.04),(x,.08,z+.04),.115,bright)
tube("upper feed",[(.49,.02,2.15),(.26,.02,1.97),(-.20,.08,1.78)],.077)
tube("upper valve return",[(-1.04,.08,1.33),(-1.05,.08,1.02),(-.84,.08,.77),(-.57,.08,.49)],.072)
tube("lower feed",[(.49,.02,-1.52),(.14,.02,-1.45),(-.25,.07,-1.17)],.077)
tube("lower valve return",[(-1.11,.07,-.66),(-.93,.07,-.48),(-.57,.07,-.29)],.072)

upper=bpy.data.objects.new("moving upper main slide",None)
lower=bpy.data.objects.new("moving lower third valve slide",None)
bpy.context.collection.objects.link(upper)
bpy.context.collection.objects.link(lower)
slide_loop("upper slide U tube",-1.04,-.20,1.52,2.16,.12,.082,True,upper)
for x in (-1.04,-.20): segment("upper slide ferrule",(x,.12,1.55),(x,.12,1.64),.111,bright,upper)
slide_loop("lower slide U tube",-1.11,-.25,-.78,-2.08,.12,.082,False,lower)
for x in (-1.11,-.25): segment("lower slide ferrule",(x,.12,-.91),(x,.12,-.82),.111,bright,lower)
segment("lower slide pull tab",(-1.22,.11,-1.76),(-1.10,.11,-1.76),.085,bright,lower)

# Three valve casings are horizontal in the reference portrait, with separate plungers and caps.
valves=[]
for i,z in enumerate((.49,.10,-.29),1):
    segment(f"valve {i} casing",(-.60,-.14,z),(.30,-.14,z),.16)
    segment(f"valve {i} housing front ring",(-.63,-.14,z),(-.54,-.14,z),.18,bright)
    segment(f"valve {i} housing dark well",(-.69,-.14,z),(-.62,-.14,z),.13,dark)
    plunger=bpy.data.objects.new(f"moving valve {i} plunger",None)
    bpy.context.collection.objects.link(plunger)
    segment(f"valve {i} stem",(-.95,-.14,z),(-.65,-.14,z),.055,bright,plunger)
    segment(f"valve {i} pearl button rim",(-1.02,-.14,z),(-.93,-.14,z),.152,bright,plunger)
    segment(f"valve {i} pearl button",(-1.039,-.14,z),(-1.018,-.14,z),.126,pearl,plunger)
    valves.append(plunger)
    segment(f"valve {i} rear cap",(.29,-.14,z),(.40,-.14,z),.165,bright)

# Small details preserve the brass instrument character without floating HTML layers.
for z in (1.36,.91,-.68,-1.20):
    segment("body brace",(.12,.02,z),(.48,.02,z),.047,bright)
tube("finger ring",[(.09+.16*math.cos(2*math.pi*i/48),-.22,-.91+.16*math.sin(2*math.pi*i/48)) for i in range(49)],.026,bright)

body=bpy.data.objects.new("moving complete trumpet body",None)
bpy.context.collection.objects.link(body)
for ob in list(bpy.context.scene.objects):
    if ob != body and ob.parent is None:
        ob.parent=body

def key(ob, frame, location):
    ob.location=location
    ob.keyframe_insert(data_path="location",frame=frame)

# Six stage beats at 24 fps. Upper slide and lower slide use distinct, isolated motions.
for ob in [upper,lower,*valves]: key(ob,1,(0,0,0))
for frame, amount in ((26,0),(33,.32),(42,.32),(48,0)):
    key(upper,frame,(0,0,amount))
for frame, amount in ((74,0),(79,.14),(85,.14),(91,0)):
    key(valves[1],frame,(amount,0,0))
for frame, amount in ((96,0),(104,-.36),(113,-.36),(121,0)):
    key(lower,frame,(0,0,amount))
for ob in (valves[0],valves[2]):
    for frame, amount in ((122,0),(130,.14),(139,.14),(145,0)):
        key(ob,frame,(amount,0,0))
for frame, x, z in ((1,0,.045),(10,0,-.012),(17,0,0),(74,0,0),(80,.025,0),(84,-.015,0),(88,.008,0),(92,0,0)):
    key(body,frame,(x,0,z))

camera_data=bpy.data.cameras.new("portrait orthographic camera")
camera=bpy.data.objects.new("portrait orthographic camera",camera_data)
bpy.context.collection.objects.link(camera)
camera.location=(0,-12,-.12)
camera.rotation_euler=(math.pi/2,0,0)
camera_data.type="ORTHO"
camera_data.ortho_scale=7.9
bpy.context.scene.camera=camera

def light(name,location,power,color,size):
    data=bpy.data.lights.new(name,"AREA")
    data.energy=power
    data.color=color
    data.shape="DISK"
    data.size=size
    ob=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    ob.location=location
    ob.rotation_euler=(Vector((0,0,0))-ob.location).to_track_quat("-Z","Y").to_euler()
light("large warm key",(-3,-5,4),850,(1,.79,.51),5)
light("ivory front fill",(3,-4,1),650,(.79,.85,1),4)
light("amber rim",(1,3,-1),1200,(1,.56,.23),3)
rim=bpy.data.objects["amber rim"]
for frame,power in ((145,1200),(154,1850),(164,1300),(168,1200)):
    rim.data.energy=power
    rim.data.keyframe_insert(data_path="energy",frame=frame)

scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.samples=24
scene.render.resolution_x=512
scene.render.resolution_y=768
scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.render.image_settings.file_format="PNG"
scene.render.image_settings.color_mode="RGBA"
scene.render.fps=24
scene.frame_start=1
scene.frame_end=168
scene.world.color=(.13,.13,.13)
scene.view_settings.view_transform="AgX"
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(output,"trumpet-timeline.blend"))
if still:
    scene.frame_set(1)
    scene.render.filepath=os.path.join(output,"poster.png")
    bpy.ops.render.render(write_still=True)
else:
    scene.render.filepath=os.path.join(output,"frame_")
    bpy.ops.render.render(animation=True)
