import fs from 'fs';
async function main() {
  const res = await fetch("https://docs.google.com/document/d/1G8nigMVhqT5IyiidAKtARytDWbg4Orgws-z-dXEsDn4/export?format=txt");
  const text = await res.text();
  console.log(text.substring(0, 1000));
}
main();
