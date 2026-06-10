/* ===================================================================
   ObliqCloud — Three.js scene + page interactions
   =================================================================== */

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isSmallScreen = window.innerWidth < 700;

/* =====================================================
   1. THREE.JS SCENE — "the network operations floor"
   A 3D network graph (nodes, links and data packets
   traveling between them) plus wireframe server racks,
   drawn in the brand blues on the light background.

   Three.js is loaded dynamically so the rest of the
   page keeps working even if the script is unreachable.
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
  scene.fog = new THREE.Fog(0xf6f8fc, 9, 22);

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

  const BLUE_DEEP = 0x1d4ed8;
  const BLUE_SKY = 0x0ea5e9;
  const NAVY = 0x0d1b2e;

  /* ---------- Network graph ---------- */
  const NODE_COUNT = prefersReducedMotion ? 40 : isSmallScreen ? 60 : 110;
  const SPREAD = { x: 18, y: 11, z: 7 };

  // Each node drifts gently around a fixed base position
  const nodes = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({
      base: new THREE.Vector3(
        (Math.random() - 0.5) * SPREAD.x,
        (Math.random() - 0.5) * SPREAD.y,
        (Math.random() - 0.5) * SPREAD.z - 4
      ),
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.5,
      amp: 0.25 + Math.random() * 0.45,
      pos: new THREE.Vector3(),
    });
  }

  // Connect each node to its nearest neighbours once, at init,
  // so the link structure is stable while endpoints drift
  const edges = [];
  const MAX_LINK_DIST = 3.4;
  for (let i = 0; i < NODE_COUNT; i++) {
    for (let j = i + 1; j < NODE_COUNT; j++) {
      if (nodes[i].base.distanceTo(nodes[j].base) < MAX_LINK_DIST) edges.push([i, j]);
    }
  }

  // Node points
  const nodePositions = new Float32Array(NODE_COUNT * 3);
  const nodeColors = new Float32Array(NODE_COUNT * 3);
  const nodeScales = new Float32Array(NODE_COUNT);
  const nodePalette = [new THREE.Color(BLUE_DEEP), new THREE.Color(BLUE_SKY), new THREE.Color(NAVY)];
  for (let i = 0; i < NODE_COUNT; i++) {
    const c = nodePalette[i % nodePalette.length];
    nodeColors.set([c.r, c.g, c.b], i * 3);
    nodeScales[i] = 0.5 + Math.random();
  }
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodePositions, 3));
  nodeGeo.setAttribute("color", new THREE.BufferAttribute(nodeColors, 3));
  nodeGeo.setAttribute("aScale", new THREE.BufferAttribute(nodeScales, 1));

  const nodeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: /* glsl */ `
      uniform float uPixelRatio;
      attribute float aScale;
      varying vec3 vColor;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = (30.0 * aScale + 10.0) * uPixelRatio / -mvPosition.z;
        vColor = color;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        // soft dot with a brighter center, readable on a light background
        float alpha = smoothstep(0.5, 0.18, d) * 0.55;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });
  const nodeMesh = new THREE.Points(nodeGeo, nodeMat);
  scene.add(nodeMesh);

  // Link lines
  const linkPositions = new Float32Array(edges.length * 2 * 3);
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute("position", new THREE.BufferAttribute(linkPositions, 3));
  const linkMat = new THREE.LineBasicMaterial({
    color: BLUE_DEEP,
    transparent: true,
    opacity: 0.14,
  });
  const links = new THREE.LineSegments(linkGeo, linkMat);
  scene.add(links);

  // Data packets traveling along the links
  const PACKET_COUNT = prefersReducedMotion ? 0 : isSmallScreen ? 8 : 16;
  const packets = [];
  for (let i = 0; i < PACKET_COUNT; i++) {
    packets.push({
      edge: Math.floor(Math.random() * edges.length),
      t: Math.random(),
      speed: 0.15 + Math.random() * 0.35,
    });
  }
  const packetPositions = new Float32Array(Math.max(PACKET_COUNT, 1) * 3);
  const packetGeo = new THREE.BufferGeometry();
  packetGeo.setAttribute("position", new THREE.BufferAttribute(packetPositions, 3));
  const packetMat = new THREE.PointsMaterial({
    color: BLUE_SKY,
    size: 0.14,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const packetMesh = new THREE.Points(packetGeo, packetMat);
  if (PACKET_COUNT > 0) scene.add(packetMesh);

  /* ---------- Server racks ---------- */
  // A rack = cabinet outline + stacked unit shelves + blinking LEDs
  function buildRack() {
    const rack = new THREE.Group();
    const W = 1.25, D = 0.85, UNIT_H = 0.24, UNITS = 7, GAP = 0.05;
    const totalH = UNITS * (UNIT_H + GAP) + GAP;

    const cabinetGeo = new THREE.BoxGeometry(W + 0.14, totalH, D + 0.14);
    const cabinet = new THREE.LineSegments(
      new THREE.EdgesGeometry(cabinetGeo),
      new THREE.LineBasicMaterial({ color: NAVY, transparent: true, opacity: 0.5 })
    );
    rack.add(cabinet);

    const unitMat = new THREE.LineBasicMaterial({ color: BLUE_DEEP, transparent: true, opacity: 0.45 });
    const ledColors = [0x16a34a, BLUE_SKY, 0x16a34a, BLUE_SKY];
    const ledPositions = [];
    for (let u = 0; u < UNITS; u++) {
      const y = -totalH / 2 + GAP + UNIT_H / 2 + u * (UNIT_H + GAP);
      const unit = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(W, UNIT_H, D)),
        unitMat
      );
      unit.position.y = y;
      rack.add(unit);
      // two LEDs on the front face of each unit
      ledPositions.push(-W / 2 + 0.16, y, D / 2 + 0.01);
      ledPositions.push(-W / 2 + 0.34, y, D / 2 + 0.01);
    }

    const ledGeo = new THREE.BufferGeometry();
    ledGeo.setAttribute("position", new THREE.Float32BufferAttribute(ledPositions, 3));
    const ledColorArr = new Float32Array(ledPositions.length);
    for (let i = 0; i < ledPositions.length / 3; i++) {
      const c = new THREE.Color(ledColors[i % ledColors.length]);
      ledColorArr.set([c.r, c.g, c.b], i * 3);
    }
    ledGeo.setAttribute("color", new THREE.BufferAttribute(ledColorArr, 3));
    const ledMat = new THREE.PointsMaterial({
      size: 0.07,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const leds = new THREE.Points(ledGeo, ledMat);
    leds.userData.isLed = true;
    rack.add(leds);
    return rack;
  }

  const rackGroup = new THREE.Group();
  const rackA = buildRack();
  const rackB = buildRack();
  const rackC = buildRack();
  rackA.position.set(0, 0, 0);
  rackB.position.set(-1.75, -0.25, -1.1);
  rackB.rotation.y = 0.25;
  rackC.position.set(1.75, -0.4, -1.4);
  rackC.rotation.y = -0.3;
  rackGroup.add(rackA, rackB, rackC);

  if (isSmallScreen) {
    rackGroup.position.set(0.4, -2.6, 1.2);
    rackGroup.scale.setScalar(0.62);
  } else {
    rackGroup.position.set(3.6, -0.1, 2.2);
    rackGroup.scale.setScalar(0.95);
  }
  rackGroup.rotation.y = -0.4;
  scene.add(rackGroup);

  // Collect rack materials so the whole cluster can fade on scroll
  const rackMats = [];
  rackGroup.traverse((obj) => {
    if (obj.material) rackMats.push(obj.material);
  });
  rackMats.forEach((m) => (m.userData.baseOpacity = m.opacity));

  /* ---------- Mouse + scroll state ---------- */
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
    nodeMat.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  });

  /* ---------- Render loop ---------- */
  const clock = new THREE.Clock();
  const rackBaseX = rackGroup.position.x;
  const rackBaseY = rackGroup.position.y;
  const rackBaseScale = rackGroup.scale.x;

  function tick() {
    const t = clock.getElapsedTime();
    const dt = Math.min(clock.getDelta() + 0.016, 0.05);

    // Drift nodes around their base positions
    for (let i = 0; i < NODE_COUNT; i++) {
      const n = nodes[i];
      n.pos.set(
        n.base.x + Math.sin(t * n.speed + n.phase) * n.amp,
        n.base.y + Math.cos(t * n.speed * 0.8 + n.phase * 1.3) * n.amp,
        n.base.z + Math.sin(t * n.speed * 0.6 + n.phase * 0.7) * n.amp * 0.6
      );
      nodePositions.set([n.pos.x, n.pos.y, n.pos.z], i * 3);
    }
    nodeGeo.attributes.position.needsUpdate = true;

    // Keep link endpoints attached to their drifting nodes
    for (let e = 0; e < edges.length; e++) {
      const a = nodes[edges[e][0]].pos;
      const b = nodes[edges[e][1]].pos;
      linkPositions.set([a.x, a.y, a.z, b.x, b.y, b.z], e * 6);
    }
    linkGeo.attributes.position.needsUpdate = true;

    // Advance packets along their links, hopping to a new link on arrival
    for (let p = 0; p < PACKET_COUNT; p++) {
      const pk = packets[p];
      pk.t += pk.speed * dt;
      if (pk.t >= 1) {
        pk.t = 0;
        pk.edge = Math.floor(Math.random() * edges.length);
        pk.speed = 0.15 + Math.random() * 0.35;
      }
      const a = nodes[edges[pk.edge][0]].pos;
      const b = nodes[edges[pk.edge][1]].pos;
      packetPositions.set(
        [a.x + (b.x - a.x) * pk.t, a.y + (b.y - a.y) * pk.t, a.z + (b.z - a.z) * pk.t],
        p * 3
      );
    }
    if (PACKET_COUNT > 0) packetGeo.attributes.position.needsUpdate = true;

    // Slow ambient rotation of the whole graph
    nodeMesh.rotation.y = links.rotation.y = packetMesh.rotation.y =
      Math.sin(t * 0.05) * 0.12 + scrollProgress * 0.5;

    // Racks bob gently; LEDs blink
    rackGroup.rotation.y = -0.4 + Math.sin(t * 0.25) * 0.08;
    rackGroup.position.y = rackBaseY + Math.sin(t * 0.6) * 0.1 - scrollProgress * 1.0;
    rackMats.forEach((m) => {
      if (m instanceof THREE.PointsMaterial && m.vertexColors) {
        m.opacity = m.userData.baseOpacity * (0.55 + 0.45 * Math.sin(t * 3.2));
      }
    });

    // Racks drift aside, shrink and fade as the user scrolls so they
    // never compete with the section content
    rackGroup.position.x = rackBaseX - scrollProgress * (isSmallScreen ? 1.5 : 4.5);
    const s = rackBaseScale * (1 - scrollProgress * 0.3);
    rackGroup.scale.setScalar(s);
    const fade = 1 - Math.min(scrollProgress * 2.4, 0.85);
    rackMats.forEach((m) => {
      if (!(m instanceof THREE.PointsMaterial)) m.opacity = m.userData.baseOpacity * fade;
    });

    // Mouse parallax with easing
    smooth.x += (mouse.x - smooth.x) * 0.04;
    smooth.y += (mouse.y - smooth.y) * 0.04;
    camera.position.x = smooth.x * 0.7;
    camera.position.y = -smooth.y * 0.4 - scrollProgress * 1.2;
    camera.lookAt(0, -scrollProgress * 1.2, 0);

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
