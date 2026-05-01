async function main() {
  const res = await fetch("https://api.github.com/repos/bubbls/classroom6xarchive/contents/");
  const json = await res.json();
  console.log(json.message || json.slice(0, 10).map(x => x.name).join("\n"));
}
main();
