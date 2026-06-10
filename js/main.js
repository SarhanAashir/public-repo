/* ===================================================================
   ObliqCloud — Three.js scene + page interactions
   =================================================================== */

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* =====================================================
   1. THREE.JS SCENE
   A drifting particle nebula + a floating wireframe
   icosahedron ("the cloud core") that reacts to the
   mouse and to scroll position.

   Three.js is loaded dynamically so the rest of the
   page keeps working even if the CDN is unreachable.
   ===================================================== */

(async () => {
  let THREE;
  try {
    THREE = await import("three");
  } catch (err) {
    console.warn("Three.js failed to load — continuing without the 3D scene.", err);
    document.getElementById("webgl").remove();
    return;
  }
  initScene(THREE);
})();

function initScene(THREE) {
const canvas = document.getElementById("webgl");
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06070d, 0.035);

const sizes = { width: window.innerWidth, height: window.innerHeight };

const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 100);
camera.position.set(0, 0, 9);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/* ---- Particle nebula ---- */
const PARTICLE_COUNT = prefersReducedMotion ? 800 : 2600;
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const scales = new Float32Array(PARTICLE_COUNT);

const palette = [
  new THREE.Color(0x6c5ce7), // violet
  new THREE.Color(0x00d2ff), // cyan
  new THREE.Color(0xff5e9c), // pink
  new THREE.Color(0xffffff),
];

for (let i = 0; i < PARTICLE_COUNT; i++) {
  // Distribute particles in a flattened torus-ish cloud around the camera axis
  const radius = 3 + Math.random() * 14;
  const angle = Math.random() * Math.PI * 2;
  positions[i * 3] = Math.cos(angle) * radius + (Math.random() - 0.5) * 4;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
  positions[i * 3 + 2] = Math.sin(angle) * radius + (Math.random() - 0.5) * 4 - 4;

  const c = palette[Math.floor(Math.random() * palette.length)];
  colors[i * 3] = c.r;
  colors[i * 3 + 1] = c.g;
  colors[i * 3 + 2] = c.b;
  scales[i] = Math.random();
}

const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
particleGeometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));

const particleMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexColors: true,
  uniforms: {
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
  },
  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform float uPixelRatio;
    attribute float aScale;
    varying vec3 vColor;
    void main() {
      vec3 p = position;
      // Gentle vertical drift, each particle slightly out of phase
      p.y += sin(uTime * 0.3 + p.x * 0.6 + p.z * 0.4) * 0.5;
      p.x += cos(uTime * 0.2 + p.y * 0.5) * 0.3;
      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      gl_PointSize = (28.0 * aScale + 6.0) * uPixelRatio / -mvPosition.z;
      vColor = color;
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vColor;
    void main() {
      float d = distance(gl_PointCoord, vec2(0.5));
      float alpha = smoothstep(0.5, 0.0, d) * 0.85;
      gl_FragColor = vec4(vColor, alpha);
    }
  `,
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

/* ---- Wireframe core (icosahedron inside a larger dual) ---- */
const coreGroup = new THREE.Group();

const coreGeo = new THREE.IcosahedronGeometry(1.6, 1);
const coreMat = new THREE.MeshBasicMaterial({
  color: 0x6c5ce7,
  wireframe: true,
  transparent: true,
  opacity: 0.55,
});
const core = new THREE.Mesh(coreGeo, coreMat);
coreGroup.add(core);

const shellGeo = new THREE.IcosahedronGeometry(2.4, 1);
const shellMat = new THREE.MeshBasicMaterial({
  color: 0x00d2ff,
  wireframe: true,
  transparent: true,
  opacity: 0.18,
});
const shell = new THREE.Mesh(shellGeo, shellMat);
coreGroup.add(shell);

// Glowing vertices on the inner core
const coreVerts = coreGeo.attributes.position;
const vertGeo = new THREE.BufferGeometry();
vertGeo.setAttribute("position", new THREE.BufferAttribute(coreVerts.array.slice(), 3));
const vertMat = new THREE.PointsMaterial({
  color: 0x00d2ff,
  size: 0.07,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
coreGroup.add(new THREE.Points(vertGeo, vertMat));

coreGroup.position.set(3.2, 0.2, 2.5);
scene.add(coreGroup);

/* ---- Orbiting torus rings ---- */
const ringMat = new THREE.MeshBasicMaterial({
  color: 0xff5e9c,
  wireframe: true,
  transparent: true,
  opacity: 0.12,
});
const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.012, 8, 120), ringMat);
ring1.rotation.x = Math.PI / 2.4;
coreGroup.add(ring1);
const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.012, 8, 120), ringMat.clone());
ring2.material.color.set(0x6c5ce7);
ring2.rotation.x = Math.PI / 1.7;
ring2.rotation.y = Math.PI / 5;
coreGroup.add(ring2);

// Remember base opacities so the core can fade out on scroll
const fadeMats = [coreMat, shellMat, vertMat, ringMat, ring2.material];
fadeMats.forEach((m) => (m.userData.baseOpacity = m.opacity));

/* ---- Mouse + scroll state ---- */
const mouse = { x: 0, y: 0 };
const smooth = { x: 0, y: 0 };
let scrollProgress = 0;

window.addEventListener("pointermove", (e) => {
  mouse.x = (e.clientX / sizes.width - 0.5) * 2;
  mouse.y = (e.clientY / sizes.height - 0.5) * 2;
});

window.addEventListener(
  "scroll",
  () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = max > 0 ? window.scrollY / max : 0;
  },
  { passive: true }
);

window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  particleMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
});

/* ---- Render loop ---- */
const clock = new THREE.Clock();

function tick() {
  const t = clock.getElapsedTime();

  particleMaterial.uniforms.uTime.value = t;
  particles.rotation.y = t * 0.02 + scrollProgress * Math.PI * 0.6;

  coreGroup.rotation.y = t * 0.18;
  coreGroup.rotation.x = Math.sin(t * 0.15) * 0.25;
  shell.rotation.y = -t * 0.1;
  shell.rotation.z = t * 0.07;
  ring1.rotation.z = t * 0.12;
  ring2.rotation.z = -t * 0.09;

  // Core drifts left, shrinks and fades into the background as the
  // user scrolls, so it never competes with the section content
  coreGroup.position.x = 3.2 - scrollProgress * 5.5;
  coreGroup.position.y = 0.2 + Math.sin(t * 0.4) * 0.18 - scrollProgress * 1.2;
  const s = 1 - scrollProgress * 0.35;
  coreGroup.scale.set(s, s, s);
  const fade = 1 - Math.min(scrollProgress * 2.4, 0.85);
  fadeMats.forEach((m) => (m.opacity = m.userData.baseOpacity * fade));

  // Mouse parallax with easing
  smooth.x += (mouse.x - smooth.x) * 0.04;
  smooth.y += (mouse.y - smooth.y) * 0.04;
  camera.position.x = smooth.x * 0.8;
  camera.position.y = -smooth.y * 0.5 - scrollProgress * 1.5;
  camera.lookAt(0, -scrollProgress * 1.5, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
}

/* =====================================================
   2. PRELOADER
   ===================================================== */
const preloader = document.getElementById("preloader");
const preloaderBar = document.getElementById("preloaderBar");
let fakeProgress = 0;
const progressTimer = setInterval(() => {
  fakeProgress = Math.min(fakeProgress + Math.random() * 22, 90);
  preloaderBar.style.width = fakeProgress + "%";
}, 120);

function dismissPreloader() {
  clearInterval(progressTimer);
  preloaderBar.style.width = "100%";
  preloader.classList.add("done");
  setTimeout(() => preloader.remove(), 1000);
}
window.addEventListener("load", () => setTimeout(dismissPreloader, 350));
// Safety: never trap the user behind the preloader
setTimeout(dismissPreloader, 4000);

/* =====================================================
   3. CUSTOM CURSOR
   ===================================================== */
const cursor = document.getElementById("cursor");
const cursorDot = document.getElementById("cursorDot");
const cursorPos = { x: -100, y: -100 };
const cursorSmooth = { x: -100, y: -100 };

window.addEventListener("pointermove", (e) => {
  cursorPos.x = e.clientX;
  cursorPos.y = e.clientY;
  cursorDot.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
});

(function cursorLoop() {
  cursorSmooth.x += (cursorPos.x - cursorSmooth.x) * 0.16;
  cursorSmooth.y += (cursorPos.y - cursorSmooth.y) * 0.16;
  cursor.style.transform = `translate(${cursorSmooth.x}px, ${cursorSmooth.y}px) translate(-50%, -50%)`;
  requestAnimationFrame(cursorLoop);
})();

document.querySelectorAll("[data-cursor='hover'], a, button, input, textarea").forEach((el) => {
  el.addEventListener("pointerenter", () => cursor.classList.add("hovered"));
  el.addEventListener("pointerleave", () => cursor.classList.remove("hovered"));
});

/* =====================================================
   4. NAVIGATION
   ===================================================== */
const nav = document.getElementById("nav");
const burger = document.getElementById("burger");
const mobileMenu = document.getElementById("mobileMenu");

window.addEventListener(
  "scroll",
  () => nav.classList.toggle("scrolled", window.scrollY > 40),
  { passive: true }
);

burger.addEventListener("click", () => {
  burger.classList.toggle("open");
  mobileMenu.classList.toggle("open");
});
mobileMenu.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    burger.classList.remove("open");
    mobileMenu.classList.remove("open");
  })
);

/* =====================================================
   5. SCROLL REVEALS
   ===================================================== */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

/* ---- Word-by-word statement reveal ---- */
document.querySelectorAll(".split-reveal").forEach((el) => {
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (/^\s+$/.test(part) || part === "") {
            frag.appendChild(document.createTextNode(part));
          } else {
            const span = document.createElement("span");
            span.className = "word";
            span.textContent = part;
            frag.appendChild(span);
          }
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  };
  walk(el);
});

function litWords() {
  document.querySelectorAll(".split-reveal").forEach((el) => {
    const rect = el.getBoundingClientRect();
    const start = window.innerHeight * 0.85;
    const end = window.innerHeight * 0.35;
    const progress = Math.min(Math.max((start - rect.top) / (start - end), 0), 1);
    const words = el.querySelectorAll(".word");
    const litCount = Math.floor(progress * words.length);
    words.forEach((w, i) => w.classList.toggle("lit", i < litCount));
  });
}
window.addEventListener("scroll", litWords, { passive: true });
litWords();

/* =====================================================
   6. ANIMATED COUNTERS
   ===================================================== */
const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target, 10);
      const duration = 1600;
      const startTime = performance.now();
      function update(now) {
        const p = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(eased * target);
        if (p < 1) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
      counterObserver.unobserve(el);
    });
  },
  { threshold: 0.5 }
);
document.querySelectorAll(".counter").forEach((el) => counterObserver.observe(el));
