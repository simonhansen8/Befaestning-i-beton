# Befæstning i beton (DS/EN 1992-4)

Beregningsprogram til eftervisning af indstøbte bolte og indlimede anker i beton. Det færdige program er `index.html` (ét HTML-dokument, virker offline).

- Brugsvejledning: [docs/BRUGSVEJLEDNING.md](docs/BRUGSVEJLEDNING.md)
- Arkitektur og genopbygning: [docs/GENOPBYGNING.md](docs/GENOPBYGNING.md)
- Verifikation og kendte forbehold: [docs/verifikation.md](docs/verifikation.md), [docs/kritiske-fund.md](docs/kritiske-fund.md)
- Sporbarhed (formel → norm): [docs/sporbarhed.md](docs/sporbarhed.md)
- Tests: [tests/README.md](tests/README.md)

Udvikling: kildekode i `app/` (TypeScript + Vite). `npm test` kører alle tests; `npm run publicer -- ÅÅÅÅ-MM-DD.N` bygger og opdaterer `index.html`.
