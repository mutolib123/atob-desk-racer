import * as THREE from 'three';

const GHOST_STORAGE_KEY = 'atob_desk_racer_ghost_v1';

/**
 * Formats seconds into MM:SS.CC (e.g. 00:21.45)
 */
export function formatGhostTime(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '--:--.--';
  const totalCentis = Math.max(0, Math.floor(seconds * 100));
  const mins = Math.floor(totalCentis / 6000);
  const secs = Math.floor((totalCentis % 6000) / 100);
  const centis = totalCentis % 100;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

/**
 * Manages Ghost Car lap data recording, persistence, playback interpolation,
 * and live time delta tracking for ATOB Desk Racer.
 */
export function createGhostLapManager({ splineData, totalLength = 3.8371, startFinishIdx = 646 }) {
  let ghostEnabled = true;
  let bestGhost = null;
  let currentRecordingSamples = [];
  let isRecording = false;
  let lastRecordedTime = -1;
  let onNewRecordCallback = null;

  // Cached Three.js vectors for zero-GC interpolation
  const _interpPos = new THREE.Vector3();
  const _interpQuat = new THREE.Quaternion();
  const _p0 = new THREE.Vector3();
  const _p1 = new THREE.Vector3();
  const _q0 = new THREE.Quaternion();
  const _q1 = new THREE.Quaternion();

  /**
   * Generates a smooth, competitive ATOB Pro Benchmark Lap (~21.50s)
   * following the track spline coordinates with realistic racing dynamics.
   */
  function generateDefaultBenchmarkGhost() {
    const samples = splineData.samples;
    const N = samples.length;
    const benchmarkSamples = [];

    // Realistic target lap time ~ 21.45s
    // Average speed = totalLength / 21.45 ~= 0.1788 m/s
    const targetLapTime = 21.45;
    const dtStep = 0.0333; // 30Hz sampling rate
    const totalSteps = Math.round(targetLapTime / dtStep);

    const startSample = samples[startFinishIdx % N];
    const startArc = startSample.arc_length_m;

    let accumulatedTime = 0.0;
    let currentS = startArc;

    const _left = new THREE.Vector3();
    const _rotMat = new THREE.Matrix4();
    const _baseQuat = new THREE.Quaternion();
    const _yawQuat = new THREE.Quaternion();

    // Estimate arc-length per step and compute accurate speed curves
    for (let step = 0; step <= totalSteps; step++) {
      const lapProgress = step / totalSteps; // 0.0 to 1.0
      const currentTrackS = (startArc + lapProgress * totalLength) % totalLength;

      // Find spline sample near currentTrackS
      let lo = 0;
      let hi = N - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (samples[mid].arc_length_m <= currentTrackS) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }

      const s0 = samples[lo];
      const s1 = samples[(lo + 1) % N];
      const segArc0 = s0.arc_length_m;
      const segArc1 = (lo + 1) % N === 0 ? totalLength : s1.arc_length_m;
      const segLen = Math.max(1e-6, segArc1 - segArc0);
      const alpha = THREE.MathUtils.clamp((currentTrackS - segArc0) / segLen, 0, 1);

      const p0 = new THREE.Vector3().fromArray(s0.position);
      const p1 = new THREE.Vector3().fromArray(s1.position);
      const pos = new THREE.Vector3().lerpVectors(p0, p1, alpha);

      const t0 = new THREE.Vector3().fromArray(s0.tangent);
      const t1 = new THREE.Vector3().fromArray(s1.tangent);
      const tangent = new THREE.Vector3().lerpVectors(t0, t1, alpha).normalize();

      const n0 = new THREE.Vector3().fromArray(s0.normal);
      const n1 = new THREE.Vector3().fromArray(s1.normal);
      const normal = new THREE.Vector3().lerpVectors(n0, n1, alpha).normalize();

      const r0 = new THREE.Vector3().fromArray(s0.right);
      const r1 = new THREE.Vector3().fromArray(s1.right);
      const right = new THREE.Vector3().lerpVectors(r0, r1, alpha).normalize();

      // Slightly faster on straight sectors 5 and 6, controlled through turns 2 and 4
      const sector = s0.sector || 1;
      let speed = 0.178;
      if (sector === 6 || sector === 5) {
        speed = 0.208; // High speed straightaway
      } else if (sector === 2 || sector === 4) {
        speed = 0.155; // Technical corkscrew / cat helix
      } else {
        speed = 0.175;
      }

      // Smooth racing line lateral offset (hugging inside apex of sharp curves)
      const bank = THREE.MathUtils.lerp(s0.bank_deg || 0, s1.bank_deg || 0, alpha);
      const apexOffset = Math.sin(lapProgress * Math.PI * 4.0) * 0.0018;
      pos.addScaledVector(right, apexOffset);
      pos.addScaledVector(normal, 0.0003); // Road surface clearance

      // Orientation quaternion
      _left.crossVectors(normal, tangent).normalize();
      _rotMat.makeBasis(_left, normal, tangent);
      _baseQuat.setFromRotationMatrix(_rotMat);
      const steerYaw = -Math.sin(lapProgress * Math.PI * 4.0) * 0.03;
      _yawQuat.setFromAxisAngle(normal, steerYaw);
      const quat = _yawQuat.clone().multiply(_baseQuat);

      benchmarkSamples.push({
        t: Number(accumulatedTime.toFixed(3)),
        s: Number(currentTrackS.toFixed(4)),
        pos: [Number(pos.x.toFixed(5)), Number(pos.y.toFixed(5)), Number(pos.z.toFixed(5))],
        quat: [Number(quat.x.toFixed(4)), Number(quat.y.toFixed(4)), Number(quat.z.toFixed(4)), Number(quat.w.toFixed(4))],
        speed: Number(speed.toFixed(3)),
        steer: Number(steerYaw.toFixed(3)),
      });

      accumulatedTime += dtStep;
    }

    return {
      isDefault: true,
      lapTime: targetLapTime,
      label: 'ATOB BENCHMARK',
      recordDate: 'ATOB Pro Lap',
      samples: benchmarkSamples,
    };
  }

  /**
   * Loads saved best lap from localStorage or falls back to ATOB default benchmark
   */
  function loadSavedGhost() {
    try {
      const stored = localStorage.getItem(GHOST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          typeof parsed.lapTime === 'number' &&
          parsed.lapTime > 5.0 &&
          Array.isArray(parsed.samples) &&
          parsed.samples.length >= 20
        ) {
          bestGhost = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('Could not load saved ghost lap from localStorage:', e);
    }
    bestGhost = generateDefaultBenchmarkGhost();
  }

  loadSavedGhost();

  /**
   * Resets personal best ghost and restores the default ATOB benchmark lap
   */
  function resetToDefaultGhost() {
    try {
      localStorage.removeItem(GHOST_STORAGE_KEY);
    } catch (_e) {
      // Ignore localStorage errors
    }
    bestGhost = generateDefaultBenchmarkGhost();
    return bestGhost;
  }

  /**
   * Starts recording a new lap
   */
  function startRecordingLap() {
    currentRecordingSamples = [];
    isRecording = true;
    lastRecordedTime = -1;
  }

  /**
   * Records a single telemetry frame during active race
   */
  function recordFrame(dt, lapTime, s, position, quaternion, speed, steerAngle) {
    if (!isRecording) return;
    if (lapTime < 0) return;

    // Throttle recording to ~30Hz (every 0.033s)
    if (lapTime - lastRecordedTime < 0.032) return;
    lastRecordedTime = lapTime;

    currentRecordingSamples.push({
      t: Number(lapTime.toFixed(3)),
      s: Number(s.toFixed(4)),
      pos: [Number(position.x.toFixed(5)), Number(position.y.toFixed(5)), Number(position.z.toFixed(5))],
      quat: [Number(quaternion.x.toFixed(4)), Number(quaternion.y.toFixed(4)), Number(quaternion.z.toFixed(4)), Number(quaternion.w.toFixed(4))],
      speed: Number(speed.toFixed(3)),
      steer: Number((steerAngle || 0).toFixed(3)),
    });
  }

  /**
   * Called when a lap is completed. Checks for personal best!
   */
  function finishRecordingLap(lapTime, completedLapNum) {
    isRecording = false;
    if (!lapTime || lapTime < 5.0 || currentRecordingSamples.length < 25) {
      return { isNewRecord: false };
    }

    const prevBestTime = bestGhost ? bestGhost.lapTime : Infinity;
    const isNewRecord = bestGhost.isDefault || lapTime < prevBestTime;

    if (isNewRecord) {
      const newGhost = {
        isDefault: false,
        lapTime: Number(lapTime.toFixed(2)),
        label: 'PERSONAL BEST',
        lapNumber: completedLapNum || 1,
        recordDate: new Date().toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        samples: currentRecordingSamples.slice(),
      };

      bestGhost = newGhost;
      try {
        localStorage.setItem(GHOST_STORAGE_KEY, JSON.stringify(newGhost));
      } catch (err) {
        console.warn('Failed to save best ghost lap to localStorage:', err);
      }

      if (onNewRecordCallback) {
        onNewRecordCallback({
          newTime: lapTime,
          previousTime: prevBestTime,
          lapNumber: completedLapNum,
        });
      }

      return {
        isNewRecord: true,
        previousTime: prevBestTime,
        lapTime,
      };
    }

    return { isNewRecord: false, lapTime };
  }

  /**
   * Interpolates the Ghost's 3D pose, speed, and steering angle at a given lap time
   */
  function getGhostPoseAtTime(lapTime) {
    if (!ghostEnabled || !bestGhost || !bestGhost.samples || bestGhost.samples.length === 0) {
      return null;
    }

    const samples = bestGhost.samples;
    const n = samples.length;

    // Pre-race / starting grid: show ghost at starting position
    if (lapTime <= 0) {
      const s0 = samples[0];
      _interpPos.fromArray(s0.pos);
      _interpQuat.fromArray(s0.quat);
      return {
        pos: _interpPos,
        quat: _interpQuat,
        speed: 0.0,
        steerAngle: 0.0,
        s: s0.s,
        finished: false,
        opacity: 0.50,
      };
    }

    // Finished lap: hold last pose and gracefully fade
    if (lapTime >= bestGhost.lapTime) {
      const last = samples[n - 1];
      _interpPos.fromArray(last.pos);
      _interpQuat.fromArray(last.quat);
      const timeOver = lapTime - bestGhost.lapTime;
      const opacity = Math.max(0.12, 0.50 - timeOver * 0.15);
      return {
        pos: _interpPos,
        quat: _interpQuat,
        speed: Math.max(0, last.speed * (1.0 - timeOver * 0.5)),
        steerAngle: last.steer,
        s: last.s,
        finished: true,
        opacity,
      };
    }

    // Binary search for interval [i, i+1] where samples[i].t <= lapTime < samples[i+1].t
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (samples[mid].t <= lapTime) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    const i0 = lo;
    const i1 = Math.min(n - 1, lo + 1);

    if (i0 === i1) {
      const s0 = samples[i0];
      _interpPos.fromArray(s0.pos);
      _interpQuat.fromArray(s0.quat);
      return {
        pos: _interpPos,
        quat: _interpQuat,
        speed: s0.speed,
        steerAngle: s0.steer,
        s: s0.s,
        finished: false,
        opacity: 0.50,
      };
    }

    const s0 = samples[i0];
    const s1 = samples[i1];
    const dt = Math.max(1e-4, s1.t - s0.t);
    const alpha = THREE.MathUtils.clamp((lapTime - s0.t) / dt, 0.0, 1.0);

    _p0.fromArray(s0.pos);
    _p1.fromArray(s1.pos);
    _interpPos.lerpVectors(_p0, _p1, alpha);

    _q0.fromArray(s0.quat);
    _q1.fromArray(s1.quat);
    _interpQuat.slerpQuaternions(_q0, _q1, alpha);

    const speed = THREE.MathUtils.lerp(s0.speed, s1.speed, alpha);
    const steerAngle = THREE.MathUtils.lerp(s0.steer, s1.steer, alpha);
    const trackS = THREE.MathUtils.lerp(s0.s, s1.s, alpha);

    return {
      pos: _interpPos,
      quat: _interpQuat,
      speed,
      steerAngle,
      s: trackS,
      finished: false,
      opacity: 0.50,
    };
  }

  /**
   * Computes live time delta between player and ghost based on track distance s
   * Returns: { deltaSec, isAhead, formatted }
   */
  function computeDelta(playerS, playerLapTime) {
    if (!bestGhost || !bestGhost.samples || bestGhost.samples.length < 5 || playerLapTime <= 0.4) {
      return null;
    }

    const samples = bestGhost.samples;
    const n = samples.length;

    // Find the ghost sample closest to player's track distance s
    let bestDist = Infinity;
    let closestSample = samples[0];

    for (let i = 0; i < n; i += 2) {
      const smp = samples[i];
      let diff = Math.abs(smp.s - playerS);
      if (diff > totalLength * 0.5) {
        diff = totalLength - diff;
      }
      if (diff < bestDist) {
        bestDist = diff;
        closestSample = smp;
        if (bestDist < 0.02) break; // close enough
      }
    }

    if (bestDist > 0.35) {
      // Too far off track or early in the lap
      return null;
    }

    // Delta = player's current lap time minus ghost's time at this same track location
    const deltaSec = playerLapTime - closestSample.t;
    const isAhead = deltaSec <= 0;
    const sign = isAhead ? '-' : '+';
    const formatted = `${sign}${Math.abs(deltaSec).toFixed(2)}s`;

    return {
      deltaSec,
      isAhead,
      formatted,
    };
  }

  function getBestGhostInfo() {
    return {
      lapTime: bestGhost ? bestGhost.lapTime : null,
      formattedTime: formatGhostTime(bestGhost ? bestGhost.lapTime : null),
      label: bestGhost ? bestGhost.label : 'NO GHOST',
      isDefault: bestGhost ? bestGhost.isDefault : true,
      recordDate: bestGhost ? bestGhost.recordDate : '',
      enabled: ghostEnabled,
    };
  }

  function setGhostEnabled(val) {
    ghostEnabled = Boolean(val);
    return ghostEnabled;
  }

  function toggleGhost() {
    ghostEnabled = !ghostEnabled;
    return ghostEnabled;
  }

  return {
    getGhostPoseAtTime,
    computeDelta,
    startRecordingLap,
    recordFrame,
    finishRecordingLap,
    getBestGhostInfo,
    resetToDefaultGhost,
    setGhostEnabled,
    toggleGhost,
    isGhostEnabled: () => ghostEnabled,
    onNewRecord: (cb) => {
      onNewRecordCallback = cb;
    },
  };
}
