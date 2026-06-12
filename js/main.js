/* ===================================================================
   Ormee Energy — Three.js golden-hour solar farm + page interactions
   =================================================================== */

import * as THREE from "./vendor/three.module.min.js";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ===================================================================
   1. THREE.JS HERO — sun rising over a solar panel field
   =================================================================== */

const canvas = document.getElementById("scene");

function initScene() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b1020, 30, 110);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 3.2, 14);

  /* ---------- Sky dome: night navy fading to a warm horizon ---------- */
  const skyGeo = new THREE.SphereGeometry(150, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x070b14) },
      midColor: { value: new THREE.Color(0x16233f) },
      horizonColor: { value: new THREE.Color(0x7a4a1c) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 col = mix(midColor, topColor, smoothstep(0.05, 0.6, h));
        col = mix(horizonColor, col, smoothstep(-0.02, 0.18, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  /* ---------- Sun: emissive disc + layered glow sprites ---------- */
  const sunGroup = new THREE.Group();
  sunGroup.position.set(-6, 7, -60);
  scene.add(sunGroup);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(4.6, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0xffd98a })
  );
  sunGroup.add(sun);

  function glowTexture(inner, outer) {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const glowNear = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture("rgba(255, 214, 130, 0.9)", "rgba(255, 160, 50, 0)"),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  glowNear.scale.setScalar(26);
  sunGroup.add(glowNear);

  const glowFar = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture("rgba(246, 183, 60, 0.35)", "rgba(232, 132, 43, 0)"),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  glowFar.scale.setScalar(70);
  sunGroup.add(glowFar);

  /* ---------- Lighting ---------- */
  scene.add(new THREE.HemisphereLight(0x35508a, 0x0a0d16, 0.7));
  const sunLight = new THREE.DirectionalLight(0xffb35c, 2.4);
  sunLight.position.copy(sunGroup.position);
  scene.add(sunLight);

  /* ---------- Ground plane ---------- */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x0b101d, roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  /* ---------- Solar panel field (instanced) ---------- */
  const ROWS = 9;
  const COLS = 14;
  const COUNT = ROWS * COLS;
  const SPACING_X = 4.2;
  const SPACING_Z = 5.4;
  const TILT = -0.42; // facing the sun, low on the horizon

  // Panel face: dark blue cells with a faint golden specular response
  const panelGeo = new THREE.BoxGeometry(3.2, 0.08, 2.0);
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x101c33,
    roughness: 0.25,
    metalness: 0.85,
    emissive: 0x14253f,
    emissiveIntensity: 0.55,
  });
  const panels = new THREE.InstancedMesh(panelGeo, panelMat, COUNT);

  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.7, metalness: 0.6 });
  const legs = new THREE.InstancedMesh(legGeo, legMat, COUNT);

  const dummy = new THREE.Object3D();
  const basePositions = [];
  let i = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let cI = 0; cI < COLS; cI++) {
      const x = (cI - (COLS - 1) / 2) * SPACING_X + (Math.random() - 0.5) * 0.3;
      const z = -6 - r * SPACING_Z + (Math.random() - 0.5) * 0.4;
      basePositions.push({ x, z, phase: Math.random() * Math.PI * 2 });

      dummy.position.set(x, 1.15, z);
      dummy.rotation.set(TILT, 0, 0);
      dummy.updateMatrix();
      panels.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, 0.5, z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      legs.setMatrixAt(i, dummy.matrix);
      i++;
    }
  }
  panels.instanceMatrix.needsUpdate = true;
  legs.instanceMatrix.needsUpdate = true;
  scene.add(panels, legs);

  /* ---------- Floating light motes ---------- */
  const MOTES = 220;
  const motePositions = new Float32Array(MOTES * 3);
  for (let m = 0; m < MOTES; m++) {
    motePositions[m * 3] = (Math.random() - 0.5) * 70;
    motePositions[m * 3 + 1] = Math.random() * 16 + 0.5;
    motePositions[m * 3 + 2] = -Math.random() * 70 + 8;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    color: 0xf6b73c,
    size: 0.14,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  }));
  scene.add(motes);

  /* ---------- Stars ---------- */
  const STARS = 400;
  const starPositions = new Float32Array(STARS * 3);
  for (let s = 0; s < STARS; s++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(1 - Math.random() * 0.85); // bias toward upper sky
    const radius = 130;
    starPositions[s * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[s * 3 + 1] = Math.abs(radius * Math.cos(phi)) + 8;
    starPositions[s * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xcdd8f0,
    size: 0.5,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  }));
  scene.add(stars);

  /* ---------- Pointer parallax ---------- */
  const pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  /* ---------- Animation loop ---------- */
  const lookTarget = new THREE.Vector3(0, 4, -40);
  const clock = new THREE.Clock();
  let heroVisible = true;

  new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; }).observe(canvas);

  function renderFrame() {
    const t = clock.getElapsedTime();

    // Sun breathes gently; glow flickers like heat haze
    const pulse = 1 + Math.sin(t * 0.6) * 0.03;
    glowNear.scale.setScalar(26 * pulse);
    glowFar.scale.setScalar(70 * (1 + Math.sin(t * 0.35 + 1.4) * 0.04));

    // Panels shimmer with a slow wave rolling across the field
    for (let p = 0; p < COUNT; p++) {
      const { x, z, phase } = basePositions[p];
      dummy.position.set(x, 1.15, z);
      dummy.rotation.set(TILT + Math.sin(t * 0.5 + phase) * 0.015, 0, 0);
      dummy.updateMatrix();
      panels.setMatrixAt(p, dummy.matrix);
    }
    panels.instanceMatrix.needsUpdate = true;

    // Motes drift upward and wrap
    const pos = moteGeo.attributes.position.array;
    for (let m = 0; m < MOTES; m++) {
      pos[m * 3 + 1] += 0.008 + Math.sin(t + m) * 0.0015;
      if (pos[m * 3 + 1] > 17) pos[m * 3 + 1] = 0.5;
    }
    moteGeo.attributes.position.needsUpdate = true;

    // Camera: slow drift + pointer parallax
    camera.position.x += ((pointer.x * 1.6) - camera.position.x) * 0.03;
    camera.position.y += ((3.2 - pointer.y * 0.9) - camera.position.y) * 0.03;
    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
  }

  if (prefersReducedMotion) {
    renderFrame();
  } else {
    renderer.setAnimationLoop(() => {
      if (heroVisible && !document.hidden) renderFrame();
    });
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (prefersReducedMotion) renderFrame();
  });
}

try {
  initScene();
} catch (err) {
  // WebGL unavailable — the CSS gradient backdrop still carries the hero.
  console.warn("3D scene disabled:", err);
  canvas.remove();
}

/* ===================================================================
   2. PAGE INTERACTIONS
   =================================================================== */

/* ---------- Sticky nav ---------- */
const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  nav.classList.toggle("is-scrolled", window.scrollY > 24);
}, { passive: true });

/* ---------- Mobile menu ---------- */
const navToggle = document.getElementById("navToggle");
navToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("menu-open");
  navToggle.setAttribute("aria-expanded", String(open));
});
document.getElementById("navLinks").addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    nav.classList.remove("menu-open");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

/* ---------- Scroll reveals ---------- */
const revealObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    }
  }
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

/* ---------- Animated counters ---------- */
function animateCount(el) {
  const target = parseFloat(el.dataset.count);
  const decimals = parseInt(el.dataset.decimals || "0", 10);
  const suffix = el.dataset.suffix || "";
  const duration = 1800;
  const start = performance.now();

  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = (target * eased).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  if (prefersReducedMotion) {
    el.textContent = target.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + suffix;
  } else {
    requestAnimationFrame(tick);
  }
}
const countObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      animateCount(entry.target);
      countObserver.unobserve(entry.target);
    }
  }
}, { threshold: 0.6 });
document.querySelectorAll("[data-count]").forEach((el) => countObserver.observe(el));

/* ---------- Marquee: duplicate content for a seamless loop ---------- */
const marqueeTrack = document.getElementById("marqueeTrack");
marqueeTrack.innerHTML += marqueeTrack.innerHTML;

/* ---------- Contact form ---------- */
const form = document.getElementById("contactForm");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  form.querySelectorAll("input, select, textarea, button").forEach((el) => (el.disabled = true));
  document.getElementById("formSuccess").hidden = false;
});

/* ---------- Footer year ---------- */
document.getElementById("year").textContent = new Date().getFullYear();
