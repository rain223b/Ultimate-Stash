async function main() {
  const res = await fetch("https://raw.githubusercontent.com/macvg/macvg.github.io/main/images/10minutestildawn.png");
  console.log(res.status);
}
main();
