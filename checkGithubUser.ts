async function main() {
  const res = await fetch("https://api.github.com/users/bubbls/repos");
  const json = await res.json();
  console.log(json.map(x => x.name).join("\n"));
}
main();
