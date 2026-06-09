import fs from 'fs';

async function main() {
  const html = fs.readFileSync('htmlview_checked.html', 'utf-8');
  
  // Look for any 9 or 10-digit numbers inside quotes or following "gid=" or "id"
  // Let's write a regex that matches numbers that are likely GIDs
  const matches = html.match(/gid=([0-9]+)/g);
  console.log('gid= matches:', matches);

  const idMatches = html.match(/"id"\s*:\s*"?([0-9]+)"?/g);
  console.log('"id": matches:', idMatches);

  // Let's print any word containing "sheet" or "Sheet" or "gid" or "Gid"
  const wordRe = /[a-zA-Z0-9_\-]*[sS]heet[a-zA-Z0-9_\-]*/g;
  const words = Array.from(new Set(html.match(wordRe)));
  console.log('Words containing sheet:', words.slice(0, 30));

  // Let's print the entire html view so we can look at it manually or search it with a precise script
  // Let's find any list of sheet tabs in JSON or HTML
  const inlineScripts = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/g);
  console.log('Inline scripts count:', inlineScripts?.length);
}

main().catch(console.error);
