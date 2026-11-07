import { normalizeIndustry } from '../selectors/stocks';
import { SECTOR_ICONS } from './breakdowns';

describe('SECTOR_ICONS', () => {
  it('keeps every former sector name on an icon', () => {
    for (const name of [
      'Informationstechnologie',
      'Telekomdienste',
      'Basiskonsumgüter',
      'Konsumgüter zyklisch',
      'Versorger umfassend',
    ])
      expect(SECTOR_ICONS[normalizeIndustry(name)]).toBeDefined();
  });
});
