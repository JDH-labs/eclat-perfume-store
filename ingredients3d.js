import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/HDRLoader.js';

const loader = new GLTFLoader();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const environmentRequest = new HDRLoader()
  .loadAsync(new URL('./assets/models/studio_small_03_1k.hdr', import.meta.url).href)
  .then((texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
  })
  .catch((error) => {
    console.error('ÉCLAT ingredient studio lighting could not be loaded.', error);
    return null;
  });

function disposeAsset(gltf) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value && value.isTexture) textures.add(value);
      });
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

class IngredientViewer {
  constructor(host, fallback, key) {
    this.host = host;
    this.fallback = fallback;
    this.key = key;
    this.targetRotation = new THREE.Vector2(0.06, 0.22);
    this.hoverRotation = new THREE.Vector2();
    this.angularVelocity = new THREE.Vector2();
    this.dragStart = new THREE.Vector2();
    this.lastPoint = new THREE.Vector2();
    this.dragging = false;
    this.dragged = false;
    this.pointerId = null;
    this.lastMoveTime = 0;
    this.lastFrameTime = 0;
    this.loadId = 0;
    this.disposed = false;
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.render = this.render.bind(this);
  }

  async start() {
    try {
      const [environment] = await Promise.all([environmentRequest]);
      if (this.disposed) return;

      const width = Math.max(1, this.host.clientWidth);
      const height = Math.max(1, this.host.clientHeight);
      this.scene = new THREE.Scene();
      this.scene.environment = environment;
      this.scene.environmentIntensity = 1.15;
      this.camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
      this.camera.position.set(0, 0, 6.4);
      this.camera.lookAt(0, 0, 0);

      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !window.matchMedia('(max-width: 700px)').matches,
        powerPreference: 'low-power'
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
      this.renderer.setSize(width, height);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.12;
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.domElement.className = 'ingredient-3d-canvas';
      this.renderer.domElement.setAttribute('role', 'img');
      this.renderer.domElement.setAttribute('aria-label', 'Интерактивная 3D-модель ингредиентов выбранного аромата; перемещайте указатель для вращения');
      this.renderer.domElement.tabIndex = 0;
      this.host.appendChild(this.renderer.domElement);

      this.scene.add(new THREE.AmbientLight(0xffe6c6, 1.35));
      this.scene.add(new THREE.HemisphereLight(0xfff0d7, 0x17100c, 1.1));
      this.keyLight = new THREE.PointLight(0xffe4bd, 34, 15);
      this.keyLight.position.set(-2.8, 3.4, 4.4);
      this.scene.add(this.keyLight);
      const rimLight = new THREE.PointLight(0xb4c9d8, 18, 12);
      rimLight.position.set(3.0, 0.8, -2.0);
      this.scene.add(rimLight);
      const fillLight = new THREE.PointLight(0xd89655, 9, 10);
      fillLight.position.set(0, -2.5, 3.2);
      this.scene.add(fillLight);

      const shadowCanvas = document.createElement('canvas');
      shadowCanvas.width = 128;
      shadowCanvas.height = 128;
      const context = shadowCanvas.getContext('2d');
      const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 62);
      gradient.addColorStop(0, 'rgba(0,0,0,0.34)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
      this.shadowTexture = new THREE.CanvasTexture(shadowCanvas);
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(3.5, 2.4),
        new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -1.42;
      this.scene.add(shadow);
      this.shadow = shadow;

      this.bindInteraction(this.renderer.domElement);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.host);
      await this.setFragrance(this.key);
      if (!this.disposed) this.frame = requestAnimationFrame(this.render);
    } catch (error) {
      this.dispose();
      console.error(`ÉCLAT ${this.key} ingredient 3D could not be displayed; retaining its image fallback.`, error);
    }
  }

  async setFragrance(key) {
    if (this.disposed || key === this.key && this.asset) return;
    this.key = key;
    if (!this.renderer) return;
    const loadId = ++this.loadId;
    try {
      const gltf = await loader.loadAsync(
        new URL(`./assets/models/${key}-ingredients.glb`, import.meta.url).href
      );
      if (this.disposed || loadId !== this.loadId) {
        disposeAsset(gltf);
        return;
      }

      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const largestDimension = Math.max(size.x, size.y, size.z) || 1;
      const scale = 3.15 / largestDimension;
      gltf.scene.position.sub(center);
      gltf.scene.scale.setScalar(scale);
      gltf.scene.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          if (object.material) object.material.envMapIntensity = 1.05;
        }
      });

      const previousAsset = this.asset;
      if (this.model) this.scene.remove(this.model);
      this.asset = gltf;
      this.model = new THREE.Group();
      this.model.add(gltf.scene);
      this.scene.add(this.model);
      this.host.dataset.loadedFragrance = key;
      this.targetRotation.set(0.06, 0.22);
      this.angularVelocity.set(0, 0);
      this.host.classList.add('ingredient-3d-ready');
      if (previousAsset) disposeAsset(previousAsset);
    } catch (error) {
      if (loadId === this.loadId && !this.disposed) {
        console.error(`ÉCLAT ${key} ingredient 3D model could not be loaded; retaining its image fallback.`, error);
        if (this.model) this.scene.remove(this.model);
        if (this.asset) disposeAsset(this.asset);
        this.model = null;
        this.asset = null;
        this.host.removeAttribute('data-loaded-fragrance');
        this.host.classList.remove('ingredient-3d-ready');
      }
    }
  }

  bindInteraction(canvas) {
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('keydown', this.onKeyDown);
    canvas.addEventListener('click', this.onClick);
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
    event.currentTarget.classList.add('is-dragging');
    event.stopPropagation();
  }

  onPointerMove(event) {
    const rect = this.host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    this.keyLight.position.set(-2.8 + x * 1.8, 3.4 - y * 1.3, 4.4);
    if (!this.dragging) {
      if (event.pointerType === 'mouse') this.hoverRotation.set(-y * 0.06, x * 0.08);
      return;
    }
    if (event.pointerId !== this.pointerId) return;

    const deltaX = event.clientX - this.lastPoint.x;
    const deltaY = event.clientY - this.lastPoint.y;
    const totalX = event.clientX - this.dragStart.x;
    const totalY = event.clientY - this.dragStart.y;
    if (Math.hypot(totalX, totalY) > 5) this.dragged = true;
    const elapsed = Math.max((event.timeStamp - this.lastMoveTime) / 1000, 1 / 120);
    const rotationX = deltaY * 0.008;
    const rotationY = deltaX * 0.01;
    this.targetRotation.y += rotationY;
    this.targetRotation.x = THREE.MathUtils.clamp(this.targetRotation.x + rotationX, -0.75, 0.65);
    this.angularVelocity.x = THREE.MathUtils.lerp(
      this.angularVelocity.x,
      THREE.MathUtils.clamp(rotationX / elapsed, -5, 5),
      0.45
    );
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
    if (!this.dragging) this.hoverRotation.set(0, 0);
  }

  onKeyDown(event) {
    const step = event.shiftKey ? 0.28 : 0.12;
    if (event.key === 'ArrowLeft') this.targetRotation.y -= step;
    else if (event.key === 'ArrowRight') this.targetRotation.y += step;
    else if (event.key === 'ArrowUp') this.targetRotation.x = THREE.MathUtils.clamp(this.targetRotation.x - step, -0.75, 0.65);
    else if (event.key === 'ArrowDown') this.targetRotation.x = THREE.MathUtils.clamp(this.targetRotation.x + step, -0.75, 0.65);
    else return;
    event.preventDefault();
  }

  onClick(event) {
    if (!this.dragged) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragged = false;
  }

  resize() {
    if (!this.renderer || this.disposed) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render(time) {
    if (this.disposed || !this.renderer) return;
    const elapsed = this.lastFrameTime
      ? Math.min((time - this.lastFrameTime) / 1000, 0.05)
      : 1 / 60;
    this.lastFrameTime = time;
    if (this.model && !this.dragging && elapsed > 0) {
      this.targetRotation.x = THREE.MathUtils.clamp(
        this.targetRotation.x + this.angularVelocity.x * elapsed,
        -0.75,
        0.65
      );
      if (this.targetRotation.x === -0.75 || this.targetRotation.x === 0.65) {
        this.angularVelocity.x = 0;
      }
      this.targetRotation.y += this.angularVelocity.y * elapsed;
      this.angularVelocity.multiplyScalar(Math.exp(-5.2 * elapsed));
      if (this.angularVelocity.lengthSq() < 0.0001) this.angularVelocity.set(0, 0);
      const damp = 1 - Math.exp(-(reducedMotion ? 18 : 13) * elapsed);
      const idle = reducedMotion || this.angularVelocity.lengthSq() > 0.0001
        ? 0
        : Math.sin(time * 0.00065) * 0.012;
      this.model.rotation.x = THREE.MathUtils.lerp(
        this.model.rotation.x,
        this.targetRotation.x + this.hoverRotation.x,
        damp
      );
      this.model.rotation.y = THREE.MathUtils.lerp(
        this.model.rotation.y,
        this.targetRotation.y + this.hoverRotation.y + idle,
        damp
      );
    }
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.render);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.loadId += 1;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    if (this.renderer?.domElement) {
      const canvas = this.renderer.domElement;
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      canvas.removeEventListener('pointermove', this.onPointerMove);
      canvas.removeEventListener('pointerup', this.onPointerUp);
      canvas.removeEventListener('pointercancel', this.onPointerCancel);
      canvas.removeEventListener('pointerleave', this.onPointerLeave);
      canvas.removeEventListener('keydown', this.onKeyDown);
      canvas.removeEventListener('click', this.onClick);
    }
    if (this.model) this.scene.remove(this.model);
    if (this.asset) disposeAsset(this.asset);
    if (this.shadow) {
      this.shadow.geometry.dispose();
      this.shadow.material.dispose();
    }
    this.shadowTexture?.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
    }
    this.host.classList.remove('ingredient-3d-ready');
    this.host.removeAttribute('data-loaded-fragrance');
  }
}

function initIngredientViewers() {
  const hosts = document.querySelectorAll('.ingredient-stage[data-fragrance]');
  if (!hosts.length || !('IntersectionObserver' in window) || !('ResizeObserver' in window)) return;

  hosts.forEach((host) => {
    const state = { key: host.dataset.fragrance, instance: null, visible: false, stopTimer: 0 };
    host.addEventListener('ingredientchange', () => {
      state.key = host.dataset.fragrance;
      state.instance?.setFragrance(state.key);
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          clearTimeout(state.stopTimer);
          state.visible = true;
          if (!state.instance) {
            state.instance = new IngredientViewer(host, host.querySelector('.ingredient-fallback'), state.key);
            state.instance.start();
          }
        } else {
          state.visible = false;
          state.stopTimer = setTimeout(() => {
            if (state.visible || !state.instance) return;
            state.instance.dispose();
            state.instance = null;
          }, 1200);
        }
      });
    }, { rootMargin: '120px 0px', threshold: 0.05 });
    observer.observe(host);
  });
}

initIngredientViewers();
