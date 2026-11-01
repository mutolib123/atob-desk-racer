/**
 * Manages the local storage-based leaderboard system for ATOB Desk Racer.
 * Saves and displays the top 5 fastest lap times achieved by the user.
 */

const LEADERBOARD_STORAGE_KEY = 'atob_desk_racer_leaderboard_v1';

export function formatTimeMMSSCC(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '--:--.--';
  const totalCentis = Math.max(0, Math.floor(seconds * 100));
  const mins = Math.floor(totalCentis / 6000);
  const secs = Math.floor((totalCentis % 6000) / 100);
  const centis = totalCentis % 100;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

const DEFAULT_LEADERBOARD = [
  {
    id: 'default-1',
    rank: 1,
    name: 'Geneviève',
    time: 21.12,
    formattedTime: '00:21.12',
    date: 'ATOB Pro Lap',
    isPlayer: false,
    lapNum: 2,
    tod: 'Sunset',
  },
  {
    id: 'default-2',
    rank: 2,
    name: 'Jay',
    time: 21.45,
    formattedTime: '00:21.45',
    date: 'ATOB Benchmark',
    isPlayer: false,
    lapNum: 3,
    tod: 'Day',
  },
  {
    id: 'default-3',
    rank: 3,
    name: 'Vamsi',
    time: 22.30,
    formattedTime: '00:22.30',
    date: 'Desk Circuit',
    isPlayer: false,
    lapNum: 1,
    tod: 'Night',
  },
  {
    id: 'default-4',
    rank: 4,
    name: 'Jack',
    time: 22.85,
    formattedTime: '00:22.85',
    date: 'Desk Circuit',
    isPlayer: false,
    lapNum: 2,
    tod: 'Night',
  },
  {
    id: 'default-5',
    rank: 5,
    name: 'Paige',
    time: 23.40,
    formattedTime: '00:23.40',
    date: 'Desk Circuit',
    isPlayer: false,
    lapNum: 1,
    tod: 'Sunset',
  },
];

export function createLeaderboardManager() {
  let leaderboard = [];
  let onLeaderboardUpdateCallback = null;

  function loadLeaderboard() {
    try {
      const stored = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          leaderboard = parsed
            .filter((item) => typeof item.time === 'number' && item.time > 5.0)
            .sort((a, b) => a.time - b.time)
            .slice(0, 5)
            .map((item, idx) => ({
              ...item,
              rank: idx + 1,
              formattedTime: item.formattedTime || formatTimeMMSSCC(item.time),
            }));
          if (leaderboard.length > 0) return;
        }
      }
    } catch (e) {
      console.warn('Failed to load leaderboard from localStorage:', e);
    }

    // Default fallback clone
    leaderboard = DEFAULT_LEADERBOARD.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }

  loadLeaderboard();

  function saveLeaderboard() {
    try {
      localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(leaderboard));
    } catch (e) {
      console.warn('Failed to save leaderboard to localStorage:', e);
    }
    if (onLeaderboardUpdateCallback) {
      onLeaderboardUpdateCallback(leaderboard);
    }
  }

  function getTop5() {
    return leaderboard.slice(0, 5);
  }

  /**
   * Evaluates a completed lap time. If it qualifies for top 5, inserts and saves it.
   */
  function recordLapTime(lapTime, lapNumber = 1, todName = 'Night') {
    if (!lapTime || lapTime < 5.0) {
      return { qualified: false, top5: getTop5() };
    }

    const cleanTime = Number(lapTime.toFixed(2));
    const worstTime = leaderboard.length >= 5 ? leaderboard[leaderboard.length - 1].time : Infinity;

    if (leaderboard.length < 5 || cleanTime < worstTime) {
      const dateStr = new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const newEntry = {
        id: `player-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: 'YOU',
        time: cleanTime,
        formattedTime: formatTimeMMSSCC(cleanTime),
        date: dateStr,
        isPlayer: true,
        lapNum: lapNumber || 1,
        tod: todName || 'Night',
      };

      leaderboard.push(newEntry);
      leaderboard.sort((a, b) => a.time - b.time);
      leaderboard = leaderboard.slice(0, 5).map((item, idx) => ({
        ...item,
        rank: idx + 1,
      }));

      saveLeaderboard();

      const newRank = leaderboard.findIndex((item) => item.id === newEntry.id) + 1;
      return {
        qualified: true,
        rank: newRank,
        isNewFirst: newRank === 1,
        entry: newEntry,
        top5: getTop5(),
      };
    }

    return {
      qualified: false,
      top5: getTop5(),
    };
  }

  function resetLeaderboard() {
    try {
      localStorage.removeItem(LEADERBOARD_STORAGE_KEY);
    } catch (_e) {
      // Ignore
    }
    leaderboard = DEFAULT_LEADERBOARD.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
    saveLeaderboard();
    return leaderboard;
  }

  function getBestTime() {
    return leaderboard.length > 0 ? leaderboard[0] : null;
  }

  return {
    getTop5,
    recordLapTime,
    resetLeaderboard,
    getBestTime,
    onUpdate: (cb) => {
      onLeaderboardUpdateCallback = cb;
    },
  };
}
