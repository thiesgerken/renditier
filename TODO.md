# TODO

## Web

- remove all cached data when the user logs out
- invalidate user info as soon as a 401 is encountered anywhere
- unify querying functions
- unify api access functions
- show percentages over all, not only IRR (at least on hover as tooltip)
- check that redux state is correctly deep cloned on plot data requests

# Ideas

- add crypto currencies
- add physical commodities like gold
- proper maintenance of stock data (renew every week?), exchanges are not updated currently at all (except on remove/add, which removes all data)
- try to find out which index links to each ETF, grab data for those as well. Maybe the user has to make the connection ... -> save link in different table to avoid overwriting it on update; maybe only allow this via CLI
- receipt parsing: also parse tax infos as soon as this is relevant? (units=0, amount=0, fees=...)
- exchange stuff could go; instead use the .quote.market exchange as the default and save it into the stock info; the price history should be updated for this market only?
- volumes should be a float
- invested tab should show how much money is currently invested (first in first out principle?)
