// A player enters a doubles class in a tournament, the way rankedin.com's "Join" button does it
// (startJoinProcess in its bundle): validate age → consent (UI only) → licence check → join.
//   read:    GET  tournament/GetJoinButtonModelAsync?tournamentId&language
//   age:     POST tournament/ValidateAgeGroupAsync { tournamentClassId, playerId }      (only if the class asks for it)
//   licence: POST tournament/CheckForLicenseAsync  { tournamentId }                      (only if the tournament requires one)
//   join:    POST tournament/JoinDoubleAsync       { partnerId|null, tournamentClassId, tournamentId, clubLeagueId: 0, language }
// Payment (status "requires external payment") and buying a licence are handed over to rankedin.com.
// Done with the player's own login; the join is read back afterwards.
import { prop, type Call } from './pairing.js';

export type JoinClass = {
  classId: number;
  name: string;
  doubles: boolean;
  signInOpen: boolean;
  signedIn: boolean;
  lookingForPartner: boolean;
  full: boolean;
  /** Why the player cannot enter (Rankedin's own text), or null. */
  blocked: string | null;
  validateAge: boolean;
};
export type JoinOptions = { playerId: number; licenseRequired: boolean; askForConsent: boolean; signInPassed: boolean; classes: JoinClass[] };

export class JoinError extends Error {
  constructor(
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const RANKEDIN = 'https://www.rankedin.com';

async function get(call: Call, path: string) {
  const r = await call('GET', path);
  if (r.status === 401 || r.status === 403) throw new JoinError('not_logged_in', 'Logga in med spelarens Rankedin-konto först.');
  if (!r.ok) throw new JoinError('upstream', `Rankedin svarade ${r.status}.`);
  return r.data;
}
async function post(call: Call, path: string, body: unknown, what: string) {
  const r = await call('POST', path, body);
  if (r.status === 401 || r.status === 403) throw new JoinError('not_logged_in', 'Logga in med spelarens Rankedin-konto först.');
  if (!r.ok) {
    const msg = String(prop(r.data, 'message') ?? '');
    throw new JoinError('rejected', `${what} gick inte: ${msg || `Rankedin svarade ${r.status}`}`);
  }
  return r.data;
}

export function parseOptions(model: unknown): JoinOptions {
  return {
    playerId: Number(prop(model, 'currentPlayerId')) || 0,
    licenseRequired: !!prop(model, 'isLicenseRequired'),
    askForConsent: !!prop(model, 'askForConsent'),
    signInPassed: !!prop(model, 'isSignInDatePassed'),
    classes: list(prop(model, 'classes')).map((c) => ({
      classId: Number(prop(c, 'itemID')) || 0,
      name: String(prop(c, 'description') ?? ''),
      doubles: !!prop(c, 'isRankingTypeDouble'),
      signInOpen: !!prop(c, 'isSignInOpen'),
      signedIn: !!prop(c, 'thisPlayerSignedIn'),
      lookingForPartner: !!prop(c, 'isCurrentPlayerLookingForPartner'),
      full: !!prop(c, 'isParticipantsLimitReached'),
      blocked: String(prop(c, 'cantJoinClassMessage') ?? '').trim() || null,
      validateAge: !!prop(c, 'validateAgeGroup'),
    })),
  };
}

export async function loadOptions(call: Call, tournamentId: number): Promise<JoinOptions> {
  return parseOptions(await get(call, `tournament/GetJoinButtonModelAsync?tournamentId=${tournamentId}&language=sv`));
}

/** Rankedin's TournamentJoinResponseStatus (same numbers as for JoinDoublePartnerAsync). */
const STATUS: Record<number, [string, string]> = {
  1: ['closed', 'Sista anmälningsdag har passerat.'],
  2: ['full', 'Klassen är full.'],
  4: ['external', 'Rankedin vill att anmälan slutförs på rankedin.com.'],
  5: ['full', 'Klassen är full.'],
  6: ['already', 'Spelaren eller partnern är redan anmäld i klassen.'],
  7: ['already', 'Spelaren eller partnern är redan anmäld i klassen.'],
};

export type JoinResult = { ok: true; paymentUrl: string | null; verified: boolean };

/** Enter the logged-in player in a doubles class, with a partner or (partnerId null) looking for one. */
export async function joinDoubles(call: Call, tournamentId: number, classId: number, partnerId: number | null): Promise<JoinResult> {
  const o = await loadOptions(call, tournamentId);
  const cls = o.classes.find((c) => c.classId === classId);
  if (!cls) throw new JoinError('no_class', 'Klassen finns inte i tävlingen.');
  if (!cls.doubles) throw new JoinError('not_doubles', 'Bara dubbelklasser kan anmälas här. Anmäl på rankedin.com.', { url: `${RANKEDIN}/sv/tournament/${tournamentId}` });
  if (cls.signedIn) throw new JoinError('already', 'Spelaren är redan anmäld i klassen.');
  if (o.signInPassed || !cls.signInOpen) throw new JoinError('closed', 'Anmälan är stängd.');
  if (cls.blocked) throw new JoinError('blocked', cls.blocked);
  if (partnerId !== null && partnerId === o.playerId) throw new JoinError('same_player', 'Partnern kan inte vara spelaren själv.');

  if (cls.validateAge) {
    const okAge = await post(call, 'tournament/ValidateAgeGroupAsync', { tournamentClassId: classId, playerId: o.playerId }, 'Ålderskontrollen');
    if (okAge !== true) throw new JoinError('age', 'Spelarens ålder passar inte klassen enligt Rankedin.');
  }

  if (o.licenseRequired) {
    const lic = await post(call, 'tournament/CheckForLicenseAsync', { tournamentId }, 'Licenskontrollen');
    const url = `${RANKEDIN}/sv/tournament/${tournamentId}`;
    if (!lic || !prop(lic, 'success')) {
      throw new JoinError('license', String(prop(lic, 'details') ?? '').trim() || 'Rankedin godkände inte spelarens licens.', { url });
    }
    if (!prop(lic, 'hasValidHomeClub') || !prop(lic, 'isConsentGivenToHomeClub')) {
      throw new JoinError('home_club', 'Spelaren behöver välja hemmaklubb i Rankedin innan anmälan.', { url });
    }
    if (list(prop(lic, 'invalidLicences')).length > 0) {
      throw new JoinError('license', 'Spelaren saknar giltig tävlingslicens. Köp licensen i Rankedin och anmäl sedan igen.', { url });
    }
  }

  const res = await post(
    call,
    'tournament/JoinDoubleAsync',
    { partnerId, tournamentClassId: classId, tournamentId, clubLeagueId: 0, language: 'sv' },
    'Anmälan',
  );
  const status = Number(prop(res, 'status') ?? 0);
  let paymentUrl: string | null = null;
  if (status === 3) {
    // Entered, but the fee is paid on rankedin.com (its own payment page, as its UI redirects).
    const q = new URLSearchParams({
      participantId: String(prop(res, 'joinParticipantId') ?? ''),
      tournamentClassId: String(classId),
      tournamentId: String(prop(res, 'tournamentId') ?? tournamentId),
      qty: String(prop(res, 'quantity') ?? 1),
      tournamentName: String(prop(res, 'tournamentName') ?? ''),
    });
    paymentUrl = `${RANKEDIN}/sv/payment/order/0?${q}`;
  } else if (status !== 0) {
    const [code, message] = STATUS[status] ?? ['status', `Rankedin svarade med status ${status}.`];
    throw new JoinError(code, message, { status });
  }

  // Read back: the class should now show the player as entered.
  const after = await loadOptions(call, tournamentId).catch(() => null);
  const verified = !!after?.classes.find((c) => c.classId === classId)?.signedIn;
  return { ok: true, paymentUrl, verified };
}
