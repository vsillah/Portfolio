import bpy, math, os
from mathutils import Vector
from pathlib import Path
repo=Path(__file__).resolve().parents[1]
source=str(repo/'design-files/trumpet-trainer/innerscene-trumpet.glb')
out=str(repo/'docs/qa/trumpet-recruitment-visual-story/replacement-source-proof')
os.makedirs(out,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1280; scene.render.resolution_y=720; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=True
scene.world.color=(0.08,0.12,0.20)
scene.view_settings.view_transform='AgX'
cam_data=bpy.data.cameras.new('Proof camera'); cam=bpy.data.objects.new('Proof camera',cam_data); scene.collection.objects.link(cam)
cam.location=(0.36,-0.8,0.30); target=Vector((-0.005,-0.005,0.098)); cam.rotation_euler=(target- cam.location).to_track_quat('-Z','Y').to_euler(); cam_data.type='ORTHO'; cam_data.ortho_scale=0.62; scene.camera=cam
for name,loc,power,size,color in [
 ('Warm key',(0.05,-0.35,0.55),35,0.6,(1.0,0.8,0.5)),
 ('Soft fill',(-0.25,-0.45,0.18),20,0.55,(0.55,0.72,1.0)),
 ('Rim',(0.15,0.25,0.4),45,0.5,(1.0,0.94,0.78))]:
 data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size; data.color=color; obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj); obj.location=loc; obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()

# Animate only separately modeled source meshes. The branch translations follow their tube axis (-Y).
parent=bpy.data.objects['Trumpet']
base_z=parent.location.z

def key(obj,prop,values):
 for frame,value in values:
  setattr(obj,prop,value)
  obj.keyframe_insert(data_path=prop,frame=frame)

key(parent,'location',[(1,(0,0,base_z-0.003)),(17,(0,0,base_z)),(72,(0,0,base_z)),(82,(0,0,base_z-0.0015)),(92,(0,0,base_z)),(145,(0,0,base_z)),(168,(0,0,base_z))])
key(parent,'rotation_euler',[(1,(0,-0.016,0)),(17,(0,0,0)),(72,(0,0,0)),(82,(0,0.008,0)),(92,(0,0,0)),(145,(0,0.007,0)),(168,(0,0,0))])
for name,frames in [
 ('Valve tuning branch 1',[(1,0),(25,0),(36,-0.030),(48,0),(168,0)]),
 ('Valve tuning branch 3',[(1,0),(95,0),(108,-0.035),(121,0),(168,0)])]:
 obj=bpy.data.objects[name]
 # Lengthen the two straight shanks of this source mesh into the valve block.
 # They remain engaged while the original U-shaped branch travels outward.
 for vertex in obj.data.vertices:
  if vertex.co.y > -0.012:
   vertex.co.y += 0.040 * min(1, (vertex.co.y + 0.012) / 0.012)
 key(obj,'location',[(f,(0,y,0)) for f,y in frames])
for suffix,frames in [
 ('.001',[(1,0),(73,0),(82,-0.019),(91,0),(168,0)]),
 ('',[(1,0),(121,0),(133,-0.018),(144,0),(168,0)]),
 ('.002',[(1,0),(121,0),(133,-0.018),(144,0),(168,0)])]:
 for base in ('Finger button','Valve button stem'):
  obj=bpy.data.objects[base+suffix]
  original=obj.location.copy()
  key(obj,'location',[(f,(original.x,original.y,original.z+z)) for f,z in frames])
scene.frame_start=1; scene.frame_end=168; scene.render.fps=24
bpy.ops.wm.save_as_mainfile(filepath=out+'/replacement-proof.blend')
for frame,name in [(17,'normal-size-still.png'),(36,'upper-slide-extended.png'),(82,'valve-press.png'),(108,'lower-slide-extended.png'),(133,'valve-combination.png')]:
 scene.frame_set(frame)
 scene.render.filepath=out+'/'+name
 bpy.ops.render.render(write_still=True)
if os.environ.get('TRUMPET_RENDER_MOTION') == '1':
 frames_dir=out+'/frames'
 os.makedirs(frames_dir,exist_ok=True)
 for index,frame in enumerate(range(1,169,3)):
  scene.frame_set(frame)
  scene.render.filepath=f'{frames_dir}/{index:03d}.png'
  bpy.ops.render.render(write_still=True)
