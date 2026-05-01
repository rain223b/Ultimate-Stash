async function main() {
  const res = await fetch("https://cdn.jsdelivr.net/gh/bubbls/ugs-singlefile/UGS-Files/cl10minutestildawn.png");
  console.log(res.status);
  const res2 = await fetch("https://cdn.jsdelivr.net/gh/bubbls/ugs-singlefile/UGS-Files/cl10minutestildawn.jpg");
  console.log(res2.status);
}
main();
