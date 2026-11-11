/**
 * 3D robot assistant scene, ported from robot3d_widget.js to an ES module.
 *
 * Model: glossy white chat-bubble frame with tail, glossy coloured disc, ceramic white
 * head, black visor, glowing LED eyes, silver ear cups with neon rings, chin mic.
 *
 * Changes from the original widget:
 *  - imports three from the app bundle (no CDN script injection);
 *  - no global listeners: the pointer comes in through setLook();
 *  - render loop stops and every GPU resource is disposed in dispose(); pauses in hidden tabs;
 *  - no sound (the original chirped on every blink);
 *  - crisper look: supersampled rendering, studio environment reflections, LED glow halos;
 *  - live colours (setColors) and assistant moods drive the emotions.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { AvatarMood } from './AssistantAvatar';

export interface RobotColors {
  /** LED eyes and ear rings, e.g. "#00f5ff" */
  eye: string;
  /** Disc behind the head, e.g. "#0070f3" */
  ring: string;
}

const glowTexture = (() => {
  let tex: THREE.CanvasTexture | null = null;
  return () => {
    if (tex) return tex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    tex = new THREE.CanvasTexture(c);
    return tex;
  };
})();

export class RobotScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private frame = 0;
  private disposed = false;
  private envTexture: THREE.Texture | null = null;

  private mainGroup = new THREE.Group();
  private backdropGroup = new THREE.Group();
  private headGroup = new THREE.Group();
  private leftEye!: THREE.Mesh;
  private rightEye!: THREE.Mesh;
  private eyeMat!: THREE.MeshBasicMaterial;
  private neonMat!: THREE.MeshBasicMaterial;
  private glowMat!: THREE.SpriteMaterial;
  private discMat!: THREE.MeshPhysicalMaterial;
  private eyeLights: THREE.PointLight[] = [];

  private mood: AvatarMood = 'idle';
  private moodStart = 0;
  private mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  private nextBlink = 3.5;
  private blinkStart = -1;

  constructor(canvas: HTMLCanvasElement, size: number, colors: RobotColors) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    // Small avatars are rendered at a higher resolution and scaled down: much sharper edges.
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(size <= 128 ? Math.min(4, Math.max(2, dpr * 2)) : Math.min(dpr, 2));
    this.renderer.setSize(size, size, false);
    // Neutral tone mapping keeps colours saturated (ACES washed the disc out to pastel).
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Studio reflections make the glossy shell and visor look like the reference render.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    // The bubble spans about y -2.95 (tail) to +2.63 and x +-2.67; frame it with a margin so
    // nothing is clipped when the head and bubble tilt towards the pointer.
    this.camera.position.set(0, -0.16, 8.4);

    this.addLights(colors.eye);
    this.buildRobot(colors);
    this.loop();
  }

  /** Pointer direction in -1..1, x to the right, y downward (screen convention). */
  setLook(x: number, y: number) {
    this.mouse.targetX = Math.max(-1, Math.min(1, x));
    this.mouse.targetY = Math.max(-1, Math.min(1, -y));
  }

  setMood(mood: AvatarMood) {
    if (mood === this.mood) return;
    this.mood = mood;
    this.moodStart = this.clock.getElapsedTime();
  }

  setColors(colors: RobotColors) {
    const eye = new THREE.Color(colors.eye);
    this.eyeMat.color.copy(eye);
    this.neonMat.color.copy(eye);
    this.glowMat.color.copy(eye);
    for (const l of this.eyeLights) l.color.copy(eye);
    this.discMat.emissiveMap?.dispose();
    this.discMat.emissiveMap = discTexture(colors.ring, colors.eye);
    this.discMat.needsUpdate = true;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of mats) {
        const pm = m as THREE.MeshPhysicalMaterial;
        for (const tex of [pm.map, pm.emissiveMap]) if (tex && tex !== glowTexture()) tex.dispose();
        m.dispose();
      }
    });
    this.envTexture?.dispose();
    this.renderer.dispose();
  }

  // ------------------------------------------------------------------ build

  private addLights(eyeColor: string) {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 4, 6);
    const fill = new THREE.DirectionalLight(0x38bdf8, 0.6);
    fill.position.set(-4, -2, 4);
    const rim = new THREE.DirectionalLight(0x00f5ff, 1.0);
    rim.position.set(0, 3, -5);
    this.scene.add(key, fill, rim);
    for (const x of [-0.4, 0.4]) {
      const l = new THREE.PointLight(eyeColor, 1.6, 2.8);
      l.position.set(x, 0.1, 1.4);
      this.eyeLights.push(l);
      this.scene.add(l);
    }
  }

  private buildRobot(colors: RobotColors) {
    this.scene.add(this.mainGroup);
    this.mainGroup.add(this.backdropGroup);
    this.headGroup.position.set(0, 0, 0.3);
    this.mainGroup.add(this.headGroup);

    // 1. Glossy white chat-bubble frame
    const frameMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1 });
    this.backdropGroup.add(new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.28, 48, 128), frameMat));

    const tailShape = new THREE.Shape();
    tailShape.moveTo(-1.6, -1.65);
    tailShape.quadraticCurveTo(-2.1, -2.1, -2.55, -2.65);
    tailShape.quadraticCurveTo(-2.0, -2.4, -1.2, -2.0);
    tailShape.closePath();
    const tail = new THREE.Mesh(
      new THREE.ExtrudeGeometry(tailShape, { steps: 1, depth: 0.35, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.12, bevelSegments: 10 }),
      frameMat,
    );
    tail.position.set(0, 0, -0.2);
    this.backdropGroup.add(tail);

    // 2. Glossy coloured disc
    // Low reflection on the coloured disc so its colour stays rich; the clear coat still adds a highlight.
    // The disc emits its own colour (exactly the chosen one); lights only add the clear-coat highlight.
    const discMap = discTexture(colors.ring, colors.eye);
    this.discMat = new THREE.MeshPhysicalMaterial({
      color: 0x111111, emissive: 0xffffff, emissiveMap: discMap, emissiveIntensity: 1,
      roughness: 0.35, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.25,
    });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.32, 2.32, 0.14, 96), this.discMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = -0.15;
    this.backdropGroup.add(disc);

    // 3. Ceramic white head
    const headMat = new THREE.MeshPhysicalMaterial({ color: 0xf6f9fc, roughness: 0.12, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.22, 96, 64), headMat);
    head.scale.set(1.05, 0.98, 1.0);
    this.headGroup.add(head);

    // 4. Glossy black visor
    const vw = 1.45;
    const vh = 0.78;
    const vr = 0.36;
    const visorShape = new THREE.Shape();
    visorShape.moveTo(-vw / 2 + vr, -vh / 2);
    visorShape.lineTo(vw / 2 - vr, -vh / 2);
    visorShape.quadraticCurveTo(vw / 2, -vh / 2, vw / 2, -vh / 2 + vr);
    visorShape.lineTo(vw / 2, vh / 2 - vr);
    visorShape.quadraticCurveTo(vw / 2, vh / 2, vw / 2 - vr, vh / 2);
    visorShape.lineTo(-vw / 2 + vr, vh / 2);
    visorShape.quadraticCurveTo(-vw / 2, vh / 2, -vw / 2, vh / 2 - vr);
    visorShape.lineTo(-vw / 2, -vh / 2 + vr);
    visorShape.quadraticCurveTo(-vw / 2, -vh / 2, -vw / 2 + vr, -vh / 2);
    const visor = new THREE.Mesh(
      new THREE.ExtrudeGeometry(visorShape, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.12, bevelSegments: 10 }),
      new THREE.MeshPhysicalMaterial({ color: 0x070c18, roughness: 0.05, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4 }),
    );
    visor.position.set(0, 0.05, 0.86);
    this.headGroup.add(visor);

    // 5. Glowing LED eyes with a soft halo
    this.eyeMat = new THREE.MeshBasicMaterial({ color: colors.eye, transparent: true, toneMapped: false });
    this.glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: colors.eye, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.9, toneMapped: false });
    const eyeGeo = new THREE.CircleGeometry(0.25, 48);
    const makeEye = (x: number) => {
      const eye = new THREE.Mesh(eyeGeo, this.eyeMat);
      eye.position.set(x, 0.08, 1.38);
      const halo = new THREE.Sprite(this.glowMat);
      halo.scale.set(0.95, 0.95, 1);
      halo.position.z = -0.01;
      eye.add(halo);
      return eye;
    };
    this.leftEye = makeEye(-0.4);
    this.rightEye = makeEye(0.4);
    this.headGroup.add(this.leftEye, this.rightEye);

    // 6. Silver ear cups with neon rings
    const silver = new THREE.MeshStandardMaterial({ color: 0xdde3ea, metalness: 0.95, roughness: 0.15, envMapIntensity: 1.3 });
    this.neonMat = new THREE.MeshBasicMaterial({ color: colors.eye, toneMapped: false });
    const left = new THREE.Group();
    left.position.set(-1.38, 0.05, 0.05);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.48, 0.32, 48), silver);
    cup.rotation.z = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.045, 16, 48), this.neonMat);
    ring.rotation.y = Math.PI / 2;
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.15, 48), headMat);
    cushion.rotation.z = Math.PI / 2;
    cushion.position.x = 0.15;
    left.add(cup, ring, cushion);
    const right = left.clone();
    right.position.set(1.38, 0.05, 0.05);
    right.rotation.z = Math.PI;
    this.headGroup.add(left, right);

    // 7. Chin microphone
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 24), new THREE.MeshBasicMaterial({ color: 0x111624 }));
    mic.rotation.x = Math.PI / 2;
    mic.position.set(0, -0.66, 1.25);
    this.headGroup.add(mic);
  }

  // ------------------------------------------------------------------ animate

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    if (document.hidden) return;

    const t = this.clock.getElapsedTime();
    const since = t - this.moodStart;
    const mood = this.mood;
    const m = this.mouse;

    let tx = m.targetX;
    let ty = m.targetY;
    if (mood === 'thinking') {
      tx = 0.45;
      ty = 0.55;
    }
    m.x += (tx - m.x) * 0.08;
    m.y += (ty - m.y) * 0.08;

    // Calm by design: the robot stays in place, only the head and eyes follow the gaze.
    // Moods show through the eye shapes below (no bouncing, wiggling, nodding or dancing).
    const h = this.headGroup;
    const rotX = -m.y * 0.42;
    const rotZ = -m.x * 0.08 + (mood === 'thinking' ? 0.06 : 0);
    h.rotation.y += (m.x * 0.62 - h.rotation.y) * 0.09;
    h.rotation.x += (rotX - h.rotation.x) * 0.09;
    h.rotation.z += (rotZ - h.rotation.z) * 0.09;
    this.backdropGroup.rotation.y += (m.x * 0.14 - this.backdropGroup.rotation.y) * 0.05;
    this.backdropGroup.rotation.x += (-m.y * 0.1 - this.backdropGroup.rotation.x) * 0.05;

    const happy = mood === 'waving' || mood === 'celebrate';
    let lsx = 1;
    let lsy = 1;
    let rsx = 1;
    let rsy = 1;
    let lrz = 0;
    let rrz = 0;
    if (happy) {
      lsx = rsx = 1.15;
      lsy = rsy = 0.5;
      lrz = 0.15;
      rrz = -0.15;
    } else if (mood === 'wink' && since < 1.4) {
      lsx = 1.1;
      lsy = 0.08;
      rsx = rsy = 1.2;
    } else if (mood === 'surprised') {
      lsx = lsy = rsx = rsy = 1.4;
    }

    if (!happy && mood !== 'wink' && mood !== 'surprised') {
      if (t > this.nextBlink && this.blinkStart < 0) this.blinkStart = t;
      if (this.blinkStart >= 0) {
        const p = (t - this.blinkStart) / 0.2;
        if (p <= 1) {
          lsy = rsy = Math.max(0.06, 1 - Math.sin(p * Math.PI));
        } else {
          this.blinkStart = -1;
          this.nextBlink = t + 2.8 + Math.random() * 3.2;
        }
      }
    }

    const L = this.leftEye;
    const R = this.rightEye;
    L.scale.set(lsx, lsy, 1);
    R.scale.set(rsx, rsy, 1);
    L.rotation.z = lrz;
    R.rotation.z = rrz;
    const sx = m.x * 0.08;
    const sy = m.y * 0.06;
    L.position.set(-0.4 + sx, 0.08 + sy, 1.38);
    R.position.set(0.4 + sx, 0.08 + sy, 1.38);

    const pulse = mood === 'talking' ? 0.8 + Math.abs(Math.sin(t * 10)) * 0.2 : 1;
    this.eyeMat.opacity = pulse;
    this.glowMat.opacity = 0.65 + pulse * 0.3;

    this.renderer.render(this.scene, this.camera);
  };
}

/** Radial disc gradient generated from the chosen ring colour, with an LED-coloured inner ring. */
function discTexture(ringHex: string, eyeHex: string): THREE.CanvasTexture {
  const base = new THREE.Color(ringHex);
  const light = base.clone().offsetHSL(0, 0.05, 0.07);
  const dark = base.clone().offsetHSL(0, 0.05, -0.16);
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(256, 220, 30, 256, 256, 256);
  grad.addColorStop(0, `#${light.getHexString()}`);
  grad.addColorStop(0.65, `#${base.getHexString()}`);
  grad.addColorStop(1, `#${dark.getHexString()}`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  g.beginPath();
  g.arc(256, 256, 210, 0, Math.PI * 2);
  const eye = new THREE.Color(eyeHex);
  g.strokeStyle = `rgba(${Math.round(eye.r * 255)}, ${Math.round(eye.g * 255)}, ${Math.round(eye.b * 255)}, 0.45)`;
  g.lineWidth = 14;
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
