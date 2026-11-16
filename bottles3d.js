import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/HDRLoader.js';

const fragrances = {
  'amber-noir': {
    name: 'AMBER NOIR',
    color: '#b96c2d',
    atomizer: '#98764c',
    cap: '#191512',
    capMetalness: 0.32,
    width: 1.04,
    depth: 0.45,
    shape: 3.5,
    glassRoughness: 0.038,
    attenuation: '#d9ad70',
    attenuationDistance: 4.5
  },
  'velvet-bloom': {
    name: 'VELVET BLOOM',
    color: '#bc7775',
    atomizer: '#b79280',
    cap: '#d8b8a8',
    capMetalness: 0.48,
    width: 0.89,
    depth: 0.46,
    shape: 2.0,
    glassRoughness: 0.085,
    attenuation: '#c88d9c',
    attenuationDistance: 3.2
  },
  'citrus-ombre': {
    name: 'CITRUS OMBRE',
    color: '#cb982e',
    atomizer: '#b7955d',
    cap: '#d6ad70',
    capMetalness: 0.75,
    width: 0.74,
    depth: 0.38,
    shape: 2,
    glassRoughness: 0.025,
    attenuation: '#d5bc69',
    attenuationDistance: 5.5
  },
  'midnight-oud': {
    name: 'MIDNIGHT OUD',
    color: '#503027',
    atomizer: '#817669',
    cap: '#171311',
    capMetalness: 0.4,
    width: 0.94,
    depth: 0.48,
    shape: 5.2,
    glassRoughness: 0.05,
    attenuation: '#57342b',
    attenuationDistance: 2.6
  }
};

const loader = new GLTFLoader();
const modelRequests = new Map();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function loadEnvironment() {
  if (!window.__eclatEnvironmentRequest) {
    window.__eclatEnvironmentRequest = new HDRLoader()
      .loadAsync(new URL('./assets/models/studio_small_03_1k.hdr', import.meta.url).href)
      .then((texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        return texture;
      })
      .catch((error) => {
        console.error('ÉCLAT studio lighting could not be loaded.', error);
        return null;
      });
  }
  return window.__eclatEnvironmentRequest;
}

function getFragranceKey(host) {
  return host.dataset.fragrance
    || host.closest('.fragrance-card')?.dataset.fragrance
    || host.closest('.shop-card')?.dataset.id;
}

function loadModel(key) {
  if (!modelRequests.has(key)) {
    const url = new URL(`./assets/models/${key}.glb`, import.meta.url).href;
    modelRequests.set(key, loader.loadAsync(url));
  }
  return modelRequests.get(key);
}

function createLabelTexture(fragrance) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 448;
  const context = canvas.getContext('2d');

  const paper = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  paper.addColorStop(0, '#261d16');
  paper.addColorStop(0.52, '#17120f');
  paper.addColorStop(1, '#21170f');
  context.fillStyle = paper;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = '#bf9964';
  context.lineWidth = 5;
  context.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
  context.strokeStyle = 'rgba(217, 180, 125, 0.52)';
  context.lineWidth = 1;
  context.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);

  context.textAlign = 'center';
  context.fillStyle = '#d7bd93';
  context.font = '500 29px Inter, Arial, sans-serif';
  context.letterSpacing = '12px';
  context.fillText('ÉCLAT · PARIS', canvas.width / 2, 94);

  context.fillStyle = '#f3e7d2';
  context.font = '600 76px "Cormorant Garamond", Georgia, serif';
  context.letterSpacing = '1px';
  context.fillText(fragrance.name, canvas.width / 2, 222);

  context.strokeStyle = 'rgba(191, 153, 100, 0.66)';
  context.beginPath();
  context.moveTo(244, 266);
  context.lineTo(524, 266);
  context.stroke();

  context.fillStyle = '#d7bd93';
  context.font = '500 22px Inter, Arial, sans-serif';
  context.letterSpacing = '5px';
  context.fillText('EAU DE PARFUM', canvas.width / 2, 324);
  context.font = '400 17px Inter, Arial, sans-serif';
  context.letterSpacing = '4px';
  context.fillText('100 ML  ·  3.4 FL.OZ', canvas.width / 2, 376);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createLabelGeometry(width, depth, exponent) {
  const columns = 32;
  const rows = 4;
  const labelWidth = Math.min(width * 1.12, 1.16);
  const labelHeight = 0.68;
  const centerY = 1.32;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let row = 0; row <= rows; row += 1) {
    const y = centerY - labelHeight / 2 + labelHeight * row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const x = -labelWidth / 2 + labelWidth * column / columns;
      const edge = Math.min(0.999, Math.abs(x) / width);
      const front = depth * Math.pow(1 - Math.pow(edge, exponent), 1 / exponent);
      positions.push(x, y, front + 0.012);
      uvs.push(column / columns, row / rows);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const current = row * (columns + 1) + column;
      const next = current + columns + 1;
      indices.push(current, current + 1, next, current + 1, next + 1, next);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createGroundShadow(includeContact = true) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 64, 5, 128, 64, 62);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.66)');
  gradient.addColorStop(0.24, 'rgba(0, 0, 0, 0.38)');
  gradient.addColorStop(0.52, 'rgba(0, 0, 0, 0.16)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  const geometry = new THREE.PlaneGeometry(3.2, 1.6);
  const shadow = new THREE.Mesh(geometry, material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -1.91, -0.02);

  let contactGeometry;
  let contactMaterial;
  let contactShadow;
  if (includeContact) {
    contactGeometry = new THREE.PlaneGeometry(2.4, 0.56);
    contactMaterial = material.clone();
    contactMaterial.opacity = 0.24;
    contactShadow = new THREE.Mesh(contactGeometry, contactMaterial);
    contactShadow.position.set(0, -1.72, -0.55);
  }
  return { shadow, contactShadow, geometry, material, contactGeometry, contactMaterial, texture };
}

function createQuietSurfaceTexture(image, resources) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');

  if (image.complete && image.naturalWidth > 0) {
    const reflectionHeight = 112;
    const reflectionWidth = Math.min(92, Math.round(
      reflectionHeight * image.naturalWidth / image.naturalHeight
    ));
    const reflection = document.createElement('canvas');
    reflection.width = reflectionWidth;
    reflection.height = reflectionHeight;
    const reflectionContext = reflection.getContext('2d');
    reflectionContext.save();
    reflectionContext.translate(0, reflectionHeight);
    reflectionContext.scale(1, -1);
    reflectionContext.globalAlpha = 0.12;
    reflectionContext.drawImage(image, 0, 0, reflectionWidth, reflectionHeight);
    reflectionContext.restore();

    reflectionContext.globalCompositeOperation = 'destination-in';
    const fade = reflectionContext.createLinearGradient(0, 0, 0, reflectionHeight);
    fade.addColorStop(0, 'rgba(255,255,255,0.72)');
    fade.addColorStop(0.35, 'rgba(255,255,255,0.34)');
    fade.addColorStop(1, 'rgba(255,255,255,0)');
    reflectionContext.fillStyle = fade;
    reflectionContext.fillRect(0, 0, reflectionWidth, reflectionHeight);
    context.drawImage(reflection, (canvas.width - reflectionWidth) / 2, canvas.height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  resources.textures.push(texture);
  return texture;
}

function createQuietFloorGeometry(floorY) {
  const xBreaks = [-100, -1.3, 1.3, 100];
  const zBreaks = [-100, 0, 3.2, 100];
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let zIndex = 0; zIndex < zBreaks.length - 1; zIndex += 1) {
    for (let xIndex = 0; xIndex < xBreaks.length - 1; xIndex += 1) {
      const x0 = xBreaks[xIndex];
      const x1 = xBreaks[xIndex + 1];
      const z0 = zBreaks[zIndex];
      const z1 = zBreaks[zIndex + 1];
      const reflectionCell = xIndex === 1 && zIndex === 1;
      const u0 = reflectionCell ? 0.41 : 0.02;
      const u1 = reflectionCell ? 0.59 : 0.02;
      const v0 = reflectionCell ? 0.5 : 0.02;
      const v1 = reflectionCell ? 0.28 : 0.02;
      const offset = positions.length / 3;

      positions.push(
        x0, floorY, z0,
        x0, floorY, z1,
        x1, floorY, z0,
        x1, floorY, z1
      );
      uvs.push(u0, v0, u0, v1, u1, v0, u1, v1);
      indices.push(offset, offset + 1, offset + 2, offset + 1, offset + 3, offset + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addQuietEditorialDetails(scene, resources, floorY, bottleImage) {
  const surfaceGeometry = createQuietFloorGeometry(floorY);
  const surfaceMaterial = new THREE.MeshBasicMaterial({
    map: createQuietSurfaceTexture(bottleImage, resources),
    transparent: true,
    depthWrite: false
  });
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  scene.add(surface);
  resources.geometries.push(surfaceGeometry);
  resources.materials.push(surfaceMaterial);

  const particlePositions = new Float32Array([
    -1.55, 1.72, -0.55, 1.58, 1.22, -0.72,
    -1.62, 0.86, -0.4, 1.64, 0.42, -0.6,
    -1.48, -0.18, -0.65, 1.53, -0.72, -0.45,
    -1.34, -1.18, -0.7, 1.38, -1.32, -0.5,
    -1.1, 2.15, -1.15, 1.08, 1.92, -1.0,
    -1.76, 0.05, -1.25, 1.82, -0.25, -1.1
  ]);
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMaterial = new THREE.PointsMaterial({
    color: 0xe4d1aa,
    size: 0.034,
    transparent: true,
    opacity: 0.34,
    depthWrite: false
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);
  resources.geometries.push(particleGeometry);
  resources.materials.push(particleMaterial);

  const editorialKey = new THREE.SpotLight(0xffe8cc, 18, 16, Math.PI / 7, 0.72, 2);
  editorialKey.position.set(-3.4, 4.4, 3.2);
  editorialKey.target.position.set(0, 0, 0);
  scene.add(editorialKey, editorialKey.target);
  return particles;
}

function configureLiquidGeometry(geometry, fragrance) {
  geometry.computeBoundingBox();
  const positions = geometry.getAttribute('position');
  const topY = geometry.boundingBox.max.y;
  let shoulderY = -Infinity;

  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index);
    if (y < topY - 0.0001) shoulderY = Math.max(shoulderY, y);
  }

  const getRingRadii = (ringY) => {
    const radii = { x: 0, z: 0 };
    for (let index = 0; index < positions.count; index += 1) {
      if (Math.abs(positions.getY(index) - ringY) > 0.0001) continue;
      radii.x = Math.max(radii.x, Math.abs(positions.getX(index)));
      radii.z = Math.max(radii.z, Math.abs(positions.getZ(index)));
    }
    return radii;
  };

  const topRadii = getRingRadii(topY);
  const shoulderRadii = getRingRadii(shoulderY);
  const radiusX = shoulderRadii.x * 0.97;
  const radiusZ = shoulderRadii.z * 0.97;
  const scaleX = radiusX / topRadii.x;
  const scaleZ = radiusZ / topRadii.z;
  const shadowColor = new THREE.Color(fragrance.color).multiplyScalar(0.42);
  const baseColor = new THREE.Color(fragrance.color);
  const surfaceColor = baseColor.clone().lerp(new THREE.Color(0xfff0d7), 0.32);
  const colors = new Float32Array(positions.count * 3);
  const height = topY - geometry.boundingBox.min.y;

  for (let index = 0; index < positions.count; index += 1) {
    let x = positions.getX(index);
    let y = positions.getY(index);
    let z = positions.getZ(index);

    if (Math.abs(y - topY) <= 0.0001) {
      x *= scaleX;
      z *= scaleZ;
      const radius = Math.min(1, Math.hypot(x / radiusX, z / radiusZ));
      y -= 0.025 * (1 - radius) ** 2;
      positions.setXYZ(index, x, y, z);
    }

    const level = THREE.MathUtils.clamp((y - geometry.boundingBox.min.y) / height, 0, 1);
    const depth = THREE.MathUtils.smoothstep(level, 0, 0.82);
    const color = shadowColor.clone().lerp(baseColor, depth);
    color.lerp(surfaceColor, THREE.MathUtils.smoothstep(level, 0.7, 1) * 0.42);
    color.toArray(colors, index * 3);
  }

  positions.needsUpdate = true;
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function configureModel(scene, fragrance, resources) {
  const model = scene.clone(true);
  const capColor = new THREE.Color(fragrance.cap);

  model.traverse((object) => {
    if (!object.isMesh) return;

    let material;
    if (object.name === 'BottleGlass') {
      material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: fragrance.glassRoughness,
        transmission: 1,
        thickness: 0.9,
        ior: 1.5,
        clearcoat: 1,
        clearcoatRoughness: 0.018,
        attenuationColor: new THREE.Color(fragrance.attenuation),
        attenuationDistance: fragrance.attenuationDistance,
        envMapIntensity: 1.5,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        side: THREE.DoubleSide
      });
    } else if (object.name === 'FragranceCore') {
      object.geometry = object.geometry.clone();
      resources.geometries.push(object.geometry);
      configureLiquidGeometry(object.geometry, fragrance);
      material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.12,
        transmission: 0.42,
        thickness: 0.62,
        ior: 1.36,
        attenuationColor: new THREE.Color(fragrance.color),
        attenuationDistance: fragrance.attenuationDistance * 0.55,
        envMapIntensity: 1.15,
        clearcoat: 0.92,
        clearcoatRoughness: 0.035,
        vertexColors: true
      });
    } else if (object.name === 'CapShell') {
      material = new THREE.MeshPhysicalMaterial({
        color: capColor,
        metalness: fragrance.capMetalness,
        roughness: 0.2,
        clearcoat: 0.6,
        clearcoatRoughness: 0.1
      });
    } else if (object.name === 'AtomizerActuator') {
      material = new THREE.MeshPhysicalMaterial({
        color: fragrance.atomizer,
        metalness: 0.72,
        roughness: 0.24,
        clearcoat: 0.76,
        clearcoatRoughness: 0.12
      });
    } else if (object.name === 'AtomizerTube') {
      material = new THREE.MeshPhysicalMaterial({
        color: 0xbfc6c3,
        metalness: 0.08,
        roughness: 0.28,
        transmission: 0.38,
        transparent: true,
        opacity: 0.32,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
      });
    } else if (object.name === 'AtomizerAperture') {
      material = new THREE.MeshStandardMaterial({
        color: 0x171411,
        metalness: 0.18,
        roughness: 0.42
      });
    } else {
      material = new THREE.MeshPhysicalMaterial({
        color: object.name.includes('Gold') ? 0xc49b61 : 0xb7a58d,
        metalness: 0.86,
        roughness: object.name.includes('Gold') ? 0.23 : 0.18,
        clearcoat: 0.82
      });
    }

    object.material = material;
    object.castShadow = true;
    object.receiveShadow = true;
    resources.materials.push(material);
  });

  const labelTexture = createLabelTexture(fragrance);
  const labelMaterial = new THREE.MeshPhysicalMaterial({
    map: labelTexture,
    roughness: 0.38,
    metalness: 0.12,
    clearcoat: 0.28
  });
  const label = new THREE.Mesh(
    createLabelGeometry(fragrance.width, fragrance.depth, fragrance.shape),
    labelMaterial
  );
  label.name = 'ÉCLAT engraved fragrance label';
  label.position.z += 0.01;
  label.castShadow = true;
  model.add(label);
  resources.materials.push(labelMaterial);
  resources.textures.push(labelTexture);

  const capPivot = new THREE.Group();
  capPivot.name = 'ÉCLAT lift-off cap';
  capPivot.position.y = 3.05;
  for (const partName of ['CapShell', 'CapGold', 'CapCrown']) {
    const part = model.getObjectByName(partName);
    if (!part) throw new Error(`The ${fragrance.name} model is missing ${partName}.`);
    part.parent.remove(part);
    part.position.y -= capPivot.position.y;
    capPivot.add(part);
  }
  model.add(capPivot);
  const aperture = model.getObjectByName('AtomizerAperture');
  if (!aperture) throw new Error(`The ${fragrance.name} model is missing its atomizer aperture.`);
  return { model, capPivot, aperture };
}

class BottleViewer {
  constructor(host, fallback, key) {
    this.host = host;
    this.fallback = fallback;
    this.key = key;
    this.fragrance = fragrances[key];
    this.isQuietScene = host.classList.contains('quiet-bottle');
    this.targetRotation = new THREE.Vector2(-0.04, -0.16);
    this.hoverRotation = new THREE.Vector2();
    this.cameraPointerOffset = new THREE.Vector2();
    this.lightPointerOffset = new THREE.Vector2();
    this.angularVelocity = new THREE.Vector2();
    this.dragStart = new THREE.Vector2();
    this.lastPoint = new THREE.Vector2();
    this.dragging = false;
    this.dragged = false;
    this.pointerId = null;
    this.paused = false;
    this.lastMoveTime = 0;
    this.lastFrameTime = 0;
    this.disposed = false;
    this.frame = 0;
    this.resources = { geometries: [], materials: [], textures: [] };
    this.sprayBurst = null;
    this.mistTexture = null;
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onCapChange = this.onCapChange.bind(this);
    this.onSprayRequest = this.onSprayRequest.bind(this);
    this.render = this.render.bind(this);
  }

  async start() {
    try {
      const [gltf, environment] = await Promise.all([
        loadModel(this.key),
        loadEnvironment()
      ]);
      if (this.disposed) return;

      const width = Math.max(1, this.host.clientWidth);
      const height = Math.max(1, this.host.clientHeight);
      this.scene = new THREE.Scene();
      this.scene.environment = environment;
      this.scene.environmentIntensity = 0.9;

      this.camera = new THREE.PerspectiveCamera(29, width / height, 0.1, 100);
      this.camera.position.set(0, 0.05, 8.6);
      this.camera.lookAt(0, 0, 0);
      this.cameraRestPosition = this.camera.position.clone();

      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !window.matchMedia('(max-width: 700px)').matches,
        powerPreference: 'low-power'
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.setSize(width, height);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.22;
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.domElement.className = 'bottle-3d-canvas';
      this.renderer.domElement.setAttribute('aria-label', `${this.fragrance.name}: интерактивная 3D-модель флакона. Перемещайте указатель или используйте стрелки.`);
      this.renderer.domElement.setAttribute('role', 'img');
      this.renderer.domElement.tabIndex = 0;
      this.host.appendChild(this.renderer.domElement);

      this.scene.add(new THREE.AmbientLight(0xffe6c6, 0.72));
      this.scene.add(new THREE.HemisphereLight(0xfff0d7, 0x17100c, 1.3));
      this.keyLight = new THREE.PointLight(0xffe4bd, 42, 14);
      this.keyLight.position.set(-3.1, 4.2, 4.1);
      this.keyLightRestPosition = this.keyLight.position.clone();
      this.scene.add(this.keyLight);
      const rimLight = new THREE.PointLight(0x8eabc0, 22, 13);
      rimLight.position.set(3.0, 1.0, -2.2);
      this.scene.add(rimLight);
      const topLight = new THREE.PointLight(0xffffff, 15, 11);
      topLight.position.set(0.2, 4.8, 1.2);
      this.scene.add(topLight);

      const shadow = createGroundShadow(!this.isQuietScene);
      this.scene.add(shadow.shadow);
      if (shadow.contactShadow) this.scene.add(shadow.contactShadow);
      this.resources.shadow = shadow;
      const configured = configureModel(gltf.scene, this.fragrance, this.resources);
      this.model = configured.model;
      this.capPivot = configured.capPivot;
      this.aperture = configured.aperture;
      this.capTarget = this.host.dataset.capOpen === 'true' ? 1 : 0;
      this.capProgress = this.capTarget;
      this.capSettled = true;
      this.host.dataset.capSettled = 'true';
      this.capProgressStep = Math.round(this.capProgress * 20);
      this.host.dataset.capProgress = (this.capProgressStep / 20).toFixed(2);
      this.capPivot.position.y = 3.05 + this.capProgress * 0.52;
      this.capPivot.rotation.x = -this.capProgress * 0.035;
      this.model.position.y = -2.0;
      this.model.rotation.y = -0.16;
      if (this.isQuietScene) this.model.rotation.x = this.targetRotation.x;
      this.scene.add(this.model);
      if (this.isQuietScene) {
        this.model.updateMatrixWorld(true);
        const bottleBounds = new THREE.Box3().setFromObject(this.model);
        this.floorY = bottleBounds.min.y - 0.006;
        shadow.shadow.position.y = this.floorY + 0.002;
        this.particles = addQuietEditorialDetails(this.scene, this.resources, this.floorY, this.fallback);
      }
      this.bindInteraction(this.renderer.domElement);

      this.fallback.classList.add('bottle-3d-fallback');
      this.host.classList.add('bottle-3d-ready');
      this.host.setAttribute('data-3d-loaded', 'true');
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.host);
      if (!this.paused) {
        this.frame = requestAnimationFrame(this.render);
      }
    } catch (error) {
      this.dispose();
      console.error(`ÉCLAT ${this.key} 3D bottle could not be displayed; retaining its image fallback.`, error);
    }
  }

  bindInteraction(canvas) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('click', this.onClick);
    canvas.addEventListener('keydown', this.onKeyDown);
    this.host.addEventListener('capchange', this.onCapChange);
    this.host.addEventListener('sprayrequest', this.onSprayRequest);
  }

  onPointerDown(event) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    this.dragging = true;
    this.dragged = false;
    this.pointerId = event.pointerId;
    this.angularVelocity.set(0, 0);
    this.hoverRotation.set(0, 0);
    this.dragStart.set(event.clientX, event.clientY);
    this.lastPoint.set(event.clientX, event.clientY);
    this.lastMoveTime = event.timeStamp;
    event.currentTarget.setPointerCapture(event.pointerId);
    this.renderer.domElement.classList.add('is-dragging');
    event.stopPropagation();
  }

  onPointerMove(event) {
    const rect = this.host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    if (this.isQuietScene) {
      this.cameraPointerOffset.set(x * 0.12, -y * 0.1);
      this.lightPointerOffset.set(x * 0.65, -y * 0.42);
    } else {
      this.keyLight.position.set(-3.1 + x * 2.2, 4.2 - y * 1.5, 4.1);
    }

    if (!this.dragging) {
      if (event.pointerType === 'mouse') {
        if (!this.isQuietScene) this.hoverRotation.set(-y * 0.075, x * 0.09);
      }
      return;
    }
    if (event.pointerId !== this.pointerId) return;

    const deltaX = event.clientX - this.lastPoint.x;
    const deltaY = event.clientY - this.lastPoint.y;
    const totalX = event.clientX - this.dragStart.x;
    const totalY = event.clientY - this.dragStart.y;

    const prefersPageScroll = event.pointerType === 'touch'
      && Math.abs(totalY) > 12
      && Math.abs(totalY) > Math.abs(totalX) * 1.15;
    if (prefersPageScroll) {
      this.dragging = false;
      this.pointerId = null;
      this.angularVelocity.set(0, 0);
      this.renderer.domElement.classList.remove('is-dragging');
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }

    if (Math.hypot(totalX, totalY) > 5) {
      this.dragged = true;
    }
    const elapsed = Math.max((event.timeStamp - this.lastMoveTime) / 1000, 1 / 120);
    const rotationX = deltaY * 0.008;
    const rotationY = deltaX * 0.01;
    this.targetRotation.y += rotationY;
    if (!this.isQuietScene) {
      this.targetRotation.x = THREE.MathUtils.clamp(this.targetRotation.x + rotationX, -0.7, 0.58);
      this.angularVelocity.x = THREE.MathUtils.lerp(
        this.angularVelocity.x,
        THREE.MathUtils.clamp(rotationX / elapsed, -5, 5),
        0.45
      );
    }
    this.angularVelocity.y = THREE.MathUtils.lerp(
      this.angularVelocity.y,
      THREE.MathUtils.clamp(rotationY / elapsed, -8, 8),
      0.45
    );
    this.lastPoint.set(event.clientX, event.clientY);
    this.lastMoveTime = event.timeStamp;
    event.stopPropagation();
  }

  onPointerUp(event) {
    if (event.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.pointerId = null;
    this.renderer?.domElement.classList.remove('is-dragging');
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.stopPropagation();
  }

  onPointerCancel(event) {
    if (event.pointerId !== this.pointerId) return;
    this.angularVelocity.set(0, 0);
    this.onPointerUp(event);
  }

  onPointerLeave() {
    if (this.dragging) return;
    this.hoverRotation.set(0, 0);
    this.cameraPointerOffset.set(0, 0);
    this.lightPointerOffset.set(0, 0);
  }

  onClick(event) {
    if (this.dragged) {
      event.preventDefault();
      event.stopPropagation();
      this.dragged = false;
      return;
    }
    this.setCapOpen(this.capTarget < 0.5);
  }

  onCapChange() {
    this.setCapOpen(this.host.dataset.capOpen === 'true');
  }

  setCapOpen(open) {
    this.capTarget = open ? 1 : 0;
    this.capSettled = false;
    this.host.dataset.capSettled = 'false';
    this.host.dataset.capOpen = String(open);
    this.host.dispatchEvent(new CustomEvent('capstatechange', { detail: { open } }));
  }

  onSprayRequest() {
    if (this.capTarget < 0.98 || !this.capSettled) {
      this.host.dispatchEvent(new Event('sprayblocked'));
      return;
    }

    try {
      this.scene.updateMatrixWorld(true);
      this.aperture.geometry.computeBoundingBox();
      const bounds = this.aperture.geometry.boundingBox;
      const origin = new THREE.Vector3(
        (bounds.min.x + bounds.max.x) * 0.5,
        (bounds.min.y + bounds.max.y) * 0.5,
        bounds.max.z
      );
      this.aperture.localToWorld(origin);
      const direction = new THREE.Vector3(0, 0, 1)
        .transformDirection(this.aperture.matrixWorld)
        .normalize();
      this.startSpray(origin, direction);
      this.host.dispatchEvent(new CustomEvent('spraylaunched', {
        detail: { origin: origin.toArray(), direction: direction.toArray() }
      }));
    } catch (error) {
      console.error(`ÉCLAT ${this.key} atomizer spray could not be displayed.`, error);
      this.host.dispatchEvent(new CustomEvent('sprayerror', {
        detail: { message: error.message }
      }));
    }
  }

  startSpray(origin, direction) {
    this.disposeSprayBurst();

    const count = reducedMotion ? 32 : 56;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const opacities = new Float32Array(count);
    const baseSizes = new Float32Array(count);
    const lifetimes = new Float32Array(count);
    const velocities = [];
    const reference = Math.abs(direction.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
    const right = new THREE.Vector3().crossVectors(direction, reference).normalize();
    const up = new THREE.Vector3().crossVectors(right, direction).normalize();
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      const angle = index * goldenAngle;
      const spread = 0.035 + ((index * 7) % 13) / 12 * 0.19;
      const speed = 0.72 + ((index * 17) % count) / count * 0.44;
      const lateral = right.clone().multiplyScalar(Math.cos(angle))
        .addScaledVector(up, Math.sin(angle))
        .multiplyScalar(spread * speed);
      velocities.push(direction.clone().multiplyScalar(speed).add(lateral));
      positions[offset] = origin.x;
      positions[offset + 1] = origin.y;
      positions[offset + 2] = origin.z;
      baseSizes[index] = 0.04 + ((index * 11) % 17) / 16 * 0.04;
      sizes[index] = baseSizes[index];
      opacities[index] = 0.92;
      lifetimes[index] = 0.62 + ((index * 13) % 19) / 18 * 0.34;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xe9dcc1) } },
      vertexShader: `
        attribute float aSize;
        attribute float aOpacity;
        varying float vOpacity;
        void main() {
          vOpacity = aOpacity;
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (880.0 / max(1.0, -viewPosition.z));
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vOpacity;
        void main() {
          float distanceFromCenter = length(gl_PointCoord - vec2(0.5));
          float softness = 1.0 - smoothstep(0.12, 0.5, distanceFromCenter);
          gl_FragColor = vec4(uColor, vOpacity * softness);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geometry, material);
    points.renderOrder = 5;

    if (!this.mistTexture) {
      const mistCanvas = document.createElement('canvas');
      mistCanvas.width = 128;
      mistCanvas.height = 128;
      const mistContext = mistCanvas.getContext('2d');
      const mistGradient = mistContext.createRadialGradient(64, 64, 2, 64, 64, 62);
      mistGradient.addColorStop(0, 'rgba(255,255,255,0.68)');
      mistGradient.addColorStop(0.35, 'rgba(236,225,203,0.28)');
      mistGradient.addColorStop(1, 'rgba(218,204,177,0)');
      mistContext.fillStyle = mistGradient;
      mistContext.fillRect(0, 0, 128, 128);
      this.mistTexture = new THREE.CanvasTexture(mistCanvas);
      this.resources.textures.push(this.mistTexture);
    }
    const mistMaterial = new THREE.SpriteMaterial({
      map: this.mistTexture,
      color: 0xe9dcc1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const mist = new THREE.Sprite(mistMaterial);
    mist.renderOrder = 4;

    const group = new THREE.Group();
    group.add(points, mist);
    this.scene.add(group);
    this.sprayBurst = {
      group,
      geometry,
      material,
      mistMaterial,
      mist,
      origin: origin.clone(),
      direction: direction.clone(),
      velocities,
      baseSizes,
      lifetimes,
      started: performance.now(),
      duration: 0.98
    };
  }

  updateSprayBurst() {
    const burst = this.sprayBurst;
    if (!burst) return;

    const elapsed = (performance.now() - burst.started) / 1000;
    const progress = Math.min(elapsed / burst.duration, 1);
    const positions = burst.geometry.getAttribute('position');
    const sizes = burst.geometry.getAttribute('aSize');
    const opacities = burst.geometry.getAttribute('aOpacity');

    for (let index = 0; index < burst.velocities.length; index += 1) {
      const lifetime = burst.lifetimes[index];
      const age = Math.min(elapsed / lifetime, 1);
      const position = burst.origin.clone()
        .addScaledVector(burst.velocities[index], Math.min(elapsed, lifetime));
      positions.setXYZ(index, position.x, position.y, position.z);
      sizes.setX(index, burst.baseSizes[index] * (1 + age * 0.9));
      opacities.setX(index, 0.78 * (1 - age));
    }
    positions.needsUpdate = true;
    sizes.needsUpdate = true;
    opacities.needsUpdate = true;

    burst.mist.position.copy(burst.origin)
      .addScaledVector(burst.direction, 0.04 + progress * 0.5);
    burst.mist.scale.setScalar(0.12 + progress * 0.38);
    burst.mistMaterial.opacity = 0.3 * Math.sin(progress * Math.PI) * (1 - progress * 0.22);

    if (elapsed >= burst.duration) this.disposeSprayBurst();
  }

  disposeSprayBurst() {
    const burst = this.sprayBurst;
    if (!burst) return;
    this.scene.remove(burst.group);
    burst.geometry.dispose();
    burst.material.dispose();
    burst.mistMaterial.dispose();
    this.sprayBurst = null;
  }

  onKeyDown(event) {
    const step = event.shiftKey ? 0.28 : 0.12;
    if (event.key === 'ArrowLeft') this.targetRotation.y -= step;
    else if (event.key === 'ArrowRight') this.targetRotation.y += step;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (this.isQuietScene) return;
      this.targetRotation.x = THREE.MathUtils.clamp(
        this.targetRotation.x + (event.key === 'ArrowUp' ? -step : step),
        -0.7,
        0.58
      );
    }
    else return;
    event.preventDefault();
  }

  resize() {
    if (!this.renderer || this.disposed) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  pause() {
    if (this.disposed || this.paused) return;
    this.paused = true;
    cancelAnimationFrame(this.frame);
  }

  resume() {
    if (this.disposed || !this.paused) return;
    this.paused = false;
    if (!this.renderer) return;
    this.lastFrameTime = 0;
    this.frame = requestAnimationFrame(this.render);
  }

  render(time) {
    if (this.disposed || this.paused || !this.renderer) return;
    const elapsed = this.lastFrameTime
      ? Math.min((time - this.lastFrameTime) / 1000, 0.05)
      : 1 / 60;
    this.lastFrameTime = time;
    if (!this.dragging && elapsed > 0) {
      if (!this.isQuietScene) {
        this.targetRotation.x = THREE.MathUtils.clamp(
          this.targetRotation.x + this.angularVelocity.x * elapsed,
          -0.7,
          0.58
        );
        if (this.targetRotation.x === -0.7 || this.targetRotation.x === 0.58) {
          this.angularVelocity.x = 0;
        }
      }
      this.targetRotation.y += this.angularVelocity.y * elapsed;
      const friction = Math.exp(-5.2 * elapsed);
      this.angularVelocity.multiplyScalar(friction);
      if (this.angularVelocity.lengthSq() < 0.0001) this.angularVelocity.set(0, 0);
    }
    const damp = 1 - Math.exp(-(reducedMotion ? 18 : 13) * elapsed);
    this.model.rotation.x = THREE.MathUtils.lerp(
      this.model.rotation.x,
      this.targetRotation.x + this.hoverRotation.x,
      damp
    );
    const idle = this.isQuietScene || reducedMotion || this.dragging || this.angularVelocity.lengthSq() > 0.0001
      ? 0
      : Math.sin(time * 0.0007 + this.host.clientWidth) * 0.012;
    this.model.rotation.y = THREE.MathUtils.lerp(
      this.model.rotation.y,
      this.targetRotation.y + this.hoverRotation.y + idle,
      damp
    );
    this.model.position.y = -2.0 + (this.isQuietScene || reducedMotion ? 0 : Math.sin(time * 0.0008) * 0.025);
    if (this.isQuietScene) {
      const cameraDrift = reducedMotion ? 0 : Math.sin(time * 0.00032) * 0.035;
      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        this.cameraRestPosition.x + this.cameraPointerOffset.x + cameraDrift,
        3.5,
        elapsed
      );
      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        this.cameraRestPosition.y + this.cameraPointerOffset.y + (reducedMotion ? 0 : Math.cos(time * 0.00028) * 0.025),
        3.5,
        elapsed
      );
      this.camera.lookAt(0, 0, 0);

      const lightDrift = reducedMotion ? 0 : Math.sin(time * 0.0004) * 0.18;
      this.keyLight.position.x = THREE.MathUtils.damp(
        this.keyLight.position.x,
        this.keyLightRestPosition.x + this.lightPointerOffset.x + lightDrift,
        2.8,
        elapsed
      );
      this.keyLight.position.y = THREE.MathUtils.damp(
        this.keyLight.position.y,
        this.keyLightRestPosition.y + this.lightPointerOffset.y + (reducedMotion ? 0 : Math.cos(time * 0.00036) * 0.12),
        2.8,
        elapsed
      );
      if (this.particles && !reducedMotion) {
        this.particles.position.y = Math.sin(time * 0.0004) * 0.018;
      }
    }
    this.capProgress = THREE.MathUtils.damp(this.capProgress, this.capTarget, reducedMotion ? 24 : 9, elapsed);
    this.capPivot.position.y = 3.05 + this.capProgress * 0.52;
    this.capPivot.rotation.x = -this.capProgress * 0.035;
    const capAtTarget = this.capTarget > 0.5
      ? this.capProgress >= 0.995
      : this.capProgress <= 0.005;
    if (!this.capSettled && capAtTarget) {
      this.capSettled = true;
      this.host.dataset.capSettled = 'true';
      this.host.dispatchEvent(new Event(this.capTarget > 0.5 ? 'capopened' : 'capclosed'));
    }
    const capProgressStep = Math.round(this.capProgress * 20);
    if (capProgressStep !== this.capProgressStep) {
      this.capProgressStep = capProgressStep;
      this.host.dataset.capProgress = (capProgressStep / 20).toFixed(2);
    }
    this.updateSprayBurst();
    this.renderer.render(this.scene, this.camera);
    if (!this.paused) this.frame = requestAnimationFrame(this.render);
  }

  async capturePoster() {
    if (!this.renderer || this.disposed || !this.host.classList.contains('bottle-3d-ready')) return;

    try {
      this.renderer.render(this.scene, this.camera);
      const source = this.renderer.domElement.toDataURL('image/webp', 0.84);
      const poster = new Image();
      poster.src = source;
      await poster.decode();
      if (!this.disposed) this.fallback.src = source;
    } catch (error) {
      console.error(`ÉCLAT ${this.key} 3D bottle poster could not be preserved during scrolling.`, error);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    if (this.renderer?.domElement) {
      const canvas = this.renderer.domElement;
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      canvas.removeEventListener('pointermove', this.onPointerMove);
      canvas.removeEventListener('pointerup', this.onPointerUp);
      canvas.removeEventListener('pointercancel', this.onPointerCancel);
      canvas.removeEventListener('pointerleave', this.onPointerLeave);
      canvas.removeEventListener('click', this.onClick);
      canvas.removeEventListener('keydown', this.onKeyDown);
    }
    this.host.removeEventListener('capchange', this.onCapChange);
    this.host.removeEventListener('sprayrequest', this.onSprayRequest);
    this.disposeSprayBurst();

    this.resources.geometries.forEach((geometry) => geometry.dispose());
    this.resources.materials.forEach((material) => material.dispose());
    this.resources.textures.forEach((texture) => texture.dispose());
    if (this.resources.shadow) {
      this.resources.shadow.geometry.dispose();
      this.resources.shadow.material.dispose();
      this.resources.shadow.contactGeometry?.dispose();
      this.resources.shadow.contactMaterial?.dispose();
      this.resources.shadow.texture.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
    }
    this.host.classList.remove('bottle-3d-ready');
    this.host.removeAttribute('data-3d-loaded');
    this.host.removeAttribute('data-cap-progress');
    this.host.removeAttribute('data-cap-settled');
    this.fallback.classList.remove('bottle-3d-fallback');
  }
}

function initBottleViewers() {
  if (!('IntersectionObserver' in window) || !('ResizeObserver' in window)) return;

  const hosts = document.querySelectorAll(
    '.bottle[data-fragrance], .philosophy-bottle[data-fragrance], .card-visual, .stage-visual, .shop-card-visual'
  );
  const viewers = new Map();
  const startViewer = (viewer) => {
    if (viewer.instance) return;
    viewer.instance = new BottleViewer(viewer.host, viewer.fallback, viewer.key);
    viewer.instance.paused = !viewer.visible;
    viewer.instance.start();
  };
  const proximityObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const viewer = viewers.get(entry.target);
      if (viewer) startViewer(viewer);
    });
  }, { rootMargin: '320px 0px', threshold: 0.01 });
  const visibilityObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const viewer = viewers.get(entry.target);
      if (!viewer) return;
      viewer.visible = entry.isIntersecting;
      if (viewer.visible) {
        startViewer(viewer);
        viewer.instance?.resume();
      } else {
        viewer.instance?.pause();
      }
    });
  }, { threshold: 0.05 });

  hosts.forEach((host) => {
    const key = getFragranceKey(host);
    const fallback = host.querySelector('img');
    if (!fragrances[key] || !fallback) {
      console.error('ÉCLAT 3D bottle is missing its fragrance model or fallback image.', host);
      return;
    }

    const viewer = { host, fallback, key, visible: false, instance: null };
    viewers.set(host, viewer);
    host.addEventListener('bottlechange', () => {
      const nextKey = getFragranceKey(host);
      if (viewer.key === nextKey || !fragrances[nextKey]) return;

      viewer.instance?.dispose();
      viewer.instance = null;
      viewer.key = nextKey;
      if (viewer.visible) startViewer(viewer);
    });
    proximityObserver.observe(host);
    visibilityObserver.observe(host);
  });
}

initBottleViewers();
