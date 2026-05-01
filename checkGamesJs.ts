async function main() {
  const res = await fetch("https://raw.githubusercontent.com/bubbls/ugs-singlefile/main/games.js");
  const text = await res.text();
  console.log(text.substring(0, 500));
}
main();
