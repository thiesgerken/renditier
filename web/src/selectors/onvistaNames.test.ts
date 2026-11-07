import { countryCode, currencyCode } from './onvistaNames';

describe('countryCode', () => {
  it("maps onvista's country names", () => {
    expect(countryCode('Deutschland')).toBe('DE');
    expect(countryCode('USA')).toBe('US');
    expect(countryCode('Großbritannien')).toBe('GB');
    expect(countryCode('Südkorea')).toBe('KR');
  });

  it('has no code for what is not a country', () => {
    expect(countryCode('Global')).toBeNull();
    expect(countryCode('Barmittel')).toBeNull();
    expect(countryCode('andere Länder')).toBeNull();
    expect(countryCode('Eurozone')).toBeNull();
    expect(countryCode('Äußeres Ozeanien')).toBeNull();
  });
});

describe('currencyCode', () => {
  it("maps onvista's currency names, singular or plural", () => {
    expect(currencyCode('US-Dollar')).toBe('USD');
    expect(currencyCode('Euro')).toBe('EUR');
    expect(currencyCode('Hongkong Dollar')).toBe('HKD');
    expect(currencyCode('Norwegische Krone')).toBe('NOK');
    expect(currencyCode('Dänische Kronen')).toBe('DKK');
    expect(currencyCode('Japanische Yen')).toBe('JPY');
    expect(currencyCode('Pfund Sterling')).toBe('GBP');
  });
});
