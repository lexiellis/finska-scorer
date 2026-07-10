import {
  computeMatchWins,
  computeSmallPoints,
  getMatchGames,
} from '../match';
import { teamDisplayName } from '../teams';
import type { AppData, Game, Match } from '../types';

interface MatchSummaryProps {
  data: AppData;
  match: Match;
  completedGame: Game;
  onPlayAgain: () => void;
  onEndMatch: () => void;
}

export function MatchSummary({
  data,
  match,
  completedGame,
  onPlayAgain,
  onEndMatch,
}: MatchSummaryProps) {
  const wins = computeMatchWins(data, match);
  const smallPoints = computeSmallPoints(data, match);
  const matchGames = getMatchGames(data, match.id);
  const winnerTeam = completedGame.winnerTeamId
    ? match.teams.find((t) => t.id === completedGame.winnerTeamId)
    : null;
  const winnerName = winnerTeam ? teamDisplayName(winnerTeam, data.players) : 'Winner';

  const eliminated = completedGame.teams.find((t) =>
    completedGame.eliminatedTeamIds.includes(t.id),
  );
  const byMisses =
    eliminated && completedGame.winnerTeamId && completedGame.winnerTeamId !== eliminated.id;

  return (
    <div className="match-summary">
      <div className="match-summary-card">
        <h2 className="match-summary-title">Game {completedGame.gameNumber ?? matchGames.length}</h2>
        <p className="match-summary-result flash-win">
          {byMisses
            ? `${teamDisplayName(eliminated, data.players)} out · ${winnerName} wins`
            : `${winnerName} wins`}
        </p>

        <div className="match-summary-table-wrap">
          <table className="match-summary-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Match</th>
                <th>Small pts</th>
              </tr>
            </thead>
            <tbody>
              {match.teams.map((team) => (
                <tr key={team.id}>
                  <th scope="row">{teamDisplayName(team, data.players)}</th>
                  <td>{wins[team.id] ?? 0}</td>
                  <td>{smallPoints[team.id] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="match-summary-note">
          Small points = total score in games you lost. On games 3, 5, 7 &amp; 9, the team with
          most small points throws first.
        </p>

        <div className="match-summary-actions">
          <button type="button" className="btn primary large" onClick={onPlayAgain}>
            Play again
          </button>
          <button type="button" className="btn secondary large" onClick={onEndMatch}>
            End match
          </button>
        </div>
      </div>
    </div>
  );
}
