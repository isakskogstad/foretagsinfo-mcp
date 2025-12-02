/**
 * Analyze iXBRL file structure to understand the format
 */
import 'dotenv/config';
import JSZip from 'jszip';
import { getBolagsverketClient } from './src/api-client/bolagsverket.js';

async function analyzeIXBRL() {
  const client = getBolagsverketClient();

  // Download a document
  const docs = await client.getDocumentList('5566543210'); // Senior Candy
  const zipBuffer = await client.downloadDocument(docs[0].dokumentId);

  const zip = await JSZip.loadAsync(zipBuffer);
  let xhtmlContent = '';

  for (const [filename, file] of Object.entries(zip.files)) {
    if (filename.endsWith('.xhtml')) {
      xhtmlContent = await file.async('string');
      break;
    }
  }

  console.log('=== Analyzing iXBRL Structure ===\n');

  // Find all ix: tags
  const ixTags = xhtmlContent.match(/<ix:[^>]+>/g) || [];
  console.log(`Found ${ixTags.length} ix: tags\n`);

  // Unique tag types
  const tagTypes = new Set<string>();
  for (const tag of ixTags) {
    const match = tag.match(/<ix:(\w+)/);
    if (match) tagTypes.add(match[1]);
  }
  console.log('ix: tag types:', Array.from(tagTypes));

  // Find nonFraction tags (numeric values)
  const nonFractionRegex = /<ix:nonFraction[^>]*name="([^"]+)"[^>]*>([^<]*)<\/ix:nonFraction>/g;
  console.log('\n=== ix:nonFraction tags (numeric values) ===');

  let match;
  const numericValues: { name: string; value: string }[] = [];

  // Reset regex and search
  const content = xhtmlContent;
  const regex = /<ix:nonFraction[^>]*>/g;
  let count = 0;

  while ((match = regex.exec(content)) !== null && count < 50) {
    const fullTag = match[0];

    // Extract name attribute
    const nameMatch = fullTag.match(/name="([^"]+)"/);
    if (nameMatch) {
      // Find the value (text content after the tag)
      const startPos = regex.lastIndex;
      const endTagPos = content.indexOf('</ix:nonFraction>', startPos);
      if (endTagPos > startPos) {
        const value = content.substring(startPos, endTagPos).trim();
        numericValues.push({ name: nameMatch[1], value });
        count++;
      }
    }
  }

  // Show unique names
  const uniqueNames = [...new Set(numericValues.map(v => v.name))];
  console.log('\nUnique field names found:');
  for (const name of uniqueNames) {
    const values = numericValues.filter(v => v.name === name);
    console.log(`  ${name}: ${values.map(v => v.value).join(', ')}`);
  }

  // Find nonNumeric tags (text values)
  console.log('\n=== ix:nonNumeric tags (text values) ===');
  const nonNumericRegex = /<ix:nonNumeric[^>]*name="([^"]+)"[^>]*>/g;
  const textNames = new Set<string>();

  while ((match = nonNumericRegex.exec(content)) !== null) {
    textNames.add(match[1]);
  }

  console.log('Unique text field names:');
  for (const name of textNames) {
    console.log(`  ${name}`);
  }

  // Look for specific Swedish XBRL tags
  console.log('\n=== Searching for known Swedish XBRL tags ===');
  const knownTags = [
    'Nettoomsattning',
    'Rorelseresultat',
    'AretsResultat',
    'SummaTillgangar',
    'SummaEgetKapital',
    'MedelantaletAnstallda',
    'Intakter', // Alternative for revenue
    'Resultat',
    'Tillgangar',
    'EgetKapital',
    'se-gen-base',
    'se-cd-base',
  ];

  for (const tag of knownTags) {
    const found = content.includes(tag);
    console.log(`  ${found ? '✅' : '❌'} ${tag}`);
  }

  // Show a sample of the XBRL content
  console.log('\n=== Sample iXBRL content (around numeric values) ===');
  const samplePos = content.indexOf('ix:nonFraction');
  if (samplePos > 0) {
    console.log(content.substring(samplePos - 100, samplePos + 500));
  }
}

analyzeIXBRL().catch(console.error);
