# Agent notes

## Personal data

This repository is public. Nothing in it (code, fixtures, tests, comments, commit messages,
issues, screenshots) may reveal the owner's identity or portfolio: which instruments are held,
how many units, what they are worth, how many positions the depot has.

Fixtures recorded from real documents (broker receipts, onvista responses) are anonymized before
they are committed:

| Real value | Replacement |
| --- | --- |
| IBAN, depot number, Geschäftsnummer, Rechnungsnummer, other account or order numbers | Random digits of the same shape. An IBAN keeps the bank code and gets valid mod-97 check digits |
| Instrument the owner holds (name, ISIN, WKN) in a receipt | A fictional one: `FIC` prefix (e.g. "FIC-Fictional World Equity"), made-up WKN, ISIN with a valid check digit |
| Instrument the owner holds in an onvista fixture | A widely held instrument of the same kind, recorded fresh: SAP (stock), Vanguard FTSE All-World (ETF), EUWAX Gold II (ETC) |
| Unit counts, amounts | Different values; recompute every dependent total so the document stays consistent |
| Filenames embedding counts, WKNs or names | Same rules as the content |

- Never commit database dumps or exports (`backup.json`, `*-export.json` are gitignored for that
  reason). Screenshots only ever show the demo user from `docs/demo/`.
- The demo data in `docs/demo/` deliberately uses widely held instruments. That is fine.
- Hostnames of the owner's infrastructure may appear. The secret key in `docker-compose.yaml` is a
  demo value; real secrets never go into the repository.
- When in doubt whether something is personal, ask instead of committing it.
