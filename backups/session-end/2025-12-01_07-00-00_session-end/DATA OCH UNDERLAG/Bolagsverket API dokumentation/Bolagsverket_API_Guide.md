# Bolagsverket API - Värdefulla Datamängder
## Teknisk Guide & Dokumentation

**Skapad:** 2025-12-01
**API Version:** v1
**Status:** ✅ Verifierad & Fungerande

---

## 📋 Innehållsförteckning

1. [OAuth2 Credentials](#oauth2-credentials)
2. [API Endpoints](#api-endpoints)
3. [Scopes](#scopes)
4. [Autentisering](#autentisering)
5. [Exempel](#exempel)
6. [Dokumentation](#dokumentation)
7. [Specifikationer & Standarder](#specifikationer--standarder)
8. [Rate Limits & API Policies](#rate-limits--api-policies)
9. [API Regler & Användningsvillkor](#api-regler--användningsvillkor)
10. [Vidare Läsning](#vidare-läsning)
11. [Felsökning](#felsökning)

---

## 🔐 OAuth2 Credentials

### Production Environment

**Client ID:**
```
UIiATHgXGSP6HIyOlqWZkX51dnka
```

**Client Secret:**
```
H10hBNr_KeYqA9h5AEe7J32HkFsa
```

**Token Endpoint:**
```
POST https://portal.api.bolagsverket.se/oauth2/token
```

**Revoke Token Endpoint:**
```
POST https://portal.api.bolagsverket.se/oauth2/revoke
```

---

### Test Environment (accept2)

**Token Endpoint:**
```
POST https://portal-accept2.api.bolagsverket.se/oauth2/token
```

**Revoke Token Endpoint:**
```
POST https://portal-accept2.api.bolagsverket.se/oauth2/revoke
```

---

## 🌐 API Endpoints

### Production

**Base URL:**
```
https://gw.api.bolagsverket.se/vardefulla-datamangder/v1
```

**Endpoints:**

| Endpoint | Method | Scope Required | Beskrivning |
|----------|--------|----------------|-------------|
| `/isalive` | GET | `vardefulla-datamangder:ping` | Kontrollera API status |
| `/organisationer` | POST | `vardefulla-datamangder:read` | Hämta företagsinformation |
| `/dokumentlista` | POST | `vardefulla-datamangder:read` | Hämta lista över årsredovisningar |
| `/dokument/{dokumentId}` | GET | `vardefulla-datamangder:read` | Hämta specifikt dokument (ZIP-fil) |

---

### Test Environment

**Base URL:**
```
https://gw-accept2.api.bolagsverket.se/vardefulla-datamangder/v1
```

**⚠️ OBS:** Testmiljön har begränsningar på vilka organisationsnummer som kan användas. Se testdata-dokumentationen.

---

## 🔑 Scopes

API:et kräver specifika scopes i access token:

| Scope | Användning |
|-------|-----------|
| `vardefulla-datamangder:read` | Hämta företagsdata, dokument, dokumentlistor |
| `vardefulla-datamangder:ping` | Kontrollera API status (/isalive) |

**VIKTIGT:** Båda scopes måste begäras samtidigt i token-requesten!

---

## 🔒 Autentisering

### 1. Hämta Access Token

**Request:**
```bash
curl -X POST https://portal.api.bolagsverket.se/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=UIiATHgXGSP6HIyOlqWZkX51dnka" \
  -d "client_secret=H10hBNr_KeYqA9h5AEe7J32HkFsa" \
  -d "scope=vardefulla-datamangder:read vardefulla-datamangder:ping"
```

**Response:**
```json
{
  "access_token": "eyJ4NXQiOiJNell4...",
  "scope": "vardefulla-datamangder:ping vardefulla-datamangder:read",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Token Giltighet:** 3600 sekunder (1 timme)

---

### 2. Använd Access Token

Alla API-anrop måste inkludera Authorization header:

```
Authorization: Bearer <access_token>
```

---

### 3. Revoke Token (valfritt)

Om du vill återkalla en token innan den löper ut:

```bash
curl -X POST https://portal.api.bolagsverket.se/oauth2/revoke \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=UIiATHgXGSP6HIyOlqWZkX51dnka" \
  -d "client_secret=H10hBNr_KeYqA9h5AEe7J32HkFsa" \
  -d "token=<access_token>"
```

---

## 📝 Exempel

### Komplett Workflow

#### 1. Hämta Token
```bash
# Spara token i miljövariabel
TOKEN=$(curl -X POST https://portal.api.bolagsverket.se/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=UIiATHgXGSP6HIyOlqWZkX51dnka" \
  -d "client_secret=H10hBNr_KeYqA9h5AEe7J32HkFsa" \
  -d "scope=vardefulla-datamangder:read vardefulla-datamangder:ping" \
  | jq -r '.access_token')
```

#### 2. Kontrollera API Status
```bash
curl -X GET 'https://gw.api.bolagsverket.se/vardefulla-datamangder/v1/isalive' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'accept: */*'
```

**Förväntat Svar:** `OK`

---

#### 3. Hämta Företagsinformation

```bash
curl -X POST 'https://gw.api.bolagsverket.se/vardefulla-datamangder/v1/organisationer' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "identitetsbeteckning": "5560001793"
  }'
```

**Request Body Format:**
```json
{
  "identitetsbeteckning": "XXXXXXXXXX"
}
```

Där `identitetsbeteckning` kan vara:
- Organisationsnummer (10 siffror)
- Personnummer
- Samordningsnummer

**Response:** JSON med företagsinformation inklusive:
- Organisationsnamn
- Organisationsform
- Juridisk form
- Postadress
- Registreringsdatum
- Näringsgren (SNI-koder)
- Verksamhetsbeskrivning
- Avregistreringsinformation

---

#### 4. Hämta Dokumentlista

```bash
curl -X POST 'https://gw.api.bolagsverket.se/vardefulla-datamangder/v1/dokumentlista' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "identitetsbeteckning": "5560001793"
  }'
```

**Response:** Lista över tillgängliga årsredovisningar och dokument.

---

#### 5. Hämta Specifikt Dokument

```bash
curl -X GET 'https://gw.api.bolagsverket.se/vardefulla-datamangder/v1/dokument/{dokumentId}' \
  -H "Authorization: Bearer $TOKEN" \
  --output dokument.zip
```

**Response:** Binary ZIP-fil

---

## 📚 Dokumentation

### Officiella Dokument

**Developer Portal (Production):**
```
https://portal.api.bolagsverket.se/devportal/apis
```

**Developer Portal (Test):**
```
https://portal-accept2.api.bolagsverket.se/devportal/apis
```

**API Specification:**
- API: "Värdefulla Datamängder"
- Klicka på "Download Swagger" för OpenAPI 3.0.3 spec
- Eller: "POSTMAN COLLECTION" för Postman-import

---

### Lokala Dokument

**Anslutningsguide (PDF):**
```
/Users/isak/Downloads/connection-establishment-guide-for-vardefulla-datamangder-test-and-production.pdf
```

**OpenAPI Specification:**
```
/Users/isak/Downloads/swagger-2.json
```

**Credentials (krypterad):**
```
/Users/isak/Library/Containers/com.apple.mail/Data/Library/Mail Downloads/2055AC08-86E3-4F80-85BB-6F1FED511C37/Vardefulla_datamangder__9999999999_Vardefulla_datamangder.zip
```
- **Lösenord:** `Cs#6nZV1Lvhk+s!S948t`

---

## 📐 Specifikationer & Standarder

### OAuth 2.0

**Standard:** RFC 6749 - The OAuth 2.0 Authorization Framework

**Grant Type:** Client Credentials Grant (Section 4.4)

**Länkar:**
- RFC 6749: https://datatracker.ietf.org/doc/html/rfc6749
- RFC 6749 Section 4.4 (Client Credentials): https://datatracker.ietf.org/doc/html/rfc6749#section-4.4
- OAuth 2.0 Official Site: https://oauth.net/2/

**Beskrivning:**
API:et använder OAuth 2.0 Client Credentials flow för maskintillmaskin-autentisering (Machine-to-Machine). Detta är lämpligt för:
- Server-till-server kommunikation
- Bakgrundstjänster
- Automatiserade processer
- När ingen användarinteraktion krävs

---

### JWT (JSON Web Tokens)

**Standard:** RFC 7519 - JSON Web Token

**Länkar:**
- RFC 7519: https://datatracker.ietf.org/doc/html/rfc7519
- JWT.io (debugger & info): https://jwt.io/

**Beskrivning:**
Access tokens från Bolagsverket API är i JWT-format. JWT består av tre delar:
1. **Header:** Metadata om token (algoritm, typ)
2. **Payload:** Claims (användare, scope, expiration)
3. **Signature:** Digital signatur för verifiering

**Exempel JWT-struktur:**
```
eyJ4NXQi... . eyJzdWIi... . T83myPke...
  Header      Payload      Signature
```

**Claims i Bolagsverket JWT:**
- `sub` - Subject (application ID)
- `iat` - Issued At (timestamp när token skapades)
- `exp` - Expiration (timestamp när token löper ut)
- `scope` - Scopes (behörigheter)
- `client_id` - Klient-ID
- `orgname` - Organisationsnamn
- `orgnr` - Organisationsnummer

---

### OpenAPI

**Standard:** OpenAPI Specification 3.0.3

**Länkar:**
- OpenAPI Specification: https://swagger.io/specification/
- OpenAPI 3.0.3 Spec: https://spec.openapis.org/oas/v3.0.3
- Swagger Editor: https://editor.swagger.io/

**Beskrivning:**
API:et tillhandahåller en komplett OpenAPI 3.0.3-specifikation som kan användas för:
- API-dokumentation
- Code generation (klientbibliotek)
- Test automation
- Mock servers
- Postman collections

**Hämta Spec:**
1. Gå till: https://portal.api.bolagsverket.se/devportal/apis
2. Välj "Värdefulla Datamängder"
3. Klicka "Download Swagger" eller "POSTMAN COLLECTION"

---

### WSO2 API Manager

**Platform:** WSO2 API Manager

**Länkar:**
- WSO2 API Manager Docs: https://apim.docs.wso2.com/
- WSO2 Gateway: https://apim.docs.wso2.com/en/latest/deploy-and-publish/deploy-on-gateway/
- OAuth2 i WSO2: https://apim.docs.wso2.com/en/latest/design/api-security/oauth2/

**Beskrivning:**
Bolagsverkets API-portal är byggd på WSO2 API Manager, en enterprise API management platform som tillhandahåller:
- API Gateway (routing, load balancing)
- OAuth2 Authorization Server
- Developer Portal
- Analytics & Monitoring
- Rate limiting & throttling

---

## ⚡ Rate Limits & API Policies

### Rate Limiting

**OBS:** Specifika rate limits är inte publicerade i den officiella dokumentationen. Kontakta Bolagsverket för exakta värden.

**Rekommenderade Best Practices:**
```
Max requests/sekund: Okänd (använd försiktig throttling)
Max requests/minut: Okänd (implementera backoff)
Max requests/timme: Okänd (övervaka användning)
```

**Implementera Rate Limiting:**
```python
import time
from datetime import datetime, timedelta

class RateLimiter:
    def __init__(self, max_calls=10, period=60):
        self.max_calls = max_calls
        self.period = period  # seconds
        self.calls = []

    def __call__(self):
        now = datetime.now()
        # Remove old calls outside period
        self.calls = [c for c in self.calls if now - c < timedelta(seconds=self.period)]

        if len(self.calls) >= self.max_calls:
            sleep_time = (self.calls[0] + timedelta(seconds=self.period) - now).total_seconds()
            time.sleep(sleep_time)
            self.calls = []

        self.calls.append(now)

# Använd rate limiter
limiter = RateLimiter(max_calls=10, period=60)
limiter()  # Anropa innan varje API-request
```

---

### HTTP Status Codes

**Förväntade Status Codes:**

| Code | Beskrivning | Åtgärd |
|------|-------------|--------|
| **200 OK** | Lyckad request | Fortsätt normalt |
| **400 Bad Request** | Ogiltig request syntax | Kontrollera JSON format |
| **401 Unauthorized** | Ogiltig eller saknad token | Hämta ny token |
| **403 Forbidden** | Token saknar rätt scope | Begär token med korrekt scope |
| **404 Not Found** | Endpoint eller resurs finns ej | Verifiera URL |
| **429 Too Many Requests** | Rate limit överskriden | Implementera exponential backoff |
| **500 Internal Server Error** | Server-fel | Retry med backoff |
| **502 Bad Gateway** | Gateway-fel | Retry med backoff |
| **503 Service Unavailable** | Tjänsten är tillfälligt nere | Retry med längre backoff |

---

### Exponential Backoff

**Implementering vid 429 eller 5xx errors:**

```python
import time
import requests

def api_call_with_retry(url, headers, max_retries=5):
    for attempt in range(max_retries):
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            return response.json()
        elif response.status_code in [429, 500, 502, 503]:
            wait_time = 2 ** attempt  # Exponential: 1, 2, 4, 8, 16 seconds
            print(f"Rate limited or error. Waiting {wait_time}s...")
            time.sleep(wait_time)
        else:
            response.raise_for_status()

    raise Exception(f"Max retries ({max_retries}) exceeded")
```

---

### Throttling Policy

**WSO2 API Manager Throttling Tiers:**

Bolagsverket kan ha konfigurerat följande throttling tiers (kontakta för verifiering):

- **Unlimited:** Ingen begränsning (ej rekommenderad för produktion)
- **Gold:** Hög throughput (företagskunder)
- **Silver:** Medium throughput
- **Bronze:** Bas throughput
- **Spike Arrest:** Förhindra burst traffic

**⚠️ Observera:** Din specifika throttling tier framgår av ditt avtal med Bolagsverket.

---

## 📜 API Regler & Användningsvillkor

### Dataskydd & GDPR

**VIKTIGT:** Bolagsverkets API kan innehålla personuppgifter.

**Riktlinjer:**
1. **Lagring:** Minimera lagring av personuppgifter
2. **Retention:** Ta bort data när den inte längre behövs
3. **Kryptering:** Kryptera känslig data i transit och i vila
4. **Access Control:** Begränsa åtkomst till behöriga användare
5. **Logging:** Logga API-anrop för audit trail (men inte personuppgifter)
6. **GDPR Compliance:** Följ GDPR för EU-medborgares data

**Länkar:**
- GDPR Official Text: https://gdpr-info.eu/
- Dataskyddsförordningen (svensk): https://www.imy.se/gdpr

---

### Användningsvillkor

**Allmänna Regler:**

1. **Autentisering:**
   - Håll Client ID och Secret säkra
   - Dela ALDRIG credentials med tredje part
   - Rotera credentials regelbundet

2. **API Användning:**
   - Använd endast för tillåtna ändamål
   - Respektera rate limits
   - Implementera error handling
   - Cache data när möjligt för att minska load

3. **Data Användning:**
   - Använd endast för specifikt avtalade syften
   - Vidareförsäljning av data kan vara förbjuden
   - Kreditera Bolagsverket som datakälla

4. **Säkerhet:**
   - Använd HTTPS för alla requests
   - Validera SSL/TLS certifikat
   - Implementera timeout på requests
   - Skydda mot injection attacks

---

### IP Whitelisting

**OBS:** Kontakta Bolagsverket för information om IP whitelisting krävs.

Vissa produktionsmiljöer kan kräva:
- Statiska IP-adresser
- IP whitelisting i Bolagsverkets firewall
- VPN-anslutning för extra säkerhet

---

### Service Level Agreement (SLA)

**Kontakta Bolagsverket för:**
- Tillgänglighetsgaranti (uptime %)
- Svarstider (latency)
- Support-nivåer
- Planerad underhåll
- Incident response times

**Typiska SLA-mått:**
- Uptime: 99.5% - 99.9%
- Latency: < 500ms (p95)
- Support: 1-4 timmar response time

---

## 📖 Vidare Läsning

### Officiella Resurser

**Bolagsverket:**
- Bolagsverket Hem: https://bolagsverket.se/
- Öppna Data: https://bolagsverket.se/om/oppnadata
- API Portal: https://portal.api.bolagsverket.se/devportal

**EU Open Data Directive:**
- High-Value Datasets: https://data.europa.eu/en/publications/datastories/high-value-datasets
- EU Data Portal: https://data.europa.eu/

---

### Tekniska Guider

**OAuth 2.0:**
- OAuth 2.0 Simplified: https://www.oauth.com/
- DigitalOcean OAuth Guide: https://www.digitalocean.com/community/tutorials/an-introduction-to-oauth-2

**JWT:**
- Introduction to JWT: https://jwt.io/introduction
- JWT Best Practices: https://datatracker.ietf.org/doc/html/rfc8725

**API Design:**
- REST API Best Practices: https://restfulapi.net/
- Microsoft API Guidelines: https://github.com/microsoft/api-guidelines
- Google API Design Guide: https://cloud.google.com/apis/design

---

### Verktyg & Libraries

**API Testing:**
- Postman: https://www.postman.com/
- Insomnia: https://insomnia.rest/
- curl: https://curl.se/

**HTTP Clients (kod):**
- Python Requests: https://requests.readthedocs.io/
- Node.js Axios: https://axios-http.com/
- Java OkHttp: https://square.github.io/okhttp/

**JWT Libraries:**
- PyJWT (Python): https://pyjwt.readthedocs.io/
- jsonwebtoken (Node.js): https://github.com/auth0/node-jsonwebtoken
- java-jwt (Java): https://github.com/auth0/java-jwt

**OpenAPI Tools:**
- Swagger Codegen: https://github.com/swagger-api/swagger-codegen
- OpenAPI Generator: https://openapi-generator.tech/
- Redoc: https://redocly.com/redoc

---

### Svenska Myndigheter med API:er

**Intressanta API:er att utforska:**

- **Bolagsverket:** Företagsinformation, årsredovisningar
- **SCB (Statistiska Centralbyrån):** Statistik API
- **Skatteverket:** Organisationsinformation
- **Riksbanken:** Valutakurser, räntor
- **Trafikverket:** Trafikdata, väderinformation
- **SMHI:** Väderdata, klimatdata

**Mer info:**
- API:er på Sverige: https://apikatalogen.se/
- Öppna Data Sverige: https://oppnadata.se/

---

## 🔧 Felsökning

### Problem: "The access token does not allow you to access the requested resource"

**Orsak:** Token saknar rätt scope.

**Lösning:** Se till att begära BÅDA scopes i token-requesten:
```
scope=vardefulla-datamangder:read vardefulla-datamangder:ping
```

---

### Problem: "Begärd organisation finns inte registrerad"

**Möjliga orsaker:**
1. Organisationsnumret finns inte i registret
2. Organisationen är avregistrerad
3. Felaktigt organisationsnummer
4. (Testmiljö) Organisationsnumret är inte godkänt testdata

**Lösning:**
- Verifiera organisationsnumret
- För testmiljö: använd godkända testnummer (se testdata-dokumentation)

---

### Problem: curl syntax error med jq

**Symptom:** `curl: option : blank argument where content is expected`

**Orsak:** Bash escaping-problem när man pipe:ar till jq.

**Lösning:** Kör curl utan jq, eller använd separata kommandon:
```bash
# Alternativ 1: Spara output först
curl ... > response.json
jq . response.json

# Alternativ 2: Kör utan jq
curl ...
```

---

## 💡 Best Practices

1. **Token Management:**
   - Spara token i miljövariabel för återanvändning
   - Generera ny token innan den löper ut (efter < 3600 sek)
   - Revoke tokens när de inte längre behövs

2. **Error Handling:**
   - Kontrollera alltid HTTP status codes
   - Parse fel-meddelanden i JSON responses
   - Implementera retry-logik för nätverksfel

3. **Rate Limiting:**
   - Respektera API:ets rate limits
   - Implementera exponential backoff vid 429-errors

4. **Security:**
   - **ALDRIG** commit credentials till git
   - Använd miljövariabler eller secrets management
   - Håll credentials krypterade i vila

---

## 🚀 Snabbstart

```bash
#!/bin/bash

# 1. Sätt credentials
CLIENT_ID="UIiATHgXGSP6HIyOlqWZkX51dnka"
CLIENT_SECRET="H10hBNr_KeYqA9h5AEe7J32HkFsa"

# 2. Hämta token
TOKEN=$(curl -X POST https://portal.api.bolagsverket.se/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "scope=vardefulla-datamangder:read vardefulla-datamangder:ping" \
  2>/dev/null | jq -r '.access_token')

# 3. Test API
curl -X GET 'https://gw.api.bolagsverket.se/vardefulla-datamangder/v1/isalive' \
  -H "Authorization: Bearer $TOKEN"

# 4. Hämta företagsdata
curl -X POST 'https://gw.api.bolagsverket.se/vardefulla-datamangder/v1/organisationer' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"identitetsbeteckning": "5560001793"}'
```

---

## 📞 Support & Kontakt

**Bolagsverket:**
- Email: [enligt din korrespondens]
- DevPortal: https://portal.api.bolagsverket.se/devportal

**Organisationsnummer:** 9999999999 (ditt access-nummer)

---

## ✅ Verifieringsstatus

- ✅ OAuth2 token generation (production)
- ✅ Scopes: `vardefulla-datamangder:read` + `vardefulla-datamangder:ping`
- ✅ `/isalive` endpoint → Svar: "OK"
- ✅ `/organisationer` endpoint → Svar: JSON (organisation ej funnen, men API fungerar)
- ⏳ `/dokumentlista` endpoint (ej testad)
- ⏳ `/dokument/{id}` endpoint (ej testad)

**Senast verifierad:** 2025-12-01

---

**Version:** 1.0
**Författare:** Claude Code + Användare
**Licens:** Privat
