import { describe, expect, it } from 'vitest';
import { JoinError, joinDoubles, loadOptions } from '../api/_lib/join';
import type { Call } from '../api/_lib/pairing';

/** Fake Rankedin join flow (PascalCase answers), recording posts. */
function fake(o: Partial<{ license: boolean; licOk: boolean; homeClub: boolean; invalid: number[]; ageOk: boolean; validateAge: boolean; status: number; blocked: string; open: boolean; doubles: boolean }> = {}) {
  const s = { license: false, licOk: true, homeClub: true, invalid: [] as number[], ageOk: true, validateAge: true, status: 0, blocked: '', open: true, doubles: true, ...o };
  const state = { signedIn: false };
  const posts: { path: string; body: any }[] = [];
  const call: Call = async (method, path, body) => {
    const p = path.split('?')[0];
    if (method === 'GET' && p === 'tournament/GetJoinButtonModelAsync') {
      return {
        ok: true,
        status: 200,
        data: {
          CurrentPlayerId: 100,
          IsLicenseRequired: s.license,
          AskForConsent: false,
          IsSignInDatePassed: false,
          Classes: [
            { ItemID: 9, Description: 'Pojkar 12 Step In', IsRankingTypeDouble: s.doubles, IsSignInOpen: s.open, ThisPlayerSignedIn: state.signedIn, IsParticipantsLimitReached: false, CantJoinClassMessage: s.blocked, ValidateAgeGroup: s.validateAge },
          ],
        },
      };
    }
    posts.push({ path: p, body });
    if (p === 'tournament/ValidateAgeGroupAsync') return { ok: true, status: 200, data: s.ageOk };
    if (p === 'tournament/CheckForLicenseAsync') return { ok: true, status: 200, data: { success: s.licOk, details: 'Licensen har gått ut', hasValidHomeClub: s.homeClub, isConsentGivenToHomeClub: s.homeClub, invalidLicences: s.invalid } };
    if (p === 'tournament/JoinDoubleAsync') {
      if (s.status === 0 || s.status === 3) state.signedIn = true;
      return { ok: true, status: 200, data: { status: s.status, tournamentId: 75555, joinParticipantId: 555, quantity: 1, tournamentName: 'Step In' } };
    }
    return { ok: false, status: 404, data: null };
  };
  return { call, posts };
}
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e as JoinError).code);

describe('join a doubles class', () => {
  it('reads which classes the player can enter', async () => {
    const o = await loadOptions(fake().call, 75555);
    expect(o).toMatchObject({ playerId: 100, licenseRequired: false });
    expect(o.classes[0]).toMatchObject({ classId: 9, name: 'Pojkar 12 Step In', doubles: true, signInOpen: true, signedIn: false, blocked: null });
  });

  it('age check, then joins with the partner exactly like Rankedin, and reads back', async () => {
    const f = fake();
    const r = await joinDoubles(f.call, 75555, 9, 200);
    expect(f.posts.map((p) => p.path)).toEqual(['tournament/ValidateAgeGroupAsync', 'tournament/JoinDoubleAsync']);
    expect(f.posts[0].body).toEqual({ tournamentClassId: 9, playerId: 100 });
    expect(f.posts[1].body).toEqual({ partnerId: 200, tournamentClassId: 9, tournamentId: 75555, clubLeagueId: 0, language: 'sv' });
    expect(r).toEqual({ ok: true, paymentUrl: null, verified: true });
  });

  it('without partner sends partnerId null', async () => {
    const f = fake({ validateAge: false });
    await joinDoubles(f.call, 75555, 9, null);
    expect(f.posts).toHaveLength(1);
    expect(f.posts[0].body.partnerId).toBeNull();
  });

  it('payment required: entered, with the link to Rankedin’s payment page', async () => {
    const r = await joinDoubles(fake({ status: 3 }).call, 75555, 9, 200);
    expect(r.paymentUrl).toBe('https://www.rankedin.com/sv/payment/order/0?participantId=555&tournamentClassId=9&tournamentId=75555&qty=1&tournamentName=Step+In');
  });

  it('never posts the join when a check fails', async () => {
    for (const [opts, expected] of [
      [{ ageOk: false }, 'age'],
      [{ license: true, licOk: false }, 'license'],
      [{ license: true, homeClub: false }, 'home_club'],
      [{ license: true, invalid: [3] }, 'license'],
      [{ blocked: 'Du kan inte anmäla dig' }, 'blocked'],
      [{ open: false }, 'closed'],
      [{ doubles: false }, 'not_doubles'],
    ] as [Parameters<typeof fake>[0], string][]) {
      const f = fake(opts);
      expect(await code(joinDoubles(f.call, 75555, 9, 200))).toBe(expected);
      expect(f.posts.some((p) => p.path === 'tournament/JoinDoubleAsync')).toBe(false);
    }
  });

  it('refuses the player as their own partner, and maps Rankedin’s refusals', async () => {
    expect(await code(joinDoubles(fake().call, 75555, 9, 100))).toBe('same_player');
    expect(await code(joinDoubles(fake({ status: 2 }).call, 75555, 9, 200))).toBe('full');
    expect(await code(joinDoubles(fake({ status: 1 }).call, 75555, 9, 200))).toBe('closed');
  });

  it('does not enter twice', async () => {
    const f = fake();
    await joinDoubles(f.call, 75555, 9, 200);
    expect(await code(joinDoubles(f.call, 75555, 9, 200))).toBe('already');
  });
});
