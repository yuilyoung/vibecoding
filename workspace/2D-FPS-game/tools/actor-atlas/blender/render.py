"""Render the locked actor atlas frame set in pinned Blender 4.5.12."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path, PurePosixPath
import shutil
import sys
import zipfile

import bpy
from mathutils import Vector


def fail(message: str) -> None:
    raise RuntimeError(f"actor-atlas contract failure: {message}")


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    return parser.parse_args(argv)


def safe_target(destination: Path, entry_name: str) -> Path:
    parts = PurePosixPath(entry_name).parts
    if not parts or any(part in {"", ".", ".."} for part in parts):
        fail(f"unsafe archive entry: {entry_name}")
    target = destination.joinpath(*parts).resolve()
    try:
        target.relative_to(destination.resolve())
    except ValueError:
        fail(f"archive entry escapes staging: {entry_name}")
    return target


def extract_inputs(sources: list[dict[str, object]], destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for source in sources:
        archive_path = Path(str(source["path"])).resolve()
        entries = tuple(str(value) for value in source["entries"])
        with zipfile.ZipFile(archive_path) as archive:
            available = set(archive.namelist())
            missing = sorted(set(entries) - available)
            if missing:
                fail(f"archive {source['id']} is missing entries: {missing}")
            for entry_name in entries:
                target = safe_target(destination, entry_name)
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(entry_name) as input_file, target.open("wb") as output_file:
                    shutil.copyfileobj(input_file, output_file)
        for alias_name, original_name in dict(source["aliases"]).items():
            alias_path = safe_target(destination, str(alias_name))
            original_path = safe_target(destination, str(original_name))
            if not original_path.is_file():
                fail(f"alias source is missing: {original_name}")
            alias_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(original_path, alias_path)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for data_collection in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for data_block in list(data_collection):
            if data_block.users == 0:
                data_collection.remove(data_block)


def find_extracted_entry(input_dir: Path, sources: list[dict[str, object]], suffix: str) -> Path:
    matches = [
        safe_target(input_dir, str(entry))
        for source in sources
        for entry in source["entries"]
        if str(entry).endswith(suffix)
    ]
    if len(matches) != 1:
        fail(f"expected exactly one input ending in {suffix}, found {len(matches)}")
    return matches[0]


def exact_bones(armature: bpy.types.Object) -> list[str]:
    return sorted(bone.name for bone in armature.data.bones)


def verify_rig_and_actions(config: dict[str, object], base_names: set[str]) -> tuple[bpy.types.Object, dict[str, bpy.types.Action]]:
    rig = config["lock"]["rig"]
    expected_base_names = set(rig["baseObjects"])
    if base_names != expected_base_names:
        fail(f"base object inventory mismatch: {sorted(base_names)}")

    target = bpy.data.objects.get(rig["targetArmature"])
    if target is None or target.type != "ARMATURE":
        fail(f"target armature is missing: {rig['targetArmature']}")
    if exact_bones(target) != list(rig["boneNames"]):
        fail("target armature bone inventory mismatch")

    source = bpy.data.objects.get(rig["sourceArmature"])
    if source is None or source.type != "ARMATURE":
        fail(f"source armature is missing: {rig['sourceArmature']}")
    if exact_bones(source) != list(rig["boneNames"]):
        fail("source armature bone inventory mismatch")

    actions: dict[str, bpy.types.Action] = {}
    for state, expected in rig["actions"].items():
        action = bpy.data.actions.get(expected["name"])
        if action is None:
            fail(f"required action is missing for {state}: {expected['name']}")
        actual_start, actual_end = (float(value) for value in action.frame_range)
        if abs(actual_start - float(expected["frameStart"])) >= 0.0001:
            fail(f"action start mismatch for {state}: {actual_start}")
        if abs(actual_end - float(expected["frameEnd"])) >= 0.0001:
            fail(f"action end mismatch for {state}: {actual_end}")
        slots = [slot.identifier for slot in action.slots]
        if slots != [rig["sourceActionSlot"]]:
            fail(f"action slot mismatch for {state}: {slots}")
        action.use_fake_user = True
        actions[state] = action
    return target, actions


def remove_animation_objects(base_names: set[str]) -> None:
    for obj in list(bpy.data.objects):
        if obj.name not in base_names:
            bpy.data.objects.remove(obj, do_unlink=True)


def make_material(name: str, color: list[float], roughness: float) -> bpy.types.Material:
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    material.use_nodes = True
    material.diffuse_color = color
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def apply_team_materials(team: str, palette: dict[str, list[float]]) -> None:
    assignments = {
        "SuperHero_Male": (palette["body"], 0.72),
        "Eyebrows": ([0.012, 0.016, 0.025, 1.0], 0.86),
        "Eyes": (palette["accent"], 0.35),
    }
    for object_name, (color, roughness) in assignments.items():
        obj = bpy.data.objects.get(object_name)
        if obj is None or obj.type != "MESH":
            fail(f"render mesh is missing: {object_name}")
        obj.data.materials.clear()
        obj.data.materials.append(make_material(f"ActorAtlas_{team}_{object_name}", color, roughness))


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def configure_render(config: dict[str, object], base_names: set[str]) -> bpy.types.Object:
    spec = config["spec"]
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = int(spec["cell"]["width"])
    scene.render.resolution_y = int(spec["cell"]["height"])
    scene.render.resolution_percentage = 100
    scene.render.pixel_aspect_x = 1
    scene.render.pixel_aspect_y = 1
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.eevee.taa_render_samples = 1
    scene.eevee.taa_samples = 1
    scene.eevee.use_taa_reprojection = False
    scene.eevee.use_shadows = False
    if hasattr(scene.render, "use_motion_blur"):
        scene.render.use_motion_blur = False

    world = scene.world or bpy.data.worlds.new("ActorAtlasWorld")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.025, 0.03, 0.045, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55

    camera_data = bpy.data.cameras.new("ActorAtlasCamera")
    camera = bpy.data.objects.new("ActorAtlasCamera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (0.0, -6.0, 3.8)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.65
    point_at(camera, Vector((0.0, 0.0, 0.92)))
    scene.camera = camera

    for name, location, energy, size in (
        ("ActorAtlasKey", (-3.5, -4.0, 6.0), 650.0, 4.0),
        ("ActorAtlasFill", (4.0, -1.0, 3.5), 350.0, 3.0),
    ):
        light_data = bpy.data.lights.new(name=name, type="AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new(name, light_data)
        scene.collection.objects.link(light)
        light.location = location
        point_at(light, Vector((0.0, 0.0, 0.9)))

    root = bpy.data.objects.new("ActorAtlasDirectionRoot", None)
    scene.collection.objects.link(root)
    for obj in [bpy.data.objects[name] for name in sorted(base_names) if bpy.data.objects[name].parent is None]:
        world_matrix = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = world_matrix

    hidden = bpy.data.objects.get("Icosphere")
    if hidden is not None:
        hidden.hide_render = True
        hidden.hide_viewport = True
    render_names = set(config["lock"]["rig"]["renderObjects"])
    actual_render_names = {name for name in base_names if bpy.data.objects[name].type == "MESH" and name != "Icosphere"}
    if actual_render_names != render_names:
        fail(f"render object inventory mismatch: {sorted(actual_render_names)}")
    return root


def set_action(target: bpy.types.Object, action: bpy.types.Action) -> None:
    animation_data = target.animation_data_create()
    for track in list(animation_data.nla_tracks):
        animation_data.nla_tracks.remove(track)
    animation_data.action = action
    if len(action.slots) != 1:
        fail(f"action has an unexpected slot count: {action.name}")
    animation_data.action_slot = action.slots[0]


def sample_frame(action: bpy.types.Action, frame_index: int, frame_count: int, repeat: bool) -> float:
    start, end = (float(value) for value in action.frame_range)
    if repeat:
        fraction = frame_index / frame_count
    else:
        fraction = 0.0 if frame_count == 1 else frame_index / (frame_count - 1)
    return start + (end - start) * fraction


def render_frames(config: dict[str, object], target: bpy.types.Object, actions: dict[str, bpy.types.Action], root: bpy.types.Object) -> None:
    output_dir = Path(config["outputDir"]).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    spec = config["spec"]
    current_team = None
    rendered = 0
    for frame in config["frames"]:
        team = frame["team"]
        if team != current_team:
            apply_team_materials(team, config["palettes"][team])
            current_team = team
        state = frame["state"]
        state_spec = spec["states"][state]
        action = actions[state]
        set_action(target, action)
        sampled = sample_frame(action, int(frame["frame"]), int(state_spec["framesPerDirection"]), bool(state_spec["repeat"]))
        whole_frame = math.floor(sampled)
        bpy.context.scene.frame_set(whole_frame, subframe=sampled - whole_frame)
        root.rotation_euler[2] = math.radians(float(config["directionAnglesDegrees"][frame["direction"]]))
        bpy.context.view_layer.update()

        team_dir = output_dir / team.lower()
        team_dir.mkdir(parents=True, exist_ok=True)
        output_path = team_dir / f"{int(frame['index']):03d}.png"
        bpy.context.scene.render.filepath = str(output_path)
        bpy.ops.render.render(write_still=True)
        if not output_path.is_file():
            fail(f"render output is missing: {output_path}")
        rendered += 1

    expected = len(config["frames"])
    actual = len(list(output_dir.glob("*/*.png")))
    if rendered != expected or actual != expected:
        fail(f"render count mismatch: rendered={rendered}, files={actual}, expected={expected}")


def main() -> None:
    args = parse_args()
    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    if bpy.app.version_string != "4.5.12 LTS":
        fail(f"Blender version mismatch: {bpy.app.version_string}")

    input_dir = Path(config["inputDir"]).resolve()
    extract_inputs(config["sources"], input_dir)
    clear_scene()

    base_path = find_extracted_entry(input_dir, config["sources"], "Superhero_Male_FullBody.gltf")
    bpy.ops.import_scene.gltf(filepath=str(base_path))
    base_names = {obj.name for obj in bpy.context.scene.objects}

    animation_path = find_extracted_entry(input_dir, config["sources"], "UAL1_Standard.glb")
    bpy.ops.import_scene.gltf(filepath=str(animation_path))
    target, actions = verify_rig_and_actions(config, base_names)
    remove_animation_objects(base_names)
    root = configure_render(config, base_names)
    render_frames(config, target, actions, root)
    print("ACTOR_ATLAS_RENDER=" + json.dumps({"frames": len(config["frames"]), "teams": config["spec"]["teams"]}, separators=(",", ":"), sort_keys=True))


if __name__ == "__main__":
    main()
