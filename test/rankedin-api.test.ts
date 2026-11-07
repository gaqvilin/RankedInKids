import { describe, expect, it } from 'vitest';
import { cookiesFromResponse, isAllowedReadPath } from '../api/_lib/rankedin';
import { parseRinDate } from '../src/lib/rankedin';

describe('isAllowedReadPath', () => {
  it('allows read controllers', () => {
    expect(isAllowedReadPath('Tournament/GetHeaderAsync?id=1')).toBe(true);
    expect(isAllowedReadPath('player/GetPlayerMatchesAsync?playerid=1')).toBe(true);
    expect(isAllowedReadPath('Match/GetChallengeResultAsync?challengeId=1')).toBe(true);
  });
  it('blocks everything else', () => {
    expect(isAllowedReadPath('Account/LogInAsync')).toBe(false);
    expect(isAllowedReadPath('Admin/Anything')).toBe(false);
    expect(isAllowedReadPath('Match/SubmitResultAsync')).toBe(false);
    expect(isAllowedReadPath('player/../Admin/x')).toBe(false);
    expect(isAllowedReadPath('https://evil.example/x')).toBe(false);
  });
});

describe('cookiesFromResponse', () => {
  it('joins Set-Cookie values', () => {
    const h = new Headers();
    h.append('set-cookie', 'rin-auth=abc; path=/; secure; httponly');
    h.append('set-cookie', 'other=1; path=/');
    expect(cookiesFromResponse(new Response(null, { headers: h }))).toBe('rin-auth=abc; other=1');
  });
});

describe('parseRinDate', () => {
  it('parses dd/MM/yyyy HH:mm', () => {
    expect(parseRinDate('07/11/2026 14:30')).toBe('2026-11-07T14:30:00');
    expect(parseRinDate('07/11/2026 00:00')).toBe('2026-11-07T00:00:00');
    expect(parseRinDate(null)).toBeNull();
  });
});

import { appPathFromRankedinUrl } from '../src/lib/rankedin';

describe('appPathFromRankedinUrl', () => {
  it('maps rankedin links to app paths', () => {
    expect(appPathFromRankedinUrl('https://www.rankedin.com/en/team/matchresults/168309')).toBe('/lagmatch/168309');
    expect(appPathFromRankedinUrl('https://www.rankedin.com/sv/tournament/75555/step-in')).toBe('/tavling/75555');
    expect(appPathFromRankedinUrl('https://www.rankedin.com/en/player/R000335756/aronaqvilin/info')).toBe('/spelare/R000335756');
    expect(appPathFromRankedinUrl('Aron')).toBeNull();
  });
});

import { splitPoolName } from '../src/lib/leagues';

describe('league links and pools', () => {
  it('maps league and team links', () => {
    expect(appPathFromRankedinUrl('https://www.rankedin.com/sv/teamleague/946/spl-swedish-padel-league-herrar-2026-27')).toBe('/liga/946');
    expect(appPathFromRankedinUrl('https://www.rankedin.com/sv/team/homepage/3203515')).toBe('/lag/3203515');
  });
  it('splits pool names into region and division', () => {
    expect(splitPoolName('R6 Sydväst - Div 1 Sydväst')).toEqual({ region: 'R6 Sydväst', division: 'Div 1 Sydväst' });
    expect(splitPoolName('Gul-södra')).toEqual({ region: '', division: 'Gul-södra' });
  });
});

import { klubbliganSeason, shortKlubbliganName } from '../src/lib/leagues';

describe('Klubbligan names', () => {
  it('orders seasons', () => {
    expect(klubbliganSeason('Klubbligan Sydväst 10-14 år HT 26')).toBe(2026.5);
    expect(klubbliganSeason('Klubbligan Syd 13-19 år VT26')).toBe(2026);
    expect(klubbliganSeason('Klubbligan 10-12 år HT 2024')).toBeNull();
  });
  it('shortens names', () => {
    expect(shortKlubbliganName('Klubbligan Sydväst 10-14 år HT 26')).toBe('Sydväst 10–14 år');
    expect(shortKlubbliganName('Klubbligan Öst 13-16 och 16-19 år HT 26')).toBe('Öst 13–16 och 16–19 år');
  });
});

describe('club links', () => {
  it('maps organisation links to the club page', () => {
    expect(appPathFromRankedinUrl('https://www.rankedin.com/sv/organisation/1436/varberg-padelklubb')).toBe('/klubb/1436');
  });
});

describe('club read paths', () => {
  it('allows only the public club endpoints', () => {
    expect(isAllowedReadPath('Organization/GetOrganizationInfoAsync?organisationId=1')).toBe(true);
    expect(isAllowedReadPath('Organization/GetMembersAsync?id=1')).toBe(true);
    expect(isAllowedReadPath('Organization/DownloadClubMembersList?OrganizationId=1')).toBe(false);
    expect(isAllowedReadPath('Organization/GetOpenApiKeyAsync?OrganisationId=1')).toBe(false);
  });
});
