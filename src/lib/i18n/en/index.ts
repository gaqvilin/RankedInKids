// English texts, keyed by the Swedish text. One file per area of the app; merged here.
import { common } from './common';
import { leagues } from './leagues';
import { organizer } from './organizer';
import { server } from './server';
import { start } from './start';
import { texts } from './texts';
import { tournament } from './tournament';

export const EN: Record<string, string> = {
  ...common,
  ...tournament,
  ...start,
  ...organizer,
  ...leagues,
  ...server,
  ...texts,
};
