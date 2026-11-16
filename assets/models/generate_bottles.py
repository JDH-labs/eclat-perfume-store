import json
import math
import struct
from pathlib import Path


ROOT = Path(__file__).parent
SIDES = 96

FRAGRANCES = {
    "amber-noir": {
        "width": 1.04,
        "depth": 0.45,
        "shape": 3.5,
        "profile": [0.87, 0.97, 1.0, 1.0, 1.0, 0.97, 0.86, 0.66, 0.46, 0.42, 0.40, 0.37],
        "depth_profile": [0.84, 0.97, 1.0, 1.0, 0.98, 0.94, 0.87, 0.72, 0.57, 0.54, 0.52, 0.49],
        "cap_width": 0.43,
        "cap_depth": 0.31,
        "cap_shape": 3.5,
        "cap_height": 0.76,
        "liquid": "#b96c2d",
        "atomizer": "#98764c",
    },
    "velvet-bloom": {
        "width": 0.89,
        "depth": 0.46,
        "shape": 2.0,
        "profile": [0.74, 0.84, 0.93, 0.97, 1.0, 0.97, 0.88, 0.72, 0.54, 0.43, 0.38, 0.35],
        "depth_profile": [0.72, 0.85, 0.96, 1.0, 1.02, 1.0, 0.91, 0.76, 0.58, 0.48, 0.44, 0.42],
        "cap_width": 0.35,
        "cap_depth": 0.35,
        "cap_shape": 2.0,
        "cap_height": 0.82,
        "liquid": "#c17d79",
        "atomizer": "#b79280",
    },
    "citrus-ombre": {
        "width": 0.74,
        "depth": 0.38,
        "shape": 2.0,
        "profile": [0.72, 0.88, 0.97, 1.0, 0.96, 0.93, 0.84, 0.69, 0.52, 0.45, 0.42, 0.40],
        "depth_profile": [0.80, 0.91, 0.97, 1.0, 0.98, 0.95, 0.89, 0.76, 0.62, 0.56, 0.52, 0.50],
        "cap_width": 0.29,
        "cap_depth": 0.29,
        "cap_shape": 2.0,
        "cap_height": 0.68,
        "liquid": "#c99432",
        "atomizer": "#b7955d",
    },
    "midnight-oud": {
        "width": 0.94,
        "depth": 0.48,
        "shape": 5.2,
        "profile": [0.90, 0.98, 1.0, 1.0, 1.0, 1.0, 0.79, 0.53, 0.42, 0.40, 0.38, 0.36],
        "depth_profile": [0.90, 0.98, 1.0, 1.0, 1.0, 1.0, 0.86, 0.62, 0.53, 0.50, 0.48, 0.45],
        "cap_width": 0.42,
        "cap_depth": 0.36,
        "cap_shape": 6.0,
        "cap_height": 0.94,
        "liquid": "#543428",
        "atomizer": "#817669",
    },
}


def rounded_ring(y, width, depth, exponent):
    points = []
    power = 2.0 / exponent
    for index in range(SIDES):
        angle = math.tau * index / SIDES
        cosine, sine = math.cos(angle), math.sin(angle)
        x = math.copysign(abs(cosine) ** power, cosine) * width
        z = math.copysign(abs(sine) ** power, sine) * depth
        points.append((x, y, z))
    return points


def mesh_geometry(positions, indices):
    normals = [[0.0, 0.0, 0.0] for _ in positions]
    for offset in range(0, len(indices), 3):
        a, b, c = (positions[indices[offset + step]] for step in range(3))
        ab = [b[axis] - a[axis] for axis in range(3)]
        ac = [c[axis] - a[axis] for axis in range(3)]
        normal = [
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
        ]
        for vertex in (indices[offset], indices[offset + 1], indices[offset + 2]):
            normals[vertex] = [normals[vertex][axis] + normal[axis] for axis in range(3)]

    normalized = []
    for normal in normals:
        magnitude = math.sqrt(sum(component * component for component in normal)) or 1.0
        normalized.extend(component / magnitude for component in normal)
    return positions, normalized, indices


def append_loft(positions, indices, profiles, reverse=False, bottom=True, top=True):
    start = len(positions)
    for y, width, depth, exponent in profiles:
        positions.extend(rounded_ring(y, width, depth, exponent))

    for row in range(len(profiles) - 1):
        lower = start + row * SIDES
        upper = lower + SIDES
        for side in range(SIDES):
            next_side = (side + 1) % SIDES
            lower_current, lower_next = lower + side, lower + next_side
            upper_current, upper_next = upper + side, upper + next_side
            faces = [
                (lower_current, upper_current, lower_next),
                (lower_next, upper_current, upper_next),
            ]
            for face in faces:
                indices.extend(reversed(face) if reverse else face)

    if bottom:
        center = len(positions)
        positions.append((0.0, profiles[0][0], 0.0))
        ring = start
        for side in range(SIDES):
            face = (center, ring + side, ring + (side + 1) % SIDES)
            indices.extend(reversed(face) if reverse else face)
    if top:
        center = len(positions)
        positions.append((0.0, profiles[-1][0], 0.0))
        ring = start + (len(profiles) - 1) * SIDES
        for side in range(SIDES):
            face = (center, ring + (side + 1) % SIDES, ring + side)
            indices.extend(reversed(face) if reverse else face)


def make_loft(profiles, reverse=False, bottom=True, top=True):
    positions, indices = [], []
    append_loft(positions, indices, profiles, reverse, bottom, top)
    return mesh_geometry(positions, indices)


def make_glass_shell(width, depth, exponent, config):
    heights = (0.10, 0.14, 0.23, 0.37, 2.13, 2.31, 2.43, 2.56, 2.70, 2.88, 3.03, 3.10)
    body = [
        (y, width * width_scale, depth * depth_scale, exponent if y < 2.70 else max(2.0, exponent - 0.4))
        for y, width_scale, depth_scale in zip(heights, config["profile"], config["depth_profile"])
    ]
    inside = [
        (y, body[index][1] * 0.90, body[index][2] * 0.88, body[index][3])
        for index, y in enumerate(heights[2:-1], start=2)
    ]
    positions, indices = [], []
    append_loft(positions, indices, body, bottom=True, top=False)
    inner_start = len(positions)
    append_loft(positions, indices, inside, reverse=True, bottom=False, top=False)

    outer_top = len(body) * SIDES - SIDES
    inner_top = inner_start + (len(inside) - 1) * SIDES
    for side in range(SIDES):
        next_side = (side + 1) % SIDES
        indices.extend((outer_top + side, inner_top + side, outer_top + next_side))
        indices.extend((outer_top + next_side, inner_top + side, inner_top + next_side))
    return mesh_geometry(positions, indices)


def make_liquid(width, depth, exponent):
    fill = [
        (0.30, width * 0.80, depth * 0.75, exponent),
        (0.38, width * 0.87, depth * 0.81, exponent),
        (0.55, width * 0.88, depth * 0.82, exponent),
        (1.92, width * 0.88, depth * 0.82, exponent),
        (2.00, width * 0.82, depth * 0.76, exponent),
    ]
    return make_loft(fill)


def make_cap_shell(width, depth, exponent, height, style):
    base = 3.05
    profiles = [
        (base, width * 0.88, depth * 0.88, exponent),
        (base + 0.035, width * 0.98, depth * 0.98, exponent),
        (base + 0.10, width, depth, exponent),
        (base + height - 0.11, width, depth, exponent),
        (base + height - 0.045, width * 0.94, depth * 0.94, exponent),
        (base + height, width * 0.82, depth * 0.82, exponent),
    ]
    if style == "sculpted":
        profiles.insert(3, (base + height * 0.48, width * 1.14, depth * 1.14, exponent))
    elif style == "tapered":
        profiles[-1] = (base + height, width * 0.68, depth * 0.68, exponent)
    return make_loft(profiles)


def make_trim(y, width, depth, exponent, thickness=0.032):
    profiles = [
        (y, width * 0.98, depth * 0.98, exponent),
        (y + thickness * 0.22, width, depth, exponent),
        (y + thickness * 0.78, width, depth, exponent),
        (y + thickness, width * 0.98, depth * 0.98, exponent),
    ]
    return make_loft(profiles)


def orient_nozzle(geometry, base_y, base_z):
    positions, normals, indices = geometry
    return (
        [(x, base_y - z, base_z + y) for x, y, z in positions],
        [
            component
            for x, y, z in zip(normals[0::3], normals[1::3], normals[2::3])
            for component in (x, -z, y)
        ],
        indices,
    )


def make_nozzle(length, radius, base_y, base_z):
    bevel = min(0.025, length * 0.18)
    profiles = [
        (0.0, radius * 0.78, radius * 0.78, 2.0),
        (bevel, radius, radius, 2.0),
        (length - bevel, radius, radius, 2.0),
        (length, radius * 0.72, radius * 0.72, 2.0),
    ]
    return orient_nozzle(make_loft(profiles), base_y, base_z)


def make_atomizer_base(width, depth):
    return make_loft([
        (3.025, width * 0.205, depth * 0.24, 2.0),
        (3.045, width * 0.24, depth * 0.28, 2.0),
        (3.105, width * 0.24, depth * 0.28, 2.0),
        (3.13, width * 0.19, depth * 0.22, 2.0),
    ])


def make_atomizer_stem(width, depth):
    return make_loft([
        (3.105, width * 0.052, depth * 0.058, 2.0),
        (3.13, width * 0.064, depth * 0.07, 2.0),
        (3.365, width * 0.052, depth * 0.058, 2.0),
        (3.39, width * 0.044, depth * 0.05, 2.0),
    ])


def make_atomizer_actuator(width, depth):
    center_z = depth * 0.11
    front_z = center_z + depth * 0.18
    profiles = [
        (3.335, width * 0.105, depth * 0.145, 3.5),
        (3.35, width * 0.132, depth * 0.18, 3.5),
        (3.46, width * 0.132, depth * 0.18, 3.5),
        (3.485, width * 0.112, depth * 0.15, 3.5),
    ]
    positions, normals, indices = make_loft(profiles)
    return (
        [(x, y, z + center_z) for x, y, z in positions],
        normals,
        indices,
    ), front_z


def make_dip_tube(width, depth):
    path = [
        (0.34, 0.54, 0.28),
        (0.39, 0.58, 0.28),
        (2.55, 0.58, 0.28),
        (2.70, 0.56, 0.25),
        (2.82, 0.30, 0.13),
        (2.92, 0.14, 0.0),
        (3.00, 0.03, -0.055),
        (3.105, 0.0, -0.055),
    ]
    tube = make_loft([
        (y, width * 0.016, depth * 0.016, 2.0)
        for y, _, _ in path
    ])
    positions, normals, indices = tube
    for row, (_, x_factor, z_factor) in enumerate(path):
        x_offset = width * x_factor
        z_offset = depth * z_factor
        for vertex in range(SIDES):
            index = row * SIDES + vertex
            x, y, z = positions[index]
            positions[index] = (x + x_offset, y, z + z_offset)
    for center, path_index in zip(range(len(path) * SIDES, len(path) * SIDES + 2), (0, -1)):
        y, x_factor, z_factor = path[path_index]
        positions[center] = (width * x_factor, y, depth * z_factor)
    return (
        positions,
        normals,
        indices,
    )


def make_model(key, config):
    width = config["width"]
    depth = config["depth"]
    exponent = config["shape"]
    cap_width = config["cap_width"]
    cap_depth = config["cap_depth"]
    cap_shape = config["cap_shape"]
    cap_height = config["cap_height"]

    actuator, aperture_z = make_atomizer_actuator(width, depth)
    meshes = [
        ("BottleGlass", 0, make_glass_shell(width, depth, exponent, config)),
        ("FragranceCore", 1, make_liquid(width, depth, exponent)),
        ("NeckGold", 2, make_trim(2.96, width * 0.405, depth * 0.53, max(2.0, exponent - 0.4), 0.045)),
        ("CapShell", 3, make_cap_shell(
            cap_width,
            cap_depth,
            cap_shape,
            cap_height,
            {"velvet-bloom": "sculpted", "citrus-ombre": "tapered"}.get(key, "classic"),
        )),
        ("CapGold", 2, make_trim(3.14, cap_width * 0.985, cap_depth * 0.985, cap_shape, 0.035)),
        ("CapCrown", 4, make_trim(3.05 + cap_height - 0.015, cap_width * 0.74, cap_depth * 0.74, cap_shape, 0.04)),
        ("Atomizer", 4, make_atomizer_base(width, depth)),
        ("AtomizerStem", 4, make_atomizer_stem(width, depth)),
        ("AtomizerActuator", 6, actuator),
        ("AtomizerNozzle", 4, make_nozzle(0.025, width * 0.034, 3.42, aperture_z - 0.01)),
        ("AtomizerAperture", 5, make_nozzle(0.004, width * 0.018, 3.42, aperture_z + 0.015)),
        ("AtomizerTube", 7, make_dip_tube(width, depth)),
    ]
    return meshes


def write_glb(path, meshes, liquid_color, atomizer_color):
    binary = bytearray()
    buffer_views, accessors, gltf_meshes, nodes = [], [], [], []
    material_specs = [
        ("OpticalGlass", [0.92, 0.97, 1.0, 1.0], 0.0, 0.035),
        ("FragranceLiquid", liquid_color, 0.0, 0.16),
        ("BrushedGold", [0.66, 0.43, 0.19, 1.0], 0.82, 0.23),
        ("ObsidianCap", [0.035, 0.028, 0.025, 1.0], 0.18, 0.22),
        ("AtomizerMetal", [0.55, 0.5, 0.42, 1.0], 0.72, 0.19),
        ("NozzleAperture", [0.045, 0.04, 0.035, 1.0], 0.2, 0.42),
        ("AtomizerActuator", atomizer_color, 0.7, 0.24),
        ("DipTube", [0.78, 0.8, 0.78, 0.42], 0.08, 0.28),
    ]
    for name, color, metallic, roughness in material_specs:
        binary.extend(b"\0" * ((-len(binary)) % 4))

    materials = [
        {
            "name": name,
            "pbrMetallicRoughness": {
                "baseColorFactor": color,
                "metallicFactor": metallic,
                "roughnessFactor": roughness,
            },
            "doubleSided": index == 0,
            **({"alphaMode": "BLEND"} if color[3] < 1.0 else {}),
        }
        for index, (name, color, metallic, roughness) in enumerate(material_specs)
    ]

    for name, material_index, geometry in meshes:
        positions, normals, indices = geometry
        binary.extend(b"\0" * ((-len(binary)) % 4))
        position_offset = len(binary)
        flat_positions = [value for vertex in positions for value in vertex]
        binary.extend(struct.pack(f"<{len(flat_positions)}f", *flat_positions))
        position_view = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": position_offset, "byteLength": len(flat_positions) * 4, "target": 34962})
        position_accessor = len(accessors)
        bounds = [[min(vertex[axis] for vertex in positions), max(vertex[axis] for vertex in positions)] for axis in range(3)]
        accessors.append({
            "bufferView": position_view,
            "componentType": 5126,
            "count": len(positions),
            "type": "VEC3",
            "min": [bound[0] for bound in bounds],
            "max": [bound[1] for bound in bounds],
        })

        binary.extend(b"\0" * ((-len(binary)) % 4))
        normal_offset = len(binary)
        binary.extend(struct.pack(f"<{len(normals)}f", *normals))
        normal_view = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": normal_offset, "byteLength": len(normals) * 4, "target": 34962})
        normal_accessor = len(accessors)
        accessors.append({"bufferView": normal_view, "componentType": 5126, "count": len(positions), "type": "VEC3"})

        binary.extend(b"\0" * ((-len(binary)) % 4))
        index_offset = len(binary)
        binary.extend(struct.pack(f"<{len(indices)}I", *indices))
        index_view = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": index_offset, "byteLength": len(indices) * 4, "target": 34963})
        index_accessor = len(accessors)
        accessors.append({"bufferView": index_view, "componentType": 5125, "count": len(indices), "type": "SCALAR"})
        gltf_meshes.append({
            "name": name,
            "primitives": [{
                "attributes": {"POSITION": position_accessor, "NORMAL": normal_accessor},
                "indices": index_accessor,
                "material": material_index,
            }],
        })
        nodes.append({"name": name, "mesh": len(gltf_meshes) - 1})

    gltf = {
        "asset": {"version": "2.0", "generator": "ECLAT custom fragrance bottle model generator"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": gltf_meshes,
        "materials": materials,
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
    }
    json_chunk = json.dumps(gltf, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    json_chunk += b" " * ((-len(json_chunk)) % 4)
    binary.extend(b"\0" * ((-len(binary)) % 4))
    total_length = 12 + 8 + len(json_chunk) + 8 + len(binary)
    with path.open("wb") as output:
        output.write(struct.pack("<4sII", b"glTF", 2, total_length))
        output.write(struct.pack("<I4s", len(json_chunk), b"JSON"))
        output.write(json_chunk)
        output.write(struct.pack("<I4s", len(binary), b"BIN\0"))
        output.write(binary)


def hex_color(value):
    return [int(value[index:index + 2], 16) / 255 for index in (1, 3, 5)] + [1.0]


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    for key, config in FRAGRANCES.items():
        path = ROOT / f"{key}.glb"
        write_glb(
            path,
            make_model(key, config),
            hex_color(config["liquid"]),
            hex_color(config["atomizer"]),
        )
        print(f"Created {path.name} ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
