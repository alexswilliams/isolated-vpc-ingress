const express = require("express");
const os = require("os");

const app = express();
const port = 3000;
const hostname = os.hostname() || "Unknown Host";
const netifs = Object.entries(os.networkInterfaces()).map(([name, addrs]) => [
  name,
  addrs.map((a) => a.address),
]);

app.get("/", (_req, res) => {
  res.send(
    `Responding from ${hostname} on port ${port}
Machine netifs:
${JSON.stringify(netifs)}
`
  );
});
app.listen(port, () => {
  console.log(`Started listening for connections on port ${port}`);
});
