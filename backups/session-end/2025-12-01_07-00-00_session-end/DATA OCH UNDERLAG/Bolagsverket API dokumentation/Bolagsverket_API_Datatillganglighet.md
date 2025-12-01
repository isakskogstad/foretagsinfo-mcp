# Bolagsverket API - Komplett Datatillgänglighet
## Alla Tillgängliga Datavärden

**Skapad:** 2025-12-01
**Baserat på:** API v1 + iXBRL-årsredovisningar

---

## 📊 Översikt

Bolagsverkets API tillhandahåller data genom **två huvudkanaler**:

1. **REST API** (`/organisationer` endpoint) → Grundläggande företagsdata
2. **Årsredovisningar** (`/dokument` endpoint) → Finansiella nyckeltal, styrelse, ekonomiska rapporter

---

## 🔍 Del 1: REST API - Organisationsdata

### Endpoint: POST /organisationer

**Beskrivning:** Hämta grundläggande företagsinformation direkt via API.

### Tillgängliga Datafält

#### 1. Organisationsidentitet
```json
{
  "organisationsidentitet": {
    "identitetsbeteckning": "5590852777",
    "typ": {
      "kod": "ORGNR",
      "klartext": "Organisationsnummer"
    }
  }
}
```

**Datavärden:**
- `identitetsbeteckning` - Organisationsnummer, personnummer eller samordningsnummer
- `typ.kod` - Typ av identifikation (ORGNR, PERSNR, SAMORDNR)
- `typ.klartext` - Läsbar beskrivning av typ

---

#### 2. Organisationsnamn
```json
{
  "organisationsnamn": {
    "dataproducent": "Bolagsverket",
    "organisationsnamnLista": [
      {
        "namn": "Jonas Skomakare AB",
        "organisationsnamntyp": {
          "kod": "FORETAGSNAMN",
          "klartext": "Företagsnamn"
        },
        "registreringsdatum": "2016-11-15",
        "verksamhetsbeskrivningSarskiltForetagsnamn": null
      }
    ]
  }
}
```

**Datavärden:**
- `namn` - Företagets registrerade namn
- `organisationsnamntyp.kod` - Typ av namn (FORETAGSNAMN, BIFIRMA, etc.)
- `organisationsnamntyp.klartext` - Läsbar beskrivning
- `registreringsdatum` - När namnet registrerades
- `verksamhetsbeskrivningSarskiltForetagsnamn` - Verksamhetsbeskrivning för bifirmor
- `dataproducent` - Vilken myndighet som tillhandahåller data

---

#### 3. Organisationsform
```json
{
  "organisationsform": {
    "dataproducent": "Bolagsverket",
    "kod": "AB",
    "klartext": "Aktiebolag"
  }
}
```

**Möjliga värden:**
- AB - Aktiebolag
- HB - Handelsbolag
- KB - Kommanditbolag
- EF - Enskild firma
- BRF - Bostadsrättsförening
- m.fl.

---

#### 4. Juridisk Form
```json
{
  "juridiskForm": {
    "dataproducent": "SCB",
    "kod": "49",
    "klartext": "Övriga aktiebolag"
  }
}
```

**Datavärden:**
- `kod` - SCB:s kod för juridisk form
- `klartext` - Beskrivning av juridisk form

---

#### 5. Organisationsdatum
```json
{
  "organisationsdatum": {
    "dataproducent": "Bolagsverket",
    "registreringsdatum": "2016-11-15",
    "infortHosScb": null
  }
}
```

**Datavärden:**
- `registreringsdatum` - När företaget registrerades
- `infortHosScb` - När företaget fördes in hos SCB

---

#### 6. Postadress
```json
{
  "postadressOrganisation": {
    "dataproducent": "Bolagsverket",
    "postadress": {
      "utdelningsadress": "Kusån 903",
      "postnummer": "96198",
      "postort": "BODEN",
      "land": null,
      "coAdress": null
    }
  }
}
```

**Datavärden:**
- `utdelningsadress` - Gatuadress
- `postnummer` - Postnummer
- `postort` - Postort
- `land` - Land (om utanför Sverige)
- `coAdress` - C/O-adress

---

#### 7. Näringsgren (SNI-koder)
```json
{
  "naringsgrenOrganisation": {
    "dataproducent": "SCB",
    "sni": [
      {
        "kod": "81100",
        "klartext": "Fastighetsrelaterade stödtjänster"
      },
      {
        "kod": "95230",
        "klartext": "Lagning av skodon och lädervaror"
      }
    ]
  }
}
```

**Datavärden:**
- `sni[]` - Array med SNI-koder (Standard för svensk näringsgrensindelning)
- `kod` - 5-siffrig SNI-kod
- `klartext` - Beskrivning av näringsgren

---

#### 8. Verksamhetsbeskrivning
```json
{
  "verksamhetsbeskrivning": {
    "dataproducent": "Bolagsverket",
    "beskrivning": "Skomakeri, utbildningar, fastighetsskötsel..."
  }
}
```

**Datavärden:**
- `beskrivning` - Fritext beskrivning av verksamheten

---

#### 9. Registreringsland
```json
{
  "registreringsland": {
    "kod": "SE-LAND",
    "klartext": "Sverige"
  }
}
```

**Datavärden:**
- `kod` - Landskod
- `klartext` - Landnamn

---

#### 10. Verksamhetsstatus
```json
{
  "verksamOrganisation": {
    "dataproducent": "SCB",
    "kod": "JA"
  }
}
```

**Möjliga värden:**
- `JA` - Aktiv verksamhet
- `NEJ` - Ingen aktiv verksamhet

---

#### 11. Avregistrerad Organisation
```json
{
  "avregistreradOrganisation": {
    "dataproducent": "Bolagsverket",
    "avregistreringsdatum": null
  }
}
```

**Datavärden:**
- `avregistreringsdatum` - Datum när företaget avregistrerades (null = aktivt)

---

#### 12. Avregistreringsorsak
```json
{
  "avregistreringsorsak": {
    "dataproducent": "Bolagsverket",
    "kod": null,
    "klartext": null
  }
}
```

**Datavärden:**
- `kod` - Kod för avregistreringsorsak
- `klartext` - Beskrivning av orsak

---

#### 13. Pågående Avveckling/Omstrukturering
```json
{
  "pagaendeAvvecklingsEllerOmstruktureringsforfarande": {
    "dataproducent": "Bolagsverket",
    "pagaendeAvvecklingsEllerOmstruktureringsforfarandeLista": [
      {
        "forfarandetyp": {
          "kod": "KONKURS",
          "klartext": "Konkurs"
        },
        "registreringsdatum": "2024-01-15"
      }
    ]
  }
}
```

**Förfarandetyper:**
- KONKURS - Konkursförfarande
- LIKVIDATION - Likvidation
- REKONSTRUKTION - Företagsrekonstruktion
- ACKORDSFORSLAG - Ackordsförslag

---

#### 14. Namnskyddslopnummer
```json
{
  "namnskyddslopnummer": "001"
}
```

**Datavärden:**
- Används för enskilda firmor som kan ha flera firmor på samma personnummer

---

#### 15. Reklamspärr
```json
{
  "reklamsparr": {
    "kod": "JA",
    "klartext": "Ja"
  }
}
```

**Möjliga värden:**
- `JA` - Reklamspärr finns
- `NEJ` - Ingen reklamspärr

---

## 📄 Del 2: Årsredovisningar (iXBRL)

### Endpoint: GET /dokument/{dokumentId}

**Format:** ZIP-fil med iXBRL (Inline XBRL) dokument
**Innehåll:** Komplett årsredovisning med finansiella rapporter

### Tillgängliga Rapporter

1. **Resultaträkning**
2. **Balansräkning**
3. **Förändringar i eget kapital**
4. **Noter**
5. **Underskrifter** (Styrelse + VD)

---

### Finansiella Nyckeltal (78+ datapunkter)

#### 📈 Resultaträkning

**Intäkter:**
- `Nettoomsattning` - Total försäljning
- `OvrigaRorelseintakter` - Övriga rörelseintäkter
- `RorelseintakterLagerforandringarMm` - Lagerförändringar

**Kostnader:**
- `RavarorFornodenheterKostnader` - Råvaror och förnödenheter
- `Personalkostnader` - Personalkostnader
  - `AntalAnstallda` - Antal anställda
  - `MedelantaltAnstallda` - Medelantal anställda
  - `LonerErsattningar` - Löner och ersättningar
  - `SocialaKostnader` - Sociala kostnader
- `AvskrivningarNedskrivningarMateriellaImmateriellaAnlaggningstillgangar` - Avskrivningar
- `OvrigaExternaKostnader` - Övriga externa kostnader

**Resultat:**
- `Rorelseresultat` - Rörelseresultat (EBIT)
- `ResultatEfterFinansiellaPoster` - Resultat efter finansiella poster
- `ResultatForeSkatt` - Resultat före skatt
- `AretsResultat` - Årets resultat

**Finansiella poster:**
- `RantekostnaderLiknandeResultatposter` - Räntekostnader
- `RanteintakterLiknandeResultatposter` - Ränteintäkter

---

#### 💰 Balansräkning

**TILLGÅNGAR**

**Anläggningstillgångar:**
- `Anlaggningstillgangar` - Totalt
  - **Materiella:**
    - `MateriellaAnlaggningstillgangar` - Totalt
    - `ByggnaderMark` - Byggnader och mark
    - `MaskinerAndraTekniskaAnlaggningar` - Maskiner
    - `InventarierVerktygInstallationer` - Inventarier
  - **Finansiella:**
    - `FinansiellaAnlaggningstillgangar` - Totalt
    - `AndraLangfristigaFordringar` - Långfristiga fordringar
    - `AndraLangfristigaVardepappersinnehav` - Värdepapper

**Omsättningstillgångar:**
- `Omsattningstillgangar` - Totalt
  - **Kortfristiga fordringar:**
    - `KortfristigaFordringar` - Totalt
    - `Kundfordringar` - Kundfordringar
    - `OvrigaFordringarKortfristiga` - Övriga fordringar
  - **Kassa och bank:**
    - `KassaBank` - Kassa och bank
    - `KassaBankExklRedovisningsmedel` - Exkl. redovisningsmedel

**Summa tillgångar:**
- `Tillgangar` - Totala tillgångar (Balansomslutning)

---

**EGET KAPITAL OCH SKULDER**

**Eget kapital:**
- `EgetKapital` - Totalt eget kapital
  - **Bundet:**
    - `BundetEgetKapital` - Totalt bundet
    - `Aktiekapital` - Aktiekapital
    - `Reservfond` - Reservfond
  - **Fritt:**
    - `FrittEgetKapital` - Totalt fritt
    - `BalanseratResultat` - Balanserat resultat
    - `AretsResultatEgetKapital` - Årets resultat

**Skulder:**
- `LangfristigaSkulder` - Långfristiga skulder
  - `OvrigaLangfristigaSkulder` - Övriga långfristiga skulder
- `KortfristigaSkulder` - Kortfristiga skulder
  - `Leverantorsskulder` - Leverantörsskulder
  - `Skatteskulder` - Skatteskulder
  - `OvrigaKortfristigaSkulder` - Övriga kortfristiga skulder
  - `UpplupnaKostnaderForutbetaldaIntakter` - Upplupna kostnader

**Summa:**
- `EgetKapitalSkulder` - Totalt EK + Skulder

---

#### 📊 Nyckeltal

**Finansiella nyckeltal:**
- `Soliditet` - Soliditet (%)
- `Likviditet` - Likviditet
- `VinstmarginaleForSkatt` - Vinstmarginal före skatt
- `Avkastning` - Avkastning

---

#### 👥 Styrelse & Ledning

**Underskrifter:**
- `UnderskriftHandlingTilltalsnamn` - Förnamn
- `UnderskriftHandlingEfternamn` - Efternamn
- `UnderskriftHandlingRoll` - Roll (Styrelseordförande, Styrelseledamot, VD)
- `UndertecknandeDatum` - Datum för undertecknande
- `UndertecknandeArsredovisningOrt` - Ort

**Årsstämma:**
- `Arsstamma` - Årsstämmoinformation
- `ArsstammaIntygande` - Intygande
- `ArsstammaResultatDispositionGodkannaStyrelsensForslag` - Godkännande av styrelsens förslag
- `FaststallelseResultatBalansrakning` - Fastställelse av resultat/balansräkning

---

#### 📝 Övrig Information

**Metadata:**
- `ForetagetsNamn` - Företagets namn
- `Organisationsnummer` - Organisationsnummer
- `RakenskapsarForstaDag` - Räkenskapsår första dag
- `RakenskapsarSistaDag` - Räkenskapsår sista dag
- `RedovisningsvalutaHandlingList` - Redovisningsvaluta
- `SprakHandlingUpprattadList` - Språk för handling
- `BeloppsformatList` - Beloppsformat (tkr, mkr, kr)

**Redovisningsprinciper:**
- `RedovisningsVarderingsprinciper` - Redovisnings- och värderingsprinciper

**Resultatdisposition:**
- `ForslagDisposition` - Förslag till disposition
- `ForslagDispositionBalanserasINyRakning` - Balanseras i ny räkning

**Förändringar i EK:**
- `ForandringEgetKapitalTotalt` - Total förändring
- `ForandringEgetKapitalAretsResultat` - Årets resultat
- `ForandringEgetKapitalBalanseratResultat` - Balanserat resultat

**Programvara:**
- `programvara` - Vilket bokföringsprogram som använts (ex. Fortnox)
- `programversion` - Version av programmet

---

## 🔍 Sammanfattning av Datakällor

| Datakategori | Källa | Format |
|--------------|-------|--------|
| **Grunduppgifter** | REST API | JSON |
| **Adress & Kontakt** | REST API | JSON |
| **Näringsgren (SNI)** | REST API | JSON |
| **Verksamhetsbeskrivning** | REST API | JSON |
| **Finansiella nyckeltal** | Årsredovisning | iXBRL (ZIP) |
| **Resultaträkning** | Årsredovisning | iXBRL (ZIP) |
| **Balansräkning** | Årsredovisning | iXBRL (ZIP) |
| **Styrelse & VD** | Årsredovisning | iXBRL (ZIP) |
| **Nyckeltal (soliditet etc)** | Årsredovisning | iXBRL (ZIP) |
| **Årsstämma** | Årsredovisning | iXBRL (ZIP) |

---

## ❌ Data Som INTE Finns Tillgänglig

**Observera:** Följande data finns INTE direkt i API:et:

- ❌ Fullständig styrelselista (finns i årsredovisning underskrifter)
- ❌ Ägare/aktieägare (kräver separat tjänst från Bolagsverket)
- ❌ Historiska förändringar (API ger bara nuläge)
- ❌ Bifogade dokument (utom årsredovisningar)
- ❌ Befattningshavare (VD, firmatecknare)
- ❌ Historisk omsättning över tid (måste hämta flera årsredovisningar)
- ❌ Kreditupplysningar/betalningsanmärkningar
- ❌ Patentinformation
- ❌ Varumärken

---

## 💡 Användningsexempel

### Exempel 1: Hämta Fullständig Företagsprofil

```bash
# 1. Hämta grunddata
curl POST /organisationer → JSON med företagsinfo

# 2. Hämta dokumentlista
curl POST /dokumentlista → Lista med årsredovisningar

# 3. Ladda ner senaste årsredovisningen
curl GET /dokument/{dokumentId} → ZIP med iXBRL

# 4. Parse iXBRL för finansiella nyckeltal
# Använd XBRL-parser (Python: python-xbrl, arelle)
```

---

### Exempel 2: Extrahera Styrelsemedlemmar

**Från årsredovisning:**
1. Ladda ner dokument via `/dokument/{dokumentId}`
2. Packa upp ZIP
3. Parse XHTML för `UnderskriftHandling*` element
4. Filtrera på `UnderskriftHandlingRoll` för att hitta styrelsemedlemmar

---

### Exempel 3: Beräkna Nyckeltal

**Soliditet:**
```
Soliditet = (EgetKapital / Tillgangar) * 100
```

**Omsättningstillväxt:**
```
Tillväxt = ((Nettoomsattning[år N] - Nettoomsattning[år N-1]) / Nettoomsattning[år N-1]) * 100
```

Hämta flera årsredovisningar för trendanalys.

---

## 📚 XBRL Taxonomier

**Svenska taxonomier som används:**

- `se-gen-base` - Generella basbegrepp
- `se-cd-base` - Grundläggande företagsdata
- `se-gaap-ext` - Redovisningsprinciper (K2/K3)
- `se-bol-base` - Bolagsverket-specifika begrepp
- `se-mem-base` - Medlemskap och relationer

**Mer info:**
- Svenska taxonomier: https://www.taxonomier.se/
- XBRL International: https://www.xbrl.org/

---

## 🔗 Verktyg för XBRL-parsing

**Python:**
```bash
pip install python-xbrl arelle
```

**Node.js:**
```bash
npm install xbrl
```

**Java:**
```xml
<dependency>
  <groupId>org.xbrl</groupId>
  <artifactId>xbrl-api</artifactId>
</dependency>
```

**Online verktyg:**
- Arelle: http://arelle.org/ (Desktop app)
- Workiva: https://www.workiva.com/

---

## ✅ Verifierad Data

Baserat på faktisk hämtning för **Jonas Skomakare AB** (559085-2777):

- ✅ Grunduppgifter (namn, adress, organisationsform)
- ✅ SNI-koder (4 stycken)
- ✅ Verksamhetsbeskrivning
- ✅ Årsredovisning 2024 (154KB iXBRL)
- ✅ Finansiella nyckeltal i iXBRL
- ✅ Underskrifter (styrelse/VD)

**Senast verifierad:** 2025-12-01

---

**Version:** 1.0
**Författare:** Claude Code + Användare
**Kompletterande dokument:** Bolagsverket_API_Guide.md
