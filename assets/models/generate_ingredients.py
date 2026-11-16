import json
import math
import random
import struct
import zlib
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).parent
SIDES = 32


class MeshBuilder:
    def __init__(self):
        self.positions = []
        self.uvs = []
        self.indices = []

    def ellipsoid(self, center, size, material, segments=32, rings=20, texture_bump=0.0):
        self.material = material
        base = len(self.positions)
        cx, cy, cz = center
        rx, ry, rz = size
        for row in range(rings + 1):
            v = row / rings
            phi = math.pi * v
            for column in range(segments + 1):
                u = column / segments
                theta = math.tau * u
                bump = 1 + texture_bump * (
                    0.52 * math.sin(theta * 13 + phi * 9)
                    + 0.28 * math.sin(theta * 23 - phi * 16)
                    + 0.20 * math.sin(theta * 37 + phi * 21)
                )
                x = math.sin(phi) * math.cos(theta) * rx * bump
                z = math.sin(phi) * math.sin(theta) * rz * bump
                y = math.cos(phi) * ry * bump
                self.positions.append((cx + x, cy + y, cz + z))
                self.uvs.append((u, v))
        for row in range(rings):
            for column in range(segments):
                a = base + row * (segments + 1) + column
                b = a + segments + 1
                self.indices.extend((a, a + 1, b, a + 1, b + 1, b))
        return material

    def tube(self, points, radius, material, sides=12, steps=20, taper=False, lobes=0.0):
        self.material = material
        sampled = []
        for index in range(steps + 1):
            t = index / steps * (len(points) - 1)
            segment = min(int(t), len(points) - 2)
            fraction = t - segment
            sampled.append(tuple(
                points[segment][axis] * (1 - fraction) + points[segment + 1][axis] * fraction
                for axis in range(3)
            ))

        base = len(self.positions)
        for ring, point in enumerate(sampled):
            previous = sampled[max(0, ring - 1)]
            following = sampled[min(steps, ring + 1)]
            tangent = normalize(tuple(following[axis] - previous[axis] for axis in range(3)))
            reference = (0, 0, 1) if abs(tangent[2]) < 0.9 else (0, 1, 0)
            basis_x = normalize(cross(tangent, reference))
            basis_y = normalize(cross(tangent, basis_x))
            fraction = ring / steps
            taper_scale = max(0.055, math.sin(math.pi * fraction) ** 0.38) if taper else 1.0
            for side in range(sides + 1):
                angle = math.tau * side / sides
                ridge = 1 + lobes * math.cos(angle * 7 + fraction * 11)
                r = radius * taper_scale * ridge
                position = tuple(
                    point[axis] + r * (
                        basis_x[axis] * math.cos(angle) + basis_y[axis] * math.sin(angle)
                    )
                    for axis in range(3)
                )
                self.positions.append(position)
                self.uvs.append((side / sides, fraction))
        for ring in range(steps):
            for side in range(sides):
                a = base + ring * (sides + 1) + side
                b = a + sides + 1
                self.indices.extend((a, a + 1, b, a + 1, b + 1, b))
        return material

    def leaf(self, center, length, width, angle, material, vein_material, bend=0.12):
        self.material = material
        base = len(self.positions)
        across, along = 12, 24
        ca, sa = math.cos(angle), math.sin(angle)
        cx, cy, cz = center
        for row in range(along + 1):
            t = row / along
            half_width = width * (math.sin(math.pi * t) ** 0.75) * (0.65 + 0.35 * t)
            for column in range(across + 1):
                across_position = column / across * 2 - 1
                side = across_position * half_width
                height = cy + length * (t - 0.5) + bend * math.sin(math.pi * t) * (1 - across_position ** 2)
                x = cx + ca * length * (t - 0.5) - sa * side
                z = cz + sa * length * (t - 0.5) + ca * side
                self.positions.append((x, height, z))
                self.uvs.append((column / across, t))
        for row in range(along):
            for column in range(across):
                a = base + row * (across + 1) + column
                b = a + across + 1
                self.indices.extend((a, b, a + 1, a + 1, b, b + 1))

        vein = [
            (
                cx + ca * length * (index / 8 - 0.5),
                cy + length * (index / 8 - 0.5) + bend * math.sin(math.pi * index / 8) + 0.008,
                cz + sa * length * (index / 8 - 0.5),
            )
            for index in range(9)
        ]
        self.tube(vein, max(0.006, width * 0.018), vein_material, sides=5, steps=24)
        self.material = material
        return material

    def petal(self, center, length, width, angle, material, curl=0.16, twist=0.0):
        self.material = material
        base = len(self.positions)
        across, along = 10, 20
        ca, sa = math.cos(angle), math.sin(angle)
        cx, cy, cz = center
        for row in range(along + 1):
            t = row / along
            half_width = width * (math.sin(math.pi * t) ** 0.65) * (0.65 + 0.35 * t)
            for column in range(across + 1):
                side = (column / across * 2 - 1) * half_width
                radial = length * t + 0.12 * math.sin(math.pi * t)
                x = cx + ca * radial - sa * side
                y = cy + sa * radial + ca * side + curl * math.sin(math.pi * t) + twist * side * t
                z = cz + 0.21 * math.sin(math.pi * t) + 0.055 * (side / max(width, 0.001)) ** 2
                self.positions.append((x, y, z))
                self.uvs.append((column / across, t))
        for row in range(along):
            for column in range(across):
                a = base + row * (across + 1) + column
                b = a + across + 1
                self.indices.extend((a, b, a + 1, a + 1, b, b + 1))
        return material


def normalize(vector):
    magnitude = math.sqrt(sum(component * component for component in vector)) or 1.0
    return tuple(component / magnitude for component in vector)


def cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def bezier(start, control_a, control_b, end, samples=8):
    points = []
    for index in range(samples + 1):
        t = index / samples
        inverse = 1 - t
        points.append(tuple(
            inverse ** 3 * start[axis]
            + 3 * inverse ** 2 * t * control_a[axis]
            + 3 * inverse * t ** 2 * control_b[axis]
            + t ** 3 * end[axis]
            for axis in range(3)
        ))
    return points


def png_image(kind, roughness=False, size=128):
    seed = sum(ord(char) for char in kind) + int(roughness)
    random.seed(seed)
    pixels = bytearray()
    for y in range(size):
        pixels.append(0)
        v = y / size
        for x in range(size):
            u = x / size
            noise = random.random()
            fine = (math.sin(x * 1.71 + y * 0.63) + math.sin(y * 2.43 - x * 0.37)) * 0.5
            if roughness:
                rough = {"citrus": 210, "leaf": 72, "rose": 92, "wood": 194, "vanilla": 178,
                         "seed": 154, "amber": 118, "leather": 166, "flower": 84, "smoke": 210}.get(kind, 150)
                value = max(0, min(255, int(rough + fine * 12 + noise * 5)))
                pixels.extend((value, value, value))
                continue

            if kind == "citrus":
                pore = math.sin(x * 1.91) * math.sin(y * 2.17)
                stripe = math.sin(x / size * math.tau * 13 + math.sin(y / size * 9)) * 8
                color = (226 + int(fine * 12 + pore * 13), 132 + int(fine * 13 + stripe), 35 + int(noise * 18))
            elif kind == "leaf":
                vein = abs((u - 0.5) - 0.08 * math.sin(v * 8))
                brightness = int(noise * 15 + fine * 8 - max(0, 0.055 - vein) * 145)
                color = (48 + brightness, 91 + brightness, 49 + int(noise * 17))
            elif kind == "rose":
                edge = math.sin(v * math.pi) * 17
                color = (160 + int(noise * 34 + edge), 44 + int(noise * 20 + edge * 0.65), 63 + int(noise * 30 + edge))
            elif kind == "flower":
                color = (229 + int(noise * 24), 215 + int(noise * 25), 188 + int(noise * 30))
            elif kind == "wood":
                grain = math.sin(v * 75 + math.sin(u * 18) * 2) * 15 + math.sin(v * 210) * 6
                color = (108 + int(noise * 24 + grain), 65 + int(noise * 17 + grain * 0.55), 37 + int(noise * 11))
            elif kind == "vanilla":
                speck = 0 if noise > 0.975 else int(noise * 12)
                color = (66 + speck + int(fine * 6), 41 + speck, 29 + speck)
            elif kind == "seed":
                color = (126 + int(noise * 42), 66 + int(noise * 24), 34 + int(noise * 19))
            elif kind == "amber":
                cloud = int(noise * 35 + fine * 10)
                color = (181 + cloud, 94 + cloud, 29 + int(noise * 18))
            elif kind == "leather":
                grain = int(noise * 28 + fine * 5)
                color = (73 + grain, 41 + grain // 2, 27 + grain // 3)
            elif kind == "smoke":
                shade = int(noise * 24 + fine * 7)
                color = (149 + shade, 139 + shade, 125 + shade)
            else:
                color = (128, 128, 128)
            pixels.extend(max(0, min(255, channel)) for channel in color)

    compressor = zlib.compressobj(7)
    compressed = compressor.compress(bytes(pixels)) + compressor.flush()

    def chunk(name, data):
        return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")


TEXTURE_TYPES = ("citrus", "leaf", "rose", "flower", "wood", "vanilla", "seed", "amber", "leather", "smoke")
TEXTURES = {
    f"{kind}{suffix}": png_image(kind, roughness=suffix == "_rough")
    for kind in TEXTURE_TYPES
    for suffix in ("", "_rough")
}

MATERIALS = {
    "citrus": ("citrus", [1, 1, 1, 1], 0.0, 0.44),
    "citrus_flesh": ("citrus", [1.0, 0.62, 0.27, 1], 0.0, 0.3),
    "leaf": ("leaf", [1, 1, 1, 1], 0.0, 0.48),
    "rose": ("rose", [1, 0.84, 0.84, 1], 0.0, 0.38),
    "flower": ("flower", [1, 0.98, 0.9, 1], 0.0, 0.34),
    "wood": ("wood", [1, 1, 1, 1], 0.0, 0.55),
    "vanilla": ("vanilla", [1, 1, 1, 1], 0.0, 0.45),
    "seed": ("seed", [1, 1, 1, 1], 0.0, 0.49),
    "amber": ("amber", [1, 1, 1, 1], 0.1, 0.2),
    "leather": ("leather", [1, 1, 1, 1], 0.0, 0.56),
    "smoke": ("smoke", [0.78, 0.75, 0.70, 0.56], 0.0, 0.8),
    "musk": ("flower", [0.9, 0.84, 0.69, 0.65], 0.08, 0.22),
}


def fruit(groups, name, center, size, material="citrus", seed=0):
    rng = random.Random(seed)
    skin = MeshBuilder()
    skin.ellipsoid(center, size, material, segments=48, rings=32, texture_bump=0.018)
    groups[name].append(skin)

    cx, cy, cz = center
    stem = MeshBuilder()
    stem.tube([(cx, cy + size[1] * 0.94, cz), (cx + 0.025, cy + size[1] * 1.04, cz),
               (cx + 0.045, cy + size[1] * 1.12, cz - 0.012)], 0.028, "wood", sides=8, steps=8, taper=True)
    groups[name].append(stem)
    leaves = MeshBuilder()
    for angle in (0.4, 2.55, 4.65):
        leaves.leaf((cx, cy + size[1] * 1.02, cz), size[0] * 0.82, size[0] * 0.33, angle,
                    "leaf", "leaf", bend=0.08)
    groups[name].append(leaves)


def pear(groups, center):
    cx, cy, cz = center
    mesh = MeshBuilder()
    rings, segments = 36, 48
    base = len(mesh.positions)
    for row in range(rings + 1):
        v = row / rings
        y = math.cos(math.pi * v)
        profile = math.sin(math.pi * v) * (0.72 + 0.38 * (1 - y) / 2)
        for column in range(segments + 1):
            u = column / segments
            angle = math.tau * u
            bump = 1 + 0.018 * math.sin(angle * 7 + v * 13)
            mesh.positions.append((cx + math.cos(angle) * profile * 0.47 * bump,
                                   cy + y * 0.78, cz + math.sin(angle) * profile * 0.43 * bump))
            mesh.uvs.append((u, v))
    for row in range(rings):
        for column in range(segments):
            a = base + row * (segments + 1) + column
            b = a + segments + 1
            mesh.indices.extend((a, a + 1, b, a + 1, b + 1, b))
    groups["Pear"].append(mesh)
    stem = MeshBuilder()
    stem.tube([(cx, cy + 0.7, cz), (cx + 0.03, cy + 0.91, cz), (cx + 0.1, cy + 0.98, cz)],
              0.036, "wood", sides=8, steps=12, taper=True)
    stem.leaf((cx + 0.05, cy + 0.9, cz), 0.54, 0.17, 0.75, "leaf", "leaf")
    groups["Pear"].append(stem)


def flower(groups, name, center, petals, layers, material="rose", scale=1.0, seed=2):
    rng = random.Random(seed)
    cx, cy, cz = center
    mesh = MeshBuilder()
    for layer in range(layers):
        count = petals + layer * 2
        length = scale * (0.68 - layer * 0.11)
        width = scale * (0.31 - layer * 0.025)
        radius = scale * (0.22 + layer * 0.09)
        for index in range(count):
            angle = math.tau * (index + (layer % 2) * 0.5) / count
            start = (cx + math.cos(angle) * radius, cy + math.sin(angle) * radius, cz + layer * 0.035)
            mesh.petal(start, length, width, angle, material,
                       curl=0.19 + layer * 0.02, twist=rng.uniform(-0.09, 0.09))
    groups[name].append(mesh)

    center_mesh = MeshBuilder()
    center_mesh.ellipsoid((cx, cy, cz + 0.17 * scale), (scale * 0.22, scale * 0.22, scale * 0.17),
                          "amber" if material == "flower" else "seed", segments=20, rings=12, texture_bump=0.04)
    groups[name].append(center_mesh)

    leaves = MeshBuilder()
    for angle in (0.1, 2.35, 4.3):
        leaves.leaf((cx, cy - scale * 0.36, cz - 0.04), scale * 0.78, scale * 0.27,
                    angle, "leaf", "leaf", bend=0.16)
    groups[name].append(leaves)


def pod(groups, name, center, length, radius, material="vanilla", seed=1):
    rng = random.Random(seed)
    cx, cy, cz = center
    for index in range(3):
        angle = rng.uniform(-0.6, 0.6)
        offset_x = (index - 1) * radius * 2.1
        start = (cx + offset_x, cy - length * 0.5, cz + (index - 1) * radius)
        end = (cx + offset_x + math.sin(angle) * 0.12, cy + length * 0.5, cz + (index - 1) * radius + 0.12)
        points = bezier(start, (start[0] - 0.12, start[1] + length * 0.25, start[2] + 0.08),
                        (end[0] + 0.15, end[1] - length * 0.24, end[2] - 0.05), end, 8)
        mesh = MeshBuilder()
        mesh.tube(points, radius, material, sides=14, steps=30, taper=True, lobes=0.075)
        groups[name].append(mesh)
        if material == "vanilla":
            seam = MeshBuilder()
            seam.tube(points, radius * 0.035, "seed", sides=5, steps=30)
            groups[name].append(seam)


def berries(groups, name, center, count=16, size=0.085, material="seed", seed=3):
    rng = random.Random(seed)
    cx, cy, cz = center
    mesh = MeshBuilder()
    for index in range(count):
        angle = index * 2.399
        radial = 0.16 + 0.18 * math.sqrt(index / count)
        position = (cx + math.cos(angle) * radial, cy + rng.uniform(-0.19, 0.19),
                    cz + math.sin(angle) * radial)
        mesh.ellipsoid(position, (size, size * rng.uniform(0.82, 1.12), size),
                       material, segments=14, rings=10, texture_bump=0.03)
    groups[name].append(mesh)


def wood_chips(groups, name, center, count=5, dark=False, seed=4):
    rng = random.Random(seed)
    cx, cy, cz = center
    for index in range(count):
        angle = index * 2.4 + rng.uniform(-0.24, 0.24)
        length = rng.uniform(0.6, 1.05)
        radius = rng.uniform(0.075, 0.14)
        dx, dz = math.cos(angle), math.sin(angle)
        start = (cx + dx * rng.uniform(-0.35, 0.35), cy + rng.uniform(-0.3, 0.3),
                 cz + dz * rng.uniform(-0.3, 0.3))
        end = (start[0] + dx * length, start[1] + rng.uniform(-0.2, 0.2),
               start[2] + dz * length * 0.68)
        points = bezier(start, (start[0] + dx * length * 0.3, start[1] + 0.1, start[2] + dz * 0.2),
                        (end[0] - dx * length * 0.25, end[1] - 0.1, end[2] - dz * 0.2), end)
        bark = MeshBuilder()
        bark.tube(points, radius, "wood" if not dark else "vanilla", sides=16, steps=24, lobes=0.16)
        groups[name].append(bark)
        cut = MeshBuilder()
        cut.ellipsoid(start, (radius * 1.04, radius * 0.35, radius * 1.04),
                      "seed" if dark else "flower", segments=16, rings=10)
        groups[name].append(cut)
        if index < 3:
            curls = MeshBuilder()
            splinter = bezier(start, (start[0] + dx * 0.15, start[1] + radius * 2, start[2]),
                              (end[0] - dx * 0.12, end[1] - radius * 2, end[2]), end)
            curls.tube(splinter, radius * 0.14, "wood", sides=6, steps=22, taper=True)
            groups[name].append(curls)


def threads(groups, name, center, seed=5):
    rng = random.Random(seed)
    cx, cy, cz = center
    for index in range(9):
        angle = index * 2.399
        start = (cx + math.cos(angle) * rng.uniform(0.05, 0.2), cy - 0.48, cz + math.sin(angle) * 0.1)
        end = (cx + math.cos(angle + 0.3) * rng.uniform(0.22, 0.42), cy + rng.uniform(0.1, 0.53),
               cz + math.sin(angle + 0.3) * rng.uniform(0.15, 0.42))
        points = bezier(start, (start[0] - 0.18, cy - 0.12, start[2] + 0.25),
                        (end[0] + 0.18, cy + 0.12, end[2] - 0.2), end)
        thread = MeshBuilder()
        thread.tube(points, rng.uniform(0.012, 0.023), "amber", sides=6, steps=26, taper=True)
        groups[name].append(thread)


def leaf_spray(groups, name, center, length=0.72, count=7, seed=6):
    rng = random.Random(seed)
    cx, cy, cz = center
    branch = MeshBuilder()
    branch.tube([(cx - 0.55, cy - 0.2, cz), (cx, cy, cz + 0.05), (cx + 0.55, cy + 0.25, cz - 0.03)],
                0.035, "wood", sides=8, steps=20, taper=True)
    groups[name].append(branch)
    foliage = MeshBuilder()
    for index in range(count):
        t = (index + 0.5) / count
        anchor = (cx + (t - 0.5) * 0.85, cy + (t - 0.5) * 0.42, cz)
        for side in (-1, 1):
            foliage.leaf(anchor, length * rng.uniform(0.72, 1.08), length * 0.3,
                         side * rng.uniform(0.65, 1.1), "leaf", "leaf", bend=0.08)
    groups[name].append(foliage)


def leather(groups, center, seed=7):
    rng = random.Random(seed)
    cx, cy, cz = center
    mesh = MeshBuilder()
    length, width, rows, columns = 1.25, 0.34, 24, 8
    base = len(mesh.positions)
    for row in range(rows + 1):
        t = row / rows
        for column in range(columns + 1):
            side = (column / columns - 0.5) * width * (0.77 + 0.23 * math.sin(math.pi * t))
            x = cx + length * (t - 0.5)
            y = cy + 0.12 * math.sin(t * math.tau) + side * 0.24
            z = cz + 0.14 * math.sin(t * math.pi) + side
            mesh.positions.append((x, y, z))
            mesh.uvs.append((column / columns, t))
    for row in range(rows):
        for column in range(columns):
            a = base + row * (columns + 1) + column
            b = a + columns + 1
            mesh.indices.extend((a, a + 1, b, a + 1, b + 1, b))
    groups["Leather"].append(mesh)

    stitching = MeshBuilder()
    for edge in (-1, 1):
        points = []
        for index in range(13):
            t = index / 12
            points.append((cx + length * (t - 0.5), cy + 0.13 * math.sin(t * math.tau),
                           cz + 0.14 * math.sin(t * math.pi) + edge * width * 0.39))
        stitching.tube(points, 0.008, "seed", sides=5, steps=28)
    for index in range(19):
        t = index / 18
        for edge in (-1, 1):
            x = cx + length * (t - 0.5)
            z = cz + 0.14 * math.sin(t * math.pi) + edge * width * 0.39
            stitching.ellipsoid((x, cy + 0.14 * math.sin(t * math.tau) + 0.01, z),
                                (0.018, 0.009, 0.009), "amber", segments=8, rings=6)
    groups["Leather"].append(stitching)


def resin(groups, name, center, size=0.22, count=4, seed=8):
    rng = random.Random(seed)
    cx, cy, cz = center
    mesh = MeshBuilder()
    for index in range(count):
        angle = index * 2.399
        radius = size * (0.35 + index % 2 * 0.42)
        position = (cx + math.cos(angle) * size * 0.8,
                    cy + rng.uniform(-size * 0.7, size * 0.7),
                    cz + math.sin(angle) * size * 0.75)
        mesh.ellipsoid(position, (radius, size * rng.uniform(0.45, 0.8), radius * 0.72),
                       name, segments=18, rings=12, texture_bump=0.08)
    groups[name].append(mesh)


def citrus_slice(groups, center, radius, material="citrus_flesh", name="Orange"):
    cx, cy, cz = center
    back = MeshBuilder()
    back.ellipsoid((cx, cy, cz), (radius, 0.09, radius), "flower", segments=36, rings=18, texture_bump=0.01)
    groups[name].append(back)
    for segment in range(10):
        angle = segment * math.tau / 10
        wedge = MeshBuilder()
        for ring in range(2):
            r = radius * (0.18 if ring == 0 else 0.84)
            y = cy + 0.095 + (0.025 if ring == 0 else 0)
            for edge in range(3):
                theta = angle + (edge - 1) * math.tau / 10 * 0.47
                wedge.positions.append((cx + math.cos(theta) * r, y, cz + math.sin(theta) * r))
                wedge.uvs.append(((math.cos(theta) + 1) / 2, (math.sin(theta) + 1) / 2))
        wedge.indices.extend((0, 3, 4, 0, 4, 1, 0, 1, 2))
        wedge.ellipsoid((cx + math.cos(angle) * radius * 0.51, cy + 0.103,
                         cz + math.sin(angle) * radius * 0.51),
                        (radius * 0.3, 0.025, radius * 0.3), material, segments=12, rings=8)
        groups[name].append(wedge)
    pith = MeshBuilder()
    pith.ellipsoid((cx, cy + 0.13, cz), (radius * 0.12, 0.022, radius * 0.12),
                   "flower", segments=12, rings=8)
    groups[name].append(pith)


def vetiver_roots(groups, center, count=11):
    rng = random.Random(83)
    cx, cy, cz = center
    for index in range(count):
        angle = index * math.tau / count
        spread = rng.uniform(0.12, 0.52)
        start = (cx + math.cos(angle) * spread, cy + 0.35, cz + math.sin(angle) * spread)
        end = (cx + math.cos(angle) * (spread + rng.uniform(0.24, 0.56)),
               cy - rng.uniform(0.52, 0.94),
               cz + math.sin(angle) * (spread + rng.uniform(0.18, 0.44)))
        points = bezier(
            start,
            (start[0] - math.sin(angle) * 0.18, cy + 0.05, start[2] + math.cos(angle) * 0.14),
            (end[0] + math.sin(angle) * 0.12, cy - 0.28, end[2] - math.cos(angle) * 0.1),
            end,
            10,
        )
        root = MeshBuilder()
        root.tube(points, rng.uniform(0.025, 0.045), "wood", sides=8, steps=24, taper=True, lobes=0.12)
        groups["Vetiver"].append(root)


def citrus_peel(groups, center):
    cx, cy, cz = center
    curls = MeshBuilder()
    for offset, height in ((-0.18, 0.08), (0.02, -0.02), (0.2, 0.13)):
        points = bezier(
            (cx + offset - 0.3, cy - 0.18, cz),
            (cx + offset - 0.12, cy + height + 0.2, cz + 0.08),
            (cx + offset + 0.12, cy + height - 0.23, cz - 0.04),
            (cx + offset + 0.32, cy + 0.08, cz + 0.02),
            12,
        )
        curls.tube(points, 0.042, "citrus", sides=8, steps=32, taper=True, lobes=0.16)
    groups["Orange peel"].append(curls)


def jasmine_branch(groups, center, seed=10):
    cx, cy, cz = center
    branch = MeshBuilder()
    branch.tube([(cx - 0.72, cy - 0.48, cz), (cx - 0.22, cy - 0.14, cz - 0.05),
                 (cx + 0.22, cy + 0.23, cz + 0.02), (cx + 0.68, cy + 0.55, cz - 0.04)],
                0.032, "wood", sides=8, steps=28, taper=True)
    groups["Jasmine"].append(branch)
    flowers = MeshBuilder()
    for position in ((cx - 0.46, cy - 0.2, cz + 0.1), (cx + 0.08, cy + 0.08, cz + 0.13),
                     (cx + 0.48, cy + 0.36, cz + 0.04)):
        flower(groups, "Jasmine", position, petals=5, layers=1,
               material="flower", scale=0.29, seed=seed)


def musk_drops(groups, center):
    cx, cy, cz = center
    mesh = MeshBuilder()
    mesh.material = "citrus"
    for index, position in enumerate(((-0.19, 0.05, 0), (0.16, -0.02, 0.08), (0.0, 0.2, -0.1),
                                      (0.22, 0.29, -0.12), (-0.2, -0.16, 0.15))):
        mesh.ellipsoid((cx + position[0], cy + position[1], cz + position[2]),
                       (0.12, 0.17, 0.13), "musk", segments=22, rings=14, texture_bump=0.025)
    groups["Musk"].append(mesh)


def produce_scene(key):
    groups = defaultdict(list)
    if key == "amber-noir":
        berries(groups, "Pink pepper", (-0.88, 0.76, 0.28), count=19, size=0.085, seed=17)
        threads(groups, "Saffron", (0.95, 0.74, 0.14), seed=25)
        pod(groups, "Vanilla", (0.0, 0.94, 0.1), 0.86, 0.095, "vanilla", seed=28)
        pod(groups, "Cinnamon", (-1.0, -0.66, -0.12), 0.82, 0.085, "wood", seed=34)
        resin(groups, "Amber", (0.05, -0.72, 0.34), size=0.24, count=6, seed=19)
        wood_chips(groups, "Cedar", (-1.0, -0.55, -0.38), count=5, seed=21)
        wood_chips(groups, "Sandalwood", (1.02, -0.72, -0.32), count=5, seed=38)
    elif key == "velvet-bloom":
        flower(groups, "Peony", (0.0, 0.66, 0.05), petals=10, layers=3, scale=0.60, seed=32)
        flower(groups, "Rose", (-0.72, -0.05, 0.34), petals=8, layers=3, material="rose", scale=0.52, seed=36)
        jasmine_branch(groups, (0.90, 0.02, -0.13), seed=39)
        musk_drops(groups, (-0.05, -0.82, 0.45))
    elif key == "citrus-ombre":
        fruit(groups, "Bergamot", (-0.9, 0.22, 0.1), (0.43, 0.39, 0.39), seed=49)
        fruit(groups, "Lemon", (0.92, -0.22, -0.18), (0.40, 0.35, 0.37), seed=50)
        citrus_slice(groups, (0.92, -0.22, 0.23), 0.30, name="Lemon")
        flower(groups, "Neroli", (-0.05, 0.88, 0.25), petals=5, layers=2, material="flower", scale=0.42, seed=56)
        vetiver_roots(groups, (0.08, -0.65, -0.28))
    else:
        threads(groups, "Saffron", (-0.05, 0.88, 0.20), seed=68)
        wood_chips(groups, "Oud wood", (-1.12, -0.35, -0.18), count=7, dark=True, seed=72)
        leather(groups, (0.92, -0.30, 0.45), seed=77)
        leaf_spray(groups, "Patchouli", (0.26, -0.96, -0.24), length=0.62, count=4, seed=79)
        wood_chips(groups, "Sandalwood", (1.0, -0.94, -0.24), count=5, seed=88)
    return groups


def make_normals(positions, indices):
    normals = [[0.0, 0.0, 0.0] for _ in positions]
    for offset in range(0, len(indices), 3):
        ia, ib, ic = indices[offset:offset + 3]
        a, b, c = positions[ia], positions[ib], positions[ic]
        ab = [b[axis] - a[axis] for axis in range(3)]
        ac = [c[axis] - a[axis] for axis in range(3)]
        normal = cross(ab, ac)
        for vertex in (ia, ib, ic):
            normals[vertex] = [normals[vertex][axis] + normal[axis] for axis in range(3)]
    return [component / (math.sqrt(sum(value * value for value in normal)) or 1)
            for normal in normals for component in normal]


def write_glb(path, groups, material_map):
    binary = bytearray()
    views, accessors, meshes, nodes = [], [], [], []

    for ingredient_name, builders in groups.items():
        if ingredient_name == "_scene_roots":
            continue
        mesh_nodes = []
        for builder in builders:
            if not builder.indices:
                continue
            positions, uvs, indices = builder.positions, builder.uvs, builder.indices
            binary.extend(b"\0" * ((-len(binary)) % 4))
            positions_offset = len(binary)
            flat_positions = [value for position in positions for value in position]
            binary.extend(struct.pack(f"<{len(flat_positions)}f", *flat_positions))
            position_view = len(views)
            views.append({"buffer": 0, "byteOffset": positions_offset,
                          "byteLength": len(flat_positions) * 4, "target": 34962})
            position_accessor = len(accessors)
            bounds = [[min(point[axis] for point in positions), max(point[axis] for point in positions)]
                      for axis in range(3)]
            accessors.append({"bufferView": position_view, "componentType": 5126,
                              "count": len(positions), "type": "VEC3",
                              "min": [bound[0] for bound in bounds],
                              "max": [bound[1] for bound in bounds]})

            flat_normals = make_normals(positions, indices)
            binary.extend(b"\0" * ((-len(binary)) % 4))
            normal_offset = len(binary)
            binary.extend(struct.pack(f"<{len(flat_normals)}f", *flat_normals))
            normal_view = len(views)
            views.append({"buffer": 0, "byteOffset": normal_offset,
                          "byteLength": len(flat_normals) * 4, "target": 34962})
            normal_accessor = len(accessors)
            accessors.append({"bufferView": normal_view, "componentType": 5126,
                              "count": len(positions), "type": "VEC3"})

            binary.extend(b"\0" * ((-len(binary)) % 4))
            uv_offset = len(binary)
            flat_uvs = [value for uv in uvs for value in uv]
            binary.extend(struct.pack(f"<{len(flat_uvs)}f", *flat_uvs))
            uv_view = len(views)
            views.append({"buffer": 0, "byteOffset": uv_offset,
                          "byteLength": len(flat_uvs) * 4, "target": 34962})
            uv_accessor = len(accessors)
            accessors.append({"bufferView": uv_view, "componentType": 5126,
                              "count": len(positions), "type": "VEC2"})

            binary.extend(b"\0" * ((-len(binary)) % 4))
            index_offset = len(binary)
            component_type = 5123 if len(positions) <= 65535 else 5125
            index_format = "H" if component_type == 5123 else "I"
            binary.extend(struct.pack(f"<{len(indices)}{index_format}", *indices))
            index_view = len(views)
            views.append({"buffer": 0, "byteOffset": index_offset,
                          "byteLength": len(indices) * (component_type // 8), "target": 34963})
            index_accessor = len(accessors)
            accessors.append({"bufferView": index_view, "componentType": component_type,
                              "count": len(indices), "type": "SCALAR"})

            material = material_map.get(getattr(builder, "material", None), material_map["seed"])
            meshes.append({
                "name": ingredient_name,
                "primitives": [{
                    "attributes": {"POSITION": position_accessor, "NORMAL": normal_accessor,
                                   "TEXCOORD_0": uv_accessor},
                    "indices": index_accessor,
                    "material": material,
                }],
            })
            nodes.append({"name": f"{ingredient_name} · detail", "mesh": len(meshes) - 1})
            mesh_nodes.append(len(nodes) - 1)

        if mesh_nodes:
            nodes.append({"name": ingredient_name, "children": mesh_nodes})
            groups.setdefault("_scene_roots", []).append(len(nodes) - 1)

    image_views = {}
    images = []
    textures = []
    for texture_name, data in TEXTURES.items():
        binary.extend(b"\0" * ((-len(binary)) % 4))
        offset = len(binary)
        binary.extend(data)
        image_views[texture_name] = len(views)
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(data)})
        images.append({"name": texture_name, "bufferView": image_views[texture_name], "mimeType": "image/png"})
        textures.append({"sampler": 0, "source": len(textures)})

    material_specs = {
        "citrus": ("citrus", 0.0, 0.44),
        "citrus_flesh": ("citrus", 0.0, 0.30),
        "leaf": ("leaf", 0.0, 0.48),
        "rose": ("rose", 0.0, 0.38),
        "flower": ("flower", 0.0, 0.34),
        "wood": ("wood", 0.0, 0.55),
        "vanilla": ("vanilla", 0.0, 0.45),
        "seed": ("seed", 0.0, 0.49),
        "amber": ("amber", 0.1, 0.20),
        "leather": ("leather", 0.0, 0.56),
        "smoke": ("smoke", 0.0, 0.8),
        "musk": ("flower", 0.08, 0.22),
    }
    materials = []
    texture_index = {name: index for index, name in enumerate(TEXTURES)}
    for name, (texture, metalness, roughness) in material_specs.items():
        definition = {
            "name": name.replace("_", " ").title(),
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": texture_index[texture]},
                "metallicFactor": metalness,
                "roughnessFactor": roughness,
                "roughnessTexture": {"index": texture_index[texture + "_rough"]},
            },
            "doubleSided": name in ("rose", "flower", "leaf", "leather", "smoke"),
        }
        if name == "amber":
            definition["alphaMode"] = "BLEND"
            definition["extensions"] = {
                "KHR_materials_transmission": {"transmissionFactor": 0.34},
                "KHR_materials_ior": {"ior": 1.38},
            }
        elif name == "smoke":
            definition["alphaMode"] = "BLEND"
        materials.append(definition)

    extensions_used = ["KHR_materials_ior", "KHR_materials_transmission"]
    gltf = {
        "asset": {"version": "2.0", "generator": "ÉCLAT original botanical ingredient modeller"},
        "extensionsUsed": extensions_used,
        "extensionsRequired": [],
        "scene": 0,
        "scenes": [{"nodes": groups["_scene_roots"]}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": materials,
        "textures": textures,
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
        "images": images,
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": views,
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


def main():
    for key in ("amber-noir", "velvet-bloom", "citrus-ombre", "midnight-oud"):
        groups = produce_scene(key)
        groups["_scene_roots"] = []
        path = ROOT / f"{key}-ingredients.glb"
        write_glb(path, groups, {
            "citrus": 0, "citrus_flesh": 1, "leaf": 2, "rose": 3, "flower": 4,
            "wood": 5, "vanilla": 6, "seed": 7, "amber": 8, "leather": 9,
            "smoke": 10, "musk": 11,
        })
        summary = ", ".join(name for name in groups if name != "_scene_roots")
        print(f"Created {path.name} ({path.stat().st_size:,} bytes) — {summary}")


if __name__ == "__main__":
    main()
