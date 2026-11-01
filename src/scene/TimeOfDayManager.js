import * as THREE from 'three';

const TOD_STORAGE_KEY = 'atob_desk_racer_tod_v1';

export const TOD_PRESETS = {
  Day: {
    name: 'Day',
    icon: '☀️',
    label: 'DAY',
    tagline: 'Bright Window Daylight',
    sunIntensity: 2.15,
    sunbeamIntensity: 1.35,
    lampIntensity: 0.35,
    trackGlowIntensity: 0.85,
    micGlowIntensity: 0.70,
    bloomStrength: 0.048,
    toneMappingExposure: 0.90,
    environmentIntensity: 0.38,
    showDustMotes: true,
    sunColor: new THREE.Color(0xfff5e4),
    hemiSky: new THREE.Color(0x9bc8ff),
    hemiGround: new THREE.Color(0x383025),
    bgDarkSlate: new THREE.Color(0x182436),
    bgGoldenMid: new THREE.Color(0x344865),
    bgGoldenMax: new THREE.Color(0x546e96),
    sunbeamWarm: new THREE.Color(0.95, 0.92, 0.82),
    sunbeamCore: new THREE.Color(1.0, 0.98, 0.94),
  },
  Sunset: {
    name: 'Sunset',
    icon: '🌅',
    label: 'SUNSET',
    tagline: 'Golden Hour Atmosphere',
    sunIntensity: 1.65,
    sunbeamIntensity: 1.85,
    lampIntensity: 0.85,
    trackGlowIntensity: 1.05,
    micGlowIntensity: 0.90,
    bloomStrength: 0.068,
    toneMappingExposure: 0.82,
    environmentIntensity: 0.22,
    showDustMotes: true,
    sunColor: new THREE.Color(0xff8c32),
    hemiSky: new THREE.Color(0x522818),
    hemiGround: new THREE.Color(0x180c06),
    bgDarkSlate: new THREE.Color(0x221109),
    bgGoldenMid: new THREE.Color(0x4d2812),
    bgGoldenMax: new THREE.Color(0x7a3e1b),
    sunbeamWarm: new THREE.Color(1.45, 0.65, 0.15),
    sunbeamCore: new THREE.Color(1.55, 1.15, 0.75),
  },
  Night: {
    name: 'Night',
    icon: '🌙',
    label: 'NIGHT',
    tagline: 'Cyber Desk Glow',
    sunIntensity: 0.00,
    sunbeamIntensity: 0.00,
    lampIntensity: 1.25,
    trackGlowIntensity: 1.20,
    micGlowIntensity: 1.00,
    bloomStrength: 0.075,
    toneMappingExposure: 0.74,
    environmentIntensity: 0.08,
    showDustMotes: false,
    sunColor: new THREE.Color(0xffb84d),
    hemiSky: new THREE.Color(0x1c2238),
    hemiGround: new THREE.Color(0x090706),
    bgDarkSlate: new THREE.Color(0x06070b),
    bgGoldenMid: new THREE.Color(0x181312),
    bgGoldenMax: new THREE.Color(0x241a15),
    sunbeamWarm: new THREE.Color(1.25, 0.85, 0.35),
    sunbeamCore: new THREE.Color(1.45, 1.25, 0.85),
  },
};

const TOD_ORDER = ['Day', 'Sunset', 'Night'];

export function createTimeOfDayManager({
  scene,
  settings,
  atmosphere,
  roomEnv,
  diorama,
  renderer,
  bloomPass,
}) {
  let activePresetName = 'Night';

  // Try to load saved preset from localStorage
  try {
    const saved = localStorage.getItem(TOD_STORAGE_KEY);
    if (saved && TOD_PRESETS[saved]) {
      activePresetName = saved;
    }
  } catch (_e) {
    // Ignore
  }

  let targetPreset = TOD_PRESETS[activePresetName];
  let onChangeCallback = null;

  // Working colors for smooth interpolation
  const currentSunColor = targetPreset.sunColor.clone();
  const currentHemiSky = targetPreset.hemiSky.clone();
  const currentHemiGround = targetPreset.hemiGround.clone();

  // Initialize values immediately
  settings.sunIntensity = targetPreset.sunIntensity;
  settings.sunbeamIntensity = targetPreset.sunbeamIntensity;
  settings.lampIntensity = targetPreset.lampIntensity;
  settings.trackGlowIntensity = targetPreset.trackGlowIntensity;
  settings.micGlowIntensity = targetPreset.micGlowIntensity;
  settings.bloomStrength = targetPreset.bloomStrength;
  settings.toneMappingExposure = targetPreset.toneMappingExposure;
  settings.showDustMotes = targetPreset.showDustMotes;
  scene.environmentIntensity = targetPreset.environmentIntensity;

  function applyPreset(name, instant = false) {
    if (!TOD_PRESETS[name]) return;
    activePresetName = name;
    targetPreset = TOD_PRESETS[name];

    try {
      localStorage.setItem(TOD_STORAGE_KEY, name);
    } catch (_e) {
      // Ignore
    }

    if (instant) {
      settings.sunIntensity = targetPreset.sunIntensity;
      settings.sunbeamIntensity = targetPreset.sunbeamIntensity;
      settings.lampIntensity = targetPreset.lampIntensity;
      settings.trackGlowIntensity = targetPreset.trackGlowIntensity;
      settings.micGlowIntensity = targetPreset.micGlowIntensity;
      settings.bloomStrength = targetPreset.bloomStrength;
      settings.toneMappingExposure = targetPreset.toneMappingExposure;
      settings.showDustMotes = targetPreset.showDustMotes;
      scene.environmentIntensity = targetPreset.environmentIntensity;

      currentSunColor.copy(targetPreset.sunColor);
      currentHemiSky.copy(targetPreset.hemiSky);
      currentHemiGround.copy(targetPreset.hemiGround);

      if (atmosphere.sunLight) {
        atmosphere.sunLight.color.copy(targetPreset.sunColor);
        atmosphere.sunLight.visible = targetPreset.sunIntensity > 0.005;
      }
      if (atmosphere.hemiLight) {
        atmosphere.hemiLight.color.copy(targetPreset.hemiSky);
        atmosphere.hemiLight.groundColor.copy(targetPreset.hemiGround);
      }
      if (atmosphere.sunbeamUniforms) {
        atmosphere.sunbeamUniforms.uColorWarm.value.copy(targetPreset.sunbeamWarm);
        atmosphere.sunbeamUniforms.uColorCore.value.copy(targetPreset.sunbeamCore);
      }
      if (atmosphere.requestShadowMapUpdate) {
        atmosphere.requestShadowMapUpdate();
      }
      if (renderer) {
        renderer.toneMappingExposure = targetPreset.toneMappingExposure;
      }
    }

    if (onChangeCallback) {
      onChangeCallback(activePresetName, targetPreset);
    }
  }

  applyPreset(activePresetName, true);

  /**
   * Smoothly interpolates lighting parameters towards the active preset
   */
  function update(dt, elapsedTime) {
    const smoothRate = 1.0 - Math.exp(-dt * 6.5);

    settings.sunIntensity = THREE.MathUtils.lerp(
      settings.sunIntensity,
      targetPreset.sunIntensity,
      smoothRate
    );
    settings.sunbeamIntensity = THREE.MathUtils.lerp(
      settings.sunbeamIntensity,
      targetPreset.sunbeamIntensity,
      smoothRate
    );
    settings.lampIntensity = THREE.MathUtils.lerp(
      settings.lampIntensity,
      targetPreset.lampIntensity,
      smoothRate
    );
    settings.trackGlowIntensity = THREE.MathUtils.lerp(
      settings.trackGlowIntensity,
      targetPreset.trackGlowIntensity,
      smoothRate
    );
    settings.micGlowIntensity = THREE.MathUtils.lerp(
      settings.micGlowIntensity,
      targetPreset.micGlowIntensity,
      smoothRate
    );
    settings.bloomStrength = THREE.MathUtils.lerp(
      settings.bloomStrength,
      targetPreset.bloomStrength,
      smoothRate
    );
    settings.toneMappingExposure = THREE.MathUtils.lerp(
      settings.toneMappingExposure,
      targetPreset.toneMappingExposure,
      smoothRate
    );
    scene.environmentIntensity = THREE.MathUtils.lerp(
      scene.environmentIntensity,
      targetPreset.environmentIntensity,
      smoothRate
    );

    // Interpolate light colors
    currentSunColor.lerp(targetPreset.sunColor, smoothRate);
    currentHemiSky.lerp(targetPreset.hemiSky, smoothRate);
    currentHemiGround.lerp(targetPreset.hemiGround, smoothRate);

    if (atmosphere.sunLight) {
      atmosphere.sunLight.color.copy(currentSunColor);
      atmosphere.sunLight.visible = settings.sunIntensity > 0.005;
      atmosphere.sunLight.intensity = 0.85 * settings.sunIntensity;
    }
    if (atmosphere.windowGlowLight) {
      atmosphere.windowGlowLight.visible = settings.sunIntensity > 0.005;
      atmosphere.windowGlowLight.intensity = 0.50 * settings.sunIntensity;
    }
    if (atmosphere.goldenFillLight) {
      atmosphere.goldenFillLight.visible = settings.sunIntensity > 0.005;
      atmosphere.goldenFillLight.intensity = 0.24 * settings.sunIntensity;
    }
    if (atmosphere.rimLight) {
      atmosphere.rimLight.visible = settings.sunIntensity > 0.005;
      atmosphere.rimLight.intensity = 0.22 * settings.sunIntensity;
    }
    if (atmosphere.hemiLight) {
      atmosphere.hemiLight.color.copy(currentHemiSky);
      atmosphere.hemiLight.groundColor.copy(currentHemiGround);
      atmosphere.hemiLight.intensity =
        0.045 + 0.025 * settings.lampIntensity + 0.42 * settings.sunIntensity;
    }
    if (atmosphere.sunbeamUniforms) {
      atmosphere.sunbeamUniforms.uColorWarm.value.lerp(targetPreset.sunbeamWarm, smoothRate);
      atmosphere.sunbeamUniforms.uColorCore.value.lerp(targetPreset.sunbeamCore, smoothRate);
    }

    if (renderer) {
      renderer.toneMappingExposure = settings.toneMappingExposure;
    }

    if (roomEnv && roomEnv.updateRoomLighting) {
      roomEnv.updateRoomLighting(settings.sunIntensity, settings.lampIntensity);
    }
    if (diorama && diorama.updateLightingMaterials) {
      diorama.updateLightingMaterials(settings.sunIntensity, settings.lampIntensity);
    }
  }

  function cycleTimeOfDay() {
    const curIdx = TOD_ORDER.indexOf(activePresetName);
    const nextIdx = (curIdx + 1) % TOD_ORDER.length;
    const nextName = TOD_ORDER[nextIdx];
    applyPreset(nextName, false);
    return TOD_PRESETS[nextName];
  }

  return {
    getPresetName: () => activePresetName,
    getPresetInfo: () => TOD_PRESETS[activePresetName],
    setPreset: (name) => applyPreset(name, false),
    cycleTimeOfDay,
    update,
    onChange: (cb) => {
      onChangeCallback = cb;
    },
  };
}
