/**
 * MCP Prompts - Fördefinierade analysmallar
 */

/**
 * Available prompts for MCP
 */
export const PROMPTS = [
  {
    name: 'analyze_company',
    description: 'Analysera ett företags finansiella hälsa och verksamhet baserat på offentlig data från Bolagsverket',
    arguments: [
      {
        name: 'org_number',
        description: 'Organisationsnummer för företaget att analysera (10 siffror)',
        required: true,
      },
    ],
  },
  {
    name: 'compare_companies',
    description: 'Jämför två eller flera företag baserat på finansiella nyckeltal',
    arguments: [
      {
        name: 'org_numbers',
        description: 'Kommaseparerad lista med organisationsnummer att jämföra (t.ex. "5560743089,5560427220")',
        required: true,
      },
    ],
  },
  {
    name: 'industry_analysis',
    description: 'Analysera ett företag i kontext av dess bransch baserat på SNI-koder',
    arguments: [
      {
        name: 'org_number',
        description: 'Organisationsnummer för företaget',
        required: true,
      },
    ],
  },
];

/**
 * Get prompt content by name
 */
export function getPromptContent(
  name: string,
  args: Record<string, string>
): { messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }> } {
  switch (name) {
    case 'analyze_company':
      return getAnalyzeCompanyPrompt(args.org_number);
    case 'compare_companies':
      return getCompareCompaniesPrompt(args.org_numbers);
    case 'industry_analysis':
      return getIndustryAnalysisPrompt(args.org_number);
    default:
      return {
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: `Okänd prompt: ${name}` },
          },
        ],
      };
  }
}

/**
 * analyze_company prompt template
 */
function getAnalyzeCompanyPrompt(orgNumber: string): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const prompt = `Analysera företaget med organisationsnummer ${orgNumber}.

## Instruktioner

1. **Hämta företagsinformation**
   Använd verktyget \`get_company\` med org_number: "${orgNumber}"

2. **Hämta senaste årsredovisning**
   Använd verktyget \`get_annual_report\` med org_number: "${orgNumber}"

3. **Sammanfatta följande:**

   ### Verksamhetsbeskrivning
   - Vad gör företaget?
   - Vilken bransch (baserat på SNI-koder)?
   - Hur länge har företaget funnits?

   ### Finansiell ställning
   - **Soliditet**: Eget kapital / Totala tillgångar
     - > 30% = God
     - 20-30% = Acceptabel
     - < 20% = Hög skuldsättning
   - **Likviditet**: Omsättningstillgångar / Kortfristiga skulder
     - > 2 = God
     - 1-2 = Acceptabel
     - < 1 = Likviditetsproblem

   ### Lönsamhet
   - Omsättning och omsättningsutveckling
   - Rörelseresultat och rörelsemarginal
   - Årets resultat och vinstmarginal

   ### Organisation
   - Antal anställda
   - Styrelsesammansättning
   - VD

4. **Identifiera risker och möjligheter**
   - Finansiella risker (skuldsättning, likviditet)
   - Operationella risker (bransch, konkurrens)
   - Möjligheter (tillväxt, marknad)

5. **Sammanfattande bedömning**
   Ge en övergripande bedömning av företagets finansiella hälsa och framtidsutsikter.

---
*Baserat på offentliga uppgifter från Bolagsverket. Ingen finansiell rådgivning.*`;

  return {
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: prompt },
      },
    ],
  };
}

/**
 * compare_companies prompt template
 */
function getCompareCompaniesPrompt(orgNumbers: string): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const numbers = orgNumbers.split(',').map(n => n.trim());

  const prompt = `Jämför följande företag: ${numbers.join(', ')}

## Instruktioner

1. **Hämta information för varje företag**
   ${numbers.map(n => `- Använd \`get_company\` med org_number: "${n}"`).join('\n   ')}

2. **Hämta årsredovisningar**
   ${numbers.map(n => `- Använd \`get_annual_report\` med org_number: "${n}"`).join('\n   ')}

3. **Skapa jämförelsetabell**

   | Nyckeltal | ${numbers.join(' | ')} |
   |-----------|${numbers.map(() => '------').join('|')}|
   | Omsättning | ... |
   | Rörelseresultat | ... |
   | Årets resultat | ... |
   | Totala tillgångar | ... |
   | Eget kapital | ... |
   | Soliditet (%) | ... |
   | Antal anställda | ... |

4. **Analysera skillnader**
   - Storlek (omsättning, anställda)
   - Lönsamhet (marginaler)
   - Finansiell styrka (soliditet)
   - Branschlikhet (SNI-koder)

5. **Sammanfattning**
   Vilka styrkor och svagheter har varje företag jämfört med de andra?

---
*Jämförelse baserad på senast tillgängliga årsredovisningar från Bolagsverket.*`;

  return {
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: prompt },
      },
    ],
  };
}

/**
 * industry_analysis prompt template
 */
function getIndustryAnalysisPrompt(orgNumber: string): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const prompt = `Analysera företaget ${orgNumber} i kontext av dess bransch.

## Instruktioner

1. **Hämta företagsinformation**
   Använd \`get_company\` med org_number: "${orgNumber}"

2. **Identifiera bransch**
   - Vilka SNI-koder har företaget?
   - Vad betyder dessa koder?
   - Vilken huvudbransch verkar företaget i?

3. **Hämta finansiell data**
   Använd \`get_annual_report\` med org_number: "${orgNumber}"

4. **Branschanalys**

   ### Branschbeskrivning
   - Beskriv branschen baserat på SNI-koderna
   - Typiska egenskaper för branschen (kapitalintensitet, marginalstrukt, etc.)

   ### Företagets position
   - Hur förhåller sig företagets nyckeltal till typiska branschvärden?
   - Vad kan företagets storlek indikera om dess marknadsposition?

   ### Branschspecifika risker
   - Konjunkturkänslighet
   - Regleringsrisker
   - Teknologisk förändring
   - Konkurrenssituation

5. **Slutsatser**
   - Hur väl positionerat är företaget inom sin bransch?
   - Vilka branschspecifika utmaningar och möjligheter finns?

---
*Analys baserad på SNI-klassificering och offentliga uppgifter. Branschstatistik ej inkluderad.*`;

  return {
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: prompt },
      },
    ],
  };
}

/**
 * List all available prompts
 */
export function listPrompts() {
  return PROMPTS;
}
