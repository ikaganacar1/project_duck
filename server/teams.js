/**
 * Assigns teams based on H = R - 1 formula.
 * @param {string[]} playerIds - Array of socket IDs
 * @returns {{ hunters: string[], runners: string[] }}
 */
function assignTeams(playerIds) {
  const total = playerIds.length;
  const runnerCount = Math.ceil((total + 1) / 2);
  const hunterCount = total - runnerCount;

  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return {
    hunters: shuffled.slice(0, hunterCount),
    runners: shuffled.slice(hunterCount),
  };
}

module.exports = { assignTeams };
