const { exec } = require("child_process");

const server = exec("npx wrangler dev --port 8787", {
  cwd: "/Users/fernandanp/work/bootcamp/resqlink-be/backend",
});

server.stdout.on("data", (data) => {
  console.log(data);
  if (data.includes("Ready on")) {
    exec(
      "curl -s http://localhost:8787/providers/nearby?h3_index=878c10702ffffff",
      (err, stdout) => {
        console.log("CURL OUTPUT:", stdout);
        server.kill();
        process.exit(0);
      },
    );
  }
});
server.stderr.on("data", (data) => {
  console.error(data);
});
