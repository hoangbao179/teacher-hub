import mysql from "mysql2/promise";
import { config } from "../config/config";

export const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  queueLimit: 0,
  timezone: "Z",
  charset: "utf8mb4",
  dateStrings: true,
});
