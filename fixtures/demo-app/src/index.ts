import { createApp } from "./app.js";
import { openDatabase } from "./db/sqlite.js";

const db = openDatabase(process.env.DB_FILE ?? "demo.sqlite");
const app = createApp(db);
const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`demo-app listening on :${port}`);
});
