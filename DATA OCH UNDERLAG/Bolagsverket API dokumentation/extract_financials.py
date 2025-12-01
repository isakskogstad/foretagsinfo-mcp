import re

# Läs XHTML-filen
with open('/Users/isak/Desktop/c778ddfd-dcee-4377-83dd-06e1e12ed422.xhtml', 'r', encoding='utf-8') as f:
    content = f.read()

# Nyckeltal att extrahera
nyckeltal = {
    'Nettoomsattning': r'se-gen-base:Nettoomsattning[^>]*>([^<]+)',
    'Rorelseresultat': r'se-gen-base:Rorelseresultat[^>]*>([^<]+)',
    'AretsResultat': r'se-gen-base:AretsResultat[^>]*>([^<]+)',
    'Tillgangar': r'se-gen-base:Tillgangar[^>]*>([^<]+)',
    'EgetKapital': r'se-gen-base:EgetKapital[^>]*>([^<]+)',
    'Soliditet': r'se-gen-base:Soliditet[^>]*>([^<]+)',
    'MedelantaltAnstallda': r'se-gen-base:MedelantalAnstallda[^>]*>([^<]+)'
}

print("\n=== FINANSIELLA NYCKELTAL (Jonas Skomakare AB 2024) ===\n")

for namn, pattern in nyckeltal.items():
    matches = re.findall(pattern, content)
    if matches:
        # Ta första icke-tomma värdet
        for match in matches:
            value = match.strip()
            if value and value != '&#8211;' and value != '-':
                print(f"{namn:30s}: {value}")
                break
    else:
        print(f"{namn:30s}: [Ej tillgängligt]")

print("\n" + "="*60)
