import bpy
import os

# Export to /exports in the same directory as the .blend file
blend_dir = os.path.dirname(bpy.data.filepath) if bpy.data.filepath else os.getcwd()
output_dir = os.path.join(blend_dir, "exports")
debug_file = os.path.join(blend_dir, "export_log.txt")
os.makedirs(output_dir, exist_ok=True)

pieces = {
    "Straight": "collection",
    "RampUp": "collection",
    "LCurve": "collection",
    "RCurve": "instance",
    "RampDown": "instance",
}

viewlayer_objects = set(bpy.context.view_layer.objects)
log = []

for name, kind in pieces.items():
    bpy.ops.object.select_all(action='DESELECT')

    if kind == "collection":
        col = bpy.data.collections.get(name)
        if not col:
            log.append(f"SKIP {name}: collection not found")
            continue
        count = 0
        active = None
        for obj in col.objects:
            if obj in viewlayer_objects:
                obj.select_set(True)
                active = obj
                count += 1
        if active:
            bpy.context.view_layer.objects.active = active
        log.append(f"{name}: selected {count} objects from collection")
    else:
        obj = bpy.data.objects.get(name)
        if not obj:
            log.append(f"SKIP {name}: object not found")
            continue
        before = set(bpy.data.objects[:])
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.duplicates_make_real()
        after = set(bpy.data.objects[:])
        new_objs = after - before
        bpy.ops.object.select_all(action='DESELECT')
        active = None
        for o in new_objs:
            if o in set(bpy.context.view_layer.objects):
                o.select_set(True)
                active = o
        if active:
            bpy.context.view_layer.objects.active = active
        log.append(f"{name}: made real, {len(new_objs)} new objects")

    selected = bpy.context.selected_objects
    if not selected:
        log.append(f"SKIP {name}: nothing selected")
        continue

    # Duplicate, apply transforms on copies, export, then delete copies
    bpy.ops.object.duplicate()
    dupes = list(bpy.context.selected_objects)
    bpy.ops.object.make_single_user(object=True, obdata=True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    log.append(f"{name}: applied transforms on {len(dupes)} temp copies")

    filepath = os.path.join(output_dir, f"{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        use_selection=True,
        export_format='GLB',
    )
    log.append(f"EXPORTED {name} -> {filepath}")

    # Delete temp duplicates
    bpy.ops.object.delete()
    log.append(f"Cleaned up temp copies for {name}")

    # Clean up realized instance objects
    if kind == "instance":
        bpy.ops.object.select_all(action='DESELECT')
        for o in list(bpy.data.objects):
            if o not in viewlayer_objects and o in set(bpy.context.view_layer.objects):
                o.select_set(True)
        if bpy.context.selected_objects:
            bpy.ops.object.delete()
        log.append(f"Cleaned up realized objects for {name}")

with open(debug_file, "w") as f:
    f.write("\n".join(log))
