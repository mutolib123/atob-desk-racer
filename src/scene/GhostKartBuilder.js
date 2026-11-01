import * as THREE from 'three';

/**
 * Creates the holographic 1:87 Micro-Kart Ghost racer with Fresnel rim glow,
 * subtle pulsing scanlines, spinning translucent wheels, and steering driver.
 */
export function buildGhostKart() {
  const ghostRoot = new THREE.Group();
  ghostRoot.name = 'GhostKartRoot';

  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'GhostChassisBody';
  ghostRoot.add(chassisGroup);

  // Global uniform bundle shared across all ghost parts for synchrony
  const ghostUniforms = {
    uTime: { value: 0.0 },
    uOpacity: { value: 0.50 },
    uGhostColor: { value: new THREE.Color(0x00f0ff) },
    uRimColor: { value: new THREE.Color(0x70f5ff) },
    uGlintColor: { value: new THREE.Color(0xffffff) },
  };

  /**
   * Custom Ethereal Holographic Shader Material
   */
  function createHolographicMaterial(options = {}) {
    const isVisor = Boolean(options.isVisor);
    const isWheel = Boolean(options.isWheel);
    const baseColor = options.color || new THREE.Color(0x00e5ff);

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: ghostUniforms.uTime,
        uOpacity: ghostUniforms.uOpacity,
        uGhostColor: { value: baseColor },
        uRimColor: ghostUniforms.uRimColor,
        uGlintColor: ghostUniforms.uGlintColor,
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec3 vWorldPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOpacity;
        uniform vec3 uGhostColor;
        uniform vec3 uRimColor;
        uniform vec3 uGlintColor;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec3 vWorldPos;

        void main() {
          vec3 n = normalize(vNormal);
          vec3 v = normalize(vViewPos);
          float ndotv = abs(dot(n, v));
          float fresnel = pow(1.0 - ndotv, 2.2);
          float glint = pow(1.0 - ndotv, 5.0);

          // Subtle holographic horizontal scanlines
          float scanline = sin((vWorldPos.y + vWorldPos.z) * 620.0 - uTime * 7.5) * 0.5 + 0.5;
          float scanMult = 0.82 + 0.18 * scanline;

          vec3 col = mix(uGhostColor * 0.75, uRimColor, fresnel * 0.95);
          col += uGlintColor * glint * 0.65;

          ${isVisor ? `col = mix(col, vec3(0.1, 0.85, 1.0), 0.55);` : ''}
          ${isWheel ? `col = mix(col, vec3(0.02, 0.45, 0.75), 0.45);` : ''}

          float alpha = clamp((uOpacity * 0.72 + fresnel * 0.38) * scanMult, 0.0, 0.95);
          if (alpha < 0.01) discard;

          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
  }

  const ghostBodyMat = createHolographicMaterial({ color: new THREE.Color(0x00f0ff) });
  const ghostAccentMat = createHolographicMaterial({ color: new THREE.Color(0x99f7ff) });
  const ghostWheelMat = createHolographicMaterial({ isWheel: true, color: new THREE.Color(0x00c4e8) });
  const ghostVisorMat = createHolographicMaterial({ isVisor: true, color: new THREE.Color(0x00ffff) });

  // 1. Soft Cyan Ground Halo Quad
  const ghostHaloCanvas = document.createElement('canvas');
  ghostHaloCanvas.width = 128;
  ghostHaloCanvas.height = 128;
  const hCtx = ghostHaloCanvas.getContext('2d');
  hCtx.clearRect(0, 0, 128, 128);
  const haloGrad = hCtx.createRadialGradient(64, 64, 6, 64, 64, 58);
  haloGrad.addColorStop(0.0, 'rgba(0, 240, 255, 0.65)');
  haloGrad.addColorStop(0.4, 'rgba(0, 210, 255, 0.35)');
  haloGrad.addColorStop(0.75, 'rgba(0, 160, 255, 0.12)');
  haloGrad.addColorStop(1.0, 'rgba(0, 120, 255, 0.0)');
  hCtx.fillStyle = haloGrad;
  hCtx.beginPath();
  hCtx.arc(64, 64, 58, 0, Math.PI * 2);
  hCtx.fill();

  const ghostHaloTex = new THREE.CanvasTexture(ghostHaloCanvas);
  const ghostHaloQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(0.022, 0.028),
    new THREE.MeshBasicMaterial({
      map: ghostHaloTex,
      transparent: true,
      opacity: 0.70,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    })
  );
  ghostHaloQuad.rotation.x = -Math.PI / 2;
  ghostHaloQuad.position.set(0, 0.0006, 0);
  ghostRoot.add(ghostHaloQuad);

  // 2. Procedural Holographic Ghost Kart Body (Exact 1:87 Micro-Kart Scale)
  const proceduralBodyGroup = new THREE.Group();
  chassisGroup.add(proceduralBodyGroup);

  // Floor pan
  const floorPan = new THREE.Mesh(
    new THREE.BoxGeometry(0.0082, 0.0009, 0.0155),
    ghostBodyMat
  );
  floorPan.position.set(0, 0.0014, 0);
  proceduralBodyGroup.add(floorPan);

  // Aerodynamic nose cone
  const noseCone = new THREE.Mesh(
    new THREE.BoxGeometry(0.0086, 0.0021, 0.0044),
    ghostBodyMat
  );
  noseCone.position.set(0, 0.0023, 0.0068);
  noseCone.rotation.x = 0.22;
  proceduralBodyGroup.add(noseCone);

  // Ghost Number Plate
  const numberPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.0048, 0.0004, 0.0028),
    ghostAccentMat
  );
  numberPlate.position.set(0, 0.0033, 0.0066);
  numberPlate.rotation.x = 0.22;
  proceduralBodyGroup.add(numberPlate);

  // Side pods
  for (const sx of [-0.0044, 0.0044]) {
    const sidePod = new THREE.Mesh(
      new THREE.BoxGeometry(0.0024, 0.0024, 0.0076),
      ghostBodyMat
    );
    sidePod.position.set(sx, 0.0024, -0.0004);
    proceduralBodyGroup.add(sidePod);
  }

  // Engine block & rear wing
  const engineBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.0034, 0.0036, 0.0042),
    ghostAccentMat
  );
  engineBlock.position.set(0.0022, 0.0036, -0.0048);
  proceduralBodyGroup.add(engineBlock);

  const rearWing = new THREE.Mesh(
    new THREE.BoxGeometry(0.0096, 0.0007, 0.0024),
    ghostAccentMat
  );
  rearWing.position.set(0, 0.0068, -0.0076);
  rearWing.rotation.x = -0.18;
  proceduralBodyGroup.add(rearWing);

  // Twin exhaust pipes
  for (const ex of [-0.00108, 0.00108]) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.00056, 0.00062, 0.0032, 12),
      ghostAccentMat
    );
    pipe.rotation.x = Math.PI / 2 + 0.12;
    pipe.position.set(ex, 0.00215, -0.0076);
    proceduralBodyGroup.add(pipe);
  }

  // Driver torso & helmet
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.0036, 0.0038, 0.0028),
    ghostBodyMat
  );
  torso.position.set(0, 0.0048, -0.0008);
  torso.rotation.x = 0.14;
  proceduralBodyGroup.add(torso);

  const driverHead = new THREE.Group();
  driverHead.position.set(0, 0.0078, -0.0004);
  const helmetShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.0022, 16, 14),
    ghostAccentMat
  );
  helmetShell.scale.set(0.95, 1.0, 1.08);
  driverHead.add(helmetShell);

  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.00225, 14, 10, -0.9, 1.8, 1.05, 0.75),
    ghostVisorMat
  );
  visor.rotation.y = Math.PI / 2;
  driverHead.add(visor);
  proceduralBodyGroup.add(driverHead);

  // 3. 4 Ghost Wheels (Front steerable pivots + spinning cylinders)
  const frontPivots = [];
  const wheelMeshes = [];

  function createGhostWheel(isRear = false) {
    const wRadius = isRear ? 0.00215 : 0.00185;
    const wWidth = isRear ? 0.0022 : 0.0017;
    const wGroup = new THREE.Group();

    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(wRadius, wRadius, wWidth, 16),
      ghostWheelMat
    );
    tire.rotation.z = Math.PI / 2;
    wGroup.add(tire);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(wRadius * 0.62, wRadius * 0.62, wWidth * 1.04, 12),
      ghostAccentMat
    );
    rim.rotation.z = Math.PI / 2;
    wGroup.add(rim);

    return wGroup;
  }

  // Front Left & Front Right
  for (const sx of [-0.0056, 0.0056]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.00195, 0.0056);
    const wheel = createGhostWheel(false);
    pivot.add(wheel);
    proceduralBodyGroup.add(pivot);
    frontPivots.push(pivot);
    wheelMeshes.push(wheel);
  }

  // Rear Left & Rear Right
  for (const sx of [-0.0058, 0.0058]) {
    const wheel = createGhostWheel(true);
    wheel.position.set(sx, 0.00225, -0.0054);
    proceduralBodyGroup.add(wheel);
    wheelMeshes.push(wheel);
  }

  let wheelSpinAngle = 0.0;
  let hasGlbKart = false;
  const glbAllWheels = [];
  const glbFrontWheels = [];

  /**
   * Clones and attaches the GLB kart with the holographic ghost shader
   */
  function attachGlbKart(glbScene) {
    if (!glbScene || hasGlbKart) return;
    try {
      const glbClone = glbScene.clone(true);
      glbClone.traverse((child) => {
        if (child.isMesh) {
          child.material = ghostBodyMat;
          child.castShadow = false;
          child.receiveShadow = false;
        }
        if (child.name === 'Wheel_FL' || child.name === 'Wheel_FR') {
          glbFrontWheels.push(child);
          glbAllWheels.push(child);
        } else if (child.name === 'Wheel_RL' || child.name === 'Wheel_RR') {
          glbAllWheels.push(child);
        }
      });

      proceduralBodyGroup.visible = false;
      chassisGroup.add(glbClone);
      hasGlbKart = true;
    } catch (e) {
      console.warn('Failed to attach GLB to ghost kart:', e);
    }
  }

  /**
   * Updates Ghost Kart transform, wheel spin, and steer pivots at 60FPS
   */
  function updatePose(pos, quat, speed = 0, steerAngle = 0, opacity = 0.50, dt = 1 / 60) {
    if (pos) ghostRoot.position.copy(pos);
    if (quat) ghostRoot.quaternion.copy(quat);

    ghostUniforms.uTime.value += dt;
    ghostUniforms.uOpacity.value = opacity;
    ghostHaloQuad.material.opacity = opacity * 1.35;

    // Spin wheels according to speed (wRadius ~ 0.002m)
    const effectiveSpeed = Math.abs(speed);
    wheelSpinAngle += (effectiveSpeed / 0.0020) * dt;

    for (const w of wheelMeshes) {
      w.rotation.x = wheelSpinAngle;
    }
    for (const w of glbAllWheels) {
      w.rotation.x = wheelSpinAngle;
    }

    // Steer front pivots
    for (const p of frontPivots) {
      p.rotation.y = steerAngle;
    }
    for (const p of glbFrontWheels) {
      p.rotation.y = steerAngle;
    }

    // Driver helmet slight tilt into corners
    driverHead.rotation.z = -steerAngle * 0.45;
  }

  function setVisible(val) {
    ghostRoot.visible = Boolean(val);
  }

  function setOpacity(val) {
    ghostUniforms.uOpacity.value = Math.max(0.0, Math.min(1.0, val));
  }

  return {
    kartRoot: ghostRoot,
    chassisGroup,
    updatePose,
    attachGlbKart,
    setVisible,
    setOpacity,
  };
}
