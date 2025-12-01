import re
import sys

# Läs XHTML-filen
with open('/Users/isak/Desktop/c778ddfd-dcee-4377-83dd-06e1e12ed422.xhtml', 'r', encoding='utf-8') as f:
    content = f.read()

# Extrahera alla underskrifter
patterns = {
    'fornamn': r'UnderskriftHandlingTilltalsnamn[^>]*>([^<]+)',
    'efternamn': r'UnderskriftHandlingEfternamn[^>]*>([^<]+)',
    'roll': r'UnderskriftHandlingRoll[^>]*>([^<]+)'
}

fornamn = re.findall(patterns['fornamn'], content)
efternamn = re.findall(patterns['efternamn'], content)
roller = re.findall(patterns['roll'], content)

print("\n=== STYRELSE & LEDNING ===\n")
for i in range(min(len(fornamn), len(efternamn), len(roller))):
    print(f"{i+1}. {fornamn[i].strip()} {efternamn[i].strip()}")
    print(f"   Roll: {roller[i].strip()}")
    print()

# Extrahera datum och ort
datum_match = re.search(r'UndertecknandeDatum[^>]*>([^<]+)', content)
ort_match = re.search(r'UndertecknandeArsredovisningOrt[^>]*>([^<]+)', content)

if datum_match:
    print(f"Datum: {datum_match.group(1).strip()}")
if ort_match:
    print(f"Ort: {ort_match.group(1).strip()}")
