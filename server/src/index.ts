import { createApp } from "./app";
import { config } from "./config/config";

const app = createApp();
app.listen(config.port, () =>
  console.log(
    `Teacher Class Hub API listening on http://localhost:${config.port}`,
  ),
);
